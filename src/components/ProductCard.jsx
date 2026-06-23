import { memo, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Plus, Minus, Check, CheckCircle, Package, ShoppingCartSimple } from '@phosphor-icons/react'
import { useCart } from '../context/CartContext'
import { money, unitLabelFor } from '../lib/cartEngine'
import { spring } from '../lib/motion'
import { packSummary, perPiecePrice, perPcLabel } from '../lib/pack'
import { PLACEHOLDER, onImgError } from '../lib/img'

// Stock pill — AA-contrast, derived from total_stock_cotton (in cartons).
function StockBadge({ stock }) {
  if (stock <= 0) {
    return (
      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
        Stock khatam
      </span>
    )
  }
  if (stock <= 5) {
    return (
      <span className="shrink-0 rounded-full bg-saffron-100 px-2 py-0.5 text-[10px] font-bold text-saffron-900">
        Sirf {stock} carton bachay
      </span>
    )
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
      <CheckCircle size={11} weight="fill" /> Stock mein
    </span>
  )
}

// Purchase section — premium B2B layout, fixed height (never expands on Add):
//   Row 1: unit pills (Carton · Box · Pack · Piece) — tap to set the active unit
//   Row 2: [−] [Quantity] [+]  [ Add to Cart ]
// Isolated + memoized so a cart change re-renders ONLY this control, never the
// ~25 full card bodies.
const CardCartControls = memo(function CardCartControls({ p, options, selected, onUnit }) {
  const { add, qtyOf, toast } = useCart()
  const stock = Number(p.stock) || 0          // Opening Stock = max available
  const outOfStock = stock <= 0
  const inCart = qtyOf(p.id, selected.unit)   // qty of this unit already in cart

  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  // Quantity to add — always at least 1 (the minimum order), capped only by stock.
  const num = Math.max(1, Number(qty) || 1)
  const overStock = () => toast(`Only ${stock} units are available in stock.`, 'warning')

  // Manual typing — digits only, min 1, capped at Opening Stock. Empty is allowed
  // while typing and snaps back to 1 on blur.
  const onInput = (e) => {
    const digits = e.target.value.replace(/[^\d]/g, '').slice(0, 4)
    if (digits === '') return setQty('')
    let n = parseInt(digits, 10)
    if (stock > 0 && n > stock) { n = stock; overStock() }
    setQty(Math.max(1, n))
  }
  const onBlur = () => { if (qty === '' || Number(qty) < 1) setQty(1) }

  // + adds exactly one unit, capped at Opening Stock. Functional update so it
  // always reads the latest quantity (immune to stale closures / fast taps).
  const inc = () => {
    if (stock > 0 && num >= stock) { overStock(); return }
    setQty((q) => Math.max(1, Number(q) || 1) + 1)
  }

  // − removes exactly one unit, never below the minimum of 1.
  const dec = () => {
    setQty((q) => Math.max(1, (Number(q) || 1) - 1))
  }

  // Add exactly the entered quantity of the selected unit — never exceeding stock.
  const handleAdd = () => {
    if (outOfStock || num < 1) return
    if (stock > 0 && inCart + num > stock) { overStock(); return }
    add(p, num, selected) // fires the aria-live confirmation toast
    setAdded(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setAdded(false), 1100)
  }

  // Circular [−]/[+] step buttons that live inside the padded pill stepper.
  const stepBtn =
    'grid h-9 w-7 place-items-center rounded-full text-brand-600 transition-all hover:bg-brand-100 hover:text-brand-900 active:scale-90 disabled:cursor-not-allowed disabled:text-brand-200 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-saffron-500'

  return (
    <div className="mt-auto flex flex-col gap-2.5 pt-2.5">
      {/* Unit pills — single row; active unit highlighted, refined gold hover */}
      <div role="group" aria-label="Unit chunein" className="no-scrollbar -mx-0.5 flex gap-1.5 overflow-x-auto px-0.5">
        {options.map((o) => {
          const on = selected.unit === o.unit
          return (
            <button
              key={o.unit}
              type="button"
              aria-pressed={on}
              onClick={() => onUnit(o.unit)}
              className={`min-h-[34px] shrink-0 rounded-full px-3.5 py-1 text-[11.5px] font-bold tracking-tight transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-saffron-500 active:scale-95 ${
                on
                  ? 'bg-brand-700 text-white shadow-soft ring-1 ring-inset ring-white/15'
                  : 'border border-brand-200 bg-white text-brand-700 hover:border-saffron-300 hover:bg-saffron-50/50 hover:text-saffron-800'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>

      {/* [−] [qty] [+]  [Add to Cart] — premium pill stepper + adaptive CTA */}
      <div className="flex items-stretch gap-1.5 sm:gap-2">
        <div className="flex shrink-0 items-center rounded-full border border-brand-200 bg-white p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
          <button type="button" onClick={dec} disabled={outOfStock} aria-label="Quantity kam karein" className={stepBtn}>
            <Minus size={15} weight="bold" />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={qty}
            onChange={onInput}
            onBlur={onBlur}
            disabled={outOfStock}
            aria-label="Quantity"
            className="h-9 w-8 bg-transparent text-center text-sm font-extrabold tabular-nums text-brand-900 outline-none disabled:text-brand-300"
          />
          <button type="button" onClick={inc} disabled={outOfStock} aria-label="Quantity barhayein" className={stepBtn}>
            <Plus size={15} weight="bold" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={outOfStock || num < 1}
          aria-label={`${p.name} — ${num} ${selected.label} cart mein shamil karein`}
          className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-bold text-white shadow-soft transition-all active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-500 ${
            outOfStock || num < 1 ? 'cursor-not-allowed bg-brand-300' : added ? 'bg-green-600' : 'bg-brand-700 hover:bg-brand-800'
          }`}
        >
          {outOfStock ? (
            <span className="truncate">Stock khatam</span>
          ) : added ? (
            <><Check size={16} weight="bold" /> <span className="hidden truncate sm:inline">Added</span></>
          ) : (
            // Mobile: icon only. Tablet/desktop (sm+): icon + "Add to Cart".
            <><ShoppingCartSimple size={16} weight="bold" /> <span className="hidden truncate sm:inline">Add to Cart</span></>
          )}
        </button>
      </div>
    </div>
  )
})

function ProductCardBase({ p, preferLargestUnit = false }) {
  const reduce = useReducedMotion()

  // All unit types available for this product (from the database), with the
  // primary unit as a fallback when the product declares none.
  // TODO: if a backend unit option ever ships without a price, surface a clear
  // "rate poochein" state instead of pricing it at 0 here.
  const options = p.unitOptions && p.unitOptions.length
    ? p.unitOptions
    : [{ unit: p.unit, label: unitLabelFor(p.unit), price: p.wholesale, retail: p.retail }]
  // Default unit: on the full catalog prefer the largest selling unit (e.g.
  // Carton = highest per-unit price); elsewhere keep the product's primary unit.
  const [selUnit, setSelUnit] = useState(() =>
    preferLargestUnit && options.length
      ? options.reduce((a, b) => (b.price > a.price ? b : a), options[0]).unit
      : options[0]?.unit,
  )
  const selected = options.find((o) => o.unit === selUnit) || options[0]

  // Derived pack info (consistent across every card via the shared helpers).
  const conv = p.conversions || {}
  const pack = packSummary(conv)
  const perPc = perPiecePrice(selected, conv)
  const stock = Number(p.stock) || 0

  // Image gallery — all product images (primary first). Multiple images
  // auto-slide and advance on hover; a single image gets a smooth zoom.
  const gallery = (p.images && p.images.length ? p.images : [p.image]).filter(Boolean)
  const slides = gallery.length ? gallery : [PLACEHOLDER]
  const multi = slides.length > 1
  const [imgIdx, setImgIdx] = useState(0)
  useEffect(() => {
    if (!multi || reduce) return undefined
    const t = setInterval(() => setImgIdx((i) => (i + 1) % slides.length), 2800)
    return () => clearInterval(t)
  }, [multi, slides.length, reduce])

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={reduce ? false : { opacity: 1, y: 0 }}
      transition={reduce ? undefined : spring}
      whileHover={reduce ? undefined : { y: -6 }}
      className="group flex flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft focus-within:ring-2 focus-within:ring-saffron-400/50"
    >
      {/* Media — clean, edge-to-edge image (fixed aspect ratio → no CLS). */}
      <Link
        to={`/product/${p.id}`}
        aria-label={p.name}
        onMouseEnter={() => multi && setImgIdx((i) => (i + 1) % slides.length)}
        className="relative block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-500"
      >
        <div className="relative aspect-square overflow-hidden bg-sand-100">
          {multi ? (
            slides.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={p.name}
                loading="lazy"
                onError={onImgError}
                className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-out ${
                  i === imgIdx ? 'scale-100 opacity-100' : 'scale-[1.04] opacity-0'
                }`}
              />
            ))
          ) : (
            <img
              src={slides[0]}
              alt={p.name}
              loading="lazy"
              onError={onImgError}
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
            />
          )}

          {multi && (
            <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
              {slides.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full bg-white shadow-soft transition-all duration-300 ${
                    i === imgIdx ? 'w-4 opacity-100' : 'w-1.5 opacity-60'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          {/* category tag — AA contrast (brand-700 on brand-50) */}
          <span className="w-fit min-w-0 truncate rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
            {p.category}
          </span>
          <StockBadge stock={stock} />
        </div>

        <div>
          <Link to={`/product/${p.id}`} className="block">
            <h3 className="line-clamp-2 text-sm font-bold leading-snug text-brand-950 transition-colors hover:text-brand-700">{p.name}</h3>
          </Link>
          {/* Description always renders on a single clean line with ellipsis. */}
          <p className="mt-0.5 truncate text-xs text-brand-500" title={p.sub}>{(p.sub || '').replace(/\s*\\\s*/g, ' · ').replace(/\s+/g, ' ').trim()}</p>
        </div>

        {/* Consistent pack-size line — AA contrast, single source of truth. */}
        {pack && (
          <p className="flex items-start gap-1 text-[11px] font-medium leading-snug text-brand-600">
            <Package size={13} weight="bold" className="mt-0.5 shrink-0 text-brand-400" />
            <span>{pack}</span>
          </p>
        )}

        {/* Live price — number + unit BOTH follow the selected unit. */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="flex items-baseline gap-1 font-display text-lg font-extrabold tracking-tight text-brand-900 sm:text-xl">
            {money(selected.price)}
            <span className="text-xs font-semibold text-brand-500">/ {selected.label}</span>
          </p>
          {perPc && (
            <span className="text-[11px] font-semibold text-brand-500">≈ {perPcLabel(perPc)}/pc</span>
          )}
        </div>

        {/* MOQ — minimum order for the selected unit */}
        <span className="w-fit rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700">
          Min order: 1 {selected.label}
        </span>

        <CardCartControls p={p} options={options} selected={selected} onUnit={setSelUnit} />
      </div>
    </motion.article>
  )
}

// Memoized: re-renders only when its product prop changes — cart mutations are
// absorbed by the isolated CardCartControls child above.
export default memo(ProductCardBase)
