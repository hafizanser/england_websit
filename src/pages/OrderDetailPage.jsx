import { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  CheckCircle,
  Printer,
  FilePdf,
  WhatsappLogo,
  ArrowRight,
  Spinner,
  Package,
  CircleNotch,
} from '@phosphor-icons/react'
import PageHeader from '../components/PageHeader'
import Invoice from '../components/Invoice'
import { ErrorState } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { getOrder } from '../api/orders'
import { getOffers } from '../api/offers'
import { printInvoice, downloadPdf, shareOrderImage } from '../lib/invoice'
import { money, computeFreeItems } from '../lib/cartEngine'
import { brand } from '../data/site'

const FLOW = ['pending', 'confirmed', 'packed', 'shipped', 'delivered']
const labels = {
  pending: 'Order mila',
  confirmed: 'Confirmed',
  packed: 'Pack hua',
  shipped: 'Ravana',
  delivered: 'Deliver hua',
}

function StatusTracker({ order }) {
  if (order.status === 'cancelled') {
    return (
      <div className="rounded-3xl border border-saffron-200 bg-saffron-50 p-5 text-center">
        <p className="text-sm font-bold text-saffron-800">Yeh order cancel kar diya gaya hai.</p>
      </div>
    )
  }
  const idx = FLOW.indexOf(order.status)
  return (
    <div className="rounded-3xl border border-brand-100 bg-white p-5 shadow-soft sm:p-6">
      <p className="mb-5 text-sm font-bold text-brand-900">Order tracking</p>
      <ol className="grid grid-cols-5 gap-2">
        {FLOW.map((s, i) => {
          const done = i <= idx
          return (
            <li key={s} className="flex flex-col items-center text-center">
              <span
                className={`grid h-9 w-9 place-items-center rounded-full text-xs font-bold transition-colors ${
                  done ? 'bg-brand-700 text-white' : 'bg-sand-100 text-brand-300'
                }`}
              >
                {done ? <CheckCircle size={18} weight="fill" /> : i + 1}
              </span>
              <span className={`mt-2 text-[11px] font-semibold ${done ? 'text-brand-800' : 'text-brand-300'}`}>
                {labels[s]}
              </span>
              {i < FLOW.length - 1 && (
                <span className="sr-only">→</span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default function OrderDetailPage() {
  const { code } = useParams()
  const location = useLocation()
  const justPlaced = location.state?.justPlaced
  const invoiceRef = useRef(null)
  const [busy, setBusy] = useState('')

  const { data: order, loading, error, reload } = useAsync(() => getOrder(code), [code])
  const { data: offers } = useAsync(() => getOffers(), [])

  // Free items earned from active offers — same logic as the cart, shown in the
  // order so the shopkeeper sees exactly what they got for free.
  const freeItems = useMemo(
    () => computeFreeItems(offers || [], (order?.items || []).map((it) => ({ id: it.product_id, unitKey: it.unit, qty: it.qty }))),
    [offers, order],
  )

  const handlePdf = async () => {
    setBusy('pdf')
    try {
      await downloadPdf(invoiceRef.current, `${code}-invoice.pdf`)
    } finally {
      setBusy('')
    }
  }

  const handleShare = async () => {
    setBusy('share')
    try {
      const lines = (order.items || [])
        .map((i) => `• ${i.qty} x ${i.name} = ${money(i.line_total - (i.discount || 0))}`)
        .join('\n')
      const text = `${brand.full} Order ${order.code}\n\n${lines}\n\nTotal: ${money(order.total)}\nShukriya — ${brand.full}`
      await shareOrderImage(invoiceRef.current, {
        filename: `${code}.png`,
        text,
        phone: brand.whatsapp,
      })
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={justPlaced ? 'Order Confirmed' : 'Order Detail'}
        title={code}
        urdu={justPlaced ? 'آپ کا آرڈر موصول ہو گیا' : 'آرڈر کی تفصیل'}
        crumb="Order"
      >
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/10"
        >
          Meri saari orders <ArrowRight size={15} weight="bold" />
        </Link>
      </PageHeader>

      <section className="container-page py-10 sm:py-14">
        {loading && (
          <div className="grid place-items-center py-20 text-brand-400">
            <CircleNotch size={36} className="animate-spin" />
            <p className="mt-3 text-sm">Order load ho raha hai...</p>
          </div>
        )}

        {!loading && error && (
          <div className="grid">
            <ErrorState
              message={error.code === 'NETWORK' ? 'Backend se rabta nahi ho saka. Apache (XAMPP) chal raha hai?' : error.message}
              onRetry={reload}
            />
          </div>
        )}

        {!loading && !error && order && (
          <div className="space-y-6">
            {justPlaced && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="no-print flex items-center gap-4 rounded-3xl border border-brand-200 bg-brand-50 p-5 sm:p-6"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-700 text-white">
                  <CheckCircle size={26} weight="fill" />
                </span>
                <div>
                  <p className="text-base font-extrabold text-brand-900">Shukriya! Order place ho gaya.</p>
                  <p className="text-sm text-brand-600">
                    Hamari team jald aapse rabta karegi. Order {order.code} ki tafseelat neeche hai.
                  </p>
                </div>
              </motion.div>
            )}

            <StatusTracker order={order} />

            {/* actions — full-width stacked on phones, inline on desktop */}
            <div className="no-print grid grid-cols-1 gap-2.5 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
              {/* primary share action first on mobile for thumb reach */}
              <button
                type="button"
                onClick={handleShare}
                disabled={busy === 'share'}
                className="order-first inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-brand-700 px-5 py-3 text-sm font-bold text-white shadow-soft transition-all hover:bg-brand-800 active:translate-y-px disabled:opacity-60 sm:order-last"
              >
                {busy === 'share' ? <Spinner size={18} className="animate-spin text-saffron-300" /> : <WhatsappLogo size={18} weight="fill" className="text-saffron-300" />}
                WhatsApp par bhejein (PNG)
              </button>
              <button
                type="button"
                onClick={handlePdf}
                disabled={busy === 'pdf'}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-brand-200 bg-white px-5 py-3 text-sm font-bold text-brand-800 transition-all hover:bg-sand-50 active:translate-y-px disabled:opacity-60"
              >
                {busy === 'pdf' ? <Spinner size={18} className="animate-spin" /> : <FilePdf size={18} weight="fill" />}
                PDF download
              </button>
              <button
                type="button"
                onClick={printInvoice}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-brand-200 bg-white px-5 py-3 text-sm font-bold text-brand-800 transition-all hover:bg-sand-50 active:translate-y-px"
              >
                <Printer size={18} weight="fill" /> Print invoice
              </button>
            </div>

            {/* invoice */}
            <div className="overflow-hidden rounded-4xl border border-brand-100 bg-white shadow-soft">
              <Invoice ref={invoiceRef} order={order} freeItems={freeItems} />
            </div>

            <div className="no-print flex justify-center">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 rounded-full border border-brand-200 px-6 py-3 text-sm font-semibold text-brand-800 transition-all hover:bg-white"
              >
                <Package size={16} weight="fill" /> Aur shopping karein
              </Link>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
