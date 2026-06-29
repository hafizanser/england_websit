import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Receipt,
  CurrencyDollar,
  UsersThree,
  Package,
  TrendDown,
  ChartBar,
  ArrowRight,
  Warning,
  Trophy,
  Lightning,
  TrendUp,
  CalendarBlank,
  ArrowUpRight,
  Crown,
  Medal,
} from '@phosphor-icons/react'
import { getReports } from '../../api/admin'
import { useAsync } from '../../hooks/useAsync'
import { money } from '../../lib/cartEngine'
import { spring } from '../../lib/motion'
import {
  Card,
  StatCard,
  StatusBadge,
  ErrorCard,
  Skeleton,
  THead,
  Th,
  Td,
  Tr,
  TableWrap,
  statusMeta,
} from '../../components/admin/ui'

const cards = [
  { key: 'orders', label: 'Total orders', icon: Receipt, fmt: (v) => v, to: '/admin/orders', tint: 'bg-brand-50 text-brand-700' },
  { key: 'revenue', label: 'Revenue', icon: CurrencyDollar, fmt: money, to: '/admin/orders', tint: 'bg-wa-50 text-wa-600' },
  { key: 'customers', label: 'Customers', icon: UsersThree, fmt: (v) => v, to: '/admin/customers', tint: 'bg-saffron-100 text-saffron-700' },
  { key: 'products', label: 'Active products', icon: Package, fmt: (v) => v, to: '/admin/products', tint: 'bg-brand-50 text-brand-700' },
  { key: 'avgOrder', label: 'Avg order', icon: ChartBar, fmt: money, to: '/admin/orders', tint: 'bg-saffron-100 text-saffron-700' },
  { key: 'discount', label: 'Discounts diye', icon: TrendDown, fmt: money, to: '/admin/offers', tint: 'bg-wa-50 text-wa-600' },
]

// Raw hex per status — SVG donut + chart accents (tailwind classes can't stroke).
const statusHex = {
  pending: '#c7a05b',
  confirmed: '#3b82f6',
  packed: '#6366f1',
  shipped: '#a855f7',
  delivered: '#1fa855',
  cancelled: '#c9b89f',
}

function DashboardSkeleton() {
  return (
    <>
      <Skeleton className="h-40 w-full rounded-[2rem]" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-3xl border border-brand-100/70 bg-white p-5 shadow-card">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <Skeleton className="mt-4 h-7 w-24" />
            <Skeleton className="mt-2 h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// SVG donut — status mix at a glance. Pure presentational; data-driven.
// ---------------------------------------------------------------------------
function StatusDonut({ data, total }) {
  const r = 56
  const c = 2 * Math.PI * r
  let acc = 0
  return (
    <svg viewBox="0 0 140 140" className="h-44 w-44 -rotate-90">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#efe2cc" strokeWidth="14" />
      {data.map((s) => {
        const frac = total ? s.count / total : 0
        const len = frac * c
        const seg = (
          <circle
            key={s.status}
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke={statusHex[s.status] || '#c9b89f'}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${Math.max(0, len - 3)} ${c}`}
            strokeDashoffset={-acc}
            className="origin-center"
            style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.16,1,0.3,1)' }}
          />
        )
        acc += len
        return seg
      })}
    </svg>
  )
}

export default function AdminDashboard() {
  const { data, loading, error, reload } = useAsync(() => getReports(), [])

  if (loading) return <DashboardSkeleton />
  if (error) {
    return (
      <ErrorCard
        message={error.code === 'NETWORK' ? 'Backend offline hai (Apache/XAMPP).' : error.message}
        onRetry={reload}
      />
    )
  }

  const maxRev = Math.max(1, ...data.daily.map((d) => d.revenue))
  const totalStatus = data.statusBreakdown.reduce((a, s) => a + s.count, 0)
  const maxProd = Math.max(1, ...data.topProducts.map((p) => p.revenue))
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const rankIcon = [Crown, Medal, Medal]

  return (
    <>
      {/* ============================ PREMIUM HERO ============================ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="mesh-warm animate-gradient-pan relative mb-6 overflow-hidden rounded-[2rem] p-6 shadow-haze ring-1 ring-saffron-400/20 sm:p-8"
      >
        {/* floating decorative orbs */}
        <span className="animate-float-slow pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-saffron-400/20 blur-3xl" />
        <span className="animate-glow-pulse pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-wa-500/10 blur-3xl" />
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-saffron-300/50 to-transparent" />

        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-saffron-200 ring-1 ring-white/15 backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-wa-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-wa-500" />
                </span>
                Live Overview
              </span>
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white/55">
                <CalendarBlank size={14} weight="bold" /> {today}
              </span>
            </div>
            <h1 className="mt-4 font-display text-[2rem] font-extrabold leading-none tracking-tight text-white sm:text-[2.6rem]">
              Business <span className="text-gradient-gold">Dashboard</span>
            </h1>
            <p className="mt-3 max-w-md text-sm text-white/55">
              Poore FMCG business ka aik nazar mein jaiza — revenue, orders, stock aur top products.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/admin/orders"
                className="group inline-flex items-center gap-2 rounded-full bg-saffron-400 px-5 py-2.5 text-sm font-bold text-brand-950 shadow-soft transition-all hover:-translate-y-0.5 hover:bg-saffron-300"
              >
                Orders dekhein
                <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/admin/profits"
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-bold text-white ring-1 ring-white/15 backdrop-blur transition-all hover:bg-white/15"
              >
                <TrendUp size={16} weight="bold" /> Profit breakdown
              </Link>
            </div>
          </div>

          {/* glass highlight tiles */}
          <div className="grid w-full grid-cols-2 gap-3 sm:max-w-md lg:w-auto">
            <div className="glass-dark relative overflow-hidden rounded-2xl p-4 ring-1 ring-saffron-400/20">
              <span className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full bg-saffron-400/20 blur-2xl" />
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-saffron-200/80">
                <CurrencyDollar size={15} weight="fill" /> Revenue
              </div>
              <p className="mt-2 font-display text-2xl font-extrabold tracking-tight text-white tabular-nums">
                {money(data.cards.revenue)}
              </p>
            </div>
            <div className="glass-dark relative overflow-hidden rounded-2xl p-4 ring-1 ring-white/10">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/55">
                <Receipt size={15} weight="fill" /> Orders
              </div>
              <p className="mt-2 font-display text-2xl font-extrabold tracking-tight text-white tabular-nums">
                {data.cards.orders}
              </p>
            </div>
            <div className="glass-dark relative overflow-hidden rounded-2xl p-4 ring-1 ring-white/10">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/55">
                <UsersThree size={15} weight="fill" /> Customers
              </div>
              <p className="mt-2 font-display text-2xl font-extrabold tracking-tight text-white tabular-nums">
                {data.cards.customers}
              </p>
            </div>
            <div className="glass-dark relative overflow-hidden rounded-2xl p-4 ring-1 ring-white/10">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/55">
                <ChartBar size={15} weight="fill" /> Avg order
              </div>
              <p className="mt-2 font-display text-2xl font-extrabold tracking-tight text-white tabular-nums">
                {money(data.cards.avgOrder)}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================== KPI GRID ============================== */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {cards.map((c, i) => (
          <StatCard key={c.key} icon={c.icon} label={c.label} value={c.fmt(data.cards[c.key])} tint={c.tint} to={c.to} index={i} />
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* ----------------------- daily revenue chart ----------------------- */}
        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-base font-bold text-brand-900">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <ChartBar size={17} weight="fill" />
                </span>
                Revenue trend
              </h3>
              <p className="mt-1 text-xs text-brand-400">Akhri {data.daily.length} din ki kamai</p>
            </div>
            <span className="rounded-full bg-wa-50 px-3 py-1 text-[11px] font-bold text-wa-700 ring-1 ring-wa-500/20">
              Peak {money(maxRev)}
            </span>
          </div>
          {data.daily.length === 0 ? (
            <p className="mt-10 text-sm text-brand-400">Abhi koi data nahi.</p>
          ) : (
            <div className="relative mt-8">
              {/* baseline gridlines */}
              <div className="pointer-events-none absolute inset-x-0 top-0 flex h-48 flex-col justify-between">
                {[0, 1, 2, 3].map((g) => (
                  <div key={g} className="border-t border-dashed border-brand-100" />
                ))}
              </div>
              <div className="relative flex h-48 items-end gap-2.5">
                {data.daily.map((d, i) => {
                  const isPeak = d.revenue === maxRev
                  return (
                    <div key={d.day} className="group flex flex-1 flex-col items-center gap-2">
                      <div className="relative flex w-full flex-1 items-end">
                        <div
                          className={`w-full origin-bottom rounded-t-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition-all duration-300 ${
                            isPeak
                              ? 'bg-gradient-to-t from-saffron-600 to-saffron-300'
                              : 'bg-gradient-to-t from-brand-700 to-brand-400 group-hover:from-saffron-500 group-hover:to-saffron-300'
                          }`}
                          style={{
                            height: `${Math.max(4, (d.revenue / maxRev) * 100)}%`,
                            animation: `grow-y 0.8s cubic-bezier(0.16,1,0.3,1) ${i * 50}ms both`,
                          }}
                        />
                        <span className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-brand-950 px-2.5 py-1.5 text-[10px] font-bold text-white opacity-0 shadow-lift ring-1 ring-white/10 transition-opacity group-hover:opacity-100">
                          {money(d.revenue)}
                          <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-brand-950" />
                        </span>
                      </div>
                      <span className="text-[10px] font-medium text-brand-400">{d.day.slice(5)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Card>

        {/* ------------------------ status donut ----------------------------- */}
        <Card className="p-5 sm:p-6">
          <h3 className="flex items-center gap-2 text-base font-bold text-brand-900">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-saffron-100 text-saffron-700">
              <Receipt size={17} weight="fill" />
            </span>
            Orders by status
          </h3>
          {data.statusBreakdown.length === 0 ? (
            <p className="mt-8 text-sm text-brand-400">Abhi koi order nahi.</p>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row">
              <div className="relative shrink-0">
                <StatusDonut data={data.statusBreakdown} total={totalStatus} />
                <div className="absolute inset-0 grid place-content-center text-center">
                  <span className="font-display text-3xl font-extrabold tracking-tight text-brand-950 tabular-nums">{totalStatus}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">Total</span>
                </div>
              </div>
              <div className="w-full flex-1 space-y-2.5">
                {data.statusBreakdown.map((s) => (
                  <div key={s.status} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusHex[s.status] || '#c9b89f' }} />
                      <span className="text-xs font-semibold capitalize text-brand-700">{statusMeta[s.status]?.label || s.status}</span>
                    </span>
                    <span className="text-xs font-bold tabular-nums text-brand-500">
                      {s.count} <span className="text-brand-300">· {money(s.value)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {/* ------------------------- top products ---------------------------- */}
        <Card className="p-5 sm:p-6">
          <h3 className="flex items-center gap-2 text-base font-bold text-brand-900">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-saffron-100 text-saffron-700">
              <Trophy size={17} weight="fill" />
            </span>
            Top bikne wale products
          </h3>
          <div className="mt-5 space-y-3">
            {data.topProducts.length === 0 && <p className="text-sm text-brand-400">Abhi koi sale nahi.</p>}
            {data.topProducts.map((p, i) => {
              const Rank = rankIcon[i]
              return (
                <div key={p.name} className="group flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-sand-50/70">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-extrabold shadow-ring ${
                      i === 0
                        ? 'bg-gradient-to-br from-saffron-300 to-saffron-500 text-brand-950'
                        : i === 1
                          ? 'bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700'
                          : i === 2
                            ? 'bg-gradient-to-br from-saffron-100 to-saffron-200 text-saffron-800'
                            : 'bg-brand-50 text-brand-500'
                    }`}
                  >
                    {Rank ? <Rank size={16} weight="fill" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-800">{p.name}</p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-saffron-400 to-saffron-600"
                        style={{ width: `${(p.revenue / maxProd) * 100}%`, animation: `grow-y 0.7s ease ${i * 70}ms both` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-brand-400">{p.qty} pcs</span>
                  <span className="w-20 shrink-0 text-right text-sm font-bold tabular-nums text-brand-800">{money(p.revenue)}</span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* --------------------------- low stock ----------------------------- */}
        <Card className="p-5 sm:p-6">
          <h3 className="flex items-center gap-2 text-base font-bold text-brand-900">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-red-50 text-red-500">
              <Warning size={17} weight="fill" />
            </span>
            Kam stock alerts
          </h3>
          <div className="mt-5 space-y-2">
            {data.lowStock.length === 0 && (
              <div className="grid place-items-center rounded-2xl border border-dashed border-wa-500/30 bg-wa-50/50 py-8 text-center">
                <Package size={28} weight="duotone" className="text-wa-600" />
                <p className="mt-2 text-sm font-semibold text-wa-700">Sab stock theek hai 👍</p>
              </div>
            )}
            {data.lowStock.map((p) => {
              const critical = p.stock < 200
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 ring-1 ${
                    critical ? 'bg-red-50/60 ring-red-100' : 'bg-sand-50/70 ring-brand-100/60'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${critical ? 'animate-pulse bg-red-500' : 'bg-saffron-500'}`} />
                    <span className="truncate text-sm font-medium text-brand-700">{p.name}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ring-1 ${
                      critical ? 'bg-red-100 text-red-700 ring-red-200' : 'bg-saffron-50 text-saffron-700 ring-saffron-200'
                    }`}
                  >
                    {p.stock} left
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* ============================ recent orders =========================== */}
      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between p-5 sm:px-6">
          <h3 className="flex items-center gap-2 text-base font-bold text-brand-900">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <Lightning size={17} weight="fill" />
            </span>
            Naye orders
          </h3>
          <Link
            to="/admin/orders"
            className="group inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-saffron-400 hover:text-brand-950"
          >
            Sab dekhein <ArrowUpRight size={15} weight="bold" className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
        <TableWrap>
          <THead>
            <Th>Order</Th>
            <Th>Customer</Th>
            <Th>Status</Th>
            <Th className="text-right">Total</Th>
          </THead>
          <tbody>
            {data.recentOrders.map((o) => (
              <Tr key={o.code}>
                <Td className="font-bold text-brand-900">{o.code}</Td>
                <Td className="text-brand-600">{o.customer_name}</Td>
                <Td><StatusBadge status={o.status} /></Td>
                <Td className="text-right font-bold tabular-nums text-brand-800">{money(o.total)}</Td>
              </Tr>
            ))}
            {data.recentOrders.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-brand-400">Aaj koi naya order nahi.</td>
              </tr>
            )}
          </tbody>
        </TableWrap>
      </Card>
    </>
  )
}
