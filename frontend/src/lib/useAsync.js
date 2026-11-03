import { useCallback, useEffect, useState } from 'react'

// Load data on mount / when deps change. Returns { data, error, loading, reload, setData }.
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const run = useCallback(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    fn()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, error, loading: false }))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(run, [run])
  const setData = (data) => setState((s) => ({ ...s, data: typeof data === 'function' ? data(s.data) : data }))
  return { ...state, reload: run, setData }
}
