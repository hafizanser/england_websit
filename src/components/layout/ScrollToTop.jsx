import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Reset scroll position on every route change (ignores in-page hash links).
//
// Skipped entirely when the navigation carries `state.scrollToGrid`, because that
// page positions ITSELF before the first paint (ProductsPage landing on the filter
// bar for a footer category link). This effect is passive, so it runs AFTER that
// layout effect and after the browser has painted — resetting here would yank a
// correctly-placed page back to the top and then let it scroll down again, which
// is precisely the "jumps to the banner first" glitch. The arriving page owns its
// landing position; our job is only to handle the routes that don't care.
//
// `behavior: 'instant'` is load-bearing, not decoration: the reset must never
// animate, or it races the destination page's own scroll. It pins the behavior at
// the call site regardless of any inherited `scroll-behavior: smooth`. The previous
// `'instant' in window ? ... : 'auto'` guard was always false — `instant` is not a
// property of window — so it silently took the animated path every single time.
export default function ScrollToTop() {
  const { pathname, hash, state } = useLocation()
  const selfPositioning = Boolean(state?.scrollToGrid)
  useEffect(() => {
    if (hash || selfPositioning) return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, hash, selfPositioning])
  return null
}
