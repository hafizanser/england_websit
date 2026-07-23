// Reference-counted body scroll lock. Multiple owners (the mobile menu, an
// expanded video reel, drawers, modals, popups) can lock concurrently, and
// scrolling is only ever restored once EVERY owner has released its lock.
//
// Why counting matters: <body> lives OUTSIDE React's tree and survives route
// changes, so the naive `document.body.style.overflow = 'hidden' | ''` pattern
// is fragile — if two owners overlap, one closing and blindly resetting to ''
// unlocks the page while the other still needs it locked; and a single missed
// cleanup leaves the whole site unscrollable until reload. Counting + saving the
// original inline value makes both failure modes impossible.
//
// Mobile Safari / Chrome ignore `overflow: hidden` on body for touch scrolling
// (especially when the finger is on a fixed backdrop beside a drawer). Pinning
// the body with `position: fixed` + restoring scrollY on unlock is the reliable
// fix — the page stays visually frozen while only the open panel can scroll.
//
// Returns an idempotent `unlock` function — safe to call more than once and
// ideal as a React effect cleanup: `useEffect(() => lockScroll(), [open])`.
let lockCount = 0
let saved = null

export function lockScroll() {
  if (typeof document === 'undefined') return () => {}
  if (lockCount === 0) {
    const { body, documentElement: html } = document
    saved = {
      scrollY: window.scrollY || window.pageYOffset || 0,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
    }
    html.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${saved.scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
  }
  lockCount += 1

  let released = false
  return function unlock() {
    if (released) return // guard against double-invocation (e.g. StrictMode)
    released = true
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount === 0 && saved) {
      const { body, documentElement: html } = document
      const y = saved.scrollY
      body.style.overflow = saved.bodyOverflow
      body.style.position = saved.bodyPosition
      body.style.top = saved.bodyTop
      body.style.left = saved.bodyLeft
      body.style.right = saved.bodyRight
      body.style.width = saved.bodyWidth
      html.style.overflow = saved.htmlOverflow
      html.style.overscrollBehavior = saved.htmlOverscroll
      saved = null
      window.scrollTo(0, y)
    }
  }
}

// Live height of the sticky site header. Always measured, never hardcoded: the
// header stacks an announcement marquee — which pads env(safe-area-inset-top) on
// notched phones — above the main bar, so its height varies by device and reflows
// with the viewport. The measurement already INCLUDES the safe-area inset, so
// callers must not add env(safe-area-inset-top) on top of it again.
export function getHeaderHeight() {
  if (typeof document === 'undefined') return 0
  const header = document.querySelector('header')
  return header ? header.getBoundingClientRect().height : 0
}

// Document-flow top of `el`, in page coordinates.
//
// `el` MUST NOT be position:sticky, nor a child of a sticky element. A sticky
// element is unmeasurable as a scroll target while it is pinned: BOTH its
// getBoundingClientRect().top AND its offsetTop report the PINNED position, not
// where it rests in the flow (verified in Chrome — offsetTop tracks the pin, it
// is not the flow-only measurement it looks like). Scrolling toward a value
// derived from a pinned element is a feedback loop: every px of scroll pushes the
// pin down, which pushes the target down, and the scroll chases it and overshoots.
//
// The way to locate a sticky element is to measure a zero-height sentinel sitting
// immediately before it in normal flow — see ProductsPage's filter-bar anchor.
export function flowTop(el) {
  return el.getBoundingClientRect().top + window.scrollY
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const easeOutCubic = (t) => 1 - (1 - t) ** 3

// How long to keep holding the target after arriving. Late-loading images and
// data above the target (e.g. the banner's product-count chips) can reflow and
// shove it, which would otherwise leave the landing a few dozen px off.
const SETTLE_MS = 400

// Scroll so that `el`'s top edge sits flush under the sticky header — no part of
// whatever precedes it (banner, previous section) left visible above it.
//
// `el` must be a NON-sticky element (see flowTop). To land a sticky bar, pass the
// zero-height sentinel that precedes it, not the bar itself.
//
// This is a hand-rolled rAF animation rather than `behavior: 'smooth'` or an
// anchor because both of those resolve their destination ONCE, at kickoff. This
// page's destination is not stable at kickoff: the grid swaps skeletons for real
// cards and the banner reflows as it fills in, all while the scroll is in flight.
// Re-deriving the target every frame absorbs those shifts instead of being thrown
// off by them, and the settle pass holds the line after the easing finishes.
//
// Returns a cancel function. Also self-cancels on any manual scroll input, so it
// never wrestles the user for control of the page.
export function scrollSectionUnderHeader(el, { smooth = true, duration = 480, gap = 0 } = {}) {
  if (!el || typeof window === 'undefined') return () => {}

  const doc = document.documentElement
  const targetFor = () => {
    const max = Math.max(0, doc.scrollHeight - window.innerHeight)
    return Math.min(Math.max(0, flowTop(el) - getHeaderHeight() - gap), max)
  }

  // Defensive: an inherited `scroll-behavior: smooth` would make each per-frame
  // write spawn its own competing animation toward that frame's value, and the
  // loop would fight itself instead of easing. Nothing sets that today (see the
  // note in index.css) — this keeps the animation correct if anyone re-adds it.
  const savedBehavior = doc.style.scrollBehavior
  doc.style.scrollBehavior = 'auto'

  let rafId = 0
  let stopped = false

  const stop = () => {
    if (stopped) return
    stopped = true
    cancelAnimationFrame(rafId)
    doc.style.scrollBehavior = savedBehavior
    window.removeEventListener('wheel', stop)
    window.removeEventListener('touchstart', stop)
    window.removeEventListener('keydown', stop)
  }

  window.addEventListener('wheel', stop, { passive: true, once: true })
  window.addEventListener('touchstart', stop, { passive: true, once: true })
  window.addEventListener('keydown', stop, { once: true })

  const animate = smooth && !prefersReducedMotion()

  // Land SYNCHRONOUSLY when not animating, rather than waiting for the first rAF.
  // Callers use this from a layout effect to be in position before the browser
  // paints; deferring the jump by even one frame paints the pre-scroll position
  // first, which is exactly the "flash at the top, then snap down" glitch. The rAF
  // loop below still runs afterwards, purely to hold the spot against late reflow.
  if (!animate) window.scrollTo(0, targetFor())

  let startedAt = 0
  let from = 0
  let settleUntil = 0

  const frame = (now) => {
    if (stopped) return
    // Read the start position on the FIRST FRAME, not at call time. On a route
    // change this runs alongside ScrollToTop's reset, and capturing eagerly would
    // latch the OUTGOING page's scroll position (e.g. y=5563 down in the footer),
    // easing from a place the page is no longer at — a visible lurch.
    if (!startedAt) {
      startedAt = now
      from = window.scrollY
    }
    const to = targetFor()

    if (animate) {
      const p = Math.min(1, (now - startedAt) / duration)
      window.scrollTo(0, from + (to - from) * easeOutCubic(p))
      if (p < 1) {
        rafId = requestAnimationFrame(frame)
        return
      }
    } else {
      window.scrollTo(0, to)
    }

    // Arrived — hold against reflow until the target stops moving.
    if (!settleUntil) settleUntil = now + SETTLE_MS
    if (Math.abs(window.scrollY - to) > 1) window.scrollTo(0, to)
    if (now < settleUntil) rafId = requestAnimationFrame(frame)
    else stop()
  }

  rafId = requestAnimationFrame(frame)
  return stop
}

// Scroll a target element to just below the sticky header so it's fully visible
// without manual scrolling. Deferred via requestAnimationFrame so it runs after
// the global ScrollToTop reset (which fires on route change) and after layout
// has settled, guaranteeing this final position wins.
export function scrollBelowHeader(el, { smooth = false, gap = 12 } = {}) {
  if (!el || typeof window === 'undefined') return
  requestAnimationFrame(() => {
    const top = el.getBoundingClientRect().top + window.scrollY - getHeaderHeight() - gap
    window.scrollTo({ top: Math.max(0, top), left: 0, behavior: smooth ? 'smooth' : 'auto' })
  })
}
