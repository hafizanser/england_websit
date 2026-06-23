import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UsersThree, ArrowRight, MagnifyingGlass, Plus, PencilSimple, Trash, CircleNotch } from '@phosphor-icons/react'
import { listCustomers, createCustomer, updateCustomer, deleteCustomer } from '../../api/admin'
import { useAsync } from '../../hooks/useAsync'
import { useNotify } from '../../context/NotifyContext'
import { money } from '../../lib/cartEngine'
import { AdminTitle, Loader, Card, Btn, EmptyState, ErrorCard } from '../../components/admin/ui'
import Modal, { field, fieldLabel } from '../../components/admin/Modal'

const empty = () => ({
  id: '', customer_name: '', customer_phone_number: '', shop_name: '',
  customer_address: '', adda_name: '', pandi_name: '', ptcl_number: '', email: '',
})

export default function AdminCustomers() {
  const { data, loading, error, reload } = useAsync(() => listCustomers(), [])
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const { confirm, success, error: notifyError } = useNotify()

  const rows = (data || []).filter((c) => {
    const n = q.trim().toLowerCase()
    if (!n) return true
    return (c.name || '').toLowerCase().includes(n) || (c.phone || '').includes(n) || (c.shop_name || '').toLowerCase().includes(n)
  })

  const set = (patch) => setEditing((e) => ({ ...e, ...patch }))

  const onSave = async () => {
    setSaving(true)
    try {
      const payload = {
        customer_name: editing.customer_name,
        customer_phone_number: editing.customer_phone_number,
        shop_name: editing.shop_name,
        customer_address: editing.customer_address,
        adda_name: editing.adda_name,
        pandi_name: editing.pandi_name,
        ptcl_number: editing.ptcl_number,
        email: editing.email,
      }
      if (isNew) await createCustomer(payload)
      else await updateCustomer(editing.id, payload)
      setEditing(null)
      reload()
      success(isNew ? 'Naya customer add ho gaya' : 'Customer update ho gaya')
    } catch (e) {
      notifyError(e.message || 'Save nahi hua')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (c) => {
    const ok = await confirm({ tone: 'danger', title: 'Customer delete karein?', text: `"${c.name}" hat jayega.`, confirmText: 'Haan, delete' })
    if (!ok) return
    try {
      await deleteCustomer(c.id)
      reload()
      success('Customer delete ho gaya')
    } catch (e) {
      notifyError(e.message || 'Delete nahi hua')
    }
  }

  return (
    <>
      <AdminTitle eyebrow="People" icon={UsersThree} title="Customers" subtitle="Tamam dukaandar accounts">
        <Btn onClick={() => { setEditing(empty()); setIsNew(true) }}>
          <Plus size={17} weight="bold" /> New Customer
        </Btn>
      </AdminTitle>

      <Card className="mb-5 p-3.5">
        <div className="relative">
          <MagnifyingGlass size={18} weight="bold" className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Naam, number ya shop se dhoondein..."
            className="w-full rounded-2xl border border-brand-200 bg-sand-50 py-2.5 pl-11 pr-4 text-sm outline-none transition-all placeholder:text-brand-300 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100/70"
          />
        </div>
      </Card>

      {loading && <Loader />}
      {!loading && error && <ErrorCard message="Customers load nahi huye" onRetry={reload} />}

      {!loading && !error && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-100 bg-sand-50/40 text-left text-xs font-semibold uppercase tracking-wider text-brand-400">
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Shop</th>
                  <th className="px-5 py-3.5 text-center">Orders</th>
                  <th className="px-5 py-3.5 text-right">Total kharcha</th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-brand-50 transition-colors hover:bg-sand-50/70">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-brand-900">{c.name}</p>
                      <p className="text-xs text-brand-400">{c.phone}</p>
                    </td>
                    <td className="px-5 py-3.5 text-brand-600">{c.shop_name || '—'}</td>
                    <td className="px-5 py-3.5 text-center font-semibold tabular-nums text-brand-700">{c.orders_count}</td>
                    <td className="px-5 py-3.5 text-right font-bold tabular-nums text-brand-800">{money(c.total_spent)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link to={`/admin/customers/${c.id}`} aria-label="Profile" className="grid h-8 w-8 place-items-center rounded-lg border border-brand-200 text-brand-600 hover:bg-sand-50"><ArrowRight size={15} weight="bold" /></Link>
                        <button onClick={() => { setEditing({ ...empty(), ...c }); setIsNew(false) }} aria-label="Edit" className="grid h-8 w-8 place-items-center rounded-lg border border-brand-200 text-brand-600 hover:bg-sand-50"><PencilSimple size={15} weight="bold" /></button>
                        <button onClick={() => onDelete(c)} aria-label="Delete" className="grid h-8 w-8 place-items-center rounded-lg border border-brand-200 text-brand-500 hover:bg-saffron-50 hover:text-saffron-700"><Trash size={15} weight="bold" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-16 text-center text-brand-400">
                    <UsersThree size={32} className="mx-auto" /><p className="mt-2">Koi customer nahi.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={!!editing}
        title={isNew ? 'Naya customer' : 'Customer edit'}
        onClose={() => setEditing(null)}
        footer={
          <button onClick={onSave} disabled={saving || !editing?.customer_name || !editing?.customer_phone_number} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-5 py-3 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50">
            {saving ? <CircleNotch size={16} className="animate-spin" /> : null} Save karein
          </button>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className={fieldLabel}>Naam *</label><input className={field} value={editing.customer_name} onChange={(e) => set({ customer_name: e.target.value })} placeholder="e.g. Muhammad Arif" /></div>
              <div><label className={fieldLabel}>Phone *</label><input className={field} value={editing.customer_phone_number} onChange={(e) => set({ customer_phone_number: e.target.value })} placeholder="03xxxxxxxxx" /></div>
            </div>
            <div><label className={fieldLabel}>Shop ka naam</label><input className={field} value={editing.shop_name} onChange={(e) => set({ shop_name: e.target.value })} placeholder="e.g. England Store" /></div>
            <div><label className={fieldLabel}>Address</label><input className={field} value={editing.customer_address} onChange={(e) => set({ customer_address: e.target.value })} placeholder="e.g. Shah Alam Market, Lahore" /></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className={fieldLabel}>Adda</label><input className={field} value={editing.adda_name} onChange={(e) => set({ adda_name: e.target.value })} placeholder="e.g. Badami Bagh" /></div>
              <div><label className={fieldLabel}>Pandi</label><input className={field} value={editing.pandi_name} onChange={(e) => set({ pandi_name: e.target.value })} placeholder="e.g. Malik Pandi" /></div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className={fieldLabel}>PTCL number</label><input className={field} value={editing.ptcl_number} onChange={(e) => set({ ptcl_number: e.target.value })} /></div>
              <div><label className={fieldLabel}>Email</label><input className={field} value={editing.email} onChange={(e) => set({ email: e.target.value })} /></div>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
