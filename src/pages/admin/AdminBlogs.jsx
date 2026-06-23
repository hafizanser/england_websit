import { useEffect, useRef, useState } from 'react'
import { Plus, PencilSimple, Trash, Article, CircleNotch, MagnifyingGlass, Image as ImageIcon, ArrowSquareOut } from '@phosphor-icons/react'
import { adminListBlogs, saveBlog, deleteBlog } from '../../api/admin'
import { useNotify } from '../../context/NotifyContext'
import { AdminTitle, Loader, Card, Btn } from '../../components/admin/ui'
import Modal, { field, fieldLabel } from '../../components/admin/Modal'

const emptyBlog = () => ({
  id: '', title: '', excerpt: '', content: '', author: 'England', status: 'published',
  image: '', image_url: '', imageFile: null,
})

const toForm = (b) => ({ ...emptyBlog(), ...b, imageFile: null })

export default function AdminBlogs() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const { confirm, success, error } = useNotify()
  const imgInput = useRef(null)

  const load = async () => {
    setLoading(true)
    try {
      setRows(await adminListBlogs())
    } catch (err) {
      error(err.message || 'Blogs load nahi huye')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const openNew = () => setEditing(emptyBlog())
  const openEdit = (b) => setEditing(toForm(b))
  const set = (patch) => setEditing((e) => ({ ...e, ...patch }))

  const onSave = async () => {
    setSaving(true)
    try {
      const e = editing
      const payload = {
        id: e.id || undefined,
        title: e.title,
        excerpt: e.excerpt,
        content: e.content,
        author: e.author,
        status: e.status,
      }
      if (e.imageFile instanceof File) payload.image = e.imageFile
      const isEdit = !!e.id
      await saveBlog(payload)
      setEditing(null)
      await load()
      success(isEdit ? 'Blog update ho gaya' : 'Naya blog publish ho gaya')
    } catch (err) {
      error(err.message || 'Save nahi hua')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (b) => {
    const ok = await confirm({ tone: 'danger', title: 'Blog delete karein?', text: `"${b.title}" hamesha ke liye hat jayega.`, confirmText: 'Haan, delete' })
    if (!ok) return
    try {
      await deleteBlog(b.id)
      await load()
      success('Blog delete ho gaya')
    } catch (err) {
      error(err.message || 'Delete nahi hua')
    }
  }

  const filtered = rows.filter((b) => !q || (b.title || '').toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <AdminTitle eyebrow="Content" icon={Article} title="Blog" subtitle={`${rows.length} posts — likhein, edit ya hatayein`}>
        <Btn as="a" variant="ghost" href="/#/blog" target="_blank" rel="noreferrer">
          <ArrowSquareOut size={16} weight="bold" /> Website blog dekhein
        </Btn>
        <Btn onClick={openNew}>
          <Plus size={17} weight="bold" /> Naya blog
        </Btn>
      </AdminTitle>

      <Card className="mb-5 p-3.5">
        <div className="relative">
          <MagnifyingGlass size={18} weight="bold" className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Blog dhoondein..." className="w-full rounded-2xl border border-brand-200 bg-sand-50 py-2.5 pl-11 pr-4 text-sm outline-none transition-all placeholder:text-brand-300 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100/70" />
        </div>
      </Card>

      {loading ? <Loader /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-100 bg-sand-50/40 text-left text-xs font-semibold uppercase tracking-wider text-brand-400">
                  <th className="px-5 py-3.5">Post</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="border-b border-brand-50 transition-colors hover:bg-sand-50/70">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {b.image_url ? (
                          <img src={b.image_url} alt="" className="h-10 w-14 shrink-0 rounded-lg border border-brand-100 object-cover" />
                        ) : (
                          <span className="grid h-10 w-14 shrink-0 place-items-center rounded-lg bg-sand-100 text-brand-300"><Article size={18} /></span>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-brand-900">{b.title}</p>
                          <p className="line-clamp-1 max-w-md text-xs text-brand-400">{b.excerpt}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${b.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-sand-200 text-brand-500'}`}>
                        {b.status === 'published' ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-brand-500">{(b.created_at || '').slice(0, 10)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => openEdit(b)} aria-label="Edit" className="grid h-8 w-8 place-items-center rounded-lg border border-brand-200 text-brand-600 hover:bg-sand-50"><PencilSimple size={15} weight="bold" /></button>
                        <button onClick={() => onDelete(b)} aria-label="Delete" className="grid h-8 w-8 place-items-center rounded-lg border border-brand-200 text-brand-500 hover:bg-saffron-50 hover:text-saffron-700"><Trash size={15} weight="bold" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-16 text-center text-brand-400"><Article size={30} className="mx-auto" /><p className="mt-2">Abhi koi blog nahi. "Naya blog" se shuru karein.</p></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add / Edit modal */}
      <Modal
        open={!!editing}
        title={editing?.id ? 'Blog edit karein' : 'Naya blog'}
        onClose={() => setEditing(null)}
        footer={
          <button onClick={onSave} disabled={saving || !editing?.title} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-5 py-3 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50">
            {saving ? <CircleNotch size={16} className="animate-spin" /> : null} Publish karein
          </button>
        }
      >
        {editing && (
          <div className="space-y-5">
            <div>
              <label className={fieldLabel}>Title *</label>
              <input className={field} value={editing.title} onChange={(e) => set({ title: e.target.value })} placeholder="Blog ka title" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={fieldLabel}>Author</label>
                <input className={field} value={editing.author} onChange={(e) => set({ author: e.target.value })} />
              </div>
              <div>
                <label className={fieldLabel}>Status</label>
                <select className={field} value={editing.status} onChange={(e) => set({ status: e.target.value })}>
                  <option value="published">Published (website par dikhao)</option>
                  <option value="draft">Draft (chhupao)</option>
                </select>
              </div>
            </div>
            <div>
              <label className={fieldLabel}>Short excerpt</label>
              <input className={field} value={editing.excerpt} onChange={(e) => set({ excerpt: e.target.value })} placeholder="Blog page card par dikhne wali summary" />
            </div>
            <div>
              <label className={fieldLabel}>Content</label>
              <textarea rows={8} className={field} value={editing.content} onChange={(e) => set({ content: e.target.value })} placeholder="Poora blog yahan likhein. Har paragraph nayi line par." />
            </div>
            <div>
              <label className={fieldLabel}>Cover image</label>
              <div className="flex items-center gap-3">
                {(editing.imageFile || editing.image_url) && (
                  <img src={editing.imageFile ? URL.createObjectURL(editing.imageFile) : editing.image_url} alt="" className="h-16 w-24 rounded-xl border border-brand-100 object-cover" />
                )}
                <input ref={imgInput} type="file" accept="image/*" className="hidden" onChange={(e) => set({ imageFile: e.target.files?.[0] || null })} />
                <button type="button" onClick={() => imgInput.current?.click()} className="inline-flex items-center gap-2 rounded-2xl border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-sand-50">
                  <ImageIcon size={16} weight="bold" /> Image chunein
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
