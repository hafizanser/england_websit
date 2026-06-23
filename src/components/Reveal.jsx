import { useEffect, useRef, useState } from 'react'

// Scroll-reveal wrapper (self-observing, works with async content). Shared by the
// homepage and the reusable OffersSection so the .eng reveal animation stays
// identical in both places.
export function Reveal({ as: C = 'div', className = '', children, ...rest }) {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold: 0.12 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <C ref={ref} className={`reveal${seen ? ' in' : ''}${className ? ' ' + className : ''}`} {...rest}>{children}</C>
}

// Small checkmark icon used across the .eng theme (trust rows, offer benefits).
export const Check = (p) => (<svg className="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5" /></svg>)
