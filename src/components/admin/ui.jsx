import { CircleNotch, ArrowUpRight } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'

// ===========================================================================
// Admin primitives.
// ===========================================================================
// THE SHAPE SYSTEM. Anything a person can see the edge of takes one of three:
//
//   rounded-full   pills, buttons, badges, avatars
//   rounded-2xl    panels and cards: every elevated surface
//   rounded-xl     things that live INSIDE a panel: inputs, icon chips, rows
//
// Below those sit the incidentals that are not surfaces at all and read wrong
// at 12px: keyboard caps, hover tooltips, the tops of chart bars. Those use
// `rounded-md`/`lg` and are the only sanctioned exceptions.
//
// Before this there were eight radii in play on the dashboard alone
// (`rounded-[2rem]`, `4xl`, `3xl`, `2xl`, `[1.1rem]`, `xl`, `lg`, `full`) with
// no rule behind which went where, so the banner, the cards and the tiles
// inside them all curved differently and the page read as assembled rather than
// designed. A new radius goes here with a reason, not inline at a call site.
//
// THE NUMBERS ARE MONO. Every figure a person compares down a column — money,
// counts, stock — is `font-mono tabular-nums`. In a proportional face the digit
// 1 is half the width of 0, so a column of rupee totals will not line up no
// matter how it is aligned, and scanning it means reading every row instead of
// seeing the shape of the column.
// ===========================================================================

export const STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled']

export const statusMeta = {
  pending: { label: 'Naya', cls: 'bg-saffron-50 text-saffron-800 ring-saffron-200', dot: 'bg-saffron-500' },
  confirmed: { label: 'Confirmed', cls: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500' },
  packed: { label: 'Packed', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200', dot: 'bg-indigo-500' },
  shipped: { label: 'Ravana', cls: 'bg-purple-50 text-purple-700 ring-purple-200', dot: 'bg-purple-500' },
  delivered: { label: 'Delivered', cls: 'bg-wa-50 text-wa-700 ring-wa-500/30', dot: 'bg-wa-500' },
  cancelled: { label: 'Cancelled', cls: 'bg-sand-100 text-brand-500 ring-brand-200', dot: 'bg-brand-300' },
}

// The dot stays HERE and only here. A status is the one place in the admin
// where a coloured dot carries meaning a word alone does not: it is what lets a
// column of thirty orders be read as a pattern rather than as thirty labels.
export function StatusBadge({ status }) {
  const m = statusMeta[status] || { label: status, cls: 'bg-sand-100 text-brand-600 ring-brand-200', dot: 'bg-brand-300' }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ring-1 ${m.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} /> {m.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Page title block.
// ---------------------------------------------------------------------------
export function AdminTitle({ title, subtitle, eyebrow, icon: Icon, children }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-900 text-saffron-300">
            <Icon size={19} weight="fill" />
          </span>
        )}
        <div>
          {eyebrow && (
            <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-saffron-700">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-[1.6rem] font-extrabold leading-tight tracking-tight text-brand-950 sm:text-[1.9rem]">
            {title}
          </h1>
          {subtitle && <p className="mt-1.5 max-w-xl text-sm text-brand-500">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loader.
// ---------------------------------------------------------------------------
export function Loader({ label = 'Load ho raha hai...' }) {
  return (
    <div className="grid place-items-center py-24 text-brand-400">
      <CircleNotch size={34} className="animate-spin text-saffron-500" weight="bold" />
      <p className="mt-4 text-sm font-medium text-brand-500">{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card — the one elevated surface.
// ---------------------------------------------------------------------------
export function Card({ className = '', hover = false, children }) {
  return (
    <div
      className={`rounded-2xl border border-brand-100 bg-white shadow-card ${
        hover ? 'transition-shadow duration-200 hover:shadow-cardhover' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

/**
 * Panel header — an icon chip, a title, and optional actions on the right.
 * Every card in the admin opens the same way, so the eye knows where the title
 * is before it has read it.
 */
export function PanelHead({ icon: Icon, title, hint, children }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-brand-100 px-5 py-4">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-sand-100 text-brand-600">
            <Icon size={15} weight="fill" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-brand-900">{title}</h3>
          {hint && <p className="truncate text-xs text-brand-400">{hint}</p>}
        </div>
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatCard — a single KPI.
// ---------------------------------------------------------------------------
// Kept for the admin screens that show one or two figures beside other content.
// The dashboard's six-up grid uses <StatGrid> instead: six of these floating
// side by side is six borders, six shadows and six icon chips around six
// numbers, which is a lot of furniture for the thing you came to read.
export function StatCard({ icon: Icon, label, value, tint = 'bg-sand-100 text-brand-600', to, trend, hint }) {
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${tint}`}>
          {Icon && <Icon size={17} weight="fill" />}
        </span>
        {to ? (
          <ArrowUpRight
            size={15}
            weight="bold"
            className="text-brand-300 transition-colors group-hover:text-saffron-600"
          />
        ) : trend != null ? (
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums ring-1 ${
              trend >= 0 ? 'bg-wa-50 text-wa-700 ring-wa-500/20' : 'bg-red-50 text-red-600 ring-red-200'
            }`}
          >
            {trend >= 0 ? '+' : ''}
            {trend}%
          </span>
        ) : null}
      </div>
      <p className="mt-4 font-mono text-[1.6rem] font-bold leading-none tracking-tight text-brand-950 tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 text-sm font-medium text-brand-500">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-brand-400">{hint}</p>}
    </>
  )
  const base = 'group rounded-2xl border border-brand-100 bg-white p-5 shadow-card'
  return to ? (
    <Link to={to} className={`${base} block transition-shadow duration-200 hover:shadow-cardhover`}>
      {inner}
    </Link>
  ) : (
    <div className={base}>{inner}</div>
  )
}

// ---------------------------------------------------------------------------
// StatGrid — several KPIs as ONE surface divided by hairlines.
// ---------------------------------------------------------------------------
// One border, one shadow, N numbers. The dividers do the grouping that six
// separate boxes were doing with six times the ink, and the figures end up
// closer together, which is what makes a row of them comparable at a glance.
export function StatGrid({ items }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-card">
      <div className="grid grid-cols-2 lg:grid-cols-3">
        {items.map((s, i) => {
          const Inner = (
            <>
              <div className="flex items-center gap-2 text-brand-400">
                {s.icon && <s.icon size={15} weight="fill" className={s.tone || ''} />}
                <span className="truncate text-[12px] font-medium">{s.label}</span>
                {s.to && (
                  <ArrowUpRight
                    size={13}
                    weight="bold"
                    className="ml-auto shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                )}
              </div>
              <p className="mt-2.5 font-mono text-[1.5rem] font-bold leading-none tracking-tight text-brand-950 tabular-nums">
                {s.value}
              </p>
              {s.hint && <p className="mt-1.5 text-[11px] text-brand-400">{s.hint}</p>}
            </>
          )
          // Hairlines are drawn per cell rather than with `divide-*`, because a
          // 2-up mobile grid and a 3-up desktop grid need the vertical rule in
          // different places and `divide-x` cannot change its mind per breakpoint.
          const edges = [
            'border-brand-100 p-5',
            i % 2 === 0 ? 'border-r' : '',
            i < items.length - (items.length % 2 === 0 ? 2 : 1) ? 'border-b' : '',
            i % 3 !== 2 ? 'lg:border-r' : 'lg:border-r-0',
            i < items.length - 3 ? 'lg:border-b' : 'lg:border-b-0',
          ].join(' ')
          return s.to ? (
            <Link key={s.label} to={s.to} className={`group transition-colors hover:bg-sand-50/70 ${edges}`}>
              {Inner}
            </Link>
          ) : (
            <div key={s.label} className={edges}>
              {Inner}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state.
// ---------------------------------------------------------------------------
export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-brand-200 bg-sand-50/60 px-6 py-14 text-center">
      {Icon && (
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-white text-brand-300 ring-1 ring-brand-100">
          <Icon size={24} weight="duotone" />
        </span>
      )}
      <p className="mt-4 text-sm font-bold text-brand-800">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-brand-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorCard({ message, onRetry }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-saffron-300 bg-saffron-50 px-6 py-12 text-center">
      <p className="text-sm font-bold text-saffron-900">Kuch ghadbad ho gayi</p>
      <p className="mt-1 max-w-sm text-sm text-saffron-700">{message || 'Maloomat load nahi ho saki.'}</p>
      {onRetry && (
        <Btn onClick={onRetry} className="mt-5">
          Dobara koshish karein
        </Btn>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeletons — shaped like the thing that is coming, not like a spinner.
// ---------------------------------------------------------------------------
export function Skeleton({ className = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-sand-200/70 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </div>
  )
}

export function TableSkeleton({ rows = 6, cols = 4 }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-4 ${c === 0 ? 'w-1/4' : 'flex-1'}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Buttons.
// ---------------------------------------------------------------------------
const btnVariants = {
  primary: 'bg-brand-800 text-white hover:bg-brand-900',
  accent: 'bg-saffron-400 text-brand-950 hover:bg-saffron-500',
  ghost: 'border border-brand-200 bg-white text-brand-700 hover:border-brand-300 hover:bg-sand-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  subtle: 'bg-sand-100 text-brand-700 hover:bg-sand-200',
}
const btnSizes = { sm: 'px-3.5 py-2 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-sm' }

export function Btn({ as = 'button', variant = 'primary', size = 'md', className = '', children, ...props }) {
  const Comp = as
  return (
    <Comp
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-bold transition-colors duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${btnVariants[variant]} ${btnSizes[size]} ${className}`}
      {...props}
    >
      {children}
    </Comp>
  )
}

// ---------------------------------------------------------------------------
// Form field — label above, input, helper/error below.
// ---------------------------------------------------------------------------
// The focus ring is a real ring and not a colour change: at AA, `brand-500` on
// `sand-50` is the difference between a field you can find with the keyboard
// and one you cannot.
export const inputCls =
  'w-full rounded-xl border border-brand-200 bg-white px-3.5 py-2.5 text-sm text-brand-900 outline-none transition-colors placeholder:text-brand-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25'

export function Field({ label, hint, error, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && (
        <span className="text-[13px] font-semibold text-brand-800">
          {label} {hint && <span className="font-normal text-brand-400">{hint}</span>}
        </span>
      )}
      {children}
      {error && <span className="text-xs font-medium text-red-600">{error}</span>}
    </label>
  )
}

// ---------------------------------------------------------------------------
// Table shell.
// ---------------------------------------------------------------------------
export function TableWrap({ children, className = '' }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

export function Th({ className = '', children }) {
  return (
    <th className={`px-5 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-400 ${className}`}>
      {children}
    </th>
  )
}

export function THead({ children }) {
  return (
    <thead className="border-b border-brand-100 bg-sand-50/60 text-left">
      <tr>{children}</tr>
    </thead>
  )
}

export function Td({ className = '', children }) {
  return <td className={`px-5 py-3 ${className}`}>{children}</td>
}

export function Tr({ className = '', children }) {
  return <tr className={`border-b border-brand-50 last:border-0 transition-colors hover:bg-sand-50/60 ${className}`}>{children}</tr>
}
