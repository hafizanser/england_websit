import { Fragment, useEffect, useRef, useState } from 'react'
import { Plus, PencilSimple, Trash, Package, MagnifyingGlass, CircleNotch, Eye, X, Star } from '@phosphor-icons/react'
import { adminListProducts, saveProduct, deleteProduct, adminListCategories } from '../../api/admin'
import { money } from '../../lib/cartEngine'
import { useNotify } from '../../context/NotifyContext'
import Modal, { field, fieldLabel } from '../../components/admin/Modal'
import './AdminProducts.css'

const fmtInt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })

// Unit types — same keys & labels as the reference order_management app.
const UNITS = [
  { key: 'box', label: 'Box', price: 'box_price', mrp: 'mrp_box', cost: 'production_box_price' },
  { key: 'cotton', label: 'Carton', price: 'cotton_price', mrp: 'mrp_carton', cost: 'production_cotton_price' },
  { key: 'packet', label: 'Packet', price: 'packet_price', mrp: 'mrp_packet', cost: 'production_packet_price' },
  { key: 'dozen', label: 'Dozen', price: 'dozen_price', mrp: 'mrp_dozen', cost: 'production_dozen_price' },
  { key: 'bundle', label: 'Bundle', price: 'bundle_price', mrp: 'mrp_bundle', cost: 'production_bundle_price' },
]

const NUM_FIELDS = [
  'piece_price', 'box_price', 'cotton_price', 'packet_price', 'dozen_price', 'bundle_price',
  'mrp_piece', 'mrp_box', 'mrp_carton', 'mrp_packet', 'mrp_dozen', 'mrp_bundle',
  'production_piece_price', 'production_box_price', 'production_cotton_price',
  'production_packet_price', 'production_dozen_price', 'production_bundle_price',
  'dozen_in_box', 'boxes_in_cotton', 'pieces_per_bundle', 'pieces_per_packet', 'total_stock_cotton',
]

const emptyProduct = () => ({
  id: '', category_id: '', product_name: '', short_description: '', product_description: '',
  unit_types: ['cotton', 'box'],
  piece_price: '', box_price: '', cotton_price: '', packet_price: '', dozen_price: '', bundle_price: '',
  mrp_piece: '', mrp_box: '', mrp_carton: '', mrp_packet: '', mrp_dozen: '', mrp_bundle: '',
  production_piece_price: '', production_box_price: '', production_cotton_price: '',
  production_packet_price: '', production_dozen_price: '', production_bundle_price: '',
  dozen_in_box: '', boxes_in_cotton: '', pieces_per_bundle: '', pieces_per_packet: '', total_stock_cotton: '',
  show_profit_breakdown: 1, is_featured: 0, is_active: 1,
  product_image: '', product_image_url: '', multiple_images: [], multiple_images_urls: [],
  productImage: null, galleryFiles: [],
})

// Padded SKU code derived from the DB id (mirrors the reference inventory view).
const skuOf = (id) => `SKU: ${String(id ?? '').padStart(5, '0')}`

// Derive carton/box stock figures from the carton total + boxes-per-carton.
const stockInfo = (p) => {
  const bpc = parseInt(p.boxes_in_cotton ?? 0, 10) || 0
  const cartons = parseFloat(p.total_stock_cotton ?? 0) || 0
  const totalBoxes = Math.round(bpc * cartons)
  const cartonsInt = bpc > 0 ? Math.floor(totalBoxes / bpc) : Math.round(cartons)
  const leftover = bpc > 0 ? totalBoxes - cartonsInt * bpc : 0
  const level = cartons < 10 ? 'crit' : cartons < 50 ? 'warn' : 'ok'
  return { totalBoxes, cartonsInt, leftover, level }
}

const stockBadge = {
  ok: 'border-brand-100 bg-sand-50 text-brand-700',
  warn: 'border-saffron-300 bg-saffron-50 text-saffron-800',
  crit: 'border-red-300 bg-red-50 text-red-700',
}
const stockDot = { ok: 'bg-green-500', warn: 'bg-saffron-500', crit: 'bg-red-500' }

// "Dozen in box" is entered as D.P (D dozens + P extra pieces in the tenths slot).
// Mirrors dozenToPieces() in the reference add_product/edit_product blade files.
const dozenToPieces = (val) => {
  const v = parseFloat(val) || 0
  const doz = Math.floor(v)
  const pcs = Math.round((v - doz) * 10)
  return doz * 12 + pcs
}

// MRP units that are auto-derived from MRP/piece (everything except piece & packet).
const AUTO_MRP_KEYS = ['mrp_box', 'mrp_carton', 'mrp_dozen', 'mrp_bundle']

// Normalise an API product row into editable form state (numbers -> strings).
const toForm = (p) => {
  const f = { ...emptyProduct(), ...p }
  NUM_FIELDS.forEach((k) => { f[k] = p[k] === null || p[k] === undefined ? '' : String(p[k]) })
  f.unit_types = Array.isArray(p.unit_types) && p.unit_types.length ? p.unit_types : ['cotton', 'box']
  f.existing_gallery = Array.isArray(p.multiple_images)
    ? p.multiple_images.map((name, i) => ({ name, url: p.multiple_images_urls?.[i] || '' }))
    : []
  f.productImage = null
  f.galleryFiles = []
  return f
}

export default function AdminProducts() {
  const [rows, setRows] = useState([])
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState(null)
  const { confirm, success, error } = useNotify()
  const imgInput = useRef(null)
  const galleryInput = useRef(null)

  const load = async () => {
    setLoading(true)
    const [p, c] = await Promise.all([adminListProducts(), adminListCategories()])
    setRows(p)
    setCats(c)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => setEditing(emptyProduct())
  const openEdit = (p) => setEditing(toForm(p))

  const set = (patch) => setEditing((e) => ({ ...e, ...patch }))
  const toggleUnit = (key) => set({
    unit_types: editing.unit_types.includes(key)
      ? editing.unit_types.filter((u) => u !== key)
      : [...editing.unit_types, key],
  })

  // Auto-recompute MRP per box/carton/dozen/bundle from MRP/piece + packing,
  // exactly like the reference recomputeMrps(). Piece & packet stay manual.
  useEffect(() => {
    if (!editing) return
    const p = parseFloat(editing.mrp_piece) || 0
    const dpbV = dozenToPieces(editing.dozen_in_box)
    const bpcV = parseFloat(editing.boxes_in_cotton) || 0
    const ppbV = parseFloat(editing.pieces_per_bundle) || 0
    const next = {
      mrp_dozen: p > 0 ? (p * 12).toFixed(2) : '',
      mrp_box: p > 0 && dpbV > 0 ? (p * dpbV).toFixed(2) : '',
      mrp_carton: p > 0 && dpbV > 0 && bpcV > 0 ? (p * dpbV * bpcV).toFixed(2) : '',
      mrp_bundle: p > 0 && ppbV > 0 ? (p * ppbV).toFixed(2) : '',
    }
    if (AUTO_MRP_KEYS.some((k) => String(editing[k] ?? '') !== next[k])) {
      setEditing((e) => ({ ...e, ...next }))
    }
  }, [editing?.mrp_piece, editing?.dozen_in_box, editing?.boxes_in_cotton, editing?.pieces_per_bundle])

  // Build the full multipart payload from an editable form-state object. Shared
  // by the edit modal and the inline status toggle so neither wipes other fields
  // (the backend update() rebuilds every column from the request body).
  const productPayload = (e) => {
    const payload = {
      id: e.id || undefined,
      category_id: e.category_id || '',
      product_name: e.product_name,
      short_description: e.short_description,
      product_description: e.product_description,
      unit_types: e.unit_types,
      show_profit_breakdown: e.show_profit_breakdown ? 1 : 0,
      is_featured: e.is_featured ? 1 : 0,
      is_active: e.is_active ? 1 : 0,
    }
    NUM_FIELDS.forEach((k) => { if (e[k] !== '' && e[k] !== null && e[k] !== undefined) payload[k] = e[k] })
    if (e.productImage instanceof File) payload.product_image = e.productImage
    if (e.id) payload.existing_images = JSON.stringify((e.existing_gallery || []).map((g) => g.name))
    if (e.galleryFiles && e.galleryFiles.length) payload.multiple_images = e.galleryFiles
    return payload
  }

  const onSave = async () => {
    setSaving(true)
    try {
      const isEdit = !!editing.id
      await saveProduct(productPayload(editing))
      setEditing(null)
      await load()
      success(isEdit ? 'Product update ho gaya' : 'Naya product add ho gaya')
    } catch (err) {
      error(err.message || 'Save nahi hua')
    } finally {
      setSaving(false)
    }
  }

  // Flip Active/Inactive in place. Re-saves the full row (with the flag toggled)
  // so the DB updates immediately; optimistic UI reverts on failure.
  const toggleStatus = async (p) => {
    const next = p.is_active ? 0 : 1
    setTogglingId(p.id)
    setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, is_active: next } : r)))
    try {
      await saveProduct(productPayload({ ...toForm(p), is_active: next }))
      success(next ? 'Product ab active hai' : 'Product ab inactive hai')
    } catch (err) {
      setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, is_active: p.is_active } : r)))
      error(err.message || 'Status update nahi hua')
    } finally {
      setTogglingId(null)
    }
  }

  const onDelete = async (p) => {
    const ok = await confirm({ tone: 'danger', title: 'Product delete karein?', text: `"${p.product_name}" hamesha ke liye hat jayega.`, confirmText: 'Haan, delete' })
    if (!ok) return
    try {
      await deleteProduct(p.id)
      await load()
      success('Product delete ho gaya')
    } catch (err) {
      error(err.message || 'Delete nahi hua')
    }
  }

  const filtered = rows.filter((p) => !q || (p.product_name || '').toLowerCase().includes(q.toLowerCase()))

  const priceInput = (key, label) => (
    <div>
      <label className={fieldLabel}>{label}</label>
      <input type="number" step="0.01" min="0" className={field} value={editing[key]} onChange={(ev) => set({ [key]: ev.target.value })} />
    </div>
  )

  // MRP field + live profit margin vs the unit's selling price. `auto` fields are
  // readonly (derived from MRP/piece); piece & packet are manually editable.
  const mrpRow = (mrpKey, label, saleKey, auto) => {
    const mv = parseFloat(editing[mrpKey])
    const sv = parseFloat(editing[saleKey])
    let margin
    if (mv && sv) {
      const profit = mv - sv
      const pct = (profit / mv) * 100
      const pos = profit >= 0
      margin = <span className={pos ? 'text-green-600' : 'text-red-600'}>{pos ? '+' : ''}RS {Math.abs(profit).toFixed(2)} ({pct.toFixed(1)}%)</span>
    } else {
      margin = <span className="text-brand-300">Sale price daalein</span>
    }
    return (
      <div>
        <label className={fieldLabel}>{label}{auto && <span className="font-normal normal-case text-brand-400"> (Auto)</span>}</label>
        <input
          type="number"
          step="0.01"
          min="0"
          readOnly={auto}
          className={`${field} ${auto ? 'bg-sand-100 text-brand-500' : ''}`}
          value={editing[mrpKey]}
          onChange={auto ? undefined : (ev) => set({ [mrpKey]: ev.target.value })}
        />
        <p className="mt-1 text-[11px] font-semibold">{margin}</p>
      </div>
    )
  }

  // KPI roll-ups (mirror the reference inventory metrics).
  const totalCartons = rows.reduce((sum, p) => sum + (parseFloat(p.total_stock_cotton) || 0), 0)
  const totalValuation = rows.reduce((sum, p) => sum + (parseFloat(p.total_stock_cotton) || 0) * (parseFloat(p.cotton_price) || 0), 0)

  return (
    <>
      <div className="pf-container">
        {/* Aurora hero */}
        <div className="pf-hero">
          <div className="pf-hero-content">
            <div>
              <span className="pf-eyebrow">/ Inventory Metrics</span>
              <h1 className="pf-title">Master Stock<br />Inventory</h1>
              <p className="pf-subtitle">High-precision tracking of your product catalog and real-time stock valuation.</p>
            </div>
            <div>
              <button type="button" onClick={openNew} className="pf-btn-primary">
                <span className="disc"><Plus size={18} weight="bold" /></span>
                <span>Add Product</span>
              </button>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="pf-kpi-grid">
          <div className="pf-kpi">
            <span className="pf-kpi-label">Active SKUs</span>
            <div className="pf-kpi-val">{rows.length}</div>
          </div>
          <div className="pf-kpi">
            <span className="pf-kpi-label">Total Volume</span>
            <div className="pf-kpi-val">{totalCartons.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span style={{ fontSize: '1rem', color: 'var(--pf-ink-soft)' }}>CTN</span></div>
          </div>
          <div className="pf-kpi">
            <span className="pf-kpi-label">Stock Valuation</span>
            <div className="pf-kpi-val"><span style={{ fontSize: '1.5rem', color: 'var(--pf-gold)' }}>RS</span> {fmtInt(totalValuation)}</div>
          </div>
        </div>

        {/* Table card */}
        <div className="pf-table-card">
          <div className="pf-table-toolbar">
            <div className="pf-search">
              <span className="pf-search-icon"><MagnifyingGlass size={18} /></span>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pf-search-input"
                placeholder="Search by product name or SKU..."
                aria-label="Search products"
              />
              {q && (
                <button type="button" className="pf-search-clear" aria-label="Clear search" onClick={() => setQ('')}>
                  <X size={14} weight="bold" />
                </button>
              )}
            </div>
            <div className="pf-search-count" aria-live="polite">
              <strong>{filtered.length}</strong> / {rows.length} shown
            </div>
          </div>

          <div className="pf-table-wrap">
            <table className="pf-table">
              <colgroup>
                <col className="pf-col-product" />
                <col className="pf-col-rate" />
                <col className="pf-col-stock" />
                <col className="pf-col-units" />
                <col className="pf-col-status" />
                <col className="pf-col-ops" />
              </colgroup>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Rate</th>
                  <th>Stock</th>
                  <th className="pf-text-center">Units</th>
                  <th className="pf-text-center">Status</th>
                  <th className="pf-text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr className="pf-empty-row">
                    <td colSpan={6}>
                      <span className="pf-empty-icon"><CircleNotch size={22} className="animate-spin" /></span>
                      <span className="pf-empty-title">Loading inventory…</span>
                    </td>
                  </tr>
                )}

                {!loading && filtered.map((p) => {
                  const s = stockInfo(p)
                  return (
                    <tr key={p.id}>
                      {/* Product — image + name + FEATURED + SKU */}
                      <td>
                        <div className="pf-product-cell">
                          <div className="pf-product-img">
                            {p.product_image_url ? (
                              <img src={p.product_image_url} alt="" onError={(e) => { e.currentTarget.src = '/placeholder.svg' }} />
                            ) : (
                              <Package size={18} />
                            )}
                          </div>
                          <div>
                            <span className="pf-product-name">
                              {p.product_name}
                              {p.is_featured ? <span className="pf-featured-tag">FEATURED</span> : null}
                            </span>
                            <span className="pf-product-sku">{skuOf(p.id)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Rate — carton price */}
                      <td>
                        <div className="pf-price-tag"><span>RS</span> {fmtInt(p.cotton_price)}</div>
                      </td>

                      {/* Stock — cartons + boxes left */}
                      <td>
                        <div className="pf-stock-stack">
                          <div className={`pf-carton-badge ${s.level}`}>
                            <span className="dot" />
                            <span className="num">{s.cartonsInt}</span>
                            <span className="lbl">{(s.cartonsInt === 1 ? 'Carton' : 'Cartons').toUpperCase()}</span>
                            {s.level === 'crit' && <span className="pf-stock-low">LOW</span>}
                          </div>
                          {s.leftover > 0 && (
                            <div className="pf-boxes-left">({s.leftover} {s.leftover === 1 ? 'Box' : 'Boxes'} left)</div>
                          )}
                        </div>
                      </td>

                      {/* Units — total boxes */}
                      <td className="pf-text-center">
                        <div className="pf-carton-badge" style={{ borderColor: 'var(--pf-gold)', background: 'rgba(197, 157, 95, 0.05)', margin: '0 auto' }}>
                          <span className="num" style={{ color: 'var(--pf-gold)' }}>{fmtInt(s.totalBoxes)}</span>
                          <span className="lbl" style={{ color: 'var(--pf-gold)' }}>BOXES</span>
                        </div>
                      </td>

                      {/* Status — Active/Inactive toggle (writes to DB) */}
                      <td className="pf-text-center">
                        <button
                          type="button"
                          onClick={() => toggleStatus(p)}
                          disabled={togglingId === p.id}
                          role="switch"
                          aria-checked={!!p.is_active}
                          title={p.is_active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                          className={`pf-status-toggle ${p.is_active ? 'is-on' : 'is-off'} ${togglingId === p.id ? 'is-busy' : ''}`}
                        >
                          <span className="pf-toggle-track"><span className="pf-toggle-thumb" /></span>
                          <span className="lbl">{p.is_active ? 'Active' : 'Inactive'}</span>
                        </button>
                      </td>

                      {/* Actions — View / Edit / Delete */}
                      <td>
                        <div className="pf-action-group">
                          <button type="button" className="pf-action-btn" title="View Details" onClick={() => setViewing(p)}><Eye size={16} weight="bold" /></button>
                          <button type="button" className="pf-action-btn" title="Edit Entry" onClick={() => openEdit(p)}><PencilSimple size={16} weight="bold" /></button>
                          <button type="button" className="pf-action-btn del" title="Delete SKU" onClick={() => onDelete(p)}><Trash size={16} weight="bold" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {!loading && filtered.length === 0 && (
                  <tr className="pf-empty-row">
                    <td colSpan={6}>
                      <span className="pf-empty-icon"><MagnifyingGlass size={20} /></span>
                      <span className="pf-empty-title">No products match your search</span>
                      <span className="pf-empty-hint">Try a different name or SKU.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit modal — full reference field set */}
      <Modal
        open={!!editing}
        title={editing?.id ? 'Product edit karein' : 'Naya product'}
        onClose={() => setEditing(null)}
        footer={
          <button onClick={onSave} disabled={saving || !editing?.product_name} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-5 py-3 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50">
            {saving ? <CircleNotch size={16} className="animate-spin" /> : null} Save karein
          </button>
        }
      >
        {editing && (
          <div className="space-y-6">
            {/* General */}
            <section className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400">General</h4>
              <div>
                <label className={fieldLabel}>Product naam *</label>
                <input className={field} value={editing.product_name} onChange={(e) => set({ product_name: e.target.value })} />
              </div>
              <div>
                <label className={fieldLabel}>Category</label>
                <select className={field} value={editing.category_id || ''} onChange={(e) => set({ category_id: e.target.value })}>
                  <option value="">— chunein —</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={fieldLabel}>Short description</label>
                <input className={field} value={editing.short_description} onChange={(e) => set({ short_description: e.target.value })} placeholder="Card par dikhne wali tafseel" />
              </div>
              <div>
                <label className={fieldLabel}>Tafseel (description)</label>
                <textarea rows={3} className={field} value={editing.product_description} onChange={(e) => set({ product_description: e.target.value })} />
              </div>
            </section>

            {/* Units */}
            <section className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400">Kaise bechte hain (unit types)</h4>
              <div className="flex flex-wrap gap-2">
                {UNITS.map((u) => (
                  <button type="button" key={u.key} onClick={() => toggleUnit(u.key)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${editing.unit_types.includes(u.key) ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-brand-200 bg-white text-brand-400 hover:bg-sand-50'}`}>
                    {u.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Selling prices */}
            <section className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400">Selling price (Rs)</h4>
              <div className="grid grid-cols-2 gap-3">
                {UNITS.filter((u) => editing.unit_types.includes(u.key)).map((u) => priceInput(u.price, u.label + ' price'))}
                {priceInput('piece_price', 'Piece price')}
              </div>
            </section>

            {/* Suggested resale (MRP) — piece is manual; box/carton/dozen/bundle auto-calc */}
            <section className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400">Suggested resale (MRP)</h4>
              <div className="grid grid-cols-2 gap-3">
                {mrpRow('mrp_piece', 'MRP Piece', 'piece_price', false)}
                {UNITS.filter((u) => editing.unit_types.includes(u.key)).map((u) => (
                  <Fragment key={u.key}>{mrpRow(u.mrp, 'MRP ' + u.label, u.price, u.key !== 'packet')}</Fragment>
                ))}
              </div>
            </section>

            {/* Cost (private) */}
            <section className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400">Cost / production (private)</h4>
              <div className="grid grid-cols-2 gap-3">
                {UNITS.filter((u) => editing.unit_types.includes(u.key)).map((u) => priceInput(u.cost, 'Cost ' + u.label))}
                {priceInput('production_piece_price', 'Cost Piece')}
              </div>
            </section>

            {/* Packing & stock */}
            <section className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400">Packing &amp; stock</h4>
              <div className="grid grid-cols-2 gap-3">
                {priceInput('dozen_in_box', 'Dozen in box')}
                {priceInput('boxes_in_cotton', 'Boxes in carton')}
                {editing.unit_types.includes('bundle') && priceInput('pieces_per_bundle', 'Pieces / bundle')}
                {editing.unit_types.includes('packet') && priceInput('pieces_per_packet', 'Pieces / packet')}
                {priceInput('total_stock_cotton', 'Opening stock (cartons)')}
              </div>
            </section>

            {/* Media */}
            <section className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400">Tasveerein</h4>
              <div>
                <label className={fieldLabel}>Main image</label>
                <div className="flex items-center gap-3">
                  {(editing.productImage || editing.product_image_url) && (
                    <img
                      src={editing.productImage ? URL.createObjectURL(editing.productImage) : editing.product_image_url}
                      alt="" className="h-16 w-16 rounded-xl border border-brand-100 object-cover"
                    />
                  )}
                  <input ref={imgInput} type="file" accept="image/*" className="hidden" onChange={(e) => set({ productImage: e.target.files?.[0] || null })} />
                  <button type="button" onClick={() => imgInput.current?.click()} className="rounded-2xl border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-sand-50">Image chunein</button>
                </div>
              </div>
              <div>
                <label className={fieldLabel}>Gallery (additional)</label>
                <div className="flex flex-wrap gap-2">
                  {(editing.existing_gallery || []).map((g) => (
                    <div key={g.name} className="relative">
                      <img src={g.url} alt="" className="h-14 w-14 rounded-lg border border-brand-100 object-cover" />
                      <button type="button" aria-label="Remove" onClick={() => set({ existing_gallery: editing.existing_gallery.filter((x) => x.name !== g.name) })}
                        className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-saffron-600 text-white"><X size={11} weight="bold" /></button>
                    </div>
                  ))}
                  {(editing.galleryFiles || []).map((f, i) => (
                    <img key={i} src={URL.createObjectURL(f)} alt="" className="h-14 w-14 rounded-lg border border-dashed border-brand-300 object-cover" />
                  ))}
                </div>
                <input ref={galleryInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => set({ galleryFiles: [...(editing.galleryFiles || []), ...Array.from(e.target.files || [])] })} />
                <button type="button" onClick={() => galleryInput.current?.click()} className="mt-2 rounded-2xl border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-sand-50">+ Gallery images</button>
              </div>
            </section>

            {/* Flags */}
            <section className="space-y-2.5">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-800">
                <input type="checkbox" checked={!!editing.is_active} onChange={(e) => set({ is_active: e.target.checked ? 1 : 0 })} /> Storefront par dikhayein (active)
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-800">
                <input type="checkbox" checked={!!editing.is_featured} onChange={(e) => set({ is_featured: e.target.checked ? 1 : 0 })} /> Featured product
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-800">
                <input type="checkbox" checked={!!editing.show_profit_breakdown} onChange={(e) => set({ show_profit_breakdown: e.target.checked ? 1 : 0 })} /> Profit breakdown dikhayein
              </label>
            </section>
          </div>
        )}
      </Modal>

      {/* Read-only product view */}
      <Modal open={!!viewing} title="Product details" onClose={() => setViewing(null)}>
        {viewing && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              {viewing.product_image_url ? (
                <img src={viewing.product_image_url} alt="" className="h-24 w-24 rounded-2xl border border-brand-100 object-cover" />
              ) : (
                <span className="grid h-24 w-24 place-items-center rounded-2xl bg-sand-100 text-brand-300"><Package size={28} /></span>
              )}
              <div>
                <p className="text-lg font-extrabold text-brand-900">{viewing.product_name}</p>
                <p className="text-sm text-brand-500">{viewing.category_name || '—'}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(viewing.unit_types || []).map((u) => <span key={u} className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700">{UNITS.find((x) => x.key === u)?.label || u}</span>)}
                  {viewing.is_featured ? <span className="inline-flex items-center gap-1 rounded-full bg-saffron-100 px-2.5 py-1 text-[11px] font-bold text-saffron-800"><Star size={11} weight="fill" /> Featured</span> : null}
                </div>
              </div>
            </div>

            {viewing.short_description && <p className="text-sm text-brand-600">{viewing.short_description}</p>}
            {viewing.product_description && <p className="text-sm text-brand-500">{viewing.product_description}</p>}

            <div className="overflow-hidden rounded-2xl border border-brand-100">
              <table className="w-full text-sm">
                <thead><tr className="bg-sand-50 text-left text-xs uppercase tracking-wider text-brand-400"><th className="px-4 py-2">Unit</th><th className="px-4 py-2 text-right">Selling</th><th className="px-4 py-2 text-right">MRP</th><th className="px-4 py-2 text-right">Cost</th></tr></thead>
                <tbody>
                  {UNITS.filter((u) => (viewing.unit_types || []).includes(u.key)).map((u) => (
                    <tr key={u.key} className="border-t border-brand-50">
                      <td className="px-4 py-2 font-semibold text-brand-800">{u.label}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{viewing[u.price] > 0 ? money(viewing[u.price]) : '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{viewing[u.mrp] > 0 ? money(viewing[u.mrp]) : '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{viewing[u.cost] > 0 ? money(viewing[u.cost]) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-sand-50 px-4 py-3"><p className="text-xs text-brand-400">Stock (cartons)</p><p className="font-bold text-brand-900">{viewing.total_stock_cotton}</p></div>
              <div className="rounded-2xl bg-sand-50 px-4 py-3"><p className="text-xs text-brand-400">Boxes / carton</p><p className="font-bold text-brand-900">{viewing.boxes_in_cotton}</p></div>
            </div>

            {(viewing.multiple_images_urls || []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {viewing.multiple_images_urls.map((u, i) => <img key={i} src={u} alt="" className="h-16 w-16 rounded-lg border border-brand-100 object-cover" />)}
              </div>
            )}

            <button onClick={() => { setViewing(null); openEdit(viewing) }} className="w-full rounded-2xl bg-brand-700 px-5 py-3 text-sm font-bold text-white hover:bg-brand-800">Edit karein</button>
          </div>
        )}
      </Modal>
    </>
  )
}
