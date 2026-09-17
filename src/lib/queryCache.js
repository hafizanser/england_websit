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
//   DURABLE_MAX_AGE    a hard backstop. Past it an entry is not shown at all.
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
// ---------------------------------------------------------------------------
// Two storage tiers, because "fast" means two different things
// ---------------------------------------------------------------------------
// WITHIN a visit, the thing to beat is the re-mount: Layout throws the page
// component away on every route change, so Back would otherwise mean skeletons.
// sessionStorage covers that and dies with the tab, which is the right lifetime
// for it.
//
// ACROSS visits, the thing to beat is the first frame. A shopkeeper who opens
// the site every morning should not watch the catalogue arrive again, and the
// service worker alone cannot fix that: it makes the REQUEST instant, but React
// still mounts into `{ data: null, loading: true }` and paints a grid of
// skeletons before the answer — however fast — comes back. Only a value that can
// be read SYNCHRONOUSLY, inside a useState initialiser, removes that frame. So
// there is a second, durable tier in localStorage.
//
// That is also why it is localStorage and not IndexedDB, which would otherwise
// be the better-mannered choice for a few hundred KB: IndexedDB is asynchronous
// to the core, and a value that arrives in a promise arrives after the first
// paint — the exact frame this tier exists to remove. IndexedDB's real
// advantages (size, structured data) buy nothing here; the catalogue JSON is
// well inside either quota.
//
// What the durable tier holds is PUBLIC CATALOGUE DATA and nothing else — the
// same rule as above, enforced at the same call sites. The original reason for
// avoiding localStorage was a shop-counter PC shared by three people quietly
// accumulating somebody's browsing; a product list every visitor is served
// identically carries none of that, and it is checked against the server on the
// very next frame regardless.
//
// Every read and write in both tiers is best-effort and wrapped: a private-mode
// browser that throws on access simply runs on the in-memory Map.

const PREFIX = 'eng.qc.1:' // bump the digit to orphan every persisted entry
const DURABLE_PREFIX = 'eng.qcd.1:'
const VERSION_KEY = 'eng.qc.version'

// Past FRESH_MS an entry is STALE: still good enough to paint, never good enough
// to trust, so it is checked against the server behind the shopper even on a
// Back. That is what makes yesterday's catalogue safe to put on screen — it is
// on screen for the length of one request, not for the rest of the visit.
const FRESH_MS = 30 * 60_000

// Past this it is not shown at all. A day, so the common case — the same shop
// opening the site each morning — lands inside it, while a phone that has been
// in a drawer for a week starts clean rather than flashing week-old prices
// before correcting them.
const DURABLE_MAX_AGE_MS = 24 * 60 * 60_000

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
  let raw
  try {
    raw = JSON.stringify(entry)
  } catch {
    return // not serialisable — MEM still has it for this tab
  }
  if (raw.length > PERSIST_LIMIT_BYTES) return

  try {
    sessionStorage.setItem(PREFIX + key, raw)
  } catch {
    // Quota or private mode. MEM still serves this tab, which covers Back;
    // only the reload shortcut is lost.
  }

  // The durable copy is QUEUED rather than written here. This runs inside the
  // `.then()` of a catalogue fetch, which lands in the middle of React
  // committing the page that asked for it, and a synchronous few-hundred-KB
  // localStorage write at that moment is a visible stutter on a cheap phone.
  // Nothing waits on it: worst case the write never happens and the next visit
  // loads exactly the way it does today.
  queueDurable(key, raw)
}

const DURABLE_QUEUE = new Map()
let durableScheduled = false

function queueDurable(key, raw) {
  DURABLE_QUEUE.set(key, raw)
  if (durableScheduled || typeof window === 'undefined') return
  durableScheduled = true
  if (window.requestIdleCallback) window.requestIdleCallback(flushDurable, { timeout: 2000 })
  else window.setTimeout(flushDurable, 400)
}

function flushDurable() {
  durableScheduled = false
  const pending = [...DURABLE_QUEUE]
  DURABLE_QUEUE.clear()

  for (const [key, raw] of pending) {
    try {
      localStorage.setItem(DURABLE_PREFIX + key, raw)
    } catch {
      // Out of quota — and almost certainly on our OWN older entries, since this
      // is the only thing here that writes anything large. Clear the tier and
      // try this one again; if it still will not fit, drop it silently.
      dropDurable(() => true)
      try {
        localStorage.setItem(DURABLE_PREFIX + key, raw)
      } catch {
        return
      }
    }
  }
}

// Session first, then durable: within a tab the session copy is the one that has
// been kept up to date, and the durable tier is what a NEW tab finds.
function hydrate(key) {
  return readStore(sessionStorage, PREFIX, key) || readStore(localStorage, DURABLE_PREFIX, key)
}

function readStore(store, prefix, key) {
  try {
    const raw = store.getItem(prefix + key)
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (!entry || typeof entry.at !== 'number') return null
    return entry
  } catch {
    return null
  }
}

function dropPersisted(predicate) {
  dropFrom(sessionStorage, PREFIX, predicate)
  dropDurable(predicate)
}

function dropDurable(predicate) {
  dropFrom(localStorage, DURABLE_PREFIX, predicate)
}

function dropFrom(store, prefix, predicate) {
  try {
    const doomed = []
    for (let i = 0; i < store.length; i += 1) {
      const k = store.key(i)
      if (k && k.startsWith(prefix) && predicate(k.slice(prefix.length))) doomed.push(k)
    }
    doomed.forEach((k) => store.removeItem(k))
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
 * Returns `{ data, at, age, stale }`. Anything returned here is good enough to
 * PAINT. `stale` is the hint that it must ALSO be revalidated however the shopper
 * arrived: a fresh entry leaves that decision to the caller (`useAsync` takes it
 * from the navigation type), a stale one does not get a say. Entries past
 * DURABLE_MAX_AGE_MS are treated as nothing and dropped.
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
  if (age > DURABLE_MAX_AGE_MS || age < 0) {
    // `age < 0` means the clock moved backwards (or the entry was written by a
    // machine with a different one) — distrust it rather than serve it forever.
    MEM.delete(key)
    dropPersisted((k) => k === key)
    return null
  }

  return { data: entry.data, at: entry.at, age, stale: age > FRESH_MS }
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
 * A missing header (an endpoint outside the catalogue) is not news and is
 * ignored, and so is a token this page has already moved on from — see RETIRED.
 */
export function noteCatalogVersion(version) {
  if (!version) return

  // A token we have already retired is not a change, it is an echo. Several
  // layers can hand back a body older than what this page knows: the browser's
  // own HTTP cache (the API allows 15 s), and the service worker, which serves a
  // cached catalogue read and only learns the token has moved on the refresh
  // behind it. Without this, one of those echoes would look like a fresh change,
  // flip the version BACKWARDS, wipe everything, trigger a re-read — and be
  // answered from the very same stale layer, which is a loop that runs until the
  // stale copy expires. Remembering the handful of tokens we have left behind
  // turns every echo into a no-op.
  if (RETIRED.has(version)) return

  if (knownVersion === undefined) {
    // First response of this page load: adopt whatever the last one saw, so a
    // reload — or a visit tomorrow — can still detect a bump that happened while
    // nothing was open, and throw away the entries it has just hydrated.
    //
    // Both tiers are consulted, in the order they outlive each other. The
    // durable one is the load-bearing half: a brand-new tab has an empty
    // sessionStorage but may well have a day-old catalogue in localStorage, and
    // reading only the session copy would make every new visit look like a
    // first-ever visit — the one case below that deliberately does NOT wipe.
    try {
      knownVersion = sessionStorage.getItem(VERSION_KEY) ?? localStorage.getItem(VERSION_KEY)
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

  if (previous) {
    RETIRED.add(previous)
    // Bounded: a Set iterates in insertion order, so the first key is the
    // oldest. Only the last few matter — an echo older than that has long since
    // expired out of every cache that could still be replaying it.
    if (RETIRED.size > RETIRED_MAX) RETIRED.delete(RETIRED.values().next().value)
  }

  // `previous === null` is a first-ever visit: there is nothing held that could
  // be stale, so record the token without wiping.
  if (previous) invalidateCache()

  try {
    sessionStorage.setItem(VERSION_KEY, version)
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(VERSION_KEY, version)
  } catch {
    /* ignore */
  }
}

// `undefined` = not yet read from storage, `null` = nothing was stored.
let knownVersion

// Tokens this page has already superseded. Deliberately in memory only: it
// guards against replays arriving DURING a page's life, and a fresh load starts
// from whatever the storage tiers agree on rather than from a list of things it
// once distrusted.
const RETIRED = new Set()
const RETIRED_MAX = 8
