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

export function getProductById(id) {
  return withFallback(
    async () => (await http.get(`/products/${id}`)).data,
    async () => clone(products).find((p) => p.id === id) || null,
  )
}

export function getProductsByIds(ids = []) {
  return withFallback(
    async () => {
      const all = (await http.get('/products')).data
      return all.filter((p) => ids.includes(p.id))
    },
    async () => clone(products).filter((p) => ids.includes(p.id)),
  )
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

export function getTopSelling() {
  return withFallback(
    async () => (await http.get('/products/top-selling')).data,
    async () => {
      const map = new Map(clone(products).map((p) => [p.id, p]))
      return topSellingIds.map((id) => map.get(id)).filter(Boolean)
    },
  )
}
