/*
 * Slip photo checks and compression, done on the phone before upload.
 * A phone camera photo (4000×3000, 3–8 MB) becomes a ≤2000 px JPEG of roughly
 * 0.3–0.9 MB — handwriting and stamps stay readable, uploads stay fast on mobile data.
 */
import { SLIP } from '../config.js';

export class ImageError extends Error {}

/** New size so the longest edge is at most maxEdge (never upscales). */
export function targetSize(w, h, maxEdge = SLIP.maxEdge) {
  const long = Math.max(w, h);
  if (!w || !h || long <= maxEdge) return { width: Math.round(w), height: Math.round(h) };
  const s = maxEdge / long;
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}

/** Type/size checks that need no decoding. Throws ImageError with a message for the user. */
export function checkFile(blob) {
  if (!blob || !blob.size) throw new ImageError('تصویر خالی ہے۔ دوبارہ منتخب کریں۔');
  const type = (blob.type || '').toLowerCase();
  if (type === 'image/heic' || type === 'image/heif') {
    throw new ImageError('یہ تصویر (HEIC) یہاں نہیں کھلتی۔ کیمرے سے نئی تصویر کھینچیں۔');
  }
  if (type && !SLIP.types.includes(type)) throw new ImageError('صرف تصویر منتخب کریں (JPG، PNG یا WebP)۔');
  if (blob.size > SLIP.maxPickBytes) throw new ImageError('یہ تصویر بہت بڑی ہے۔ چھوٹی تصویر منتخب کریں۔');
}

async function decode(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch { /* fall back to <img> */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new ImageError('یہ فائل تصویر نہیں ہے یا خراب ہے۔');
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function toBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));
}

/** Validate, downscale and re-encode as JPEG. Returns { blob, width, height }. */
export async function prepareSlip(blob) {
  checkFile(blob);
  const img = await decode(blob);
  const w = img.width || img.naturalWidth;
  const h = img.height || img.naturalHeight;
  if (!w || !h) throw new ImageError('یہ فائل تصویر نہیں ہے یا خراب ہے۔');
  if (Math.max(w, h) < SLIP.minEdge) throw new ImageError('تصویر بہت چھوٹی ہے، پڑھی نہیں جا سکتی۔ صاف تصویر کھینچیں۔');
  const size = targetSize(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // PNG transparency → white paper, not black
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, size.width, size.height);
  img.close?.();
  let out = await toBlob(canvas, SLIP.quality);
  if (out && out.size > SLIP.maxUploadBytes) out = await toBlob(canvas, 0.7);
  if (!out) throw new ImageError('تصویر تیار نہیں ہو سکی۔ دوبارہ کوشش کریں۔');
  if (out.size > SLIP.maxUploadBytes) throw new ImageError('تصویر چھوٹی کرنے کے بعد بھی بہت بڑی ہے۔');
  return { blob: out, width: size.width, height: size.height };
}
