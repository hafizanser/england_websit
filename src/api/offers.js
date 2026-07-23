import { http, withFallback } from './http'
import { offers, promoCodes, products } from '../data/site'

const clone = (v) => JSON.parse(JSON.stringify(v))

export function getOffers() {
  return http.get('/offers').then((r) => r.data)
}

export function getOfferBySlug(slug) {
  return http.get(`/offers/${slug}`).then((r) => r.data)
}

export function getFeaturedOffers() {
  return http.get('/offers/featured').then((r) => r.data)
}

// Local promo validation kept for snappy cart UX; checkout re-validates server-side.
export function validatePromoCode(code, { subtotal = 0 } = {}) {
  return withFallback(
    async () => {
      const res = await http.post('/promo/validate', { code })
      if (res.valid) return { ok: true, offer: clone(offers).find((o) => o.code === res.code) }
      return { ok: false, reason: res.reason }
    },
    async () => {
      const key = String(code || '').trim().toUpperCase()
      if (!key) return { ok: false, reason: 'Code likhein.' }
      const offerId = promoCodes[key]
      if (!offerId) return { ok: false, reason: 'Yeh code maujood nahi hai.' }
      const offer = clone(offers).find((o) => o.id === offerId)
      const min = offer.config?.minSubtotal
      if (min && subtotal < min) {
        return { ok: false, reason: `Yeh code Rs.${min.toLocaleString('en-PK')}+ ke order par lagta hai.`, offer }
      }
      return { ok: true, offer }
    },
  )
}

export function getOfferProducts(offer) {
  return Promise.resolve(clone(products).filter((p) => (offer.productIds || []).includes(p.id)))
}
