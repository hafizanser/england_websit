import { useEffect, useMemo, useState } from 'react'
import { getProducts } from '../api/catalog'

// Live "search as you type" over the catalogue.
//
// The catalogue is fetched ONCE per page load and shared by every caller, then
// filtered in memory. A request per keystroke would be neither live (a round
// trip on a shop's mobile connection is not instant) nor kind to their data, and
// the storefront already downloads this exact list the moment anyone opens
// /products — so the copy is free in practice and every keystroke after the
// first is pure JS.
let catalogPromise = null

function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = getProducts({ cat: 'all', q: '', sort: 'popular' })
      .then((list) => (Array.isArray(list) ? list : []))
      .catch((err) => {
        catalogPromise = null // let the next opener retry rather than cache a failure
        throw err
      })
  }
  return catalogPromise
}

/**
 * The storefront's ONE search rule: a product matches when the query appears as a
 * substring of its name or its category name, case-insensitively.
 *
 * This is a deliberate mirror of the server's `WHERE LOWER(product_name) LIKE
 * '%q%' OR LOWER(c.name) LIKE '%q%'` (RefProduct::storefront) — which is also
 * what the bundled fallback in api/catalog.js `localProducts` does. The drawer
 * previews results locally while /products asks the server for them, so the two
 * MUST agree: any cleverness here (word-by-word matching, searching the subtitle,
 * relevance ranking) would show the shopper a product in the preview that then
 * vanishes the moment they press Enter.
 *
 * Order is left exactly as the catalogue came back, which is the same
 * `is_featured DESC, id DESC` the results page renders — so the preview and the
 * full list are in the same order too.
 *
 * Change this only together with the server rule.
 */
export function matchProducts(list, query) {
  const needle = String(query || '').trim().toLowerCase()
  if (!needle || !Array.isArray(list)) return []
  return list.filter(
    (p) =>
      String(p?.name || '').toLowerCase().includes(needle) ||
      String(p?.category || '').toLowerCase().includes(needle),
  )
}

/**
 * @param query   raw text from the search box
 * @param enabled only start (and keep) the fetch while the search UI is open
 * @param limit   how many results to hand back for display
 */
export function useProductSearch(query, { enabled = true, limit = 8 } = {}) {
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!enabled || catalog || error) return undefined
    let alive = true
    loadCatalog().then(
      (list) => { if (alive) setCatalog(list) },
      (err) => { if (alive) setError(err) },
    )
    return () => { alive = false }
  }, [enabled, catalog, error])

  const q = query.trim()
  const all = useMemo(() => (catalog && q ? matchProducts(catalog, q) : []), [catalog, q])

  return {
    results: all.slice(0, limit),
    total: all.length,
    // "Still fetching the catalogue" — only meaningful once there is a query to
    // answer, so an empty box never shows a spinner.
    loading: Boolean(q) && !catalog && !error,
    error,
  }
}
