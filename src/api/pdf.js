import { http } from './http'

function toFormData(obj) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined || value === '') continue
    if (value instanceof File) {
      fd.append(key, value)
    } else if (Array.isArray(value)) {
      value.forEach((v) => {
        if (v instanceof File) fd.append(`${key}[]`, v)
        else fd.append(`${key}[]`, String(v))
      })
    } else if (typeof value === 'boolean') {
      fd.append(key, value ? '1' : '0')
    } else if (typeof value === 'object') {
      fd.append(key, JSON.stringify(value))
    } else {
      fd.append(key, String(value))
    }
  }
  return fd
}

export async function adminListPdfs() {
  return (await http.get('/admin/pdf-documents', { auth: true })).data
}

export async function getPdf(id) {
  return (await http.get(`/admin/pdf-documents/${id}`, { auth: true })).document
}

export async function savePdf(pdf) {
  const fd = toFormData(pdf)
  const path = pdf.id ? `/admin/pdf-documents/${pdf.id}` : '/admin/pdf-documents'
  return (await http.postForm(path, fd, { auth: true })).document
}

export async function deletePdf(id) {
  return http.del(`/admin/pdf-documents/${id}`, { auth: true })
}
