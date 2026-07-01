import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import {
  ShoppingBagOpen,
  ArrowRight,
  WarningCircle,
  ShieldCheck,
  Tag,
  Storefront,
  CheckCircle,
  Truck,
  WhatsappLogo,
  CaretDown,
} from '@phosphor-icons/react'
import PageHeader from '../components/PageHeader'
import { useCart } from '../context/CartContext'
import { useCustomerAuth } from '../context/CustomerAuthContext'
import { useNotify } from '../context/NotifyContext'
import { placeOrder } from '../api/orders'
import { money, unitLabelFor, groupByProduct } from '../lib/cartEngine'
import { stockForUnit } from '../lib/pack'
import { waLink } from '../lib/whatsapp'
import { imgSrc, onImgError } from '../lib/img'

// Served delivery cities (the 47-city network). Single source for the city
// picker + out-of-area check. TODO: move to data/site.js if reused elsewhere.
const DELIVERY_CITIES = [
  'Karachi', 'Lahore', 'Faisalabad', 'Rawalpindi', 'Islamabad', 'Gujranwala', 'Peshawar', 'Multan',
  'Hyderabad', 'Quetta', 'Bahawalpur', 'Sargodha', 'Sialkot', 'Sukkur', 'Larkana', 'Sheikhupura',
  'Rahim Yar Khan', 'Jhang', 'Dera Ghazi Khan', 'Gujrat', 'Sahiwal', 'Wah Cantonment', 'Mardan',
  'Kasur', 'Okara', 'Mingora', 'Nawabshah', 'Chiniot', 'Kotri', 'Kamoke', 'Hafizabad', 'Sadiqabad',
  'Mirpur Khas', 'Burewala', 'Kohat', 'Khanewal', 'Dera Ismail Khan', 'Muzaffargarh', 'Abbottabad',
  'Mandi Bahauddin', 'Shikarpur', 'Jacobabad', 'Jhelum', 'Khanpur', 'Khairpur', 'Bahawalnagar', 'Vehari',
]
const cityServed = (v) => DELIVERY_CITIES.some((c) => c.toLowerCase() === String(v || '').trim().toLowerCase())

const PHONE_RE = /^03\d{9}$/

// Itemised WhatsApp order built from live cart + form state (Fix G), mirroring
// the Cart page format: "{product} — {qty} {unit} (Rs.{lineTotal})".
function buildOrderMsg(items, totals, form, code) {
  const lines = items.map((i) => `• ${i.name} — ${i.qty} ${unitLabelFor(i.unitKey)} (${money(i.lineTotal)})`)
  const parts = ['Assalam o alaikum England! Mera order confirm karein:', '', ...lines, '', `Total: ${money(totals.total)}`]
  if (code && totals.discount > 0) parts.push(`Promo: ${code} −${money(totals.discount)}`)
  parts.push('', `Dukaan: ${form.name || '-'}`, `Mobile: ${form.phone || '-'}`, `Shehar: ${form.city || '-'}`, `Pata: ${form.address || '-'}`)
  return parts.join('\n')
}

function Field({ id, label, hint, error, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-brand-800">
        {label}
        {required && <span className="text-saffron-600"> *</span>}
        {hint && <span className="font-normal text-brand-500"> {hint}</span>}
      </label>
      {children}
      {error && (
        <span id={`${id}-err`} className="flex items-center gap-1.5 text-xs font-medium text-saffron-700">
          <WarningCircle size={14} weight="fill" /> {error}
        </span>
      )}
    </div>
  )
}

const inputCls =
  'min-h-[44px] rounded-2xl border border-brand-200 bg-sand-50 px-4 py-3 text-sm text-brand-900 outline-none transition-all placeholder:text-brand-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500'

// Order summary line-items + totals. memo'd and fed only cart-derived props
// (stable refs from context) so typing in the form never re-renders it (Fix J).
const OrderSummary = memo(function OrderSummary({ items, totals, productCount }) {
  return (
    <>
      <ul className="max-h-64 space-y-3 overflow-y-auto pr-1">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-3">
            <img
              src={imgSrc(i.image)}
              alt={i.name}
              loading="lazy"
              onError={onImgError}
              width="48"
              height="48"
              className="aspect-square h-12 w-12 rounded-xl object-cover ring-1 ring-brand-100"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-brand-900">{i.name}</p>
              {/* Always show the unit so two units of one product never look duplicate (Fix A) */}
              <p className="text-xs text-brand-500">
                {i.qty} {unitLabelFor(i.unitKey)} × {money(i.wholesale)}
              </p>
            </div>
            <span className="text-sm font-extrabold text-brand-800 tabular-nums">{money(i.lineTotal)}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-4 space-y-2 border-t border-brand-100 pt-4 text-sm">
        {/* Distinct products • total units — same counter as the Cart (Fix B) */}
        <div className="flex justify-between text-brand-600">
          <dt>Subtotal ({productCount} {productCount === 1 ? 'product' : 'products'} • {totals.count} units)</dt>
          <dd className="font-semibold tabular-nums">{money(totals.subtotal)}</dd>
        </div>
        {totals.lines.map((l) => (
          <div key={l.id} className="flex justify-between text-green-700">
            <dt className="flex items-center gap-1.5"><Tag size={13} weight="fill" /> {l.note || l.label}</dt>
            <dd className="font-semibold tabular-nums">− {money(l.amount)}</dd>
          </div>
        ))}
        <div className="flex justify-between text-brand-600">
          <dt className="flex items-center gap-1.5"><Truck size={14} weight="fill" /> Delivery</dt>
          <dd className="font-semibold text-green-700">Free</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-between border-t border-dashed border-brand-200 pt-4">
        <span className="text-base font-bold text-brand-900">Total</span>
        <span className="text-2xl font-extrabold tracking-tight text-brand-800 tabular-nums" aria-live="polite">
          {money(totals.total)}
        </span>
      </div>

      {/* Savings line — identical wording/basis to the Cart (Fix C) */}
      {totals.savings > 0 && (
        <p className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-center text-xs font-bold text-green-700 ring-1 ring-green-200">
          Wholesale rate pe aap {money(totals.savings)} bachate hain{' '}
          <span className="font-medium text-green-600">(retail vs aapka rate)</span>
        </p>
      )}
    </>
  )
})

// Delivery + payment reassurance shown near every CTA (Fix F).
function TrustLines() {
  return (
    <div className="mt-3 space-y-1.5 text-center text-xs">
      <p className="flex items-center justify-center gap-1.5 font-medium text-brand-600">
        <Truck size={14} weight="fill" className="text-brand-500" /> Agle din aapke shehar mein delivery.
      </p>
      <p className="flex items-center justify-center gap-1.5 text-brand-500">
        <ShieldCheck size={14} weight="fill" /> Payment: Cash on delivery — koi advance nahi.
      </p>
    </div>
  )
}

export default function CheckoutPage() {
  const { items, totals, code, clear } = useCart()
  const { customer, adoptSession } = useCustomerAuth()
  const { success } = useNotify()
  const navigate = useNavigate()
  const reduce = useReducedMotion()

  // Fields start EMPTY. Only a logged-in customer's details are auto-filled.
  const [form, setForm] = useState({ name: '', phone: '', city: '', address: '', email: '', note: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [placed, setPlaced] = useState(null) // success snapshot { code, items, totals, form }
  const [sumOpen, setSumOpen] = useState(false) // mobile summary accordion

  // Prefill from the logged-in account once it resolves — never overwrite typing.
  useEffect(() => {
    if (!customer) return
    setForm((f) => ({
      ...f,
      name: f.name || customer.name || '',
      phone: f.phone || customer.phone || '',
      city: f.city || customer.city || '',
      address: f.address || customer.address || '',
      email: f.email || customer.email || '',
    }))
  }, [customer])

  // Refs for required fields so we can jump to the first invalid one on submit.
  const fieldRefs = { name: useRef(null), phone: useRef(null), city: useRef(null), address: useRef(null) }

  const update = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((er) => ({ ...er, [key]: undefined }))
  }
  // Mobile number — digits only, capped at 11.
  const updatePhone = (e) => {
    const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 11)
    setForm((f) => ({ ...f, phone: digits }))
    setErrors((er) => ({ ...er, phone: undefined }))
  }

  const cityOutOfArea = form.city.trim() !== '' && !cityServed(form.city)

  // Cart-derived values (stable across keystrokes) — kept out of OrderSummary's
  // re-render path; the WhatsApp link does depend on form, so it recomputes here.
  const productCount = useMemo(() => groupByProduct(items).length, [items])
  const liveWaHref = useMemo(() => waLink(buildOrderMsg(items, totals, form, code)), [items, totals, form, code])

  // Stock guard — admin stock is the single source of truth. Any line that is out
  // of stock or exceeds available stock blocks checkout (the backend re-validates).
  // Only enforce when stock is a KNOWN number (null = unknown → backend decides),
  // so pre-existing carts / live-only products are never falsely blocked.
  // Compare each line's qty against its stock IN THAT LINE'S UNIT. Stock is held
  // in cartons, so 480 boxes (= 20 cartons) is valid and must not be flagged.
  const stockIssues = useMemo(
    () => items.filter((i) => typeof i.stock === 'number' && (i.stock <= 0 || i.qty > stockForUnit(i.stock, i.unitKey, i.conv))),
    [items],
  )
  const hasStockIssue = stockIssues.length > 0

  const focusFirstError = (e) => {
    const first = ['name', 'phone', 'city', 'address'].find((k) => e[k])
    const el = first && fieldRefs[first]?.current
    if (el) {
      el.focus({ preventScroll: true })
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const validate = () => {
    const e = {}
    if (form.name.trim().length < 3) e.name = 'Naam likhein (kam az kam 3 harf).'
    if (!PHONE_RE.test(form.phone.replace(/[^0-9]/g, ''))) e.phone = 'Sahi mobile number likhein (03xx-xxxxxxx).'
    if (!form.city.trim()) e.city = 'Apna shehar chunein.'
    else if (!cityServed(form.city)) e.city = 'Is shehar mein abhi delivery nahi — WhatsApp pe poochein.'
    if (form.address.trim().length < 6) e.address = 'Dukaan ka poora pata likhein.'
    setErrors(e)
    if (Object.keys(e).length) focusFirstError(e)
    return Object.keys(e).length === 0
  }

  const submit = async (e) => {
    e.preventDefault()
    if (submitting) return // double-submit guard
    setServerError('')
    if (hasStockIssue) {
      setServerError('Kuch items stock se zyada hain — cart update karein.')
      return
    }
    if (!validate()) return
    setSubmitting(true)
    try {
      const { order, session } = await placeOrder({
        ...form,
        code: code || null,
        items: items.map((i) => ({ id: i.id, qty: i.qty, unit: i.unitKey })),
      })
      // Snapshot BEFORE clearing the cart so the success screen can render the order.
      const snapshot = { code: order.code, items, totals, form: { ...form } }
      if (session?.token) adoptSession(session.customer, session.token)
      clear()
      success(`Order ${order.code} place ho gaya!`)
      setPlaced(snapshot)
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    } catch (err) {
      if (err.fields) setErrors(err.fields)
      // Preserve everything the user typed; just surface the failure (Fix H).
      setServerError(err.message || 'Order submit nahi hua — dobara try karein.')
    } finally {
      setSubmitting(false)
    }
  }

  // ---- SUCCESS SCREEN (Fix G) — shown after a confirmed order ---------------
  if (placed) {
    const waConfirm = waLink(buildOrderMsg(placed.items, placed.totals, placed.form, code))
    return (
      <>
        <PageHeader eyebrow="Checkout" title="Order" accent="mil gaya!" urdu="آرڈر مل گیا" crumb="Checkout" />
        <section className="container-page py-12 sm:py-16">
          <div className="mx-auto max-w-xl space-y-6">
            <div className="rounded-4xl border border-green-200 bg-green-50/70 p-6 text-center shadow-soft sm:p-8">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-600 text-white">
                <CheckCircle size={36} weight="fill" />
              </span>
              <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-brand-900">Order mil gaya! ✓</h2>
              <p className="mt-2 text-sm text-brand-600">
                Hum WhatsApp pe confirm karenge — agle din aapke shehar mein delivery.
              </p>
              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-800 ring-1 ring-brand-100">
                Order #: <span className="tabular-nums text-brand-900">{placed.code}</span>
              </p>
            </div>

            <div className="rounded-4xl border border-brand-100 bg-white p-6 shadow-soft">
              <h3 className="text-lg font-extrabold tracking-tight text-brand-900">Order summary</h3>
              <div className="mt-4">
                <OrderSummary items={placed.items} totals={placed.totals} productCount={groupByProduct(placed.items).length} />
              </div>
            </div>

            <div className="grid gap-3">
              <a
                href={waConfirm}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-6 py-4 text-base font-bold text-white shadow-soft transition-all hover:bg-[#1ebe5d] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1ebe5d]"
              >
                <WhatsappLogo size={20} weight="fill" /> WhatsApp pe confirm karein
              </a>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
                <Link to={`/order/${placed.code}`} className="font-semibold text-brand-700 hover:text-brand-900">Order track karein →</Link>
                <Link to="/products" className="font-semibold text-brand-700 hover:text-brand-900">Aur shopping karein →</Link>
              </div>
            </div>
          </div>
        </section>
      </>
    )
  }

  if (items.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Checkout" title="Order mukammal karein" urdu="آرڈر مکمل کریں" crumb="Checkout" />
        <section className="container-page py-16 sm:py-24">
          <div className="grid place-items-center rounded-4xl border border-dashed border-brand-200 bg-white px-6 py-16 text-center shadow-soft">
            <span className="grid h-20 w-20 place-items-center rounded-full bg-brand-50 text-brand-300">
              <ShoppingBagOpen size={42} weight="duotone" />
            </span>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-brand-900">Cart khali hai</h2>
            <p className="mt-2 max-w-sm text-sm text-brand-500">Checkout se pehle apni dukaan ke liye maal chunein.</p>
            <Link
              to="/products"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-sm font-bold text-white shadow-soft transition-all hover:bg-brand-800 active:translate-y-px"
            >
              Shopping shuru karein <ArrowRight size={16} weight="bold" />
            </Link>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Checkout"
        title="Order"
        accent="mukammal karein"
        urdu="چند تفصیلات، اور آرڈر مکمل"
        desc="Login ki zaroorat nahi — bas tafseelat bharein. Aapka account khud ban jayega (koi password nahi — sirf order track karne ke liye)."
        crumb="Checkout"
      />

      {/* extra bottom padding on mobile so the sticky bar never covers content */}
      <section className="container-page py-12 pb-44 sm:py-16 lg:pb-16">
        <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
          {/* Mobile collapsible summary at the TOP (Fix I) */}
          <div className="lg:hidden">
            <div className="overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft">
              <button
                type="button"
                onClick={() => setSumOpen((o) => !o)}
                aria-expanded={sumOpen}
                aria-controls="mobile-order-summary"
                className="flex min-h-[52px] w-full items-center justify-between gap-3 px-5 py-3.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                <span className="text-sm font-semibold text-brand-700">
                  Total <span className="text-base font-extrabold text-brand-900 tabular-nums">{money(totals.total)}</span>
                  <span className="ml-2 text-brand-500">— tafseel dekhein</span>
                </span>
                <CaretDown size={18} weight="bold" className={`shrink-0 text-brand-500 transition-transform ${sumOpen ? 'rotate-180' : ''}`} />
              </button>
              {sumOpen && (
                <div id="mobile-order-summary" className="border-t border-brand-100 px-5 pb-5 pt-4">
                  <OrderSummary items={items} totals={totals} productCount={productCount} />
                </div>
              )}
            </div>
          </div>

          {/* details */}
          <div className="space-y-6">
            <div className="rounded-4xl border border-brand-100 bg-white p-6 shadow-soft sm:p-8">
              <div className="flex items-center gap-2 text-brand-700">
                <Storefront size={22} weight="fill" />
                <h2 className="text-lg font-extrabold tracking-tight text-brand-900">Dukaan ki tafseelat</h2>
              </div>
              {customer && (
                <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-brand-500">
                  <CheckCircle size={14} weight="fill" className="text-brand-500" />
                  Pehle se mojood account: {customer.phone}
                </p>
              )}

              <div className="mt-5 grid gap-4">
                <Field id="ck-name" label="Dukaandar / Dukaan ka naam" required error={errors.name}>
                  <input
                    id="ck-name"
                    ref={fieldRefs.name}
                    className={inputCls}
                    value={form.name}
                    onChange={update('name')}
                    placeholder="Jaise: Imran Qureshi / Qureshi Karyana"
                    autoComplete="name"
                    aria-required="true"
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? 'ck-name-err' : undefined}
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="ck-phone" label="Mobile number" required error={errors.phone}>
                    <div className="flex min-h-[44px] items-center gap-2 rounded-2xl border border-brand-200 bg-sand-50 px-4 transition-all focus-within:border-brand-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
                      <input
                        id="ck-phone"
                        ref={fieldRefs.phone}
                        className="w-full bg-transparent py-3 text-sm tabular-nums tracking-wide text-brand-900 outline-none placeholder:text-brand-400"
                        type="tel"
                        inputMode="tel"
                        value={form.phone}
                        onChange={updatePhone}
                        placeholder="03124361300"
                        autoComplete="tel"
                        aria-required="true"
                        aria-invalid={!!errors.phone}
                        aria-describedby={errors.phone ? 'ck-phone-err' : undefined}
                      />
                      <span className={`shrink-0 text-xs font-bold tabular-nums ${form.phone.length === 11 ? 'text-green-600' : 'text-brand-500'}`}>{form.phone.length}/11</span>
                    </div>
                  </Field>

                  <Field id="ck-city" label="Shehar" required error={errors.city}>
                    <input
                      id="ck-city"
                      ref={fieldRefs.city}
                      list="ck-cities"
                      className={inputCls}
                      value={form.city}
                      onChange={update('city')}
                      placeholder="Shehar chunein / likhein"
                      autoComplete="address-level2"
                      aria-required="true"
                      aria-invalid={!!errors.city}
                      aria-describedby={errors.city ? 'ck-city-err' : undefined}
                    />
                    <datalist id="ck-cities">
                      {DELIVERY_CITIES.map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </Field>
                </div>

                {/* Out-of-area → WhatsApp instead of an order that can't be delivered (Fix D) */}
                {cityOutOfArea && (
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-saffron-200 bg-saffron-50 px-4 py-3 text-xs font-medium text-saffron-800">
                    <WarningCircle size={16} weight="fill" className="shrink-0" />
                    <span>Is shehar mein abhi delivery nahi —</span>
                    <a
                      href={waLink(`Assalam o alaikum England! Kya aap ${form.city.trim()} mein delivery karte hain?`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-[#1ebe5d] underline underline-offset-2"
                    >
                      <WhatsappLogo size={14} weight="fill" /> WhatsApp pe poochein
                    </a>
                  </div>
                )}

                <Field id="ck-address" label="Dukaan ka poora pata" required error={errors.address}>
                  <textarea
                    id="ck-address"
                    ref={fieldRefs.address}
                    className={`${inputCls} min-h-[84px] resize-none`}
                    value={form.address}
                    onChange={update('address')}
                    placeholder="Shop #, market/area, landmark, shehar"
                    autoComplete="street-address"
                    aria-required="true"
                    aria-invalid={!!errors.address}
                    aria-describedby={errors.address ? 'ck-address-err' : undefined}
                  />
                </Field>

                <Field id="ck-email" label="Email" hint="(optional)" error={errors.email}>
                  <input id="ck-email" className={inputCls} type="email" value={form.email} onChange={update('email')} placeholder="aap@example.com" autoComplete="email" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'ck-email-err' : undefined} />
                </Field>
                <Field id="ck-note" label="Order note" hint="(optional)" error={errors.note}>
                  <input id="ck-note" className={inputCls} value={form.note} onChange={update('note')} placeholder="Koi khaas hidayat?" />
                </Field>
              </div>
            </div>

            {hasStockIssue && (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <p className="flex items-center gap-2 font-bold">
                  <WarningCircle size={18} weight="fill" /> Stock update ho gaya — order se pehle theek karein:
                </p>
                <ul className="mt-2 space-y-1 pl-7 text-[13px] font-medium">
                  {stockIssues.map((i) => (
                    <li key={i.key} className="list-disc">
                      {i.name} — {Number(i.stock) <= 0 ? 'Out of Stock' : `Only ${stockForUnit(i.stock, i.unitKey, i.conv)} ${unitLabelFor(i.unitKey)} available`}
                    </li>
                  ))}
                </ul>
                <Link to="/cart" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-red-700 underline underline-offset-2">
                  Cart theek karein →
                </Link>
              </div>
            )}

            {serverError && (
              <p role="alert" className="flex items-center gap-2 rounded-2xl bg-saffron-50 px-4 py-3 text-sm font-medium text-saffron-800">
                <WarningCircle size={18} weight="fill" /> {serverError}
              </p>
            )}

            <Link to="/cart" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-900">
              ← Cart edit karein
            </Link>
          </div>

          {/* summary — desktop only (mobile uses the top accordion + sticky bar) */}
          <div className="hidden lg:block lg:sticky lg:top-[100px] lg:self-start">
            <div className="rounded-4xl border border-brand-100 bg-white p-6 shadow-soft">
              <h3 className="text-lg font-extrabold tracking-tight text-brand-900">Order summary</h3>
              <div className="mt-4">
                <OrderSummary items={items} totals={totals} productCount={productCount} />
              </div>

              <button
                type="submit"
                disabled={submitting || hasStockIssue}
                aria-busy={submitting}
                className="mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-6 py-4 text-base font-bold text-white shadow-soft transition-all hover:bg-brand-800 active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-500"
              >
                {submitting ? (
                  <>
                    <motion.span
                      className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white"
                      animate={reduce ? {} : { rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                    />
                    Order place ho raha hai...
                  </>
                ) : (
                  <>Order confirm karein <ArrowRight size={18} weight="bold" /></>
                )}
              </button>

              {/* Secondary WhatsApp-confirm path (Fix G) */}
              <a
                href={liveWaHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-6 py-4 text-base font-bold text-white shadow-soft transition-all hover:bg-[#1ebe5d] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1ebe5d]"
              >
                <WhatsappLogo size={20} weight="fill" /> Ya WhatsApp par confirm karein
              </a>

              <TrustLines />
            </div>
          </div>

          {/* Sticky bottom bar — mobile/tablet only (Fix I) */}
          <div
            className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-100 bg-white/95 px-3 pt-2.5 backdrop-blur lg:hidden"
            style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <span className="text-xs font-semibold text-brand-500">Total</span>
              <span className="text-base font-extrabold tabular-nums text-brand-900" aria-live="polite">{money(totals.total)}</span>
            </div>
            <div className="flex items-stretch gap-2">
              <button
                type="submit"
                disabled={submitting || hasStockIssue}
                aria-busy={submitting}
                className="inline-flex min-h-[48px] flex-[2] items-center justify-center gap-1.5 rounded-2xl bg-brand-700 px-4 text-sm font-bold text-white shadow-soft transition-colors hover:bg-brand-800 active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-500"
              >
                {submitting ? 'Place ho raha hai...' : <>Order confirm karein <ArrowRight size={16} weight="bold" /></>}
              </button>
              <a
                href={liveWaHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp par confirm karein"
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[#25D366] px-4 text-sm font-bold text-white transition-colors hover:bg-[#1ebe5d] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1ebe5d]"
              >
                <WhatsappLogo size={18} weight="fill" /> WhatsApp
              </a>
            </div>
          </div>
        </form>

        {/* mobile-only clarity lines (the desktop card carries its own copy) */}
        <div className="mt-6 lg:hidden">
          <TrustLines />
        </div>
      </section>
    </>
  )
}
