import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Reset scroll position on every route change.
//
// Skipped entirely when the navigation carries a self-positioning flag
// (`scrollToGrid` / `scrollToOffer`) or an Offers deep-link (`?offer=`), because
// that page positions ITSELF before the first paint. This effect MUST be a layout
// effect: a passive one runs after paint, so a non-skipped route would flash the
// previous page's scrollY for a frame. Offers deep-links are skipped so this reset
// never races their single land-on-offer scroll (which was the Hero flash when a
// waiting `scrollTo(0)` + later offer scroll ran as two moves).
//
// Hash fragments are intentionally NOT a skip signal: with HashRouter the route
// already lives in the fragment, and skipping on hash left the previous page's
// scrollY stuck (footer flash) until a late scrollIntoView ran.
//
// `behavior: 'instant'` is load-bearing, not decoration: the reset must never
// animate, or it races the destination page's own scroll.
export default function ScrollToTop() {
  const location = useLocation()
  const navType = useNavigationType()

  const { pathname, search, state, key } = location
  const offerDeepLink = pathname === '/offers' && new URLSearchParams(search).has('offer')
  const selfPositioning = Boolean(state?.scrollToGrid || state?.scrollToOffer || offerDeepLink)

  const isFirstRef = useRef(true)
  const routeKey = `${pathname}${search || ''}`
  const saveKey = key || routeKey

  const savePos = (k, y) => {
    try {
      sessionStorage.setItem(`scroll:${k}`, String(Math.max(0, Math.round(y || 0))))
    } catch {
      return
    }
  }

  const readPos = (k) => {
    try {
      const raw = sessionStorage.getItem(`scroll:${k}`)
      const n = Number(raw)
      return Number.isFinite(n) ? n : null
    } catch {
      return null
    }
  }

  useLayoutEffect(() => {
    return () => {
      savePos(saveKey, window.scrollY)
      savePos(routeKey, window.scrollY)
    }
  }, [saveKey, routeKey])

  useLayoutEffect(() => {
    if (selfPositioning) {
      isFirstRef.current = false
      return
    }

    const isFirst = isFirstRef.current
    isFirstRef.current = false

    if (!isFirst && navType === 'POP') {
      const y = readPos(saveKey) ?? readPos(routeKey) ?? 0
      window.scrollTo({ top: y, left: 0, behavior: 'auto' })
      return
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [saveKey, routeKey, navType, selfPositioning])

  return null
}
