import { http } from './http'
import { CATALOG_PREFIX } from './cacheKeys'
import { invalidateCache } from '../lib/queryCache'

// Place an order (guest checkout — backend auto-creates the customer account
// and returns a session so the shopper is logged in automatically).
export async function placeOrder(payload) {
  const res = await http.post('/checkout', payload)
  // Checkout reserves stock, so the "X cartons left" on every card the shopper
  // just bought from is now wrong. Retiring the catalogue cache here is what
  // stops them going Back to the grid and seeing their own purchase un-counted.
  invalidateCache(CATALOG_PREFIX)
  return { order: res.order, session: res.session || null }
}

// Customer order history by phone (the lightweight "session").
export async function lookupOrders(phone) {
  return http.post('/orders/lookup', { phone })
}

// Single order by code (invoice / tracking).
export async function getOrder(code) {
  const res = await http.get(`/orders/${code}`)
  return res.order
}

// Server-authoritative re-price of a cart (optional preview).
export async function quoteCart(items, code) {
  const res = await http.post('/cart/quote', { items, code })
  return res.totals
}
