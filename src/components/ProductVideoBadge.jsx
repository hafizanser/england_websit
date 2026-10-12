import { useEffect, useRef, useState } from 'react'
import { Play } from '@phosphor-icons/react'
import { onImgError, thumbSrc } from '../lib/img'
import VideoLightbox from './VideoLightbox'

// A small LIVE preview pinned to the bottom-right of a product's image: the clip
// autoplays muted + looped inside a rounded glass frame, with a gently pulsing
// play indicator. Clicking it opens the existing fullscreen lightbox (unchanged).
//
// Layering: the badge's z-30 is a WITHIN-THE-FRAME number — it clears the
// gallery's arrows and dots (z-20) and nothing else. Both of its hosts (the
// product card, the gallery frame) are `isolate`d, so it can never reach the
// page's own stack and ride over the sticky category bar the way it used to.
// Raising it here without raising them is meaningless; raising it there would
// put it back on top of the bar.
//
// ---------------------------------------------------------------------------
// `preview` — why the grid and the detail page differ
// ---------------------------------------------------------------------------
// This badge used to stream its clip everywhere it appeared, gated only by an
// IntersectionObserver. On ONE product page that is a nice touch. On the
// catalogue grid it was 18 separate multi-megabyte videos, all autoplaying,
// into a 64px square. Measured on a 390px phone viewport against the live site:
// 1.97 MB and 130 requests with the clips suppressed, 8.70 MB and 177 requests
// with them — and the extra requests are not short reads, they are long-lived
// media streams held open for as long as the card is near the viewport.
//
// That cost two separate things. Shoppers on a thin connection were paying four
// times over for a page of thumbnails; and because mobile browsers cap how many
// videos may decode at once, most of those clips never played anyway — which is
// exactly the "videos don't work" the shop was being told about. It also left
// far less headroom for the request that actually matters when a shopper taps a
// card, the one that fetches the product.
//
//   preview="poster"  (grid, the default)  draw the poster and the play glyph,
//                     fetch NOTHING. The clip loads when it is asked for, in the
//                     lightbox, with controls — which is where anyone who wants
//                     to watch it was going anyway.
//   preview="auto"    (product detail page) the live muted loop, unchanged. One
//                     product, one clip, a shopper who has already chosen it.
//
// In "auto" the media is still lazy-loaded AND playback-gated by an
// IntersectionObserver, and the poster fills the fixed-size frame beforehand so
// there is never a layout shift. Either way the badge sits as a SIBLING of the
// card's <Link> (valid markup) and its click is stopped from bubbling to it.
export default function ProductVideoBadge({ src, kind = 'video', poster, name = '', preview = 'poster' }) {
  const live = preview === 'auto'
  const [open, setOpen] = useState(false)
  const [inView, setInView] = useState(false)
  const wrapRef = useRef(null)
  const videoRef = useRef(null)

  // Load the clip a little before it enters view; drop `inView` once it leaves so
  // playback can pause. rootMargin gives a small pre-load buffer for smoothness.
  useEffect(() => {
    if (!live) return undefined // poster mode never mounts media
    const el = wrapRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true) // no observer support → just show it
      return undefined
    }
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '250px 0px', threshold: 0.01 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [live])

  // Pause the loop while off-screen, resume when back. autoPlay covers the very
  // first play; this keeps CPU/GPU cost to only the previews actually visible.
  useEffect(() => {
    const v = videoRef.current
    if (!v || kind !== 'video') return
    if (inView) {
      const r = v.play()
      if (r && typeof r.catch === 'function') r.catch(() => {})
    } else {
      v.pause()
    }
  }, [inView, kind])

  // `live` short-circuits before `inView` so the poster branch cannot request a
  // byte of media even if an observer somewhere decided the badge is visible.
  const media = !live ? null : kind === 'gif'
    ? (
      inView && (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={onImgError}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )
    )
    : (
      inView && (
        <video
          ref={videoRef}
          src={src}
          poster={poster || undefined}
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )
    )

  return (
    <>
      <button
        ref={wrapRef}
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        aria-label={name ? `${name} ka video dekhein` : 'Video dekhein'}
        className="group/vid absolute bottom-2.5 right-2.5 z-30 h-14 w-14 overflow-hidden rounded-2xl border border-white/70 bg-brand-900/20 shadow-[0_8px_22px_-8px_rgba(24,18,10,0.65)] ring-1 ring-inset ring-white/40 backdrop-blur-sm transition-transform duration-300 ease-out hover:scale-110 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-500 sm:h-16 sm:w-16"
      >
        {/* The poster fills the frame — in "auto" until the clip is loaded (no
            CLS), in "poster" mode for good. Sized for a 64px square, so the
            browser is never asked for the 1 MB original. */}
        {poster && (
          <img
            src={thumbSrc(poster, 160)}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            onError={onImgError}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {media}

        {/* legibility scrim so the play glyph reads on any clip */}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-950/40 via-transparent to-brand-950/10" />

        {/* play indicator with a gentle pulse */}
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="relative grid h-6 w-6 place-items-center rounded-full bg-white/90 text-brand-900 shadow-sm transition-transform duration-300 group-hover/vid:scale-110">
            <span className="absolute inset-0 rounded-full bg-white/70 motion-safe:animate-ping [animation-duration:2.2s]" />
            <Play size={12} weight="fill" className="relative translate-x-px" />
          </span>
        </span>
      </button>

      <VideoLightbox open={open} onClose={() => setOpen(false)} src={src} kind={kind} poster={poster} title={name} />
    </>
  )
}
