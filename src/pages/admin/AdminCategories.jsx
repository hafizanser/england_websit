import { useEffect, useRef, useState } from 'react'
import { Plus, PencilSimple, Trash, SquaresFour, CircleNotch } from '@phosphor-icons/react'
import { adminListCategories, saveCategory, deleteCategory } from '../../api/admin'
import { useNotify } from '../../context/NotifyContext'
import { AdminTitle, Loader, Card, EmptyState, Btn } from '../../components/admin/ui'
import Modal, { field, fieldLabel } from '../../components/admin/Modal'

const empty = () => ({ id: '', name: '', display_order: 0, is_active: 1, image_path: '', image_url: '', imageFile: null })

export default function AdminCategories() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const { confirm, success, error } = useNotify()
  const imgInput = useRef(null)

  const load = async () => {
    setLoading(true)
    setRows(await adminListCategories())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const onSave = async () => {
    setSaving(true)
    try {
      const payload = {
        id: editing.id || undefined,
        name: editing.name,
        display_order: editing.display_order === '' ? 0 : editing.display_order,
        is_active: editing.is_active ? 1 : 0,
      }
      if (editing.imageFile instanceof File) payload.image = editing.imageFile
      await saveCategory(payload, isNew)
      setEditing(null)
      await load()
      success(isNew ? 'Nayi category add ho gayi' : 'Category update ho gayi')
    } catch (e) {
      error(e.message || 'Save nahi hua')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (c) => {
    const ok = await confirm({ tone: 'danger', title: 'Category delete karein?', text: `"${c.name}" hat jayegi.`, confirmText: 'Haan, delete' })
    if (!ok) return
    try {
      await deleteCategory(c.id)
      await load()
      success('Category delete ho gayi')
    } catch (e) {
      error(e.message || 'Delete nahi hua')
    }
  }

  const set = (patch) => setEditing((e) => ({ ...e, ...patch }))

  return (
    <>
      <AdminTitle eyebrow="Catalog" icon={SquaresFour} title="Categories" subtitle={`${rows.length} categories`}>
        <Btn variant="primary" onClick={() => { setEditing(empty()); setIsNew(true) }}>
          <Plus size={17} weight="bold" /> Nayi category
        </Btn>
      </AdminTitle>

      {loading ? <Loader /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <Card key={c.id} hover className="flex items-center justify-between p-5">
              <div className="flex min-w-0 items-center gap-3">
                {c.image_url ? (
                  <img src={c.image_url} alt="" className="h-12 w-12 shrink-0 rounded-xl border border-brand-100 object-cover" />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sand-100 text-brand-300"><SquaresFour size={20} /></span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-bold text-brand-900">{c.name}</p>
                  <p className="mt-0.5 text-xs text-brand-400">{c.products_count} items {c.is_active ? '' : '• (hidden)'}</p>
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button onClick={() => { setEditing({ ...empty(), ...c, imageFile: null }); setIsNew(false) }} aria-label="Edit" className="grid h-8 w-8 place-items-center rounded-lg border border-brand-200 text-brand-600 hover:bg-sand-50"><PencilSimple size={15} weight="bold" /></button>
                <button onClick={() => onDelete(c)} aria-label="Delete" className="grid h-8 w-8 place-items-center rounded-lg border border-brand-200 text-brand-500 hover:bg-saffron-50 hover:text-saffron-700"><Trash size={15} weight="bold" /></button>
              </div>
            </Card>
          ))}
          {rows.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon={SquaresFour}
                title="Koi category nahi"
                text="Apni pehli category add karein — yeh storefront par dikhegi."
                action={<Btn onClick={() => { setEditing(empty()); setIsNew(true) }}><Plus size={16} weight="bold" /> Nayi category</Btn>}
              />
            </div>
          )}
        </div>
      )}

      <Modal
        open={!!editing}
        title={isNew ? 'Nayi category' : 'Category edit'}
        onClose={() => setEditing(null)}
        footer={
          <button onClick={onSave} disabled={saving || !editing?.name} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-5 py-3 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50">
            {saving ? <CircleNotch size={16} className="animate-spin" /> : null} Save karein
          </button>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div>
              <label className={fieldLabel}>Naam *</label>
              <input className={field} value={editing.name} onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div>
              <label className={fieldLabel}>Category image</label>
              <div className="flex items-center gap-3">
                {(editing.imageFile || editing.image_url) && (
                  <img
                    src={editing.imageFile ? URL.createObjectURL(editing.imageFile) : editing.image_url}
                    alt="" className="h-16 w-16 rounded-xl border border-brand-100 object-cover"
                  />
                )}
                <input ref={imgInput} type="file" accept="image/*" className="hidden" onChange={(e) => set({ imageFile: e.target.files?.[0] || null })} />
                <button type="button" onClick={() => imgInput.current?.click()} className="rounded-2xl border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-sand-50">Image chunein</button>
              </div>
            </div>
            <div>
              <label className={fieldLabel}>Display order</label>
              <input type="number" min="0" className={field} value={editing.display_order} onChange={(e) => set({ display_order: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-brand-800">
              <input type="checkbox" checked={!!editing.is_active} onChange={(e) => set({ is_active: e.target.checked ? 1 : 0 })} /> Active
            </label>
          </div>
        )}
      </Modal>
    </>
  )
}
