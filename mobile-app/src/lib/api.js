/*
 * England backend client. Every call carries the signed-in admin's token; a 401 signs
 * the app out (onUnauthorized). Errors are ApiError with a message the UI can show.
 */
import { API_BASE } from '../config.js';

export class ApiError extends Error {
  constructor(message, status = 0, extra = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = extra.fields || null;
    this.offline = Boolean(extra.offline);
  }
}

let token = null;
let onUnauthorized = () => {};

export function setToken(t) { token = t || null; }
export function getToken() { return token; }
export function setUnauthorizedHandler(fn) { onUnauthorized = fn || (() => {}); }

export function apiUrl(path) {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/*
 * Every message the team sees is Urdu. The England API answers in English, so its
 * text is used only when it is already Urdu; otherwise the status code decides.
 */
const FIELD_UR = {
  delivery_date: 'تاریخ درست نہیں۔',
  pandi_name: 'پنڈی کا نام 120 حروف سے زیادہ نہیں ہو سکتا۔',
  adda_name: 'اڈے کا نام 120 حروف سے زیادہ نہیں ہو سکتا۔',
  slip: 'یہ تصویر قبول نہیں ہوئی — صاف JPG یا PNG تصویر لگائیں۔',
  username: 'یوزر نیم لکھیں۔',
  password: 'پاس ورڈ لکھیں۔',
};

function urduFields(fields) {
  if (!fields || typeof fields !== 'object') return null;
  const out = {};
  Object.keys(fields).forEach((k) => { out[k] = isUrdu(fields[k]) ? fields[k] : (FIELD_UR[k] || 'یہ معلومات درست نہیں۔'); });
  return out;
}

const isUrdu = (t) => typeof t === 'string' && /[\u0600-\u06FF]/.test(t);

function friendly(status, body, path = '') {
  if (body && isUrdu(body.error)) return body.error;
  if (status === 401) return path.endsWith('/auth/login') ? 'یوزر نیم یا پاس ورڈ غلط ہے۔' : 'آپ کا سیشن ختم ہو گیا ہے۔ دوبارہ لاگ اِن کریں۔';
  if (status === 403) return 'آپ کو اس کی اجازت نہیں۔';
  if (status === 404) return path.endsWith('/slip') ? 'اس آرڈر کی سلپ موجود نہیں۔' : 'یہ آرڈر نہیں ملا۔';
  if (status === 409) return 'یہ سلپ اس آرڈر کی نہیں — کچھ محفوظ نہیں ہوا۔ صفحہ تازہ کر کے دوبارہ کوشش کریں۔';
  if (status === 413) return 'تصویر بہت بڑی ہے، سرور نے قبول نہیں کی۔';
  if (status === 422) {
    if (path.endsWith('/slip')) return 'یہ تصویر قبول نہیں ہوئی — صاف JPG یا PNG تصویر لگائیں۔ کچھ محفوظ نہیں ہوا۔';
    if (path.endsWith('/auth/login')) return 'یوزر نیم اور پاس ورڈ دونوں لکھیں۔';
    return 'معلومات درست نہیں۔ نشان زدہ خانے چیک کریں۔';
  }
  if (status === 429) return 'بہت زیادہ کوششیں ہو گئیں۔ ایک منٹ رک کر دوبارہ کوشش کریں۔';
  if (status >= 500) return 'سرور میں مسئلہ آ گیا۔ کچھ محفوظ نہیں ہوا — دوبارہ کوشش کریں۔';
  return 'کچھ غلط ہو گیا۔ دوبارہ کوشش کریں۔';
}

async function parse(res) {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export async function request(path, { method = 'GET', body, query, timeout = 20000, signal, auth = true } = {}) {
  let url = apiUrl(path);
  if (query) {
    const qs = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, String(v)); });
    const s = qs.toString();
    if (s) url += (url.includes('?') ? '&' : '?') + s;
  }
  const headers = { Accept: 'application/json' };
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort('timeout'), timeout);
  const onAbort = () => ctrl.abort('cancelled');
  signal?.addEventListener?.('abort', onAbort);
  let res;
  try {
    res = await fetch(url, { method, headers, body: payload, signal: ctrl.signal });
  } catch (e) {
    if (signal?.aborted) throw new ApiError('cancelled', 0);
    const timedOut = ctrl.signal.aborted;
    throw new ApiError(
      timedOut ? 'سرور جواب نہیں دے رہا۔ انٹرنیٹ چیک کر کے دوبارہ کوشش کریں۔' : 'انٹرنیٹ دستیاب نہیں۔ کنکشن چیک کر کے دوبارہ کوشش کریں۔',
      0, { offline: true },
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onAbort);
  }
  const data = await parse(res);
  if (!res.ok || (data && data.ok === false)) {
    if (res.status === 401 && auth) onUnauthorized();
    throw new ApiError(friendly(res.status, data, path), res.status, { fields: urduFields(data?.fields) });
  }
  return data ?? {};
}

/**
 * Multipart upload with progress (fetch cannot report upload progress, XHR can).
 * Resolves with the parsed JSON only when the server answered 2xx with ok !== false.
 */
export function upload(path, formData, { onProgress, timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl(path));
    xhr.timeout = timeout;
    xhr.setRequestHeader('Accept', 'application/json');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onerror = () => reject(new ApiError('سلپ نہیں بھیجی جا سکی — انٹرنیٹ دستیاب نہیں۔ کچھ محفوظ نہیں ہوا۔', 0, { offline: true }));
    xhr.ontimeout = () => reject(new ApiError('سلپ بھیجنے میں بہت دیر ہو گئی۔ کچھ محفوظ نہیں ہوا — دوبارہ کوشش کریں۔', 0, { offline: true }));
    xhr.onload = () => {
      let data = null;
      try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && data && data.ok !== false) {
        resolve(data);
        return;
      }
      if (xhr.status === 401) onUnauthorized();
      reject(new ApiError(friendly(xhr.status, data, path), xhr.status, { fields: urduFields(data?.fields) }));
    };
    xhr.send(formData);
  });
}

/** Authenticated binary download (slip photo) → Blob. */
export async function fetchBlob(path, { timeout = 60000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(apiUrl(path), { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: ctrl.signal });
    if (!res.ok) {
      if (res.status === 401) onUnauthorized();
      throw new ApiError(friendly(res.status, await parse(res), '/slip'), res.status);
    }
    return await res.blob();
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('تصویر نہیں کھل سکی۔ انٹرنیٹ چیک کریں۔', 0, { offline: true });
  } finally {
    clearTimeout(timer);
  }
}

// ---- endpoints ------------------------------------------------------------
export const Api = {
  login: (username, password) => request('/app/auth/login', { method: 'POST', body: { username, password }, auth: false }),
  logout: () => request('/app/auth/logout', { method: 'POST' }).catch(() => null),
  me: () => request('/app/auth/me'),
  orders: (params, signal) => request('/app/orders', { query: params, signal }),
  order: (id, signal) => request(`/app/orders/${encodeURIComponent(id)}`, { signal }),
  updateDelivery: (id, code, values) => request(`/app/orders/${encodeURIComponent(id)}/delivery`, { method: 'PATCH', body: { order_code: code, ...values } }),
  uploadSlip: (id, code, blob, filename, onProgress) => {
    const fd = new FormData();
    fd.append('order_code', code);
    fd.append('slip', blob, filename);
    return upload(`/app/orders/${encodeURIComponent(id)}/slip`, fd, { onProgress });
  },
  slipBlob: (url) => fetchBlob(url),
};
