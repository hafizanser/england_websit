// Shared image fallback helpers — guarantees no broken/missing <img> anywhere.
//
// PLACEHOLDER is a local, bundled SVG (no external dependency), served from the
// site root (same convention as /banner.jpg). Use `imgSrc(url)` to pick a real
// URL or the placeholder, and `onImgError` on every <img> so a 404 (e.g. a
// product whose file was removed) degrades to the placeholder instead of the
// browser's broken-image icon.

export const PLACEHOLDER = '/placeholder.svg'

/** Returns the first non-empty url, else the local placeholder. */
export function imgSrc(...urls) {
  for (const u of urls) {
    if (u && typeof u === 'string' && u.trim() !== '') return u
  }
  return PLACEHOLDER
}

/** onError handler — swaps a failed image to the placeholder exactly once. */
export function onImgError(e) {
  const el = e.currentTarget
  if (!el || el.dataset.fallback === '1') return // already swapped — avoid loops
  el.dataset.fallback = '1'
  el.src = PLACEHOLDER
}
