import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import {
  MagnifyingGlass,
  ArrowRight,
  Receipt,
  Plus,
  FadersHorizontal,
  Funnel,
  CalendarBlank,
  CaretDown,
  Check,
  CircleNotch,
  Pulse,
  ArrowsClockwise,
  X,
} from '@phosphor-icons/react'
import { listOrders, updateOrderStatus } from '../../api/admin'
import { useAsync } from '../../hooks/useAsync'
import { useNotify } from '../../context/NotifyContext'
import { money } from '../../lib/cartEngine'
import { AdminTitle, Loader, Card, StatusBadge, STATUSES, Btn, ErrorCard, statusMeta } from '../../components/admin/ui'
import { SourceBadge } from '../../components/admin/SourceBadge'

const SOURCE_META = {
  admin: { title: 'Dashboard Orders', subtitle: 'Admin panel se banaye gaye orders' },
  website: { title: 'Website Orders', subtitle: 'Customers ne website se kiye orders' },
  all: { title: 'All Orders', subtitle: 'Tamam customer orders, status aur tafseelat' },
}

const statusHex = {
  pending: '#c7a05b',
  confirmed: '#3b82f6',
  packed: '#6366f1',
  shipped: '#a855f7',
  delivered: '#1fa855',
  cancelled: '#c9b89f',
}

const QUICK_RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
]

const ymd = (d) => {
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}
function computeRange(key) {
  const today = ymd(new Date())
  const minus = (n) => {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return ymd(d)
  }
  switch (key) {
    case 'today': return [today, today]
    case 'yesterday': return [minus(1), minus(1)]
    case 'last7': return [minus(6), today]
    case 'last30': return [minus(29), today]
    case 'month': {
      const d = new Date()
      return [ymd(new Date(d.getFullYear(), d.getMonth(), 1)), today]
    }
    default: return ['', '']
  }
}

// ---------------------------------------------------------------------------
// Premium status dropdown (filter) — colored dots, "All" default.
// ---------------------------------------------------------------------------
function StatusFilterSelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const current = value === 'all' ? 'All statuses' : statusMeta[value]?.label || value
  const options = ['all', ...STATUSES]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2.5 rounded-2xl border bg-sand-50 px-3.5 py-2.5 text-sm font-semibold text-brand-800 outline-none transition-all ${
          open ? 'border-saffron-400 bg-white ring-4 ring-saffron-100/70' : 'border-brand-200 hover:border-brand-300'
        }`}
      >
        <span
          className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-saffron-600"
        >
          <Pulse size={15} weight="bold" />
        </span>
        {value !== 'all' && (
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: statusHex[value] }} />
        )}
        <span className="flex-1 truncate text-left">{current}</span>
        <CaretDown size={14} weight="bold" className={`shrink-0 text-brand-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-brand-100 bg-white p-1.5 shadow-lift ring-1 ring-brand-100/60">
          {options.map((s) => {
            const active = s === value
            return (
              <button
                key={s}
                type="button"
                onClick={() => { onChange(s); setOpen(false) }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium capitalize transition-colors ${
                  active ? 'bg-sand-50 text-brand-900' : 'text-brand-600 hover:bg-sand-50/70'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s === 'all' ? '#a1907c' : statusHex[s] }}
                />
                <span className="flex-1">{s === 'all' ? 'All statuses' : statusMeta[s]?.label || s}</span>
                {active && <Check size={15} weight="bold" className="text-saffron-600" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline status changer for the table — updates without opening detail page.
// Menu is portalled + fixed-positioned so it never clips inside the table.
// ---------------------------------------------------------------------------
function InlineStatusSelect({ order, onChanged }) {
  const { success, error } = useNotify()
  const btnRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })

  const toggle = () => {
    if (open) return setOpen(false)
    const r = btnRef.current.getBoundingClientRect()
    const W = 200
    setCoords({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - W - 12) })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = async (s) => {
    if (s === order.status) return setOpen(false)
    setOpen(false)
    setSaving(true)
    try {
      await updateOrderStatus(order.id, s)
      onChanged(order.id, s)
      success(`${order.code} → ${statusMeta[s]?.label || s}`)
    } catch {
      error('Status update nahi hua')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        disabled={saving}
        title="Status badlein"
        className="group inline-flex items-center gap-1.5 rounded-full p-0.5 pr-1.5 transition-colors hover:bg-sand-100/70 disabled:opacity-60"
      >
        <StatusBadge status={order.status} />
        {saving ? (
          <CircleNotch size={13} weight="bold" className="animate-spin text-brand-400" />
        ) : (
          <CaretDown size={12} weight="bold" className="text-brand-300 transition-colors group-hover:text-brand-600" />
        )}
      </button>
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
            <div
              style={{ top: coords.top, left: coords.left, width: 200 }}
              className="fixed z-[91] animate-fade-up overflow-hidden rounded-2xl border border-brand-100 bg-white p-1.5 shadow-lift ring-1 ring-brand-100/60"
            >
              <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-300">Set status</p>
              {STATUSES.map((s) => {
                const active = s === order.status
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => pick(s)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium capitalize transition-colors ${
                      active ? 'bg-sand-50 text-brand-900' : 'text-brand-600 hover:bg-sand-50/70'
                    }`}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: statusHex[s] }} />
                    <span className="flex-1">{statusMeta[s]?.label || s}</span>
                    {active && <Check size={15} weight="bold" className="text-saffron-600" />}
                  </button>
                )
              })}
            </div>
          </>,
          document.body,
        )}
    </>
  )
}

// Tiny field shell — uppercase label + control (mirrors the reference design).
function FilterField({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-brand-400">{label}</label>
      {children}
    </div>
  )
}

export default function AdminOrders() {
  const [params] = useSearchParams()
  const source = ['admin', 'website'].includes(params.get('source')) ? params.get('source') : 'all'

  // committed (drive fetch / filtering)
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [activeRange, setActiveRange] = useState('')
  // draft (search box before Apply)
  const [qDraft, setQDraft] = useState('')

  const { data: all, loading, error, reload } = useAsync(() => listOrders({ status, q: search }), [status, search])

  // local status overrides so inline changes reflect instantly without a refetch.
  const [overrides, setOverrides] = useState({})
  useEffect(() => { setOverrides({}) }, [all])

  const dateOk = (o) => {
    if (!from && !to) return true
    const d = (o.placed_at || '').slice(0, 10)
    if (!d) return false
    if (from && d < from) return false
    if (to && d > to) return false
    return true
  }

  const merged = (all || []).map((o) => (overrides[o.id] ? { ...o, status: overrides[o.id] } : o))
  const data = merged.filter((o) => (source === 'all' || o.source === source) && dateOk(o))
  const meta = SOURCE_META[source]

  const apply = () => setSearch(qDraft.trim())
  const pickRange = (key) => {
    if (activeRange === key) { setActiveRange(''); setFrom(''); setTo(''); return }
    const [f, t] = computeRange(key)
    setFrom(f); setTo(t); setActiveRange(key)
  }
  const setFromManual = (v) => { setFrom(v); setActiveRange('') }
  const setToManual = (v) => { setTo(v); setActiveRange('') }
  const reset = () => {
    setStatus('all'); setSearch(''); setQDraft(''); setFrom(''); setTo(''); setActiveRange('')
  }

  const activeCount = (status !== 'all' ? 1 : 0) + (search ? 1 : 0) + (from || to ? 1 : 0)

  return (
    <>
      <AdminTitle eyebrow="Orders" icon={Receipt} title={meta.title} subtitle={meta.subtitle}>
        <Btn as={Link} to="/admin/orders/new">
          <Plus size={17} weight="bold" /> Naya order
        </Btn>
      </AdminTitle>

      {/* ====================== PREMIUM FILTER PANEL ====================== */}
      <Card className="mb-5">
        {/* header */}
        <div className="flex items-center gap-3.5 p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-saffron-50 to-saffron-100 text-saffron-600 ring-1 ring-saffron-200/70">
            <FadersHorizontal size={20} weight="bold" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-brand-900">Refine results</h3>
            <p className="text-xs text-brand-400">Search, status &amp; date range</p>
          </div>
          {activeCount > 0 && (
            <button
              onClick={reset}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3.5 py-1.5 text-xs font-bold text-brand-600 transition-all hover:border-saffron-300 hover:text-saffron-700 active:scale-95"
            >
              <ArrowsClockwise size={13} weight="bold" /> Reset
            </button>
          )}
        </div>

        {/* quick range chips */}
        <div className="flex flex-wrap items-center gap-2 border-t border-brand-100/70 px-5 py-4">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-400">Quick range</span>
          {QUICK_RANGES.map((r) => {
            const on = activeRange === r.key
            return (
              <button
                key={r.key}
                onClick={() => pickRange(r.key)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                  on
                    ? 'bg-brand-900 text-white shadow-soft ring-1 ring-brand-900'
                    : 'bg-sand-50 text-brand-600 ring-1 ring-brand-100 hover:bg-sand-100 hover:text-brand-800'
                }`}
              >
                {r.label}
              </button>
            )
          })}
        </div>

        {/* fields */}
        <div className="grid gap-3 border-t border-dashed border-brand-200/70 px-5 py-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto] lg:items-end">
          <FilterField label="Customer">
            <form onSubmit={(e) => { e.preventDefault(); apply() }} className="relative">
              <MagnifyingGlass size={17} weight="bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400" />
              <input
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                placeholder="Search by name or shop"
                className="w-full rounded-2xl border border-brand-200 bg-sand-50 py-2.5 pl-10 pr-3 text-sm text-brand-900 outline-none transition-all placeholder:text-brand-300 focus:border-saffron-400 focus:bg-white focus:ring-4 focus:ring-saffron-100/70"
              />
            </form>
          </FilterField>

          <FilterField label="Workflow status">
            <StatusFilterSelect value={status} onChange={setStatus} />
          </FilterField>

          <FilterField label="From date">
            <div className="relative">
              <CalendarBlank size={16} weight="bold" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400" />
              <input
                type="date"
                value={from}
                onChange={(e) => setFromManual(e.target.value)}
                className="w-full rounded-2xl border border-brand-200 bg-sand-50 py-2.5 pl-10 pr-2 text-sm text-brand-700 outline-none transition-all focus:border-saffron-400 focus:bg-white focus:ring-4 focus:ring-saffron-100/70"
              />
            </div>
          </FilterField>

          <FilterField label="To date">
            <div className="relative">
              <CalendarBlank size={16} weight="bold" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400" />
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setToManual(e.target.value)}
                className="w-full rounded-2xl border border-brand-200 bg-sand-50 py-2.5 pl-10 pr-2 text-sm text-brand-700 outline-none transition-all focus:border-saffron-400 focus:bg-white focus:ring-4 focus:ring-saffron-100/70"
              />
            </div>
          </FilterField>

          <button
            onClick={apply}
            className="group inline-flex h-[42px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-saffron-500 to-saffron-600 px-6 text-sm font-bold text-white shadow-soft ring-1 ring-saffron-600/20 transition-all hover:-translate-y-0.5 hover:shadow-glow active:translate-y-0"
          >
            <Funnel size={16} weight="fill" /> Apply
          </button>
        </div>
      </Card>

      {/* results meta bar */}
      {!loading && !error && (
        <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
          <p className="text-sm text-brand-500">
            <b className="font-bold text-brand-900">{data.length}</b> order{data.length === 1 ? '' : 's'} mile
          </p>
          {status !== 'all' && (
            <FilterPill onClear={() => setStatus('all')}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusHex[status] }} />
              {statusMeta[status]?.label || status}
            </FilterPill>
          )}
          {search && <FilterPill onClear={() => { setSearch(''); setQDraft('') }}>“{search}”</FilterPill>}
          {(from || to) && (
            <FilterPill onClear={() => { setFrom(''); setTo(''); setActiveRange('') }}>
              <CalendarBlank size={12} weight="bold" /> {from || '…'} → {to || '…'}
            </FilterPill>
          )}
        </div>
      )}

      {loading && <Loader />}
      {!loading && error && <ErrorCard message="Orders load nahi huye" onRetry={reload} />}

      {!loading && !error && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-100 bg-sand-50/40 text-left text-xs font-semibold uppercase tracking-wider text-brand-400">
                  <th className="px-5 py-3.5">Order</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Source</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Total</th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody>
                {data.map((o) => (
                  <tr key={o.id} className="border-b border-brand-50 transition-colors hover:bg-sand-50/70">
                    <td className="px-5 py-3.5 font-bold text-brand-900">{o.code}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-brand-800">{o.customer_name}</p>
                      <p className="text-xs text-brand-400">{o.customer_phone}</p>
                    </td>
                    <td className="px-5 py-3.5 text-brand-500">{(o.placed_at || '').slice(0, 10)}</td>
                    <td className="px-5 py-3.5"><SourceBadge source={o.source} size="sm" /></td>
                    <td className="px-5 py-3.5"><InlineStatusSelect order={o} onChanged={(id, s) => setOverrides((p) => ({ ...p, [id]: s }))} /></td>
                    <td className="px-5 py-3.5 text-right font-bold tabular-nums text-brand-800">{money(o.total)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Link to={`/admin/orders/${o.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-900">
                        Kholein <ArrowRight size={14} weight="bold" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center text-brand-400">
                      <Receipt size={32} className="mx-auto" />
                      <p className="mt-2">Koi order nahi mila.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}

function FilterPill({ children, onClear }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
      <span className="inline-flex items-center gap-1.5 capitalize">{children}</span>
      <button onClick={onClear} aria-label="Hatao" className="grid h-4 w-4 place-items-center rounded-full text-brand-400 transition-colors hover:bg-brand-200 hover:text-brand-700">
        <X size={11} weight="bold" />
      </button>
    </span>
  )
}
