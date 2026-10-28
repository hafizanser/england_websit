import { useMemo } from 'react'
import { Minus, Plus, ShoppingCart, Trash, TrashSimple } from '@phosphor-icons/react'
import { money, groupByProduct } from '../../lib/cartEngine'
import { groupUnitCap } from '../../lib/pack'
import { imgSrc, onImgError, thumbSrc } from '../../lib/img'
import { useCart } from '../../context/CartContext'

const PANEL = 'rounded-[14px] border border-[#E6DCC5] bg-[#FBF7EE] shadow-[0_1px_2px_rgba(58,46,31,0.06),0_1px_3px_rgba(58,46,31,0.05)]'

// The live cart for the admin order. Lines come straight from the shared
// CartContext (so they survive navigation + refresh), each priced from the
// snapshot captured when it was added. Quantity edits here respect the same
// shared-pool stock cap the picker enforces.
export default function AdminOrderCart() {
  const { items, setQty, remove, clear } = useCart()

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0)
  const unitCount = items.reduce((s, i) => s + i.qty, 0)

  // Per-product group lookup → the remaining cap for each unit line, so the +
  // button stops exactly where stock runs out (across mixed units).
  const groups = useMemo(() => {
    const map = new Map()
    groupByProduct(items).forEach((g) => map.set(g.id, g))
    return map
  }, [items])

  const capFor = (line) => {
    const g = groups.get(line.id)
    if (!g) return Infinity
    return groupUnitCap(g, { unitKey: line.unitKey, conv: line.conv })
  }

  if (!items.length) {
    return (
      <div className={`${PANEL} p-5`}>
        <div className="grid place-items-center py-8 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f0e7d4] text-[#c3b28a]">
            <ShoppingCart size={24} weight="duotone" />
          </span>
          <p className="mt-3 text-sm font-bold text-[#6E6250]">Cart khali hai</p>
          <p className="mt-1 text-xs text-[#9C9078]">Products add karein — yahan line items dikhenge.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${PANEL} p-4`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-extrabold tracking-[-0.01em] text-[#2A2117]">
          <ShoppingCart size={18} weight="fill" className="text-[#C29A45]" /> Cart
          <span className="rounded-full bg-[#efe6d3] px-2 py-0.5 text-[11px] font-bold text-[#6E6250]">{unitCount}</span>
        </h2>
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-bold text-[#a8654f] transition-colors hover:bg-red-50 hover:text-red-700"
        >
          <TrashSimple size={14} weight="bold" /> Saaf karein
        </button>
      </div>

      <ul className="flex flex-col divide-y divide-[#EADFC8]">
        {items.map((line) => {
          const cap = capFor(line)
          const atCap = Number.isFinite(cap) && line.qty >= cap
          return (
            <li key={line.key} className="flex gap-3 py-3 first:pt-0">
              <img
                src={thumbSrc(imgSrc(line.image), 128)}
                onError={onImgError}
                alt={line.name}
                className="h-14 w-14 shrink-0 rounded-lg border border-[#E6DCC5] bg-white object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold leading-tight text-[#2A2117]">{line.name}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-[#9C9078]">
                      {money(line.wholesale)} / {line.unit}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => remove(line.key)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#b08968] transition-colors hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash size={15} weight="bold" />
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 rounded-full border border-[#D9CDB1] bg-white p-0.5">
                    <button
                      type="button"
                      aria-label="Kam karein"
                      onClick={() => setQty(line.key, line.qty - 1)}
                      className="grid h-7 w-7 place-items-center rounded-full bg-sand-100 text-brand-700 transition-colors hover:bg-sand-200"
                    >
                      <Minus size={13} weight="bold" />
                    </button>
                    <span className="min-w-[2ch] text-center text-[13px] font-extrabold tabular-nums text-[#2A2117]">{line.qty}</span>
                    <button
                      type="button"
                      aria-label="Zyada karein"
                      onClick={() => setQty(line.key, Math.min(Number.isFinite(cap) ? cap : line.qty + 1, line.qty + 1))}
                      disabled={atCap}
                      className="grid h-7 w-7 place-items-center rounded-full bg-brand-700 text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus size={13} weight="bold" />
                    </button>
                  </div>
                  <span className="text-[13px] font-extrabold tabular-nums text-[#2A2117]">{money(line.lineTotal)}</span>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-[#E6DCC5] pt-3">
        <span className="text-[13px] font-bold text-[#6E6250]">Subtotal</span>
        <span className="text-[15px] font-extrabold tabular-nums text-[#2A2117]">{money(subtotal)}</span>
      </div>
    </div>
  )
}
