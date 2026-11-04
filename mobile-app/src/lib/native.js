/*
 * Phone features with a browser fallback, so the same screens work in `npm run dev`:
 *   pickPhoto('camera' | 'gallery')   Capacitor Camera on Android, <input type=file> on the web
 *   shareOrSave(blob, name)           Android share sheet (WhatsApp, Drive, Files, Gallery…), browser download
 */
import { isNative } from './secureStore.js';

export class PickCancelled extends Error {}

function webPick(source) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/*';
    if (source === 'camera') input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    let settled = false;
    input.onchange = () => {
      settled = true;
      const f = input.files?.[0];
      input.remove();
      if (f) resolve(f); else reject(new PickCancelled());
    };
    // No reliable "cancel" event on the web: treat focus coming back with no file as a cancel.
    window.addEventListener('focus', () => setTimeout(() => {
      if (!settled) { input.remove(); reject(new PickCancelled()); }
    }, 800), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

export async function pickPhoto(source) {
  if (!isNative()) return webPick(source);
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  try {
    const perm = await Camera.checkPermissions();
    const need = source === 'camera' ? 'camera' : 'photos';
    if (perm[need] !== 'granted' && perm[need] !== 'limited') {
      const asked = await Camera.requestPermissions({ permissions: [need] });
      if (asked[need] === 'denied') {
        throw new Error(source === 'camera'
          ? 'کیمرے کی اجازت بند ہے۔ فون کی سیٹنگز › ایپس › England Orders › اجازتیں میں جا کر کیمرا آن کریں۔'
          : 'تصاویر کی اجازت بند ہے۔ فون کی سیٹنگز › ایپس › England Orders › اجازتیں میں جا کر تصاویر آن کریں۔');
      }
    }
  } catch (e) {
    if (e instanceof Error && /اجازت بند ہے/.test(e.message)) throw e;
    /* some Android versions need no runtime photo permission — continue */
  }
  let photo;
  try {
    photo = await Camera.getPhoto({
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      resultType: CameraResultType.Uri,
      quality: 90,
      correctOrientation: true,
      width: 2400,
      saveToGallery: false,
    });
  } catch (e) {
    const msg = String(e?.message || e || '');
    if (/cancel/i.test(msg) || /no image picked/i.test(msg)) throw new PickCancelled();
    throw new Error('کیمرا یا گیلری نہیں کھل سکی۔ دوبارہ کوشش کریں۔');
  }
  const res = await fetch(photo.webPath);
  const blob = await res.blob();
  const type = blob.type || (photo.format ? `image/${photo.format === 'jpg' ? 'jpeg' : photo.format}` : 'image/jpeg');
  return new File([blob], `slip.${photo.format || 'jpg'}`, { type });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Share / save a slip photo. Returns 'shared' | 'downloaded'. */
export async function shareOrSave(blob, filename) {
  if (isNative()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const written = await Filesystem.writeFile({ path: filename, data: await blobToBase64(blob), directory: Directory.Cache });
    await Share.share({ title: filename, files: [written.uri], dialogTitle: 'پنڈی سلپ شیئر یا محفوظ کریں' });
    return 'shared';
  }
  const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}

/** Open the dialler. */
export function callNumber(href) {
  if (!href) return;
  window.location.href = href;
}
