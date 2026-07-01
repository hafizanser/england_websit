import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useParams, useOutletContext } from 'react-router-dom'
import {
  ArrowLeft,
  CaretLeft,
  CaretRight,
  Plus,
  Check,
  Truck,
  ShieldCheck,
  Package,
  WhatsappLogo,
  ListChecks,
  Gift,
  TrendUp,
} from '@phosphor-icons/react'
import { getProductById } from '../api/catalog'
import { getOffers } from '../api/offers'
import { PLACEHOLDER, onImgError } from '../lib/img'
import { useAsync } from '../hooks/useAsync'
import { ErrorState } from '../components/ui'
import ProductReviews from '../components/ProductReviews'
import RelatedProducts from '../components/RelatedProducts'
import QuantityStepper from '../components/QuantityStepper'
import { useCart } from '../context/CartContext'
import { money, rowKey, unitLabelFor } from '../lib/cartEngine'
import { stockForUnit } from '../lib/pack'
import { brand } from '../data/site'

// Split admin text (newline / bullet separated) into clean bullet points.
function toBullets(text) {
  return String(text || '')
    .split(/\r?\n|•/)
    .map((s) => s.replace(/\s*\\\s*/g, ' / ').replace(/^[\s\-*]+/, '').trim())
    .filter(Boolean)
}

// Parse the short "unit info" string into one bullet per unit, e.g.
//   "24 Pcs \Box 36 Box \Carton"  ->  ["24 Pcs / Box", "36 Box / Carton"]
// Handles explicit separators (newline, bullet, comma, semicolon) and the
// run-together admin format where a new quantity follows a unit word.
function unitBullets(text) {
  const raw = String(text || '').replace(/\r/g, '').trim()
  if (!raw) return []
  let s = raw.replace(/[•;]/g, '\n').replace(/,(?=\s)/g, '\n')
  // Break before a fresh quantity that starts right after a unit word
  // ("...Box 36 Box..." -> "...Box\n36 Box...").
  s = s.replace(/([^\d\s\\/])\s+(?=\d)/g, '$1\n')
  return s
    .split(/\n+/)
    .map((x) => x.replace(/\s*\\\s*/g, ' / ').replace(/^[\s\-*,]+/, '').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean)
}

function Gallery({ images, name, seed }) {
  const [idx, setIdx] = useState(0)
  const list = images && images.length ? images : [null]
  const fallback = PLACEHOLDER
  const go = (d) => setIdx((i) => (i + d + list.length) % list.length)

  return (
    <div className="lg:sticky lg:top-24">
      <div className="relative aspect-square overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft">
        <AnimatePresence mode="wait">
          <motion.img
            key={idx}
            src={list[idx] || fallback}
            alt={name}
            onError={onImgError}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full w-full object-cover"
          />
        </AnimatePresence>

        {list.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Pichli tasveer"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-800 shadow-soft backdrop-blur transition-all hover:bg-white active:scale-90"
            >
              <CaretLeft size={18} weight="bold" />
            </button>
            <button
              type="button"
              aria-label="Agli tasveer"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-800 shadow-soft backdrop-blur transition-all hover:bg-white active:scale-90"
            >
              <CaretRight size={18} weight="bold" />
            </button>
          </>
        )}
      </div>

      {list.length > 1 && (
        <div className="no-scrollbar mt-3 flex gap-2.5 overflow-x-auto pb-1">
          {list.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Tasveer ${i + 1}`}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 bg-white transition-all sm:h-20 sm:w-20 ${
                idx === i ? 'border-saffron-400 ring-2 ring-saffron-200' : 'border-brand-100 hover:border-brand-300'
              }`}
            >
              <img src={src || fallback} alt={`${name} ${i + 1}`} onError={onImgError} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="grid animate-pulse gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="aspect-square rounded-3xl bg-sand-200" />
      <div className="flex flex-col gap-4">
        <div className="h-4 w-24 rounded-full bg-sand-200" />
        <div className="h-9 w-3/4 rounded-xl bg-sand-200" />
        <div className="h-7 w-40 rounded-lg bg-sand-200" />
        <div className="mt-2 h-24 w-full rounded-2xl bg-sand-200" />
        <div className="mt-2 h-12 w-full rounded-full bg-sand-200" />
      </div>
    </div>
  )
}

export default function ProductDetailPage() {
  const { id } = useParams()
  const ctx = useOutletContext() || {}
  const { add, qtyOf, setQty: setCartQty, toast } = useCart()
  const { data: p, loading, error, reload } = useAsync(() => getProductById(id), [id])
  const { data: offers } = useAsync(() => getOffers(), [])

  // Every available unit type for this product (Piece / Box / Carton …).
  const options = p && p.unitOptions && p.unitOptions.length
    ? p.unitOptions
    : (p ? [{ unit: p.unit, label: unitLabelFor(p.unit), price: p.wholesale, retail: p.retail }] : [])

  // Active "buy X get Y free" offer for THIS product — same source/logic the
  // cart uses to auto-add the free item.
  const offer = useMemo(
    () => (offers || []).find((o) => o?.config?.isFreeOffer && (o.productIds || []).some((pid) => String(pid) === String(p?.id))) || null,
    [offers, p],
  )
  const oc = offer?.config || null

  // Selected unit + pre-add quantity. Default to the offer's unit (so the deal
  // applies straight away) otherwise the first available unit.
  const [selUnit, setSelUnit] = useState('')
  const [qty, setQty] = useState(1)
  useEffect(() => {
    if (!options.length) return
    const match = oc?.mainUnit && options.find((o) => unitLabelFor(o.unit) === unitLabelFor(oc.mainUnit))
    setSelUnit((match || options[0]).unit)
    setQty(1)
  }, [p?.id, offer]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = options.find((o) => o.unit === selUnit) || options[0] || null
  const lineKey = p && selected ? rowKey(p.id, selected.unit) : ''
  const inCart = p && selected ? qtyOf(p.id, selected.unit) : 0
  // Admin stock = single source of truth. Cap the add quantity and block adding
  // beyond what's available (counting what's already in the cart).
  const stock = Number(p?.stock) || 0
  const outOfStock = !!p && stock <= 0
  // Stock is stored in cartons; the ceiling for the SELECTED unit is that carton
  // total converted into this unit (e.g. 20 cartons → 480 boxes → 5,760 pieces).
  const maxQty = stock > 0 ? stockForUnit(stock, selected?.unit, p?.conversions, options) : 999
  const shortBullets = p ? unitBullets(p.sub) : []
  const detailBullets = p ? toBullets(p.description) : []

  // Real per-unit profit for the shopkeeper = MRP (retail) − thok rate (price),
  // straight from the unit pricing configured in the admin dashboard. Units with
  // no MRP margin are omitted, so the section only shows genuine numbers.
  const profitRows = (options || [])
    .map((o) => {
      const cost = Number(o.price) || 0
      const mrp = Number(o.retail ?? o.price) || 0
      const profit = Math.max(0, mrp - cost)
      return { unit: o.label, cost, mrp, profit, pct: cost > 0 ? Math.round((profit / cost) * 100) : 0 }
    })
    .filter((r) => r.profit > 0)

  // Offer progress — how many free units the cart currently earns for this product.
  const mainOpt = oc ? options.find((o) => unitLabelFor(o.unit) === unitLabelFor(oc.mainUnit)) : null
  const paidMain = mainOpt && p ? qtyOf(p.id, mainOpt.unit) : 0
  const freeEarned = oc && oc.buyQty > 0 ? Math.floor(paidMain / oc.buyQty) * oc.freeQty : 0
  const toNext = oc && oc.buyQty > 0 ? (oc.buyQty - (paidMain % oc.buyQty)) % oc.buyQty : 0

  const addToCart = () => {
    if (!selected) return
    if (outOfStock) { toast('Out of Stock', 'warning'); return }
    if (stock > 0 && inCart + qty > maxQty) {
      toast(`Only ${maxQty} ${selected?.label || 'items'} available in stock.`, 'warning')
      return
    }
    add(p, qty, selected)
    if (ctx.openCart) ctx.openCart()
  }

  const waHref = p && selected
    ? `https://wa.me/${brand.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
        `Assalam-o-Alaikum England!\nMujhe yeh product chahiye:\n${p.name}\nRate: ${money(selected.price)} / ${selected.label}`,
      )}`
    : '#'

  return (
    <section className="container-page pt-8 pb-28 sm:py-12 md:pb-12">
      <Link
        to="/products"
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-500 transition-colors hover:text-brand-800"
      >
        <ArrowLeft size={16} weight="bold" /> Saare products
      </Link>

      {loading && <DetailSkeleton />}

      {!loading && error && <ErrorState message={error.message} onRetry={reload} />}

      {!loading && !error && !p && (
        <div className="rounded-3xl border border-brand-100 bg-white p-12 text-center shadow-soft">
          <Package size={40} weight="duotone" className="mx-auto text-brand-300" />
          <h1 className="mt-4 text-xl font-bold text-brand-900">Product nahi mila</h1>
          <p className="mt-1 text-sm text-brand-500">Shayad yeh product hata diya gaya hai.</p>
          <Link
            to="/products"
            className="mt-6 inline-flex rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-800"
          >
            Catalog dekhein
          </Link>
        </div>
      )}

      {!loading && !error && p && (
        <>
          {/* Main section */}
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
            {/* LEFT — gallery */}
            <Gallery images={p.images} name={p.name} seed={p.seed} />

            {/* RIGHT — info */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col"
            >
              <div className="flex flex-wrap items-center gap-3">
                {p.category && (
                  <Link
                    to={`/products?cat=${p.categoryId}`}
                    className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-600 transition-colors hover:bg-brand-100"
                  >
                    {p.category}
                  </Link>
                )}
                {p.stock > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
                    <Check size={13} weight="bold" /> Stock mein
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-red-500">Stock khatam</span>
                )}
              </div>

              <h1 className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-tight text-brand-950 sm:text-3xl md:text-4xl">
                {p.name}
              </h1>

              {/* Price — reflects the selected unit */}
              <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1.5">
                <span className="font-display text-4xl font-extrabold leading-none tracking-tight text-brand-900 sm:text-[2.75rem]">
                  {money(selected ? selected.price : p.wholesale)}
                </span>
                <span className="pb-1 text-sm font-semibold text-brand-400">/ {selected ? selected.label : p.unit}</span>
                <span className="mb-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-600">Thok rate</span>
              </div>

              {/* Short description — one bullet per unit */}
              {shortBullets.length > 0 && (
                <ul className="mt-6 flex flex-col gap-2.5">
                  {shortBullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-brand-700">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                        <Check size={12} weight="bold" />
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Purchase panel — unit, offer, quantity & add-to-cart in one premium module */}
              <div className="mt-7 rounded-3xl border border-brand-100 bg-white p-4 shadow-soft sm:p-5">
                {/* Unit type selection */}
                {options.length > 1 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-400">Unit chunein</p>
                    <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {options.map((o) => {
                        const active = selected && o.unit === selected.unit
                        return (
                          <button
                            key={o.unit}
                            type="button"
                            onClick={() => setSelUnit(o.unit)}
                            className={`rounded-2xl border px-3 py-2.5 text-left transition-all active:scale-[0.97] ${
                              active ? 'border-brand-700 bg-brand-50 ring-1 ring-brand-200' : 'border-brand-200 bg-white hover:border-brand-300'
                            }`}
                          >
                            <span className={`block text-sm font-bold ${active ? 'text-brand-900' : 'text-brand-700'}`}>{o.label}</span>
                            <span className="block text-xs font-semibold text-brand-500">{money(o.price)}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Active offer — same engine as the cart auto-adds the free item */}
                {offer && oc && (
                  <div className={`${options.length > 1 ? 'mt-4' : ''} rounded-2xl border border-green-200 bg-green-50/70 p-3.5`}>
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-green-600 text-white"><Gift size={18} weight="fill" /></span>
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-green-800">
                          {oc.buyQty} {unitLabelFor(oc.mainUnit)} khareedein — {oc.freeQty} {unitLabelFor(oc.freeUnit)} {offer.freeProduct?.name || 'isi product'} FREE
                        </p>
                        <p className="mt-0.5 text-xs text-green-700">
                          {freeEarned > 0
                            ? `Mubarak! Aapko ${freeEarned} ${unitLabelFor(oc.freeUnit)} muft mil rahe hain — cart mein shaamil.`
                            : toNext > 0
                              ? `${toNext} aur ${unitLabelFor(oc.mainUnit)} add karein aur ${oc.freeQty} ${unitLabelFor(oc.freeUnit)} muft payein.`
                              : 'Offer cart par khud lag jata hai.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quantity + live total + add to cart */}
                <div className={options.length > 1 || (offer && oc) ? 'mt-4 border-t border-brand-100 pt-4' : ''}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold uppercase tracking-wide text-brand-400">Tadaad</span>
                      <QuantityStepper value={qty} onChange={(q) => setQty(Math.max(1, q))} min={1} max={maxQty} />
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-400">Total</p>
                      <p className="font-display text-xl font-extrabold leading-none tracking-tight text-brand-900">{money((selected ? selected.price : 0) * qty)}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={addToCart}
                    disabled={outOfStock}
                    className={`mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold text-white shadow-soft transition-all active:scale-[0.98] ${
                      outOfStock ? 'cursor-not-allowed bg-brand-300' : 'bg-brand-700 hover:bg-brand-800'
                    }`}
                  >
                    {outOfStock ? 'Out of Stock' : <><Plus size={18} weight="bold" /> Cart mein daalein</>}
                  </button>
                </div>

                {inCart > 0 && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-sand-50 px-4 py-2.5">
                    <span className="flex items-center gap-2 text-sm font-semibold text-brand-700">
                      <Check size={15} weight="bold" className="text-brand-600" /> {inCart} {selected?.label} cart mein
                    </span>
                    <QuantityStepper value={inCart} onChange={(q) => setCartQty(lineKey, q)} size="sm" max={maxQty} />
                  </div>
                )}

                <a
                  href={waHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#25D366] bg-white px-7 py-3 text-sm font-bold text-[#1ebe5d] transition-all hover:bg-[#25D366] hover:text-white active:scale-[0.98]"
                >
                  <WhatsappLogo size={18} weight="fill" /> WhatsApp Pe Order
                </a>
              </div>

              {/* Trust strip */}
              <div className="mt-7 grid grid-cols-1 gap-3 rounded-2xl border border-brand-100 bg-white/60 p-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <Truck size={18} weight="fill" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-brand-900">Agle din delivery</p>
                    <p className="text-xs text-brand-500">40+ shehron mein</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <ShieldCheck size={18} weight="fill" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-brand-900">Asli maal guarantee</p>
                    <p className="text-xs text-brand-500">100% original</p>
                  </div>
                </div>
              </div>

              {/* Profit breakdown — real margin per unit (MRP − thok rate) */}
              {profitRows.length > 0 && (
                <div className="mt-7 overflow-hidden rounded-3xl border border-green-200 bg-gradient-to-br from-green-50/80 to-white shadow-soft">
                  <div className="flex items-center gap-2.5 border-b border-green-100 px-5 py-3.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-green-600 text-white">
                      <TrendUp size={18} weight="bold" />
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-green-800">Aapka munafa — har unit par</p>
                      <p className="text-[11px] text-green-600">Thok rate par khareedein, MRP par bechein</p>
                    </div>
                  </div>
                  <div className="divide-y divide-green-100">
                    {profitRows.map((r) => (
                      <div key={r.unit} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-brand-900">{r.unit}</p>
                          <p className="text-[11px] text-brand-500">Thok {money(r.cost)} · MRP {money(r.mrp)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-display text-base font-extrabold leading-none text-green-700">+{money(r.profit)}</p>
                          <p className="mt-0.5 text-[11px] font-bold text-green-600">{r.pct}% margin</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Detailed description section */}
          {detailBullets.length > 0 && (
            <div className="mt-12 sm:mt-16">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-white">
                  <ListChecks size={18} weight="bold" />
                </span>
                <h2 className="font-display text-xl font-extrabold tracking-tight text-brand-950 sm:text-2xl">
                  Tafseeli maloomat
                </h2>
              </div>

              <div className="mt-5 rounded-3xl border border-brand-100 bg-white p-5 shadow-soft sm:p-7">
                <ul className="grid gap-3.5 sm:grid-cols-2">
                  {detailBullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-brand-700">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-saffron-100 text-saffron-700">
                        <Check size={12} weight="bold" />
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Reviews & ratings */}
          <ProductReviews productId={p.id} />

          {/* Related products — same category first, topped up with random picks
              from other categories. Reuses the Products-page card as-is. */}
          <RelatedProducts product={p} />

          {/* Sticky mobile Add-to-Cart bar — native app pattern, always in reach.
              Sits above the bottom nav and respects the home-bar safe area. */}
          {selected && (
            <div
              className="fixed inset-x-0 z-30 px-3 md:hidden"
              style={{ bottom: 'calc(3.75rem + env(safe-area-inset-bottom))' }}
            >
              <div className="flex items-center gap-3 rounded-2xl bg-white p-2 pl-4 shadow-lift ring-1 ring-brand-100">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-brand-400">
                    {qty} {selected.label}{qty > 1 ? 's' : ''}{inCart > 0 ? ` · ${inCart} cart mein` : ''}
                  </p>
                  <p className="font-display text-lg font-extrabold leading-none tracking-tight text-brand-900" aria-live="polite">
                    {money(selected.price * qty)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addToCart}
                  disabled={outOfStock}
                  className={`inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white shadow-soft transition-transform active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-500 ${
                    outOfStock ? 'cursor-not-allowed bg-brand-300' : 'bg-brand-700'
                  }`}
                >
                  {outOfStock ? 'Out of Stock' : <><Plus size={18} weight="bold" /> Cart mein daalein</>}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
