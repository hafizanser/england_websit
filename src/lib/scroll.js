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
// Returns an idempotent `unlock` function — safe to call more than once and
// ideal as a React effect cleanup: `useEffect(() => lockScroll(), [open])`.
let lockCount = 0
let savedOverflow = ''

export function lockScroll() {
  if (typeof document === 'undefined') return () => {}
  if (lockCount === 0) {
    // Snapshot the current inline value so we restore exactly what was there
    // (usually '' — which lets the stylesheet's overflow-x rule reapply).
    savedOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  lockCount += 1

  let released = false
  return function unlock() {
    if (released) return // guard against double-invocation (e.g. StrictMode)
    released = true
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount === 0) {
      document.body.style.overflow = savedOverflow
    }
  }
}

// Scroll a target element to just below the sticky header so it's fully visible
// without manual scrolling. Deferred via requestAnimationFrame so it runs after
// the global ScrollToTop reset (which fires on route change) and after layout
// has settled, guaranteeing this final position wins.
export function scrollBelowHeader(el, { smooth = false, gap = 12 } = {}) {
  if (!el || typeof window === 'undefined') return
  requestAnimationFrame(() => {
    const header = document.querySelector('header')
    const offset = header ? header.getBoundingClientRect().height : 0
    const top = el.getBoundingClientRect().top + window.scrollY - offset - gap
    window.scrollTo({ top: Math.max(0, top), left: 0, behavior: smooth ? 'smooth' : 'auto' })
  })
}
