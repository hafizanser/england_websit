import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { MagnifyingGlass, Receipt, ArrowRight, Package, CircleNotch, WarningCircle } from '@phosphor-icons/react'
import PageHeader from '../components/PageHeader'
import { EmptyState } from '../components/ui'
import { useSession } from '../context/SessionContext'
import { lookupOrders } from '../api/orders'
import { money } from '../lib/cartEngine'

const statusTone = {
  pending: 'bg-saffron-100 text-saffron-800',
  confirmed: 'bg-brand-100 text-brand-800',
  packed: 'bg-brand-100 text-brand-800',
  shipped: 'bg-brand-100 text-brand-800',
  delivered: 'bg-brand-700 text-white',
  cancelled: 'bg-sand-200 text-brand-500',
}
const statusText = {
  pending: 'Naya', confirmed: 'Confirmed', packed: 'Packed', shipped: 'Ravana', delivered: 'Delivered', cancelled: 'Cancelled',
}

export default function OrderHistoryPage() {
  const { customer, setCustomer } = useSession()
  const [phone, setPhone] = useState(customer?.phone || '')
  const [state, setState] = useState({ loading: false, error: '', searched: false, customer: null, orders: [] })

  const run = async (p) => {
    if (p.replace(/[^0-9]/g, '').length < 7) {
      setState((s) => ({ ...s, error: 'Sahi mobile number likhein.' }))
      return
    }
    setState({ loading: true, error: '', searched: true, customer: null, orders: [] })
    try {
      const res = await lookupOrders(p)
      setState({ loading: false, error: '', searched: true, customer: res.customer, orders: res.orders || [] })
      if (res.customer) {
        setCustomer({
          id: res.customer.id,
          name: res.customer.name,
          phone: res.customer.phone,
          city: res.customer.city,
          address: res.customer.address,
          email: res.customer.email,
        })
      }
    } catch (e) {
      setState({
        loading: false,
        searched: true,
        customer: null,
        orders: [],
        error: e.code === 'NETWORK' ? 'Backend se rabta nahi ho saka. Apache (XAMPP) chal raha hai?' : e.message,
      })
    }
  }

  // auto-load for a returning customer
  useEffect(() => {
    if (customer?.phone) run(customer.phone)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <PageHeader
        eyebrow="Meri Orders"
        title="Order"
        accent="history"
        urdu="آپ کے آرڈرز کی تفصیل"
        desc="Apna mobile number daalein aur apni tamam orders, status aur invoice dekhein."
        crumb="My Orders"
      />

      <section className="container-page py-10 sm:py-14">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            run(phone)
          }}
          className="mx-auto flex max-w-xl gap-2"
        >
          <div className="relative flex-1">
            <MagnifyingGlass size={18} weight="bold" className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-400" />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
              inputMode="numeric"
              maxLength={11}
              placeholder="Apna mobile number, jaise 0312 4361300"
              className="w-full rounded-2xl border border-brand-200 bg-white py-3.5 pl-11 pr-4 text-sm text-brand-900 outline-none transition-all placeholder:text-brand-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <button
            type="submit"
            className="shrink-0 rounded-2xl bg-brand-700 px-6 py-3.5 text-sm font-bold text-white shadow-soft transition-all hover:bg-brand-800 active:translate-y-px"
          >
            Dhoondein
          </button>
        </form>

        {state.error && (
          <p className="mx-auto mt-4 flex max-w-xl items-center gap-2 rounded-2xl bg-saffron-50 px-4 py-3 text-sm font-medium text-saffron-800">
            <WarningCircle size={18} weight="fill" /> {state.error}
          </p>
        )}

        <div className="mx-auto mt-8 max-w-2xl">
          {state.loading && (
            <div className="grid place-items-center py-16 text-brand-400">
              <CircleNotch size={34} className="animate-spin" />
            </div>
          )}

          {!state.loading && state.searched && !state.error && state.orders.length === 0 && (
            <EmptyState
              icon={Receipt}
              title="Koi order nahi mila"
              text="Is number par abhi koi order nahi. Pehli baar order karne ke liye shopping shuru karein."
              action={
                <Link
                  to="/products"
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-800"
                >
                  Shopping shuru karein <ArrowRight size={15} weight="bold" />
                </Link>
              }
            />
          )}

          {!state.loading && state.orders.length > 0 && (
            <div className="space-y-3">
              {state.customer && (
                <p className="text-sm text-brand-600">
                  <span className="font-bold text-brand-900">{state.customer.name}</span> — {state.orders.length} orders
                </p>
              )}
              {state.orders.map((o) => (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-brand-100 bg-white p-4 shadow-soft sm:p-5"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                      <Package size={20} weight="fill" />
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-brand-900">{o.code}</p>
                      <p className="text-xs text-brand-500">
                        {(o.placed_at || '').slice(0, 10)} • {(o.items || []).length} items
                        {o.source === 'admin' && <span className="ml-1 text-saffron-700">• Admin</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone[o.status] || 'bg-sand-200 text-brand-600'}`}>
                      {statusText[o.status] || o.status}
                    </span>
                    <span className="text-base font-extrabold tracking-tight text-brand-800">{money(o.total)}</span>
                    <Link
                      to={`/order/${o.code}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-700 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-brand-800"
                    >
                      Detail <ArrowRight size={14} weight="bold" />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
