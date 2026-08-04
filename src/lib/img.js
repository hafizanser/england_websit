// Shared image fallback helpers — guarantees no broken/missing <img> anywhere.
//
// PLACEHOLDER is the branded England watermark, drawn as an inline SVG data URI
// rather than served as a file. That is deliberate: this asset is the fallback
// for images that failed, so it must not itself be a network request that can
// fail. A missing/renamed placeholder file leaves the browser's grey broken-image
// icon on every card at once — the exact failure this module exists to prevent.
// Inline, it cannot 404, costs no request on a catalog page full of gaps, and
// stays crisp on any display instead of scaling a raster up.
//
// The canvas is SQUARE with the mark centred inside generous padding, so the
// `object-cover` frames it lands in (aspect-square cards and the product page,
// 16/9 and 5/4 elsewhere) can never crop it. 16/9 is the tightest of those: it
// shows only the middle 56% of a square source, i.e. y 140–500 of 640. Every
// painted element is kept inside that band, which is also why there is no
// decorative outer frame — a border would be sliced into two floating verticals
// in a wide frame.
//
// Use `imgSrc(url)` to pick a real URL or the placeholder, and `onImgError` on
// every <img> so a 404 (e.g. a product whose file was removed) degrades to the
// branded placeholder instead of the browser's broken-image icon.

/** Shown under the wordmark. Roman Urdu, matching the site's voice. */
const CAPTION = 'TASVEER JALD'

// Text is pinned with textLength + lengthAdjust because an <img>-embedded SVG
// cannot load webfonts — it renders in whatever serif/sans the device has, and
// metrics vary enough between platforms to push an unpinned wordmark out of its
// plaque. Pinning makes the layout identical everywhere.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640" role="img" aria-label="England">
<defs>
<linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#fbf5e9"/><stop offset=".55" stop-color="#f6ecda"/><stop offset="1" stop-color="#efe2c8"/>
</linearGradient>
<radialGradient id="g" cx=".5" cy=".42" r=".58">
<stop offset="0" stop-color="#e7d4ac" stop-opacity=".55"/><stop offset="1" stop-color="#e7d4ac" stop-opacity="0"/>
</radialGradient>
<pattern id="h" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
<line x1="0" y1="0" x2="0" y2="18" stroke="#c7a05b" stroke-opacity=".07" stroke-width="1"/>
</pattern>
<linearGradient id="p" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity=".6"/>
</linearGradient>
<linearGradient id="r" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#c7a05b" stop-opacity="0"/><stop offset=".5" stop-color="#c7a05b" stop-opacity=".85"/><stop offset="1" stop-color="#c7a05b" stop-opacity="0"/>
</linearGradient>
</defs>
<rect width="640" height="640" fill="url(#b)"/>
<rect width="640" height="640" fill="url(#h)"/>
<rect width="640" height="640" fill="url(#g)"/>
<g>
<rect x="112" y="228" width="416" height="172" rx="86" fill="#3a2a1c" fill-opacity=".05" transform="translate(0 7)"/>
<rect x="112" y="228" width="416" height="172" rx="86" fill="url(#p)" stroke="#c7a05b" stroke-opacity=".38" stroke-width="2"/>
<path d="M150 268a86 86 0 0 1 74-30h192a86 86 0 0 1 74 30" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="3" stroke-linecap="round"/>
<text x="314" y="341" text-anchor="middle" textLength="286" lengthAdjust="spacingAndGlyphs" font-family="Georgia,'Times New Roman',serif" font-size="74" fill="#3a2a1c">England</text>
<text x="472" y="297" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="21" fill="#a8823d">&#174;</text>
</g>
<rect x="246" y="432" width="148" height="2" rx="1" fill="url(#r)"/>
<text x="320" y="476" text-anchor="middle" textLength="158" lengthAdjust="spacing" font-family="'Segoe UI',Roboto,system-ui,sans-serif" font-size="23" font-weight="700" letter-spacing="2.5" fill="#a1907c">${CAPTION}</text>
</svg>`

export const PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(SVG.replace(/\n/g, ''))}`

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
