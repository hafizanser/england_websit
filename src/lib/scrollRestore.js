// Per-history-entry scroll memory, plus a restore routine that survives the fact
// that this storefront paints BEFORE it has any data.
//
// Every page here fetches on mount (useAsync — no cache), so a Back navigation
// re-mounts the destination as skeletons. A one-shot `window.scrollTo(0, y)` at
// that moment is silently clamped to the skeleton page's tiny scrollHeight, and
// when the real cards land a few hundred ms later the page has already settled
// near the top. That clamp is the whole reason Back "loses" the position, and it
// is why restoring has to be a loop that keeps re-asserting the target until the
// document is actually tall enough to hold it.

// Hot path. Written on every scroll event, so it must stay a plain Map write —
// sessionStorage is flushed on a throttle instead (see `flush`).
const MEM = new Map()
const PREFIX = 'scroll:'

// Pending MEM->sessionStorage writes. sessionStorage is the ONLY layer that
// survives a reload, but writing it 60×/s during a scroll is a real jank source.
const DIRTY = new Set()
let flushTimer = 0
const FLUSH_MS = 300

function flush() {
  flushTimer = 0
  if (!DIRTY.size) return
  try {
    for (const k of DIRTY) sessionStorage.setItem(PREFIX + k, String(MEM.get(k) ?? 0))
  } catch {
    // Private mode / quota — MEM still serves this session, which covers Back.
  }
  DIRTY.clear()
}

/** Remember `y` for a history entry. Cheap enough to call from a scroll handler. */
export function saveScroll(key, y) {
  if (!key) return
  MEM.set(key, Math.max(0, Math.round(y || 0)))
  DIRTY.add(key)
  if (!flushTimer && typeof window !== 'undefined') {
    flushTimer = window.setTimeout(flush, FLUSH_MS)
  }
}

/** Force any pending writes out now — for `pagehide`, where there is no later. */
export function flushScroll() {
  if (flushTimer && typeof window !== 'undefined') window.clearTimeout(flushTimer)
  flush()
}

// ---- the entry currently on screen ----------------------------------------
//
// Held here rather than in ScrollToTop so that non-React code — specifically
// lockScroll() — can pin down the true position without having to be handed a
// key it has no way of knowing.
let liveKeys = null
let paused = 0

/** ScrollToTop publishes the entry whose position `recordScroll` should write. */
export function setCurrentEntry(key, routeKey) {
  liveKeys = { key, routeKey }
}

/**
 * Record `y` as the current entry's position.
 *
 * Ignored while tracking is paused, unless `force` — see `pauseScrollTracking`
 * for why anything would want to pause it.
 */
export function recordScroll(y, { force = false } = {}) {
  if (!liveKeys || (paused && !force)) return
  const { key, routeKey } = liveKeys
  saveScroll(key, y)
  if (routeKey !== key) saveScroll(routeKey, y)
}

/**
 * Stop believing `scroll` events until the returned function is called.
 *
 * Needed because locking the body (lockScroll) pins it with `position: fixed`,
 * which collapses the document to viewport height. The browser then clamps the
 * scroll to 0 and fires a perfectly ordinary scroll event for it — so opening
 * the mobile drawer would otherwise overwrite the page's real saved position
 * with 0, and Back / "Filter saaf karein" would return the shopper to the top of
 * a page they had scrolled a long way down.
 *
 * Counted, to match lockScroll's own reference counting: nested owners (drawer
 * over an expanded video, say) each hold a pause and tracking resumes only once
 * the last one lets go.
 */
export function pauseScrollTracking() {
  paused += 1
  let released = false
  return function resumeScrollTracking() {
    if (released) return // idempotent — safe as a React effect cleanup
    released = true
    paused = Math.max(0, paused - 1)
  }
}

/**
 * Storage key for a history ENTRY — two visits to the same URL are two entries,
 * each with its own remembered position.
 *
 * react-router labels the entry the app booted on `'default'`, and it re-uses
 * that label on every reload. Keeping it would mean a refresh deep in a session
 * reads back the position of whatever page the tab happened to open on, so the
 * boot entry is keyed by URL instead — which is also exactly what a reload wants.
 */
export function entryKey(location) {
  const route = `${location.pathname}${location.search || ''}`
  return location.key && location.key !== 'default' ? location.key : route
}

/** Remembered scroll for a history entry, or null if we never saw it. */
export function readScroll(key) {
  if (!key) return null
  if (MEM.has(key)) return MEM.get(key)
  try {
    const raw = sessionStorage.getItem(PREFIX + key)
    if (raw == null) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

/**
 * Remembered position for a location: its own history entry first, then the URL
 * as the reload fallback. The single lookup both the restorer and the pages that
 * must stand down for it consult, so they can never disagree about whether a
 * position exists.
 */
export function readScrollFor(location) {
  const route = `${location.pathname}${location.search || ''}`
  return readScroll(entryKey(location)) ?? readScroll(route)
}

// How long to keep re-asserting the target while the page fills in. Generous
// because it costs nothing when the content is already there (the loop exits as
// soon as it lands and holds), and a shopkeeper on a slow connection is exactly
// the person who needs it. Any real scroll input cancels it immediately.
const RESTORE_TIMEOUT_MS = 2500
// Once we're at the target, hold it briefly — late images and the banner's
// product-count chips reflow after the grid arrives and would otherwise shove
// the landing a few dozen px off.
const SETTLE_MS = 250

/**
 * Put the window back at `y` and KEEP it there until the page has finished
 * growing into that position (or the user takes over).
 *
 * Returns a cancel function — call it from an effect cleanup so a fast second
 * navigation can never leave two loops fighting over the scroll position.
 */
export function restoreScroll(y) {
  if (typeof window === 'undefined') return () => {}
  const target = Math.max(0, Math.round(y || 0))
  const doc = document.documentElement

  // Best effort right now, synchronously: callers run this from a layout effect,
  // so landing here means the FIRST painted frame is already as close to the
  // target as the current (possibly skeleton) height allows. Deferring even one
  // frame paints the top of the page first — the flash we're removing.
  const apply = () => {
    const max = Math.max(0, doc.scrollHeight - window.innerHeight)
    const to = Math.min(target, max)
    if (Math.abs(window.scrollY - to) > 1) window.scrollTo(0, to)
    return to
  }
  apply()

  // Nothing to chase — don't spin a loop for a page that was never scrolled.
  if (target === 0) return () => {}

  let rafId = 0
  let stopped = false
  let reachedAt = 0
  const startedAt = performance.now()

  const stop = () => {
    if (stopped) return
    stopped = true
    cancelAnimationFrame(rafId)
    window.removeEventListener('wheel', stop)
    window.removeEventListener('touchmove', stop)
    window.removeEventListener('keydown', stop)
  }

  // Never wrestle the user for the page. A tap must NOT cancel (touchstart fires
  // on any tap, including the one that opened this page) — only actual scrolling.
  window.addEventListener('wheel', stop, { passive: true, once: true })
  window.addEventListener('touchmove', stop, { passive: true, once: true })
  window.addEventListener('keydown', stop, { once: true })

  const frame = (now) => {
    if (stopped) return
    const landed = apply() >= target - 1
    if (landed) {
      if (!reachedAt) reachedAt = now
      if (now - reachedAt >= SETTLE_MS) return stop()
    } else {
      reachedAt = 0 // page shrank again (data swap) — restart the settle window
    }
    if (now - startedAt >= RESTORE_TIMEOUT_MS) return stop()
    rafId = requestAnimationFrame(frame)
  }

  rafId = requestAnimationFrame(frame)
  return stop
}
