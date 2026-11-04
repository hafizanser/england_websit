/*
 * Build-time settings. VITE_API_BASE is baked into the bundle:
 *   npm run dev            → .env / .env.local          (empty = Vite proxy to the local backend)
 *   npm run android:sync   → .env.android (+ .local)    (live API by default)
 * vite.config.js refuses an Android build that points at localhost.
 */
const raw = (import.meta.env.VITE_API_BASE || '').trim().replace(/\/+$/, '');

export const API_BASE = raw;
export const APP_NAME = 'انگلینڈ آرڈرز';
export const APP_VERSION = '1.1.0';

/** Order statuses exactly as the England backend stores them (fmcg.order_statuses). Only the labels are Urdu. */
export const STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];

export const STATUS_LABEL = {
  pending: 'نیا آرڈر',
  confirmed: 'کنفرم',
  packed: 'پیک ہو گیا',
  shipped: 'روانہ ہو گیا',
  delivered: 'ڈیلیور ہو گیا',
  cancelled: 'منسوخ',
};

/** The four order lists, in the order they appear on the bottom bar (right → left). */
export const TABS = [
  { key: 'today', label: 'آج کے آرڈر', short: 'آج', icon: 'today' },
  { key: 'tomorrow', label: 'کل کے آرڈر', short: 'کل', icon: 'tomorrow' },
  { key: 'previous', label: 'پچھلے آرڈر', short: 'پچھلے', icon: 'history' },
  { key: 'all', label: 'تمام آرڈر', short: 'تمام', icon: 'list' },
];

/** Slip photo rules (the server checks them again). */
export const SLIP = {
  maxEdge: 2000, // px — keeps handwriting readable while a phone photo drops to ~0.4–0.9 MB
  quality: 0.85,
  maxUploadBytes: 10 * 1024 * 1024,
  maxPickBytes: 40 * 1024 * 1024,
  minEdge: 200,
  types: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
};

export const PAGE_SIZE = 20;
