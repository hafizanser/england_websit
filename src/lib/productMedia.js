// Resolve a product's preview clip (video or animated GIF), if it has one.
//
// The backend has no dedicated video column yet, so this stays deliberately
// permissive: it honours an explicit field the moment one is added
// (`video` / `video_url` / `videoUrl` / `gif` / `gif_url`), and otherwise
// sniffs the existing image gallery for a clip a shopkeeper already uploaded
// (a `.mp4`/`.webm`/`.gif` living in `images`). That means the feature "lights
// up" with today's data pipeline — upload a GIF to a product and its card grows
// a play badge — with zero schema changes, while being ready for a first-class
// field later.
//
// Returns `{ src, kind }` where kind is 'video' | 'gif', or null when the
// product carries no clip (the caller shows nothing in that case).

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i
const GIF_EXT = /\.gif(\?|#|$)/i

function classify(src) {
  if (!src || typeof src !== 'string') return null
  if (VIDEO_EXT.test(src)) return { src, kind: 'video' }
  if (GIF_EXT.test(src)) return { src, kind: 'gif' }
  return null
}

// ---- demo fallback ---------------------------------------------------------
// The catalogue has no per-product video column yet, so with real data the badge
// would never appear. To make the feature demonstrable NOW, we assign one of the
// product reels already shipped in /public/videos to each product, deterministically
// by id (same product → same clip every render, no Math.random). These are light,
// poster-backed clips. Flip DEMO_VIDEOS to false to switch the feature back to
// "only products with a real video/GIF show the badge".
const DEMO_VIDEOS = true
const DEMO_POOL = [
  { src: '/videos/reel-01.mp4', poster: '/videos/reel-01.jpg' },
  { src: '/videos/reel-03.mp4', poster: '/videos/reel-03.jpg' },
  { src: '/videos/reel-04.mp4', poster: '/videos/reel-04.jpg' },
  { src: '/videos/reel-05.mp4', poster: '/videos/reel-05.jpg' },
  { src: '/videos/reel-07.mp4', poster: '/videos/reel-07.jpg' },
  { src: '/videos/reel-08.mp4', poster: '/videos/reel-08.jpg' },
  { src: '/videos/reel-09.mp4', poster: '/videos/reel-09.jpg' },
  { src: '/videos/reel-10.mp4', poster: '/videos/reel-10.jpg' },
  { src: '/videos/reel-22.mp4', poster: '/videos/reel-22.jpg' },
  { src: '/videos/reel-24.mp4', poster: '/videos/reel-24.jpg' },
]

// Stable, tiny string hash → pool index (deterministic per product id).
function pickDemo(id) {
  const s = String(id ?? '')
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const { src, poster } = DEMO_POOL[h % DEMO_POOL.length]
  return { src, kind: 'video', poster }
}

export function productVideo(p) {
  if (!p) return null

  // 1) An explicit clip field always wins (future-proofing for a real column).
  for (const field of [p.video, p.video_url, p.videoUrl, p.gif, p.gif_url]) {
    if (field && typeof field === 'string' && field.trim() !== '') {
      // An explicit video field may point at any container; treat a non-GIF as a video.
      return classify(field) || { src: field, kind: 'video' }
    }
  }

  // 2) Sniff the image gallery for a clip file (e.g. an uploaded .gif / .mp4).
  const media = [p.image, ...(Array.isArray(p.images) ? p.images : [])].filter(Boolean)
  for (const url of media) {
    const hit = classify(url)
    if (hit) return hit
  }

  // 3) Demo fallback so the badge + modal are testable before a video column exists.
  if (DEMO_VIDEOS) return pickDemo(p.id ?? p.name)

  return null
}
