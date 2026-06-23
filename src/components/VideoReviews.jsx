import { useCallback, useEffect, useRef, useState } from 'react'

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
 *   - the row auto-scrolls smoothly right→left in a slow, seamless premium loop
 *     (JS scroll on a doubled list, so it wraps with no visible seam)
 *   - working  <  /  >  buttons nudge the carousel (auto-scroll pauses briefly)
 *   - reels autoplay MUTED; only ONE reel plays at a time (desktop AND mobile)
 *   - idle: the first visible (left-most) reel autoplays; desktop hover plays the
 *     hovered reel; mobile tap plays the tapped reel
 *   - every card has a Play/Pause button and a Mute/Un-mute button
 *   - turning sound on for a reel mutes whatever was unmuted before — only one
 *     reel can have audio at any moment
 *   - preload="none" + play-on-demand keeps it light; only played clips fetch
 *
 * NOTE: each <video> is muted imperatively via its ref. React's `muted` prop is
 * unreliable (it can leave the DOM property false), which makes the browser treat
 * the clip as unmuted and BLOCK autoplay. Setting el.muted = true guarantees
 * muted autoplay is allowed.
 */

// 16 curated reels, already ordered (pinned first, then 2×A / 2×B repeating) and
// transcoded to /public/videos/dvreel-NN.mp4 (+ .jpg poster). See transcode notes
// above — the Drive→H.264 conversion is a one-off; this list is just the result.
const REEL_NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
const REELS = REEL_NUMS.map((i) => {
  const n = String(i).padStart(2, '0')
  return { id: `dvreel-${n}`, src: `/videos/dvreel-${n}.mp4`, poster: `/videos/dvreel-${n}.jpg` }
})
// Doubled list: [...A, ...A] so the scroll loop wraps with no visible seam.
const CARDS = [...REELS, ...REELS]
const SPEED = 26 // px / second — slow, premium glide (lower = slower)

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
  const hoverPauseRef = useRef(false) // auto-scroll paused while hovering a card
  const resumeAtRef = useRef(0) // ms timestamp until which auto-scroll stays paused

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
  const [hover, setHover] = useState(null) // hovered card index (desktop), or null
  const [activeIndex, setActiveIndex] = useState(0) // for the gold "is-active" ring
  const [unmuted, setUnmuted] = useState(-1) // mirror of unmutedRef for the sound icon
  const [paused, setPaused] = useState(false) // mirror of userPausedRef for the play icon

  // Is card i currently within the visible strip viewport?
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

  // Play / Pause button. On the playing reel → pause everything (idle autoplay
  // stands down until the user plays again). On any other reel → play it now.
  const togglePlay = useCallback((e, i) => {
    e.stopPropagation()
    if (i === playingRef.current && !userPausedRef.current) {
      userPausedRef.current = true
      setPaused(true)
      videoRefs.current.forEach((v) => { if (v && !v.paused) v.pause() })
      return
    }
    userPausedRef.current = false
    setPaused(false)
    if (!canHoverRef.current) manualRef.current = i // mobile: keep it playing while visible
    playOnly(i)
  }, [playOnly])

  // Sound icon: toggle audio for this reel only. Turning sound on makes this reel
  // the playing one (stopping/muting whatever was playing); turning it off mutes.
  const toggleSound = useCallback((e, i) => {
    e.stopPropagation() // don't let the card's tap-to-play also fire
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
  }, [playOnly])

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

  // Auto-scroll the strip right→left in a seamless loop. The list is doubled, so
  // once we pass the half-way point we subtract one half-width and the wrap is
  // invisible. Pauses while hovering a card, or briefly after a nav / manual swipe.
  useEffect(() => {
    if (!seen) return undefined
    const strip = stripRef.current
    if (!strip) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    let raf = 0
    let last = null
    const step = (t) => {
      if (last == null) last = t
      const dt = Math.min((t - last) / 1000, 0.05) // clamp after tab-switch stalls
      last = t
      const half = strip.scrollWidth / 2
      if (half > 0) {
        const blocked = hoverPauseRef.current || t < resumeAtRef.current
        if (!blocked) strip.scrollLeft += SPEED * dt
        if (strip.scrollLeft >= half) strip.scrollLeft -= half
        else if (strip.scrollLeft < 0) strip.scrollLeft += half
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [seen])

  // Keep auto-scroll paused while a card is hovered (desktop).
  useEffect(() => { hoverPauseRef.current = hover !== null }, [hover])

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

  // Tap (mobile / click): play that reel now, stop the previous one. Marked as a
  // manual pick so the idle loop keeps it playing until it scrolls off-screen.
  const handleTap = (i) => {
    if (canHoverRef.current) return // desktop uses hover, not tap
    userPausedRef.current = false
    setPaused(false)
    manualRef.current = i
    playOnly(i)
  }

  // < / > navigation — nudge the strip by ~two cards and hold auto-scroll briefly.
  const nudge = (dir) => {
    const strip = stripRef.current
    if (!strip) return
    resumeAtRef.current = (typeof performance !== 'undefined' ? performance.now() : 0) + 1100
    const card = cardRefs.current.find(Boolean)
    const cardW = (card?.offsetWidth || 200) + 18 // card + track gap
    strip.scrollBy({ left: dir * cardW * 2, behavior: 'smooth' })
  }

  // Pause auto-scroll briefly when the user swipes / wheels the strip themselves.
  const holdScroll = () => {
    resumeAtRef.current = (typeof performance !== 'undefined' ? performance.now() : 0) + 1600
  }

  return (
    <section ref={sectionRef} className={`video-section reveal${seen ? ' in' : ''}`}>
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
            onPointerDown={holdScroll}
            onWheel={holdScroll}
          >
            <div className="video-track" ref={trackRef} aria-hidden={!seen}>
              {CARDS.map((r, i) => {
                const reelIdx = i % REELS.length
                if (dead.has(reelIdx)) return null // file failed → drop this card (no gap)
                const isPlaying = i === activeIndex && !paused
                return (
                  <div
                    key={`${r.id}-${i}`}
                    ref={(el) => { cardRefs.current[i] = el }}
                    className={`video-card${i === activeIndex ? ' is-active' : ''}${isPlaying ? ' is-playing' : ''}`}
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
                      poster={r.poster}
                      muted
                      loop
                      playsInline
                      preload="none"
                      onError={() => markDead(reelIdx)}
                    />

                    <button
                      type="button"
                      className="video-play-btn"
                      onClick={(e) => togglePlay(e, i)}
                      aria-label={isPlaying ? 'Pause reel' : 'Play reel'}
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? (
                        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                          <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
                          <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                          <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
                        </svg>
                      )}
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
        </div>
      </div>
    </section>
  )
}
