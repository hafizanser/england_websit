// ---------------------------------------------------------------------------
// HTTP client — talks to the PHP backend.
// ---------------------------------------------------------------------------
// Base URL resolves (in order): VITE_API_BASE env  ->  XAMPP Apache default.
// Catalog reads gracefully fall back to bundled data when the backend is down,
// so browsing always works; orders/admin require the backend.
//
// Caching: this layer stays a plain transport. It does NOT store responses — the
// browser's own HTTP cache handles that (the API sends Cache-Control + ETag), and
// `useAsync`'s cacheKey handles keeping data on screen across a remount. The one
// thing done here is reading `X-Catalog-Version` off every response, which is how
// the SPA learns an admin saved something and drops what it is holding.
// ---------------------------------------------------------------------------

// Resolved from VITE_API_BASE at build time (set in .env / .env.production):
//   • dev   (.env)            -> http://localhost:8000  (php artisan serve)
//   • build (.env.production) -> https://api-store.codelps.com
// Falls back to the local dev server if the env var is missing. The trailing
// slash is trimmed so `API_BASE + '/products'` never produces a double slash.
import { noteCatalogVersion } from '../lib/queryCache'

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

async function request(path, { method = 'GET', body, auth = false, customerAuth = false, timeout = 15000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  // Content-Type only matters when we actually send a JSON body. Setting it on a
  // body-less GET makes the request non-"simple", so the browser fires a CORS
  // preflight OPTIONS before EVERY read — doubling the round-trips a cold
  // homepage needs and pushing slow/serialised backends past the timeout.
  const headers = body !== undefined ? { 'Content-Type': 'application/json' } : {}
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
    // The API stamps public catalogue responses with the catalogue version. A
    // changed token means an admin wrote something, so the SPA's cache is
    // dropped before this response is handed to the caller (which then writes
    // its own fresh result straight back in). Cross-origin, this header is only
    // readable because config/cors.php exposes it.
    noteCatalogVersion(res.headers.get('X-Catalog-Version'))
    let data = {}
    try {
      data = await res.json()
    } catch {
      data = {}
    }
    if (!res.ok) {
      // Prefer the backend's own error text (validation etc.). When the body
      // isn't our JSON envelope — e.g. an HTML 404/500 from the wrong backend or
      // a missing route — fall back to a message that names the real cause so it
      // is diagnosable instead of a bare "HTTP 404".
      const err = new Error(data.error || httpFallbackMessage(res.status, path))
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
      const err = new Error(`Backend se rabta nahi ho saka (${API_BASE}). Server chal raha hai?`)
      err.code = 'NETWORK'
      throw err
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

// Human-readable fallback when the server returned a non-JSON error body.
function httpFallbackMessage(status, path) {
  if (status === 404) {
    return `Endpoint "${path.split('?')[0]}" backend par nahi mila (404). ` +
      `Ghalat backend/port to nahi chal raha? Expected API: ${API_BASE}`
  }
  if (status === 401 || status === 403) return 'Ijazat nahi (login zaroori ho sakta hai).'
  if (status >= 500) return `Server error (${status}). Laravel log check karein.`
  return `Request fail hui (HTTP ${status}).`
}

// Multipart/form-data request (for image uploads). The browser sets the
// Content-Type (with boundary) automatically, so we must NOT set it here.
// ---------------------------------------------------------------------------
// Multipart uploads go through XMLHttpRequest, not fetch.
// ---------------------------------------------------------------------------
// This is the one place in the app that deliberately uses the older API, for a
// reason fetch cannot work around: FETCH CANNOT REPORT UPLOAD PROGRESS. It hands
// back a promise that settles when the RESPONSE arrives, and says nothing at all
// about the bytes going up. For a 200 KB photo nobody notices. For a product
// video it meant the Save button spun with no information for minutes, looking
// identical whether the upload was moving, stalled, or dead — which is exactly
// what it looked like. `xhr.upload.onprogress` is the only way to see inside it.
//
// AND THE TIMEOUT IS STALL-BASED, NOT TOTAL. A fixed deadline is the wrong shape
// for an upload twice over: too short and it kills a slow-but-working transfer
// (a flat 20 s used to abort a perfectly healthy save and blame the server);
// too long and a genuinely dead connection hangs the dashboard. Measuring the
// gap since the last byte moved instead is right in both directions — a 40 MB
// clip crawling up a village DSL line is never interrupted, and a connection
// that drops is caught in STALL_MS.
//
// Two phases are reported, because they fail differently and the second one has
// no percentage to give:
//
//   upload      bytes on the wire. Real, measured, 0-100.
//   processing  the body has landed and the server is transcoding it with
//               ffmpeg (VideoStorage). Nothing can be measured from out here, so
//               the UI says so rather than parking a progress bar at 100%.
const STALL_MS = 45000

// Images are compressed before they get here (lib/imageCompress.js) and videos
// are transcoded on the far end, so the processing phase can legitimately run
// long. This caps only the silence, not the work.
const PROCESSING_STALL_MS = 300000

function requestForm(
  path,
  formData,
  { method = 'POST', auth = true, timeout, onProgress } = {},
) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, API_BASE + path, true)

    if (auth) {
      const token = getAdminToken()
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    }
    // Content-Type is left alone on purpose: the browser has to set it itself so
    // the multipart boundary matches the body it is about to serialise.

    let phase = 'upload'
    let lastTick = Date.now()
    let settled = false

    const report = (next) => {
      lastTick = Date.now()
      if (typeof onProgress === 'function') {
        try {
          onProgress(next)
        } catch {
          // A broken progress handler must never take the upload down with it.
        }
      }
    }

    const finish = (fn, arg) => {
      if (settled) return
      settled = true
      clearInterval(watchdog)
      fn(arg)
    }

    const watchdog = setInterval(() => {
      const limit = timeout ?? (phase === 'upload' ? STALL_MS : PROCESSING_STALL_MS)
      if (Date.now() - lastTick < limit) return
      xhr.abort()
      const err = new Error(
        phase === 'upload'
          ? 'Upload ruk gaya — internet check karein aur dobara koshish karein.'
          : 'Server ne file process karne mein bohat waqt liya. Chhoti ya chhoti-duration video try karein.',
      )
      err.code = 'TIMEOUT'
      finish(reject, err)
    }, 1000)

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return report({ phase: 'upload', percent: null })
      report({
        phase: 'upload',
        loaded: e.loaded,
        total: e.total,
        percent: Math.min(99, Math.round((e.loaded / e.total) * 100)),
      })
    }

    // The body is fully on the wire. Everything after this is the server's time,
    // and it is not measurable — say which phase we are in rather than implying
    // a stalled percentage.
    xhr.upload.onload = () => {
      phase = 'processing'
      report({ phase: 'processing', percent: 100 })
    }

    // Any byte of the RESPONSE arriving also counts as the server being alive.
    xhr.onprogress = () => {
      lastTick = Date.now()
    }

    xhr.onload = () => {
      let data = {}
      try {
        data = JSON.parse(xhr.responseText || '{}')
      } catch {
        data = {}
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        report({ phase: 'done', percent: 100 })
        return finish(resolve, data)
      }
      const err = new Error(data.error || formFallbackMessage(xhr.status))
      err.status = xhr.status
      err.fields = data.fields || null
      finish(reject, err)
    }

    xhr.onerror = () => {
      const err = new Error(`Backend se rabta nahi ho saka (${API_BASE}).`)
      err.code = 'NETWORK'
      finish(reject, err)
    }

    // Only reached when something other than the watchdog aborted (a navigation
    // away mid-upload); the watchdog has already settled its own case.
    xhr.onabort = () => {
      const err = new Error('Upload cancel ho gaya.')
      err.code = 'ABORTED'
      finish(reject, err)
    }

    report({ phase: 'upload', percent: 0 })
    xhr.send(formData)
  })
}

// An upload has failure modes a JSON GET does not, and the server answers most
// of them with an HTML error page rather than our envelope — so the status code
// is all there is to go on. Naming the real cause matters here more than
// anywhere else in the app: every one of these is fixed by a different person
// doing a different thing.
function formFallbackMessage(status) {
  if (status === 413) {
    return 'File server ki limit se bari hai. Chhoti file use karein, ya hosting par upload_max_filesize / post_max_size barhwaein.'
  }
  if (status === 401 || status === 403) return 'Ijazat nahi — dobara login karein.'
  if (status === 419) return 'Session expire ho gaya — dobara login karein.'
  if (status === 0) return 'Connection toot gaya.'
  if (status >= 500) {
    return `Server error (${status}). Bari video par yeh aksar PHP ki max_execution_time ya memory_limit hoti hai.`
  }
  return `Upload fail hua (HTTP ${status}).`
}

// ---- in-flight GET de-duplication ------------------------------------------
// A cold homepage mounts several components that read the SAME endpoint at the
// same moment (/categories from Home + Footer, /offers from OffersSection +
// CartContext), and React StrictMode invokes every effect twice in dev — so one
// load used to fire each read 2-4 times. Concurrent callers now share a single
// network request. The entry is dropped the moment it settles, so nothing is
// cached and a later read always hits the server again (no stale data).
const inFlightGets = new Map()

function dedupedGet(path, opts = {}) {
  const key = `${opts.auth ? 'a' : ''}${opts.customerAuth ? 'c' : ''}|${path}`
  const pending = inFlightGets.get(key)
  if (pending) return pending
  const p = request(path, { ...opts, method: 'GET' }).finally(() => {
    if (inFlightGets.get(key) === p) inFlightGets.delete(key)
  })
  inFlightGets.set(key, p)
  return p
}

export const http = {
  get: (p, opts) => dedupedGet(p, opts),
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
