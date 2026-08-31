import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { readCache, subscribeToInvalidation, writeCache } from '../lib/queryCache'
import { useRestoreNavigation } from './useRestoreNavigation'

// A blip worth retrying silently rather than reporting: the connection dropped,
// the request timed out, or the server returned a 5xx. A 404 or a 401 is a real
// answer — retrying those just delays telling the truth.
const isTransient = (e) =>
  e?.code === 'NETWORK' || e?.code === 'TIMEOUT' || (e?.status >= 500 && e?.status < 600)

const idleState = { data: null, loading: true, error: null, attempt: 0, revalidating: false }

// Generic async-data hook → { data, loading, error, retrying, revalidating,
// attempt, reload }. `fn` is an async function; `deps` re-run it (like useEffect
// deps).
//
// Every call is stamped with a monotonic id and only the newest one may write
// state. That kills two races: a slow first response overwriting a newer
// reload(), and an unmounted/re-run effect landing on dead state. The effect
// cleanup bumps the id, so an in-flight request is invalidated on unmount or
// when deps change.
//
// `options.retries` (default 0 — every existing caller keeps its current
// behaviour) retries transient failures behind whatever placeholder the caller
// is already showing. `loading` stays true across the whole sequence, so the UI
// never flashes an error the visitor has to act on for a hiccup that resolves
// itself. `retrying` is exposed for callers that want to say so.
//
// ---------------------------------------------------------------------------
// options.cacheKey — stale-while-revalidate for PUBLIC catalogue reads
// ---------------------------------------------------------------------------
// Pass a cacheKey and the hook stops starting from nothing on every mount. What
// it does with a cached entry depends on HOW the shopper got here:
//
//   Back / Forward     served from cache, and NOT revalidated. This is the case
//                      the whole thing exists for: Layout unmounts the page on
//                      every route change, so without it Back always meant
//                      skeletons and a full re-download of the catalogue. A
//                      shopper returning to a grid they were just looking at
//                      wants it back, not refreshed.
//
//   anything else      served from cache INSTANTLY and refreshed behind them
//   (a click, a        (`revalidating`). Nothing flashes — the swap is an
//   reload, a link)    ordinary re-render — and it is what makes an admin's edit
//                      show up on the next navigation instead of whenever a TTL
//                      happens to lapse. The API answers these with a ~200 byte
//                      304 when nothing changed (ETag), so they are close to free.
//
//   no entry           exactly the old behaviour: skeletons, then data.
//
// Two rules for callers:
//   1. The key must encode everything `deps` does. `catalog:products:all::popular`
//      changes when the category or the search term changes; a key that did not
//      would serve one category's products under another's.
//   2. NEVER pass a cacheKey for anything user-specific — cart, orders, profile,
//      any /admin read. Those are per-person and several of them are per-token.
//      The whole cache is public-catalogue-only by construction.
//
// `reload()` always forces a real request and ignores the cache, so every "dobara
// koshish karein" button still means what it says.
//
// Note this hook now reads react-router's navigation type, so it must be used
// inside the Router — which every caller in this app already is.
export function useAsync(fn, deps = [], options = {}) {
  const { retries = 0, retryDelay = 900, cacheKey = null } = options

  // A Back/Forward into a page this session has already shown. See
  // useRestoreNavigation for why this is not simply `navType === 'POP'`.
  const isRestore = useRestoreNavigation()

  // Held in a ref rather than folded into `run`'s dependencies. Components that
  // live OUTSIDE the routed area (the footer's category list, for one) are not
  // re-mounted by a navigation, so making `run` change identity with the
  // navigation type would fire a fresh read from them on every route change —
  // requests nobody asked for. The layout effect lands before the passive effect
  // that calls `run`, so the value is always current when it matters.
  const restoreRef = useRef(isRestore)
  useLayoutEffect(() => {
    restoreRef.current = isRestore
  }, [isRestore])

  // Seeded synchronously so a cache hit paints DATA on the first frame. Deriving
  // it in an effect instead would paint skeletons first and swap a frame later —
  // the flash this whole mechanism exists to remove.
  const [state, setState] = useState(() => seedFor(cacheKey, isRestore))
  const [seededKey, setSeededKey] = useState(cacheKey)
  const runId = useRef(0)
  const timer = useRef(null)

  // A render-phase update: when the key changes (a new category, a new product
  // id) React re-renders immediately with the new seed BEFORE committing, so the
  // switch is as flash-free as the mount was.
  if (cacheKey !== seededKey) {
    setSeededKey(cacheKey)
    setState(seedFor(cacheKey, isRestore))
  }

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  const run = useCallback(
    // `force` skips the cache entirely (reload / a retry button).
    // `keepData` says "refetch, but leave what is on screen there" — used when
    // the cache is invalidated under a mounted page, where a skeleton would be a
    // step backwards from the perfectly good data already rendered.
    (force = false, keepData = false) => {
      const id = ++runId.current
      const current = () => runId.current === id

      clearTimer()

      const cached = cacheKey && !force ? readCache(cacheKey) : null

      if (cached) {
        // Show what we have, always — `loading` stays false so the page renders
        // its real UI rather than a skeleton. The identity check keeps the common
        // case (the seed already put this exact object on screen) from queueing a
        // render that changes nothing.
        setState((s) =>
          s.data === cached.data && !s.loading && !s.error
            ? (restoreRef.current ? s : { ...s, revalidating: true })
            : { data: cached.data, loading: false, error: null, attempt: 0, revalidating: !restoreRef.current },
        )
        // A Back/Forward into a page this session already rendered: return them
        // to it and leave it alone. Every other arrival falls through and checks.
        if (restoreRef.current) return
      } else if (keepData) {
        setState((s) =>
          s.data == null
            ? { ...s, loading: true, error: null, attempt: 0, revalidating: false }
            : { ...s, error: null, revalidating: true },
        )
      } else {
        // Left untouched on the very first run so mounting does not queue a second
        // render for a state it is already in.
        setState((s) =>
          s.loading && !s.error && s.attempt === 0
            ? s
            : { ...s, loading: true, error: null, attempt: 0, revalidating: false },
        )
      }

      const attempt = (n) => {
        Promise.resolve()
          .then(() => fn())
          .then((data) => {
            // Written even if this run has been superseded: the bytes are still
            // the newest answer for this key, and the run that replaced it is
            // about to look for exactly that.
            if (cacheKey) writeCache(cacheKey, data)
            if (current()) setState({ data, loading: false, error: null, attempt: n, revalidating: false })
          })
          .catch((error) => {
            if (!current()) return

            if (n < retries && isTransient(error)) {
              // Backed off linearly: a server coming back up needs longer than a
              // dropped packet does.
              setState((s) => ({ ...s, loading: true, error: null, attempt: n + 1 }))
              timer.current = setTimeout(() => {
                if (current()) attempt(n + 1)
              }, retryDelay * (n + 1))
              return
            }

            // A failed BACKGROUND refresh must not wipe the page. The shopper is
            // looking at data that was good a minute ago; replacing it with an
            // error because the revalidation timed out is strictly worse than
            // leaving it there. A foreground load — nothing on screen yet — still
            // reports honestly.
            setState((s) =>
              s.data != null
                ? { ...s, loading: false, error: null, attempt: n, revalidating: false }
                : { data: null, loading: false, error, attempt: n, revalidating: false },
            )
          })
      }

      attempt(0)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [...deps, cacheKey],
  )

  useEffect(() => {
    run()
    return () => {
      runId.current += 1
      clearTimer()
    }
  }, [run])

  // Re-read in place when this key's cached data is thrown away underneath us —
  // an admin saving in another tab of the same app, a checkout that moved stock,
  // or the server reporting a new catalogue version. `keepData` means the page
  // keeps showing what it has until the new answer lands, so this looks like a
  // value quietly updating rather than the page reloading itself.
  const runRef = useRef(run)
  runRef.current = run
  useEffect(() => {
    if (!cacheKey) return undefined
    return subscribeToInvalidation((prefix) => {
      if (!prefix || cacheKey.startsWith(prefix)) runRef.current(true, true)
    })
  }, [cacheKey])

  // Always a real request: this is what the error state's retry button and the
  // "refresh" affordances call, and they must never be answered from a cache.
  const reload = useCallback(() => run(true), [run])

  // `revalidating` (from state) is true while a cached view is being refreshed
  // behind the shopper's back — data is on screen, a request is in flight.
  return { ...state, retrying: state.loading && state.attempt > 0, reload }
}

function seedFor(cacheKey, isRestore) {
  const cached = cacheKey ? readCache(cacheKey) : null
  if (!cached) return idleState
  return {
    data: cached.data,
    loading: false,
    error: null,
    attempt: 0,
    revalidating: !isRestore,
  }
}
