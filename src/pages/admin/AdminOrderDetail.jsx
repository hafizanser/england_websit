import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  X,
  Tag,
  CircleNotch,
  Clock,
  Receipt,
} from '@phosphor-icons/react'
import { getAdminOrder, updateOrderStatus, setItemDiscount } from '../../api/admin'
import { money } from '../../lib/cartEngine'
import { useNotify } from '../../context/NotifyContext'
import { AdminTitle, Loader, Card, StatusBadge, STATUSES } from '../../components/admin/ui'
import { SourceBadge } from '../../components/admin/SourceBadge'

function ItemRow({ orderId, item, onUpdated }) {
  const discounted = Number(item.discount) > 0
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState(item.discount || 0)
  const [note, setNote] = useState(item.discount_note || '')
  const [saving, setSaving] = useState(false)
  const { success } = useNotify()

  const save = async (value, noteVal) => {
    setSaving(true)
    try {
      const order = await setItemDiscount(orderId, item.id, value, noteVal)
      onUpdated(order)
      setEditing(false)
      success(value > 0 ? `Discount ${money(value)} laga diya` : 'Discount hata diya')
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="border-b border-brand-50 align-top">
      <td className="px-4 py-3">
        <p className="font-bold text-brand-900">{item.name}</p>
        <p className="text-xs text-brand-400">{item.qty} × {money(item.unit_price)}</p>
        {discounted && !editing && (
          <p className="mt-0.5 text-xs font-medium text-saffron-700">
            {item.discount_note || 'Discount'}: −{money(item.discount)}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-right font-semibold tabular-nums text-brand-700">{money(item.line_total)}</td>
      <td className="px-4 py-3 text-right">
        {editing ? (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-brand-400">Rs.</span>
              <input
                type="number"
                min="0"
                max={item.line_total}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-24 rounded-lg border border-brand-200 px-2 py-1.5 text-right text-sm outline-none focus:border-brand-500"
              />
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Wajah (optional)"
              className="w-40 rounded-lg border border-brand-200 px-2 py-1.5 text-sm outline-none focus:border-brand-500"
            />
            <div className="flex gap-1.5">
              <button
                onClick={() => save(amount, note)}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
              >
                {saving ? <CircleNotch size={13} className="animate-spin" /> : <Check size={13} weight="bold" />} Lagao
              </button>
              <button onClick={() => setEditing(false)} className="rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-600">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            {discounted ? (
              <>
                <span className="rounded-lg bg-saffron-50 px-2 py-1 text-xs font-bold text-saffron-700">− {money(item.discount)}</span>
                <button
                  onClick={() => save(0, '')}
                  disabled={saving}
                  aria-label="Discount hatao"
                  className="grid h-7 w-7 place-items-center rounded-lg border border-brand-200 text-brand-500 hover:bg-saffron-50 hover:text-saffron-700"
                >
                  <X size={13} weight="bold" />
                </button>
              </>
            ) : (
              <button
                onClick={() => { setAmount(0); setNote(''); setEditing(true) }}
                className="inline-flex items-center gap-1 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-sand-50"
              >
                <Tag size={13} weight="fill" /> Discount
              </button>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right font-bold tabular-nums text-brand-900">
        {money(item.line_total - (item.discount || 0))}
      </td>
    </tr>
  )
}

export default function AdminOrderDetail() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [state, setState] = useState({ loading: true, error: '' })
  const [statusValue, setStatusValue] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [savingStatus, setSavingStatus] = useState(false)
  const { success } = useNotify()

  const loadOrder = async () => {
    setState({ loading: true, error: '' })
    try {
      const o = await getAdminOrder(id)
      setOrder(o)
      setStatusValue(o.status)
      setState({ loading: false, error: '' })
    } catch (e) {
      setState({ loading: false, error: e.code === 'NETWORK' ? 'Backend offline.' : e.message })
    }
  }

  useEffect(() => {
    loadOrder()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const applyStatus = async () => {
    setSavingStatus(true)
    try {
      const o = await updateOrderStatus(id, statusValue, statusNote)
      setOrder(o)
      setStatusNote('')
      success(`Status "${statusValue}" set ho gaya`)
    } finally {
      setSavingStatus(false)
    }
  }

  if (state.loading) return <Loader />
  if (state.error || !order) {
    return (
      <Card className="grid place-items-center gap-3 px-6 py-20 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-sand-100 text-brand-300">
          <Receipt size={30} weight="duotone" />
        </span>
        <p className="text-lg font-extrabold tracking-tight text-brand-900">
          {state.error && state.error !== 'Backend offline.' ? state.error : 'No orders found for this customer.'}
        </p>
        <p className="max-w-sm text-sm text-brand-500">Yeh order maujood nahi hai ya hata diya gaya hai.</p>
        <Link
          to="/admin/orders"
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-brand-700 px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:bg-brand-800"
        >
          <ArrowLeft size={16} weight="bold" /> Back to Orders
        </Link>
      </Card>
    )
  }

  return (
    <>
      <Link
        to="/admin/orders"
        className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-900"
      >
        <ArrowLeft size={16} weight="bold" /> Back to Orders
      </Link>

      <AdminTitle title={order.code} subtitle={`${order.customer?.name} • ${order.customer?.phone}`}>
        <SourceBadge source={order.source} />
      </AdminTitle>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* items + discounts */}
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-brand-100 p-5">
              <h3 className="text-base font-bold text-brand-900">Order items</h3>
              <span className="text-sm text-brand-400">Per-product discount yahan lagayein</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-100 text-xs uppercase tracking-wider text-brand-400">
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-right">Line</th>
                    <th className="px-4 py-3 text-right">Discount</th>
                    <th className="px-4 py-3 text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((it) => (
                    <ItemRow key={it.id} orderId={id} item={it} onUpdated={setOrder} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-1.5 border-t border-brand-100 p-5 text-sm">
              <div className="flex justify-between text-brand-600"><span>Subtotal</span><span className="font-semibold tabular-nums">{money(order.subtotal)}</span></div>
              {order.discount_lines.map((l, i) => (
                <div key={i} className="flex justify-between text-saffron-700"><span>{l.note || l.label}</span><span className="font-semibold tabular-nums">− {money(l.amount)}</span></div>
              ))}
              {order.item_discount > 0 && (
                <div className="flex justify-between text-saffron-700"><span>Product discounts</span><span className="font-semibold tabular-nums">− {money(order.item_discount)}</span></div>
              )}
              <div className="flex justify-between text-brand-600"><span>Delivery</span><span className="font-semibold text-brand-600">Free</span></div>
              <div className="flex justify-between border-t border-dashed border-brand-200 pt-2 text-base font-bold text-brand-900">
                <span>Total</span><span className="tabular-nums text-brand-800">{money(order.total)}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* status + customer */}
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="text-base font-bold text-brand-900">Status management</h3>
            <div className="mt-3"><StatusBadge status={order.status} /></div>
            <select
              value={statusValue}
              onChange={(e) => setStatusValue(e.target.value)}
              className="mt-4 w-full rounded-2xl border border-brand-200 bg-sand-50 px-4 py-3 text-sm font-semibold capitalize outline-none focus:border-brand-500 focus:bg-white"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="Note (optional)"
              className="mt-2 w-full rounded-2xl border border-brand-200 bg-sand-50 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
            />
            <button
              onClick={applyStatus}
              disabled={savingStatus || statusValue === order.status}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-4 py-3 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50"
            >
              {savingStatus ? <CircleNotch size={16} className="animate-spin" /> : <Check size={16} weight="bold" />} Status update karein
            </button>
          </Card>

          <Card className="p-5">
            <h3 className="text-base font-bold text-brand-900">Customer</h3>
            <p className="mt-2 text-sm font-bold text-brand-800">{order.customer?.name}</p>
            <p className="text-sm text-brand-600">{order.customer?.phone}</p>
            {order.customer?.address && <p className="text-sm text-brand-600">{order.customer.address}</p>}
            {order.customer?.city && <p className="text-sm text-brand-500">{order.customer.city}</p>}
            <Link to={`/admin/customers/${order.customer?.id}`} className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:text-brand-900">
              Customer profile →
            </Link>
          </Card>

          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-base font-bold text-brand-900"><Clock size={18} weight="fill" /> Status history</h3>
            <ol className="mt-3 space-y-3">
              {(order.history || []).map((h, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  <div>
                    <StatusBadge status={h.status} />
                    {h.note && <p className="mt-0.5 text-xs text-brand-500">{h.note}</p>}
                    <p className="text-[11px] text-brand-400">{(h.created_at || '').slice(0, 16)}</p>
                  </div>
                </li>
              ))}
              {(!order.history || order.history.length === 0) && <li className="text-sm text-brand-400">Koi history nahi.</li>}
            </ol>
          </Card>
        </div>
      </div>
    </>
  )
}
