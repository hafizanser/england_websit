import { useEffect, useState } from 'react'
import { Star, ChatCircleText, PencilSimple, Trash, CircleNotch, Package } from '@phosphor-icons/react'
import { adminListReviews, adminUpdateReview, adminDeleteReview } from '../../api/reviews'
import { useNotify } from '../../context/NotifyContext'
import { AdminTitle, Loader, Card, EmptyState } from '../../components/admin/ui'
import Modal, { field, fieldLabel } from '../../components/admin/Modal'

const STATUS = {
  approved: { label: 'Approved', cls: 'bg-green-50 text-green-700 ring-green-200' },
  pending: { label: 'Pending', cls: 'bg-saffron-50 text-saffron-700 ring-saffron-200' },
  rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-600 ring-red-200' },
}

function Stars({ rating, size = 15 }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} weight={n <= rating ? 'fill' : 'regular'} className={n <= rating ? 'text-saffron-400' : 'text-brand-200'} />
      ))}
    </span>
  )
}

const fmtDate = (d) => {
  if (!d) return ''
  const date = new Date(String(d).replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminReviews() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const { confirm, success, error } = useNotify()

  const load = async () => {
    setLoading(true)
    try {
      setRows(await adminListReviews())
    } catch (e) {
      error(e.code === 'NETWORK' ? 'Backend offline — order_system se rabta nahi hua.' : e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const shown = filter === 'all' ? rows : rows.filter((r) => r.status === filter)
  const avg = rows.length ? (rows.reduce((s, r) => s + r.rating, 0) / rows.length).toFixed(1) : '0.0'

  const onSave = async () => {
    setSaving(true)
    try {
      await adminUpdateReview(editing.id, { rating: editing.rating, comment: editing.comment, status: editing.status, customer_name: editing.customer_name })
      setEditing(null)
      await load()
      success('Review update ho gaya')
    } catch (e) {
      error(e.message || 'Save nahi hua')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (r) => {
    const ok = await confirm({ tone: 'danger', title: 'Review delete karein?', text: `${r.customer_name} ka review hat jayega.`, confirmText: 'Haan, delete' })
    if (!ok) return
    try {
      await adminDeleteReview(r.id)
      await load()
      success('Review delete ho gaya')
    } catch (e) {
      error(e.message || 'Delete nahi hua')
    }
  }

  return (
    <>
      <AdminTitle eyebrow="Engagement" icon={ChatCircleText} title="Ratings & Reviews" subtitle={`${rows.length} reviews • average ${avg}★`} />

      {/* status filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        {['all', 'approved', 'pending', 'rejected'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full px-4 py-2 text-xs font-bold capitalize transition-all ${
              filter === s ? 'bg-brand-900 text-white shadow-soft' : 'bg-white text-brand-600 ring-1 ring-brand-200 hover:bg-sand-50'
            }`}
          >
            {s === 'all' ? 'All' : STATUS[s]?.label} {s !== 'all' && <span className="opacity-70">({rows.filter((r) => r.status === s).length})</span>}
          </button>
        ))}
      </div>

      {loading ? <Loader /> : shown.length === 0 ? (
        <EmptyState icon={ChatCircleText} title="Koi review nahi" text="Jab customers products par review denge, woh yahan nazar aayenge." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-base font-extrabold text-white">
                    {(r.customer_name || 'C').charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-brand-900">{r.customer_name}</p>
                    <p className="flex items-center gap-1 text-xs text-brand-400"><Package size={12} weight="fill" /> {r.product_name || `#${r.product_id}`}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${STATUS[r.status]?.cls || STATUS.approved.cls}`}>
                  {STATUS[r.status]?.label || r.status}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Stars rating={r.rating} />
                <span className="text-xs text-brand-400">{fmtDate(r.created_at)}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-brand-700">{r.comment}</p>

              <div className="mt-4 flex gap-1.5">
                <button onClick={() => setEditing({ ...r })} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-brand-200 py-2 text-xs font-semibold text-brand-700 hover:bg-sand-50"><PencilSimple size={14} weight="bold" /> Edit</button>
                <button onClick={() => onDelete(r)} aria-label="Delete" className="grid h-8 w-8 place-items-center rounded-xl border border-brand-200 text-brand-500 hover:bg-red-50 hover:text-red-600"><Trash size={14} weight="bold" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        title="Review edit karein"
        onClose={() => setEditing(null)}
        footer={
          <button onClick={onSave} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-5 py-3 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50">
            {saving ? <CircleNotch size={16} className="animate-spin" /> : null} Save changes
          </button>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div>
              <label className={fieldLabel}>Customer name</label>
              <input className={field} value={editing.customer_name} onChange={(e) => setEditing({ ...editing, customer_name: e.target.value })} />
            </div>
            <div>
              <label className={fieldLabel}>Rating</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setEditing({ ...editing, rating: n })} className="transition-transform active:scale-90">
                    <Star size={28} weight={n <= editing.rating ? 'fill' : 'regular'} className={n <= editing.rating ? 'text-saffron-400' : 'text-brand-200'} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={fieldLabel}>Review text</label>
              <textarea className={`${field} min-h-[96px]`} value={editing.comment} onChange={(e) => setEditing({ ...editing, comment: e.target.value })} />
            </div>
            <div>
              <label className={fieldLabel}>Status</label>
              <select className={field} value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
