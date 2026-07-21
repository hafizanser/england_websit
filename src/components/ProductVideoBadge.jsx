import { useEffect, useRef, useState } from 'react'
import { Play } from '@phosphor-icons/react'
import { onImgError } from '../lib/img'
import VideoLightbox from './VideoLightbox'

// A small LIVE preview pinned to the bottom-right of a product's image: the clip
// autoplays muted + looped inside a rounded glass frame, with a gently pulsing
// play indicator. Clicking it opens the existing fullscreen lightbox (unchanged).
//
// Perf: a catalogue grid of autoplaying clips is expensive, so the media is both
// lazy-loaded AND playback-gated by an IntersectionObserver — the file is only
// requested once the card nears the viewport, and the loop is paused the instant
// it scrolls away. A poster still fills the fixed-size frame beforehand, so there
// is never a layout shift. Sits as a SIBLING of the card's <Link> (valid markup)
// and its click is stopped from bubbling to the anchor.
export default function ProductVideoBadge({ src, kind = 'video', poster, name = '' }) {
  const [open, setOpen] = useState(false)
  const [inView, setInView] = useState(false)
  const wrapRef = useRef(null)
  const videoRef = useRef(null)

  // Load the clip a little before it enters view; drop `inView` once it leaves so
  // playback can pause. rootMargin gives a small pre-load buffer for smoothness.
  useEffect(() => {
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
  }, [])

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

  const media = kind === 'gif'
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
        {/* Poster placeholder fills the frame until the clip is loaded → no CLS. */}
        {poster && (
          <img
            src={poster}
            alt=""
            aria-hidden
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
