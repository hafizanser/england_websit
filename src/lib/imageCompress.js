// Shrink an image in the browser, before it is ever put on the wire.
//
// ---------------------------------------------------------------------------
// Why this exists
// ---------------------------------------------------------------------------
// Product photos were being uploaded exactly as they came off the phone or the
// camera and stored exactly as received — `Uploads::save()` on the API only
// checks the extension and moves the file, it does not resize anything. The
// catalogue that is live today averages ~930 KB per image, with plenty at
// 1.4 MB.
//
// That is two problems wearing one coat:
//
//   SAVING A PRODUCT TIMED OUT. A save with a main image and three gallery
//   images is ~5 MB of multipart body. On a 1-2 Mbps office uplink that is
//   20-40 seconds of pure transfer, and the admin panel gave up at 20 — which
//   is the "Server response slow hai" the dashboard was showing. Nothing was
//   wrong with the server; the request had not finished being sent.
//
//   AND EVERY SHOPPER PAID FOR IT. The same file is what the storefront serves,
//   so a 12-card grid was pulling ~11 MB of photographs over a phone
//   connection — which no amount of caching downstream can make free the first
//   time.
//
// A 1.4 MB product shot re-encoded here lands at roughly 150-300 KB with no
// visible difference at the sizes it is ever displayed: the grid draws these
// into a square card and the detail page into a ~700px frame, so anything past
// MAX_EDGE was only ever thrown away by the browser on every single view.
//
// ---------------------------------------------------------------------------
// What it will not touch
// ---------------------------------------------------------------------------
// SVG (vector — re-encoding it to pixels is strictly worse), GIF (re-encoding
// keeps the first frame and silently kills the animation), anything already
// small enough not to be worth it, anything that is not an image, and any file
// where the re-encode came out BIGGER than the original. Every one of those is
// returned untouched, and so is anything that throws: a failure here must cost
// the upload nothing but the original bytes it would have sent anyway.

// The longest edge any stored product photo needs. The biggest frame in the app
// is the detail page gallery at ~700 CSS px, so this still leaves better than
// 2x for high-density screens.
const MAX_EDGE = 1600

// High enough that flat packaging artwork and printed text stay clean.
const QUALITY = 0.82

// Below this there is nothing to win — the re-encode would cost more in CPU and
// risk than it saves in bytes.
const SKIP_UNDER_BYTES = 300 * 1024

// Formats where re-encoding loses something that cannot be recovered.
const LEAVE_ALONE = new Set(['image/svg+xml', 'image/gif'])

/**
 * Re-encode `file` smaller, or return it unchanged.
 *
 * Never throws and never returns null: the worst case is the file you passed in.
 */
export async function compressImage(file) {
  if (!(file instanceof File)) return file
  if (!file.type.startsWith('image/')) return file
  if (LEAVE_ALONE.has(file.type)) return file
  if (file.size <= SKIP_UNDER_BYTES) return file

  try {
    const bitmap = await decode(file)
    if (!bitmap) return file

    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = makeCanvas(w, h)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.drawImage(bitmap, 0, 0, w, h)
    if (typeof bitmap.close === 'function') bitmap.close()

    // WebP first: it is the only one of the three that keeps an alpha channel
    // AND compresses photographs well, and several products here are cut-outs
    // on transparency. A browser that cannot encode it hands back PNG or JPEG
    // instead, which is why the extension below is taken from what actually
    // came out rather than from what was asked for.
    const blob = await encode(canvas, 'image/webp', QUALITY)
    if (!blob || blob.size >= file.size) return file

    return new File([blob], rename(file.name, blob.type), {
      type: blob.type,
      lastModified: Date.now(),
    })
  } catch {
    return file
  }
}

/** Map `compressImage` over a list, in parallel. Non-images pass through. */
export function compressImages(files) {
  return Promise.all(Array.from(files || []).map(compressImage))
}

// ---------------------------------------------------------------------------

async function decode(file) {
  if (typeof createImageBitmap !== 'function') return null
  try {
    // `from-image` applies the EXIF orientation tag. Without it a photo taken
    // in portrait on a phone is decoded on its side, and we would store the
    // rotated version — the tag does not survive the re-encode to tell the
    // browser to put it back.
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Older engines reject the options object outright rather than ignoring the
    // member they do not know.
    try {
      return await createImageBitmap(file)
    } catch {
      return null
    }
  }
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h)
  const el = document.createElement('canvas')
  el.width = w
  el.height = h
  return el
}

function encode(canvas, type, quality) {
  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type, quality }).catch(() => null)
  }
  return new Promise((resolve) => {
    // The callback form gives no way to report failure other than a null blob,
    // which the caller already treats as "keep the original".
    canvas.toBlob(resolve, type, quality)
  })
}

// The API derives the stored extension from the filename it is given
// (Uploads::save), so a WebP body under a .png name would be saved as .png and
// served with the wrong type. Keep the human-readable stem, replace the suffix.
function rename(name, mime) {
  const ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
  const stem = String(name || 'image').replace(/\.[^.]+$/, '')
  return `${stem || 'image'}.${ext}`
}
