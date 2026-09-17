// Shrink a product clip in the browser, before it is uploaded.
//
// ---------------------------------------------------------------------------
// Why
// ---------------------------------------------------------------------------
// A phone or a camera hands you a 64 MB .MOV for what the storefront renders
// into a 64×64 badge and, at its very largest, a ~700px lightbox. Sending those
// bytes is the single worst thing in the whole admin flow: minutes of uploading
// on a Pakistani office uplink, and at the end of it PHP may refuse the file for
// being over upload_max_filesize — which is exactly what was happening.
//
// Re-encoding here turns that into a few megabytes and a few seconds. The API
// still transcodes what it receives with ffmpeg (App\Support\VideoStorage), so
// this is not replacing that step; it is making sure the step is reachable.
//
// ---------------------------------------------------------------------------
// How, and the honest cost
// ---------------------------------------------------------------------------
// There is no fast path for this in a browser. MediaRecorder captures a canvas
// in REAL TIME, so a 30-second clip takes about 30 seconds to convert — which is
// still far quicker than uploading 64 MB, and the caller is given progress so it
// never looks stalled.
//
// IT DROPS THE AUDIO, and that is a deliberate trade rather than an oversight.
// Capturing the element's audio needs an AudioContext graph, and an unmuted
// element cannot be reliably auto-played from inside a promise chain — the
// autoplay policy wants a fresh user gesture. A muted element always plays. The
// badge renders the clip muted anyway, so the only loss is sound in the
// lightbox; SKIP_UNDER_BYTES is set generously so that an ordinary short clip
// goes up untouched, with its audio, and never reaches this code at all.
//
// Every failure path returns the ORIGINAL file. An undecodable container (a
// ProRes .MOV, say), a browser without MediaRecorder, a codec nobody supports, a
// result that came out bigger — all of them fall through to "upload what you
// were given", which is what would have happened without this module.

// The longest edge worth keeping. The badge is 64px and the lightbox frame is
// ~700px, so this is already generous for a high-density screen.
const MAX_EDGE = 720

const FPS = 30
const BITS_PER_SECOND = 1_200_000

// Below this, leave it alone: it uploads fine as-is, and passing it through here
// would cost real time AND its audio for no useful saving.
const SKIP_UNDER_BYTES = 12 * 1024 * 1024

// A clip that never fires `ended` (a broken duration, a stalled decode) must not
// hang the save forever. Generous, because the wait is bounded by the clip's own
// length and long product clips are legitimate.
const HARD_CAP_MS = 10 * 60 * 1000

// In preference order. The API accepts any of these extensions and re-encodes to
// H.264 regardless, so an intermediate WebM is fine — mp4 is merely first
// because it needs no conversion at all on the far end.
const CANDIDATES = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

const VIDEO_NAME = /\.(mp4|m4v|mov|webm|ogv|ogg|avi|mkv|3gp)$/i

/**
 * Re-encode `file` smaller, or return it unchanged.
 *
 * `onProgress(fraction)` is called with 0..1 as the clip is processed — this is
 * real time passing, so the caller should show it.
 *
 * Never throws. The worst case is the file you passed in.
 */
export async function compressVideo(file, { onProgress } = {}) {
  if (!(file instanceof File)) return file
  if (!file.type.startsWith('video/') && !VIDEO_NAME.test(file.name)) return file
  if (file.size <= SKIP_UNDER_BYTES) return file
  if (typeof MediaRecorder === 'undefined' || typeof document === 'undefined') return file

  const mimeType = CANDIDATES.find((t) => {
    try {
      return MediaRecorder.isTypeSupported(t)
    } catch {
      return false
    }
  })
  if (!mimeType) return file

  const url = URL.createObjectURL(file)
  const video = document.createElement('video')

  try {
    video.src = url
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    if (!(await settled(video, 'loadedmetadata', 20000))) return file

    const { videoWidth: w, videoHeight: h, duration } = video
    if (!w || !h || !Number.isFinite(duration) || duration <= 0) return file

    const scale = Math.min(1, MAX_EDGE / Math.max(w, h))
    // Even dimensions: H.264's 4:2:0 chroma sampling cannot represent an odd
    // width or height, and encoders either refuse or quietly pad.
    const cw = even(w * scale)
    const ch = even(h * scale)

    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    const stream = canvas.captureStream(FPS)
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: BITS_PER_SECOND })

    const chunks = []
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data)
    }
    const recorded = new Promise((resolve) => {
      recorder.onstop = resolve
      recorder.onerror = resolve
    })

    recorder.start(1000)
    try {
      await video.play()
    } catch {
      recorder.stop()
      return file
    }

    let raf = 0
    const paint = () => {
      ctx.drawImage(video, 0, 0, cw, ch)
      if (typeof onProgress === 'function') {
        try {
          onProgress(Math.min(1, video.currentTime / duration))
        } catch {
          /* a broken progress handler must not take the encode down */
        }
      }
      raf = requestAnimationFrame(paint)
    }
    paint()

    await settled(video, 'ended', HARD_CAP_MS)
    cancelAnimationFrame(raf)

    if (recorder.state !== 'inactive') recorder.stop()
    await recorded

    const blob = new Blob(chunks, { type: mimeType })
    // A re-encode that did not actually help is not worth the quality it cost.
    if (!blob.size || blob.size >= file.size) return file

    return new File([blob], rename(file.name, mimeType), {
      type: blob.type || mimeType,
      lastModified: Date.now(),
    })
  } catch {
    return file
  } finally {
    try {
      video.pause()
    } catch {
      /* ignore */
    }
    video.removeAttribute('src')
    URL.revokeObjectURL(url)
  }
}

/** True when `event` fired before `ms` elapsed (or the media errored out). */
function settled(el, event, ms) {
  return new Promise((resolve) => {
    let done = false
    const finish = (ok) => {
      if (done) return
      done = true
      clearTimeout(timer)
      el.removeEventListener(event, onEvent)
      el.removeEventListener('error', onError)
      resolve(ok)
    }
    const onEvent = () => finish(true)
    const onError = () => finish(false)
    const timer = setTimeout(() => finish(false), ms)
    el.addEventListener(event, onEvent, { once: true })
    el.addEventListener('error', onError, { once: true })
  })
}

const even = (n) => Math.max(2, Math.round(n / 2) * 2)

// The API derives the stored extension from the filename it is handed
// (VideoStorage::saveUpload validates it), so a WebM body under a .MOV name is
// rejected outright. Keep the readable stem, correct the suffix.
function rename(name, mime) {
  const ext = mime.includes('mp4') ? 'mp4' : 'webm'
  const stem = String(name || 'video').replace(/\.[^.]+$/, '')
  return `${stem || 'video'}.${ext}`
}
