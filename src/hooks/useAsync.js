import { useCallback, useEffect, useState } from 'react'

// Generic async-data hook → { data, loading, error, reload }.
// `fn` is an async function; `deps` re-run it (like useEffect deps).
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })

  const run = useCallback(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    Promise.resolve(fn())
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState({ data: null, loading: false, error }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => run(), [run])

  const reload = useCallback(() => run(), [run])
  return { ...state, reload }
}
