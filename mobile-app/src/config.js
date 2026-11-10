/*
 * Build-time settings. VITE_API_BASE is baked into the bundle:
 *   npm run dev            → .env / .env.local          (empty = Vite proxy to the local backend)
 *   npm run android:sync   → .env.android (+ .local)    (live API by default)
 * vite.config.js refuses an Android build that points at localhost.
 */
const raw = (import.meta.env.VITE_API_BASE || '').trim().replace(/\/+$/, '');

export const API_BASE = raw;
export const APP_NAME = 'انگلینڈ آرڈرز';
export const APP_VERSION = '1.3.2';

/** Order statuses exactly as the England backend stores them (fmcg.order_statuses). Only the labels are Urdu. */
export const STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];

export const STATUS_LABEL = {
  pending: 'نیا آرڈر',
  confirmed: 'کنفرم',
  packed: 'پیک ہو گیا',
  shipped: 'روانہ ہو گیا',
  delivered: 'ڈیلیور ہو گیا',
  cancelled: 'منسوخ',
  posted: 'انوائس بن گئی',
};

/**
 * The four order lists, shown as the segmented tab bar at the top of the Orders screen
 * (right → left in RTL). Each list holds website orders and ERP sales together.
 */
export const TABS = [
  { key: 'today', label: 'آج کے آرڈر', short: 'آج', icon: 'today', hint: 'آج کی ڈیلیوری' },
  { key: 'tomorrow', label: 'کل کے آرڈر', short: 'کل', icon: 'tomorrow', hint: 'اگلے دن کی ڈیلیوری' },
  { key: 'previous', label: 'پچھلے آرڈرز', short: 'پچھلے', icon: 'history', hint: 'گزرے ہوئے دنوں کے آرڈر' },
  { key: 'all', label: 'تمام آرڈر', short: 'تمام', icon: 'list', hint: 'ویب سائٹ اور ERP کے سب آرڈر' },
];

/** Where a record comes from: an England website/dashboard order or an Accountrix ERP sale. */
/** What the record's number is called: website orders have an order number, ERP sales an invoice number. */
export const codeLabel = (origin) => (origin === 'erp' ? 'انوائس نمبر' : 'آرڈر نمبر');

/** What the record is called in a sentence: a website order or an ERP sale. */
export const recordNoun = (origin) => (origin === 'erp' ? 'سیل' : 'آرڈر');

export const ORIGIN_LABEL = { website: 'ویب سائٹ', erp: 'ERP' };
/** App route of one record (details screen; /builty and /builty/upload hang off it). */
export const recordPath = (origin, id) => `${origin === 'erp' ? '/erp-sales' : '/orders'}/${id}`;

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
