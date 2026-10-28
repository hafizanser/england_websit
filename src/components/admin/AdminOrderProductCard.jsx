import { memo, useState } from 'react'
import { CheckCircle, Minus, Plus, ShoppingCart } from '@phosphor-icons/react'
import { orderUnitOptions, unitLabelFor, money } from '../../lib/cartEngine'
import { packSummary, unitStockCap } from '../../lib/pack'
import { useCart } from '../../context/CartContext'
import ProductGallery from '../ProductGallery'

// Stock pill — mirrors the storefront card so the admin reads availability the
// same way the shopkeeper does (stock is counted in cartons).
function StockBadge({ stock }) {
  if (stock <= 0) {
    return <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">Stock khatam</span>
  }
  if (stock <= 5) {
    return <span className="shrink-0 rounded-full bg-saffron-100 px-2 py-0.5 text-[10px] font-bold text-saffron-900">Sirf {stock} carton</span>
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
      <CheckCircle size={11} weight="fill" /> Stock mein
    </span>
  )
}

// Admin "New Order" product card. Unlike the storefront ProductCard (which opens
// a WhatsApp enquiry), this adds the product to the shared cart in the chosen
// unit, with a stock-aware quantity stepper. The WhatsApp flow is untouched
// everywhere else — it is replaced ONLY inside this ordering workflow.
function AdminOrderProductCardBase({ p }) {
  const { qtyOf, setUnitQty, unitsOf, toast } = useCart()

  // Units this product is really sold in, Carton first. Falls back to the
  // primary unit (priced from the product) when none are declared.
  const options = orderUnitOptions(
    p.unitOptions && p.unitOptions.length
      ? p.unitOptions
      : [{ unit: p.unit, label: unitLabelFor(p.unit), price: p.wholesale, retail: p.retail }],
  )
  // Default to the largest selling unit (highest-priced — usually the Carton).
  const [selUnit, setSelUnit] = useState(() =>
    options.reduce((a, b) => ((Number(b.price) || 0) > (Number(a.price) || 0) ? b : a), options[0]).unit,
  )
  const selected = options.find((o) => o.unit === selUnit) || options[0]

  const stock = Number(p.stock) || 0
  const pack = packSummary(p.conversions || {}, options)
  const price = Number(selected.price) || 0

  // Current quantity of THIS unit line already in the cart, and the shared-pool
  // cap (other units of the same product already eat into the same stock).
  const inCart = qtyOf(p.id, selected.unit)
  const cap = unitStockCap(p, selected, unitsOf(p.id)) // Infinity | number | 0
  const atCap = Number.isFinite(cap) && inCart >= cap
  const soldOut = stock <= 0 || cap === 0

  const setQ = (q) => setUnitQty(p, selected, q)
  const addOne = () => {
    if (soldOut || atCap) {
      toast(`Stock kam hai — "${p.name}" ke liye aur ${selected.label} available nahi.`, 'warning')
      return
    }
    setQ(inCart + 1)
    toast(`Cart mein shamil — ${p.name} (1 ${selected.label})`, 'success')
  }

  return (
    <article className="group isolate flex flex-col overflow-hidden rounded-[18px] border border-brand-900/[0.08] bg-white shadow-[0_1px_2px_rgba(40,28,14,0.04),0_12px_30px_-24px_rgba(40,28,14,0.3)] transition-[transform,box-shadow] duration-300 focus-within:ring-2 focus-within:ring-saffron-400/50">
      <div className="relative">
        <ProductGallery
          images={p.images && p.images.length ? p.images : [p.image]}
          alt={p.name}
          size="sm"
          zoomSingle
          frameClassName="aspect-square overflow-hidden bg-sand-100"
        />
        {inCart > 0 && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-bold text-white shadow-soft">
            <ShoppingCart size={11} weight="fill" /> {inCart} in cart
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="w-fit min-w-0 truncate font-mono text-[9.5px] font-medium uppercase tracking-[0.1em] text-brand-600">{p.category}</span>
          <StockBadge stock={stock} />
        </div>

        <h3 className="line-clamp-2 font-grotesk text-[14px] font-extrabold leading-snug tracking-[-0.01em] text-brand-950">{p.name}</h3>

        {pack && <p className="truncate text-[10.5px] font-medium text-brand-500" title={pack}>{pack}</p>}

        {/* Unit chooser — single row, active unit highlighted. */}
        {options.length > 1 && (
          <div role="group" aria-label="Unit chunein" className="no-scrollbar -mx-0.5 mt-0.5 flex gap-1.5 overflow-x-auto px-0.5">
            {options.map((o) => {
              const on = selected.unit === o.unit
              return (
                <button
                  key={o.unit}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelUnit(o.unit)}
                  className={`min-h-[30px] shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition-all active:scale-95 ${
                    on ? 'bg-brand-700 text-white' : 'border border-brand-200 bg-white text-brand-700 hover:border-saffron-300 hover:text-saffron-800'
                  }`}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Price for the selected unit — the admin sees the wholesale rate. */}
        <p className="mt-0.5 text-[13px] font-extrabold text-brand-900">
          {price > 0 ? money(price) : '—'}
          <span className="ml-1 text-[11px] font-semibold text-brand-400">/ {selected.label}</span>
        </p>

        {/* Add control: a single Add button until the line exists, then a stepper. */}
        <div className="mt-auto pt-1.5">
          {inCart === 0 ? (
            <button
              type="button"
              onClick={addOne}
              disabled={soldOut}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShoppingCart size={15} weight="bold" /> {soldOut ? 'Stock khatam' : 'Cart mein daalein'}
            </button>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-full border border-brand-200 bg-white p-1">
              <button
                type="button"
                aria-label="Kam karein"
                onClick={() => setQ(inCart - 1)}
                className="grid h-8 w-8 place-items-center rounded-full bg-sand-100 text-brand-700 transition-colors hover:bg-sand-200"
              >
                <Minus size={15} weight="bold" />
              </button>
              <span className="min-w-[2ch] text-center text-sm font-extrabold tabular-nums text-brand-900">{inCart}</span>
              <button
                type="button"
                aria-label="Zyada karein"
                onClick={addOne}
                disabled={atCap}
                className="grid h-8 w-8 place-items-center rounded-full bg-brand-700 text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={15} weight="bold" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export default memo(AdminOrderProductCardBase)
