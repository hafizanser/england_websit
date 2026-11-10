/*
 * England staff-app API client.
 *
 * The backend answers every /app/* call with one envelope:
 *   { error: false, message, code, data: {...} }                 success
 *   { error: true,  message, code, data: { reason, fields? } }    failure
 * request()/upload() resolve with `data` only, and throw ApiError (Urdu message,
 * status, reason, fields) otherwise. A 401 signs the app out (onUnauthorized).
 */
import { Capacitor } from '@capacitor/core';
import { API_BASE } from '../config.js';

export class ApiError extends Error {
  constructor(message, status = 0, extra = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.reason = extra.reason || null;
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

/* Every message the team sees is Urdu. The server's English `message` is for logs; data.reason decides. */
const FIELD_UR = {
  delivery_date: 'تاریخ درست نہیں۔',
  pandi_name: 'پنڈی کا نام 120 حروف سے زیادہ نہیں ہو سکتا۔',
  adda_name: 'اڈے کا نام 120 حروف سے زیادہ نہیں ہو سکتا۔',
  image: 'یہ تصویر قبول نہیں ہوئی — صاف JPG یا PNG تصویر لگائیں۔',
  username: 'یوزر نیم لکھیں۔',
  password: 'پاس ورڈ لکھیں۔',
};

export const REASON_UR = {
  invalid_credentials: 'یوزر نیم یا پاس ورڈ غلط ہے۔',
  unauthenticated: 'آپ کا سیشن ختم ہو گیا ہے۔ دوبارہ لاگ اِن کریں۔',
  order_not_found: 'یہ آرڈر نہیں ملا۔',
  order_mismatch: 'یہ تصویر اس آرڈر کی نہیں — کچھ محفوظ نہیں ہوا۔ صفحہ تازہ کر کے دوبارہ کوشش کریں۔',
  image_too_large: 'تصویر بہت بڑی ہے (زیادہ سے زیادہ 10 MB)۔ کچھ محفوظ نہیں ہوا۔',
  image_type_not_allowed: 'صرف JPG، PNG یا WebP تصویر لگائیں۔ کچھ محفوظ نہیں ہوا۔',
  image_too_small: 'تصویر بہت چھوٹی ہے، پڑھی نہیں جا سکتی۔ صاف تصویر لگائیں۔',
  image_unreadable: 'یہ فائل تصویر نہیں ہے یا خراب ہے۔ کچھ محفوظ نہیں ہوا۔',
  upload_incomplete: 'تصویر پوری نہیں پہنچی۔ دوبارہ کوشش کریں۔',
  storage_failed: 'سرور پر تصویر محفوظ نہیں ہو سکی۔ دوبارہ کوشش کریں۔',
  image_not_found: 'یہ تصویر موجود نہیں۔',
  image_replaced: 'یہ تصویر تبدیل ہو چکی ہے۔ صفحہ تازہ کریں۔',
  link_expired: 'تصویر کا لنک پرانا ہو گیا۔ صفحہ تازہ کریں۔',
  rate_limited: 'بہت زیادہ کوششیں ہو گئیں۔ ایک منٹ رک کر دوبارہ کوشش کریں۔',
  server_error: 'سرور میں مسئلہ آ گیا۔ کچھ محفوظ نہیں ہوا — دوبارہ کوشش کریں۔',
  not_found: 'یہ صفحہ نہیں ملا۔ ایپ اپ ڈیٹ کریں۔',
  erp_unreachable: 'ERP سے رابطہ نہیں ہو سکا۔ پچھلی بار والی ERP سیلز دکھائی جا رہی ہیں۔',
  erp_not_configured: 'اس سرور پر ERP سیلز ابھی منسلک نہیں۔',
  server_outdated: 'سرور پر ابھی پرانا سسٹم چل رہا ہے، اس لیے آرڈر نہیں آ سکے۔ ایڈمن سے سرور اپ ڈیٹ کروائیں، پھر دوبارہ کوشش کریں۔',
  bad_response: 'سرور سے درست جواب نہیں آیا۔ تھوڑی دیر بعد دوبارہ کوشش کریں۔',
};

const isUrdu = (t) => typeof t === 'string' && /[؀-ۿ]/.test(t);

function urduFields(fields) {
  if (!fields || typeof fields !== 'object') return null;
  const out = {};
  Object.keys(fields).forEach((k) => { out[k] = isUrdu(fields[k]) ? fields[k] : (FIELD_UR[k] || 'یہ معلومات درست نہیں۔'); });
  return out;
}

/*
 * The England website's own API answers {ok: true|false, error: "..."}; the staff-app
 * API (/app/*, backend 1.2.0+) answers {error: true|false, data: {...}}. Getting the
 * website envelope from an /app/* call means the server still runs a backend older
 * than this app (e.g. 1.1, before the Builty routes) — say that, not "something went wrong".
 */
export function isLegacyEnvelope(body) {
  return Boolean(body) && typeof body === 'object' && typeof body.ok === 'boolean' && typeof body.error !== 'boolean';
}

/** The machine reason for a failed call: the server's own, or one derived from the reply's shape. */
export function failureReason(status, body) {
  const reason = body?.data?.reason;
  if (reason) return reason;
  if (status === 401 || status === 429) return null;
  if (isLegacyEnvelope(body)) return 'server_outdated';
  if (status >= 200 && status < 300) return 'bad_response';
  return null;
}

export function friendly(status, body, path = '') {
  const reason = failureReason(status, body);
  if (reason === 'validation_failed') {
    if (path.endsWith('/auth/login')) return 'یوزر نیم اور پاس ورڈ دونوں لکھیں۔';
    if (body?.data?.fields?.image) return 'تصویر منتخب کریں۔ کچھ محفوظ نہیں ہوا۔';
    return 'معلومات درست نہیں۔ نشان زدہ خانے چیک کریں۔';
  }
  // ERP sales are "sales" (سیل), not orders — e.g. one deleted in the ERP since the list loaded.
  if (path.includes('/erp-sales/') && (reason === 'order_not_found' || (!reason && status === 404))) return 'یہ ERP سیل نہیں ملی۔ ہو سکتا ہے ERP میں حذف ہو گئی ہو۔';
  if (reason && REASON_UR[reason]) return REASON_UR[reason];
  if (status === 401) return path.endsWith('/auth/login') ? REASON_UR.invalid_credentials : REASON_UR.unauthenticated;
  if (status === 403) return 'آپ کو اس کی اجازت نہیں۔';
  if (status === 404) return 'یہ آرڈر نہیں ملا۔';
  if (status === 409) return REASON_UR.order_mismatch;
  if (status === 413) return REASON_UR.image_too_large;
  if (status === 422) return 'معلومات درست نہیں۔ نشان زدہ خانے چیک کریں۔';
  if (status === 429) return REASON_UR.rate_limited;
  if (status >= 500) return REASON_UR.server_error;
  return 'کچھ غلط ہو گیا۔ دوبارہ کوشش کریں۔';
}

/** A body is a valid success only when it is our envelope with error === false. */
const isOk = (status, body) => status >= 200 && status < 300 && body && body.error === false && typeof body.data === 'object';

function toError(status, body, path) {
  return new ApiError(friendly(status, body, path), status, { reason: failureReason(status, body), fields: urduFields(body?.data?.fields) });
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
  } catch {
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
  if (!isOk(res.status, data)) {
    if (res.status === 401 && auth) onUnauthorized();
    throw toError(res.status, data, path);
  }
  return data.data;
}

/**
 * Multipart upload with progress (fetch cannot report upload progress, XHR can).
 * Resolves with `data` only when the server confirmed the save (2xx + error:false).
 */
/** Random multipart boundary (24 hex chars) for native uploads. */
export function multipartBoundary() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return 'EnglandOrders' + Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function upload(path, formData, { onProgress, timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl(path));
    xhr.timeout = timeout;
    xhr.setRequestHeader('Accept', 'application/json');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    // CapacitorHttp (Android) writes a multipart body only when Content-Type carries a boundary:
    // CapacitorHttpUrlConnection.setRequestBody returns early otherwise, so the POST went out
    // empty and the server answered 409 (no order_code). Browsers must make their own boundary,
    // so this is native-only.
    if (Capacitor.isNativePlatform()) xhr.setRequestHeader('Content-Type', `multipart/form-data; boundary=${multipartBoundary()}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onerror = () => reject(new ApiError('تصویر نہیں بھیجی جا سکی — انٹرنیٹ دستیاب نہیں۔ کچھ محفوظ نہیں ہوا۔', 0, { offline: true }));
    xhr.ontimeout = () => reject(new ApiError('تصویر بھیجنے میں بہت دیر ہو گئی۔ کچھ محفوظ نہیں ہوا — دوبارہ کوشش کریں۔', 0, { offline: true }));
    xhr.onload = () => {
      let data = null;
      try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { /* not JSON */ }
      if (isOk(xhr.status, data)) { resolve(data.data); return; }
      if (xhr.status === 401) onUnauthorized();
      reject(toError(xhr.status, data, path));
    };
    xhr.send(formData);
  });
}

// ---- endpoints ------------------------------------------------------------
const oid = (id) => encodeURIComponent(id);

/*
 * Two kinds of record share the lists: website orders (/app/orders/{id}) and Accountrix ERP
 * sales (/app/erp-sales/{id}). Every single-record call takes the record's `origin`
 * ('website' | 'erp', as the list sends it); website is the default so older callers keep working.
 */
export const recordBase = (origin) => (origin === 'erp' ? '/app/erp-sales' : '/app/orders');

export const Api = {
  login: (username, password) => request('/app/auth/login', { method: 'POST', body: { username, password }, auth: false }),
  logout: () => request('/app/auth/logout', { method: 'POST' }).catch(() => null),
  me: () => request('/app/auth/me'),
  orders: (params, signal) => request('/app/orders', { query: params, signal }),
  order: (id, signal, origin = 'website') => request(`${recordBase(origin)}/${oid(id)}`, { signal }),
  updateDelivery: (id, code, values, origin = 'website') => request(`${recordBase(origin)}/${oid(id)}/delivery`, { method: 'PATCH', body: { order_code: code, ...values } }),
  /** Both Builty images with fresh signed URLs. */
  builty: (id, signal, origin = 'website') => request(`${recordBase(origin)}/${oid(id)}/builty`, { signal }),
  /** side: 'front' | 'back'. The order/invoice number pins the photo to this record (server answers 409 otherwise). */
  uploadBuilty: (id, code, side, blob, filename, onProgress, origin = 'website') => {
    const fd = new FormData();
    fd.append('order_code', code);
    fd.append('image', blob, filename);
    return upload(`${recordBase(origin)}/${oid(id)}/builty/${side}`, fd, { onProgress });
  },
  /** Copy new ERP sales now (pull-to-refresh); the list also refreshes them on its own. */
  syncErp: () => request('/app/erp-sales/sync', { method: 'POST' }),
};
