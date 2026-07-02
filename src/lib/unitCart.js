import { unitStockCap } from './pack'

// ---------------------------------------------------------------------------
// Shared behaviour for the quantity controls (− 1 +) + Add-to-cart button, used
// identically on the Products, Product-detail and Admin New-Order pages.
//
//   − : remove ONE of the selected unit from the cart (alert; "not in cart" alert
//       when the line is absent). Never goes negative.
//   + : add ONE of the selected unit (respects stock; increments an existing line
//       instead of duplicating).
//   Add: add the manual quantity; if the line already exists, bump it and say
//        "already in your cart. Quantity updated." instead of duplicating.
//
// Stock is validated at the lowest common denominator (pieces): the cap for the
// selected unit is computed LIVE from the whole cart, so Cartons and Boxes of the
// same product share one pool (see lib/pack → unitStockCap).
//
// Cart items are always identified by product id + selected unit. The `cart`
// adapter abstracts the backend (storefront CartContext vs admin order lines):
//   { qtyOf(id, unitKey) -> number,
//     unitsOf(id) -> [{ unitKey, qty }]   // all units of this product in the cart
//     setUnitQty(product, unitOption, qty) -> void   // absolute qty, no toast
//     toast(message, tone) -> void }
// ---------------------------------------------------------------------------

export const cartAlert = {
  added: (name, unit) => `🛒 Added to cart: ${name} (${unit}).`,
  removed: (name, unit) => `🛒 Removed from cart: ${name} (${unit}).`,
  notInCart: () => 'Is unit ka product cart mein mojood nahi hai.',
  updated: (name, unit) => `ℹ️ ${name} (${unit}) is already in your cart. Quantity updated.`,
  // Matches the existing stock-limit wording used across the app.
  overStock: (stock, unit) => `Only ${stock} ${unit || 'units'} available in stock.`,
}

// `cap` = available quantity for the SELECTED unit (0 = none available). Each
// action returns true on success, false if it was blocked (not-in-cart / stock).
export function unitCartActions(cart, product, selected, cap) {
  const unitKey = selected.unit
  const label = selected.label
  const name = product.name
  const limit = Number(cap) || 0

  const minus = () => {
    const cur = cart.qtyOf(product.id, unitKey)
    if (cur <= 0) { cart.toast(cartAlert.notInCart(), 'warning'); return false }
    cart.setUnitQty(product, selected, cur - 1) // reaching 0 removes the line
    cart.toast(cartAlert.removed(name, label), 'success')
    return true
  }

  const plus = () => {
    const cur = cart.qtyOf(product.id, unitKey)
    if (limit <= 0 || cur + 1 > limit) { cart.toast(cartAlert.overStock(Math.max(0, limit), label), 'warning'); return false }
    cart.setUnitQty(product, selected, cur + 1)
    cart.toast(cartAlert.added(name, label), 'success')
    return true
  }

  const addManual = (qtyRaw) => {
    const n = Math.max(1, Math.floor(Number(qtyRaw) || 1)) // never below 1
    const cur = cart.qtyOf(product.id, unitKey)
    if (limit <= 0 || cur + n > limit) { cart.toast(cartAlert.overStock(Math.max(0, limit), label), 'warning'); return false }
    cart.setUnitQty(product, selected, cur + n) // bump existing instead of duplicating
    if (cur > 0) cart.toast(cartAlert.updated(name, label), 'info')
    else cart.toast(cartAlert.added(name, label), 'success')
    return true
  }

  return { minus, plus, addManual }
}
