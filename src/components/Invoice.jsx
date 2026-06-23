import { forwardRef } from 'react'
import { money, unitLabelFor } from '../lib/cartEngine'
import { brand } from '../data/site'
import BrandLogo from './BrandLogo'

const statusLabel = {
  pending: 'Naya',
  confirmed: 'Confirmed',
  packed: 'Pack ho gaya',
  shipped: 'Ravana',
  delivered: 'Deliver ho gaya',
  cancelled: 'Cancel',
}

// Small bilingual label — English with a soft Urdu touch for shopkeepers.
function Label({ en, ur }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-wider text-brand-400">
      {en} {ur && <span className="urdu lowercase tracking-normal text-brand-300">· {ur}</span>}
    </p>
  )
}

/**
 * Premium invoice / order summary — clear, shopkeeper-friendly, with the unit
 * type shown plainly and any free (offer) items listed separately. Identical
 * layout for screen, print and PDF (no remote images).
 */
const Invoice = forwardRef(function Invoice({ order, freeItems = [] }, ref) {
  if (!order) return null
  const items = order.items || []
  const hasItemDiscounts = items.some((i) => Number(i.discount) > 0)
  const promoLines = order.discount_lines || []
  const date = (order.placed_at || '').slice(0, 16).replace('T', ' ')
  const customer = order.customer || {}
  const unitOf = (it) => (it.unit ? unitLabelFor(it.unit) : '')

  return (
    <div
      ref={ref}
      className="print-area mx-auto w-full max-w-3xl bg-white p-6 text-brand-950 sm:p-10"
      style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}
    >
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-brand-100 pb-6">
        <div className="flex items-center gap-3">
          <BrandLogo tone="dark" className="h-12" />
          <div>
            <p className="text-xs text-brand-500">{brand.address}</p>
            <p className="text-xs text-brand-500">{brand.phone} • {brand.email}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black tracking-tight text-brand-800">
            INVOICE <span className="urdu align-middle text-base font-bold text-brand-400">رسید</span>
          </p>
          <p className="mt-1 text-sm font-bold text-brand-900">{order.code}</p>
          <p className="text-xs text-brand-500">{date}</p>
          <span className="mt-2 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
            {statusLabel[order.status] || order.status}
          </span>
        </div>
      </div>

      {/* bill-to */}
      <div className="grid gap-4 py-6 sm:grid-cols-2">
        <div>
          <Label en="Dukaandar" ur="گاہک" />
          <p className="mt-1 text-base font-bold text-brand-900">{customer.name}</p>
          <p className="text-sm text-brand-600">{customer.phone}</p>
          {customer.address && <p className="text-sm text-brand-600">{customer.address}</p>}
          {customer.city && <p className="text-sm text-brand-600">{customer.city}</p>}
        </div>
        <div className="sm:text-right">
          <Label en="Order tafseelat" ur="آرڈر" />
          <p className="mt-1 text-sm text-brand-600">Order #: <span className="font-semibold text-brand-900">{order.code}</span></p>
          <p className="text-sm text-brand-600">Items: <span className="font-semibold text-brand-900">{items.length}</span></p>
          <p className="text-sm text-brand-600">Payment: <span className="font-semibold text-brand-900">Cash on delivery</span></p>
          {order.promo_code && (
            <p className="text-sm text-brand-600">Promo: <span className="font-semibold text-brand-900">{order.promo_code}</span></p>
          )}
        </div>
      </div>

      {/* items table */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-brand-200 text-left text-[11px] uppercase tracking-wider text-brand-500">
            <th className="py-2.5 pr-2">#</th>
            <th className="py-2.5 pr-2">Maal <span className="urdu lowercase tracking-normal">مال</span></th>
            <th className="py-2.5 px-2 text-center">Unit</th>
            <th className="py-2.5 px-2 text-center">Qty</th>
            <th className="py-2.5 px-2 text-right">Rate</th>
            {hasItemDiscounts && <th className="py-2.5 px-2 text-right">Discount</th>}
            <th className="py-2.5 pl-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            const discounted = Number(it.discount) > 0
            const net = it.line_total - (it.discount || 0)
            return (
              <tr key={it.id || i} className="border-b border-brand-50 align-middle">
                <td className="py-3 pr-2 text-brand-400">{i + 1}</td>
                <td className="py-3 pr-2">
                  <p className="font-bold text-brand-900">{it.name}</p>
                  {discounted && (
                    <p className="text-xs font-medium text-saffron-700">
                      {it.discount_note || 'Discount'}: −{money(it.discount)}
                    </p>
                  )}
                </td>
                <td className="py-3 px-2 text-center">
                  {unitOf(it) && (
                    <span className="inline-block rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">{unitOf(it)}</span>
                  )}
                </td>
                <td className="py-3 px-2 text-center font-semibold tabular-nums">{it.qty}</td>
                <td className="py-3 px-2 text-right tabular-nums">{money(it.unit_price)}</td>
                {hasItemDiscounts && (
                  <td className="py-3 px-2 text-right tabular-nums text-saffron-700">
                    {discounted ? `− ${money(it.discount)}` : ''}
                  </td>
                )}
                <td className="py-3 pl-2 text-right font-bold tabular-nums text-brand-900">{money(net)}</td>
              </tr>
            )
          })}

          {/* free items earned from offers */}
          {freeItems.map((f, i) => (
            <tr key={`free-${i}`} className="border-b border-green-100 bg-green-50/40 align-middle">
              <td className="py-3 pr-2 text-green-600">★</td>
              <td className="py-3 pr-2">
                <p className="font-bold text-brand-900">{f.name}</p>
                <p className="text-xs font-semibold text-green-700">Muft — {f.offerTitle}</p>
              </td>
              <td className="py-3 px-2 text-center">
                {f.unit && <span className="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">{f.unit}</span>}
              </td>
              <td className="py-3 px-2 text-center font-semibold tabular-nums">{f.qty}</td>
              <td className="py-3 px-2 text-right tabular-nums text-green-700">FREE</td>
              {hasItemDiscounts && <td className="py-3 px-2" />}
              <td className="py-3 pl-2 text-right font-bold tabular-nums text-green-700">{money(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* totals */}
      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between text-brand-600">
            <span>Subtotal <span className="urdu text-xs text-brand-400">میزان</span></span>
            <span className="font-semibold tabular-nums">{money(order.subtotal)}</span>
          </div>
          {promoLines.map((l, i) => (
            <div key={i} className="flex justify-between text-saffron-700">
              <span>{l.note || l.label}</span>
              <span className="font-semibold tabular-nums">− {money(l.amount)}</span>
            </div>
          ))}
          {Number(order.item_discount) > 0 && (
            <div className="flex justify-between text-saffron-700">
              <span>Product discounts</span>
              <span className="font-semibold tabular-nums">− {money(order.item_discount)}</span>
            </div>
          )}
          {freeItems.length > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Muft items</span>
              <span className="font-semibold tabular-nums">{freeItems.reduce((s, f) => s + (f.qty || 0), 0)} pcs · Rs.0</span>
            </div>
          )}
          <div className="flex justify-between text-brand-600">
            <span>Delivery <span className="urdu text-xs text-brand-400">ڈلیوری</span></span>
            <span className="font-semibold text-brand-600">Free</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-brand-200 pt-2 text-base">
            <span className="font-bold text-brand-900">Total <span className="urdu text-sm text-brand-400">کل</span></span>
            <span className="font-extrabold tabular-nums text-brand-800">{money(order.total)}</span>
          </div>
        </div>
      </div>

      {/* footer */}
      <div className="mt-8 border-t border-brand-100 pt-5 text-center">
        <p className="text-sm font-bold text-brand-800">Shukriya — {brand.full}</p>
        <p className="urdu mt-1 text-sm text-brand-500" dir="rtl">{brand.trustUrdu}</p>
        <p className="mt-1 text-xs text-brand-500">Asli maal, sahi rate, waqt par delivery.</p>
      </div>
    </div>
  )
})

export default Invoice
