import { useCallback, useEffect, useRef, useState } from 'react'

// Generic async-data hook → { data, loading, error, reload }.
// `fn` is an async function; `deps` re-run it (like useEffect deps).
//
// Every call is stamped with a monotonic id and only the newest one may write
// state. That kills two races: a slow first response overwriting a newer
// reload(), and an unmounted/re-run effect landing on dead state. The effect
// cleanup bumps the id, so an in-flight request is invalidated on unmount or
// when deps change.
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const runId = useRef(0)

  const run = useCallback(() => {
    const id = ++runId.current
    const current = () => runId.current === id
    setState((s) => (s.loading && !s.error ? s : { ...s, loading: true, error: null }))
    Promise.resolve()
      .then(() => fn())
      .then((data) => { if (current()) setState({ data, loading: false, error: null }) })
      .catch((error) => { if (current()) setState({ data: null, loading: false, error }) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    run()
    return () => { runId.current += 1 }
  }, [run])

  return { ...state, reload: run }
}
