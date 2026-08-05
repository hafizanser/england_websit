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

/** Returns the first non-empty url, else the branded placeholder. */
export function imgSrc(...urls) {
  for (const u of urls) {
    if (u && typeof u === 'string' && u.trim() !== '') return u
  }
  return PLACEHOLDER
}

/**
 * onError handler — swaps a failed image to the branded placeholder.
 *
 * Two stages, tracked on the element so each can fire at most once and the
 * handler can never loop: a real URL fails to the placeholder asset, and the
 * placeholder asset (only if it fails too) to the inline SVG, which cannot.
 */
export function onImgError(e) {
  const el = e.currentTarget
  if (!el) return
  const stage = el.dataset.fallback
  if (stage === '2') return // already on the un-failable inline fallback
  if (stage === '1') {
    el.dataset.fallback = '2'
    el.src = PLACEHOLDER_FALLBACK
    return
  }
  el.dataset.fallback = '1'
  el.src = PLACEHOLDER
}
