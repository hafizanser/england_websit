import { Link, Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { UserCircle, SignOut, Package, Receipt, ArrowRight, MapPin, Phone, EnvelopeSimple, CalendarBlank, Bag, Wallet } from '@phosphor-icons/react'
import PageHeader from '../components/PageHeader'
import { ErrorState, EmptyState } from '../components/ui'
import { useCustomerAuth } from '../context/CustomerAuthContext'
import { useNotify } from '../context/NotifyContext'
import { useAsync } from '../hooks/useAsync'
import { getMyOrders } from '../api/customer'
import { money } from '../lib/cartEngine'

const statusMeta = {
  pending: { label: 'Naya', cls: 'bg-saffron-100 text-saffron-800' },
  confirmed: { label: 'Confirmed', cls: 'bg-blue-100 text-blue-700' },
  packed: { label: 'Packed', cls: 'bg-indigo-100 text-indigo-700' },
  shipped: { label: 'Ravana', cls: 'bg-purple-100 text-purple-700' },
  delivered: { label: 'Delivered', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-sand-200 text-brand-500' },
}

const fmtDate = (d) => {
  if (!d) return ''
  const date = new Date(String(d).replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? String(d).slice(0, 10) : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MyProfilePage() {
  const { customer, isLoggedIn, loading: authLoading, logout } = useCustomerAuth()
  const { success } = useNotify()
  const navigate = useNavigate()
  // Only fetch once we know a customer is logged in.
  const { data, loading, error, reload } = useAsync(() => (isLoggedIn ? getMyOrders() : Promise.resolve({ orders: [] })), [isLoggedIn])

  if (authLoading) {
    return (
      <section className="container-page py-20 text-center text-brand-400">Load ho raha hai...</section>
    )
  }
  if (!isLoggedIn) return <Navigate to="/login" replace />

  const orders = data?.orders || []
  // Account stats — derived from the order history + account record.
  const totalSpent = orders.reduce((s, o) => s + (Number(o.total) || 0), 0)
  const memberSince = (() => {
    const raw = customer?.created_at
    if (!raw) return null
    const d = new Date(String(raw).replace(' ', 'T'))
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  })()
  const accountStats = [
    { icon: Bag, label: 'Total orders', value: orders.length },
    { icon: Wallet, label: 'Total kharch', value: money(totalSpent) },
    { icon: CalendarBlank, label: 'Member since', value: memberSince || '—' },
  ]

  const onLogout = async () => {
    await logout()
    success('Logout ho gaya')
    navigate('/')
  }

  return (
    <>
      <PageHeader eyebrow="Mera Account" title="My Profile" urdu="میرا اکاؤنٹ" crumb="Profile" />
      <section className="container-page py-12 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.8fr] lg:gap-10">
          {/* account card */}
          <div className="lg:sticky lg:top-[100px] lg:self-start">
            <div className="rounded-4xl border border-brand-100 bg-white p-6 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                  <UserCircle size={32} weight="fill" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-extrabold tracking-tight text-brand-900">{customer?.name}</h2>
                  <p className="text-xs font-semibold text-brand-400">England account</p>
                </div>
              </div>

              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex items-center gap-2.5 text-brand-700">
                  <Phone size={16} weight="fill" className="text-brand-400" /> {customer?.phone || '—'}
                </div>
                {customer?.email && (
                  <div className="flex items-center gap-2.5 text-brand-700">
                    <EnvelopeSimple size={16} weight="fill" className="text-brand-400" /> {customer.email}
                  </div>
                )}
                {(customer?.address || customer?.city) && (
                  <div className="flex items-start gap-2.5 text-brand-700">
                    <MapPin size={16} weight="fill" className="mt-0.5 shrink-0 text-brand-400" />
                    <span>{[customer.address, customer.city].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </dl>

              {/* account stats */}
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-brand-50 pt-5">
                {accountStats.map((s) => (
                  <div key={s.label} className="rounded-2xl bg-sand-50 px-2 py-3 text-center">
                    <s.icon size={18} weight="fill" className="mx-auto text-brand-400" />
                    <p className="mt-1.5 truncate text-sm font-extrabold tracking-tight text-brand-900">{s.value}</p>
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-400">{s.label}</p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-200 px-5 py-3 text-sm font-bold text-brand-700 transition-all hover:bg-sand-50 active:translate-y-px"
              >
                <SignOut size={18} weight="bold" /> Logout
              </button>
            </div>
          </div>

          {/* order history */}
          <div>
            <div className="mb-4 flex items-center gap-2 text-brand-900">
              <Receipt size={20} weight="fill" className="text-brand-600" />
              <h2 className="text-lg font-extrabold tracking-tight">Order history</h2>
            </div>

            {loading && <div className="rounded-3xl border border-brand-100 bg-white p-10 text-center text-brand-400 shadow-soft">Load ho raha hai...</div>}

            {!loading && error && <ErrorState message={error.message} onRetry={reload} />}

            {!loading && !error && orders.length === 0 && (
              <EmptyState
                icon={Package}
                title="Abhi koi order nahi"
                text="Aapne abhi tak koi order nahi kiya. Pehla order karne ke baad woh yahan nazar aayega."
                action={
                  <Link to="/products" className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-800">
                    Shopping shuru karein <ArrowRight size={16} weight="bold" />
                  </Link>
                }
              />
            )}

            {!loading && !error && orders.length > 0 && (
              <div className="space-y-3">
                {orders.map((o) => {
                  const meta = statusMeta[o.status] || { label: o.status, cls: 'bg-sand-200 text-brand-600' }
                  const itemCount = (o.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0)
                  return (
                    <motion.div key={o.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                      <Link
                        to={`/order/${o.code}`}
                        className="flex items-center justify-between gap-4 rounded-3xl border border-brand-100 bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift sm:p-5"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-display text-base font-extrabold tracking-tight text-brand-900">{o.code}</span>
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${meta.cls}`}>{meta.label}</span>
                          </div>
                          <p className="mt-1 text-xs text-brand-500">
                            {fmtDate(o.placed_at)} · {itemCount} {itemCount === 1 ? 'item' : 'items'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-base font-extrabold tracking-tight text-brand-800">{money(o.total)}</span>
                          <ArrowRight size={18} weight="bold" className="text-brand-400" />
                        </div>
                      </Link>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
