/*
 * Builty photo actions for the viewer screen.
 *
 * The server hands out short-lived signed image URLs (no bearer token needed), so:
 *   - the <img> tags load them directly;
 *   - on Android the files are fetched NATIVELY (Filesystem.downloadFile) — no binary data
 *     passes through the WebView bridge, which CapacitorHttp would otherwise corrupt;
 *   - in the browser (npm run dev) a plain fetch → Blob is used.
 *
 *   shareImages([{url, name}])  → Android share sheet (WhatsApp, Gmail, Drive…)   'shared' | 'cancelled'
 *   downloadImage({url, name})  → Documents/England Orders/<name>                 { where }
 */
import { isNative } from './secureStore.js';
import { apiUrl } from './api.js';

/** Image link for <img>/download: the signed path on OUR API base (always the app's https base). */
export const imageSrc = (info) => (info?.path ? apiUrl(info.path) : info?.url || '');

export const DOWNLOAD_FOLDER = 'England Orders';

export class PermissionDenied extends Error {}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** e.g. ENG-1001-builty-front.jpg — only safe characters. */
export function builtyFileName(code, side, mime) {
  const safe = String(code || 'order').replace(/[^A-Za-z0-9-]/g, '');
  return `${safe}-builty-${side}.${EXT[mime] || 'jpg'}`;
}

async function webBlob(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status === 403 || res.status === 410 ? 'expired' : 'failed');
  return res.blob();
}

function webSave(blob, name) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
}

export async function shareImages(images, title = 'بلٹی کی تصاویر') {
  if (!images.length) return 'cancelled';
  if (isNative()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const files = [];
    for (const img of images) {
      const path = `builty-share/${img.name}`;
      await Filesystem.downloadFile({ url: img.url, path, directory: Directory.Cache, recursive: true });
      files.push((await Filesystem.getUri({ path, directory: Directory.Cache })).uri);
    }
    try {
      await Share.share({ title, files, dialogTitle: title });
    } catch (e) {
      if (/cancel/i.test(String(e?.message || e))) return 'cancelled';
      throw e;
    }
    return 'shared';
  }
  const blobs = await Promise.all(images.map((i) => webBlob(i.url)));
  const files = blobs.map((b, i) => new File([b], images[i].name, { type: b.type || 'image/jpeg' }));
  if (navigator.canShare?.({ files })) {
    try { await navigator.share({ files, title }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  files.forEach((f) => webSave(f, f.name));
  return 'shared';
}

async function ensureStoragePermission(Filesystem) {
  try {
    const p = await Filesystem.checkPermissions();
    if (p.publicStorage === 'granted') return;
    const asked = await Filesystem.requestPermissions();
    if (asked.publicStorage !== 'granted') throw new PermissionDenied('storage');
  } catch (e) {
    if (e instanceof PermissionDenied) throw e;
    /* Android 11+ needs no permission to write the app's own files to Documents */
  }
}

export async function downloadImage({ url, name }) {
  if (isNative()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    await ensureStoragePermission(Filesystem);
    await Filesystem.downloadFile({ url, path: `${DOWNLOAD_FOLDER}/${name}`, directory: Directory.Documents, recursive: true });
    return { where: `Documents/${DOWNLOAD_FOLDER}/${name}` };
  }
  webSave(await webBlob(url), name);
  return { where: name };
}
