import { useState } from 'react'
import { LockKey, CircleNotch, TrendUp, WarningCircle, Package } from '@phosphor-icons/react'
import { getProfitBreakdown } from '../../api/admin'
import { useNotify } from '../../context/NotifyContext'
import { money } from '../../lib/cartEngine'
import { AdminTitle, Loader, Card } from '../../components/admin/ui'

export default function AdminProfit() {
  const [pin, setPin] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [pinError, setPinError] = useState('')
  const [data, setData] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const { error } = useNotify()

  const unlock = async (e) => {
    e.preventDefault()
    setPinError('')
    setUnlocking(true)
    try {
      const res = await getProfitBreakdown(pin)
      setData(res.data || [])
      setSummary(res.summary || null)
      setUnlocked(true)
    } catch (err) {
      if (err.status === 401) setPinError('Ghalat PIN. Dobara koshish karein.')
      else error(err.message || 'Load nahi hua')
    } finally {
      setUnlocking(false)
    }
  }

  const refresh = async () => {
    setLoading(true)
    try {
      const res = await getProfitBreakdown(pin)
      setData(res.data || [])
      setSummary(res.summary || null)
    } catch (err) {
      error(err.message || 'Load nahi hua')
    } finally {
      setLoading(false)
    }
  }

  if (!unlocked) {
    return (
      <div className="grid min-h-[60dvh] place-items-center">
        <Card className="w-full max-w-sm p-8 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-700 text-saffron-300">
            <LockKey size={30} weight="fill" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold tracking-tight text-brand-900">Profit Breakdown</h1>
          <p className="mt-1 text-sm text-brand-500">Yeh page protected hai. 4-digit PIN daalein.</p>

          <form onSubmit={unlock} className="mt-6 space-y-4">
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              autoFocus
              placeholder="••••"
              className="w-full rounded-2xl border border-brand-200 bg-sand-50 py-3 text-center text-2xl font-black tracking-[0.5em] text-brand-900 outline-none focus:border-brand-500 focus:bg-white"
            />
            {pinError && (
              <p className="flex items-center justify-center gap-2 rounded-xl bg-saffron-50 px-3 py-2 text-sm font-medium text-saffron-800">
                <WarningCircle size={18} weight="fill" /> {pinError}
              </p>
            )}
            <button
              type="submit"
              disabled={unlocking || pin.length !== 4}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-6 py-3 text-sm font-bold text-white shadow-soft hover:bg-brand-800 disabled:opacity-50"
            >
              {unlocking ? <CircleNotch size={18} className="animate-spin" /> : <LockKey size={18} weight="bold" />} Unlock
            </button>
          </form>
        </Card>
      </div>
    )
  }

  return (
    <>
      <AdminTitle title="Profit Breakdown" subtitle="Selling price minus production cost (private)">
        <button onClick={refresh} className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2.5 text-sm font-bold text-brand-700 hover:bg-sand-50">
          {loading ? <CircleNotch size={16} className="animate-spin" /> : null} Refresh
        </button>
      </AdminTitle>

      {summary && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <Card className="p-5"><p className="text-xs uppercase tracking-wider text-brand-400">Products</p><p className="mt-1 text-2xl font-extrabold text-brand-900">{summary.products}</p></Card>
          <Card className="p-5"><p className="text-xs uppercase tracking-wider text-brand-400">Potential stock profit</p><p className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-brand-900"><TrendUp size={22} weight="bold" className="text-brand-600" />{money(summary.total_potential)}</p></Card>
          <Card className="p-5"><p className="text-xs uppercase tracking-wider text-brand-400">Cost missing</p><p className="mt-1 text-2xl font-extrabold text-saffron-700">{summary.missing_cost}</p></Card>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-100 text-left text-xs uppercase tracking-wider text-brand-400">
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Unit</th>
                <th className="px-5 py-3 text-right">Selling</th>
                <th className="px-5 py-3 text-right">Cost</th>
                <th className="px-5 py-3 text-right">Profit</th>
                <th className="px-5 py-3 text-right">Margin</th>
                <th className="px-5 py-3 text-right">Stock profit</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-b border-brand-50 hover:bg-sand-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {p.product_image_url ? (
                        <img src={p.product_image_url} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-brand-100 object-cover" />
                      ) : (
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sand-100 text-brand-300"><Package size={16} /></span>
                      )}
                      <div>
                        <p className="font-bold text-brand-900">{p.product_name}</p>
                        <p className="text-xs text-brand-400">{p.category_name || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-brand-600">{p.headline?.label || '—'}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-brand-600">{p.headline?.price > 0 ? money(p.headline.price) : '—'}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-brand-600">{p.headline?.cost > 0 ? money(p.headline.cost) : '—'}</td>
                  <td className="px-5 py-3 text-right font-bold tabular-nums">{p.headline?.profit != null ? <span className={p.headline.profit >= 0 ? 'text-brand-800' : 'text-saffron-700'}>{money(p.headline.profit)}</span> : <span className="text-brand-300">—</span>}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-brand-600">{p.headline?.margin != null ? `${p.headline.margin}%` : '—'}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold text-brand-700">{p.potential_profit > 0 ? money(p.potential_profit) : '—'}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-16 text-center text-brand-400"><TrendUp size={30} className="mx-auto" /><p className="mt-2">Koi data nahi.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
