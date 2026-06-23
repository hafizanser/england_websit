import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  WarningCircle,
  User,
  Storefront,
  Phone,
  MapPin,
  Truck,
  CalendarBlank,
  Coins,
  TrendUp,
} from '@phosphor-icons/react'
import { AdminTitle, Card, Loader, StatusBadge } from '../../components/admin/ui'
import ProfitPinGate from '../../components/admin/ProfitPinGate'
import { getProfitOrderDetail } from '../../api/admin'
import { getProfitPin, setProfitPin } from '../../lib/profitPin'
import { money } from '../../lib/cartEngine'
import { useNotify } from '../../context/NotifyContext'

const UNIT_LABEL = {
  cotton: 'Carton',
  box: 'Box',
  packet: 'Packet',
  dozen: 'Dozen',
  bundle: 'Bundle',
  piece: 'Piece',
}

export default function AdminProfitDetails() {
  const { id } = useParams()
  const { error } = useNotify()

  const [pin, setPin] = useState(getProfitPin())
  const [unlocked, setUnlocked] = useState(Boolean(getProfitPin()))
  const [gateLoading, setGateLoading] = useState(false)
  const [gateError, setGateError] = useState('')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const load = async (p) => {
    setLoading(true)
    setNotFound(false)
    try {
      const res = await getProfitOrderDetail(id, p)
      setData(res)
      return true
    } catch (err) {
      if (err.status === 401) {
        setUnlocked(false)
        setProfitPin('')
        return false
      }
      if (err.status === 404) {
        setNotFound(true)
        return true
      }
      error(err.message || 'Load nahi hua')
      return true
    } finally {
      setLoading(false)
    }
  }

  // Load when unlocked (with a stored PIN) or when the order id changes.
  useEffect(() => {
    if (unlocked && pin) load(pin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (unlocked && pin && !data) load(pin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const unlock = async (e) => {
    e?.preventDefault()
    setGateError('')
    setGateLoading(true)
    try {
      const res = await getProfitOrderDetail(id, pin)
      setData(res)
      setProfitPin(pin)
      setUnlocked(true)
    } catch (err) {
      if (err.status === 401) setGateError('Ghalat PIN. Dobara koshish karein.')
      else if (err.status === 404) {
        setProfitPin(pin)
        setUnlocked(true)
        setNotFound(true)
      } else error(err.message || 'Load nahi hua')
    } finally {
      setGateLoading(false)
    }
  }

  if (!unlocked) {
    return (
      <ProfitPinGate
        pin={pin}
        setPin={setPin}
        onSubmit={unlock}
        error={gateError}
        loading={gateLoading}
        title="Profit Details"
      />
    )
  }

  const backLink = (
    <Link
      to="/admin/profits"
      className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2.5 text-sm font-bold text-brand-700 hover:bg-sand-50"
    >
      <ArrowLeft size={16} weight="bold" /> Back
    </Link>
  )

  if (loading && !data) return <Loader label="Breakdown load ho raha hai..." />

  if (notFound) {
    return (
      <>
        <AdminTitle title="Profit Details">{backLink}</AdminTitle>
        <Card className="p-12 text-center text-brand-400">
          <WarningCircle size={34} className="mx-auto" />
          <p className="mt-3 font-semibold text-brand-700">Order ENG-{1000 + Number(id)} nahi mila.</p>
        </Card>
      </>
    )
  }

  if (!data) return null

  const { order, items, total_profit, total_price, has_missing } = data

  return (
    <>
      <AdminTitle title={`Profit Breakdown · Order ENG-${1000 + Number(order.order_id)}`} subtitle="Per-item earnings for this order">
        {backLink}
      </AdminTitle>

      {/* Customer + logistics */}
      <div className="mb-5 grid gap-3 sm:gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-400">Customer &amp; Shop</p>
          <div className="space-y-2.5">
            <InfoRow icon={User} label="Customer" value={order.customer_name || '—'} />
            <InfoRow icon={Storefront} label="Shop / Branch" value={order.shop_name || '—'} />
            <InfoRow icon={Phone} label="Phone" value={order.customer_phone_number || '—'} />
            <InfoRow icon={MapPin} label="Address" value={order.customer_address || '—'} />
          </div>
        </Card>
        <Card className="p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-400">Order Info</p>
          <div className="space-y-2.5">
            <InfoRow icon={CalendarBlank} label="Order Date" value={(order.order_date || '').slice(0, 16)} />
            <InfoRow icon={Truck} label="Transport" value={order.transport_mode || order.adda_name || '—'} />
            <InfoRow icon={Storefront} label="Pandi" value={order.pandi_name || '—'} />
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm text-brand-500">
                <Coins size={15} weight="fill" className="text-brand-400" /> Status
              </span>
              <span className="flex items-center gap-2">
                {order.order_source && (
                  <span className="rounded-full bg-sand-100 px-2.5 py-0.5 text-[11px] font-bold capitalize text-brand-600">
                    {order.order_source}
                  </span>
                )}
                {order.status && <StatusBadge status={String(order.status).toLowerCase()} />}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {has_missing && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-saffron-200 bg-saffron-50 px-4 py-3 text-sm text-saffron-800">
          <WarningCircle size={20} weight="fill" className="mt-0.5 shrink-0" />
          <p>
            Kuch products ki production price set nahi hai (<span className="font-bold">N/P</span>). In items ka profit
            0 count hua hai.
          </p>
        </div>
      )}

      {/* Line items */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-100 text-left text-xs uppercase tracking-wider text-brand-400">
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Qty</th>
                <th className="px-5 py-3">Unit</th>
                <th className="px-5 py-3 text-right">Sale Price</th>
                <th className="px-5 py-3 text-right">Prod. Price</th>
                <th className="px-5 py-3 text-right">Item Total</th>
                <th className="px-5 py-3 text-right">Net Profit</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-brand-50 hover:bg-sand-50">
                  <td className="px-5 py-3.5 font-bold text-brand-900">{it.product_name}</td>
                  <td className="px-5 py-3.5 text-brand-700">
                    {it.quantity}
                    {it.free_quantity > 0 && (
                      <span className="ml-1 text-xs font-semibold text-wa-600">+{it.free_quantity} free</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-brand-600">{UNIT_LABEL[it.unit_type] || it.unit_type || '—'}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-brand-600">{money(it.product_price)}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums">
                    {it.production_price == null ? (
                      <span className="rounded-md bg-saffron-100 px-1.5 py-0.5 text-[11px] font-bold text-saffron-700">
                        N/P
                      </span>
                    ) : (
                      <span className="text-brand-600">{money(it.production_price)}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-brand-700">{money(it.item_total)}</td>
                  <td className="px-5 py-3.5 text-right font-bold tabular-nums">
                    {it.production_price == null ? (
                      <span className="text-brand-300">—</span>
                    ) : (
                      <span className={it.line_profit >= 0 ? 'text-brand-800' : 'text-saffron-700'}>
                        {money(it.line_profit)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-brand-100 bg-sand-50">
                <td colSpan={5} className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-brand-500">
                  Totals
                </td>
                <td className="px-5 py-4 text-right font-display text-base font-extrabold tabular-nums text-brand-900">
                  {money(total_price)}
                </td>
                <td className="px-5 py-4 text-right">
                  <span className="inline-flex items-center gap-1.5 font-display text-base font-extrabold tabular-nums text-brand-900">
                    <TrendUp size={16} weight="bold" className="text-brand-600" /> {money(total_profit)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-sm text-brand-500">
        <Icon size={15} weight="fill" className="text-brand-400" /> {label}
      </span>
      <span className="max-w-[60%] truncate text-right text-sm font-semibold text-brand-900">{value}</span>
    </div>
  )
}
