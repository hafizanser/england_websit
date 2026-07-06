import { useEffect, useRef, useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import {
  Plus, PencilSimple, Trash, DotsSixVertical, VideoCamera, UploadSimple,
  LinkSimple, Eye, EyeSlash, ArrowSquareOut, CircleNotch, GoogleDriveLogo,
} from '@phosphor-icons/react'
import { adminListVideos, saveVideo, deleteVideo, reorderVideos } from '../../api/admin'
import { useNotify } from '../../context/NotifyContext'
import { AdminTitle, Loader, Card, Btn, EmptyState } from '../../components/admin/ui'
import Modal, { field, fieldLabel } from '../../components/admin/Modal'

const emptyVideo = (position) => ({
  id: '', title: '', position, source_type: 'upload', is_active: 1,
  drive_url: '', videoFile: null, video_url: '', poster_url: '',
})
const toForm = (v) => ({ ...emptyVideo(v.position), ...v, is_active: Number(v.is_active) ? 1 : 0, videoFile: null })

// ---- one draggable row -----------------------------------------------------
function VideoRow({ v, index, onEdit, onDelete, onToggleActive }) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={v}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-3 border-b border-brand-50 bg-white px-3 py-3 last:border-b-0"
    >
      {/* drag handle */}
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        aria-label="Reorder (drag)"
        className="grid h-9 w-7 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-brand-300 hover:bg-sand-50 hover:text-brand-600 active:cursor-grabbing"
      >
        <DotsSixVertical size={18} weight="bold" />
      </button>

      {/* position badge */}
      <span className="grid h-9 w-14 shrink-0 place-items-center rounded-xl bg-brand-50 text-xs font-bold text-brand-700">
        Card {index + 1}
      </span>

      {/* poster / thumb */}
      {v.poster_url ? (
        <img src={v.poster_url} alt="" className="h-12 w-16 shrink-0 rounded-lg border border-brand-100 object-cover" />
      ) : (
        <span className="grid h-12 w-16 shrink-0 place-items-center rounded-lg bg-sand-100 text-brand-300">
          <VideoCamera size={20} />
        </span>
      )}

      {/* title + source */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-brand-900">{v.title || <span className="text-brand-300">Bina title</span>}</p>
        <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-sand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-500">
          {v.source_type === 'drive'
            ? (<><GoogleDriveLogo size={12} weight="fill" /> Google Drive</>)
            : (<><UploadSimple size={12} weight="fill" /> Uploaded</>)}
        </span>
      </div>

      {/* active toggle */}
      <button
        type="button"
        onClick={() => onToggleActive(v)}
        aria-label={v.is_active ? 'Hide from homepage' : 'Show on homepage'}
        title={v.is_active ? 'Homepage par dikh raha hai' : 'Chhupa hua'}
        className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold sm:inline-flex ${
          v.is_active ? 'bg-green-100 text-green-700' : 'bg-sand-200 text-brand-500'
        }`}
      >
        {v.is_active ? <Eye size={13} weight="bold" /> : <EyeSlash size={13} weight="bold" />}
        {v.is_active ? 'Live' : 'Hidden'}
      </button>

      {/* actions */}
      <div className="flex shrink-0 gap-1.5">
        <button onClick={() => onEdit(v)} aria-label="Edit" className="grid h-8 w-8 place-items-center rounded-lg border border-brand-200 text-brand-600 hover:bg-sand-50"><PencilSimple size={15} weight="bold" /></button>
        <button onClick={() => onDelete(v)} aria-label="Delete" className="grid h-8 w-8 place-items-center rounded-lg border border-brand-200 text-brand-500 hover:bg-saffron-50 hover:text-saffron-700"><Trash size={15} weight="bold" /></button>
      </div>
    </Reorder.Item>
  )
}

export default function AdminVideos() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const { confirm, success, error } = useNotify()
  const fileInput = useRef(null)
  const orderTimer = useRef(0)

  const load = async () => {
    setLoading(true)
    try {
      setRows(await adminListVideos())
    } catch (err) {
      error(err.message || 'Videos load nahi huye')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])
  useEffect(() => () => clearTimeout(orderTimer.current), [])

  // Drag reorder → update locally, then persist the new 1..N order (debounced).
  const onReorder = (next) => {
    setRows(next)
    clearTimeout(orderTimer.current)
    orderTimer.current = setTimeout(async () => {
      try {
        await reorderVideos(next.map((r) => r.id))
      } catch (err) {
        error(err.message || 'Order save nahi hua')
        load()
      }
    }, 700)
  }

  const openNew = () => setEditing(emptyVideo(rows.length + 1))
  const openEdit = (v) => setEditing(toForm(v))
  const set = (patch) => setEditing((e) => ({ ...e, ...patch }))

  const toggleActive = async (v) => {
    try {
      await saveVideo({ id: v.id, source_type: v.source_type, position: v.position, is_active: v.is_active ? 0 : 1 })
      await load()
    } catch (err) {
      error(err.message || 'Update nahi hua')
    }
  }

  const canSave = (() => {
    if (!editing) return false
    if (!editing.position || Number(editing.position) < 1) return false
    if (editing.id) return true // editing existing: metadata-only saves allowed
    if (editing.source_type === 'upload') return editing.videoFile instanceof File
    return editing.drive_url.trim() !== ''
  })()

  const onSave = async () => {
    setSaving(true)
    try {
      const e = editing
      const payload = {
        id: e.id || undefined,
        title: e.title || '',
        position: Number(e.position) || 1,
        is_active: e.is_active ? 1 : 0,
        source_type: e.source_type,
      }
      if (e.source_type === 'upload' && e.videoFile instanceof File) payload.video = e.videoFile
      if (e.source_type === 'drive') payload.drive_url = e.drive_url
      const isEdit = !!e.id
      await saveVideo(payload)
      setEditing(null)
      await load()
      success(isEdit ? 'Video update ho gaya' : 'Naya video add ho gaya')
    } catch (err) {
      error(err.message || 'Save nahi hua')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (v) => {
    const ok = await confirm({ tone: 'danger', title: 'Video delete karein?', text: `Card is homepage se hamesha ke liye hat jayega.`, confirmText: 'Haan, delete' })
    if (!ok) return
    try {
      await deleteVideo(v.id)
      await load()
      success('Video delete ho gaya')
    } catch (err) {
      error(err.message || 'Delete nahi hua')
    }
  }

  // Live preview URL inside the modal (new file → object URL; else existing clip).
  const previewSrc = editing?.videoFile instanceof File
    ? URL.createObjectURL(editing.videoFile)
    : editing?.video_url

  return (
    <>
      <AdminTitle eyebrow="Homepage" icon={VideoCamera} title="Video Reels" subtitle={`${rows.length} cards — order badalne ke liye drag karein`}>
        <Btn as="a" variant="ghost" href="/#/" target="_blank" rel="noreferrer">
          <ArrowSquareOut size={16} weight="bold" /> Homepage dekhein
        </Btn>
        <Btn onClick={openNew}>
          <Plus size={17} weight="bold" /> Naya video
        </Btn>
      </AdminTitle>

      {loading ? <Loader /> : rows.length === 0 ? (
        <EmptyState
          icon={VideoCamera}
          title="Abhi koi video nahi"
          text='"Naya video" se pehla reel add karein — upload karein ya Google Drive link dein.'
          action={<Btn onClick={openNew}><Plus size={16} weight="bold" /> Naya video</Btn>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-brand-100 bg-sand-50/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-brand-400">
            Card order — jaise homepage par dikhega
          </div>
          <Reorder.Group axis="y" values={rows} onReorder={onReorder}>
            {rows.map((v, i) => (
              <VideoRow key={v.id} v={v} index={i} onEdit={openEdit} onDelete={onDelete} onToggleActive={toggleActive} />
            ))}
          </Reorder.Group>
        </Card>
      )}

      {/* Add / Edit modal */}
      <Modal
        open={!!editing}
        title={editing?.id ? 'Video edit karein' : 'Naya video'}
        onClose={() => setEditing(null)}
        footer={
          <button onClick={onSave} disabled={saving || !canSave} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-5 py-3 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50">
            {saving ? <><CircleNotch size={16} className="animate-spin" /> Save + optimize ho raha hai...</> : (editing?.id ? 'Save karein' : 'Add karein')}
          </button>
        }
      >
        {editing && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className={fieldLabel}>Title (optional)</label>
                <input className={field} value={editing.title} onChange={(e) => set({ title: e.target.value })} placeholder="Misaal: Dukaandaar review" />
              </div>
              <div>
                <label className={fieldLabel}>Position *</label>
                <input type="number" min={1} className={field} value={editing.position} onChange={(e) => set({ position: e.target.value })} />
              </div>
            </div>

            {/* Source toggle — only ONE source active at a time */}
            <div>
              <label className={fieldLabel}>Video source</label>
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-sand-100 p-1">
                {[
                  { key: 'upload', label: 'Upload', icon: UploadSimple },
                  { key: 'drive', label: 'Google Drive', icon: GoogleDriveLogo },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => set({ source_type: opt.key })}
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-all ${
                      editing.source_type === opt.key ? 'bg-white text-brand-800 shadow-card' : 'text-brand-400 hover:text-brand-600'
                    }`}
                  >
                    <opt.icon size={16} weight="fill" /> {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {editing.source_type === 'upload' ? (
              <div>
                <label className={fieldLabel}>Video file</label>
                <input ref={fileInput} type="file" accept="video/*" className="hidden" onChange={(e) => set({ videoFile: e.target.files?.[0] || null })} />
                <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-300 bg-white px-4 py-3 text-sm font-semibold text-brand-700 hover:bg-sand-50">
                  <UploadSimple size={16} weight="bold" /> {editing.videoFile ? editing.videoFile.name : 'Video chunein'}
                </button>
                <p className="mt-1.5 text-xs text-brand-400">Upload ke baad video ko khud-ba-khud optimize/compress kiya jayega (achhi quality, kam size).</p>
              </div>
            ) : (
              <div>
                <label className={fieldLabel}>Google Drive link</label>
                <div className="relative">
                  <LinkSimple size={16} weight="bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400" />
                  <input className={`${field} pl-10`} value={editing.drive_url} onChange={(e) => set({ drive_url: e.target.value })} placeholder="https://drive.google.com/file/d/..." />
                </div>
                <p className="mt-1.5 text-xs text-brand-400">Drive video ko re-host + optimize kiya jayega taake upload jaisa hi chale. (File "Anyone with the link" par shared honi chahiye.)</p>
              </div>
            )}

            {/* preview */}
            {previewSrc && (
              <div>
                <label className={fieldLabel}>Preview</label>
                <video src={previewSrc} className="max-h-56 w-full rounded-2xl border border-brand-100 bg-black object-contain" controls muted playsInline preload="metadata" />
              </div>
            )}

            {/* active */}
            <label className="flex items-center justify-between rounded-2xl border border-brand-200 bg-white px-4 py-3">
              <span className="text-sm font-semibold text-brand-800">Homepage par dikhayein</span>
              <input type="checkbox" checked={!!editing.is_active} onChange={(e) => set({ is_active: e.target.checked ? 1 : 0 })} className="h-5 w-5 accent-brand-700" />
            </label>
          </div>
        )}
      </Modal>
    </>
  )
}
