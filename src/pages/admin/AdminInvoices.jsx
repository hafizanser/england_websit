import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MagnifyingGlass, ArrowRight, Receipt } from '@phosphor-icons/react'
import { listOrders } from '../../api/admin'
import { useAsync } from '../../hooks/useAsync'
import { money } from '../../lib/cartEngine'
import { AdminTitle, Loader, Card } from '../../components/admin/ui'
import { SourceBadge } from '../../components/admin/SourceBadge'

export default function AdminInvoices() {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const { data, loading, error, reload } = useAsync(() => listOrders({ status: 'all', q: search }), [search])

  return (
    <>
      <AdminTitle title="Invoices" subtitle="Har order ka invoice — kholne ke liye click karein" />

      <Card className="mb-5 p-4">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(q) }} className="relative">
          <MagnifyingGlass size={18} weight="bold" className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Invoice #, customer ya number..."
            className="w-full rounded-2xl border border-brand-200 bg-sand-50 py-2.5 pl-11 pr-4 text-sm outline-none focus:border-brand-500 focus:bg-white"
          />
        </form>
      </Card>

      {loading && <Loader />}
      {!loading && error && (
        <Card className="grid place-items-center py-16 text-center">
          <p className="font-bold text-saffron-800">Invoices load nahi huye</p>
          <button onClick={reload} className="mt-3 rounded-full bg-brand-700 px-5 py-2 text-sm font-semibold text-white">Dobara</button>
        </Card>
      )}

      {!loading && !error && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-100 text-left text-xs uppercase tracking-wider text-brand-400">
                  <th className="px-5 py-3">Invoice #</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.map((o) => (
                  <tr key={o.id} className="border-b border-brand-50 cursor-pointer hover:bg-sand-50">
                    <td className="px-5 py-3.5 font-bold text-brand-900">
                      <Link to={`/admin/invoices/${o.id}`} className="hover:text-brand-700">{o.code}</Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-brand-800">{o.customer_name}</p>
                      <p className="text-xs text-brand-400">{o.customer_phone}</p>
                    </td>
                    <td className="px-5 py-3.5 text-brand-500">{(o.placed_at || '').slice(0, 10)}</td>
                    <td className="px-5 py-3.5"><SourceBadge source={o.source} size="sm" /></td>
                    <td className="px-5 py-3.5 text-right font-bold tabular-nums text-brand-800">{money(o.total)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Link to={`/admin/invoices/${o.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-900">
                        Invoice <ArrowRight size={14} weight="bold" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-16 text-center text-brand-400">
                    <Receipt size={32} className="mx-auto" /><p className="mt-2">Koi invoice nahi.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}
