// ---------------------------------------------------------------------------
// HTTP client — talks to the PHP backend.
// ---------------------------------------------------------------------------
// Base URL resolves (in order): VITE_API_BASE env  ->  XAMPP Apache default.
// Catalog reads gracefully fall back to bundled data when the backend is down,
// so browsing always works; orders/admin require the backend.
// ---------------------------------------------------------------------------

// Resolved from VITE_API_BASE at build time (set in .env / .env.production):
//   • dev   (.env)            -> http://localhost:8000  (php artisan serve)
//   • build (.env.production) -> https://api-store.codelps.com
// Falls back to the local dev server if the env var is missing. The trailing
// slash is trimmed so `API_BASE + '/products'` never produces a double slash.
export const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/\/+$/, '')

const ADMIN_TOKEN_KEY = 'barkat.admin.token'
const CUSTOMER_TOKEN_KEY = 'barkat.customer.token'

export const getAdminToken = () => {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY)
  } catch {
    return null
  }
}
export const setAdminToken = (token) => {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token)
    else localStorage.removeItem(ADMIN_TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export const getCustomerToken = () => {
  try {
    return localStorage.getItem(CUSTOMER_TOKEN_KEY)
  } catch {
    return null
  }
}
export const setCustomerToken = (token) => {
  try {
    if (token) localStorage.setItem(CUSTOMER_TOKEN_KEY, token)
    else localStorage.removeItem(CUSTOMER_TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

async function request(path, { method = 'GET', body, auth = false, customerAuth = false, timeout = 9000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getAdminToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  if (customerAuth) {
    const token = getCustomerToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  try {
    const res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    let data = {}
    try {
      data = await res.json()
    } catch {
      data = {}
    }
    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`)
      err.status = res.status
      err.fields = data.fields || null
      throw err
    }
    return data
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error('Server response slow hai. Dobara koshish karein.')
      err.code = 'TIMEOUT'
      throw err
    }
    if (e instanceof TypeError) {
      // network / CORS / backend down
      const err = new Error('Backend se rabta nahi ho saka.')
      err.code = 'NETWORK'
      throw err
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

// Multipart/form-data request (for image uploads). The browser sets the
// Content-Type (with boundary) automatically, so we must NOT set it here.
async function requestForm(path, formData, { method = 'POST', auth = true, timeout = 20000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const headers = {}
  if (auth) {
    const token = getAdminToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  try {
    const res = await fetch(API_BASE + path, { method, headers, body: formData, signal: controller.signal })
    let data = {}
    try {
      data = await res.json()
    } catch {
      data = {}
    }
    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`)
      err.status = res.status
      err.fields = data.fields || null
      throw err
    }
    return data
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error('Server response slow hai. Dobara koshish karein.')
      err.code = 'TIMEOUT'
      throw err
    }
    if (e instanceof TypeError) {
      const err = new Error('Backend se rabta nahi ho saka.')
      err.code = 'NETWORK'
      throw err
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

export const http = {
  get: (p, opts) => request(p, { ...opts, method: 'GET' }),
  post: (p, body, opts) => request(p, { ...opts, method: 'POST', body }),
  put: (p, body, opts) => request(p, { ...opts, method: 'PUT', body }),
  patch: (p, body, opts) => request(p, { ...opts, method: 'PATCH', body }),
  del: (p, opts) => request(p, { ...opts, method: 'DELETE' }),
  postForm: (p, formData, opts) => requestForm(p, formData, { ...opts, method: 'POST' }),
}

// Try the backend; on a network/timeout failure, use the local fallback.
export async function withFallback(remote, fallback) {
  try {
    return await remote()
  } catch (e) {
    if (e.code === 'NETWORK' || e.code === 'TIMEOUT') {
      return await fallback()
    }
    throw e
  }
}
