import { useCallback, useEffect, useRef, useState } from 'react'
import { lockScroll } from '../lib/scroll'

/**
 * VIDEO REVIEW SECTION — "Experience Excellence / See the products in action".
 *
 * Source: customer reels from two Google Drive folders. The originals are HEVC
 * (.MOV) which browsers can't decode, so they were transcoded once to web
 * H.264 720p MP4 + a poster JPG and self-hosted in /public/videos as
 * dvreel-NN.(mp4|jpg). Self-hosting (not a Drive /preview iframe) is what lets
 * us control playback + audio from JS: muted autoplay, a working mute/un-mute
 * that really enables sound, only ONE reel audible at a time, play/pause buttons.
 *
 * Card order (baked into the dvreel-NN numbering): the very first card is the
 * reel pinned by the brief, then 2 from Folder A, 2 from Folder B, repeating.
 *
 * Behaviour:
 *   - reels sit in a single-row horizontal carousel; the < / > arrows are the ONLY
 *     way it moves (smooth scrollBy by ~two cards) — there is NO auto-scroll
 *   - reels autoplay MUTED; only ONE reel plays at a time (desktop AND mobile) —
 *     when another reel starts, the previous one is paused
 *   - idle: the first visible (left-most) reel autoplays; desktop hover plays the
 *     hovered reel
 *   - clicking a card's Play button (desktop AND mobile) lifts that reel into the
 *     enlarged full-view player, where it keeps playing
 *   - in full view the Play overlay is hidden; only the Sound (Mute/Un-mute)
 *     button shows at the top. Clicking / tapping OUTSIDE the video (the backdrop)
 *     — or Escape — closes the view and returns the reel to its original card
 *   - turning sound on for a reel mutes whatever was unmuted before — only one
 *     reel can have audio at any moment
 *   - preload="none" + play-on-demand keeps it light; only played clips fetch
 *
 * NOTE: each <video> is muted imperatively via its ref. React's `muted` prop is
 * unreliable (it can leave the DOM property false), which makes the browser treat
 * the clip as unmuted and BLOCK autoplay. Setting el.muted = true guarantees
 * muted autoplay is allowed.
 */

// Curated reels, already ordered (pinned first, then 2×A / 2×B repeating) and
// transcoded to /public/videos/dvreel-NN.mp4 (+ .jpg poster). See transcode notes
// above — the Drive→H.264 conversion is a one-off; this list is just the result.
// dvreel-04 is omitted: it's the same footage as dvreel-03 (the Drive clip).
// dvreel-05 (the 4th rendered card) is also removed per request; the remaining
// reels keep their order and there is no empty card (the array maps 1:1).
const REEL_NUMS = [1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
const RAW_REELS = REEL_NUMS.map((i) => {
  const n = String(i).padStart(2, '0')
  return { id: `dvreel-${n}`, src: `/videos/dvreel-${n}.mp4`, poster: `/videos/dvreel-${n}.jpg` }
})
// De-duplicate by unique video URL (falling back to id) so the same clip can
// never appear twice. Keeps the FIRST occurrence, leaving the order untouched.
const REELS = (() => {
  const seenKeys = new Set()
  return RAW_REELS.filter((r) => {
    const key = r.src || r.id
    if (seenKeys.has(key)) return false
    seenKeys.add(key)
    return true
  })
})()
// Render each unique reel exactly ONCE (no doubling) — a video never repeats in
// the carousel. The < / > arrows scroll the single row; there is no auto-scroll.
const CARDS = REELS

export default function VideoReviews() {
  const sectionRef = useRef(null)
  const stripRef = useRef(null)
  const trackRef = useRef(null)
  const videoRefs = useRef([])
  const cardRefs = useRef([])
  const playingRef = useRef(-1) // index currently playing
  const manualRef = useRef(-1) // reel the user tapped (mobile), -1 when none
  const canHoverRef = useRef(false) // device actually supports hovering
  const unmutedRef = useRef(-1) // the single reel the user un-muted, -1 when all muted
  const userPausedRef = useRef(false) // user hit Pause — idle autoplay stands down

  const [dead, setDead] = useState(() => new Set()) // reel indices whose file failed to load
  const [seen, setSeen] = useState(false)

  // A reel's file didn't load → drop every card using it so no empty slot shows.
  const markDead = useCallback((reelIdx) => {
    setDead((prev) => {
      if (prev.has(reelIdx)) return prev
      const next = new Set(prev)
      next.add(reelIdx)
      return next
    })
  }, [])

  // Reel started rendering frames → hide its poster cover (no more black flash).
  const markReady = useCallback((i) => {
    setReady((prev) => {
      if (prev.has(i)) return prev
      const next = new Set(prev)
      next.add(i)
      return next
    })
  }, [])

  // Reveal the focus-view controls and arm the ~1.5s auto-hide. Re-armed on every
  // interaction so the overlay never vanishes mid-tap.
  const revealControls = useCallback(() => {
    clearTimeout(ctrlTimerRef.current)
    setControlsOn(true)
    ctrlTimerRef.current = window.setTimeout(() => setControlsOn(false), 1500)
  }, [])
  const [hover, setHover] = useState(null) // hovered card index (desktop), or null
  const [activeIndex, setActiveIndex] = useState(0) // for the gold "is-active" ring
  const [unmuted, setUnmuted] = useState(-1) // mirror of unmutedRef for the sound icon
  const [paused, setPaused] = useState(false) // mirror of userPausedRef for the play icon
  // Mobile focus / expand view: the index of the reel lifted into the larger
  // centered view (-1 = none). Only ONE reel can be expanded at a time.
  const [expanded, setExpanded] = useState(-1)
  const [closing, setClosing] = useState(false) // focus view is playing its close animation
  const expandedRef = useRef(-1) // mirror of `expanded` for rAF loops / imperative handlers
  const closeTimerRef = useRef(0) // pending close-animation finaliser
  // Poster cover stays until a reel's <video> actually starts rendering frames,
  // so a card never flashes black/empty while the clip buffers.
  const [ready, setReady] = useState(() => new Set()) // card indices whose video has begun playing
  // Focus-view controls auto-hide ~1.5s after they're revealed (mobile reels feel).
  const [controlsOn, setControlsOn] = useState(false)
  const ctrlTimerRef = useRef(0)

  // Is card i currently within the visible strip viewport? (horizontal carousel →
  // off-strip cards are clipped by overflow, so only the horizontal span matters)
  const isVisible = useCallback((i) => {
    const strip = stripRef.current
    const card = cardRefs.current[i]
    if (!strip || !card) return false
    const box = strip.getBoundingClientRect()
    const r = card.getBoundingClientRect()
    return r.right > box.left + 8 && r.left < box.right - 8
  }, [])

  // Play exactly one reel; pause every other. Each clip is force-muted first so
  // the browser permits muted autoplay (React's `muted` prop can't be trusted).
  // The only reel allowed to keep audio is the one the user un-muted (unmutedRef)
  // AND only while it's the reel that's actually playing — so when playback moves
  // on, the previous reel is muted automatically.
  const playOnly = useCallback((target) => {
    if (unmutedRef.current !== -1 && unmutedRef.current !== target) {
      // playback has moved off the un-muted reel — silence it.
      unmutedRef.current = -1
      setUnmuted(-1)
    }
    videoRefs.current.forEach((v, i) => {
      if (!v) return
      if (i === target) {
        const wantMuted = unmutedRef.current !== target
        v.muted = wantMuted
        if (!wantMuted) v.volume = 1
        const p = v.play()
        // Re-assert the muted flag once playback actually starts: Safari & mobile
        // can reset it while a preload="none" clip loads, which would drop audio.
        if (p && typeof p.then === 'function') {
          p.then(() => { v.muted = wantMuted }).catch(() => {})
        }
      } else {
        v.muted = true
        if (!v.paused) v.pause()
      }
    })
    playingRef.current = target
    setActiveIndex(target)
  }, [])

  // ---- Mobile focus / expand view -----------------------------------------
  // Lift a reel into the larger centered view and keep it playing. The <video>
  // node stays mounted exactly where it is (only CSS changes), so playback never
  // resets. Auto-scroll + the idle loop stand down while a reel is focused.
  const openExpand = useCallback((i) => {
    clearTimeout(closeTimerRef.current)
    setClosing(false)
    expandedRef.current = i
    setExpanded(i)
    userPausedRef.current = false
    setPaused(false)
    manualRef.current = i
    // Expanding into the full view auto-enables sound. The Play click is a user
    // gesture, so calling play() unmuted synchronously here satisfies autoplay
    // policies (desktop AND mobile). playOnly() reads unmutedRef to un-mute this
    // reel, set volume=1 and play — mirror it into state for the sound icon.
    unmutedRef.current = i
    setUnmuted(i)
    playOnly(i)
    revealControls() // controls show on open, then auto-hide
  }, [playOnly, revealControls])

  // Close the focus view: play the shrink-back animation, then drop it from the
  // DOM once the animation has finished (kept in sync with the CSS duration).
  const closeExpand = useCallback(() => {
    if (expandedRef.current === -1) return
    // Closing returns the reel to its muted preview behaviour: silence whatever
    // was audible so the inline carousel is muted again.
    const v = videoRefs.current[expandedRef.current]
    if (v) v.muted = true
    if (unmutedRef.current !== -1) {
      unmutedRef.current = -1
      setUnmuted(-1)
    }
    clearTimeout(ctrlTimerRef.current)
    setControlsOn(false)
    setClosing(true)
    clearTimeout(closeTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => {
      expandedRef.current = -1
      setExpanded(-1)
      setClosing(false)
    }, 280)
  }, [])

  // Play button. On BOTH desktop and mobile, clicking Play lifts that reel into
  // the same enlarged full-view player (where it keeps playing). The full view's
  // only control is the Sound button; closing it returns the reel to its card.
  const togglePlay = useCallback((e, i) => {
    e.stopPropagation()
    openExpand(i)
  }, [openExpand])

  // Sound icon: toggle audio for this reel only. Turning sound on makes this reel
  // the playing one (stopping/muting whatever was playing); turning it off mutes.
  const toggleSound = useCallback((e, i) => {
    e.stopPropagation() // don't let the card's tap-to-play also fire
    if (!canHoverRef.current) revealControls() // keep the focus controls alive while tapping
    const v = videoRefs.current[i]
    if (!v) return
    if (unmutedRef.current === i) {
      unmutedRef.current = -1
      setUnmuted(-1)
      v.muted = true
      return
    }
    unmutedRef.current = i
    setUnmuted(i)
    userPausedRef.current = false // un-muting implies "play this with sound"
    setPaused(false)
    if (!canHoverRef.current) manualRef.current = i // mobile: keep it playing while visible
    playOnly(i) // promotes this reel to the active one and unmutes it
  }, [playOnly, revealControls])

  // Detect hover capability once (kept current if the device/profile changes).
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const apply = () => { canHoverRef.current = mq.matches }
    apply()
    mq.addEventListener?.('change', apply)
    return () => mq.removeEventListener?.('change', apply)
  }, [])

  // Reveal + only start once the section scrolls into view.
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return undefined
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Find the left-most visible card (the "first visible" reel) for idle autoplay.
  const pickLead = useCallback(() => {
    const strip = stripRef.current
    if (!strip) return -1
    const box = strip.getBoundingClientRect()
    let best = -1
    let bestDist = Infinity
    cardRefs.current.forEach((card, i) => {
      if (!card) return
      const r = card.getBoundingClientRect()
      const visible = r.right > box.left + 8 && r.left < box.right - 8
      if (!visible) return
      const dist = Math.abs(r.left - box.left)
      if (dist < bestDist) { bestDist = dist; best = i }
    })
    return best
  }, [])

  // Idle autoplay loop. A tapped reel (manualRef) keeps playing while it's still
  // on screen; otherwise the first visible reel plays. Runs while not hovering and
  // not user-paused.
  useEffect(() => {
    if (!seen || hover !== null) return undefined
    const tick = () => {
      if (expandedRef.current !== -1) return // focus view owns playback while open
      if (userPausedRef.current) return
      let target
      if (manualRef.current >= 0 && isVisible(manualRef.current)) {
        target = manualRef.current
      } else {
        manualRef.current = -1
        target = pickLead()
      }
      if (target === -1) return
      if (target !== playingRef.current || videoRefs.current[target]?.paused) {
        playOnly(target)
      }
    }
    tick() // autoplay the first visible reel immediately
    const id = setInterval(tick, 300)
    return () => clearInterval(id)
  }, [seen, hover, pickLead, playOnly, isVisible])

  // Desktop hover owns playback: stop whatever was playing, play the hovered reel.
  useEffect(() => {
    if (hover === null) return
    manualRef.current = -1
    userPausedRef.current = false
    setPaused(false)
    playOnly(hover)
  }, [hover, playOnly])

  // Tap (mobile): tapping a reel opens it in the focused view. Tapping the
  // already-focused reel just re-reveals the auto-hiding controls (playback
  // continues — pause/mute live on the revealed controls).
  const handleTap = (i) => {
    if (canHoverRef.current) return // desktop uses hover, not tap
    if (expandedRef.current === i) {
      revealControls()
      return
    }
    if (expandedRef.current !== -1) return // another reel is focused (this card is behind the backdrop)
    openExpand(i)
  }

  // While a reel is focused: lock background scroll and let Escape close it.
  useEffect(() => {
    if (expanded === -1) return undefined
    const unlock = lockScroll()
    // Neutralise the page-transition transform so the focused reel's fixed
    // positioning is viewport-relative (see body.vs-focus rule in index.css).
    document.body.classList.add('vs-focus')
    const onKey = (e) => { if (e.key === 'Escape') closeExpand() }
    window.addEventListener('keydown', onKey)
    return () => {
      unlock()
      document.body.classList.remove('vs-focus')
      window.removeEventListener('keydown', onKey)
    }
  }, [expanded, closeExpand])

  // Clean up any pending timers on unmount.
  useEffect(() => () => {
    clearTimeout(closeTimerRef.current)
    clearTimeout(ctrlTimerRef.current)
  }, [])

  // < / > navigation — the ONLY way the carousel moves (no auto-scroll). Smoothly
  // scrolls the strip by ~two cards in the chosen direction.
  const nudge = (dir) => {
    const strip = stripRef.current
    if (!strip) return
    const card = cardRefs.current.find(Boolean)
    const cardW = (card?.offsetWidth || 200) + 18 // card width + track gap
    strip.scrollBy({ left: dir * cardW * 2, behavior: 'smooth' })
  }

  return (
    <section ref={sectionRef} className={`video-section reveal${seen ? ' in' : ''}${expanded !== -1 ? ' is-focusing' : ''}`}>
      <div className="section-inner">
        <div className="section-header">
          <div className="section-header-left">
            <div className="section-eyebrow">Experience Excellence</div>
            <h2 className="section-title">See the products <em>in action.</em></h2>
          </div>
          <p className="section-sub">Real customer reels — playing one after another, straight from the dukaandaar community.</p>
        </div>

        <div className="video-carousel">
          <button
            type="button"
            className="video-nav video-nav--prev"
            onClick={() => nudge(-1)}
            aria-label="Previous reels"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div
            className="video-strip"
            ref={stripRef}
            onMouseLeave={() => setHover(null)}
          >
            <div className="video-track" ref={trackRef} aria-hidden={!seen}>
              {CARDS.map((r, i) => {
                const reelIdx = i % REELS.length
                if (dead.has(reelIdx)) return null // file failed → drop this card (no gap)
                const isPlaying = i === activeIndex && !paused
                const isExpandedCard = i === expanded
                return (
                  <div
                    key={`${r.id}-${i}`}
                    ref={(el) => { cardRefs.current[i] = el }}
                    className={`video-card${i === activeIndex ? ' is-active' : ''}${isPlaying ? ' is-playing' : ''}${isExpandedCard ? ' is-expanded' : ''}${isExpandedCard && closing ? ' is-closing' : ''}${isExpandedCard && controlsOn ? ' is-controls' : ''}`}
                    onMouseEnter={() => { if (canHoverRef.current) setHover(i) }}
                    onClick={() => handleTap(i)}
                    aria-label={`Customer reel ${(i % REELS.length) + 1}`}
                  >
                    <video
                      ref={(el) => {
                        videoRefs.current[i] = el
                        // Force muted on attach so muted autoplay is allowed — but NEVER
                        // re-mute the reel the user explicitly un-muted (this inline ref
                        // re-runs on every render, which previously silenced the audio).
                        if (el && unmutedRef.current !== i) el.muted = true
                      }}
                      className="video-el"
                      src={r.src}
                      muted
                      loop
                      playsInline
                      preload="none"
                      onPlaying={() => markReady(i)}
                      onError={() => markDead(reelIdx)}
                    />

                    {/* Poster cover — a real <img> (lazy-loaded to save bandwidth) that
                        sits over the video until it starts playing, so the card shows the
                        thumbnail instead of a black/empty frame while the clip buffers. */}
                    <img
                      className={`video-poster${ready.has(i) ? ' is-hidden' : ''}`}
                      src={r.poster}
                      alt=""
                      aria-hidden="true"
                      draggable="false"
                      loading="lazy"
                    />

                    <button
                      type="button"
                      className="video-play-btn"
                      onClick={(e) => togglePlay(e, i)}
                      aria-label="Play reel"
                      title="Play"
                    >
                      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                        <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      className={`video-sound-btn${unmuted === i ? ' is-on' : ''}`}
                      onClick={(e) => toggleSound(e, i)}
                      aria-pressed={unmuted === i}
                      aria-label={unmuted === i ? 'Mute reel' : 'Unmute reel'}
                      title={unmuted === i ? 'Mute' : 'Unmute'}
                    >
                      {unmuted === i ? (
                        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                          <path
                            d="M4 9v6h4l5 4V5L8 9H4z M16 8.5a4 4 0 0 1 0 7 M18.5 6a7 7 0 0 1 0 12"
                            fill="none" stroke="currentColor" strokeWidth="1.8"
                            strokeLinecap="round" strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                          <path
                            d="M4 9v6h4l5 4V5L8 9H4z M16 9.5l5 5 M21 9.5l-5 5"
                            fill="none" stroke="currentColor" strokeWidth="1.8"
                            strokeLinecap="round" strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          <button
            type="button"
            className="video-nav video-nav--next"
            onClick={() => nudge(1)}
            aria-label="Next reels"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Full-view player — a dark backdrop behind the lifted reel. Clicking /
              tapping the backdrop (the area OUTSIDE the video), or pressing Escape,
              closes the view and returns the reel to its card. The focused reel is
              the same <video> node, just lifted via CSS, so it keeps playing. */}
          {expanded !== -1 && (
            <div
              className={`video-focus-backdrop${closing ? ' is-closing' : ''}`}
              onClick={closeExpand}
              aria-hidden="true"
            />
          )}
        </div>
      </div>
    </section>
  )
}
