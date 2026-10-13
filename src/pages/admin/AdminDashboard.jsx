import { Link } from 'react-router-dom'
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
  ArrowUpRight,
} from '@phosphor-icons/react'
import { getReports } from '../../api/admin'
import { useAsync } from '../../hooks/useAsync'
import { money } from '../../lib/cartEngine'
import {
  Card,
  PanelHead,
  StatGrid,
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

// ===========================================================================
// Dashboard.
// ===========================================================================
// WHAT CHANGED, AND WHY.
//
// The banner used to carry four glass tiles — Revenue, Orders, Customers, Avg
// order — directly above a six-card grid that showed the same four figures
// again. Four of the six numbers on the screen were printed twice, about 300px
// apart, inside one viewport. Duplicated numbers are worse than redundant: the
// reader stops to check whether the two copies agree.
//
// So the banner now carries no numbers at all. It is identity, today's date and
// the two things you came here to do. Every figure lives in exactly one place
// below it, and the page got roughly a screenful shorter.
//
// The decoration went with it: two infinitely-animating blur orbs, a panning
// gradient, a pinging status dot and a gradient-filled word. None of it was
// telling anybody anything about the business, and all of it was running on a
// page somebody leaves open all day.
// ===========================================================================

// Raw hex per status — the SVG donut strokes with these, and `stroke` cannot
// take a Tailwind class.
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
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="mt-5 h-[280px] w-full rounded-2xl lg:h-[196px]" />
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr] [&>*]:min-w-0">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Revenue bars.
// ---------------------------------------------------------------------------
// THE BARS USED TO BE INVISIBLE. The old markup put `items-end` on the h-48
// row, which stops its children stretching, so each column was only as tall as
// its own content. The bar wrapper inside then asked for `flex-1` of a height
// that was never established, resolved to 0px, and every bar rendered at 0% of
// nothing. The chart shipped as a set of gridlines and date labels with no data
// in it, which is exactly how it looked in production.
//
// The fix is to stop making one flex container do two jobs. The plot is its own
// fixed-height box that the bars fill from the bottom, and the date labels are a
// separate row underneath on the same grid. Neither can collapse the other.
function RevenueChart({ daily, max }) {
  if (!daily.length) {
    return <p className="px-5 py-12 text-center text-sm text-brand-400">Abhi koi data nahi.</p>
  }
  return (
    <div className="px-5 pb-5 pt-6">
      <div className="flex gap-3">
        {/* y-axis: without a top figure the bars are shapes with no scale */}
        <div className="flex h-44 w-14 shrink-0 flex-col justify-between py-px text-right font-mono text-[10px] tabular-nums text-brand-300">
          <span>{money(max)}</span>
          <span>{money(Math.round(max / 2))}</span>
          <span>0</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-44">
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
              {[0, 1, 2].map((g) => (
                <div key={g} className="border-t border-dashed border-brand-100" />
              ))}
            </div>
            <div className="absolute inset-0 flex items-end gap-1.5 sm:gap-2.5">
              {daily.map((d, i) => {
                const pct = Math.max(2, (d.revenue / max) * 100)
                const isPeak = d.revenue === max
                return (
                  <div key={d.day} className="group relative flex h-full flex-1 items-end">
                    <div
                      className={`w-full rounded-t-md transition-colors ${
                        isPeak ? 'bg-saffron-400' : 'bg-brand-700 group-hover:bg-saffron-500'
                      }`}
                      style={{ height: `${pct}%`, animation: `grow-y 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 40}ms both` }}
                    />
                    <span className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-brand-950 px-2 py-1 font-mono text-[10px] font-bold tabular-nums text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {money(d.revenue)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="mt-2 flex gap-1.5 sm:gap-2.5">
            {daily.map((d) => (
              <span key={d.day} className="flex-1 text-center font-mono text-[10px] tabular-nums text-brand-400">
                {d.day.slice(5)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusDonut({ data, total }) {
  const r = 54
  const c = 2 * Math.PI * r
  let acc = 0
  return (
    <svg viewBox="0 0 140 140" className="h-40 w-40 -rotate-90" role="img" aria-label="Orders by status">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#f3e8d2" strokeWidth="13" />
      {data.map((s) => {
        const len = total ? (s.count / total) * c : 0
        const seg = (
          <circle
            key={s.status}
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke={statusHex[s.status] || '#c9b89f'}
            strokeWidth="13"
            strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
            strokeDashoffset={-acc}
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

  const kpis = [
    { key: 'orders', label: 'Total orders', icon: Receipt, value: data.cards.orders, to: '/admin/orders' },
    { key: 'revenue', label: 'Revenue', icon: CurrencyDollar, value: money(data.cards.revenue), to: '/admin/orders', tone: 'text-wa-600' },
    { key: 'customers', label: 'Customers', icon: UsersThree, value: data.cards.customers, to: '/admin/customers' },
    { key: 'products', label: 'Active products', icon: Package, value: data.cards.products, to: '/admin/products' },
    { key: 'avgOrder', label: 'Avg order', icon: ChartBar, value: money(data.cards.avgOrder), to: '/admin/orders' },
    { key: 'discount', label: 'Discounts diye', icon: TrendDown, value: money(data.cards.discount), to: '/admin/offers' },
  ]

  return (
    <>
      {/* ======================== banner: no numbers ======================== */}
      <div className="relative overflow-hidden rounded-2xl bg-brand-950 px-6 py-7 sm:px-8 sm:py-8">
        {/* One warm wash, static. It gives the panel depth without running an
            animation on a page that stays open for hours. */}
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_85%_0%,rgba(199,160,91,0.22),transparent_60%)]" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-saffron-300/70">{today}</p>
            <h1 className="mt-2.5 font-display text-[1.9rem] font-extrabold leading-none tracking-tight text-white sm:text-[2.3rem]">
              Business Dashboard
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/55">
              Poore FMCG business ka aik nazar mein jaiza: revenue, orders, stock aur top products.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
            <Link
              to="/admin/orders"
              className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-saffron-400 px-5 py-2.5 text-sm font-bold text-brand-950 transition-colors hover:bg-saffron-300"
            >
              Orders dekhein
              <ArrowRight size={15} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/admin/profits"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/20 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10"
            >
              <TrendUp size={15} weight="bold" /> Profit breakdown
            </Link>
          </div>
        </div>
      </div>

      {/* ============================== the figures ============================== */}
      <div className="mt-5">
        <StatGrid items={kpis} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr] [&>*]:min-w-0">
        {/* ----------------------------- revenue ----------------------------- */}
        <Card>
          <PanelHead icon={ChartBar} title="Revenue trend" hint={`Pichhle ${data.daily.length} active din`}>
            <span className="rounded-full bg-sand-100 px-2.5 py-1 font-mono text-[11px] font-bold tabular-nums text-brand-700">
              Peak {money(maxRev)}
            </span>
          </PanelHead>
          <RevenueChart daily={data.daily} max={maxRev} />
        </Card>

        {/* ------------------------------ status ----------------------------- */}
        <Card>
          <PanelHead icon={Receipt} title="Orders by status" />
          {data.statusBreakdown.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-brand-400">Abhi koi order nahi.</p>
          ) : (
            <div className="flex flex-col items-center gap-6 p-5 sm:flex-row">
              <div className="relative shrink-0">
                <StatusDonut data={data.statusBreakdown} total={totalStatus} />
                <div className="absolute inset-0 grid place-content-center text-center">
                  <span className="font-mono text-[1.75rem] font-bold leading-none tracking-tight text-brand-950 tabular-nums">
                    {totalStatus}
                  </span>
                  <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-brand-400">Total</span>
                </div>
              </div>
              <ul className="w-full flex-1 space-y-3">
                {data.statusBreakdown.map((s) => (
                  <li key={s.status} className="flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-brand-700">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: statusHex[s.status] || '#c9b89f' }} />
                      {statusMeta[s.status]?.label || s.status}
                    </span>
                    <span className="text-right">
                      <span className="block font-mono text-[13px] font-bold tabular-nums text-brand-900">{money(s.value)}</span>
                      <span className="block font-mono text-[11px] tabular-nums text-brand-400">{s.count} orders</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        {/* --------------------------- top products -------------------------- */}
        <Card>
          <PanelHead icon={Trophy} title="Top bikne wale products" hint="Revenue ke hisab se" />
          <div className="p-2">
            {data.topProducts.length === 0 && (
              <p className="px-3 py-10 text-center text-sm text-brand-400">Abhi koi sale nahi.</p>
            )}
            {data.topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-sand-50">
                {/* Rank is a number. The old gold/silver/bronze gradient medals
                    were three different fills for what is already an ordered
                    list read top to bottom. */}
                <span className="w-5 shrink-0 text-right font-mono text-[13px] font-bold tabular-nums text-brand-300">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-brand-800">{p.name}</p>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-sand-100">
                    <div
                      className="h-full rounded-full bg-saffron-400"
                      style={{ width: `${(p.revenue / maxProd) * 100}%`, animation: `grow-y 0.5s ease ${i * 50}ms both` }}
                    />
                  </div>
                </div>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-brand-400">{p.qty} pcs</span>
                <span className="w-20 shrink-0 text-right font-mono text-[13px] font-bold tabular-nums text-brand-900">
                  {money(p.revenue)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* ----------------------------- low stock --------------------------- */}
        <Card>
          <PanelHead icon={Warning} title="Kam stock alerts" hint="Jo jald khatam ho sakta hai" />
          <div className="p-2">
            {data.lowStock.length === 0 && (
              <div className="grid place-items-center px-3 py-10 text-center">
                <Package size={26} weight="duotone" className="text-wa-600" />
                <p className="mt-2 text-sm font-semibold text-wa-700">Sab stock theek hai.</p>
              </div>
            )}
            {data.lowStock.map((p) => {
              const critical = p.stock < 200
              return (
                <Link
                  key={p.id}
                  to="/admin/products"
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-sand-50"
                >
                  <span className="min-w-0 truncate text-[13px] font-medium text-brand-700">{p.name}</span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold tabular-nums ring-1 ${
                      critical ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-saffron-50 text-saffron-800 ring-saffron-200'
                    }`}
                  >
                    {p.stock} left
                  </span>
                </Link>
              )
            })}
          </div>
        </Card>
      </div>

      {/* ============================ recent orders =========================== */}
      <Card className="mt-5 overflow-hidden">
        <PanelHead icon={Lightning} title="Naye orders">
          <Link
            to="/admin/orders"
            className="group inline-flex items-center gap-1.5 rounded-full bg-sand-100 px-3 py-1.5 text-[13px] font-semibold text-brand-700 transition-colors hover:bg-saffron-400 hover:text-brand-950"
          >
            Sab dekhein
            <ArrowUpRight size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </PanelHead>
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
                <Td className="font-mono text-[13px] font-bold tabular-nums text-brand-900">{o.code}</Td>
                <Td className="text-brand-600">{o.customer_name}</Td>
                <Td>
                  <StatusBadge status={o.status} />
                </Td>
                <Td className="text-right font-mono font-bold tabular-nums text-brand-900">{money(o.total)}</Td>
              </Tr>
            ))}
            {data.recentOrders.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-brand-400">
                  Aaj koi naya order nahi.
                </td>
              </tr>
            )}
          </tbody>
        </TableWrap>
      </Card>
    </>
  )
}
