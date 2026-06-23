// England brand logo — renders the shared high-quality asset from
// `public/england-logo.svg` so the wordmark is identical everywhere it appears
// (navbar, admin dashboard, sidebar, footer, login screens, invoice).
//
// Sizing is driven by the caller via height utilities (e.g. `h-10`); width is
// derived from the SVG's intrinsic 340×132 ratio so the logo always stays
// proportional and crisp. The `tone` / `mark` props are accepted for backward
// compatibility but no longer change the rendering — the asset is designed to
// read cleanly on both light and dark surfaces.
export default function BrandLogo({ className = '', alt = 'England', /* eslint-disable-next-line no-unused-vars */ tone = 'current', /* eslint-disable-next-line no-unused-vars */ mark = true }) {
  return (
    <img
      src="/england-logo.svg"
      alt={alt}
      draggable="false"
      className={`block w-auto select-none ${className}`}
    />
  )
}
