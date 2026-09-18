// Shrink a product clip in the browser before it is uploaded — WITHOUT ever
// losing its sound.
//
// ---------------------------------------------------------------------------
// Why this exists
// ---------------------------------------------------------------------------
// A phone hands you a 64 MB .MOV for what the storefront renders into a 64×64
// badge and, at its largest, a ~700px lightbox. Uploading those bytes from a
// shop's connection takes minutes. Re-encoding the picture here turns it into a
// few megabytes first. The API still runs ffmpeg over whatever it receives
// (App\Support\VideoStorage), so this does not replace that step — it makes the
// upload in front of it survivable.
//
// ---------------------------------------------------------------------------
// The one rule: the audio arrives, or the original does
// ---------------------------------------------------------------------------
// An earlier version recorded a <canvas> with MediaRecorder. A canvas has no
// audio track, so every clip it touched came out silent — a content change
// nobody asked for. It is gone, and so is the approach: this module never plays
// the clip, never draws it, and never records anything.
//
// It REMUXES instead, with WebCodecs (through mediabunny):
//
//   the file is demuxed          MP4 / MOV / WebM are read directly from the
//                                File — no <video> element, no blob: URL
//   the PICTURE is re-encoded    decoded, scaled to MAX_EDGE, encoded as H.264
//   the SOUND is not touched     AAC — which is what virtually every phone,
//                                iPhone .MOV included, records — is COPIED
//                                packet for packet into the new MP4. It is the
//                                same compressed bytes, not a re-encode of them,
//                                so it cannot lose quality, cannot drift out of
//                                sync, and cannot come out silent.
//   anything else is converted   PCM, Opus, MP3 sources have no place in an MP4
//                                as-is, so they are transcoded to AAC 128 kbps.
//
// and then it CHECKS rather than trusts. Every one of these returns the
// original file, untouched, to be uploaded as it is:
//
//   - the browser has no WebCodecs, or cannot decode the picture (an iPhone
//     HEVC clip on a machine without an HEVC decoder is the common case)
//   - the conversion would drop ANY audio track, for ANY reason — the library
//     reports this up front (discardedTracks) and it is treated as a veto, not
//     a warning
//   - the finished MP4 has a different number of audio tracks than the source,
//     any of them is not AAC, or its duration does not match
//   - a channel that had sound in the source is silent (or near it) in the
//     result — measured on decoded samples, not inferred from metadata
//   - the result is not actually smaller
//   - anything throws
//
// A clip WITHOUT an audio track is compressed normally: there is nothing to
// lose. And files at or under SKIP_UNDER_BYTES never reach any of this — they
// upload exactly as picked, as they always have.

const SKIP_UNDER_BYTES = 12 * 1024 * 1024

// The longest edge worth keeping: the badge is 64px and the lightbox frame is
// ~700px, so this is already generous for a high-density screen.
const MAX_EDGE = 720

const VIDEO_BITRATE = 1_500_000

// Only used when the source audio cannot be copied (PCM, Opus, MP3…). AAC at
// 128 kbps is transparent for speech and product sound.
const AUDIO_TRANSCODE_BITRATE = 128_000

// How much of each audio track the loudness check listens to.
const LISTEN_SECONDS = 8

// Below this RMS a channel is treated as silence. -60 dBFS: far quieter than any
// recorded room tone, far louder than the numerical noise of a silent encode.
const SILENCE_RMS = 0.001

// An output channel must keep at least this fraction of its source loudness.
// A copied track keeps 1.0 exactly; a transcoded one stays within a few percent.
const MIN_LOUDNESS_RATIO = 0.25

// Source and output audio durations must agree this closely. AAC encoder
// priming can move the end by a frame or two (~20-40 ms); a truncated track
// misses by far more.
const DURATION_TOLERANCE_S = 0.5

const VIDEO_NAME = /\.(mp4|m4v|mov|webm|mkv|3gp)$/i

/**
 * Re-encode `file` smaller with its audio intact, or return it unchanged.
 *
 * `onProgress(fraction)` is called with 0..1 while the picture is re-encoded.
 *
 * Never throws. The worst case is the file you passed in.
 */
export async function compressVideo(file, { onProgress } = {}) {
  if (!(file instanceof File)) return file
  if (!file.type.startsWith('video/') && !VIDEO_NAME.test(file.name)) return file
  if (file.size <= SKIP_UNDER_BYTES) return file
  if (typeof VideoDecoder === 'undefined' || typeof VideoEncoder === 'undefined') return file

  let mb
  try {
    // Loaded on demand: the library is only worth its weight for the rare save
    // that carries a large clip, so it stays out of the admin bundle until then.
    mb = await import('mediabunny')
  } catch {
    return file
  }

  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) })

  try {
    const video = await input.getPrimaryVideoTrack()
    if (!video || !(await video.canDecode())) return file

    const sourceAudio = await input.getAudioTracks()

    // Display dimensions are AFTER the container's rotation matrix, so a
    // portrait iPhone clip (stored landscape, flagged "rotate 90") is sized as
    // the portrait picture it really is.
    const dw = await video.getDisplayWidth()
    const dh = await video.getDisplayHeight()
    if (!dw || !dh) return file
    const scale = Math.min(1, MAX_EDGE / Math.max(dw, dh))
    const width = even(dw * scale)
    const height = even(dh * scale)

    const output = new mb.Output({
      // moov atom up front, so the clip starts playing before it has fully
      // downloaded.
      format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: new mb.BufferTarget(),
    })

    const conversion = await mb.Conversion.init({
      input,
      output,
      showWarnings: false,
      video: {
        width,
        height,
        fit: 'contain',
        codec: 'avc',
        quality: new mb.Quality({ bitrate: VIDEO_BITRATE }),
        // The whole point is to shrink the picture, so never pass it through
        // untouched even when the codec already matches.
        forceTranscode: true,
        // Bake any rotation into the pixels rather than carrying it as
        // metadata, so every player — and the server's ffmpeg — sees an upright
        // frame without having to honour a matrix.
        allowTransformationMetadata: false,
      },
      // Per track, because the right options depend on what the track already
      // is. An AAC source gets NOTHING but the codec: setting a quality (or a
      // bitrate, or a sample rate) makes the library re-encode even when the
      // codec already matches — which is exactly what happened the first time
      // this was tested: 160 kbps in, 130 kbps out. With the codec alone, the
      // default copy mode moves the AAC packets across byte for byte.
      //
      // Only a source MP4 cannot carry as AAC (PCM, Opus, MP3…) is given a
      // bitrate, because only that one is actually being encoded.
      audio: async (track) =>
        (await track.getCodec()) === 'aac'
          ? { codec: 'aac' }
          : { codec: 'aac', quality: new mb.Quality({ bitrate: AUDIO_TRANSCODE_BITRATE }) },
    })

    // THE VETO. If the library has decided to leave any audio track out — no
    // AAC encoder on this device, a codec it cannot decode, anything — the
    // conversion is abandoned before a single frame is encoded.
    if (!conversion.isValid) return file
    if (conversion.discardedTracks.some((d) => d.track.isAudioTrack())) return file
    if (!conversion.utilizedTracks.includes(video)) return file
    if (!sourceAudio.every((t) => conversion.utilizedTracks.includes(t))) return file

    conversion.onProgress = (fraction) => {
      if (typeof onProgress !== 'function') return
      try {
        onProgress(Math.min(1, Math.max(0, fraction)))
      } catch {
        /* a broken progress handler must not take the encode down */
      }
    }

    await conversion.execute()

    const buffer = output.target.buffer
    if (!buffer || buffer.byteLength >= file.size) return file

    const result = new File([buffer], rename(file.name), {
      type: 'video/mp4',
      lastModified: Date.now(),
    })

    // Verify the file that will actually be uploaded, not the plan for it.
    if (!(await audioSurvived(mb, sourceAudio, result))) return file

    return result
  } catch {
    return file
  } finally {
    input.dispose()
  }
}

/**
 * True when every source audio track reappears in `result` as AAC, with the same
 * duration and channel count, and still audible wherever the source was.
 */
async function audioSurvived(mb, sourceTracks, result) {
  const check = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(result) })
  try {
    const outTracks = await check.getAudioTracks()
    if (outTracks.length !== sourceTracks.length) return false

    for (let i = 0; i < sourceTracks.length; i += 1) {
      const src = sourceTracks[i]
      const out = outTracks[i]

      if ((await out.getCodec()) !== 'aac') return false
      const [srcChannels, outChannels] = await Promise.all([
        src.getNumberOfChannels(),
        out.getNumberOfChannels(),
      ])
      if (outChannels !== srcChannels) return false

      const [srcDur, outDur] = await Promise.all([src.computeDuration(), out.computeDuration()])
      if (!(outDur > 0) || Math.abs(outDur - srcDur) > DURATION_TOLERANCE_S) return false

      const [srcLevels, outLevels] = await Promise.all([loudness(mb, src), loudness(mb, out)])
      if (!srcLevels || !outLevels || srcLevels.length !== outLevels.length) return false

      for (let c = 0; c < srcLevels.length; c += 1) {
        // A channel that was silent in the source can stay silent; one that had
        // sound must still have it.
        if (srcLevels[c] > SILENCE_RMS && outLevels[c] < srcLevels[c] * MIN_LOUDNESS_RATIO) {
          return false
        }
      }
    }
    return true
  } catch {
    return false
  } finally {
    check.dispose()
  }
}

/** Per-channel RMS over the first LISTEN_SECONDS of `track`, or null. */
async function loudness(mb, track) {
  const sink = new mb.AudioSampleSink(track)
  const start = await track.getFirstTimestamp()
  let sums = null
  let frames = 0

  for await (const sample of sink.samples(start, start + LISTEN_SECONDS)) {
    try {
      const buf = sample.toAudioBuffer()
      if (!sums) sums = new Float64Array(buf.numberOfChannels)
      for (let c = 0; c < buf.numberOfChannels && c < sums.length; c += 1) {
        const data = buf.getChannelData(c)
        let s = 0
        for (let i = 0; i < data.length; i += 1) s += data[i] * data[i]
        sums[c] += s
      }
      frames += buf.length
    } finally {
      sample.close()
    }
  }

  if (!sums || !frames) return null
  return Array.from(sums, (s) => Math.sqrt(s / frames))
}

// Even dimensions: H.264's 4:2:0 chroma sampling cannot represent an odd width
// or height, and encoders either refuse or quietly pad.
const even = (n) => Math.max(2, Math.round(n / 2) * 2)

// The API derives the stored extension from the filename it is handed
// (VideoStorage::saveUpload validates it), so an MP4 body under a .MOV name would
// be stored with the wrong suffix. Keep the readable stem, correct the suffix.
function rename(name) {
  const stem = String(name || 'video').replace(/\.[^.]+$/, '')
  return `${stem || 'video'}.mp4`
}
