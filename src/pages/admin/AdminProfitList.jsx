import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import {
  Eye,
  EyeSlash,
  TrendUp,
  Wallet,
  ChartBar,
  ChartLineUp,
  Receipt,
  CalendarBlank,
  ArrowRight,
  ArrowsClockwise,
  Funnel,
  Storefront,
  CircleNotch,
  Trophy,
  Coins,
} from '@phosphor-icons/react'
import { Card, Loader } from '../../components/admin/ui'
import { getProfitOrders } from '../../api/admin'
import { money } from '../../lib/cartEngine'
import { useNotify } from '../../context/NotifyContext'

// --- date helpers (local, no deps) -----------------------------------------
const pad = (n) => String(n).padStart(2, '0')
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function presetRange(key) {
  const today = new Date()
  if (key === 'today') return { from: fmt(today), to: fmt(today) }
  if (key === '7d') {
    const s = new Date(today)
    s.setDate(today.getDate() - 6)
    return { from: fmt(s), to: fmt(today) }
  }
  if (key === '30d') {
    const s = new Date(today)
    s.setDate(today.getDate() - 29)
    return { from: fmt(s), to: fmt(today) }
  }
  if (key === 'month') {
    const s = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: fmt(s), to: fmt(today) }
  }
  return { from: '', to: '' } // all time
}

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
]

const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '—'

// Reference table renders dates as "May 27, 2026" + "04:53 AM".
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(s) {
  if (!s) return { date: '—', time: '' }
  const [d, t = ''] = String(s).split(' ')
  const [y, m, day] = d.split('-')
  const date = `${MONTHS[Number(m) - 1] || ''} ${Number(day)}, ${y}`
  let time = ''
  if (t) {
    const [hh, mm] = t.split(':')
    let h = Number(hh)
    const ap = h >= 12 ? 'PM' : 'AM'
    h = h % 12 || 12
    time = `${pad(h)}:${mm} ${ap}`
  }
  return { date, time }
}

// Colourful per-row avatar gradients, deterministic by order id (matches reference).
const AVATARS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-green-600',
  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',
  'from-cyan-500 to-sky-600',
]
const avatarCls = (id) => AVATARS[Math.abs(Number(id) || 0) % AVATARS.length]

const SOURCE_META = {
  website: { label: 'Website', cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  admin: { label: 'Dashboard', cls: 'bg-sand-100 text-brand-600 ring-brand-200' },
}

export default function AdminProfitList() {
  const { error } = useNotify()
  // PIN verified by ProfitGuard (memory-only). The guard guarantees we only
  // render once unlocked, so there is no local PIN screen here anymore.
  const { profitPin, relock } = useOutletContext()

  const [preset, setPreset] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [draftFrom, setDraftFrom] = useState('')
  const [draftTo, setDraftTo] = useState('')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hideProfit, setHideProfit] = useState(true)

  const applyFilter = async (f, t) => {
    setLoading(true)
    try {
      const res = await getProfitOrders({ pin: profitPin, from: f, to: t })
      setData(res)
    } catch (err) {
      // A rejected PIN re-locks the whole section (handled by ProfitGuard).
      if (err.status === 401) relock()
      else error(err.message || 'Load nahi hua')
    } finally {
      setLoading(false)
    }
  }

  const selectPreset = (key) => {
    const { from: f, to: t } = presetRange(key)
    setPreset(key)
    setFrom(f)
    setTo(t)
    setDraftFrom(f)
    setDraftTo(t)
    applyFilter(f, t)
  }

  const applyCustom = (e) => {
    e.preventDefault()
    setPreset('custom')
    setFrom(draftFrom)
    setTo(draftTo)
    applyFilter(draftFrom, draftTo)
  }

  // Initial all-time load once the PIN is verified.
  useEffect(() => {
    applyFilter('', '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading && !data) return <Loader label="Profit analytics load ho raha hai..." />

  const orders = data?.orders || []
  const s = data?.summary || {}
  const rangeLabel = from && to ? `${from} → ${to}` : from ? `From ${from}` : to ? `Until ${to}` : 'All Time'

  return (
    <>
      {/* ============================== HEADER ============================== */}
      <div className="mb-6 flex animate-fade-up flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="relative mt-0.5 grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[1.1rem] bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 text-saffron-300 shadow-soft ring-1 ring-white/10">
            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_70%_at_30%_20%,rgba(199,160,91,0.4),transparent_70%)]" />
            <ChartLineUp size={22} weight="fill" className="relative" />
          </span>
          <div>
            <p className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-saffron-600">
              <span className="h-1 w-1 rounded-full bg-saffron-500" /> Finance
            </p>
            <h1 className="font-display text-[1.75rem] font-extrabold leading-none tracking-tight text-brand-950 sm:text-[2.1rem]">
              Profit Analytics
            </h1>
            <p className="mt-2 text-sm text-brand-500">Detailed breakdown of earnings and performance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sand-100 px-3 py-1.5 text-xs font-semibold text-brand-500">
              <CircleNotch size={14} className="animate-spin" /> Updating…
            </span>
          )}
          <button
            type="button"
            onClick={() => setHideProfit((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3.5 py-2 text-xs font-bold text-brand-600 transition-all hover:border-brand-300 hover:bg-sand-50 active:scale-95"
          >
            {hideProfit ? <Eye size={14} weight="bold" /> : <EyeSlash size={14} weight="bold" />}
            {hideProfit ? 'Show profit' : 'Hide profit'}
          </button>
        </div>
      </div>

      {/* ============================== KPI GRID ============================== */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Accumulated profit (hero, dark) */}
        <div
          className="group relative animate-fade-up overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-900 p-6 text-white shadow-kpi ring-1 ring-white/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-kpihover"
          style={{ animationDelay: '0ms' }}
        >
          <span className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-saffron-400/20 blur-3xl transition-opacity duration-500 group-hover:opacity-150" />
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-saffron-300/50 to-transparent" />
          <div className="relative flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/55">Accumulated Profit</p>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-saffron-300 ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
              <Coins size={19} weight="fill" />
            </span>
          </div>
          <div className="relative mt-3 flex items-end gap-2.5">
            <p className="font-display text-[2rem] font-extrabold leading-none tracking-tight tabular-nums">
              {hideProfit ? <span className="tracking-[0.12em] text-saffron-300/90">Rs ••••••</span> : money(s.grand_profit || 0)}
            </p>
            <button
              type="button"
              onClick={() => setHideProfit((v) => !v)}
              aria-label={hideProfit ? 'Show profit' : 'Hide profit'}
              className="mb-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
            >
              {hideProfit ? <EyeSlash size={15} weight="bold" /> : <Eye size={15} weight="bold" />}
            </button>
          </div>
          <div className="relative mt-3.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron-400/15 px-2.5 py-1 text-xs font-bold text-saffron-200 ring-1 ring-saffron-300/20">
              <TrendUp size={13} weight="bold" /> {s.profit_margin ?? 0}% margin
            </span>
            <span className="text-[11px] text-white/45">Retail − production cost</span>
          </div>
        </div>

        <StatTile index={1} icon={Wallet} tint="bg-brand-50 text-brand-700" label="Lifetime Revenue" value={money(s.total_revenue || 0)} hint={`${s.orders_count ?? 0} orders in selection`} />
        <StatTile index={2} icon={ChartBar} tint="bg-saffron-100 text-saffron-700" label="Avg. Order Value" value={money(s.avg_order_value || 0)} hint="Mean revenue per order" />
        <StatTile index={3} icon={Trophy} tint="bg-wa-50 text-wa-600" label="Highest Order" value={money(s.highest_order || 0)} hint="Largest single order" />
      </div>

      {/* ============================ FILTER TOOLBAR ============================ */}
      {/* One aligned row on desktop (xl); cleanly stacked on tablet/mobile. The
          actions group is nowrap on desktop so Reset never drops to its own line. */}
      <Card className="mb-6">
        <div className="flex flex-col gap-3 p-3 sm:p-4 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
          {/* presets — segmented control */}
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 sm:grid">
              <Funnel size={17} weight="fill" />
            </span>
            <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-2xl bg-sand-100 p-1 ring-1 ring-brand-100/70">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => selectPreset(p.key)}
                  className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition-all duration-200 active:scale-95 ${
                    preset === p.key
                      ? 'bg-white text-brand-900 shadow-soft ring-1 ring-brand-100'
                      : 'text-brand-500 hover:text-brand-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* date range picker + actions */}
          <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap xl:shrink-0">
            <form onSubmit={applyCustom} className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
              <div className="flex items-center gap-1.5 rounded-2xl border border-brand-200 bg-sand-50 px-3 py-1.5 transition-colors focus-within:border-saffron-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-saffron-100/60">
                <CalendarBlank size={15} weight="fill" className="shrink-0 text-brand-400" />
                <input
                  type="date"
                  value={draftFrom}
                  onChange={(e) => setDraftFrom(e.target.value)}
                  aria-label="From date"
                  className="w-[7.25rem] bg-transparent text-sm text-brand-800 outline-none [color-scheme:light]"
                />
                <span className="text-brand-300">–</span>
                <input
                  type="date"
                  value={draftTo}
                  min={draftFrom || undefined}
                  onChange={(e) => setDraftTo(e.target.value)}
                  aria-label="To date"
                  className="w-[7.25rem] bg-transparent text-sm text-brand-800 outline-none [color-scheme:light]"
                />
              </div>
              <button
                type="submit"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-gradient-to-br from-saffron-400 to-saffron-500 px-4 py-2.5 text-sm font-bold text-brand-950 shadow-soft ring-1 ring-saffron-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow active:translate-y-0"
              >
                Apply <ArrowRight size={15} weight="bold" />
              </button>
            </form>
            <button
              type="button"
              onClick={() => selectPreset('all')}
              title="Reset to All Time"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-brand-200 bg-white px-4 py-2.5 text-sm font-bold text-brand-600 transition-all duration-200 hover:border-saffron-300 hover:text-saffron-700 active:scale-95"
            >
              <ArrowsClockwise size={15} weight="bold" /> Reset
            </button>
          </div>
        </div>
      </Card>

      {/* ============================ REVENUE CHART ============================ */}
      <RevenueChart orders={orders} rangeLabel={rangeLabel} highest={s.highest_order || 0} />

      {/* ============================ ORDER BREAKDOWN ============================ */}
      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-brand-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Receipt size={18} weight="fill" />
            </span>
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-brand-900">Order Breakdown</h2>
              <p className="text-xs text-brand-400">Per-order earnings, ranked by most recent</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-sand-100 px-3 py-1 text-xs font-bold text-brand-600 ring-1 ring-brand-100">
            {orders.length} record{orders.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-100 bg-sand-50/40 text-left text-xs font-semibold uppercase tracking-wider text-brand-400">
                <th className="px-5 py-3.5">Order</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Shop / Branch</th>
                <th className="px-5 py-3.5 text-right">Total Amount</th>
                <th className="px-5 py-3.5">Order Date</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => {
                const dt = fmtDate(o.order_date)
                const src = SOURCE_META[String(o.order_source || '').toLowerCase()]
                return (
                  <tr
                    key={o.order_id}
                    className="animate-fade-up border-b border-brand-50 transition-colors hover:bg-sand-50/70"
                    style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                  >
                    <td className="px-5 py-3.5 font-bold tabular-nums text-brand-900">ENG-{1000 + Number(o.order_id)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${avatarCls(
                            o.order_id,
                          )} text-xs font-extrabold text-white shadow-soft`}
                        >
                          {initials(o.customer_name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-brand-900">{o.customer_name || '—'}</p>
                          {src && (
                            <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-bold ring-1 ${src.cls}`}>
                              {src.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-brand-600">
                      <span className="inline-flex items-center gap-1.5">
                        <Storefront size={14} weight="fill" className="text-brand-300" /> {o.shop_name || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold tabular-nums text-brand-800">
                      {money(o.total_amount)}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-brand-700">{dt.date}</p>
                      <p className="text-xs text-brand-400">{dt.time}</p>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        to={`/admin/profits/${o.order_id}`}
                        className="group/btn inline-flex items-center gap-1.5 rounded-full bg-saffron-400 px-3.5 py-1.5 text-xs font-bold text-brand-950 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:bg-saffron-500 active:translate-y-0"
                      >
                        Breakdown <ArrowRight size={13} weight="bold" className="transition-transform duration-200 group-hover/btn:translate-x-0.5" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-brand-400">
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-sand-50 text-brand-300 ring-1 ring-brand-100">
                      <Receipt size={26} weight="duotone" />
                    </span>
                    <p className="mt-3 font-semibold text-brand-600">Is range mein koi order nahi.</p>
                    <p className="mt-1 text-xs text-brand-400">Dusra date range chunein ya filter reset karein.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------------
// KPI tile — light surface, gradient icon, big display number, hover lift.
// ---------------------------------------------------------------------------
function StatTile({ icon: Icon, label, value, tint, hint, index = 0 }) {
  return (
    <div
      style={{ animationDelay: `${index * 70}ms` }}
      className="group relative animate-fade-up overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-b from-white via-white to-sand-50/70 p-6 shadow-kpi ring-1 ring-brand-100/40 transition-all duration-300 hover:-translate-y-1 hover:border-saffron-200 hover:shadow-kpihover"
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
      <span className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(199,160,91,0.14),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">{label}</p>
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${tint} shadow-ring ring-1 ring-white/40 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}>
          <Icon size={19} weight="fill" />
        </span>
      </div>
      <p className="relative mt-3 font-display text-[1.7rem] font-extrabold leading-none tracking-tight text-brand-950 tabular-nums">{value}</p>
      {hint && <p className="relative mt-2 text-[11px] text-brand-400">{hint}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Revenue chart — animated bars of revenue across the most recent orders in the
// current selection. Pure presentation over existing data (no profit exposed,
// so it stays visible regardless of the hide-profit toggle).
// ---------------------------------------------------------------------------
function RevenueChart({ orders, rangeLabel, highest }) {
  const pts = [...orders].slice(0, 16).reverse() // oldest → newest of the most recent 16
  const max = Math.max(1, ...pts.map((o) => Number(o.total_amount) || 0))
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <ChartLineUp size={18} weight="fill" />
          </span>
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-brand-900">Revenue Overview</h2>
            <p className="text-xs text-brand-400">Revenue across recent orders</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sand-100 px-3 py-1 text-[11px] font-bold text-brand-600 ring-1 ring-brand-100">
            <CalendarBlank size={12} weight="fill" /> {rangeLabel}
          </span>
          <span className="hidden items-center gap-1.5 rounded-full bg-wa-50 px-3 py-1 text-[11px] font-bold text-wa-700 ring-1 ring-wa-500/20 sm:inline-flex">
            <Trophy size={12} weight="fill" /> Peak {money(highest)}
          </span>
        </div>
      </div>

      {pts.length === 0 ? (
        <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-brand-200 bg-sand-50/60 py-12 text-center">
          <ChartBar size={26} weight="duotone" className="text-brand-300" />
          <p className="mt-2 text-sm text-brand-400">Is range mein dikhane ke liye data nahi.</p>
        </div>
      ) : (
        <div className="relative mt-7">
          {/* baseline gridlines */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-40 flex-col justify-between">
            {[0, 1, 2, 3].map((g) => (
              <div key={g} className="border-t border-dashed border-brand-100" />
            ))}
          </div>
          <div className="relative flex h-40 items-end gap-1.5 sm:gap-2">
            {pts.map((o, i) => {
              const v = Number(o.total_amount) || 0
              const h = Math.max(3, (v / max) * 100)
              const isPeak = v === max
              return (
                <div key={o.order_id} className="group/bar flex flex-1 flex-col items-center">
                  <div className="relative flex w-full flex-1 items-end">
                    <div
                      className={`w-full origin-bottom rounded-t-md shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition-all duration-300 ${
                        isPeak
                          ? 'bg-gradient-to-t from-saffron-600 to-saffron-300'
                          : 'bg-gradient-to-t from-brand-700 to-brand-400 group-hover/bar:from-saffron-500 group-hover/bar:to-saffron-300'
                      }`}
                      style={{ height: `${h}%`, animation: `grow-y 0.7s cubic-bezier(0.16,1,0.3,1) ${i * 45}ms both` }}
                    />
                    <span className="pointer-events-none absolute -top-10 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-brand-950 px-2.5 py-1.5 text-[10px] font-bold text-white opacity-0 shadow-lift ring-1 ring-white/10 transition-opacity duration-200 group-hover/bar:opacity-100">
                      ENG-{1000 + Number(o.order_id)} · {money(v)}
                      <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-brand-950" />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}
