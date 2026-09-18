import { http, setAdminToken } from './http'
import { CATALOG_PREFIX } from './cacheKeys'
import { invalidateCache } from '../lib/queryCache'
import { compressImage } from '../lib/imageCompress'
import { compressVideo } from '../lib/videoCompress'

// Every admin write retires the storefront's client cache.
//
// The server already bumps its own catalogue version on these routes (see
// backend_laravel/routes/api.php), and the SPA picks that up from the
// X-Catalog-Version header — but only on its NEXT read. Clearing here closes the
// gap for the one person guaranteed to look immediately: the admin who just hit
// save and switches to the storefront tab to check their work.
//
// Scoped to the catalogue prefix, so admin-only cached state (there is none
// today, and there must never be any) could not be caught by it either way.
const dropCatalogCache = () => invalidateCache(CATALOG_PREFIX)

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
// ---- product video upload ----------------------------------------------------
// A clip goes up IN PIECES, several at once, before the product is saved; the
// save then names it (`product_video_upload`) instead of carrying the file.
//
// Why not one request — measured against the live host, September 2026:
//   • the host ends any request still open at ~300 s with its own 503 page, and
//     the time spent uploading counts;
//   • browsers use HTTP/2 there, and its Apache lets each request have only
//     64 KB in flight, so one request uploads at ~135 KB/s from Pakistan however
//     fast the connection is — a 64 MB clip needed ~8 minutes and was always
//     cut off at 5.
// A 4 MB piece takes ~30 s. And the 64 KB limit is per request, so four at once
// measured 4.3x faster than one. Server side: App\Support\ChunkedUpload.
const UPLOAD_PARALLEL = 4
const UPLOAD_ATTEMPTS = 3

// Worth another try: the connection dropped or stalled, or the host had a
// moment. Anything else is an answer — not logged in, file refused, upload gone
// — that sending the same bytes again cannot change.
const isRetryable = (err) => !err.status || err.status >= 500 || [408, 409, 425, 429].includes(err.status)

// Resolves to the upload's id. Progress is reported as ONE upload
// ({ phase: 'upload', percent }) across all pieces, so the Save button reads
// exactly as it did when the clip went up in a single request.
export async function uploadVideo(file, { onProgress } = {}) {
  const { id, chunk_bytes: pieceBytes, chunks } = await http.post(
    '/admin/video-uploads',
    { name: file.name || 'video.mp4', size: file.size },
    { auth: true },
  )

  const sent = new Array(chunks).fill(0)
  const report = () => {
    const loaded = sent.reduce((a, b) => a + b, 0)
    onProgress?.({
      phase: 'upload',
      loaded,
      total: file.size,
      percent: Math.min(99, Math.floor((loaded / file.size) * 100)),
    })
  }

  const sendPiece = async (index) => {
    const piece = file.slice(index * pieceBytes, Math.min(file.size, (index + 1) * pieceBytes))
    for (let attempt = 1; ; attempt++) {
      const fd = new FormData()
      fd.append('index', String(index))
      fd.append('chunk', piece, 'chunk.bin')
      try {
        await http.postForm(`/admin/video-uploads/${id}`, fd, {
          auth: true,
          onProgress: (e) => {
            if (e.phase !== 'upload' || e.loaded == null) return
            // `loaded` includes the multipart framing — never count past the piece.
            sent[index] = Math.min(e.loaded, piece.size)
            report()
          },
        })
        sent[index] = piece.size
        report()
        return
      } catch (err) {
        sent[index] = 0
        report()
        if (attempt >= UPLOAD_ATTEMPTS || !isRetryable(err)) throw err
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
      }
    }
  }

  // UPLOAD_PARALLEL workers pull the next piece until none are left. After a
  // failure none of them starts another: the whole upload is going to be
  // reported as failed, so more bytes would only be wasted.
  let next = 0
  let failed = false
  const worker = async () => {
    while (!failed && next < chunks) {
      const index = next++
      try {
        await sendPiece(index)
      } catch (err) {
        failed = true
        throw err
      }
    }
  }

  report()
  try {
    await Promise.all(Array.from({ length: Math.min(UPLOAD_PARALLEL, chunks) }, worker))
  } catch (err) {
    // Best-effort: the server also sweeps abandoned uploads after a day.
    http.del(`/admin/video-uploads/${id}`, { auth: true }).catch(() => {})
    throw err
  }
  return id
}

// `p` is a plain object; File fields (productImage, galleryFiles[]) become
// multipart parts. A `product_video` File is uploaded on its own first (see
// uploadVideo) and the save carries only its id.
// `onProgress` receives { phase, percent }: 'compress' while the clip is
// re-encoded in the browser, 'upload' as it goes up, 'processing' while the
// server stores it. Optional: every existing caller keeps working without it.
export async function saveProduct(p, { onProgress } = {}) {
  // BEFORE the body is assembled, not inside toFormData: re-encoding a clip runs
  // in real time and has to report its own progress, which a synchronous-looking
  // field walker has no way to surface. Images are different — they are
  // instant — so they stay where they are.
  const prepared = { ...p }
  if (prepared.product_video instanceof File) {
    const video = await compressVideo(prepared.product_video, {
      onProgress: (fraction) =>
        onProgress?.({ phase: 'compress', percent: Math.round(fraction * 100) }),
    })
    prepared.product_video_upload = await uploadVideo(video, { onProgress })
    delete prepared.product_video
  }

  const fd = await toFormData(prepared)
  const path = p.id ? `/admin/products/${p.id}` : '/admin/products'
  // No explicit timeout: http.js measures the gap since the last byte moved
  // rather than the total duration, which is the only thing that works for an
  // upload — a big file on a slow uplink takes minutes and is perfectly
  // healthy, while a dropped connection needs catching in seconds.
  const saved = (
    await http.postForm(path, fd, {
      auth: true,
      // With the clip already on the server this request is a few KB, and its
      // own 0→100 % would only rewind the bar the pieces just filled. What the
      // admin is waiting on now is the server storing the clip.
      onProgress:
        prepared.product_video_upload && onProgress
          ? (e) => onProgress(e.phase === 'upload' ? { phase: 'processing', percent: 100 } : e)
          : onProgress,
    })
  ).product
  dropCatalogCache()
  return saved
}
export async function deleteProduct(id) {
  const res = await http.del(`/admin/products/${id}`, { auth: true })
  dropCatalogCache()
  return res
}

// ---- categories ------------------------------------------------------------
export async function adminListCategories() {
  return (await http.get('/admin/categories', { auth: true })).data
}
export async function saveCategory(c, isNew = false) {
  const fd = await toFormData(c)
  const path = c.id && !isNew ? `/admin/categories/${c.id}` : '/admin/categories'
  const saved = (await http.postForm(path, fd, { auth: true })).category
  dropCatalogCache()
  return saved
}
export async function deleteCategory(id) {
  const res = await http.del(`/admin/categories/${id}`, { auth: true })
  dropCatalogCache()
  return res
}

// ---- blog ------------------------------------------------------------------
export async function adminListBlogs() {
  return (await http.get('/admin/blogs', { auth: true })).data
}
// `b` may carry an `image` File field (multipart). New post if no id.
export async function saveBlog(b) {
  const fd = await toFormData(b)
  const path = b.id ? `/admin/blogs/${b.id}` : '/admin/blogs'
  const saved = (await http.postForm(path, fd, { auth: true })).blog
  dropCatalogCache()
  return saved
}
export async function deleteBlog(id) {
  const res = await http.del(`/admin/blogs/${id}`, { auth: true })
  dropCatalogCache()
  return res
}

// ---- homepage reel videos --------------------------------------------------
export async function adminListVideos() {
  return (await http.get('/admin/homepage-videos', { auth: true })).data
}
// `v` may carry a `video` File field (multipart) OR a `drive_url` string.
// Uploads/optimisation can take a while, so allow a generous timeout.
export async function saveVideo(v) {
  const fd = await toFormData(v)
  const path = v.id ? `/admin/homepage-videos/${v.id}` : '/admin/homepage-videos'
  const saved = (await http.postForm(path, fd, { auth: true, timeout: 300000 })).video
  dropCatalogCache()
  return saved
}
export async function deleteVideo(id) {
  const res = await http.del(`/admin/homepage-videos/${id}`, { auth: true })
  dropCatalogCache()
  return res
}
export async function reorderVideos(order) {
  const res = (await http.post('/admin/homepage-videos/reorder', { order }, { auth: true })).data
  dropCatalogCache()
  return res
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
// ASYNC because every image in `obj` is re-encoded before it is appended — see
// lib/imageCompress.js. This is the one choke point every admin multipart save
// passes through (products, categories, blogs, offers, homepage videos), so
// putting it here is what makes the rule impossible to forget at a call site.
//
// The compressor is a no-op for anything that is not a large raster image, so
// the homepage video upload that also comes through here is untouched.
async function toFormData(obj) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined || value === '') continue
    if (value instanceof File) {
      fd.append(key, await compressImage(value))
    } else if (Array.isArray(value)) {
      const parts = await Promise.all(
        value.map((v) => (v instanceof File ? compressImage(v) : v)),
      )
      parts.forEach((v) => {
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
  const fd = await toFormData(o)
  const path = o.id && !isNew ? `/admin/offers/${o.id}` : '/admin/offers'
  const saved = (await http.postForm(path, fd, { auth: true })).offer
  dropCatalogCache()
  return saved
}
export async function deleteOffer(id) {
  const res = await http.del(`/admin/offers/${id}`, { auth: true })
  dropCatalogCache()
  return res
}

// ---- reports ---------------------------------------------------------------
export async function getReports() {
  return http.get('/admin/reports/summary', { auth: true })
}
