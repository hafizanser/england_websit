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
