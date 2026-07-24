import { useLocation, useNavigationType } from 'react-router-dom'
import { readScrollFor } from '../lib/scrollRestore'

/**
 * True when the current render is a Back/Forward into a history entry whose
 * scroll position we remember — i.e. ScrollToTop is about to put the shopper
 * back exactly where they were.
 *
 * Pages that normally place themselves on arrival (ProductsPage landing on its
 * filter bar, OffersPage landing on a deep-linked deal) must stand down when
 * this is true, or their landing scroll fights the restore and wins — dumping
 * the shopper back at the top of a list they had already worked through.
 *
 * Why not just `useNavigationType() === 'POP'`: react-router reports the app's
 * very FIRST render as a POP too (its history is initialised with that action),
 * so a plain type check would also disable the landing on a fresh deep link —
 * the one case where the page really does own the scroll. Requiring a remembered
 * position separates the two: a first visit has nothing stored, a genuine Back
 * does. It also keeps the pages honest about *why* they are standing down.
 */
export function useScrollRestoring() {
  const location = useLocation()
  const navType = useNavigationType()
  return navType === 'POP' && readScrollFor(location) != null
}
