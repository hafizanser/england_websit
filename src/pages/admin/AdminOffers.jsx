import { useEffect, useRef, useState } from 'react'
import { Plus, PencilSimple, Trash, Tag, CircleNotch, Gift, Image as ImageIcon, ArrowRight } from '@phosphor-icons/react'
import { adminListOffers, saveOffer, deleteOffer, adminListProducts } from '../../api/admin'
import { useNotify } from '../../context/NotifyContext'
import { AdminTitle, Loader, Card, Btn, EmptyState } from '../../components/admin/ui'
import Modal, { field, fieldLabel } from '../../components/admin/Modal'

const UNIT_FALLBACK = ['box', 'cotton', 'packet', 'dozen', 'bundle', 'piece']

const blank = {
  id: '',
  banner_image: null, // File when a new image is picked
  bannerPreview: '',
  main_product_id: '',
  main_unit_type: '',
  main_quantity: 1,
  is_other_product_free: false,
  free_product_id: '',
  free_unit_type: '',
  free_quantity: 1,
  is_active: true,
}

function toForm(o) {
  return {
    ...blank,
    id: o.id,
    bannerPreview: o.banner_image_url || '',
    main_product_id: o.main_product_id || '',
    main_unit_type: o.main_unit_type || '',
    main_quantity: o.main_quantity || 1,
    is_other_product_free: !!o.is_other_product_free,
    free_product_id: o.free_product_id || '',
    free_unit_type: o.free_unit_type || '',
    free_quantity: o.free_quantity || 1,
    is_active: o.is_active === undefined ? true : !!o.is_active,
  }
}

export default function AdminOffers() {
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const { confirm, success, error } = useNotify()

  const load = async () => {
    setLoading(true)
    try {
      const [offerRows, prodRows] = await Promise.all([adminListOffers(), adminListProducts().catch(() => [])])
      setRows(offerRows)
      setProducts(prodRows)
    } catch (e) {
      error(e.code === 'NETWORK' ? 'Backend offline — order_system se rabta nahi hua.' : e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const unitsOf = (id) => {
    const p = products.find((x) => String(x.id) === String(id))
    const u = p?.unit_types
    return Array.isArray(u) && u.length ? u : UNIT_FALLBACK
  }

  const pickFile = (e) => {
    const f = e.target.files?.[0]
    if (f) setEditing((s) => ({ ...s, banner_image: f, bannerPreview: URL.createObjectURL(f) }))
  }

  const onSave = async () => {
    if (!editing.main_product_id || !editing.main_quantity) {
      error('Main product aur buy quantity zaroori hai')
      return
    }
    if (editing.is_other_product_free && !editing.free_product_id) {
      error('Free product chunein ya toggle band karein')
      return
    }
    setSaving(true)
    try {
      // Free unit/qty are ALWAYS saved. For a same-product offer they describe
      // the free units of the MAIN product; for an "other product" offer they
      // describe the free product's units.
      const freeUnitSource = editing.is_other_product_free ? editing.free_product_id : editing.main_product_id
      const payload = {
        id: editing.id || undefined,
        main_product_id: editing.main_product_id,
        main_unit_type: editing.main_unit_type || unitsOf(editing.main_product_id)[0],
        main_quantity: Number(editing.main_quantity) || 1,
        is_other_product_free: !!editing.is_other_product_free,
        free_unit_type: editing.free_unit_type || unitsOf(freeUnitSource)[0],
        free_quantity: Number(editing.free_quantity) || 1,
        is_active: !!editing.is_active,
      }
      if (editing.is_other_product_free) {
        payload.free_product_id = editing.free_product_id
      }
      if (editing.banner_image instanceof File) payload.banner_image = editing.banner_image

      await saveOffer(payload, isNew)
      setEditing(null)
      await load()
      success(isNew ? 'Nayi offer add ho gayi' : 'Offer update ho gayi')
    } catch (e) {
      error(e.message || 'Save nahi hua')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (o) => {
    const ok = await confirm({ tone: 'danger', title: 'Offer delete karein?', text: 'Yeh offer order_system se hat jayegi.', confirmText: 'Haan, delete' })
    if (!ok) return
    try {
      await deleteOffer(o.id)
      await load()
      success('Offer delete ho gayi')
    } catch (e) {
      error(e.message || 'Delete nahi hua')
    }
  }

  const openNew = () => { setEditing({ ...blank, main_unit_type: '' }); setIsNew(true) }

  return (
    <>
      <AdminTitle eyebrow="Marketing" icon={Tag} title="Offers" subtitle={`${rows.length} offers — order_system database`}>
        <Btn onClick={openNew}>
          <Plus size={17} weight="bold" /> Nayi offer
        </Btn>
      </AdminTitle>

      {loading ? <Loader /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((o) => (
            <Card key={o.id} className="overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-saffron-200 hover:shadow-cardhover">
              <div className="relative h-32 bg-gradient-to-br from-brand-800 to-brand-600">
                {o.banner_image_url
                  ? <img src={o.banner_image_url} alt="" className="h-full w-full object-cover" />
                  : <div className="grid h-full place-items-center text-white/60"><Gift size={30} weight="fill" /></div>}
                <span className={`absolute right-2 top-2 rounded-lg px-2 py-1 text-[11px] font-bold ${o.is_active ? 'bg-wa-500 text-white' : 'bg-brand-950/70 text-white'}`}>
                  {o.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="p-4">
                <h3 className="text-base font-extrabold tracking-tight text-brand-900">{o.main_product_name || `Product #${o.main_product_id}`}</h3>
                <p className="mt-1 text-sm text-brand-600">
                  Buy <b>{o.main_quantity} {o.main_unit_type}</b>
                  {o.is_other_product_free && o.free_product_name && (
                    <span className="text-wa-600"> → get {o.free_quantity} {o.free_unit_type} <b>{o.free_product_name}</b> FREE</span>
                  )}
                </p>
                <div className="mt-3 flex gap-1.5">
                  <button onClick={() => { setEditing(toForm(o)); setIsNew(false) }} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-brand-200 py-2 text-xs font-semibold text-brand-700 hover:bg-sand-50"><PencilSimple size={14} weight="bold" /> Edit</button>
                  <button onClick={() => onDelete(o)} aria-label="Delete" className="grid h-8 w-8 place-items-center rounded-xl border border-brand-200 text-brand-500 hover:bg-saffron-50 hover:text-saffron-700"><Trash size={14} weight="bold" /></button>
                </div>
              </div>
            </Card>
          ))}
          {rows.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon={Gift}
                title="Koi offer nahi"
                text="Buy-x-get-y deals banayein jo storefront par dikhengi."
                action={<Btn onClick={openNew}><Plus size={16} weight="bold" /> Nayi offer</Btn>}
              />
            </div>
          )}
        </div>
      )}

      <Modal
        open={!!editing}
        title={isNew ? 'Nayi offer banayein' : 'Offer edit karein'}
        onClose={() => setEditing(null)}
        footer={
          <button onClick={onSave} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-5 py-3 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50">
            {saving ? <CircleNotch size={16} className="animate-spin" /> : null} Save Offer
          </button>
        }
      >
        {editing && (
          <div className="space-y-4">
            {/* banner upload — click anywhere on the box */}
            <div>
              <label className={fieldLabel}>Banner image</label>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="group relative flex h-36 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-brand-200 bg-sand-50 text-brand-400 transition-colors hover:border-saffron-400 hover:text-saffron-600"
              >
                {editing.bannerPreview ? (
                  <>
                    <img src={editing.bannerPreview} alt="banner" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 grid place-items-center bg-brand-950/0 text-sm font-semibold text-transparent transition-all group-hover:bg-brand-950/40 group-hover:text-white">Image badlein</span>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    <ImageIcon size={28} />
                    <span className="text-sm font-semibold">Click karke banner upload karein</span>
                  </div>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
            </div>

            {/* main product + unit + qty */}
            <div>
              <label className={fieldLabel}>Select Product (main)</label>
              <select className={field} value={editing.main_product_id} onChange={(e) => setEditing({ ...editing, main_product_id: e.target.value, main_unit_type: '' })}>
                <option value="">— Product chunein —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.product_name}</option>)}
              </select>
            </div>
            {editing.main_product_id && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={fieldLabel}>Unit type</label>
                  <select className={field} value={editing.main_unit_type} onChange={(e) => setEditing({ ...editing, main_unit_type: e.target.value })}>
                    <option value="">— unit —</option>
                    {unitsOf(editing.main_product_id).map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className={fieldLabel}>Buy quantity</label>
                  <input type="number" min="1" className={field} value={editing.main_quantity} onChange={(e) => setEditing({ ...editing, main_quantity: e.target.value })} />
                </div>
              </div>
            )}

            {/* other product free */}
            <label className="flex items-center justify-between rounded-2xl border border-brand-200 bg-sand-50 px-4 py-3">
              <span className="text-sm font-semibold text-brand-800">Other Product Free?</span>
              <input type="checkbox" className="h-5 w-5 accent-wa-600" checked={editing.is_other_product_free} onChange={(e) => setEditing({ ...editing, is_other_product_free: e.target.checked })} />
            </label>

            {/* Select Free Product — only for an "other product" offer. */}
            {editing.is_other_product_free && (
              <div className="rounded-2xl border border-dashed border-brand-200 p-4">
                <label className={fieldLabel}>Select Free Product</label>
                <select className={field} value={editing.free_product_id} onChange={(e) => setEditing({ ...editing, free_product_id: e.target.value, free_unit_type: '' })}>
                  <option value="">— Free product chunein —</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.product_name}</option>)}
                </select>
              </div>
            )}

            {/* Free Unit Type + Free Quantity — ALWAYS visible. For a same-product
                offer these describe the free units of the main product. */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={fieldLabel}>Free unit type</label>
                <select className={field} value={editing.free_unit_type} onChange={(e) => setEditing({ ...editing, free_unit_type: e.target.value })}>
                  <option value="">— unit —</option>
                  {unitsOf(editing.is_other_product_free ? editing.free_product_id : editing.main_product_id).map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className={fieldLabel}>Free quantity</label>
                <input type="number" min="1" className={field} value={editing.free_quantity} onChange={(e) => setEditing({ ...editing, free_quantity: e.target.value })} />
              </div>
            </div>

            {/* active toggle */}
            <label className="flex items-center justify-between rounded-2xl border border-brand-200 px-4 py-3">
              <span className="text-sm font-semibold text-brand-800">Status: <span className={editing.is_active ? 'text-wa-600' : 'text-brand-400'}>{editing.is_active ? 'Active' : 'Inactive'}</span></span>
              <input type="checkbox" className="h-5 w-5 accent-wa-600" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
            </label>
          </div>
        )}
      </Modal>
    </>
  )
}
