import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer, FilePdf, CircleNotch, ShoppingBag } from '@phosphor-icons/react'
import { getAdminOrder } from '../../api/admin'
import { useAsync } from '../../hooks/useAsync'
import { useNotify } from '../../context/NotifyContext'
import { AdminTitle, Loader, Card } from '../../components/admin/ui'
import { SourceBadge } from '../../components/admin/SourceBadge'
import Invoice from '../../components/Invoice'
import { printInvoice, downloadPdf } from '../../lib/invoice'

export default function AdminInvoiceDetail() {
  const { id } = useParams()
  const invoiceRef = useRef(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const { success } = useNotify()
  const { data: order, loading, error } = useAsync(() => getAdminOrder(id), [id])

  const handlePdf = async () => {
    setPdfBusy(true)
    try {
      await downloadPdf(invoiceRef.current, `${order.code}-invoice.pdf`)
      success('PDF download ho gaya')
    } finally {
      setPdfBusy(false)
    }
  }

  if (loading) return <Loader />
  if (error || !order) {
    return (
      <Card className="grid place-items-center py-16 text-center">
        <p className="font-bold text-saffron-800">{error?.message || 'Invoice nahi mila'}</p>
        <Link to="/admin/invoices" className="mt-3 text-sm font-semibold text-brand-700">← Invoices</Link>
      </Card>
    )
  }

  return (
    <>
      <Link to="/admin/invoices" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-900">
        <ArrowLeft size={16} weight="bold" /> Invoices
      </Link>

      <AdminTitle title={`Invoice ${order.code}`} subtitle={`${order.customer?.name} • ${order.customer?.phone}`}>
        <SourceBadge source={order.source} />
        <button onClick={printInvoice} className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2.5 text-sm font-bold text-brand-800 hover:bg-sand-50">
          <Printer size={17} weight="fill" /> Print
        </button>
        <button onClick={handlePdf} disabled={pdfBusy} className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-2.5 text-sm font-bold text-white shadow-soft hover:bg-brand-800 disabled:opacity-60">
          {pdfBusy ? <CircleNotch size={17} className="animate-spin" /> : <FilePdf size={17} weight="fill" />} PDF download
        </button>
        <Link to={`/admin/orders/${order.id}`} className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2.5 text-sm font-bold text-brand-800 hover:bg-sand-50">
          <ShoppingBag size={17} weight="fill" /> Order manage
        </Link>
      </AdminTitle>

      <Card className="overflow-hidden">
        <Invoice ref={invoiceRef} order={order} />
      </Card>
    </>
  )
}
