import { useCallback, useEffect, useRef, useState } from 'react'

// A blip worth retrying silently rather than reporting: the connection dropped,
// the request timed out, or the server returned a 5xx. A 404 or a 401 is a real
// answer — retrying those just delays telling the truth.
const isTransient = (e) =>
  e?.code === 'NETWORK' || e?.code === 'TIMEOUT' || (e?.status >= 500 && e?.status < 600)

// Generic async-data hook → { data, loading, error, retrying, attempt, reload }.
// `fn` is an async function; `deps` re-run it (like useEffect deps).
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
export function useAsync(fn, deps = [], options = {}) {
  const { retries = 0, retryDelay = 900 } = options
  const [state, setState] = useState({ data: null, loading: true, error: null, attempt: 0 })
  const runId = useRef(0)
  const timer = useRef(null)

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  const run = useCallback(() => {
    const id = ++runId.current
    const current = () => runId.current === id

    clearTimer()
    // Left untouched on the very first run so mounting does not queue a second
    // render for a state it is already in.
    setState((s) =>
      s.loading && !s.error && s.attempt === 0
        ? s
        : { ...s, loading: true, error: null, attempt: 0 },
    )

    const attempt = (n) => {
      Promise.resolve()
        .then(() => fn())
        .then((data) => {
          if (current()) setState({ data, loading: false, error: null, attempt: n })
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

          setState({ data: null, loading: false, error, attempt: n })
        })
    }

    attempt(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    run()
    return () => {
      runId.current += 1
      clearTimer()
    }
  }, [run])

  return { ...state, retrying: state.loading && state.attempt > 0, reload: run }
}
