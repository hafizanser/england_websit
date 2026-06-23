import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Trash,
  Tag,
  Truck,
  ArrowRight,
  ShoppingBagOpen,
  WhatsappLogo,
  Check,
  X,
  ArrowLeft,
  ShieldCheck,
  Ticket,
  Gift,
  Package,
  CircleNotch,
  ArrowCounterClockwise,
  WarningCircle,
} from '@phosphor-icons/react'
import PageHeader from '../components/PageHeader'
import ProductCard from '../components/ProductCard'
import { ProductSkeleton } from '../components/ui'
import QuantityStepper from '../components/QuantityStepper'
import { useCart } from '../context/CartContext'
import { useNotify } from '../context/NotifyContext'
import { useAsync } from '../hooks/useAsync'
import { getTopSelling } from '../api/catalog'
import { validatePromoCode } from '../api/offers'
import { money, groupByProduct, unitLabelFor } from '../lib/cartEngine'
import { packSummary } from '../lib/pack'
import { waLink } from '../lib/whatsapp'
import { spring } from '../lib/motion'
import { imgSrc, onImgError } from '../lib/img'

// Normalise the messy product description (slashes / backslashes) into one
// readable, backslash-free string — same treatment the Products page uses.
const cleanSub = (sub) =>
  (sub || '')
    .replace(/\s*[\\/]\s*/g, ' · ')
    .replace(/\s+/g, ' ')
    .trim()

// Itemised WhatsApp order built from live cart state (Fix G).
//   "{product} — {qty} {unit} (Rs.{lineTotal})" … Subtotal / Promo / Total
function buildOrderMsg(items, totals, code) {
  const lines = items.map((i) => `• ${i.name} — ${i.qty} ${unitLabelFor(i.unitKey)} (${money(i.lineTotal)})`)
  const parts = [
    'Assalam o alaikum England! Mera order:',
    '',
    ...lines,
    '',
    `Subtotal: ${money(totals.subtotal)}`,
  ]
  if (code && totals.discount > 0) parts.push(`Promo: ${code} −${money(totals.discount)}`)
  parts.push(`Total: ${money(totals.total)}`, '', 'Meri dukaan ka pata: ')
  return parts.join('\n')
}

// One product card. Each unit (Carton / Box …) is its OWN editable row with a
// − / + stepper, so the line price and the order summary update live (Fix B/D).
// memo'd so an unrelated cart change doesn't re-render every card.
const CartGroup = memo(function CartGroup({ group, onRemove, reduce }) {
  const { setQty } = useCart()
  const pack = packSummary(group.units[0]?.conv || {})
  const sub = cleanSub(group.sub)

  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24, height: 0 }}
      transition={spring}
      className="flex gap-4 py-5"
    >
      <img
        src={imgSrc(group.image)}
        alt={group.name}
        loading="lazy"
        onError={onImgError}
        width="96"
        height="96"
        className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-1 ring-brand-100 sm:h-24 sm:w-24"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold leading-snug text-brand-900 sm:text-base">{group.name}</h3>
            {sub && <p className="mt-0.5 text-xs text-brand-500">{sub}</p>}
          </div>
          <p className="shrink-0 text-base font-extrabold tracking-tight text-brand-800">{money(group.total)}</p>
        </div>

        {/* consistent, backslash-free pack-size line (Fix C) */}
        {pack && (
          <p className="flex items-start gap-1 text-[11px] font-medium leading-snug text-brand-600">
            <Package size={13} weight="bold" className="mt-0.5 shrink-0 text-brand-400" />
            <span>{pack}</span>
          </p>
        )}

        {/* per-unit editable rows — stepper + that unit's line total (Fix B/D) */}
        <div className="mt-1 space-y-2">
          {group.units.map((u) => {
            const label = unitLabelFor(u.unitKey)
            return (
              <div key={u.key} className="flex items-center justify-between gap-3 rounded-2xl bg-sand-50 px-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <QuantityStepper
                    value={u.qty}
                    onChange={(q) => setQty(u.key, q)}
                    min={0}
                    size="sm"
                    unitLabel={label}
                  />
                  <span className="truncate text-xs font-semibold text-brand-600">
                    {label} · {money(u.wholesale)}/{label.toLowerCase()}
                  </span>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-brand-800">{money(u.lineTotal)}</span>
              </div>
            )
          })}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onRemove(group)}
            aria-label={`${group.name} cart se hatayein`}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-brand-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
          >
            <Trash size={15} weight="bold" /> Hatayein
          </button>
        </div>
      </div>
    </motion.li>
  )
})

// Promo code with real apply states: loading → success (green, recalculated) or
// inline error (Fix F). Existence is validated async; the *applied* outcome is
// read from totals.codeStatus so "min order not met" surfaces correctly.
function PromoBox() {
  const { code, applyCode, removeCode, totals } = useCart()
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const status = totals.codeStatus
  const discountAmount = totals.lines.find((l) => l.code)?.amount ?? totals.discount

  const submit = async (e) => {
    e.preventDefault()
    const c = value.trim().toUpperCase()
    if (!c || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await validatePromoCode(c, { subtotal: totals.subtotal })
      if (res.ok) {
        applyCode(c)
        setValue('')
      } else {
        setError(res.reason || 'Code ghalat ya expire ho gaya')
      }
    } catch {
      setError('Code apply nahi hua — dobara try karein')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-3xl border border-brand-100 bg-white p-5 shadow-soft">
      <div className="flex items-center gap-2 text-brand-800">
        <Ticket size={20} weight="fill" className="text-saffron-500" />
        <h3 className="text-sm font-bold">Promo code</h3>
      </div>

      {code ? (
        <div className="mt-3" aria-live="polite">
          {status?.ok ? (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
              <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-green-800">
                <Check size={16} weight="bold" className="shrink-0 text-green-600" />
                <span className="truncate">
                  {code} lag gaya{discountAmount > 0 ? ` — ${money(discountAmount)} off` : ''}
                </span>
              </span>
              <button
                type="button"
                onClick={removeCode}
                className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-green-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-500"
              >
                Hatayein
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-saffron-200 bg-saffron-50 px-4 py-3">
              <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-saffron-800">
                <X size={16} weight="bold" className="shrink-0 text-saffron-600" />
                <span className="truncate">{code} — {status?.reason || 'is cart par nahi lagta'}</span>
              </span>
              <button
                type="button"
                onClick={removeCode}
                className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-saffron-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-saffron-500"
              >
                Hatayein
              </button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="promo-code" className="sr-only">
            Promo code
          </label>
          <input
            id="promo-code"
            value={value}
            onChange={(e) => {
              setValue(e.target.value.toUpperCase())
              if (error) setError(null)
            }}
            placeholder="Jaise COMBO14"
            aria-invalid={!!error}
            aria-describedby={error ? 'promo-error' : undefined}
            className="min-h-[44px] w-full min-w-0 flex-1 rounded-2xl border border-brand-200 bg-sand-50 px-4 py-3 text-sm font-semibold tracking-wider text-brand-900 outline-none transition-all placeholder:font-normal placeholder:tracking-normal placeholder:text-brand-300 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-brand-700 px-5 py-3 text-sm font-bold text-white shadow-soft transition-all hover:bg-brand-800 active:translate-y-px disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-500 sm:w-auto"
          >
            {loading ? (
              <>
                <CircleNotch size={16} weight="bold" className="animate-spin" /> Lag raha hai…
              </>
            ) : (
              'Apply'
            )}
          </button>
        </form>
      )}

      {error && (
        <p id="promo-error" aria-live="polite" className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600">
          <WarningCircle size={14} weight="fill" /> {error}
        </p>
      )}

      <p className="mt-3 text-xs text-brand-400">
        Try karein: <span className="font-semibold text-brand-600">COMBO14</span>,{' '}
        <span className="font-semibold text-brand-600">PEHLA7</span>,{' '}
        <span className="font-semibold text-brand-600">NANHA12</span>
      </p>
    </div>
  )
}

// FREE items earned from buy-X-get-Y admin offers (unchanged).
function FreeItems({ freeItems }) {
  if (!freeItems.length) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-4xl border border-green-200 bg-green-50/60 p-5 shadow-soft sm:p-6"
    >
      <div className="flex items-center gap-2 text-green-700">
        <Gift size={20} weight="fill" />
        <h2 className="text-base font-extrabold tracking-tight text-green-800 sm:text-lg">Muft items — offer ke saath</h2>
      </div>
      <ul className="mt-3 space-y-2.5">
        {freeItems.map((f) => (
          <li key={f.key} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-green-100">
            <div className="relative shrink-0">
              <img src={imgSrc(f.image)} alt={f.name} loading="lazy" onError={onImgError} width="56" height="56" className="h-14 w-14 rounded-xl object-cover ring-1 ring-green-100" />
              <span className="absolute -left-1.5 -top-1.5 rounded-full bg-green-600 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white shadow">Free</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-brand-900">{f.name}</p>
              <p className="truncate text-xs text-green-700">{f.qty} {f.unit} · {f.offerTitle}</p>
            </div>
            <div className="shrink-0 text-right">
              <span className="inline-block rounded-full bg-green-600 px-2.5 py-1 text-xs font-extrabold text-white">Rs.0</span>
              {f.retail > 0 && <p className="mt-0.5 text-[10px] text-brand-400 line-through">{money(f.retail * f.qty)}</p>}
            </div>
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

// Loading state — skeleton item rows + skeleton summary, never a spinner (Fix H).
function CartSkeleton() {
  return (
    <section className="container-page py-12 sm:py-16">
      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-10">
        <div className="rounded-4xl border border-brand-100 bg-white p-5 shadow-soft sm:p-6">
          <div className="h-6 w-40 animate-pulse rounded-full bg-sand-200" />
          <div className="mt-4 divide-y divide-brand-100">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-4 py-5">
                <div className="h-20 w-20 shrink-0 animate-pulse rounded-2xl bg-sand-200 sm:h-24 sm:w-24" />
                <div className="flex-1 space-y-3 py-1">
                  <div className="h-4 w-3/4 animate-pulse rounded-full bg-sand-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded-full bg-sand-100" />
                  <div className="h-10 w-full animate-pulse rounded-2xl bg-sand-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-28 animate-pulse rounded-3xl bg-sand-200" />
          <div className="h-64 animate-pulse rounded-4xl bg-sand-200" />
        </div>
      </div>
    </section>
  )
}

function EmptyCart() {
  const top = useAsync(() => getTopSelling(), [])
  return (
    <section className="container-page py-16 sm:py-24">
      <div className="grid place-items-center rounded-4xl border border-dashed border-brand-200 bg-white px-6 py-16 text-center shadow-soft">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-brand-50 text-brand-300">
          <ShoppingBagOpen size={42} weight="duotone" />
        </span>
        <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-brand-900">Cart khaali hai — products dekhein</h2>
        <p className="urdu mt-1 text-lg text-brand-600" dir="rtl">
          ابھی کوئی مال نہیں
        </p>
        <p className="mt-2 max-w-sm text-sm text-brand-500">
          Apni dukaan ke liye products chunein — neeche sab se zyada bikne wale items hain.
        </p>
        <Link
          to="/products"
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-sm font-bold text-white shadow-soft transition-all hover:bg-brand-800 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-500"
        >
          Products browse karein <ArrowRight size={16} weight="bold" />
        </Link>
      </div>

      <div className="mt-14">
        <h3 className="text-xl font-extrabold tracking-tight text-brand-900">Top selling — abhi add karein</h3>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {top.loading && Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)}
          {!top.loading && top.data?.slice(0, 4).map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </div>
    </section>
  )
}

export default function CartPage() {
  const { items, freeItems, totals, clear, code, remove, restore } = useCart()
  const { confirm, success } = useNotify()
  const reduce = useReducedMotion()

  const groups = useMemo(() => groupByProduct(items), [items])

  // Honest loading gate: flips before paint, so instant local carts never flash a
  // skeleton, but the skeleton path is real if hydration is ever delayed (Fix H).
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => setReady(true), [])

  // 5s undo-remove (Fix E). Stash the removed line snapshots, then re-insert them
  // verbatim if the shopkeeper taps "Wapas laayein".
  const [undo, setUndo] = useState(null)
  const undoTimer = useRef(null)
  const [opError, setOpError] = useState(null)
  const lastAction = useRef(null)

  const runSafe = (fn) => {
    lastAction.current = fn
    try {
      fn()
      setOpError(null)
    } catch {
      setOpError('Update nahi hua — dobara try karein')
    }
  }

  const handleRemove = (group) => {
    const snapshot = group.units.map((u) => ({ ...u }))
    runSafe(() => {
      group.units.forEach((u) => remove(u.key))
      if (undoTimer.current) clearTimeout(undoTimer.current)
      setUndo({ name: group.name, units: snapshot })
      undoTimer.current = setTimeout(() => setUndo(null), 5000)
    })
  }

  const handleUndo = () => {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    runSafe(() => restore(undo.units))
    setUndo(null)
  }

  const handleClear = async () => {
    const ok = await confirm({
      tone: 'danger',
      title: 'Poora cart saaf karein?',
      text: 'Tamam items cart se hat jayenge.',
      confirmText: 'Haan, saaf karein',
      cancelText: 'Nahi',
    })
    if (ok) runSafe(() => { clear(); success('Cart saaf kar diya') })
  }

  const whatsappHref = useMemo(
    () => (items.length === 0 ? '#' : waLink(buildOrderMsg(items, totals, code))),
    [items, totals, code],
  )

  if (!ready) {
    return (
      <>
        <PageHeader eyebrow="Aapka Order" title="Cart" urdu="آپ کی ٹوکری" crumb="Cart" />
        <CartSkeleton />
      </>
    )
  }

  if (items.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Aapka Order" title="Cart" urdu="آپ کی ٹوکری" crumb="Cart" />
        <EmptyCart />
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Aapka Order"
        title="Cart &"
        accent="checkout"
        urdu="آرڈر مکمل کریں"
        desc={`${groups.length} products (${totals.count} units) aapki dukaan ke liye taiyaar.`}
        crumb="Cart"
      />

      {/* extra bottom padding on mobile so the sticky checkout bar never covers content */}
      <section className="container-page py-12 pb-40 sm:py-16 md:pb-16">
        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-10">
          {/* items + promo (first on mobile) */}
          <div className="space-y-6">
            <div className="rounded-4xl border border-brand-100 bg-white p-5 shadow-soft sm:p-6">
              <div className="flex items-center justify-between border-b border-brand-100 pb-4">
                <h2 className="text-lg font-extrabold tracking-tight text-brand-900">
                  Order items ({groups.length})
                </h2>
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-brand-500 transition-colors hover:text-saffron-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-500"
                >
                  <Trash size={15} weight="bold" /> Saaf karein
                </button>
              </div>

              {/* undo-remove snackbar (Fix E) */}
              <AnimatePresence>
                {undo && (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, height: 0 }}
                    animate={reduce ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-brand-900 px-4 py-3 text-white">
                      <span className="min-w-0 truncate text-sm font-semibold">Item hata diya</span>
                      <button
                        type="button"
                        onClick={handleUndo}
                        className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      >
                        <ArrowCounterClockwise size={14} weight="bold" /> Wapas laayein
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* inline op-error + retry (Fix H) */}
              {opError && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-red-700">
                    <WarningCircle size={15} weight="fill" /> {opError}
                  </span>
                  <button
                    type="button"
                    onClick={() => lastAction.current && runSafe(lastAction.current)}
                    className="shrink-0 rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                  >
                    Dobara try karein
                  </button>
                </div>
              )}

              <ul className="divide-y divide-brand-100">
                <AnimatePresence initial={false}>
                  {groups.map((group) => (
                    <CartGroup key={group.id} group={group} onRemove={handleRemove} reduce={reduce} />
                  ))}
                </AnimatePresence>
              </ul>
            </div>

            <FreeItems freeItems={freeItems} />

            <Link
              to="/products"
              className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-500"
            >
              <ArrowLeft size={16} weight="bold" /> Aur shopping karein
            </Link>
          </div>

          {/* promo + summary (second on mobile) */}
          <div className="space-y-4 lg:sticky lg:top-[100px] lg:self-start">
            <PromoBox />

            <div className="rounded-3xl border border-brand-100 bg-white p-5 shadow-soft">
              <p className="flex items-center gap-2 text-sm font-semibold text-brand-700">
                <Truck size={18} weight="fill" className="text-brand-600" />
                Har order par muft delivery — koi charges nahi.
              </p>
            </div>

            {/* totals */}
            <div className="rounded-4xl border border-brand-100 bg-white p-6 shadow-soft">
              <h3 className="text-lg font-extrabold tracking-tight text-brand-900">Order summary</h3>
              <dl className="mt-4 space-y-2.5 text-sm" aria-live="polite">
                <div className="flex justify-between text-brand-600">
                  <dt>Subtotal</dt>
                  <dd className="font-semibold tabular-nums">{money(totals.subtotal)}</dd>
                </div>
                <AnimatePresence>
                  {totals.lines.map((l) => (
                    <motion.div
                      key={l.id}
                      initial={reduce ? false : { opacity: 0, height: 0 }}
                      animate={reduce ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      className="flex justify-between text-green-700"
                    >
                      <dt className="flex items-center gap-1.5">
                        <Tag size={13} weight="fill" /> {l.note || l.label}
                      </dt>
                      <dd className="font-semibold tabular-nums">− {money(l.amount)}</dd>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div className="flex justify-between text-brand-600">
                  <dt>Delivery</dt>
                  <dd className="font-semibold text-green-700">Free</dd>
                </div>
              </dl>

              <div className="mt-4 flex items-center justify-between border-t border-dashed border-brand-200 pt-4">
                <span className="text-base font-bold text-brand-900">Total</span>
                <span className="text-2xl font-extrabold tracking-tight text-brand-800 tabular-nums" aria-live="polite">
                  {money(totals.total)}
                </span>
              </div>

              {/* Honest savings basis (Fix A): retail vs your wholesale rate, never > total */}
              {totals.savings > 0 && (
                <p className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-center text-xs font-bold text-green-700 ring-1 ring-green-200">
                  Wholesale rate pe aap {money(totals.savings)} bachate hain{' '}
                  <span className="font-medium text-green-600">(retail vs aapka rate)</span>
                </p>
              )}

              <Link
                to="/checkout"
                className="mt-5 flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-brand-700 px-6 py-4 text-base font-bold text-white shadow-soft transition-all hover:bg-brand-800 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-500"
              >
                Checkout par jayein <ArrowRight size={18} weight="bold" />
              </Link>
              {/* WhatsApp given equal/primary weight for the WhatsApp-first audience (Fix G) */}
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-6 py-4 text-base font-bold text-white shadow-soft transition-all hover:bg-[#1ebe5d] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1ebe5d]"
              >
                <WhatsappLogo size={20} weight="fill" /> Ya WhatsApp par bhejein
              </a>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-brand-500">
                <ShieldCheck size={14} weight="fill" /> Asli maal · Koi advance nahi · Cash on delivery
              </p>
              <p className="mt-1 text-center text-[11px] text-brand-400">
                Checkout pe sirf address + confirm — payment delivery pe (COD).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky mobile checkout bar — always visible while scrolling (Fix I) */}
      <div
        className="fixed inset-x-0 z-30 px-3 md:hidden"
        style={{ bottom: 'calc(3.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="rounded-3xl bg-white p-2.5 shadow-lift ring-1 ring-brand-100">
          <div className="flex items-center justify-between px-2 pb-1.5">
            <span className="text-xs font-semibold text-brand-500">Total</span>
            <span className="text-base font-extrabold tabular-nums text-brand-900" aria-live="polite">{money(totals.total)}</span>
          </div>
          <div className="flex items-stretch gap-2">
            <Link
              to="/checkout"
              className="inline-flex min-h-[44px] flex-[2] items-center justify-center gap-1.5 rounded-2xl bg-brand-700 px-4 text-sm font-bold text-white shadow-soft transition-colors hover:bg-brand-800 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-500"
            >
              Checkout par jayein <ArrowRight size={16} weight="bold" />
            </Link>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp par order bhejein"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[#25D366] px-4 text-sm font-bold text-white transition-colors hover:bg-[#1ebe5d] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1ebe5d]"
            >
              <WhatsappLogo size={18} weight="fill" /> WhatsApp
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
