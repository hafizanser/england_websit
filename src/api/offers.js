import { http, withFallback } from './http'
import { offers, promoCodes, products } from '../data/site'

const clone = (v) => JSON.parse(JSON.stringify(v))

export function getOffers() {
  return withFallback(
    async () => (await http.get('/offers')).data,
    async () => clone(offers),
  )
}

export function getOfferBySlug(slug) {
  return withFallback(
    async () => (await http.get(`/offers/${slug}`)).data,
    async () => clone(offers).find((o) => o.slug === slug) || null,
  )
}

export function getFeaturedOffers() {
  return withFallback(
    async () => (await http.get('/offers/featured')).data,
    async () => {
      const all = clone(offers)
      const hero = all.find((o) => o.featured === 'lg') || all[0]
      const sides = all.filter((o) => o.featured === 'sm').slice(0, 2)
      return { hero, sides }
    },
  )
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
