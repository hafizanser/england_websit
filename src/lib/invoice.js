// ---------------------------------------------------------------------------
// Invoice export helpers: Print, PDF download, PNG share (WhatsApp).
// The invoice/summary nodes use no cross-origin images, so html2canvas never
// taints the canvas — PDF and PNG always succeed with the same layout.
// ---------------------------------------------------------------------------
// jspdf + html2canvas are heavy and only needed on the invoice screen, so they
// are dynamically imported on first use to keep the main bundle small.
async function nodeToCanvas(node) {
  const html2canvas = (await import('html2canvas')).default
  return html2canvas(node, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    windowWidth: node.scrollWidth,
  })
}

// Print: a print stylesheet (index.css @media print) scopes output to .print-area.
export function printInvoice() {
  window.print()
}

export async function downloadPdf(node, filename = 'invoice.pdf') {
  const { jsPDF } = await import('jspdf')
  const canvas = await nodeToCanvas(node)
  const img = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const imgW = pageW
  const imgH = (canvas.height * imgW) / canvas.width

  let heightLeft = imgH
  let position = 0
  pdf.addImage(img, 'PNG', 0, position, imgW, imgH)
  heightLeft -= pageH
  while (heightLeft > 0) {
    position -= pageH
    pdf.addPage()
    pdf.addImage(img, 'PNG', 0, position, imgW, imgH)
    heightLeft -= pageH
  }
  pdf.save(filename)
}

async function nodeToBlob(node) {
  const canvas = await nodeToCanvas(node)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

export async function downloadPng(node, filename = 'order.png') {
  const blob = await nodeToBlob(node)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Share the order summary as a PNG via WhatsApp.
 * Uses the Web Share API (attaches the image directly on mobile) and falls
 * back to downloading the PNG + opening a WhatsApp chat with a text note.
 */
export async function shareOrderImage(node, { filename = 'order.png', text = '', phone = '' } = {}) {
  const blob = await nodeToBlob(node)
  const file = new File([blob], filename, { type: 'image/png' })

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title: 'England Order' })
      return 'shared'
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled'
    }
  }

  // fallback — download the image, then open WhatsApp with the text summary
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)

  const digits = phone.replace(/[^0-9]/g, '')
  window.open(
    `https://wa.me/${digits}?text=${encodeURIComponent(text)}`,
    '_blank',
    'noopener',
  )
  return 'downloaded'
}
