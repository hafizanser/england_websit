import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, Receipt, Star, CircleNotch, BellSlash } from '@phosphor-icons/react'
import { adminNotifications } from '../../api/reviews'

const SEEN_KEY = 'barkat.admin.notif.seen'

const TYPE = {
  order: { icon: Receipt, cls: 'bg-brand-100 text-brand-700' },
  review: { icon: Star, cls: 'bg-saffron-100 text-saffron-700' },
}

function timeAgo(d) {
  if (!d) return ''
  const t = new Date(String(d).replace(' ', 'T')).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Math.max(0, Date.now() - t)
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'abhi'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function NotificationBell({ dark = false }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [seen, setSeen] = useState(() => { try { return localStorage.getItem(SEEN_KEY) || '' } catch { return '' } })
  const ref = useRef(null)

  const load = async () => {
    setLoading(true)
    try { const res = await adminNotifications(); setItems(res?.items || []) } catch { /* ignore */ } finally { setLoading(false) }
  }
  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (!open) return
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', esc) }
  }, [open])

  const unread = items.filter((i) => String(i.time || '') > seen).length

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && items[0]?.time) {
      const t = String(items[0].time)
      setSeen(t)
      try { localStorage.setItem(SEEN_KEY, t) } catch { /* ignore */ }
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        className={`relative grid h-10 w-10 place-items-center rounded-xl transition-colors ${
          dark
            ? 'bg-white/10 text-white hover:bg-white/20'
            : 'border border-brand-200 bg-white text-brand-700 hover:border-saffron-300 hover:text-saffron-700'
        }`}
      >
        <Bell size={19} weight={unread > 0 ? 'fill' : 'bold'} />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-saffron-500 px-1 text-[11px] font-extrabold text-white ring-2 ring-white"
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-lift ring-1 ring-brand-100/60"
          >
            <div className="flex items-center justify-between border-b border-brand-100 px-4 py-3">
              <p className="text-sm font-extrabold text-brand-900">Notifications</p>
              {loading && <CircleNotch size={15} className="animate-spin text-brand-400" />}
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {items.length === 0 && !loading && (
                <div className="grid place-items-center px-6 py-10 text-center text-brand-400">
                  <BellSlash size={28} weight="duotone" />
                  <p className="mt-2 text-sm">Abhi koi notification nahi</p>
                </div>
              )}
              {items.map((n, i) => {
                const meta = TYPE[n.type] || TYPE.order
                const fresh = String(n.time || '') > seen
                return (
                  <Link
                    key={i}
                    to={n.link || '#'}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-sand-50"
                  >
                    <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${meta.cls}`}>
                      <meta.icon size={17} weight="fill" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-bold text-brand-900">
                        {n.title}
                        {fresh && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-saffron-500" />}
                      </p>
                      <p className="truncate text-xs text-brand-500">{n.text}</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-brand-300">{timeAgo(n.time)}</span>
                  </Link>
                )
              })}
            </div>

            <Link
              to="/admin/orders"
              onClick={() => setOpen(false)}
              className="block border-t border-brand-100 px-4 py-2.5 text-center text-xs font-bold text-brand-600 hover:bg-sand-50"
            >
              Saari activity dekhein
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
