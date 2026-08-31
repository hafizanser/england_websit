// Client-side cache for PUBLIC catalogue reads.
//
// ---------------------------------------------------------------------------
// Why this exists
// ---------------------------------------------------------------------------
// Layout keys its page wrapper on `pathname`, so every route change UNMOUNTS the
// page component outright. `useAsync` then fetches on mount with nothing to fall
// back on, which is why pressing Back from a product landed on skeletons and
// re-downloaded the whole catalogue — the data was gone the moment the component
// was. HTTP caching alone cannot fix that: even a perfect 200-from-disk still
// leaves React re-mounting into `{ data: null, loading: true }` and repainting
// the grid from scratch.
//
// So this is the layer that answers "what did we already know?" synchronously,
// before the first paint. The HTTP layer (Cache-Control + ETag, see
// backend_laravel/routes/api.php) still does its job underneath: it is what makes
// the background revalidation nearly free.
//
// ---------------------------------------------------------------------------
// Freshness — no manual cache clearing anywhere
// ---------------------------------------------------------------------------
// This cache does not expire entries on a timer, because a timer is the wrong
// question. What decides whether to revalidate is HOW the shopper arrived
// (`useAsync` asks react-router): a Back/Forward is a return to something they
// were just looking at and is served silently, while every other arrival paints
// from here and checks with the server behind it. The check is nearly free —
// the API sends an ETag, so an unchanged catalogue costs a ~200 byte 304.
//
// Two things do throw entries away:
//   version changed    the API stamps every catalogue response with
//                      `X-Catalog-Version`, bumped server-side by any admin save,
//                      any checkout and any new review. A response carrying a new
//                      token wipes this cache whole and tells every mounted hook
//                      to re-read, so an edit lands on screen rather than waiting
//                      for a navigation.
//   MAX_AGE_MS         a hard backstop for the tab left open overnight.
//
// An admin write in this same tab also calls `invalidateCache` directly (see
// src/api/admin.js), so the person most likely to check immediately does not even
// wait for the next read.
//
// ---------------------------------------------------------------------------
// What must NEVER be cached here
// ---------------------------------------------------------------------------
// Anything tied to a person: cart, wishlist, auth, saved addresses, orders,
// profit figures, every /admin read. The rule is enforced at the call sites —
// only public catalogue reads pass a `cacheKey` — and again in `http.js`, which
// refuses to hand a cache key to a request carrying credentials.
//
// sessionStorage, not localStorage: this data belongs to a browsing session, and
// a shop-counter PC shared by three people should not accumulate it. It is also
// why the persistence layer is best-effort throughout — every read and write is
// wrapped, and a private-mode browser that throws on access simply runs on the
// in-memory Map.

const PREFIX = 'eng.qc.1:' // bump the digit to orphan every persisted entry
const VERSION_KEY = 'eng.qc.version'

// Past this an entry is not shown at all — a shopper coming back to a tab left
// open overnight should see a real load, not yesterday's prices. Deliberately
// generous: within a session the version token and the per-navigation
// revalidation keep things honest, so this only has to catch the extreme case.
const MAX_AGE_MS = 30 * 60_000

// Entries above this are kept in memory but never written to sessionStorage:
// the quota is ~5 MB per origin and one oversized blob would evict everything
// useful. The catalogue JSON sits far under it; this is a guard, not a budget.
const PERSIST_LIMIT_BYTES = 512 * 1024

/** key -> { data, at } — the authoritative copy for this tab. */
const MEM = new Map()

// ---------------------------------------------------------------------------
// persistence (best effort, always)
// ---------------------------------------------------------------------------

function persist(key, entry) {
  try {
    const raw = JSON.stringify(entry)
    if (raw.length > PERSIST_LIMIT_BYTES) return
    sessionStorage.setItem(PREFIX + key, raw)
  } catch {
    // Quota or private mode. MEM still serves this tab, which covers Back;
    // only the reload shortcut is lost.
  }
}

function hydrate(key) {
  try {
    const raw = sessionStorage.getItem(PREFIX + key)
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (!entry || typeof entry.at !== 'number') return null
    return entry
  } catch {
    return null
  }
}

function dropPersisted(predicate) {
  try {
    const doomed = []
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith(PREFIX) && predicate(k.slice(PREFIX.length))) doomed.push(k)
    }
    doomed.forEach((k) => sessionStorage.removeItem(k))
  } catch {
    /* nothing we can do, and nothing that should break the page */
  }
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

/**
 * What we know for `key`, or null.
 *
 * Returns `{ data, at, age }`. Anything returned here is good enough to PAINT —
 * whether to also revalidate is the caller's call (`useAsync` decides it from the
 * navigation type). Entries past MAX_AGE_MS are treated as nothing and dropped.
 */
export function readCache(key) {
  if (!key) return null

  let entry = MEM.get(key)
  if (!entry) {
    entry = hydrate(key)
    if (entry) MEM.set(key, entry)
  }
  if (!entry) return null

  const age = Date.now() - entry.at
  if (age > MAX_AGE_MS || age < 0) {
    // `age < 0` means the clock moved backwards (or the entry was written by a
    // machine with a different one) — distrust it rather than serve it forever.
    MEM.delete(key)
    dropPersisted((k) => k === key)
    return null
  }

  return { data: entry.data, at: entry.at, age }
}

/** Record a successful read. `undefined` is not a value worth remembering. */
export function writeCache(key, data) {
  if (!key || data === undefined) return
  const entry = { data, at: Date.now() }
  MEM.set(key, entry)
  persist(key, entry)
}

/**
 * Forget everything under `prefix` (or everything, with no argument).
 *
 * Called from the admin API wrappers after a save so an admin who edits a
 * product and then opens the storefront in the same tab sees their own edit,
 * and from `noteCatalogVersion` when the server says the catalogue moved.
 */
export function invalidateCache(prefix = '') {
  if (!prefix) {
    MEM.clear()
    dropPersisted(() => true)
  } else {
    for (const key of [...MEM.keys()]) {
      if (key.startsWith(prefix)) MEM.delete(key)
    }
    dropPersisted((k) => k.startsWith(prefix))
  }
  // Dropping an entry is only half the job: a hook that is ON SCREEN holding the
  // data we just threw away would otherwise keep showing it until the shopper
  // navigated. Subscribers re-fetch in place, keeping their current data visible
  // while they do, so an admin who saves and switches tabs sees the new value
  // appear rather than a skeleton.
  for (const fn of [...subscribers]) {
    try {
      fn(prefix)
    } catch {
      /* one bad subscriber must not stop the rest */
    }
  }
}

/**
 * Be told when cached data is dropped. `fn(prefix)` receives the prefix that was
 * invalidated ('' means everything). Returns an unsubscribe function.
 */
export function subscribeToInvalidation(fn) {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

const subscribers = new Set()

/**
 * Handle the `X-Catalog-Version` header from an API response.
 *
 * A changed token means an admin wrote something, so everything we are holding
 * is suspect — not just the endpoint that happened to report it. Clearing first
 * and letting the caller write its own fresh result afterwards is what keeps the
 * response that carried the news from being thrown away with the rest.
 *
 * A missing header (an endpoint outside the catalogue, or a response the browser
 * served from its own cache) is not news and is ignored.
 */
export function noteCatalogVersion(version) {
  if (!version) return

  if (knownVersion === undefined) {
    // First response of this page load: adopt whatever the last one in this tab
    // saw, so a RELOAD can still detect a bump that happened while the tab was
    // closed and throw away the entries it just hydrated from sessionStorage.
    try {
      knownVersion = sessionStorage.getItem(VERSION_KEY)
    } catch {
      knownVersion = null // private mode — in-memory tracking only
    }
  }

  if (knownVersion === version) return

  // Recorded BEFORE the wipe: invalidateCache() notifies its subscribers
  // synchronously and they immediately start fresh reads, whose responses will
  // carry this same token. Updating after would let that second wave look like
  // another change.
  const previous = knownVersion
  knownVersion = version

  // `previous === null` is a first-ever visit: there is nothing held that could
  // be stale, so record the token without wiping.
  if (previous) invalidateCache()

  try {
    sessionStorage.setItem(VERSION_KEY, version)
  } catch {
    /* ignore */
  }
}

// `undefined` = not yet read from storage, `null` = nothing was stored.
let knownVersion
