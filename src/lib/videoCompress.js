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
// IT ONLY RUNS IN A VISIBLE TAB, and that is not a nicety either. MediaRecorder
// records wall-clock, so the clip has to genuinely PLAY — and Chrome pauses
// muted, video-only media the moment a page goes to the background, to save
// power ("video-only background media was paused"). An encode started in a tab
// the admin then switches away from would sit there drawing one frame forever.
// So a hidden page skips the whole thing and uploads the original, and a tab
// hidden MID-encode is caught by the stall watchdog and does the same.
//
// Every failure path returns the ORIGINAL file. An undecodable container (a
// ProRes .MOV, say), a browser without MediaRecorder, a codec nobody supports, a
// backgrounded tab, a stall, a result that came out bigger — all of them fall
// through to "upload what you were given", which is exactly what would have
// happened without this module. It is an accelerator, never a gate.

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
// With the stall watchdog below doing the real work, this only has to stop a
// pathological case from running forever.
const HARD_CAP_MS = 10 * 60 * 1000

// How long playback may make no progress before the encode is abandoned. This is
// what catches a tab backgrounded mid-run, a decoder that gave up, and a clip
// whose duration metadata lies about how much of it actually exists.
const STALL_MS = 8000

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
  // See the note above: a hidden page cannot play video-only media, so there is
  // nothing for the recorder to capture.
  if (document.visibilityState && document.visibilityState !== 'visible') return file

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

    // DRAWING is on rAF, because that is the only clock tied to frames actually
    // being composited — there is no point copying pixels the compositor will
    // not pick up.
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

    // WATCHING is on a timer, and that split is load-bearing. rAF does not fire
    // at all in a hidden tab — which is precisely the situation this watchdog
    // exists to catch — so a stall check riding on the paint loop would go to
    // sleep at the exact moment it was needed and leave the encode hanging until
    // the hard cap. setInterval keeps ticking (throttled, but ticking).
    let lastTime = -1
    let lastMoved = Date.now()
    let stalled = false

    const watchdog = setInterval(() => {
      if (video.currentTime !== lastTime) {
        lastTime = video.currentTime
        lastMoved = Date.now()
        return
      }
      // Chrome pauses muted video-only media when the page is backgrounded. Ask
      // for it back; if it will not come, the stall below ends the attempt.
      if (video.paused && !video.ended) video.play().catch(() => {})

      if (Date.now() - lastMoved > STALL_MS) {
        stalled = true
        video.dispatchEvent(new Event('ended'))
      }
    }, 1000)

    await settled(video, 'ended', HARD_CAP_MS)
    cancelAnimationFrame(raf)
    clearInterval(watchdog)

    if (recorder.state !== 'inactive') recorder.stop()
    await recorded

    // A stalled run recorded a frozen frame for however long it lasted. That is
    // worse than the original in every way, so it is discarded outright.
    if (stalled) return file

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
