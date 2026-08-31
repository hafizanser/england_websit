import { http } from './http'
import { CATALOG_PREFIX } from './cacheKeys'
import { invalidateCache } from '../lib/queryCache'

// A review changes the rating badge on every card for that product, plus the
// homepage testimonial slider — so it retires the same catalogue cache an admin
// save does rather than trying to surgically patch one key.
const dropCatalogCache = () => invalidateCache(CATALOG_PREFIX)

// ---- public ----------------------------------------------------------------
export async function getProductReviews(productId) {
  return (await http.get(`/products/${productId}/reviews`)).data
}

// Recent approved reviews across all products — homepage testimonial slider.
export async function getFeaturedReviews(limit = 12) {
  return (await http.get(`/reviews/featured?limit=${limit}`)).data
}

// Submit a review — open to everyone. A guest passes their name; logged-in
// customers are attributed automatically (the token is sent when present).
export async function submitReview(productId, { rating, comment, customer_name }) {
  const res = (
    await http.post(
      `/products/${productId}/reviews`,
      { rating, comment, customer_name },
      { customerAuth: true },
    )
  ).data
  dropCatalogCache()
  return res
}

// ---- admin -----------------------------------------------------------------
export async function adminListReviews() {
  return (await http.get('/admin/reviews', { auth: true })).data
}

export async function adminUpdateReview(id, payload) {
  const res = (await http.post(`/admin/reviews/${id}`, payload, { auth: true })).data
  dropCatalogCache()
  return res
}

export async function adminDeleteReview(id) {
  const res = await http.del(`/admin/reviews/${id}`, { auth: true })
  dropCatalogCache()
  return res
}

export async function adminNotifications() {
  return (await http.get('/admin/notifications', { auth: true })).data
}
