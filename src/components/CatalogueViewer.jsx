import { useCallback, useEffect, useRef, useState } from 'react'

// ─── The catalogue, playing by itself ─────────────────────────────────────
// The downloads section's right-hand side: the product catalogue PDF shown as a
// small "window" that turns its own pages, in the manner of the product-tour
// panel on the Mango site — a framed screen with a live dot, a row of progress
// segments under it (one per page, the current one filling), the page number
// and name, and a pause button.
//
// The pages are NOT the PDF. A 9.5 MB PDF is a lot to ask of a shopkeeper on
// mobile data just to glance at it, and a phone cannot render a PDF inline
// anyway. They are the same 13 pages pre-rendered to WebP (public/catalogue,
// ~500 KB in total), loaded only when the section comes near the screen. The
// real PDF is still one tap away on the Download button below.
//
// How it moves: every page gets PAGE_MS. For most of that time the page drifts
// slowly from its top to its bottom (a page is taller than the screen), then it
// glides up to the next page. So the screen is always moving, but slowly enough
// to read. After the last page it fades back to the cover and starts again.
//
// It stops when: the viewer presses Pause (or taps the screen), it scrolls off
// screen, the tab is hidden, or the visitor prefers reduced motion — in that
// case it starts paused and the segments still work as page buttons.
//
// When the catalogue PDF changes, re-render public/catalogue/page-NN.webp and
// update PAGES below (one entry per page, in order).

const PAGES = [
  { label: 'Cover', ur: 'سرورق' },
  { label: 'Fehrist', ur: 'فہرست' },
  { label: 'Body Razer', ur: 'باڈی ریزر' },
  { label: 'Hair Color', ur: 'ہیئر کلر' },
  { label: 'Lotion', ur: 'لوشن' },
  { label: 'Shampoo', ur: 'شیمپو' },
  { label: 'Agarbati', ur: 'اگربتی' },
  { label: 'Soap', ur: 'صابن' },
  { label: 'Tissue', ur: 'ٹشو' },
  { label: 'Hello Doctor', ur: 'ہیلو ڈاکٹر' },
  { label: 'Isapgol', ur: 'اسپغول' },
  { label: 'Bleach', ur: 'بلیچ' },
  { label: 'Order numbers', ur: 'رابطہ' },
]

/** The rendered pages are 1000 × 1414 (A4). */
const PAGE_RATIO = 1414 / 1000
/** The screen's shape: a little shorter than a page, so each page drifts. */
const SCREEN_RATIO = 1.22
/** Time on each page, drift + glide. */
const PAGE_MS = 5200
/** Share of PAGE_MS spent drifting down the page before gliding on. */
const DRIFT = 0.74
/** Gap between pages in the strip, px. */
const GAP = 10

const BASE = import.meta.env.BASE_URL
const pageSrc = (i) => `${BASE}catalogue/page-${String(i + 1).padStart(2, '0')}.webp`
const pad = (n) => String(n).padStart(2, '0')

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2

const DownIc = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v12" /><path d="m6 11 6 6 6-6" /><path d="M4 20h16" /></svg>)
const TickIc = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>)

// ─── The Download button under the viewer ─────────────────────────────────
// A plain same-origin link with the `download` attribute (so the browser saves
// the file instead of opening a viewer tab), dressed as a button that feels
// alive: at rest a thin bar along its foot fills and the button eases in a
// touch as it does — a "progress" breath every few seconds. On tap it presses
// in, the whole face fills like a progress bar, and the label says the download
// has started. The browser does the real downloading; the fill is only
// feedback, so the words never claim more than "shuru ho gaya" (it has started).
export function CatalogueDownload({ href, saveAs, size }) {
  const [state, setState] = useState('idle') // idle → busy → done → idle
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const onClick = () => {
    if (state !== 'idle') return
    setState('busy')
    timers.current.push(
      setTimeout(() => setState('done'), 1300),
      setTimeout(() => setState('idle'), 4200),
    )
  }

  return (
    <a
      className={`cat-dl is-${state}`}
      href={href}
      download={saveAs}
      type="application/pdf"
      onClick={onClick}
      aria-label={`Catalogue download karein — PDF, ${size}`}
    >
      <span className="cat-dl__fill" aria-hidden="true" />
      <span className="cat-dl__ic" aria-hidden="true">{state === 'done' ? <TickIc /> : <DownIc />}</span>
      <span className="cat-dl__txt">
        <span className="cat-dl__t">
          {state === 'busy' ? 'Download ho raha hai…' : state === 'done' ? 'Download shuru ho gaya' : 'Catalogue Download Karein'}
        </span>
        <span className="cat-dl__m">
          {state === 'done' ? 'Phone ke Downloads folder mein dekhein' : `PDF · ${size} · Bilkul free`}
        </span>
      </span>
      <span className="cat-dl__ur" lang="ur" dir="rtl" aria-hidden="true">مفت ڈاؤن لوڈ</span>
      <span className="cat-dl__bar" aria-hidden="true"><i /></span>
    </a>
  )
}

const PauseIc = () => (<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>)
const PlayIc = () => (<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>)

export default function CatalogueViewer() {
  const rootRef = useRef(null)
  const screenRef = useRef(null)
  const stripRef = useRef(null)
  const tourRef = useRef(null)

  const reduced = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [page, setPage] = useState(0)
  const [userPaused, setUserPaused] = useState(reduced.current)
  const [inView, setInView] = useState(false)
  const [near, setNear] = useState(false)
  const [tabVisible, setTabVisible] = useState(true)
  const [fading, setFading] = useState(false)

  // Playback clock: `t` is position in pages (2.4 = 40% through page 3).
  const clock = useRef({ t: 0, last: 0 })
  const running = !userPaused && inView && tabVisible && !fading

  // Load the pages only once the section is close; play only while it shows.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return undefined
    const nearIo = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); nearIo.disconnect() } }, { rootMargin: '600px 0px' })
    const viewIo = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 })
    nearIo.observe(el)
    viewIo.observe(el)
    const onVis = () => setTabVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVis)
    return () => { nearIo.disconnect(); viewIo.disconnect(); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  // Draw the clock onto the strip and the progress segments — straight to the
  // DOM, so a frame costs no React render. React only hears about page changes.
  const paint = useCallback(() => {
    const screen = screenRef.current
    const strip = stripRef.current
    if (!screen || !strip) return
    const w = screen.clientWidth
    const screenH = screen.clientHeight
    const pageH = w * PAGE_RATIO
    const step = pageH + GAP
    const extra = Math.max(0, pageH - screenH)
    const n = PAGES.length
    const t = Math.min(clock.current.t, n - 0.0001)
    const i = Math.floor(t)
    const f = t - i
    let y
    if (f < DRIFT || i === n - 1) {
      y = i * step + extra * easeSine(Math.min(1, f / DRIFT))
    } else {
      const from = i * step + extra
      const to = (i + 1) * step
      y = from + (to - from) * easeInOut((f - DRIFT) / (1 - DRIFT))
    }
    strip.style.transform = `translate3d(0, ${-y}px, 0)`
    // Name the next page once the glide is half-way — by then it fills most
    // of the screen.
    const shown = i < n - 1 && f > DRIFT + (1 - DRIFT) / 2 ? i + 1 : i
    const tour = tourRef.current
    if (tour) tour.style.setProperty('--p', String(shown === i ? f : 0))
    setPage((p) => (p === shown ? p : shown))
  }, [])

  useEffect(() => {
    if (!running) return undefined
    let raf = 0
    clock.current.last = 0
    const tick = (ts) => {
      const c = clock.current
      if (c.last) c.t += (ts - c.last) / PAGE_MS
      c.last = ts
      if (c.t >= PAGES.length) {
        // End of the catalogue: fade, back to the cover, fade in, go again.
        c.t = PAGES.length - 0.0001
        paint()
        setFading(true)
        return
      }
      paint()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running, paint])

  // The loop's fade: out (CSS), jump to the cover, in.
  useEffect(() => {
    if (!fading) return undefined
    const id = window.setTimeout(() => {
      clock.current.t = 0
      paint()
      setFading(false)
    }, 650)
    return () => window.clearTimeout(id)
  }, [fading, paint])

  // Keep the picture right when the screen changes size (rotate, resize).
  useEffect(() => {
    const el = screenRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => paint())
    ro.observe(el)
    return () => ro.disconnect()
  }, [paint, near])

  const goTo = (i) => {
    clock.current.t = i
    paint()
  }

  const togglePause = () => setUserPaused((v) => !v)
  // `playing` is what the screen is actually doing (the live chip); the buttons
  // follow the viewer's own choice, so scrolling away never flips them.
  const playing = running || fading
  const cur = PAGES[page]

  return (
    <div className={`cat-view${playing ? ' is-playing' : ''}`} ref={rootRef}>
      <div className="cat-win">
        <div className="cat-win__bar">
          <span className="cat-win__dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="cat-win__title">Catalogue · 2026</span>
          <span className={`cat-win__live${playing ? ' is-on' : ''}`}>{playing ? 'Chal raha hai' : 'Ruka hua'}</span>
        </div>
        <button
          type="button"
          className={`cat-win__screen${fading ? ' is-fading' : ''}`}
          ref={screenRef}
          onClick={togglePause}
          aria-label={!userPaused ? 'Catalogue rokein' : 'Catalogue chalayein'}
          style={{ aspectRatio: `1 / ${SCREEN_RATIO}` }}
        >
          <div className="cat-win__strip" ref={stripRef} style={{ gap: GAP }}>
            {PAGES.map((p, i) => (
              <img
                key={i}
                src={near ? pageSrc(i) : undefined}
                alt={`Catalogue page ${i + 1}: ${p.label}`}
                width="1000"
                height="1414"
                decoding="async"
                draggable="false"
              />
            ))}
          </div>
          <span className="cat-win__shade" aria-hidden="true" />
          {userPaused && (
            <span className="cat-win__play" aria-hidden="true"><PlayIc /></span>
          )}
        </button>
      </div>

      <div className="cat-tour" ref={tourRef}>
        <ol className="cat-tour__bars" aria-label="Catalogue pages">
          {PAGES.map((p, i) => (
            <li key={i} className={i < page ? 'is-done' : i === page ? 'is-active' : ''}>
              <button type="button" onClick={() => goTo(i)} aria-label={`Page ${i + 1}: ${p.label}`} aria-current={i === page ? 'step' : undefined}>
                <span />
              </button>
            </li>
          ))}
        </ol>
        <div className="cat-tour__row">
          <span className="cat-tour__n">{pad(page + 1)} / {pad(PAGES.length)}</span>
          <span className="cat-tour__label">
            {cur.label}
            <span className="cat-tour__ur" lang="ur" dir="rtl">{cur.ur}</span>
          </span>
          <button type="button" className="cat-tour__pause" onClick={togglePause} aria-pressed={userPaused}>
            {!userPaused ? <PauseIc /> : <PlayIc />}
            {!userPaused ? 'Rokein' : 'Chalayein'}
          </button>
        </div>
      </div>
    </div>
  )
}
