import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Reset scroll position on every route change (ignores in-page hash links).
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' in window ? 'instant' : 'auto' })
  }, [pathname, hash])
  return null
}
