import { http } from './http'

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
  return (
    await http.post(
      `/products/${productId}/reviews`,
      { rating, comment, customer_name },
      { customerAuth: true },
    )
  ).data
}

// ---- admin -----------------------------------------------------------------
export async function adminListReviews() {
  return (await http.get('/admin/reviews', { auth: true })).data
}

export async function adminUpdateReview(id, payload) {
  return (await http.post(`/admin/reviews/${id}`, payload, { auth: true })).data
}

export async function adminDeleteReview(id) {
  return http.del(`/admin/reviews/${id}`, { auth: true })
}

export async function adminNotifications() {
  return (await http.get('/admin/notifications', { auth: true })).data
}
