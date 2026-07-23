import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  PencilSimple,
  Trash,
  FilePdf,
  Eye,
  UploadSimple,
  CircleNotch,
} from '@phosphor-icons/react'
import { adminListPdfs, savePdf, deletePdf } from '../../api/pdf'
import { useNotify } from '../../context/NotifyContext'
import { AdminTitle, Loader, Card, Btn, EmptyState } from '../../components/admin/ui'
import Modal, { field, fieldLabel } from '../../components/admin/Modal'

const emptyPdf = (position) => ({
  id: '',
  title: '',
  position,
  file: null,
})

export default function AdminPDFCatalog() {
  const navigate = useNavigate()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const { confirm, success, error } = useNotify()
  const fileInput = useRef(null)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      setDocs(await adminListPdfs())
    } catch (err) {
      error(err.message || 'Documents load nahi huye')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openNew = () => setEditing(emptyPdf(docs.length + 1))
  const openEdit = (doc) => setEditing({ ...emptyPdf(doc.position), ...doc, file: null })

  const handleFileDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type === 'application/pdf') {
      setEditing((prev) => ({ ...prev, file }))
    } else if (file) {
      error('Sirf PDF files allowed hain')
    }
  }
  const handleDragOver = (e) => e.preventDefault()

  const canSave = (() => {
    if (!editing) return false
    if (!editing.title) return false
    if (editing.id) return true
    return editing.file instanceof File
  })()

  const onSave = async () => {
    setSaving(true)
    try {
      const payload = {
        id: editing.id || undefined,
        title: editing.title,
        position: Number(editing.position) || 1,
      }
      if (editing.file instanceof File) payload.file = editing.file
      await savePdf(payload)
      setEditing(null)
      await load()
      success(editing.id ? 'Document update ho gaya' : 'Naya document add ho gaya')
    } catch (err) {
      error(err.message || 'Save nahi hua')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (doc) => {
    const ok = await confirm({ tone: 'danger', title: 'Document delete karein?', text: `${doc.title} hamesha ke liye delete ho jayega.`, confirmText: 'Haan, delete' })
    if (!ok) return
    try {
      await deletePdf(doc.id)
      await load()
      success('Document delete ho gaya')
    } catch (err) {
      error(err.message || 'Delete nahi hua')
    }
  }

  const filteredDocs = docs.filter(d => d.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <AdminTitle icon={FilePdf} title="PDF Catalog" subtitle={`${docs.length} documents`}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents..."
          className="px-3 py-2 rounded-lg border border-brand-200 text-sm"
        />
        <Btn onClick={openNew}>
          <Plus size={17} weight="bold" />
          Add Document
        </Btn>
      </AdminTitle>

      {loading ? (
        <Loader />
      ) : filteredDocs.length === 0 ? (
        <EmptyState
          icon={FilePdf}
          title={search ? 'No matching documents' : 'Abhi koi documents nahi'}
          text={search ? 'Try a different search term' : '"Add Document" se pehla document upload karein.'}
          action={!search && <Btn onClick={openNew}><Plus size={16} weight="bold" /> Add Document</Btn>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDocs.map((doc) => (
              <div key={doc.id} className="flex flex-col rounded-lg border border-brand-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <FilePdf size={24} weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-brand-900">{doc.title}</p>
                    <p className="text-xs text-brand-400">
                      {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : ''}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Btn
                    variant="ghost"
                    onClick={() => navigate(`/admin/pdf-catalog/${doc.id}`)}
                  >
                    <Eye size={16} weight="bold" />
                    View
                  </Btn>
                  <Btn
                    variant="ghost"
                    onClick={() => openEdit(doc)}
                  >
                    <PencilSimple size={16} weight="bold" />
                    Edit
                  </Btn>
                  <Btn
                    variant="ghost"
                    tone="danger"
                    onClick={() => onDelete(doc)}
                  >
                    <Trash size={16} weight="bold" />
                    Delete
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={!!editing}
        title={editing?.id ? 'Edit Document' : 'Add Document'}
        onClose={() => setEditing(null)}
        footer={
          <button onClick={onSave} disabled={saving || !canSave} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-5 py-3 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50">
            {saving ? <><CircleNotch size={16} className="animate-spin" /> Saving...</> : (editing?.id ? 'Save' : 'Add Document')}
          </button>
        }
      >
        {editing && (
          <div className="space-y-5">
            <div>
              <label className={fieldLabel}>Document Title *</label>
              <input
                className={field}
                value={editing.title}
                onChange={(e) => setEditing((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Enter title..."
              />
            </div>
            <div>
              <label className={fieldLabel}>PDF File *</label>
              <div
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-brand-300 bg-white px-4 py-6 text-center hover:bg-brand-50 cursor-pointer"
                onClick={() => fileInput.current?.click()}
                onDrop={handleFileDrop}
                onDragOver={handleDragOver}
              >
                <UploadSimple size={32} className="text-brand-500" />
                {editing.file ? (
                  <span className="text-sm font-semibold text-brand-800">{editing.file.name}</span>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-brand-800">
                      Drop PDF file here or click to browse
                    </span>
                    <span className="text-xs text-brand-400">Only PDF files accepted</span>
                  </>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setEditing((prev) => ({ ...prev, file: e.target.files?.[0] || null }))}
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
