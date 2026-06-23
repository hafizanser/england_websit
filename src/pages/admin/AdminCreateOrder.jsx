import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  MagnifyingGlass,
  Plus,
  Trash,
  ShoppingBag,
  CircleNotch,
  WarningCircle,
  Tag,
  Headset,
  Gift,
} from '@phosphor-icons/react'
import { getProducts } from '../../api/catalog'
import { getOffers } from '../../api/offers'
import { quoteCart } from '../../api/orders'
import { createAdminOrder } from '../../api/admin'
import { useAsync } from '../../hooks/useAsync'
import { useNotify } from '../../context/NotifyContext'
import { money, computeFreeItems } from '../../lib/cartEngine'
import { AdminTitle, Loader, Card } from '../../components/admin/ui'
import QuantityStepper from '../../components/QuantityStepper'
import { field, fieldLabel } from '../../components/admin/Modal'

export default function AdminCreateOrder() {
  const navigate = useNavigate()
  const { success, error } = useNotify()
  const { data: products, loading } = useAsync(() => getProducts({ sort: 'popular' }), [])
  const { data: offers } = useAsync(() => getOffers(), [])

  const [form, setForm] = useState({ name: '', phone: '', city: '', address: '', note: '', code: '' })
  const [lines, setLines] = useState([]) // {id, name, wholesale, unit, seed, qty}
  const [q, setQ] = useState('')
  const [totals, setTotals] = useState({ subtotal: 0, discount: 0, total: 0, lines: [], count: 0 })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const results = useMemo(() => {
    if (!products) return []
    const n = q.trim().toLowerCase()
    const base = n ? products.filter((p) => p.name.toLowerCase().includes(n) || p.category.toLowerCase().includes(n)) : products
    return base.slice(0, 8)
  }, [products, q])

  const addLine = (p) => {
    setLines((ls) => {
      const ex = ls.find((l) => l.id === p.id)
      if (ex) return ls.map((l) => (l.id === p.id ? { ...l, qty: l.qty + 1 } : l))
      return [...ls, { id: p.id, name: p.name, wholesale: p.wholesale, unit: p.unit, seed: p.seed, qty: 1 }]
    })
  }
  const setQty = (id, qty) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, qty } : l)).filter((l) => l.qty > 0))
  const removeLine = (id) => setLines((ls) => ls.filter((l) => l.id !== id))

  // FREE items earned from active offers — same logic as the storefront cart.
  const freeItems = useMemo(
    () => computeFreeItems(offers || [], lines.map((l) => ({ id: l.id, unitKey: l.unit, qty: l.qty }))),
    [offers, lines],
  )

  // live server-authoritative quote
  useEffect(() => {
    let alive = true
    if (lines.length === 0) {
      setTotals({ subtotal: 0, discount: 0, total: 0, lines: [], count: 0 })
      return
    }
    const t = setTimeout(() => {
      quoteCart(lines.map((l) => ({ id: l.id, qty: l.qty })), form.code || null)
        .then((res) => alive && setTotals(res))
        .catch(() => {})
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [lines, form.code])

  const update = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    const er = {}
    if (form.name.trim().length < 3) er.name = 'Customer ka naam likhein.'
    if (form.phone.replace(/[^0-9]/g, '').length < 10) er.phone = 'Sahi mobile number.'
    if (form.address.trim().length < 6) er.address = 'Customer ka pata likhein.'
    if (lines.length === 0) er.items = 'Kam az kam ek product add karein.'
    setErrors(er)
    if (Object.keys(er).length) return

    setSubmitting(true)
    try {
      const order = await createAdminOrder({
        ...form,
        code: form.code || null,
        items: lines.map((l) => ({ id: l.id, qty: l.qty })),
      })
      success(`Order ${order.code} ban gaya`)
      navigate(`/admin/orders/${order.id}`)
    } catch (err) {
      if (err.fields) setErrors(err.fields)
      error(err.message || 'Order create nahi hua')
      setSubmitting(false)
    }
  }

  if (loading) return <Loader />

  return (
    <>
      <Link to="/admin/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-900">
        <ArrowLeft size={16} weight="bold" /> Orders
      </Link>
      <AdminTitle title="Naya order banayein" subtitle="Phone ya WhatsApp order admin ki taraf se place karein">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron-50 px-3 py-1.5 text-xs font-bold text-saffron-700">
          <Headset size={14} weight="fill" /> Source: Admin
        </span>
      </AdminTitle>

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* left: products */}
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="text-base font-bold text-brand-900">Products add karein</h3>
            <div className="relative mt-3">
              <MagnifyingGlass size={18} weight="bold" className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Product dhoondein..." className="w-full rounded-2xl border border-brand-200 bg-sand-50 py-2.5 pl-11 pr-4 text-sm outline-none focus:border-brand-500 focus:bg-white" />
            </div>
            <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addLine(p)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-brand-100 p-2.5 text-left transition-colors hover:bg-sand-50"
                >
                  <img src={`https://picsum.photos/seed/${p.seed}/80/80`} alt="" className="h-10 w-10 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-brand-900">{p.name}</p>
                    <p className="text-xs text-brand-400">{money(p.wholesale)} / {p.unit}</p>
                  </div>
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-700 text-white"><Plus size={16} weight="bold" /></span>
                </button>
              ))}
              {results.length === 0 && <p className="py-4 text-center text-sm text-brand-400">Koi product nahi mila.</p>}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-base font-bold text-brand-900">Order lines ({lines.length})</h3>
            {errors.items && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600"><WarningCircle size={14} weight="fill" /> {errors.items}</p>}
            <ul className="mt-3 divide-y divide-brand-50">
              {lines.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-3">
                  <img src={`https://picsum.photos/seed/${l.seed}/80/80`} alt="" className="h-11 w-11 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-brand-900">{l.name}</p>
                    <p className="text-xs text-brand-400">{money(l.wholesale)} / {l.unit}</p>
                  </div>
                  <QuantityStepper value={l.qty} onChange={(qty) => setQty(l.id, qty)} size="sm" min={1} />
                  <span className="w-20 text-right text-sm font-bold tabular-nums text-brand-800">{money(l.wholesale * l.qty)}</span>
                  <button type="button" onClick={() => removeLine(l.id)} aria-label="Hatao" className="grid h-8 w-8 place-items-center rounded-lg text-brand-400 hover:bg-red-50 hover:text-red-600"><Trash size={15} weight="bold" /></button>
                </li>
              ))}
              {lines.length === 0 && <li className="py-8 text-center text-sm text-brand-400">Abhi koi product nahi. Upar se add karein.</li>}
            </ul>

            {/* FREE items auto-earned from offers (display only — Rs.0). */}
            {freeItems.length > 0 && (
              <div className="mt-3 rounded-2xl border border-green-200 bg-green-50/70 p-3">
                <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-green-700">
                  <Gift size={14} weight="fill" /> Muft items (offer)
                </p>
                <ul className="mt-2 space-y-2">
                  {freeItems.map((f) => (
                    <li key={f.key} className="flex items-center gap-3">
                      <img src={f.image || `https://picsum.photos/seed/${f.seed}/80/80`} alt="" className="h-9 w-9 rounded-lg object-cover ring-1 ring-green-200" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-brand-900">{f.name}</p>
                        <p className="text-[11px] text-green-700">{f.qty} {f.unit} · {f.offerTitle}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-extrabold text-white">Rs.0</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>

        {/* right: customer + summary */}
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="text-base font-bold text-brand-900">Customer tafseelat</h3>
            <div className="mt-3 space-y-3">
              <div><label className={fieldLabel}>Naam</label><input className={field} value={form.name} onChange={update('name')} />{errors.name && <span className="mt-1 block text-xs text-red-600">{errors.name}</span>}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={fieldLabel}>Mobile</label><input className={field} inputMode="numeric" value={form.phone} onChange={update('phone')} placeholder="0312 4361300" />{errors.phone && <span className="mt-1 block text-xs text-red-600">{errors.phone}</span>}</div>
                <div><label className={fieldLabel}>Shehar</label><input className={field} value={form.city} onChange={update('city')} /></div>
              </div>
              <div><label className={fieldLabel}>Pata</label><textarea className={`${field} min-h-[64px]`} value={form.address} onChange={update('address')} />{errors.address && <span className="mt-1 block text-xs text-red-600">{errors.address}</span>}</div>
              <div><label className={fieldLabel}>Note (optional)</label><input className={field} value={form.note} onChange={update('note')} /></div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-base font-bold text-brand-900">Promo + total</h3>
            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Tag size={15} weight="fill" className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="Promo code" className="w-full rounded-2xl border border-brand-200 bg-sand-50 py-2.5 pl-9 pr-3 text-sm font-semibold tracking-wider outline-none focus:border-brand-500 focus:bg-white" />
              </div>
            </div>
            <dl className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-brand-600"><dt>Subtotal</dt><dd className="font-semibold tabular-nums">{money(totals.subtotal)}</dd></div>
              {(totals.lines || []).map((l) => (
                <div key={l.id} className="flex justify-between text-saffron-700"><dt>{l.note || l.label}</dt><dd className="font-semibold tabular-nums">− {money(l.amount)}</dd></div>
              ))}
              <div className="flex justify-between text-brand-600"><dt>Delivery</dt><dd className="font-semibold text-brand-600">Free</dd></div>
              <div className="flex justify-between border-t border-dashed border-brand-200 pt-2 text-base font-bold text-brand-900"><dt>Total</dt><dd className="tabular-nums text-brand-800">{money(totals.total)}</dd></div>
            </dl>
            <button type="submit" disabled={submitting} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-5 py-3.5 text-sm font-bold text-white shadow-soft hover:bg-brand-800 disabled:opacity-60">
              {submitting ? <CircleNotch size={18} className="animate-spin" /> : <ShoppingBag size={18} weight="fill" />} Order place karein
            </button>
          </Card>
        </div>
      </form>
    </>
  )
}
