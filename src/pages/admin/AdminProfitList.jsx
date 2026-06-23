import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Eye,
  EyeSlash,
  TrendUp,
  Wallet,
  ChartBar,
  Receipt,
  CalendarBlank,
  ArrowRight,
  CircleNotch,
  Trophy,
  Coins,
} from '@phosphor-icons/react'
import { AdminTitle, Card } from '../../components/admin/ui'
import ProfitPinGate from '../../components/admin/ProfitPinGate'
import { getProfitOrders } from '../../api/admin'
import { getProfitPin, setProfitPin } from '../../lib/profitPin'
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
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
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

export default function AdminProfitList() {
  const { error } = useNotify()

  const [pin, setPin] = useState(getProfitPin())
  const [unlocked, setUnlocked] = useState(false)
  const [gateLoading, setGateLoading] = useState(false)
  const [gateError, setGateError] = useState('')

  const [preset, setPreset] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [draftFrom, setDraftFrom] = useState('')
  const [draftTo, setDraftTo] = useState('')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [hideProfit, setHideProfit] = useState(true)

  const fetchData = (p, f, t) => getProfitOrders({ pin: p, from: f, to: t })

  // Try to auto-unlock with a PIN verified earlier this session.
  useEffect(() => {
    const stored = getProfitPin()
    if (!stored) return
    let alive = true
    setGateLoading(true)
    fetchData(stored, '', '')
      .then((res) => {
        if (!alive) return
        setData(res)
        setUnlocked(true)
      })
      .catch(() => alive && setProfitPin(''))
      .finally(() => alive && setGateLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const unlock = async (e) => {
    e?.preventDefault()
    setGateError('')
    setGateLoading(true)
    try {
      const res = await fetchData(pin, from, to)
      setData(res)
      setProfitPin(pin)
      setUnlocked(true)
    } catch (err) {
      if (err.status === 401) setGateError('Ghalat PIN. Dobara koshish karein.')
      else error(err.message || 'Load nahi hua')
    } finally {
      setGateLoading(false)
    }
  }

  const applyFilter = async (f, t) => {
    setLoading(true)
    try {
      const res = await fetchData(pin, f, t)
      setData(res)
    } catch (err) {
      if (err.status === 401) {
        setUnlocked(false)
        setProfitPin('')
      } else {
        error(err.message || 'Load nahi hua')
      }
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

  if (!unlocked) {
    return (
      <ProfitPinGate
        pin={pin}
        setPin={setPin}
        onSubmit={unlock}
        error={gateError}
        loading={gateLoading}
        title="Profit Analytics"
      />
    )
  }

  const orders = data?.orders || []
  const s = data?.summary || {}
  const rangeLabel = from && to ? `${from} → ${to}` : from ? `From ${from}` : to ? `Until ${to}` : 'All time'

  return (
    <>
      <AdminTitle title="Profit Analytics" subtitle="Detailed breakdown of earnings and performance">
        {loading && <CircleNotch size={18} className="animate-spin text-brand-400" />}
      </AdminTitle>

      {/* Summary cards */}
      <div className="mb-5 grid gap-3 sm:gap-4 lg:grid-cols-3">
        {/* Accumulated profit (hero, dark) */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 to-brand-800 p-6 text-white shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/55">Accumulated Profit</p>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-saffron-300">
              <Coins size={18} weight="fill" />
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <p className="font-display text-3xl font-extrabold tracking-tight">
              {hideProfit ? <span className="tracking-[0.15em] text-saffron-300">Rs ••••••</span> : money(s.grand_profit || 0)}
            </p>
            <button
              type="button"
              onClick={() => setHideProfit((v) => !v)}
              aria-label={hideProfit ? 'Show profit' : 'Hide profit'}
              className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
            >
              {hideProfit ? <EyeSlash size={15} weight="bold" /> : <Eye size={15} weight="bold" />}
            </button>
          </div>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-saffron-200">
            <TrendUp size={13} weight="bold" /> {s.profit_margin ?? 0}% margin
          </span>
          <p className="mt-3 text-[11px] text-white/45">Net earnings · Retail − Production cost</p>
        </div>

        {/* Lifetime revenue */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">Lifetime Revenue</p>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Wallet size={18} weight="fill" />
            </span>
          </div>
          <p className="mt-2 font-display text-4xl font-extrabold tracking-tight text-brand-900 sm:text-5xl">
            {money(s.total_revenue || 0)}
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sand-100 px-2.5 py-1 text-xs font-bold text-brand-600">
            <Receipt size={13} weight="fill" /> {s.orders_count ?? 0} orders
          </span>
          <p className="mt-3 text-[11px] text-brand-400">Gross sales for current selection</p>
        </Card>

        {/* Performance snapshot */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">Performance Snapshot</p>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-saffron-100 text-saffron-700">
              <ChartBar size={18} weight="fill" />
            </span>
          </div>
          <div className="mt-3 space-y-2.5">
            <SnapRow icon={Coins} label="Avg. Order Value" value={money(s.avg_order_value || 0)} />
            <SnapRow icon={Trophy} label="Highest Order" value={money(s.highest_order || 0)} />
            <SnapRow icon={CalendarBlank} label="Date Range" value={rangeLabel} />
          </div>
        </Card>
      </div>

      {/* Date range filter */}
      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <CalendarBlank size={18} weight="fill" />
            </span>
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => selectPreset(p.key)}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition-all ${
                    preset === p.key
                      ? 'bg-brand-700 text-white shadow-soft'
                      : 'border border-brand-200 bg-white text-brand-600 hover:border-brand-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={applyCustom} className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={draftFrom}
              onChange={(e) => setDraftFrom(e.target.value)}
              className="rounded-xl border border-brand-200 bg-sand-50 px-3 py-2 text-sm text-brand-800 outline-none focus:border-brand-500 focus:bg-white"
            />
            <input
              type="date"
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
              className="rounded-xl border border-brand-200 bg-sand-50 px-3 py-2 text-sm text-brand-800 outline-none focus:border-brand-500 focus:bg-white"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full bg-saffron-400 px-4 py-2 text-sm font-bold text-brand-950 shadow-soft transition-colors hover:bg-saffron-500"
            >
              Apply <ArrowRight size={15} weight="bold" />
            </button>
            <button
              type="button"
              onClick={() => selectPreset('all')}
              className="rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-bold text-brand-600 hover:bg-sand-50"
            >
              Reset
            </button>
          </form>
        </div>
      </Card>

      {/* Order breakdown */}
      <Card className="overflow-hidden">
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
          <span className="shrink-0 rounded-full bg-sand-100 px-3 py-1 text-xs font-bold text-brand-600">
            {orders.length} records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-100 text-left text-xs uppercase tracking-wider text-brand-400">
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Shop / Branch</th>
                <th className="px-5 py-3 text-right">Total Amount</th>
                <th className="px-5 py-3">Order Date</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const dt = fmtDate(o.order_date)
                return (
                  <tr key={o.order_id} className="border-b border-brand-50 hover:bg-sand-50">
                    <td className="px-5 py-3.5 font-bold text-brand-900">ENG-{1000 + Number(o.order_id)}</td>
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
                          <p className="text-xs text-brand-400">ENG-{1000 + Number(o.order_id)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-brand-600">{o.shop_name || '—'}</td>
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
                        className="inline-flex items-center gap-1.5 rounded-full bg-saffron-400 px-3.5 py-1.5 text-xs font-bold text-brand-950 shadow-soft transition-colors hover:bg-saffron-500"
                      >
                        Breakdown <ArrowRight size={13} weight="bold" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-brand-400">
                    <Receipt size={30} className="mx-auto" />
                    <p className="mt-2">Is range mein koi order nahi.</p>
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

function SnapRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-500">
        <Icon size={15} weight="fill" className="text-brand-400" /> {label}
      </span>
      <span className="text-sm font-extrabold tabular-nums text-brand-900">{value}</span>
    </div>
  )
}
