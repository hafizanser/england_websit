import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { X, ShoppingBagOpen, Trash, Tag, Truck, ArrowRight, Gift } from '@phosphor-icons/react'
import { useCart } from '../../context/CartContext'
import { useNotify } from '../../context/NotifyContext'
import { money, groupByProduct, mergeUnits } from '../../lib/cartEngine'
import { spring } from '../../lib/motion'
import { imgSrc, onImgError } from '../../lib/img'

// One clean row per product. All of a product's units are MERGED into a single
// read-only summary (e.g. "1 Carton + 1 Box") using the dashboard conversion
// data — no separate editable rows. A single control removes the whole product.
function CartGroup({ group }) {
  const { remove } = useCart()
  const { confirm } = useNotify()
  const askRemove = async () => {
    const ok = await confirm({
      tone: 'danger',
      title: 'Item hatayein?',
      text: `"${group.name}" cart se hat jayega.`,
      confirmText: 'Haan, hatayein',
    })
    if (ok) group.units.forEach((u) => remove(u.key))
  }
  const merged = mergeUnits(group)
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      transition={spring}
      className="flex gap-3 py-4"
    >
      <img
        src={imgSrc(group.image)}
        alt={group.name}
        onError={onImgError}
        className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-brand-100"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-bold leading-snug text-brand-900">{group.name}</p>
          <span className="shrink-0 text-sm font-extrabold tabular-nums text-brand-800">{money(group.total)}</span>
        </div>

        {/* combined, read-only unit summary — e.g. "1 Carton + 1 Box" */}
        <div className="flex items-center justify-between gap-2">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-xl bg-brand-50 px-2.5 py-1.5 text-xs font-bold text-brand-700">
            {merged.map((m, i) => (
              <span key={m.label} className="inline-flex items-center gap-1.5">
                {i > 0 && <span className="text-brand-300">+</span>}
                <span>{m.text}</span>
              </span>
            ))}
          </p>
          <button
            type="button"
            aria-label="Hatayein"
            onClick={askRemove}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-brand-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash size={15} weight="bold" />
          </button>
        </div>
      </div>
    </motion.li>
  )
}

export default function CartDrawer({ open, onClose }) {
  const { items, freeItems, totals, clear } = useCart()
  const { confirm, success } = useNotify()
  const groups = groupByProduct(items)

  const handleClear = async () => {
    const ok = await confirm({
      tone: 'danger',
      title: 'Cart saaf karein?',
      text: 'Tamam items cart se hat jayenge.',
      confirmText: 'Haan, saaf karein',
    })
    if (ok) { clear(); success('Cart saaf kar diya') }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-brand-950/50 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={spring}
            className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col bg-sand-50 shadow-lift"
          >
            {/* header */}
            <div className="flex items-center justify-between border-b border-brand-100 bg-white px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-saffron-300">
                  <ShoppingBagOpen size={20} weight="fill" />
                </span>
                <div>
                  <p className="text-base font-extrabold tracking-tight text-brand-900">Aapka order</p>
                  <p className="text-xs text-brand-500">{groups.length} products • {totals.count} units</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs font-bold text-brand-600 transition-colors hover:border-saffron-300 hover:bg-saffron-50 hover:text-saffron-700"
                  >
                    <Trash size={15} weight="bold" /> Clear
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Band karein"
                  onClick={onClose}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-brand-200 bg-white text-brand-800"
                >
                  <X size={20} weight="bold" />
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
                <span className="grid h-20 w-20 place-items-center rounded-full bg-brand-50 text-brand-300">
                  <ShoppingBagOpen size={40} weight="duotone" />
                </span>
                <div>
                  <p className="text-lg font-bold text-brand-900">Cart khali hai</p>
                  <p className="mt-1 text-sm text-brand-500">
                    Apni dukaan ke liye maal chunein aur yahan add karein.
                  </p>
                </div>
                <Link
                  to="/products"
                  onClick={onClose}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-sm font-bold text-white shadow-soft transition-all hover:bg-brand-800 active:translate-y-px"
                >
                  Shopping shuru karein <ArrowRight size={16} weight="bold" />
                </Link>
              </div>
            ) : (
              <>
                {/* free delivery note */}
                <div className="border-b border-brand-100 bg-white px-5 py-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-brand-700">
                    <Truck size={18} weight="fill" className="text-brand-600" />
                    Har order par muft delivery — koi charges nahi.
                  </p>
                </div>

                {/* lines */}
                <div className="flex-1 overflow-y-auto px-5">
                  <ul className="divide-y divide-brand-100">
                    <AnimatePresence initial={false}>
                      {groups.map((group) => (
                        <CartGroup key={group.id} group={group} />
                      ))}
                    </AnimatePresence>
                  </ul>

                  {/* FREE items earned from offers */}
                  {freeItems.length > 0 && (
                    <div className="mb-4 mt-2 rounded-2xl border border-green-200 bg-green-50/70 p-3">
                      <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-green-700">
                        <Gift size={14} weight="fill" /> Muft items
                      </p>
                      <ul className="mt-2 space-y-2">
                        {freeItems.map((f) => (
                          <li key={f.key} className="flex items-center gap-2.5">
                            <div className="relative shrink-0">
                              <img src={imgSrc(f.image)} alt={f.name} onError={onImgError} className="h-10 w-10 rounded-lg object-cover ring-1 ring-green-200" />
                              <span className="absolute -left-1 -top-1 rounded-full bg-green-600 px-1 text-[7px] font-extrabold uppercase text-white">Free</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold text-brand-900">{f.name}</p>
                              <p className="text-[10px] text-green-700">{f.qty} {f.unit} free</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-extrabold text-white">Rs.0</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* summary */}
                <div className="space-y-3 border-t border-brand-100 bg-white px-5 py-4">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-brand-600">
                      <span>Subtotal</span>
                      <span className="font-semibold tabular-nums">{money(totals.subtotal)}</span>
                    </div>
                    {totals.lines.map((l) => (
                      <div key={l.id} className="flex justify-between text-brand-600">
                        <span className="flex items-center gap-1.5 text-saffron-700">
                          <Tag size={13} weight="fill" /> {l.note || l.label}
                        </span>
                        <span className="font-semibold tabular-nums text-saffron-700">
                          − {money(l.amount)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-brand-600">
                      <span>Delivery</span>
                      <span className="font-semibold text-brand-600">Free</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-dashed border-brand-200 pt-3">
                    <span className="text-sm font-bold text-brand-900">Total</span>
                    <span className="text-xl font-extrabold tracking-tight text-brand-800">
                      {money(totals.total)}
                    </span>
                  </div>

                  <Link
                    to="/cart"
                    onClick={onClose}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-brand-700 px-6 py-3.5 text-sm font-bold text-white shadow-soft transition-all hover:bg-brand-800 active:translate-y-px"
                  >
                    Cart dekhein aur order karein
                    <ArrowRight size={18} weight="bold" />
                  </Link>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
