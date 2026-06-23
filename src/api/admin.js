import { http, setAdminToken } from './http'

// ---- auth ------------------------------------------------------------------
export async function adminLogin(username, password) {
  const res = await http.post('/auth/admin/login', { username, password })
  setAdminToken(res.token)
  return res.user
}
export async function adminLogout() {
  try {
    await http.post('/auth/admin/logout', {}, { auth: true })
  } catch {
    /* ignore */
  }
  setAdminToken(null)
}
export async function adminMe() {
  const res = await http.get('/auth/admin/me', { auth: true })
  return res.user
}

// ---- orders ----------------------------------------------------------------
export async function listOrders({ status = 'all', q = '' } = {}) {
  const qs = new URLSearchParams({ status, q }).toString()
  return (await http.get(`/admin/orders?${qs}`, { auth: true })).data
}
export async function getAdminOrder(id) {
  return (await http.get(`/admin/orders/${id}`, { auth: true })).order
}
export async function createAdminOrder(payload) {
  return (await http.post('/admin/orders', payload, { auth: true })).order
}
export async function updateOrderStatus(id, status, note) {
  return (await http.patch(`/admin/orders/${id}/status`, { status, note }, { auth: true })).order
}
export async function setItemDiscount(orderId, itemId, discount, note) {
  return (
    await http.patch(`/admin/orders/${orderId}/items/${itemId}/discount`, { discount, note }, { auth: true })
  ).order
}

// ---- customers -------------------------------------------------------------
export async function listCustomers() {
  return (await http.get('/admin/customers', { auth: true })).data
}
export async function getCustomer(id) {
  return (await http.get(`/admin/customers/${id}`, { auth: true })).customer
}
export async function createCustomer(payload) {
  return (await http.post('/admin/customers', payload, { auth: true })).customer
}
export async function updateCustomer(id, payload) {
  return (await http.put(`/admin/customers/${id}`, payload, { auth: true })).customer
}
export async function deleteCustomer(id) {
  return http.del(`/admin/customers/${id}`, { auth: true })
}

// ---- products --------------------------------------------------------------
export async function adminListProducts() {
  return (await http.get('/admin/products', { auth: true })).data
}
export async function getAdminProduct(id) {
  return (await http.get(`/admin/products/${id}`, { auth: true })).product
}
// `p` is a plain object; File fields (productImage, galleryFiles[]) become multipart parts.
export async function saveProduct(p) {
  const fd = toFormData(p)
  const path = p.id ? `/admin/products/${p.id}` : '/admin/products'
  return (await http.postForm(path, fd, { auth: true })).product
}
export async function deleteProduct(id) {
  return http.del(`/admin/products/${id}`, { auth: true })
}

// ---- categories ------------------------------------------------------------
export async function adminListCategories() {
  return (await http.get('/admin/categories', { auth: true })).data
}
export async function saveCategory(c, isNew = false) {
  const fd = toFormData(c)
  const path = c.id && !isNew ? `/admin/categories/${c.id}` : '/admin/categories'
  return (await http.postForm(path, fd, { auth: true })).category
}
export async function deleteCategory(id) {
  return http.del(`/admin/categories/${id}`, { auth: true })
}

// ---- blog ------------------------------------------------------------------
export async function adminListBlogs() {
  return (await http.get('/admin/blogs', { auth: true })).data
}
// `b` may carry an `image` File field (multipart). New post if no id.
export async function saveBlog(b) {
  const fd = toFormData(b)
  const path = b.id ? `/admin/blogs/${b.id}` : '/admin/blogs'
  return (await http.postForm(path, fd, { auth: true })).blog
}
export async function deleteBlog(id) {
  return http.del(`/admin/blogs/${id}`, { auth: true })
}

// ---- profit breakdown (PIN-gated) ------------------------------------------
export async function verifyProfitPin(pin) {
  return (await http.post('/admin/profit/verify', { pin }, { auth: true })).unlocked
}
export async function getProfitBreakdown(pin) {
  return http.get(`/admin/profit?pin=${encodeURIComponent(pin)}`, { auth: true })
}

// Order-level profit analytics (mirrors order_management profits / profitDetails).
export async function getProfitOrders({ pin, from = '', to = '' }) {
  const qs = new URLSearchParams({ pin, from, to }).toString()
  return (await http.get(`/admin/profit/orders?${qs}`, { auth: true })).data
}
export async function getProfitOrderDetail(id, pin) {
  return (await http.get(`/admin/profit/orders/${id}?pin=${encodeURIComponent(pin)}`, { auth: true })).data
}

// Build multipart FormData from a plain object. Conventions:
//  - File values are appended as files
//  - arrays append `key[]` entries (skipped when empty so the field is omitted)
//  - booleans -> '1'/'0'; null/undefined skipped; objects JSON-encoded
function toFormData(obj) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined || value === '') continue
    if (value instanceof File) {
      fd.append(key, value)
    } else if (Array.isArray(value)) {
      value.forEach((v) => {
        if (v instanceof File) fd.append(`${key}[]`, v)
        else fd.append(`${key}[]`, String(v))
      })
    } else if (typeof value === 'boolean') {
      fd.append(key, value ? '1' : '0')
    } else if (typeof value === 'object') {
      fd.append(key, JSON.stringify(value))
    } else {
      fd.append(key, String(value))
    }
  }
  return fd
}

// ---- offers ----------------------------------------------------------------
export async function adminListOffers() {
  return (await http.get('/admin/offers', { auth: true })).data
}
// Multipart so the banner image File uploads with the rest of the fields.
export async function saveOffer(o, isNew = false) {
  const fd = toFormData(o)
  const path = o.id && !isNew ? `/admin/offers/${o.id}` : '/admin/offers'
  return (await http.postForm(path, fd, { auth: true })).offer
}
export async function deleteOffer(id) {
  return http.del(`/admin/offers/${id}`, { auth: true })
}

// ---- reports ---------------------------------------------------------------
export async function getReports() {
  return http.get('/admin/reports/summary', { auth: true })
}
