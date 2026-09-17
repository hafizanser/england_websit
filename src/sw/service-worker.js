/* eslint-env serviceworker */

// ===========================================================================
// England storefront — service worker.
//
// This file is a TEMPLATE, not a module. It is never imported by the app: the
// Vite plugin in vite.config.js reads it at build time, substitutes the
// placeholders below and emits the result as `dist/sw.js`. That is what lets it
// know the exact hashed filenames of the build it belongs to without anyone
// maintaining a list by hand.
//
// ---------------------------------------------------------------------------
// What it is for
// ---------------------------------------------------------------------------
// A shopkeeper opens this site from the same phone every day, usually on the
// slowest connection in the whole system. Everything below exists to make the
// SECOND visit cost almost nothing: the bundle, the fonts, the product photos
// and the catalogue JSON are all still here from last time, so the grid paints
// from local storage and the network is used only to check what changed.
//
// The layers are deliberately separate, because they have different lifetimes:
//
//   eng-shell-<build>   this build's HTML + JS + CSS. Named after the build, so
//                       a deploy gets a brand-new cache and the previous one is
//                       deleted whole. No stale-bundle bug can survive a deploy.
//   eng-media-<data>    product photos, logos, posters, fonts. Stable URLs that
//                       outlive a deploy, so they are NOT build-scoped — a
//                       shopper who updates does not re-download the artwork.
//   eng-api-<data>      public catalogue JSON. Emptied the moment the API says
//                       the catalogue moved (see X-Catalog-Version below).
//   eng-meta-<data>     a one-key scratchpad for this worker's own bookkeeping.
//
// ---------------------------------------------------------------------------
// What is NEVER cached, and how that is guaranteed
// ---------------------------------------------------------------------------
// Anything that can differ between two people: cart, orders, profile, auth, the
// entire admin panel, and every request carrying a token. This is not enforced
// by a blocklist of things to avoid — a blocklist silently fails open the day
// someone adds an endpoint. It is an ALLOWLIST (API_PUBLIC below): a response is
// only ever stored if its path matches a route we know the API serves
// identically to every visitor. Everything else falls through to the network
// untouched, which is also exactly what would happen if this worker were not
// installed at all. Requests carrying an Authorization header are rejected
// before that, and non-GET before that, so three independent things have to go
// wrong at once for a private response to land in a shared cache.
// ===========================================================================

// --- injected at build time (see vite.config.js) ---------------------------
const BUILD = '__ENG_BUILD__'

// Where the API lives, as an origin plus a path prefix. An EMPTY origin means
// "the same origin this worker was served from" — which is what a relative
// VITE_API_BASE like `/api` means, and the only thing it can mean, since the
// deploy host is not knowable when this file is generated.
const API_ORIGIN = '__ENG_API_ORIGIN__' || self.location.origin
const API_PREFIX = '__ENG_API_PREFIX__'

const PRECACHE = __ENG_PRECACHE__

// Bumped BY HAND, and only when the shape of what is stored changes in a way
// that makes existing entries wrong (a new key format, a different strategy).
// Deploys do not touch it — that is the whole point of keeping media and
// catalogue data out of the build-scoped cache.
const DATA = 'v1'

const SHELL_CACHE = 'eng-shell-' + BUILD
const MEDIA_CACHE = 'eng-media-' + DATA
const API_CACHE = 'eng-api-' + DATA
const META_CACHE = 'eng-meta-' + DATA

const KEEP = new Set([SHELL_CACHE, MEDIA_CACHE, API_CACHE, META_CACHE])

// The directory this worker was served from — also its scope. Everything is
// resolved against it rather than against '/', because the app builds with
// `base: './'` and can be served from a sub-folder.
const ROOT = new URL('./', self.location).href
const SHELL_URL = new URL('index.html', ROOT).href

// Media is unbounded by nature: a shopper who browses the whole catalogue
// touches several hundred photos. Kept to a ceiling and trimmed oldest-first
// (cache.keys() returns insertion order), so a long session cannot quietly grow
// until the browser evicts this origin's storage wholesale.
const MEDIA_MAX = 400
const TRIM_EVERY = 25
let putsSinceTrim = 0

// ---------------------------------------------------------------------------
// what may be cached
// ---------------------------------------------------------------------------

// Public catalogue reads, as an allowlist of exact paths and path shapes. These
// mirror the `cache.public` group in backend_laravel/routes/api.php — the API
// has already declared those identical for every visitor. Adding a route here
// without adding it there is the one way to get this wrong, which is why the
// two lists are written to look the same.
const API_PUBLIC = [
  /^\/products$/,
  /^\/products\/top-selling$/,
  /^\/products\/[^/]+$/,
  /^\/products\/[^/]+\/reviews$/,
  /^\/reviews\/featured$/,
  /^\/categories$/,
  /^\/offers$/,
  /^\/offers\/featured$/,
  /^\/offers\/[^/]+$/,
  /^\/blogs$/,
  /^\/blogs\/[^/]+$/,
  /^\/homepage-videos$/,
]

const IMAGE_EXT = /\.(png|jpe?g|gif|svg|webp|avif|ico)$/i
const FONT_EXT = /\.(woff2?|ttf|otf|eot)$/i

/**
 * The API-relative path of `url`, or null when it is not an API request at all.
 *
 * Everything that decides whether a response may be stored goes through here, so
 * the allowlist above can stay written the way the routes are written on the
 * server — `/products`, not `/api/products` — no matter which prefix this
 * deployment happens to serve them under.
 */
function apiPath(url) {
  if (url.origin !== API_ORIGIN) return null
  if (!API_PREFIX) return url.pathname
  if (url.pathname === API_PREFIX) return '/'
  if (!url.pathname.startsWith(API_PREFIX + '/')) return null
  return url.pathname.slice(API_PREFIX.length)
}

// Product artwork, served by the API out of its uploads folder under a
// content-immutable name (ImageController sets its own one-year header).
const isApiImage = (url) => apiPath(url) === '/image'

const isPublicApiRead = (url) => {
  const path = apiPath(url)
  return path !== null && API_PUBLIC.some((re) => re.test(path))
}

const isBuildAsset = (url) => url.href.startsWith(ROOT) && url.pathname.includes('/assets/')

const isLocalImage = (url) => url.href.startsWith(ROOT) && IMAGE_EXT.test(url.pathname)

// Google Fonts and Fontshare each split into a small stylesheet (which varies
// with the browser asking for it) and the font files themselves (immutable,
// hashed URLs). Different lifetimes, so they get different strategies below.
const FONT_CSS_HOSTS = new Set(['fonts.googleapis.com', 'api.fontshare.com'])
const FONT_FILE_HOSTS = new Set(['fonts.gstatic.com', 'cdn.fontshare.com'])

const isFontCss = (url) => FONT_CSS_HOSTS.has(url.hostname)
const isFontFile = (url) => FONT_FILE_HOSTS.has(url.hostname) || FONT_EXT.test(url.pathname)

// ---------------------------------------------------------------------------
// install / activate
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE)

      // One at a time rather than addAll(). addAll is atomic, so a single 404 —
      // a renamed file, a partial upload — would fail the whole install and
      // leave the visitor with no worker at all. A shell that is 90% warm is
      // strictly better than none, and every runtime handler falls back to the
      // network for whatever is missing.
      await Promise.allSettled(
        PRECACHE.map((path) =>
          cache.add(new Request(new URL(path, ROOT).href, { cache: 'reload' })),
        ),
      )

      // Taking over immediately is safe here BECAUSE the asset handler falls
      // back to the network. A page still running the previous build can ask
      // this worker for a chunk whose cache entry has just been deleted; it
      // misses, goes to the network, and is answered from the browser's own HTTP
      // cache, where those files are immutable for a year. Waiting instead would
      // leave a deploy dormant until every tab in the shop was closed.
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names.filter((n) => n.startsWith('eng-') && !KEEP.has(n)).map((n) => caches.delete(n)),
      )
      await self.clients.claim()
    })(),
  )
})

// The page asks for this right after registering, so a worker installed on a
// PREVIOUS visit still reports the catalogue version it is holding. Without it
// the app would only ever learn about a change that happened to arrive during
// this session, and a cached body always carries the old token.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'eng:sync') {
    event.waitUntil(
      (async () => {
        const version = await readMeta('catalog-version')
        if (version && event.source) {
          event.source.postMessage({ type: 'eng:catalog-version', version })
        }
      })(),
    )
  }
})

// ---------------------------------------------------------------------------
// fetch
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const { request } = event

  // The gates, cheapest first. Anything that passes all of them is a plain,
  // public, whole-resource GET.
  if (request.method !== 'GET') return
  if (request.headers.has('authorization')) return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  // The admin panel is a different application that happens to share a bundle.
  // Nothing under it is public, and its lazy chunk is deliberately left out of
  // the precache, so it is skipped wholesale rather than trusted to fail the
  // allowlist further down.
  if (url.pathname.includes('/admin')) return

  // VIDEO IS LEFT ALONE, ON PURPOSE. A <video> fetches with a Range header and
  // expects a 206 back; the Cache API can only store and replay whole 200
  // responses, so serving clips from here would mean either downloading every
  // file in full the first time it is glimpsed, or hand-rolling byte-range
  // slicing. It would also buy nothing: public/.htaccess already gives /videos/
  // a month in the browser's own HTTP cache, which does Range natively and
  // correctly. The POSTERS beside them are ordinary images and ARE cached below,
  // so the grid still paints instantly.
  if (url.pathname.includes('/videos/') || request.destination === 'video') return
  if (request.headers.has('range')) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigate(request))
    return
  }
  if (isBuildAsset(url)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE))
    return
  }
  if (isFontFile(url)) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE))
    return
  }
  if (isApiImage(url)) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE))
    return
  }
  if (isFontCss(url) || isLocalImage(url)) {
    event.respondWith(staleWhileRevalidate(event, request, MEDIA_CACHE))
    return
  }
  if (isPublicApiRead(url)) {
    event.respondWith(handleCatalogRead(event, request))
  }
})

// ---------------------------------------------------------------------------
// strategies
// ---------------------------------------------------------------------------

// The document: NETWORK FIRST, with the cached shell as the safety net.
//
// Serving the shell straight from cache is the fastest thing this worker could
// do and it is what most PWA recipes say to do. It is wrong here. index.html is
// the file that NAMES the hashed bundles, so a cached copy pins the visitor to
// whichever build it came from — whoever deploys a fix would reload, still see
// the old site, and reasonably conclude the deploy failed. The document is ~8 KB
// gzipped and answered with a 304 when unchanged, so asking is cheap, and
// everything expensive it references is already local. The timeout is what stops
// that politeness from turning into a blank screen on a dead network.
async function handleNavigate(request) {
  const cache = await caches.open(SHELL_CACHE)

  try {
    const fresh = await withTimeout(fetch(request), 2500)
    if (fresh) {
      if (fresh.ok) cache.put(SHELL_URL, fresh.clone()).catch(() => {})
      return fresh
    }
  } catch {
    /* offline, or slower than the timeout — fall through to what we have */
  }

  const cached = (await cache.match(SHELL_URL)) || (await cache.match(request))
  if (cached) return cached

  // Nothing cached and nothing reachable: let the browser show its own offline
  // page rather than inventing a worse one.
  return fetch(request)
}

// Content-hashed build output, font files, product artwork: the bytes behind
// these URLs can never change, so a hit is final and there is nothing to
// revalidate.
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit

  const response = await fetch(request)
  if (isStorable(response)) {
    await put(cache, request, response.clone(), cacheName === MEDIA_CACHE)
  }
  return response
}

// Stable-name assets (logos, banners, reel posters, the font stylesheets):
// answer from the cache instantly, then refresh behind the visitor so a
// replaced file is picked up by the next visit without anyone waiting now.
function staleWhileRevalidate(event, request, cacheName) {
  return caches.open(cacheName).then(async (cache) => {
    const hit = await cache.match(request)

    const network = fetch(request)
      .then((response) => {
        if (!isStorable(response)) return response
        return put(cache, request, response.clone(), cacheName === MEDIA_CACHE).then(
          () => response,
        )
      })
      .catch(() => null)

    if (hit) {
      // waitUntil, not a dangling promise: the refresh has to be allowed to
      // finish AFTER the response has been handed back, or the browser is free
      // to kill this worker mid-flight and the cache never moves on.
      event.waitUntil(network)
      return hit
    }

    return (await network) || fetch(request)
  })
}

// Public catalogue JSON. The same stale-while-revalidate shape, plus the one
// thing that makes being this aggressive safe: X-Catalog-Version.
//
// The API stamps every public response with a token that changes whenever an
// admin saves, a review lands or stock moves. A cached body carries the OLD
// token, so the app cannot notice a change by reading the response it was just
// handed — it would be reading the past. The background refresh is what sees the
// new token, and noteVersion() both empties this cache and tells the page, which
// re-reads in place. That is the whole "instant now, correct a moment later"
// contract, and it is why serving stale JSON here does not mean showing anyone
// yesterday's catalogue.
function handleCatalogRead(event, request) {
  return caches.open(API_CACHE).then(async (cache) => {
    const hit = await cache.match(request)

    const network = fetch(request)
      .then(async (response) => {
        if (!isStorable(response)) return response
        await cache.put(request, response.clone()).catch(() => {})
        await noteVersion(response)
        return response
      })
      .catch(() => null)

    if (hit) {
      event.waitUntil(network)
      return hit
    }

    return (await network) || fetch(request)
  })
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// A response is storable only if it is a complete, successful, readable answer
// that nobody has asked us not to keep.
//
// `opaque` (a no-cors cross-origin response) is excluded deliberately: its
// status is unreadable, so a 404 or a captive-portal login page is
// indistinguishable from the real file and would be cached and replayed
// forever. Better to let those go to the network every time.
function isStorable(response) {
  if (!response || !response.ok || response.status !== 200) return false
  if (response.type === 'opaque' || response.type === 'opaqueredirect') return false

  const cc = response.headers.get('Cache-Control') || ''
  if (/no-store|private/i.test(cc)) return false
  // A response that varies by credentials is per-person by definition.
  if (/authorization/i.test(response.headers.get('Vary') || '')) return false

  return true
}

async function put(cache, request, response, trimmable) {
  try {
    await cache.put(request, response)
  } catch {
    return // quota, or an unstorable request — never worth failing the fetch for
  }
  if (!trimmable) return
  putsSinceTrim += 1
  if (putsSinceTrim >= TRIM_EVERY) {
    putsSinceTrim = 0
    await trim(cache, MEDIA_MAX)
  }
}

// Oldest-first, by insertion order — cache.keys() preserves it. Not a true LRU
// (the Cache API records no access times), but the thing being protected is the
// storage ceiling, and FIFO is enough for that.
async function trim(cache, max) {
  const keys = await cache.keys()
  if (keys.length <= max) return
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)))
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

// A one-key store, kept in a Cache rather than IndexedDB. IndexedDB would mean
// an open/upgrade dance and a transaction wrapper for what is a single short
// string; a Cache is already open, is already the thing this worker deals in,
// and is discarded at exactly the same moment as the data it is bookkeeping for.
async function readMeta(key) {
  try {
    const cache = await caches.open(META_CACHE)
    const hit = await cache.match(new URL('__meta/' + key, ROOT).href)
    return hit ? await hit.text() : null
  } catch {
    return null
  }
}

async function writeMeta(key, value) {
  try {
    const cache = await caches.open(META_CACHE)
    await cache.put(new URL('__meta/' + key, ROOT).href, new Response(value))
  } catch {
    /* best effort — a missed note costs one stale paint, not correctness */
  }
}

// Handle the catalogue version a response arrived carrying. A change means an
// admin wrote something, so everything held for the catalogue is suspect — not
// just the endpoint that happened to report it.
async function noteVersion(response) {
  const version = response.headers.get('X-Catalog-Version')
  if (!version) return

  const previous = await readMeta('catalog-version')
  if (previous === version) return

  await writeMeta('catalog-version', version)

  // No previous token means a first-ever visit: there is nothing held that could
  // be stale, so record it and say nothing.
  if (!previous) return

  // Everything in here predates the change. Dropped whole rather than picked
  // over — a version bump is the API saying it does not know which of these is
  // affected either. The response that brought the news is put straight back so
  // the read that triggered this is not immediately re-fetched.
  const cache = await caches.open(API_CACHE)
  const keys = await cache.keys()
  await Promise.all(keys.map((k) => cache.delete(k)))
  if (response.url) await cache.put(response.url, response.clone()).catch(() => {})

  await broadcast({ type: 'eng:catalog-version', version })
}

async function broadcast(message) {
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  all.forEach((client) => client.postMessage(message))
}
