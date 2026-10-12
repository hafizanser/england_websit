import { http, withFallback } from './http'
import { products, categories, topSellingIds } from '../data/site'

// ---- local fallback helpers (used only if the backend is unreachable) ------
const clone = (v) => JSON.parse(JSON.stringify(v))
const soldNum = (s) => parseFloat(String(s).replace('k', '')) * (String(s).includes('k') ? 1000 : 1)

function localProducts({ cat = 'all', q = '', sort = 'popular' } = {}) {
  let list = clone(products)
  if (cat && cat !== 'all') list = list.filter((p) => p.categoryId === cat)
  if (q) {
    const needle = q.trim().toLowerCase()
    list = list.filter(
      (p) => p.name.toLowerCase().includes(needle) || p.category.toLowerCase().includes(needle),
    )
  }
  const sorters = {
    popular: (a, b) => soldNum(b.sold) - soldNum(a.sold),
    priceLow: (a, b) => a.wholesale - b.wholesale,
    priceHigh: (a, b) => b.wholesale - a.wholesale,
    rating: (a, b) => b.rating - a.rating,
  }
  return list.sort(sorters[sort] || sorters.popular)
}

// ---- public API ------------------------------------------------------------
// Products & categories come ONLY from the admin backend (single source of
// truth). No bundled/dummy fallback — if the backend is unreachable the page
// shows an honest error/empty state instead of fake catalogue data.
export function getProducts(opts = {}) {
  const qs = new URLSearchParams({
    cat: opts.cat || 'all',
    q: opts.q || '',
    sort: opts.sort || 'popular',
  }).toString()
  return http.get(`/products?${qs}`).then((r) => r.data)
}

// ---------------------------------------------------------------------------
// A product by id. `null` means ONE thing: the server looked and this product
// does not exist (HTTP 404). Everything else — a dropped connection, a timeout,
// a 500, a gateway cutting the response in half — is RE-THROWN, so the caller
// says "something went wrong, try again" instead of "this product was deleted".
//
// This used to go through withFallback() against the bundled demo catalogue,
// whose `.find()` returns undefined for every real product id — so EVERY
// network blip became `null`, which is exactly the storefront's not-found
// card. On the shared host this site runs on a connection dropped mid-flight is
// not rare (see the audit in this commit), and it was being reported to
// shopkeepers as "Product nahi mila" for a product sitting right there in the
// database. Worse, `null` is a perfectly cacheable value, so useAsync stored it
// and the phantom deletion outlived the blip by up to a day. Both halves are
// fixed: this no longer manufactures a null, and lib/queryCache.js no longer
// stores one.
// ---------------------------------------------------------------------------
export async function getProductById(id) {
  try {
    return (await http.get(`/products/${id}`)).data
  } catch (e) {
    if (e?.status === 404) return null // a real answer: the product is gone
    throw e // transient — the caller retries, and offers a Retry button
  }
}

// Same rule: a failure here is a failure, not an empty catalogue. Returning []
// from a dropped request would quietly blank the "related products" rail.
export function getProductsByIds(ids = []) {
  return http.get('/products').then((r) => (r.data || []).filter((p) => ids.includes(p.id)))
}

export function getCategories() {
  return http.get('/categories').then((r) => r.data)
}

// ---- blog (public) ---------------------------------------------------------
export function getBlogs() {
  return http.get('/blogs').then((r) => r.data)
}

export function getBlogBySlug(slug) {
  return http.get(`/blogs/${slug}`).then((r) => r.data)
}

// ---- homepage reel videos (public) -----------------------------------------
// The order shown in the "products in action" carousel is whatever the admin
// dashboard saved. If the backend is unreachable we fall back to the reels that
// shipped in /public/videos so the section never regresses to empty.
const FALLBACK_REEL_NUMS = [1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
const fallbackVideos = () =>
  FALLBACK_REEL_NUMS.map((i, idx) => {
    const n = String(i).padStart(2, '0')
    return {
      id: `dvreel-${n}`,
      position: idx + 1,
      source_type: 'upload',
      video_url: `/videos/dvreel-${n}.mp4`,
      poster_url: `/videos/dvreel-${n}.jpg`,
    }
  })

export function getHomepageVideos() {
  return withFallback(
    async () => {
      const data = (await http.get('/homepage-videos')).data
      // Guard against an empty table (e.g. migration not run yet) so the homepage
      // keeps showing the shipped reels rather than an empty carousel.
      return Array.isArray(data) && data.length ? data : fallbackVideos()
    },
    async () => fallbackVideos(),
  )
}

export function getTopSelling() {
  return withFallback(
    async () => (await http.get('/products/top-selling')).data,
    async () => {
      const map = new Map(clone(products).map((p) => [p.id, p]))
      return topSellingIds.map((id) => map.get(id)).filter(Boolean)
    },
  )
}
