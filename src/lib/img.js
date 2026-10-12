// Shared image fallback helpers — guarantees no broken/missing <img> anywhere.
//
// PLACEHOLDER is the branded England plaque (src/assets/england-placeholder.png).
// It is IMPORTED rather than referenced as a /public path on purpose. Vite then
// emits it as a content-hashed asset and rewrites the URL to match the build's
// base — and this app builds with `base: './'` so it can be served from a
// sub-folder (…/FMCG_project/dist/), where a hardcoded "/england-placeholder.png"
// would 404 on every card at once. Importing also makes a missing file a BUILD
// error instead of a runtime one.
//
// The artwork is an 800x800 cream field with the plaque centred inside generous
// padding, so the `object-cover` frames it lands in can never crop into the
// mark. The mark occupies x 152–648, y 278–521 of the 800px canvas; the
// tightest frame in the app (16/9) shows the middle 56% of a square source,
// i.e. y 175–625 — comfortably clear. Same for 5/4, 1/1 and portrait tiles.
// That is what lets every caller use plain `object-cover` with no special case.
//
// Use `imgSrc(url)` to pick a real URL or the placeholder, and `onImgError` on
// every <img> so a 404 (e.g. a product whose upload was deleted) degrades to the
// branded placeholder instead of the browser's broken-image icon.
//
// For the "still loading" gap, add the `img-placeholder-bg` class (index.css) to
// the <img> itself — NOT to its frame. On the element, the plaque is painted
// behind the photo and is covered the instant the photo decodes. On the frame it
// would also show through the gallery's crossfade, where two stacked images are
// both semi-transparent and let up to ~25% of whatever is beneath them leak.

import placeholderUrl from '../assets/england-placeholder.png'

/** The branded placeholder shown for missing / broken / loading product images. */
export const PLACEHOLDER = placeholderUrl

/** The cream field the artwork sits on — match it when painting around the mark. */
export const PLACEHOLDER_BG = '#f4f0e8'

// Last-resort fallback, used ONLY if the placeholder asset itself fails to load
// (offline first paint, a cache miss on a stale hashed filename). It is an
// inline data URI so it cannot make a request and therefore cannot fail; without
// it, a failed placeholder would put the grey broken-image icon on every card at
// once — the exact failure this module exists to prevent. Deliberately minimal:
// it is a safety net, not a second design.
//
// The plaque outline is the real mark, traced from the PNG above and simplified
// to a polygon, then placed on the same 800x800 canvas at the same spot the
// artwork occupies (x 152-648, y 278-515) — so if this ever does appear it is
// the same silhouette in the same position, not a second, off-brand shape.
//
// The wordmark has to be live text rather than traced outlines (that would cost
// several KB), and it is pinned with textLength + lengthAdjust because an
// <img>-embedded SVG cannot load webfonts: it renders in whatever serif the
// device has, and metrics vary enough between platforms to push an unpinned
// wordmark out of its plaque.
const PLAQUE = 'M870.2 0 826.5 21.9 766.4 35.5 618.9 32.8 326.5 2.7 200.8 5.5 118.9 27.3 120.2 42.3 66.9 76.5 32.8 113.4 0 192.6 10.9 301.9 60.1 468.6 107.9 456.3 121.6 475.4 135.2 478.1 146.2 467.2 159.8 469.9 170.8 459 258.2 437.2 441.3 420.8 493.2 420.8 659.8 459 722.7 464.5 818.3 459 900.3 431.7 956.3 386.6 978.1 351.1 994.5 301.9 1000 217.2 986.3 157.1 956.3 97 904.4 28.7 870.2 0Z'

const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" role="img" aria-label="England">
<rect width="800" height="800" fill="${PLACEHOLDER_BG}"/>
<path transform="translate(152 278) scale(0.496)" d="${PLAQUE}" fill="#d6d2ca"/>
<text x="400" y="428" text-anchor="middle" textLength="340" lengthAdjust="spacingAndGlyphs" font-family="Georgia,'Times New Roman',serif" font-size="86" fill="${PLACEHOLDER_BG}">England</text>
</svg>`

export const PLACEHOLDER_FALLBACK = `data:image/svg+xml,${encodeURIComponent(FALLBACK_SVG.replace(/\n/g, ''))}`

/** True when `src` is one of our own placeholders rather than real artwork. */
export function isPlaceholder(src) {
  return src === PLACEHOLDER || src === PLACEHOLDER_FALLBACK
}

// ---------------------------------------------------------------------------
// Responsive sizes
// ---------------------------------------------------------------------------
// The API can hand back a downscaled copy of any uploaded photo — GET /image
// takes a `w` (see backend_laravel/app/Support/ImageVariants.php). The widths
// here are the ONLY ones it will render, and the two lists have to agree: ask
// for a width the server does not know and it quietly streams the original,
// which is safe but is the whole problem this exists to solve.
//
// Why it matters: the catalogue's photos are phone originals, 738 KB on
// average and up to 1.94 MB, and they were being sent at full size to a 170px
// grid tile. Nothing else on the storefront came close to costing that much.
//
// Only our own /image URLs are touched. A product whose photo is an absolute
// URL somewhere else is passed through untouched — we cannot resize what we do
// not serve, and appending a query string to a stranger's URL is as likely to
// break it as not.
export const IMG_WIDTHS = [160, 320, 480, 640, 960, 1280]

const isOwnUpload = (url) => typeof url === 'string' && /[?&]file=/.test(url) && /\/image\b/.test(url)

/** `url` at `width` px, or `url` unchanged when it is not ours to resize. */
export function thumbSrc(url, width) {
  if (!isOwnUpload(url) || !width) return url
  if (/[?&]w=/.test(url)) return url // already sized by a caller upstream
  return `${url}${url.includes('?') ? '&' : '?'}w=${width}`
}

/**
 * A `srcSet` for `url`, so the browser picks the width it actually needs for
 * this device's viewport and DPR instead of being handed the original.
 *
 * `widths` defaults to the mid range, which covers every tile in the app; the
 * detail page passes the larger end. Returns undefined for anything we cannot
 * resize, which is exactly what <img srcSet={undefined}> wants.
 */
export function srcSetFor(url, widths = [320, 640, 960]) {
  if (!isOwnUpload(url)) return undefined
  return widths
    .filter((w) => IMG_WIDTHS.includes(w))
    .map((w) => `${thumbSrc(url, w)} ${w}w`)
    .join(', ')
}

/** Returns the first non-empty url, else the branded placeholder. */
export function imgSrc(...urls) {
  for (const u of urls) {
    if (u && typeof u === 'string' && u.trim() !== '') return u
  }
  return PLACEHOLDER
}

/**
 * onError handler — degrades a failed image instead of showing a broken icon.
 *
 * THREE stages now, tracked on the element so each can fire at most once and
 * the handler can never loop:
 *
 *   0 → full size   a request for a RESIZED copy failed. The photo itself is
 *                   almost certainly fine — the host dropped the connection, or
 *                   its GD could not read this particular file — so the next
 *                   try is the original URL, the exact bytes that have always
 *                   worked. Only sized URLs take this step; everything else
 *                   falls straight through to the placeholder.
 *   1 → placeholder the branded England plaque.
 *   2 → inline SVG  a data URI, which cannot make a request and so cannot fail.
 */
export function onImgError(e) {
  const el = e.currentTarget
  if (!el) return
  const stage = el.dataset.fallback
  if (stage === '2') return // already on the un-failable inline fallback
  if (stage === '1') {
    el.dataset.fallback = '2'
    el.removeAttribute('srcset')
    el.src = PLACEHOLDER_FALLBACK
    return
  }
  if (!stage && /[?&]w=\d+/.test(el.currentSrc || el.src || '')) {
    el.dataset.fallback = '0b'
    // srcset has to go too, or the browser re-picks a sized candidate and we
    // are straight back where we started.
    el.removeAttribute('srcset')
    el.removeAttribute('sizes')
    el.src = (el.currentSrc || el.src).replace(/([?&])w=\d+&?/, '$1').replace(/[?&]$/, '')
    return
  }
  el.dataset.fallback = '1'
  el.removeAttribute('srcset')
  el.src = PLACEHOLDER
}
