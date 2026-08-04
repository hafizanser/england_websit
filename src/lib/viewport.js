// Publishes STABLE safe-area insets as CSS custom properties on <html>.
//
// Why this exists — the iOS/Android layout gap:
//
// `env(safe-area-inset-bottom)` is a CONSTANT on Android (always 0px in the
// browser) but is DYNAMIC on iOS Safari: it reports 0px while the bottom
// toolbar is expanded and ~34px the moment that toolbar collapses on scroll.
// Anything sized from it therefore re-lays out mid-scroll — the floating bottom
// nav grew and shrank under the shopper's finger, the page's bottom clearance
// changed with it, and the sticky product bar hopped. That is the single
// biggest reason the iOS build drifted out of alignment with Android.
//
// The fix: measure the inset with a throwaway probe element, keep the LARGEST
// value observed for the current orientation, and publish it once as a plain px
// value. The layout then resolves against the "toolbar collapsed" state for the
// whole session and never moves again, while Android keeps resolving to 0px
// exactly as before. Desktop reads 0px too, so nothing there changes.
//
// The CSS fallbacks in ios.css (`--sab: env(safe-area-inset-bottom, 0px)`)
// cover first paint, before this module has run.

const SIDES = ['top', 'right', 'bottom', 'left']
const VAR = { top: '--sat', right: '--sar', bottom: '--sab', left: '--sal' }

// Largest inset seen since the last orientation change. Reset on rotate,
// because rotating genuinely moves which edges carry an inset (portrait puts
// ~34px at the bottom; landscape puts ~44px left/right and ~21px at the bottom).
let peak = { top: 0, right: 0, bottom: 0, left: 0 }

// A 0x0 fixed, hidden probe whose PADDING is set from env(). Custom properties
// can't be read back resolved, but computed padding can — so padding is the
// only reliable way to get the numeric inset into JS.
function measure() {
  const probe = document.createElement('div')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:0',
    'height:0',
    'visibility:hidden',
    'pointer-events:none',
    'padding-top:env(safe-area-inset-top,0px)',
    'padding-right:env(safe-area-inset-right,0px)',
    'padding-bottom:env(safe-area-inset-bottom,0px)',
    'padding-left:env(safe-area-inset-left,0px)',
  ].join(';')

  document.body.appendChild(probe)
  const cs = getComputedStyle(probe)
  const out = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  }
  probe.remove()
  return out
}

function publish(force = false) {
  const now = measure()
  const root = document.documentElement.style
  for (const side of SIDES) {
    // Monotonic per orientation: only ever grow. A 0 reported while the iOS
    // toolbar is expanded must NOT shrink chrome that is already laid out —
    // that shrink-then-grow cycle IS the mid-scroll jump this module exists to
    // remove. The cost is a constant few px of float above Safari's expanded
    // toolbar, which on a floating pill nav reads as intentional; the benefit
    // is that the document's height never changes while the shopper scrolls.
    if (!force && now[side] <= peak[side]) continue
    peak[side] = now[side]
    root.setProperty(VAR[side], `${peak[side]}px`)
  }
}

// `resize` fires on nearly every frame of an iOS toolbar collapse, and each
// measurement appends a probe and forces a synchronous layout — so coalesce
// them to one read per frame.
let queued = 0
function schedule() {
  if (queued) return
  queued = requestAnimationFrame(() => {
    queued = 0
    publish()
  })
}

export function initSafeAreaVars() {
  if (typeof document === 'undefined') return () => {}

  publish(true)

  const onRotate = () => {
    // Rotating genuinely moves which edges carry an inset (portrait puts ~34px
    // at the bottom; landscape puts ~44px left/right), so the running peaks are
    // no longer meaningful and have to start over.
    peak = { top: 0, right: 0, bottom: 0, left: 0 }
    publish(true)
    // iOS keeps reporting the pre-rotation insets for a few frames, and its
    // toolbar re-expands on rotate — so take a second read once it has settled.
    window.setTimeout(() => publish(), 350)
  }

  // `resize` is what catches the toolbar collapsing on iOS (the moment the real
  // bottom inset appears), with no scroll listener needed.
  window.addEventListener('resize', schedule, { passive: true })
  window.addEventListener('orientationchange', onRotate, { passive: true })

  const mql = window.matchMedia?.('(orientation: portrait)')
  mql?.addEventListener?.('change', onRotate)

  return () => {
    if (queued) cancelAnimationFrame(queued)
    queued = 0
    window.removeEventListener('resize', schedule)
    window.removeEventListener('orientationchange', onRotate)
    mql?.removeEventListener?.('change', onRotate)
  }
}
