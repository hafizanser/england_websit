// England brand logo — renders the shared high-quality asset from
// `public/england-logo.png` so the wordmark is identical everywhere it appears
// (navbar, admin dashboard, sidebar, footer, login screens, invoice).
//
// Sizing is driven by the caller via height utilities (e.g. `h-10`); width is
// derived from the image's intrinsic 1168×552 ratio (via `h-auto` semantics of
// `w-auto`) so the logo always stays proportional and crisp — never stretched or
// cropped. The source is a high-resolution transparent PNG, so it stays sharp on
// retina/desktop/tablet/mobile when displayed at the small in-app heights. The
// `tone` / `mark` props are accepted for backward compatibility but no longer
// change the rendering — the asset reads cleanly on both light and dark surfaces.
export default function BrandLogo({ className = '', alt = 'England', /* eslint-disable-next-line no-unused-vars */ tone = 'current', /* eslint-disable-next-line no-unused-vars */ mark = true }) {
  return (
    <img
      src="/england-logo.png"
      alt={alt}
      width="1168"
      height="552"
      draggable="false"
      className={`block w-auto select-none ${className}`}
    />
  )
}
