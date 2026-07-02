import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  MagnifyingGlass,
  Trash,
  ArrowRight,
  WarningCircle,
  Tag,
  Headset,
  Gift,
  Package,
  ShoppingBagOpen,
  CircleNotch,
  Minus,
  Plus,
  ArrowCounterClockwise,
} from '@phosphor-icons/react'
import { getProducts, getCategories } from '../../api/catalog'
import { getOffers } from '../../api/offers'
import { quoteCart } from '../../api/orders'
import { createAdminOrder, listCustomers } from '../../api/admin'
import { useAsync } from '../../hooks/useAsync'
import { useNotify } from '../../context/NotifyContext'
import { money, computeFreeItems, rowKey, unitLabelFor } from '../../lib/cartEngine'
import { unitStockCap } from '../../lib/pack'
import { Skeleton } from '../../components/admin/ui'
import OrderProductCard, { initials } from '../../components/admin/OrderProductCard'
import Typeahead from '../../components/admin/Typeahead'

const GRID_CAP = 24 // safeguard against huge catalogs — chips + search narrow it
const lbl = 'mb-1.5 block text-[12.5px] font-bold text-[#6E6250]'
const railInput = 'w-full rounded-[10px] border border-[#D9CDB1] bg-white px-3 py-[11px] text-sm text-[#2A2117] outline-none transition-all placeholder:text-[#9C9078] focus:border-[#3A2E1F] focus:ring-4 focus:ring-[#3A2E1F]/10'

// Self-contained city suggestions for the Shehar typeahead (delivery network).
const CITIES = [
  'Lahore', 'Faisalabad', 'Multan', 'Gujranwala', 'Sargodha', 'Rawalpindi', 'Islamabad', 'Sialkot',
  'Bahawalpur', 'Sahiwal', 'Sheikhupura', 'Kasur', 'Okara', 'Jhang', 'Gujrat', 'Rahim Yar Khan',
  'Dera Ghazi Khan', 'Hafizabad', 'Mandi Bahauddin', 'Vehari', 'Chiniot', 'Toba Tek Singh', 'Khanewal',
  'Muzaffargarh', 'Bahawalnagar', 'Layyah', 'Pakpattan', 'Nankana Sahib', 'Mianwali', 'Attock',
  'Karachi', 'Hyderabad', 'Sukkur', 'Peshawar', 'Quetta',
]

// Flat cream surface panel — matches the reference (.panel): #FBF7EE fill, hairline
// #E6DCC5 border, 14px radius, subtle diffusion shadow.
function Panel({ className = '', children }) {
  return (
    <div className={`rounded-[14px] border border-[#E6DCC5] bg-[#FBF7EE] shadow-[0_1px_2px_rgba(58,46,31,0.06),0_1px_3px_rgba(58,46,31,0.05)] ${className}`}>
      {children}
    </div>
  )
}

export default function AdminCreateOrder() {
  const navigate = useNavigate()
  const { success, error, toast } = useNotify()
  const { data: products, loading: productsLoading, error: productsError, reload } = useAsync(() => getProducts({ sort: 'popular' }), [])
  const { data: offers } = useAsync(() => getOffers(), [])
  const { data: categories } = useAsync(() => getCategories(), [])
  const { data: customers } = useAsync(() => listCustomers(), [])

  const [form, setForm] = useState({ name: '', phone: '', city: '', address: '', note: '', code: '' })
  // Each line = one product-unit: {key, id, name, seed, image, unit(label), unitKey, wholesale(per-unit price), qty}
  const [lines, setLines] = useState([])
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [cat, setCat] = useState('all')
  const [totals, setTotals] = useState({ subtotal: 0, discount: 0, total: 0, lines: [], count: 0 })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [flashKey, setFlashKey] = useState(null)
  const [undo, setUndo] = useState(null) // { line, index } — pending 5s undo

  const flashTimer = useRef(0)
  const undoTimer = useRef(0)
  const linesRef = useRef(lines)
  linesRef.current = lines

  useEffect(() => () => { clearTimeout(flashTimer.current); clearTimeout(undoTimer.current) }, [])

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 200)
    return () => clearTimeout(t)
  }, [q])

  const productById = useMemo(() => {
    const m = new Map()
    ;(products || []).forEach((p) => m.set(p.id, p))
    return m
  }, [products])

  const categoryList = categories || []
  const catCounts = useMemo(() => {
    const m = {}
    ;(products || []).forEach((p) => { m[p.categoryId] = (m[p.categoryId] || 0) + 1 })
    return m
  }, [products])

  const results = useMemo(() => {
    if (!products) return []
    let list = products
    if (cat !== 'all') list = list.filter((p) => String(p.categoryId) === String(cat))
    const n = debouncedQ.trim().toLowerCase()
    if (n) list = list.filter((p) => p.name.toLowerCase().includes(n) || (p.category || '').toLowerCase().includes(n))
    return list
  }, [products, cat, debouncedQ])
  const capped = results.slice(0, GRID_CAP)

  const flash = useCallback((key) => {
    setFlashKey(key)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlashKey(null), 900)
  }, [])

  // Cart adapter injected into OrderProductCard — the shared −/＋/Add actions
  // (lib/unitCart) drive THIS order's lines via setUnitQty (absolute qty; create /
  // update / remove), keyed by product id + unit. Stable identity via linesRef so
  // cards stay memoized; the actions module fires all the alerts.
  const cartAdapter = useMemo(
    () => ({
      qtyOf: (id, unit) => linesRef.current.find((l) => l.key === rowKey(id, unit))?.qty || 0,
      unitsOf: (id) => linesRef.current.filter((l) => l.id === id).map((l) => ({ unitKey: l.unitKey, qty: l.qty })),
      setUnitQty: (product, unitOption, qty) => {
        const unitKey = unitOption ? unitOption.unit : product.unit
        const label = unitOption ? unitOption.label : unitLabelFor(product.unit)
        const price = unitOption ? Number(unitOption.price) || 0 : Number(product.wholesale) || 0
        const key = rowKey(product.id, unitKey)
        const qv = Math.max(0, Math.min(999, Math.floor(Number(qty) || 0)))
        setLines((ls) => {
          if (qv <= 0) return ls.filter((l) => l.key !== key)
          const ex = ls.find((l) => l.key === key)
          if (ex) return ls.map((l) => (l.key === key ? { ...l, qty: qv } : l))
          return [...ls, { key, id: product.id, name: product.name, seed: product.seed, image: product.image ?? null, unit: label, unitKey, wholesale: price, qty: qv }]
        })
        if (qv > 0) flash(key)
      },
      toast,
    }),
    [toast, flash],
  )

  const capForLine = (l) => {
    const p = productById.get(l.id)
    if (!p || p.stock == null) return 999
    // Shared pool: subtract the product's OTHER unit lines already in this order
    // before capping THIS line, so Cartons + Boxes never over-draw the stock.
    const others = linesRef.current.filter((x) => x.id === l.id).map((x) => ({ unitKey: x.unitKey, qty: x.qty }))
    const cap = unitStockCap(p, { unit: l.unitKey }, others)
    return Number.isFinite(cap) && cap > 0 ? cap : 999
  }
  const setLineQty = (l, nextQty) => {
    const max = capForLine(l)
    let qv = Math.max(1, nextQty)
    if (qv > max) { qv = max; toast(`Only ${max} ${l.unit || 'units'} available in stock.`, 'warning') }
    setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, qty: qv } : x)))
    flash(l.key)
  }

  // delete = reversible for 5s (undo snackbar)
  const deleteLine = (l) => {
    const index = lines.findIndex((x) => x.key === l.key)
    setLines((ls) => ls.filter((x) => x.key !== l.key))
    setUndo({ line: l, index })
    clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setUndo(null), 5000)
  }
  const undoDelete = () => {
    if (!undo) return
    setLines((ls) => {
      if (ls.some((x) => x.key === undo.line.key)) return ls
      const next = [...ls]
      next.splice(Math.min(undo.index, next.length), 0, undo.line)
      return next
    })
    flash(undo.line.key)
    setUndo(null)
    clearTimeout(undoTimer.current)
  }

  const freeItems = useMemo(
    () => computeFreeItems(offers || [], lines.map((l) => ({ id: l.id, unitKey: l.unitKey, qty: l.qty }))),
    [offers, lines],
  )

  // live server-authoritative quote (unit-aware)
  useEffect(() => {
    let alive = true
    if (lines.length === 0) { setTotals({ subtotal: 0, discount: 0, total: 0, lines: [], count: 0 }); return }
    const t = setTimeout(() => {
      quoteCart(lines.map((l) => ({ id: l.id, qty: l.qty, unit: l.unitKey })), form.code || null)
        .then((res) => alive && setTotals(res))
        .catch(() => {})
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [lines, form.code])

  // ---- customer form -------------------------------------------------------
  const phoneDigits = form.phone.replace(/[^0-9]/g, '')
  const nameOk = form.name.trim().length >= 3
  const phoneOk = phoneDigits.length === 11
  const canSubmit = nameOk && phoneOk && lines.length > 0
  const need = []
  if (!nameOk) need.push('naam')
  if (!phoneOk) need.push('valid mobile')
  if (lines.length === 0) need.push('1 item')
  const placeHint = need.length ? `${need.join(' + ')} chahiye` : ''

  const unitCount = lines.reduce((s, l) => s + l.qty, 0)

  const custMatches = useMemo(() => {
    if (!customers || phoneDigits.length < 3) return []
    return customers.filter((c) => (c.phone || '').replace(/[^0-9]/g, '').includes(phoneDigits)).slice(0, 6).map((c) => ({ key: c.id, ...c }))
  }, [customers, phoneDigits])

  const cityMatches = useMemo(() => {
    const n = form.city.trim().toLowerCase()
    return CITIES.filter((c) => c.toLowerCase().includes(n)).slice(0, 6).map((c) => ({ key: c, city: c }))
  }, [form.city])

  const update = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
  }
  const onPhoneChange = (e) => {
    const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 11)
    setForm((f) => ({ ...f, phone: digits }))
    setErrors((er) => ({ ...er, phone: undefined }))
  }
  const onPhoneBlur = () => {
    setErrors((er) => ({ ...er, phone: phoneDigits.length === 0 ? 'Mobile number likhein' : phoneDigits.length !== 11 ? 'Mobile 11 digits ka hona chahiye (03XX XXXXXXX)' : undefined }))
  }
  const onNameBlur = () => setErrors((er) => ({ ...er, name: form.name.trim().length >= 3 ? undefined : 'Naam zaroori hai (kam az kam 3 harf)' }))
  const pickCustomer = (c) => {
    setForm((f) => ({
      ...f,
      name: c.name || f.name,
      phone: (c.phone || '').replace(/[^0-9]/g, '').slice(0, 11) || f.phone,
      city: c.city || f.city,
      address: c.address || f.address,
    }))
    setErrors((er) => ({ ...er, name: undefined, phone: undefined }))
    if (c.name) success(`Customer mil gaya — ${c.name}`)
  }

  // Promo — bound live to form.code (auto re-quote); Apply gives explicit feedback.
  const applyPromo = async () => {
    if (!form.code.trim()) { toast('Pehle promo code likhein', 'warning'); return }
    if (lines.length === 0) { toast('Pehle koi product add karein', 'warning'); return }
    try {
      const res = await quoteCart(lines.map((l) => ({ id: l.id, qty: l.qty, unit: l.unitKey })), form.code)
      setTotals(res)
      if ((res.lines || []).some((l) => l.code)) success('Promo code lag gaya')
      else toast('Yeh code is order par nahi lagta', 'warning')
    } catch { error('Code apply nahi hua') }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      const order = await createAdminOrder({
        ...form,
        code: form.code || null,
        items: lines.map((l) => ({ id: l.id, qty: l.qty, unit: l.unitKey })),
      })
      success(`Order ${order.code} ban gaya`)
      navigate(`/admin/orders/${order.id}`)
    } catch (err) {
      if (err.fields) setErrors(err.fields)
      error(err.message || 'Order create nahi hua')
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1440px]">
      <Link to="/admin/orders" className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1.5 text-[13px] font-semibold text-[#6E6250] transition-colors hover:text-[#2A2117]">
        <ArrowLeft size={15} weight="bold" /> Orders
      </Link>

      <div className="mb-5 mt-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-extrabold leading-none tracking-[-0.02em] text-[#2A2117] sm:text-[30px]">Naya order banayein</h1>
          <p className="mt-2 text-sm text-[#6E6250]">Phone ya WhatsApp order admin ki taraf se place karein</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#E6DCC5] bg-[#FBF7EE] px-3.5 py-2 text-[13px] font-semibold text-[#6E6250] shadow-[0_1px_2px_rgba(58,46,31,0.06)]">
          <Headset size={15} weight="fill" className="text-[#C29A45]" /> Source: Admin
        </span>
      </div>

      {/* Desktop: a fixed-height app-shell region so the product grid + rail scroll
          independently and the overall page never grows. Mobile: normal flow. */}
      <form onSubmit={submit} className="grid gap-[22px] lg:grid-cols-[1fr_388px] lg:h-[calc(100vh-14rem)] lg:items-stretch lg:overflow-hidden">
        {/* ── product picker ── */}
        <Panel className="p-5 lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden">
          <h2 className="mb-3.5 shrink-0 text-base font-extrabold tracking-[-0.01em] text-[#2A2117]">Products add karein</h2>

          <div className="relative mb-3.5 shrink-0">
            <MagnifyingGlass size={17} weight="bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9C9078]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Product dhoondein… (naam ya category)"
              className="w-full rounded-[11px] border border-[#D9CDB1] bg-white py-3 pl-10 pr-4 text-sm text-[#2A2117] outline-none transition-all placeholder:text-[#9C9078] focus:border-[#3A2E1F] focus:ring-4 focus:ring-[#3A2E1F]/10"
            />
          </div>

          {/* category chips with counts */}
          <div className="no-scrollbar -mx-1 mb-[18px] flex shrink-0 gap-2 overflow-x-auto px-1">
            <Chip active={cat === 'all'} onClick={() => setCat('all')} label="All" count={products?.length || 0} />
            {categoryList.map((c) => (
              <Chip key={c.id} active={String(cat) === String(c.id)} onClick={() => setCat(c.id)} label={c.name} count={catCounts[c.id] || 0} />
            ))}
          </div>

          {/* Scrollable product area — grid scrolls on its own; the page stays put. */}
          <div className="no-scrollbar -mx-1 px-1 pb-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {/* grid states */}
          {productsLoading && (
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-[14px] border border-[#E6DCC5] bg-white">
                  <Skeleton className="h-[120px] w-full rounded-none" />
                  <div className="space-y-2.5 p-[13px]">
                    <Skeleton className="h-3 w-2/5" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-3 w-3/5" />
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-9 w-full rounded-[9px]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!productsLoading && productsError && (
            <div className="grid place-items-center rounded-[14px] border border-dashed border-[#D9CDB1] bg-white px-6 py-14 text-center">
              <p className="text-base font-bold text-[#2A2117]">Products load nahi huye</p>
              <button type="button" onClick={reload} className="mt-3 rounded-full bg-[#3A2E1F] px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-[#4b3b28]">Dobara koshish karein</button>
            </div>
          )}

          {!productsLoading && !productsError && results.length === 0 && (
            <div className="py-14 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#f0e7d4] text-[#c3b28a]"><Package size={26} weight="duotone" /></span>
              <p className="mt-3 font-bold text-[#6E6250]">{debouncedQ ? `"${debouncedQ}" ke liye koi product nahi mila` : 'Koi product nahi mila'}</p>
              <p className="mt-1 text-sm text-[#9C9078]">Search ya category badal kar dobara koshish karein.</p>
              {(debouncedQ || cat !== 'all') && (
                <button type="button" onClick={() => { setQ(''); setCat('all') }} className="mt-3 text-sm font-bold text-[#3A2E1F] underline underline-offset-2 hover:text-[#4b3b28]">Filter saaf karein</button>
              )}
            </div>
          )}

          {!productsLoading && !productsError && results.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                {capped.map((p) => (
                  <OrderProductCard key={p.id} p={p} cart={cartAdapter} />
                ))}
              </div>
              {results.length > GRID_CAP && (
                <p className="mt-4 text-center text-xs text-[#9C9078]">Pehle {GRID_CAP} dikhaye ({results.length} milay) — search ya category se aur filter karein.</p>
              )}
            </>
          )}
          </div>
        </Panel>

        {/* ── order rail — fixed & always visible; fills the region, scrolls only if
            its own content overflows (Order lines scroll independently below) ── */}
        <div className="no-scrollbar space-y-4 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-0.5">
          {/* 1. customer */}
          <Panel className="p-[18px]">
            <h2 className="mb-3.5 text-base font-extrabold tracking-[-0.01em] text-[#2A2117]">Customer tafseelat</h2>

            <div className="mb-3">
              <label className={lbl}>Mobile<span className="ml-0.5 text-[#B23B2E]">*</span></label>
              <Typeahead
                value={form.phone}
                onChange={onPhoneChange}
                onBlur={onPhoneBlur}
                onPick={pickCustomer}
                items={custMatches}
                invalid={!!errors.phone}
                inputMode="numeric"
                ariaLabel="Mobile number"
                placeholder="03XX XXXXXXX"
                renderItem={(c) => (
                  <span className="block">
                    <span className="block truncate text-[13.5px] font-bold text-[#2A2117]">{c.name || '—'}</span>
                    <span className="block truncate text-xs text-[#9C9078]">{c.phone}{c.city ? ` · ${c.city}` : ''}</span>
                    {c.orders_count > 0 && <span className="mt-0.5 inline-block rounded-md bg-[#E3F0E8] px-1.5 py-0.5 text-[10px] font-bold text-[#2F7D55]">{c.orders_count} orders · repeat</span>}
                  </span>
                )}
              />
              {errors.phone && <p className="mt-1.5 text-[11.5px] font-medium text-[#B23B2E]">{errors.phone}</p>}
            </div>

            <div className="mb-3">
              <label className={lbl}>Naam<span className="ml-0.5 text-[#B23B2E]">*</span></label>
              <input className={`${railInput} ${errors.name ? 'border-[#B23B2E] bg-[#F6E4E1] focus:ring-[#B23B2E]/15' : ''}`} value={form.name} onChange={update('name')} onBlur={onNameBlur} placeholder="Customer / dukaan ka naam" />
              {errors.name && <p className="mt-1.5 text-[11.5px] font-medium text-[#B23B2E]">{errors.name}</p>}
            </div>

            <div className="mb-3">
              <label className={lbl}>Shehar</label>
              <Typeahead
                value={form.city}
                onChange={update('city')}
                onPick={(it) => setForm((f) => ({ ...f, city: it.city }))}
                items={cityMatches}
                ariaLabel="Shehar"
                placeholder="Shehar chunein"
                renderItem={(it) => <span className="text-[13.5px] font-semibold text-[#2A2117]">{it.city}</span>}
              />
            </div>

            <div className="mb-3">
              <label className={lbl}>Pata</label>
              <textarea className={`${railInput} min-h-[64px] resize-y`} value={form.address} onChange={update('address')} placeholder="Delivery address" />
              {errors.address && <p className="mt-1.5 text-[11.5px] font-medium text-[#B23B2E]">{errors.address}</p>}
            </div>

            <div>
              <label className={lbl}>Note <span className="font-medium text-[#9C9078]">(optional)</span></label>
              <input className={railInput} value={form.note} onChange={update('note')} placeholder="Koi khaas hidayat" />
            </div>
          </Panel>

          {/* 2. order lines */}
          <Panel className="p-[18px]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-extrabold tracking-[-0.01em] text-[#2A2117]">Order lines</h2>
              <span className="inline-flex min-w-[24px] items-center justify-center rounded-full bg-[#3A2E1F] px-2.5 py-0.5 text-xs font-extrabold tabular-nums text-white">{unitCount}</span>
            </div>

            {lines.length === 0 ? (
              <div className="py-7 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#f0e7d4] text-[#c3b28a]"><ShoppingBagOpen size={24} weight="duotone" /></span>
                <p className="mt-2.5 text-[13.5px] font-bold text-[#6E6250]">Abhi koi item nahi</p>
                <p className="text-[12.5px] text-[#9C9078]">Left se product add karein</p>
              </div>
            ) : (
              <ul className="no-scrollbar -mx-1 max-h-[320px] space-y-0.5 overflow-y-auto px-1">
                {lines.map((l) => (
                  <li
                    key={l.key}
                    className={`grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-[10px] border-b border-[#E6DCC5] px-1.5 py-2.5 transition-colors duration-700 last:border-0 ${flashKey === l.key ? 'bg-[#F5E9CC]' : ''}`}
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-[9px] bg-[radial-gradient(120%_120%_at_30%_15%,#fbf3df,#efe4cb)] font-display text-[15px] font-extrabold text-[#c9b78d]">{initials(l.name)}</span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-[#2A2117]">{l.name}</p>
                      <p className="mt-0.5 text-[11.5px] text-[#9C9078]">{money(l.wholesale)} / {l.unit}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-[13.5px] font-extrabold tabular-nums text-[#2A2117]">{money(l.wholesale * l.qty)}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center overflow-hidden rounded-[8px] border border-[#D9CDB1]">
                          <button type="button" onClick={() => setLineQty(l, Math.max(1, l.qty - 1))} aria-label="Kam" className="grid h-7 w-[26px] place-items-center text-[#6E6250] hover:bg-[#f3ebd9]"><Minus size={13} weight="bold" /></button>
                          <span className="min-w-[24px] text-center text-[12.5px] font-bold tabular-nums text-[#2A2117]">{l.qty}</span>
                          <button type="button" onClick={() => setLineQty(l, l.qty + 1)} aria-label="Zyada" className="grid h-7 w-[26px] place-items-center text-[#6E6250] hover:bg-[#f3ebd9]"><Plus size={13} weight="bold" /></button>
                        </div>
                        <button type="button" onClick={() => deleteLine(l)} aria-label="Hatao" className="grid h-[30px] w-[30px] place-items-center rounded-[8px] text-[#9C9078] transition-colors hover:bg-[#F6E4E1] hover:text-[#B23B2E]"><Trash size={14} weight="bold" /></button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {errors.items && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#B23B2E]"><WarningCircle size={14} weight="fill" /> {errors.items}</p>}

            {freeItems.length > 0 && (
              <div className="mt-3 rounded-[10px] border border-[#cfe6d8] bg-[#E3F0E8]/70 p-3">
                <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[#2F7D55]"><Gift size={14} weight="fill" /> Muft items (offer)</p>
                <ul className="mt-2 space-y-2">
                  {freeItems.map((f) => (
                    <li key={f.key} className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white font-display text-xs font-extrabold text-[#c9b78d] ring-1 ring-[#cfe6d8]">{initials(f.name)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#2A2117]">{f.name}</p>
                        <p className="text-[11px] text-[#2F7D55]">{f.qty} {f.unit} · {f.offerTitle}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#2F7D55] px-2 py-0.5 text-[11px] font-extrabold text-white">Rs.0</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          {/* 3. promo + totals + place */}
          <Panel className="p-[18px]">
            <div className="mb-3.5 flex gap-2">
              <div className="relative flex-1">
                <Tag size={15} weight="fill" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9C9078]" />
                <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="Promo code" className="w-full rounded-[10px] border border-[#D9CDB1] bg-white py-2.5 pl-9 pr-3 text-[13.5px] font-semibold tracking-wider text-[#2A2117] outline-none focus:border-[#3A2E1F] focus:ring-4 focus:ring-[#3A2E1F]/10" />
              </div>
              <button type="button" onClick={applyPromo} className="rounded-[10px] border border-[#D9CDB1] px-4 text-[13px] font-bold text-[#6E6250] transition-colors hover:border-[#3A2E1F] hover:text-[#2A2117]">Apply</button>
            </div>

            <dl className="space-y-1.5 text-[13.5px]">
              <div className="flex justify-between text-[#6E6250]"><dt>Subtotal</dt><dd className="font-semibold tabular-nums">{money(totals.subtotal)}</dd></div>
              {(totals.lines || []).map((l) => (
                <div key={l.id} className="flex justify-between text-[#2F7D55]"><dt className="truncate pr-2">{l.note || l.label}</dt><dd className="shrink-0 font-semibold tabular-nums">− {money(l.amount)}</dd></div>
              ))}
              <div className="flex justify-between text-[#6E6250]"><dt>Delivery</dt><dd className="font-bold text-[#2F7D55]">Free</dd></div>
              <div className="my-1.5 border-t border-dashed border-[#D9CDB1]" />
              <div className="flex items-center justify-between pt-0.5"><dt className="text-[17px] font-extrabold text-[#2A2117]">Total</dt><dd className="text-[17px] font-extrabold tabular-nums text-[#2A2117]">{money(totals.total)}</dd></div>
            </dl>

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="mt-3.5 inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-[12px] bg-[#3A2E1F] text-[15px] font-extrabold text-white shadow-[0_1px_2px_rgba(58,46,31,0.1)] transition-all hover:bg-[#4b3b28] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#c9bda4] disabled:text-[#f3ecdd]"
            >
              {submitting ? <CircleNotch size={18} className="animate-spin" /> : <ArrowRight size={17} weight="bold" />} Order place karein
            </button>
            {placeHint && <p className="mt-2 text-center text-[11.5px] font-medium text-[#9E7418]">{placeHint}</p>}
          </Panel>
        </div>
      </form>

      {/* undo snackbar — deleted line reversible for 5s */}
      {undo && (
        <div className="fixed bottom-6 right-6 z-[60] animate-fade-up">
          <div className="flex items-center gap-3 rounded-[12px] bg-[#2A2117] py-3 pl-3.5 pr-2.5 text-white shadow-[0_12px_30px_rgba(58,46,31,0.4)]">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#8a7355] text-white"><Trash size={15} weight="bold" /></span>
            <p className="text-[13.5px] font-bold">"{undo.line.name}" hataya</p>
            <button type="button" onClick={undoDelete} className="ml-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-extrabold text-[#eecf83] transition-colors hover:bg-white/10">
              <ArrowCounterClockwise size={14} weight="bold" /> Wapas lao
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Chip({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-[36px] shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] font-bold transition-all active:scale-95 ${
        active ? 'border-[#3A2E1F] bg-[#3A2E1F] text-white' : 'border-[#D9CDB1] bg-white text-[#6E6250] hover:border-[#3A2E1F] hover:text-[#2A2117]'
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 text-[11px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-[#efe6d3] text-[#6E6250]'}`}>{count}</span>
    </button>
  )
}
