import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FilePdf } from '@phosphor-icons/react'
import { getPdf } from '../../api/pdf'
import { useNotify } from '../../context/NotifyContext'
import { AdminTitle, Loader, EmptyState } from '../../components/admin/ui'

export default function AdminPDFViewer() {
  const { id } = useParams()
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const { error } = useNotify()

  const load = async () => {
    setLoading(true)
    try {
      setDoc(await getPdf(id))
    } catch (err) {
      error(err.message || 'Document load nahi huya')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  return (
    <>
      <AdminTitle icon={FilePdf} title={doc?.title || 'Loading...'} subtitle="PDF Viewer">
        <Link to="/admin/pdf-catalog" className="flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-800">
          <ArrowLeft size={16} weight="bold" />
          Back to Catalog
        </Link>
      </AdminTitle>

      {loading ? (
        <Loader />
      ) : !doc ? (
        <EmptyState
          icon={FilePdf}
          title="Document not found"
          text="The document you're looking for doesn't exist."
        />
      ) : (
        <div className="h-[80vh] w-full rounded-2xl border border-brand-200 overflow-hidden bg-white">
          <iframe
            src={doc.file_url}
            className="h-full w-full border-0"
            title={doc.title}
          />
        </div>
      )}
    </>
  )
}
