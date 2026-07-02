import { memo, useEffect, useRef, useState } from 'react'
import { ShoppingCart, CheckCircle, Minus, Plus } from '@phosphor-icons/react'
import { money, unitLabelFor } from '../../lib/cartEngine'
import { packSummary, perPiecePrice, perPcLabel, unitStockCap } from '../../lib/pack'
import { unitCartActions, cartAlert } from '../../lib/unitCart'

// Two-letter monogram for the image placeholder (matches the reference thumb):
// significant words of the product name, ignoring the "England" brand prefix.
export function initials(name) {
  const words = String(name || '').replace(/england/gi, '').trim().split(/\s+/).filter(Boolean)
  const s = (words[0]?.[0] || '') + (words[1]?.[0] || words[0]?.[1] || '')
  return s.toUpperCase() || '—'
}

// Admin New Order product card — styled to match the reference (flat white card,
// 14px radius, cream thumb, gold accents). SAME purchase logic as the storefront:
// unit toggle, +/- & manual qty, per-unit stock cap + warning, Add feeds the
// injected `cart` adapter ({ qtyOf, setUnitQty, toast }) via shared unit actions.
function OrderProductCardBase({ p, cart }) {
  const { toast } = cart

  const options = p.unitOptions && p.unitOptions.length
    ? p.unitOptions
    : [{ unit: p.unit, label: unitLabelFor(p.unit), price: p.wholesale, retail: p.retail }]
  const [selUnit, setSelUnit] = useState(() => options.reduce((a, b) => (Number(b.price) > Number(a.price) ? b : a), options[0]).unit)
  const selected = options.find((o) => o.unit === selUnit) || options[0]

  const conv = p.conversions || {}
  const pack = packSummary(conv)
  const perPc = perPiecePrice(selected, conv)
  const rawStock = Number(p.stock) || 0
  const outOfStock = rawStock <= 0
  // Cap for the selected unit against the OTHER units already in this order, so the
  // product's shared stock pool is honoured (see lib/pack → unitStockCap).
  const unitsInOrder = cart.unitsOf ? cart.unitsOf(p.id) : []
  const stock = unitStockCap(p, selected, unitsInOrder)
  // −/＋/Add share ONE behaviour + alert set with the storefront (see lib/unitCart).
  const actions = unitCartActions(cart, p, selected, stock)

  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const num = Math.max(1, Number(qty) || 1)
  const overStock = () => toast(cartAlert.overStock(stock, selected.label), 'warning')

  const onInput = (e) => {
    const digits = e.target.value.replace(/[^\d]/g, '').slice(0, 4)
    if (digits === '') return setQty('')
    let n = parseInt(digits, 10)
    if (stock > 0 && n > stock) { n = stock; overStock() }
    setQty(Math.max(1, n))
  }
  const onBlur = () => { if (qty === '' || Number(qty) < 1) setQty(1) }
  // + adds one of this unit to the order; − removes one (both alert via actions).
  const inc = () => actions.plus()
  const dec = () => actions.minus()

  const handleAdd = () => {
    if (outOfStock || num < 1) return
    if (actions.addManual(num)) {
      setAdded(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setAdded(false), 1100)
    }
  }

  const image = (p.images && p.images[0]) || p.image
  const showImg = image && !imgFailed

  // Stock pill — reference greens/ambers.
  const pill = outOfStock
    ? { cls: 'bg-[#F6E4E1] text-[#B23B2E]', dot: 'bg-[#B23B2E]', txt: 'Stock khatam' }
    : rawStock <= 5
      ? { cls: 'bg-[#F4E8CE] text-[#9E7418]', dot: 'bg-[#9E7418]', txt: 'Kam stock' }
      : { cls: 'bg-[#E3F0E8] text-[#2F7D55]', dot: 'bg-[#2F7D55]', txt: 'Stock mein' }

  const stepBtn = 'grid h-9 w-[34px] place-items-center text-[#6E6250] transition-colors hover:bg-[#f3ebd9] hover:text-[#2A2117] disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <article className="group flex flex-col overflow-hidden rounded-[14px] border border-[#E6DCC5] bg-white shadow-[0_1px_2px_rgba(58,46,31,0.06),0_1px_3px_rgba(58,46,31,0.05)] transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_10px_26px_-10px_rgba(58,46,31,0.28)]">
      {/* thumb */}
      <div className="relative grid h-[120px] place-items-center overflow-hidden bg-[radial-gradient(120%_120%_at_30%_15%,#fbf3df_0%,#efe4cb_100%)]">
        {showImg ? (
          <img src={image} alt={p.name} loading="lazy" onError={() => setImgFailed(true)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <span className="font-display text-[30px] font-extrabold tracking-tight text-[#c9b78d]">{initials(p.name)}</span>
        )}
        <span className={`absolute right-[9px] top-[9px] inline-flex items-center gap-1.5 rounded-full px-[9px] py-1 text-[11px] font-bold ${pill.cls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} /> {pill.txt}
        </span>
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col gap-2 px-[13px] pb-[14px] pt-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#C29A45]">{p.category}</div>
        <h3 className="line-clamp-2 min-h-[36px] text-[14.5px] font-bold leading-[1.25] text-[#2A2117]">{p.name}</h3>
        {pack && <p className="text-[11.5px] leading-[1.35] text-[#9C9078]">{pack}</p>}
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[18px] font-extrabold tracking-[-0.02em] text-[#2A2117]">
            {money(selected.price)}
            <span className="text-[11px] font-semibold text-[#9C9078]"> / {selected.label}</span>
          </span>
        </div>
        {perPc && <span className="text-[11px] text-[#9C9078]">≈ {perPcLabel(perPc)}/pc</span>}
        <span className="self-start rounded-[7px] bg-[#F4E8CE] px-2 py-[3px] text-[11px] font-semibold text-[#9E7418]">Min order: 1 {selected.label}</span>

        {/* controls: [unit toggle | stepper] then full-width Add */}
        <div className="mt-auto flex flex-col gap-[9px] pt-1">
          <div className="flex items-center justify-between gap-2">
            <div className="no-scrollbar inline-flex min-w-0 gap-[3px] overflow-x-auto rounded-[9px] bg-[#f0e7d4] p-[3px]">
              {options.map((o) => {
                const on = o.unit === selUnit
                return (
                  <button
                    key={o.unit}
                    type="button"
                    aria-pressed={on}
                    disabled={outOfStock}
                    onClick={() => setSelUnit(o.unit)}
                    className={`min-h-[32px] shrink-0 rounded-[7px] px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-40 ${
                      on ? 'bg-[#3A2E1F] text-white shadow-[0_1px_2px_rgba(58,46,31,0.2)]' : 'text-[#6E6250] hover:text-[#2A2117]'
                    }`}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>

            <div className="flex shrink-0 items-center overflow-hidden rounded-[9px] border border-[#D9CDB1] bg-white">
              <button type="button" onClick={dec} disabled={outOfStock} aria-label="Cart se ek kam karein" className={stepBtn}><Minus size={14} weight="bold" /></button>
              <input
                type="text"
                inputMode="numeric"
                value={qty}
                onChange={onInput}
                onBlur={onBlur}
                disabled={outOfStock}
                aria-label="Quantity"
                className="h-9 w-[34px] bg-transparent text-center text-sm font-bold tabular-nums text-[#2A2117] outline-none disabled:text-[#c3b28a]"
              />
              <button type="button" onClick={inc} disabled={outOfStock} aria-label="Cart mein ek add karein" className={stepBtn}><Plus size={14} weight="bold" /></button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={outOfStock || num < 1}
            aria-label={`${p.name} — ${num} ${selected.label} add karein`}
            className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[11px] text-sm font-bold text-white shadow-[0_1px_2px_rgba(58,46,31,0.06)] transition-all active:scale-[0.985] ${
              outOfStock || num < 1 ? 'cursor-not-allowed bg-[#c9bda4]' : added ? 'bg-[#2F7D55]' : 'bg-[#3A2E1F] hover:bg-[#4b3b28]'
            }`}
          >
            {outOfStock ? 'Stock khatam' : added ? <><CheckCircle size={16} weight="bold" /> Added</> : <><ShoppingCart size={16} weight="bold" /> Add</>}
          </button>
        </div>
      </div>
    </article>
  )
}

export default memo(OrderProductCardBase)
