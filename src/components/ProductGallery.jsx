import { useEffect, useMemo, useRef, useState } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useReducedMotion } from 'framer-motion'
import { PLACEHOLDER, onImgError, srcSetFor, thumbSrc } from '../lib/img'

// The one product image gallery — used by the cards (catalog, related, admin's
// new-order picker) and by the product detail page, so the controls and timing
// are identical everywhere by construction rather than by copy-paste.
//
// Crossfade is plain CSS (stacked absolute images, opacity + scale) rather than
// framer-motion's AnimatePresence: a catalog page mounts one of these per card,
// and CSS transitions stay on the compositor instead of running dozens of JS
// animation loops. The frame owns a fixed aspect ratio and every image is
// absolutely positioned inside it, so nothing can shift the page as images load
// or swap.

const SIZES = {
  sm: { btn: 'h-8 w-8', icon: 13, edge: 'left-2 right-2', dots: 'bottom-2', dot: 'h-1.5 w-1.5', dotOn: 'h-1.5 w-5' },
  lg: { btn: 'h-10 w-10', icon: 18, edge: 'left-3 right-3', dots: 'bottom-3', dot: 'h-2 w-2', dotOn: 'h-2 w-7' },
}

// ---------------------------------------------------------------------------
// How much image this gallery is actually allowed to download
// ---------------------------------------------------------------------------
// Two separate problems, two separate levers.
//
// WIDTH. The uploads are phone originals — 738 KB on average, up to 1.94 MB —
// and a card draws one at about 170px. `sizes` tells the browser how wide the
// frame really is at this viewport, `srcSet` gives it the widths the API can
// render, and it picks. A grid tile ends up asking for 320px instead of 2000.
//
// COUNT. Every image in a set used to be in the DOM with a real `src` from the
// first frame — that is how the crossfade works — so a card with five photos
// fetched five, times thirty cards. The stack still renders (the animation is
// untouched) but only the slides in the current WINDOW carry a `src`: the one
// on screen, the one fading out, and the one about to fade in. The rest are
// empty <img> elements, which request nothing. Nobody waiting for the first
// paint of a grid pays for slide four of a card they have not reached.
const DEFAULT_SIZES = {
  sm: '(max-width: 640px) 48vw, (max-width: 1024px) 30vw, 300px',
  lg: '(max-width: 1024px) 92vw, 600px',
}
const SRCSET_WIDTHS = {
  sm: [160, 320, 480, 640],
  lg: [480, 640, 960, 1280],
}

export default function ProductGallery({
  images,
  alt = '',
  interval = 2800,
  autoPlay = true,
  size = 'sm',
  sizes, // CSS `sizes`; defaults per `size` — override when the frame is unusual
  arrows = 'hover', // 'hover' | 'always' | 'none'
  thumbnails = false,
  zoomSingle = false,
  priority = false,
  frameClassName = '',
  className = '',
  children, // overlays pinned inside the frame (e.g. the packaging badge)
}) {
  const reduce = useReducedMotion()
  const s = SIZES[size] || SIZES.sm

  const list = useMemo(() => {
    const arr = (images || []).filter(Boolean)
    return arr.length ? arr : [PLACEHOLDER]
  }, [images])
  const multi = list.length > 1

  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)

  const sizesAttr = sizes || DEFAULT_SIZES[size] || DEFAULT_SIZES.sm
  const widths = SRCSET_WIDTHS[size] || SRCSET_WIDTHS.sm
  const n = list.length

  // ---------------------------------------------------------------------
  // Which slides are allowed to hold a src
  // ---------------------------------------------------------------------
  // The current one, plus its immediate neighbours so a crossfade in either
  // direction has something to fade to and from — and then it is REMEMBERED.
  // The set only ever grows (until the product changes, which resets it).
  //
  // Growing-only matters more than it looks. An earlier version computed the
  // window from `idx` alone, so a slide that scrolled out of it had its src
  // taken away mid-download: the browser aborted the request, and the bytes
  // already on the wire were thrown away and asked for again the next time the
  // carousel came round. Worse, removing a src can fire the element's `error`
  // handler, which would have swapped a perfectly good photo for the
  // placeholder. Never un-setting a src avoids both.
  //
  // The saving is unchanged where it counts: slides the shopper never reaches
  // are never fetched at all.
  const [seen, setSeen] = useState(() => new Set([0]))
  const loaded = (i) => seen.has(i)

  useEffect(() => {
    setSeen((prev) => {
      const next = [idx, (idx + 1) % n, (idx - 1 + n) % n]
      if (next.every((i) => prev.has(i))) return prev // no re-render for nothing
      const grown = new Set(prev)
      next.forEach((i) => grown.add(i))
      return grown
    })
  }, [idx, n])

  // A different product can be rendered into the same mounted gallery (the grid
  // reuses cards), and the new set may be shorter — restart rather than point at
  // an index that no longer exists. The remembered slides go with it.
  useEffect(() => {
    setIdx(0)
    setSeen(new Set([0]))
  }, [list])

  // ---------------------------------------------------------------------
  // Auto-advance only while the gallery is actually on screen
  // ---------------------------------------------------------------------
  // A catalogue page mounts thirty of these. Without this they all cycle at
  // once, the whole time, so a shopper reading the top of the grid silently
  // downloads every photo of every product below the fold — on the connection
  // they are waiting on. Pausing the off-screen ones costs nothing visible
  // (nobody is looking at them) and leaves the behaviour on screen identical.
  const frameRef = useRef(null)
  const [onScreen, setOnScreen] = useState(false)
  useEffect(() => {
    const el = frameRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setOnScreen(true)
      return undefined
    }
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), {
      rootMargin: '120px 0px',
      threshold: 0.01,
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Auto-play is driven by the progress bar's own animationend, NOT a setInterval.
  // That is what makes hover-pause exact: pausing the CSS animation freezes the
  // bar mid-fill and withholds the event, and resuming continues from that exact
  // point. A timer would have to track elapsed time by hand to do the same, and
  // the old code didn't — its hover handler advanced the image without resetting
  // the interval, so a hover could be followed a few ms later by an auto tick.
  const autoRunning = autoPlay && multi && !reduce && onScreen

  const go = (d) => setIdx((i) => (i + d + list.length) % list.length)
  // The cards wrap this gallery in a <Link>; steering the images must not follow it.
  const nav = (d) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    go(d)
  }
  const jump = (i) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIdx(i)
  }

  const arrowVis =
    arrows === 'always'
      ? 'opacity-100'
      : // Hover reveal on pointer devices; always visible where there is no hover
        // to reveal them, so touch users still get Previous/Next.
        'opacity-0 group-hover/gal:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100'

  const arrowBase = `absolute top-1/2 z-20 grid ${s.btn} -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-white/80 text-brand-900 shadow-[0_6px_18px_-6px_rgba(24,18,10,0.45)] backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-white active:scale-90 ${arrowVis}`

  return (
    <div className={className}>
      <div
        // Isolated for the same reason the product card is: the frame stacks
        // arrows and dots (z-20) and hosts the caller's overlays in `children`
        // — the packaging badge (z-20) and the video badge (z-30) on the detail
        // page, where no card wraps them. Left to resolve against the root,
        // those numbers collide with the page's sticky chrome. Contained, they
        // only ever order the frame's own contents.
        ref={frameRef}
        className={`group/gal relative isolate ${frameClassName}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {multi ? (
          list.map((src, i) => (
            <img
              key={i}
              // Empty until this slide is in the window — see the note by
              // SRCSET_WIDTHS. An <img> with no src requests nothing.
              src={loaded(i) ? thumbSrc(src, widths[widths.length - 1]) : undefined}
              srcSet={loaded(i) ? srcSetFor(src, widths) : undefined}
              sizes={loaded(i) ? sizesAttr : undefined}
              alt={alt}
              loading={priority && i === 0 ? 'eager' : 'lazy'}
              fetchpriority={priority && i === 0 ? 'high' : undefined}
              decoding="async"
              onError={onImgError}
              className={`img-placeholder-bg absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-out ${
                i === idx ? 'scale-100 opacity-100' : 'scale-[1.04] opacity-0'
              }`}
            />
          ))
        ) : (
          <img
            src={thumbSrc(list[0], widths[widths.length - 1])}
            srcSet={srcSetFor(list[0], widths)}
            sizes={sizesAttr}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            fetchpriority={priority ? 'high' : undefined}
            decoding="async"
            onError={onImgError}
            className={`img-placeholder-bg h-full w-full object-cover transition-transform duration-700 ease-out ${
              zoomSingle ? 'group-hover/gal:scale-110' : ''
            }`}
          />
        )}

        {children}

        {multi && arrows !== 'none' && (
          <>
            <button type="button" aria-label="Pichli tasveer" onClick={nav(-1)} className={`${arrowBase} left-2 sm:left-3`}>
              <CaretLeft size={s.icon} weight="bold" />
            </button>
            <button type="button" aria-label="Agli tasveer" onClick={nav(1)} className={`${arrowBase} right-2 sm:right-3`}>
              <CaretRight size={s.icon} weight="bold" />
            </button>
          </>
        )}

        {/* Indicator: a dot per image, the active one stretched into a pill that
            fills as its slide plays. NOTE: this is also the auto-play clock (see
            autoRunning above) — the fill's animationend advances the slide, so the
            bar can never drift out of sync with the image.

            Colour scheme is built for BOTH light and dark photos. The active state
            is a BLACK fill riding on a light track; inactive dots stay a lighter
            neutral so the active one stands out. Every dot carries a white ring AND
            a dark drop-shadow — that double outline is what guarantees contrast on
            any image: on a dark photo the white ring reads, on a light photo the
            shadow (and, for the active dot, the black fill) reads. Pure-white dots,
            the previous scheme, disappeared on the pale product shots. */}
        {multi && (
          <div className={`absolute inset-x-0 ${s.dots} z-20 flex items-center justify-center gap-1.5`}>
            {list.map((_, i) => {
              const on = i === idx
              return (
                <button
                  key={i}
                  type="button"
                  onClick={jump(i)}
                  aria-label={`Tasveer ${i + 1}`}
                  aria-current={on ? 'true' : undefined}
                  className="group/dot grid place-items-center px-0.5 py-1.5"
                >
                  <span
                    className={`relative block overflow-hidden rounded-full ring-1 ring-white/70 shadow-[0_1px_3px_rgba(0,0,0,0.55)] transition-all duration-300 ease-out ${
                      on ? `${s.dotOn} bg-white/85` : `${s.dot} bg-white/55 group-hover/dot:bg-white/80`
                    }`}
                  >
                    {/* Active fill is black — the visible "you are here" mark. It
                        rides the light track so the growing bar stays visible as it
                        fills (black-on-light), and the track keeps the pill legible
                        on dark photos. */}
                    {on &&
                      (autoRunning ? (
                        <span
                          key={idx}
                          onAnimationEnd={() => go(1)}
                          style={{ animationDuration: `${interval}ms`, animationPlayState: paused ? 'paused' : 'running' }}
                          className="gallery-progress absolute inset-0 rounded-full bg-neutral-900"
                        />
                      ) : (
                        <span className="absolute inset-0 rounded-full bg-neutral-900" />
                      ))}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {thumbnails && multi && (
        <div className="no-scrollbar mt-3 flex gap-2.5 overflow-x-auto pb-1">
          {list.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={jump(i)}
              aria-label={`Tasveer ${i + 1}`}
              aria-current={idx === i ? 'true' : undefined}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 bg-white transition-all sm:h-20 sm:w-20 ${
                idx === i ? 'border-saffron-400 ring-2 ring-saffron-200' : 'border-brand-100 hover:border-brand-300'
              }`}
            >
              {/* 80px on screen at most, so 160px covers a 2x display. */}
              <img
                src={thumbSrc(src, 160)}
                alt={`${alt} ${i + 1}`}
                onError={onImgError}
                loading="lazy"
                decoding="async"
                className="img-placeholder-bg h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
