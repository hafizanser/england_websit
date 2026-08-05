import { useEffect, useMemo, useState } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useReducedMotion } from 'framer-motion'
import { PLACEHOLDER, onImgError } from '../lib/img'

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

export default function ProductGallery({
  images,
  alt = '',
  interval = 2800,
  autoPlay = true,
  size = 'sm',
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

  // A different product can be rendered into the same mounted gallery (the grid
  // reuses cards), and the new set may be shorter — restart rather than point at
  // an index that no longer exists.
  useEffect(() => {
    setIdx(0)
  }, [list])

  // Auto-play is driven by the progress bar's own animationend, NOT a setInterval.
  // That is what makes hover-pause exact: pausing the CSS animation freezes the
  // bar mid-fill and withholds the event, and resuming continues from that exact
  // point. A timer would have to track elapsed time by hand to do the same, and
  // the old code didn't — its hover handler advanced the image without resetting
  // the interval, so a hover could be followed a few ms later by an auto tick.
  const autoRunning = autoPlay && multi && !reduce

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
        className={`group/gal relative ${frameClassName}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {multi ? (
          list.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={alt}
              loading={priority && i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              onError={onImgError}
              className={`img-placeholder-bg absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-out ${
                i === idx ? 'scale-100 opacity-100' : 'scale-[1.04] opacity-0'
              }`}
            />
          ))
        ) : (
          <img
            src={list[0]}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
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
              <img src={src} alt={`${alt} ${i + 1}`} onError={onImgError} loading="lazy" className="img-placeholder-bg h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
