// Resolve a product's preview clip — the small playing badge on the corner of a
// product card and inside the detail-page gallery.
//
// ---------------------------------------------------------------------------
// One resolver, both screens
// ---------------------------------------------------------------------------
// ProductCard and ProductDetailPage both call this and pass the result straight
// to the same <ProductVideoBadge>. That is deliberate and it is what makes
// "assign a video in the dashboard and it shows up in both places" true without
// either page knowing anything about how videos are stored: change what this
// function returns and both screens change together, by construction.
//
// ---------------------------------------------------------------------------
// There used to be a fake here
// ---------------------------------------------------------------------------
// The catalogue had no video column, so this file hashed the product id and
// handed back one of ten reels shipped in /public/videos. It made the feature
// demonstrable before there was anything behind it, at the cost of being a lie:
// every product had a badge, and no product's badge was its own — the England
// Soap card played a tissue reel because 'soap-id' % 10 landed there.
//
// tbl_product.product_video is now a real column (see the 2026_09_17 migration),
// the dashboard writes it per product, and the API sends it as `video_url` with
// its generated poster as `video_poster`. So the mapping is gone. A product with
// no clip assigned returns null here, and null is how both screens have always
// said "draw no badge" — that path is unchanged and needed no edit.

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i
const GIF_EXT = /\.gif(\?|#|$)/i

function classify(src, poster) {
  if (!src || typeof src !== 'string') return null
  if (VIDEO_EXT.test(src)) return { src, kind: 'video', poster }
  if (GIF_EXT.test(src)) return { src, kind: 'gif', poster }
  return null
}

/** First non-empty string among `values`, or null. */
function firstString(values) {
  for (const v of values) {
    if (v && typeof v === 'string' && v.trim() !== '') return v.trim()
  }
  return null
}

/**
 * The clip for `p` as `{ src, kind, poster }`, or null when it has none.
 *
 * `poster` may be null — ffmpeg is what generates it while optimising the
 * upload, and it is not guaranteed to be present on every host. Both callers
 * already fall back to the product photo in that case, which is exactly what the
 * badge showed before posters existed.
 */
export function productVideo(p) {
  if (!p) return null

  // The assigned clip. `video_url` is what the API sends; the rest are accepted
  // because they are the other spellings the same value has travelled under, and
  // a cached response written before this change can still be on a shopper's
  // device for up to a day (lib/queryCache.js).
  const src = firstString([p.video_url, p.video, p.videoUrl, p.gif, p.gif_url])
  if (src) {
    const poster = firstString([p.video_poster, p.videoPoster, p.video_poster_url])
    // An explicit video field may point at any container, so anything that does
    // not look like a GIF is treated as a video rather than discarded.
    return classify(src, poster) || { src, kind: 'video', poster }
  }

  // Nothing assigned, but a clip may still be sitting in the image gallery —
  // an .mp4 or .gif a shopkeeper uploaded there before the video field existed.
  // Kept as a migration courtesy so those products do not lose their badge.
  const media = [p.image, ...(Array.isArray(p.images) ? p.images : [])].filter(Boolean)
  for (const url of media) {
    const hit = classify(url, null)
    if (hit) return hit
  }

  return null
}
