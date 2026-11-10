/* Display helpers. Dates arrive as YYYY-MM-DD (business day) or ISO timestamps. All words are Urdu. */

const DAYS = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
const MONTHS = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];

export const cx = (...parts) => parts.filter(Boolean).join(' ');

export function money(v) {
  const n = Number(v) || 0;
  return `Rs ${Math.round(n).toLocaleString('en-US')}`;
}

function split(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return [y, m - 1, d];
}
const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** { day: 'بدھ', num: 4, month: 'نومبر', year: 2026 } from "2026-11-04". */
export function dateParts(ymd) {
  if (!isYmd(ymd)) return null;
  const [y, m, d] = split(ymd);
  const dow = new Date(Date.UTC(y, m, d)).getUTCDay();
  return { day: DAYS[dow], num: d, month: MONTHS[m], year: y };
}

/** "4 نومبر 2026" */
export function dayLabel(ymd) {
  const p = dateParts(ymd);
  return p ? `${p.num} ${p.month} ${p.year}` : '—';
}

/** "بدھ، 4 نومبر" */
export function dayLabelLong(ymd) {
  const p = dateParts(ymd);
  return p ? `${p.day}، ${p.num} ${p.month}` : '—';
}

/** آج / کل / گزشتہ کل relative to the server's business day, else the date. */
export function relativeDay(ymd, today) {
  if (!isYmd(ymd)) return '—';
  if (isYmd(today)) {
    const diff = Math.round((Date.UTC(...split(ymd)) - Date.UTC(...split(today))) / 86400000);
    if (diff === 0) return 'آج';
    if (diff === 1) return 'کل';
    if (diff === -1) return 'گزشتہ کل';
  }
  return dayLabel(ymd);
}

/** Pakistan-time parts of an ISO timestamp (UTC+5, no daylight saving), independent of the phone's zone. */
function pkTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pk = new Date(d.getTime() + 5 * 3600000);
  const h = pk.getUTCHours();
  const min = String(pk.getUTCMinutes()).padStart(2, '0');
  const part = h < 12 ? 'صبح' : h < 16 ? 'دوپہر' : h < 19 ? 'شام' : 'رات';
  const ymd = `${pk.getUTCFullYear()}-${String(pk.getUTCMonth() + 1).padStart(2, '0')}-${String(pk.getUTCDate()).padStart(2, '0')}`;
  return { ymd, y: pk.getUTCFullYear(), m: pk.getUTCMonth(), d: pk.getUTCDate(), time: `${h % 12 || 12}:${min} ${part}` };
}

/** "4 نومبر 2026، 10:42 صبح" in Pakistan time from an ISO timestamp. */
export function dateTime(iso) {
  const t = pkTime(iso);
  return t ? `${t.d} ${MONTHS[t.m]} ${t.y}، ${t.time}` : '—';
}

/** "10:42 صبح" in Pakistan time, or null when the timestamp is missing. */
export function timeOnly(iso) {
  return pkTime(iso)?.time ?? null;
}

/** The Pakistan business day (YYYY-MM-DD) of an ISO timestamp, or null. */
export function pkDay(iso) {
  return pkTime(iso)?.ymd ?? null;
}

/**
 * Which list a record sits in, exactly as the server's tabs decide it: its effective date
 * (delivery date if set, else the order / invoice day) against the server's business today.
 * 'upcoming' = after tomorrow (only under "تمام"). null when either date is missing.
 */
export function dateTab(effectiveYmd, todayYmd) {
  if (!isYmd(effectiveYmd) || !isYmd(todayYmd)) return null;
  const diff = Math.round((Date.UTC(...split(effectiveYmd)) - Date.UTC(...split(todayYmd))) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff < 0) return 'previous';
  return 'upcoming';
}

export const DATE_TAB_LABEL = { today: 'آج کا آرڈر', tomorrow: 'کل کا آرڈر', previous: 'پرانا آرڈر', upcoming: 'آنے والا آرڈر' };

/** Digits for a tel: link, keeping a leading +. */
export function telHref(phone) {
  const p = String(phone || '').trim();
  if (!p) return null;
  const digits = p.replace(/[^\d+]/g, '');
  return digits.replace(/(?!^)\+/g, '') ? `tel:${digits}` : null;
}

/** Urdu / Arabic script detector. */
const RTL = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
export function isRtl(text) {
  return RTL.test(String(text || ''));
}

export function bytes(n) {
  const v = Number(n) || 0;
  if (v >= 1048576) return `${(v / 1048576).toFixed(1)} MB`;
  if (v >= 1024) return `${Math.round(v / 1024)} KB`;
  return `${v} B`;
}

/** Product units from the website, said the way the team says them. Unknown units are shown as stored. */
const UNITS = {
  carton: 'کارٹن', cartons: 'کارٹن', ctn: 'کارٹن',
  packet: 'پیکٹ', packets: 'پیکٹ', pack: 'پیکٹ', pkt: 'پیکٹ',
  piece: 'عدد', pieces: 'عدد', pcs: 'عدد', pc: 'عدد',
  box: 'ڈبہ', boxes: 'ڈبے',
  dozen: 'درجن', dz: 'درجن',
  bottle: 'بوتل', bottles: 'بوتلیں',
  bag: 'تھیلا', bundle: 'بنڈل', card: 'کارڈ', strip: 'پتا',
};
export function unitUr(unit) {
  const u = String(unit || '').trim();
  if (!u) return 'عدد';
  return UNITS[u.toLowerCase()] || u;
}
