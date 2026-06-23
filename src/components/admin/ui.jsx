import { CircleNotch, ArrowUpRight } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Status vocabulary + premium pill (subtle dot + tinted ring).
// ---------------------------------------------------------------------------
export const STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled']

export const statusMeta = {
  pending: { label: 'Naya', cls: 'bg-saffron-50 text-saffron-800 ring-saffron-200', dot: 'bg-saffron-500' },
  confirmed: { label: 'Confirmed', cls: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500' },
  packed: { label: 'Packed', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200', dot: 'bg-indigo-500' },
  shipped: { label: 'Ravana', cls: 'bg-purple-50 text-purple-700 ring-purple-200', dot: 'bg-purple-500' },
  delivered: { label: 'Delivered', cls: 'bg-wa-50 text-wa-700 ring-wa-500/30', dot: 'bg-wa-500' },
  cancelled: { label: 'Cancelled', cls: 'bg-sand-100 text-brand-500 ring-brand-200', dot: 'bg-brand-300' },
}

export function StatusBadge({ status }) {
  const m = statusMeta[status] || { label: status, cls: 'bg-sand-100 text-brand-600 ring-brand-200', dot: 'bg-brand-300' }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ring-1 ${m.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} /> {m.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Page title block — display font, eyebrow, optional icon + actions.
// ---------------------------------------------------------------------------
export function AdminTitle({ title, subtitle, eyebrow, icon: Icon, children }) {
  return (
    <div className="mb-6 flex animate-fade-up flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3.5">
        {Icon && (
          <span className="relative mt-0.5 grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[1.1rem] bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 text-saffron-300 shadow-soft ring-1 ring-white/10">
            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_70%_at_30%_20%,rgba(199,160,91,0.4),transparent_70%)]" />
            <Icon size={22} weight="fill" className="relative" />
          </span>
        )}
        <div>
          {eyebrow && (
            <p className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-saffron-600">
              <span className="h-1 w-1 rounded-full bg-saffron-500" /> {eyebrow}
            </p>
          )}
          <h1 className="font-display text-[1.75rem] font-extrabold leading-none tracking-tight text-brand-950 sm:text-[2.1rem]">
            {title}
          </h1>
          {subtitle && <p className="mt-2 text-sm text-brand-500">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loader — refined dual-ring spinner (not a generic circle).
// ---------------------------------------------------------------------------
export function Loader({ label = 'Load ho raha hai...' }) {
  return (
    <div className="grid animate-fade-up place-items-center py-24 text-brand-400">
      <span className="relative grid h-12 w-12 place-items-center">
        <span className="absolute inset-0 rounded-full border-2 border-brand-100" />
        <CircleNotch size={48} className="animate-spin text-saffron-500" weight="bold" />
      </span>
      <p className="mt-4 text-sm font-medium text-brand-500">{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card — premium surface with diffusion shadow + subtle top highlight.
// ---------------------------------------------------------------------------
export function Card({ className = '', hover = false, children }) {
  return (
    <div
      className={`relative rounded-3xl border border-white/70 bg-gradient-to-b from-white to-sand-50/60 shadow-card ring-1 ring-brand-100/50 ${
        hover ? 'transition-all duration-300 hover:-translate-y-1 hover:border-saffron-200 hover:shadow-cardhover' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatCard — KPI tile with gradient icon, big display number, optional trend.
// ---------------------------------------------------------------------------
export function StatCard({ icon: Icon, label, value, tint = 'bg-brand-50 text-brand-700', to, trend, hint, index = 0 }) {
  const inner = (
    <>
      {/* layered depth — corner glow + faint top highlight */}
      <span className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(199,160,91,0.16),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
      <span className="sheen-mask" aria-hidden="true" />

      <div className="relative flex items-start justify-between">
        <span className={`relative grid h-12 w-12 place-items-center overflow-hidden rounded-2xl ${tint} shadow-ring ring-1 ring-white/40 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}>
          <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.55),transparent_55%)]" />
          {Icon && <Icon size={22} weight="fill" className="relative" />}
        </span>
        {to ? (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-sand-50 text-brand-300 ring-1 ring-brand-100 transition-all duration-300 group-hover:bg-saffron-400 group-hover:text-brand-950 group-hover:ring-saffron-300">
            <ArrowUpRight size={16} weight="bold" className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        ) : trend != null ? (
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${trend >= 0 ? 'bg-wa-50 text-wa-700 ring-wa-500/20' : 'bg-red-50 text-red-600 ring-red-200'}`}>
            {trend >= 0 ? '▲ ' : '▼ '}{trend >= 0 ? '+' : ''}{trend}%
          </span>
        ) : null}
      </div>
      <p className="relative mt-4 font-display text-[1.7rem] font-extrabold leading-none tracking-tight text-brand-950 tabular-nums sm:text-[1.9rem]">{value}</p>
      <p className="relative mt-1.5 text-sm font-medium text-brand-500">{label}</p>
      {hint && <p className="relative mt-1 text-xs text-brand-400">{hint}</p>}
    </>
  )
  const base =
    'group relative animate-fade-up overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-b from-white via-white to-sand-50/70 p-5 shadow-kpi ring-1 ring-brand-100/40'
  const style = { animationDelay: `${index * 70}ms` }
  return to ? (
    <Link to={to} style={style} className={`${base} transition-all duration-300 hover:-translate-y-1.5 hover:border-saffron-200 hover:shadow-kpihover`}>
      {inner}
    </Link>
  ) : (
    <div style={style} className={base}>
      {inner}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state — composed, on-brand, optional action.
// ---------------------------------------------------------------------------
export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="grid animate-fade-up place-items-center rounded-3xl border border-dashed border-brand-200 bg-gradient-to-b from-sand-50 to-white px-6 py-16 text-center">
      {Icon && (
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-brand-300 shadow-card ring-1 ring-brand-100">
          <Icon size={32} weight="duotone" />
        </span>
      )}
      <p className="mt-4 text-base font-bold text-brand-800">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-brand-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// Inline error card (for failed loads).
export function ErrorCard({ message, onRetry }) {
  return (
    <div className="grid place-items-center rounded-3xl border border-dashed border-saffron-300 bg-saffron-50 px-6 py-14 text-center">
      <p className="text-base font-bold text-saffron-900">Kuch ghadbad ho gayi</p>
      <p className="mt-1 max-w-sm text-sm text-saffron-700">{message || 'Maloomat load nahi ho saki.'}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-5">
          <Btn>Dobara koshish karein</Btn>
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton primitives — shimmer blocks that match real layout sizes.
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
// Buttons — variants + tactile press.
// ---------------------------------------------------------------------------
const btnVariants = {
  primary: 'bg-brand-700 text-white shadow-soft hover:bg-brand-800',
  accent: 'bg-saffron-400 text-brand-950 shadow-soft hover:bg-saffron-500',
  ghost: 'border border-brand-200 bg-white text-brand-700 hover:border-brand-300 hover:bg-sand-50',
  danger: 'bg-red-600 text-white shadow-soft hover:bg-red-700',
  subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
}
const btnSizes = { sm: 'px-3.5 py-2 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-sm' }

export function Btn({ as = 'button', variant = 'primary', size = 'md', className = '', children, ...props }) {
  const Comp = as
  return (
    <Comp
      className={`inline-flex items-center justify-center gap-2 rounded-full font-bold transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${btnVariants[variant]} ${btnSizes[size]} ${className}`}
      {...props}
    >
      {children}
    </Comp>
  )
}

// ---------------------------------------------------------------------------
// Form field — label above, input, helper/error below.
// ---------------------------------------------------------------------------
export const inputCls =
  'w-full rounded-2xl border border-brand-200 bg-sand-50 px-4 py-3 text-sm text-brand-900 outline-none transition-all placeholder:text-brand-300 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100/70'

export function Field({ label, hint, error, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && (
        <span className="text-sm font-semibold text-brand-800">
          {label} {hint && <span className="font-normal text-brand-400">{hint}</span>}
        </span>
      )}
      {children}
      {error && <span className="text-xs font-medium text-saffron-700">{error}</span>}
    </label>
  )
}

// ---------------------------------------------------------------------------
// Table shell — premium header, divided rows, hover wash. Compose with Th/Td.
// ---------------------------------------------------------------------------
export function TableWrap({ children, className = '' }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

export function Th({ className = '', children }) {
  return <th className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-brand-400 ${className}`}>{children}</th>
}

export function THead({ children }) {
  return (
    <thead className="border-b border-brand-100 bg-sand-50/40 text-left">
      <tr>{children}</tr>
    </thead>
  )
}

export function Td({ className = '', children }) {
  return <td className={`px-5 py-3.5 ${className}`}>{children}</td>
}

export function Tr({ className = '', children }) {
  return <tr className={`border-b border-brand-50 transition-colors hover:bg-sand-50/70 ${className}`}>{children}</tr>
}
