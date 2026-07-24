import { useEffect, useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import {
  setCurrentEntry,
  recordScroll,
  flushScroll,
  restoreScroll,
  entryKey,
  readScrollFor,
} from '../../lib/scrollRestore'

// Scroll policy for the whole storefront, in one place:
//
//   • forward navigation (a product card, a nav link, any button that calls
//     navigate) starts the new page at the top — unless that page positions
//     ITSELF (see `selfPositioning`);
//   • Back / Forward returns to the exact pixel the shopper left, on every route,
//     including the self-positioning ones.
//
// The position for the CURRENT entry is kept live by a scroll listener rather
// than read at transition time. That is deliberate: by the time a route change
// reaches an effect, React has already swapped the DOM, so a tall page replaced
// by a short (still-loading) one has had its scrollY clamped by the browser —
// reading `window.scrollY` there records the clamped value and Back lands in the
// wrong place. The listener's last value is from a real user scroll, so it is
// always the number we actually want.
//
// This effect MUST be a layout effect: a passive one runs after paint, so a
// forward navigation would flash the previous page's scrollY for a frame.
//
// Hash fragments are intentionally NOT a skip signal: with HashRouter the route
// already lives in the fragment, and skipping on hash left the previous page's
// scrollY stuck (footer flash) until a late scrollIntoView ran.
export default function ScrollToTop() {
  const location = useLocation()
  const navType = useNavigationType()

  const { pathname, search, state } = location
  const offerDeepLink = pathname === '/offers' && new URLSearchParams(search).has('offer')
  const selfPositioning = Boolean(state?.scrollToGrid || state?.scrollToOffer || offerDeepLink)
  const isPop = navType === 'POP'

  // Per-entry key, plus the URL as a fallback so a reload (which throws every
  // entry key away) can still find the position it left.
  const routeKey = `${pathname}${search || ''}`
  const saveKey = entryKey(location)

  // Own the scroll position outright — otherwise the browser's own restoration
  // races ours on Back and wins the first frame.
  useEffect(() => {
    const prev = window.history.scrollRestoration
    if (prev) window.history.scrollRestoration = 'manual'
    return () => {
      if (prev) window.history.scrollRestoration = prev
    }
  }, [])

  // Declared FIRST so it publishes the new entry before the reset/restore below
  // runs — and so its cleanup flushes while the outgoing entry's position is
  // still the one on record.
  useLayoutEffect(() => {
    setCurrentEntry(saveKey, routeKey)
    return () => flushScroll()
  }, [saveKey, routeKey])

  // Continuous save. This is what makes "save the scroll position whenever the
  // user opens a product / detail page / taps any link" true everywhere without
  // touching a single link: by the time ANY navigation happens, the position is
  // already recorded. Passive + a plain Map write per event (sessionStorage is
  // flushed on a throttle), so it costs nothing during a scroll.
  useEffect(() => {
    const record = () => recordScroll(window.scrollY)
    const persist = () => {
      record()
      flushScroll()
    }
    window.addEventListener('scroll', record, { passive: true })
    window.addEventListener('pagehide', persist)
    return () => {
      window.removeEventListener('scroll', record)
      window.removeEventListener('pagehide', persist)
    }
  }, [])

  useLayoutEffect(() => {
    const remembered = readScrollFor(location)

    // Back / Forward wins over everything, including the pages that normally
    // place themselves (a category deep-link into /products, an ?offer= deep
    // link). Coming BACK to one of those, the shopper's own position is the
    // right answer — re-running the landing scroll would throw them back up to
    // the filter bar, or to an offer card they had already scrolled past.
    // `useScrollRestoring` is how those pages know to stand down; it asks the
    // same two questions this branch does, so the two can never disagree.
    //
    // The app's first render is reported as a POP as well, which is what makes
    // a reload land back where it was — and, with nothing remembered, simply
    // means "start at the top".
    if (isPop) return restoreScroll(remembered ?? 0)

    // Forward navigation into a page that positions itself before first paint.
    if (selfPositioning) return undefined

    window.scrollTo(0, 0)
    return undefined
  }, [location, isPop, selfPositioning])

  return null
}
