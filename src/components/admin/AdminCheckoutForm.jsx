import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, Money, Receipt, SpinnerGap, WarningCircle } from '@phosphor-icons/react'
import { inputCls } from './ui'
import { money } from '../../lib/cartEngine'
import { useCart } from '../../context/CartContext'
import { createAdminOrder } from '../../api/admin'
import { quoteCart } from '../../api/orders'

const PANEL = 'rounded-[14px] border border-[#E6DCC5] bg-[#FBF7EE] shadow-[0_1px_2px_rgba(58,46,31,0.06),0_1px_3px_rgba(58,46,31,0.05)]'

function Field({ label, hint, error, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-[#3A2E1F]">
        {label} {hint && <span className="font-normal text-[#9C9078]">{hint}</span>}
      </span>
      {children}
      {error && <span className="text-xs font-medium text-red-600">{error}</span>}
    </label>
  )
}

// Checkout for the admin New Order flow. Collects the customer details the
// backend requires, shows a SERVER-priced order summary (never the browser's own
// total), and submits through the existing admin order API — which re-prices,
// re-checks stock, and writes the order + items in one transaction.
export default function AdminCheckoutForm() {
  const { rows, items, clear, toast } = useCart()
  const [form, setForm] = useState({ name: '', phone: '', address: '', email: '', city: '', note: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [placed, setPlaced] = useState(null)
  const [quote, setQuote] = useState(null)
  const [quoting, setQuoting] = useState(false)
  const inFlight = useRef(false)

  // Stable signature of the cart lines → re-quote only when they actually change.
  const sig = useMemo(() => rows.map((r) => `${r.id}:${r.unitKey}:${r.qty}`).join('|'), [rows])
  const localSubtotal = items.reduce((s, i) => s + i.lineTotal, 0)

  // Authoritative totals from the server (prices + offers), debounced.
  useEffect(() => {
    if (!rows.length) { setQuote(null); setQuoting(false); return }
    let alive = true
    setQuoting(true)
    const t = setTimeout(async () => {
      try {
        const totals = await quoteCart(rows.map((r) => ({ id: r.id, qty: r.qty, unit: r.unitKey })))
        if (alive) setQuote(totals)
      } catch {
        if (alive) setQuote(null) // fall back to the local snapshot subtotal
      } finally {
        if (alive) setQuoting(false)
      }
    }, 300)
    return () => { alive = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  const summary = quote || { subtotal: localSubtotal, discount: 0, total: localSubtotal }

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }))
  }

  // Mirrors the backend's admin validation so the admin is told before submit.
  const validate = () => {
    const e = {}
    if (form.name.trim().length < 3) e.name = 'Customer ka naam likhein (kam az kam 3 harf).'
    if (form.phone.replace(/\D/g, '').length < 10) e.phone = 'Sahi mobile number likhein (03xx-xxxxxxx).'
    if (form.address.trim().length < 6) e.address = 'Customer ka poora pata likhein.'
    if (!rows.length) e.items = 'Kam az kam ek product add karein.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const place = async () => {
    if (inFlight.current || submitting) return // duplicate-submit guard
    if (!validate()) return
    inFlight.current = true
    setSubmitting(true)
    setSubmitError('')
    try {
      const order = await createAdminOrder({
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        email: form.email.trim(),
        city: form.city.trim(),
        note: form.note.trim(),
        items: rows.map((r) => ({ id: r.id, qty: r.qty, unit: r.unitKey })),
      })
      setPlaced(order)
      clear()
      toast(`Order ${order.code || ''} ban gaya`, 'success')
    } catch (err) {
      if (err.fields) setErrors(err.fields)
      setSubmitError(err.message || 'Order place nahi hua. Dobara koshish karein.')
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  // ---- success state -------------------------------------------------------
  if (placed) {
    const newOrder = () => {
      setPlaced(null)
      setForm({ name: '', phone: '', address: '', email: '', city: '', note: '' })
      setErrors({})
      setSubmitError('')
    }
    return (
      <div className={`${PANEL} p-5`}>
        <div className="grid place-items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-green-100 text-green-700">
            <CheckCircle size={30} weight="fill" />
          </span>
          <p className="mt-3 text-base font-extrabold text-[#2A2117]">Order ban gaya ✅</p>
          <p className="mt-1 text-sm text-[#6E6250]">
            Order <span className="font-bold text-[#2A2117]">{placed.code}</span> dashboard mein save ho gaya.
          </p>
          <p className="mt-1 text-[13px] font-semibold text-[#9C9078]">Total: {money(placed.total)} · Cash on Delivery</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            to={`/admin/orders/${placed.id}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-700 px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-brand-800"
          >
            <Receipt size={15} weight="bold" /> Order dekhein
          </Link>
          <button
            type="button"
            onClick={newOrder}
            className="inline-flex items-center justify-center rounded-full border border-[#D9CDB1] bg-white px-4 py-2.5 text-[13px] font-bold text-[#3A2E1F] transition-colors hover:border-[#3A2E1F]"
          >
            Naya order
          </button>
        </div>
      </div>
    )
  }

  // ---- checkout form -------------------------------------------------------
  const disabled = submitting || !rows.length

  return (
    <div className={`${PANEL} p-4`}>
      <h2 className="mb-3 text-base font-extrabold tracking-[-0.01em] text-[#2A2117]">Checkout</h2>

      <div className="flex flex-col gap-3">
        <Field label="Customer ka naam" error={errors.name}>
          <input className={inputCls} value={form.name} onChange={set('name')} placeholder="Poora naam" autoComplete="off" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mobile number" error={errors.phone}>
            <input className={inputCls} value={form.phone} onChange={set('phone')} placeholder="03xx-xxxxxxx" inputMode="tel" autoComplete="off" />
          </Field>
          <Field label="Sheher" hint="(optional)">
            <input className={inputCls} value={form.city} onChange={set('city')} placeholder="Sheher" autoComplete="off" />
          </Field>
        </div>
        <Field label="Delivery address" error={errors.address}>
          <textarea className={`${inputCls} min-h-[64px] resize-y`} value={form.address} onChange={set('address')} placeholder="Dukaan / ghar ka poora pata" />
        </Field>
        <Field label="Email" hint="(optional)">
          <input className={inputCls} value={form.email} onChange={set('email')} placeholder="email@misal.com" inputMode="email" autoComplete="off" />
        </Field>
        <Field label="Note" hint="(optional)">
          <input className={inputCls} value={form.note} onChange={set('note')} placeholder="Koi hidayat (optional)" autoComplete="off" />
        </Field>
      </div>

      {/* Payment method — the business takes Cash on Delivery only. */}
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#E6DCC5] bg-white px-3 py-2.5">
        <Money size={18} weight="fill" className="text-[#C29A45]" />
        <div className="leading-tight">
          <p className="text-[13px] font-bold text-[#2A2117]">Cash on Delivery</p>
          <p className="text-[11px] text-[#9C9078]">Delivery par payment</p>
        </div>
      </div>

      {/* Order summary — server-priced totals (authoritative). */}
      <div className="mt-3 rounded-xl border border-[#E6DCC5] bg-white p-3">
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-semibold text-[#6E6250]">Subtotal {quoting && <span className="text-[#C29A45]">· calculating…</span>}</span>
          <span className="font-bold tabular-nums text-[#2A2117]">{money(summary.subtotal)}</span>
        </div>
        {summary.discount > 0 && (
          <div className="mt-1 flex items-center justify-between text-[13px]">
            <span className="font-semibold text-green-700">Discount</span>
            <span className="font-bold tabular-nums text-green-700">− {money(summary.discount)}</span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between border-t border-[#EADFC8] pt-2">
          <span className="text-[14px] font-extrabold text-[#2A2117]">Total</span>
          <span className="text-[16px] font-extrabold tabular-nums text-[#2A2117]">{money(summary.total)}</span>
        </div>
      </div>

      {(submitError || errors.items) && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] font-semibold text-red-700">
          <WarningCircle size={16} weight="fill" className="mt-0.5 shrink-0" />
          <span>{submitError || errors.items}</span>
        </div>
      )}

      <button
        type="button"
        onClick={place}
        disabled={disabled}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-700 px-4 py-3 text-[14px] font-extrabold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? (
          <><SpinnerGap size={17} weight="bold" className="animate-spin" /> Place ho raha hai…</>
        ) : (
          <>Place Order · {money(summary.total)}</>
        )}
      </button>
    </div>
  )
}
