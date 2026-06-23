import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Phone, MapPin, EnvelopeSimple, Receipt } from '@phosphor-icons/react'
import { getCustomer } from '../../api/admin'
import { useAsync } from '../../hooks/useAsync'
import { money } from '../../lib/cartEngine'
import { AdminTitle, Loader, Card, StatusBadge } from '../../components/admin/ui'

export default function AdminCustomerDetail() {
  const { id } = useParams()
  const { data: customer, loading, error } = useAsync(() => getCustomer(id), [id])

  if (loading) return <Loader />
  if (error || !customer) {
    return (
      <Card className="grid place-items-center py-16 text-center">
        <p className="font-bold text-saffron-800">{error?.message || 'Customer nahi mila'}</p>
        <Link to="/admin/customers" className="mt-3 text-sm font-semibold text-brand-700">← Customers</Link>
      </Card>
    )
  }

  const orders = customer.orders || []
  const totalSpent = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0)

  return (
    <>
      <Link to="/admin/customers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-900">
        <ArrowLeft size={16} weight="bold" /> Customers
      </Link>

      <AdminTitle title={customer.name} subtitle={`Member since ${(customer.created_at || '').slice(0, 10)}`} />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <Card className="p-6">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-700 text-xl font-black text-saffron-300">
            {(customer.name || '?').charAt(0)}
          </span>
          <h3 className="mt-3 text-lg font-extrabold text-brand-900">{customer.name}</h3>
          <div className="mt-4 space-y-2.5 text-sm text-brand-600">
            <p className="flex items-center gap-2"><Phone size={16} weight="fill" className="text-brand-400" /> {customer.phone}</p>
            {customer.email && <p className="flex items-center gap-2"><EnvelopeSimple size={16} weight="fill" className="text-brand-400" /> {customer.email}</p>}
            {customer.address && <p className="flex items-start gap-2"><MapPin size={16} weight="fill" className="mt-0.5 text-brand-400" /> {customer.address}{customer.city ? `, ${customer.city}` : ''}</p>}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-brand-100 pt-5">
            <div>
              <p className="text-2xl font-extrabold tracking-tight text-brand-800">{orders.length}</p>
              <p className="text-xs text-brand-500">Orders</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold tracking-tight text-brand-800">{money(totalSpent)}</p>
              <p className="text-xs text-brand-500">Total kharcha</p>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <h3 className="border-b border-brand-100 p-5 text-base font-bold text-brand-900">Order history</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-100 text-left text-xs uppercase tracking-wider text-brand-400">
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-brand-50">
                    <td className="px-5 py-3 font-bold text-brand-900">{o.code}</td>
                    <td className="px-5 py-3 text-brand-500">{(o.placed_at || '').slice(0, 10)}</td>
                    <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-5 py-3 text-right font-bold tabular-nums text-brand-800">{money(o.total)}</td>
                    <td className="px-5 py-3 text-right">
                      <Link to={`/admin/orders/${o.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                        Kholein <ArrowRight size={14} weight="bold" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-brand-400">
                    <Receipt size={28} className="mx-auto" /><p className="mt-2">Koi order nahi.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}
