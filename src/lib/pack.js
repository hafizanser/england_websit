// ---------------------------------------------------------------------------
// Pack-size helpers — turn the dashboard's conversion factors into ONE
// consistent, readable representation used by every product card. Keeping this
// logic here (not inline per card) guarantees identical formatting everywhere.
// ---------------------------------------------------------------------------
import { unitLabelFor, mergeUnits } from './cartEngine'
import { commerce } from '../data/site'

// How many pieces are contained in a single unit, derived from the product's
// conversion map. Returns 0 when it can't be derived (e.g. piece-only product).
//   conv = { piecesPerBox, boxesPerCarton, piecesPerPacket, piecesPerBundle, piecesPerDozen }
export function piecesPerUnit(unitKey, conv = {}) {
  const c = conv || {}
  switch (unitLabelFor(unitKey)) {
    case 'Carton': {
      const ppb = Number(c.piecesPerBox) || 0
      const bpc = Number(c.boxesPerCarton) || 0
      return ppb && bpc ? ppb * bpc : Number(c.piecesPerCarton) || 0
    }
    case 'Box':
      return Number(c.piecesPerBox) || 0
    case 'Packet':
      return Number(c.piecesPerPacket) || 0
    case 'Bundle':
      return Number(c.piecesPerBundle) || 0
    case 'Dozen':
      return Number(c.piecesPerDozen) || 12
    case 'Piece':
      return 1
    default:
      return 0
  }
}

// Size of ONE `unitKey` in the product's SMALLEST sellable denominator — the base
// used for ALL stock math. Every unit of a product MUST resolve to the SAME base,
// otherwise the shared-pool caps mix apples and oranges (e.g. a Carton measured in
// "boxes" against a Bundle measured in "pieces" — the cross-unit subtraction is
// then meaningless and secondary units stop respecting cartons already in the cart).
//
// It prefers true pieces. When a product has no box-level piece data (e.g. a
// Carton/Box product with no dozen_in_box, so piecesPerBox = 0) it DEGRADES to
// Boxes as the common denominator instead of collapsing to 0 — keeping cross-unit
// caps working for Carton/Box products. Crucially, when the carton has no piece
// data but a secondary sub-unit does (the Carton + Bundle / Packet case, where
// `boxesPerCarton` counts how many secondary units fit in a carton — e.g.
// 6 Bundles/Carton), the carton BRIDGES through that secondary unit's own base so
// both share one consistent denominator. (perPiecePrice deliberately keeps using
// piecesPerUnit, since a "per piece" price is meaningless without real piece data.)
//   Carton → pieces/carton, else (boxesPerCarton × secondary-unit base), else boxes/carton
//   Box    → pieces/box,     else 1 (the box IS the base)
export function unitBase(unitKey, conv = {}) {
  const c = conv || {}
  const ppb = Number(c.piecesPerBox) || 0
  const bpc = Number(c.boxesPerCarton) || 0
  switch (unitLabelFor(unitKey)) {
    case 'Carton': {
      if (ppb && bpc) return ppb * bpc
      if (Number(c.piecesPerCarton)) return Number(c.piecesPerCarton)
      if (bpc) {
        // No box-level pieces. `boxesPerCarton` counts the product's secondary
        // sub-unit per carton, so bridge to that unit's base (its pieces) — this
        // keeps Carton and Bundle/Packet on ONE denominator. If the secondary unit
        // has no pieces either, degrade to the raw secondary-unit count.
        const sec = Math.max(Number(c.piecesPerBundle) || 0, Number(c.piecesPerPacket) || 0)
        return sec ? bpc * sec : bpc
      }
      return 0
    }
    case 'Box':
      return ppb || (bpc ? 1 : 0)
    // Packet / Bundle are secondary sub-units, exactly like Box. When their own
    // piece data is missing but they ARE the carton's sub-unit (bpc = sub-units per
    // carton), they degrade to 1 so they remain the shared base — matching the
    // Carton's own `bpc` degrade above. Without this they collapsed to 0, which made
    // remainingUnits() bail to the raw per-unit cap and stop honouring the cartons
    // already in the cart (the cross-unit over-sell bug).
    case 'Packet':
      return Number(c.piecesPerPacket) || (bpc ? 1 : 0)
    case 'Bundle':
      return Number(c.piecesPerBundle) || (bpc ? 1 : 0)
    case 'Dozen':
      return Number(c.piecesPerDozen) || 12
    case 'Piece':
      return 1
    default:
      return 0
  }
}

// Available quantity of a product expressed in a CHOSEN unit.
//
// Opening stock (`stock`, from the admin field total_stock_cotton) is measured in
// CARTONS — the product's largest unit. Capping every unit at that raw number is
// wrong: 20 cartons is also 480 boxes (24/carton) or 5,760 pieces. So we convert
// the carton total into pieces, then divide by the pieces contained in one of the
// chosen unit to get the true per-unit ceiling.
//
// `options` (optional — the full list of sellable units) lets callers that have it
// anchor the stock's base to the product's largest unit even when that isn't a
// carton. When the pack data can't support a conversion, we fall back to the raw
// stock number so a product is never over-restricted.
export function stockForUnit(stock, unitKey, conv = {}, options = []) {
  const s = Number(stock) || 0
  if (s <= 0) return 0
  const perUnit = unitBase(unitKey, conv)
  const perBase = (options || []).reduce(
    (max, o) => Math.max(max, unitBase(o.unit, conv)),
    unitBase('carton', conv),
  )
  if (!perUnit || !perBase) return s
  return Math.floor((s * perBase) / perUnit)
}

// ---------------------------------------------------------------------------
// The admin's plain-language conversion, exposed as shared helpers so the
// inventory view, product cards and the cart pool can never drift apart.
// ---------------------------------------------------------------------------

// Small (secondary) units contained in ONE main unit — i.e. "Units Per Main Unit"
// as entered in Add/Edit Product (Boxes/Bundles/Packs per Carton). This is the
// single definition of the carton→secondary factor.
export function unitsPerMainUnit(conv = {}) {
  return Number(conv?.boxesPerCarton) || 0
}

// Total available SMALL units for a product = Main Unit Stock × Units Per Main Unit.
// Main-unit stock (admin's total_stock_cotton) is the single source of truth. This
// equals the empty-cart availability the shared pool (remainingUnits) enforces for
// the secondary unit, so the inventory number and the cart cap can never disagree.
// Returns 0 when there is no secondary conversion (single-unit product).
export function totalSmallUnits(mainStock, conv = {}) {
  const s = Number(mainStock) || 0
  const per = unitsPerMainUnit(conv)
  return s > 0 && per > 0 ? Math.round(s * per) : 0
}

// Per-piece price for a chosen unit option. Returns null when it can't be
// derived (no pack data / zero price) so the card can hide the line gracefully.
export function perPiecePrice(unitOption, conv = {}) {
  if (!unitOption || !unitOption.price) return null
  const pcs = piecesPerUnit(unitOption.unit, conv)
  if (!pcs) return null
  return unitOption.price / pcs
}

// Format a per-piece price: 2 decimals for small values, whole for big ones.
export function perPcLabel(perPc) {
  if (perPc == null) return ''
  const val = perPc >= 100 ? Math.round(perPc) : Math.round(perPc * 100) / 100
  return `${commerce.currency}${val.toLocaleString('en-PK')}`
}

// MRP (retail) for a SINGLE piece of a product — the only price shown anywhere now
// that selling prices are hidden. Admin raw rows carry `mrp_piece` directly and are
// used as-is; storefront products derive it from the retail (MRP) of any sellable
// unit ÷ the pieces that unit contains (MRP scales linearly, so any unit yields the
// same per-piece figure). Returns null when there is no usable MRP data.
export function mrpPerPiece(product) {
  if (!product) return null
  const direct = Number(product.mrp_piece)
  if (Number.isFinite(direct) && direct > 0) return direct
  const conv = product.conversions || {}
  const options = product.unitOptions && product.unitOptions.length
    ? product.unitOptions
    : (product.unit ? [{ unit: product.unit, retail: product.retail }] : [])
  for (const o of options) {
    const pcs = piecesPerUnit(o.unit, conv)
    const mrp = Number(o.retail ?? 0)
    if (pcs > 0 && mrp > 0) return mrp / pcs
  }
  return null
}

// "Rs. 50" — formatted MRP-per-piece amount (rounded, grouped). Empty string when
// there is no value, so callers can hide the line gracefully.
export function mrpPieceLabel(value) {
  const v = Number(value)
  if (!Number.isFinite(v) || v <= 0) return ''
  return `Rs. ${Math.round(v).toLocaleString('en-PK')}`
}

// A single, unambiguous pack-size summary line, e.g.
//   "1 Carton = 36 Box · 1 Box = 24 Pcs"   (carton/box product)
//   "1 Bundle = 80 Pcs"                      (bundle product)
//   "1 Packet = 8 Pcs"                       (packet product)
// Returns '' when there is no usable conversion data.
export function packSummary(conv = {}) {
  const c = conv || {}
  const parts = []
  const boxesPerCarton = Number(c.boxesPerCarton) || 0
  const piecesPerBox = Number(c.piecesPerBox) || 0
  const piecesPerPacket = Number(c.piecesPerPacket) || 0
  const piecesPerBundle = Number(c.piecesPerBundle) || 0

  if (boxesPerCarton > 0) parts.push(`1 Carton = ${boxesPerCarton} Box`)
  if (piecesPerBox > 0) parts.push(`1 Box = ${piecesPerBox} Pcs`)
  if (piecesPerBundle > 0) parts.push(`1 Bundle = ${piecesPerBundle} Pcs`)
  if (!parts.length && piecesPerPacket > 0) parts.push(`1 Packet = ${piecesPerPacket} Pcs`)

  return parts.join(' · ')
}

// ---------------------------------------------------------------------------
// Cross-unit stock — the single source of truth for availability.
//
// A product's stock is ONE shared pool. Cartons and Boxes of the same product
// both draw from it, so validation must happen at the lowest common denominator
// (unitBase — pieces when available, else boxes):
//   (Cartons × base/Carton) + (Boxes × base/Box) ≤ total base units.
// These helpers express that pool so caps stay correct no matter how units are
// combined in the cart / order.
// ---------------------------------------------------------------------------

// Base units contained in the product's largest sellable unit (the stock's base).
function basePieces(conv = {}, options = []) {
  return (options || []).reduce(
    (max, o) => Math.max(max, unitBase(o.unit, conv)),
    unitBase('carton', conv),
  )
}

// Total available base units for a product. Opening stock is measured in the
// largest unit (cartons), so total = stock × base-per-largest-unit. Returns 0
// when it can't be derived (no pack data) — callers then fall back to the raw
// per-unit cap for such single-unit products.
export function totalStockPieces(stock, conv = {}, options = []) {
  const s = Number(stock)
  if (!Number.isFinite(s) || s <= 0) return 0
  const base = basePieces(conv, options)
  return base > 0 ? Math.round(s * base) : 0
}

// Base units already committed to the cart for ONE product across the given unit
// lines. Pass `excludeUnitKey` to sum only the OTHER units.
//   units: [{ unitKey, qty }]
export function committedPieces(units = [], conv = {}, excludeUnitKey = null) {
  return (units || []).reduce((sum, u) => {
    if (excludeUnitKey != null && u.unitKey === excludeUnitKey) return sum
    return sum + (unitBase(u.unitKey, conv) || 0) * (Number(u.qty) || 0)
  }, 0)
}

// Max quantity of `unitKey` that can still be in the cart, given the base units
// already taken by the product's OTHER units. Returns null when there's no
// usable pack data (caller falls back to the per-unit cap).
export function remainingUnits({ stock, conv = {}, options = [], unitKey, units = [] }) {
  const total = totalStockPieces(stock, conv, options)
  const per = unitBase(unitKey, conv)
  if (total <= 0 || !per) return null
  const other = committedPieces(units, conv, unitKey)
  return Math.max(0, Math.floor((total - other) / per))
}

// Effective cap (max TOTAL qty) for the SELECTED unit of a product, accounting
// for cross-unit consumption already in the cart. This is the ONE function every
// quantity control should use.
//   Infinity → unknown stock (no cap)   0 → out of stock
export function unitStockCap(product, selected, units = []) {
  if (product == null || product.stock == null) return Infinity // unknown → no cap
  const rawStock = Number(product.stock)
  if (!Number.isFinite(rawStock)) return Infinity
  if (rawStock <= 0) return 0
  const conv = product.conversions || {}
  const options = product.unitOptions && product.unitOptions.length ? product.unitOptions : [{ unit: product.unit }]
  const rem = remainingUnits({ stock: rawStock, conv, options, unitKey: selected.unit, units })
  // No pack data (single-unit product) → the raw per-unit ceiling.
  return rem == null ? stockForUnit(rawStock, selected.unit, conv, options) : rem
}

// ---------------------------------------------------------------------------
// Cart-group variants of the caps above. A "group" is one product's collected
// unit lines as produced by cartEngine.groupByProduct:
//   { stock, units: [{ unitKey, qty, conv }] }
// They let the cart / checkout enforce the SAME shared-pool rule without
// reconstructing a full product object.
// ---------------------------------------------------------------------------

// Conversion map for a group — every unit line of one product carries the same
// snapshot, so the first non-empty one is authoritative.
function groupConv(group) {
  return ((group?.units || []).find((u) => u && u.conv) || {}).conv || {}
}

// Cap (max qty) for ONE unit line inside a group, honouring the shared pool: the
// OTHER unit lines of the same product are subtracted first. Mirrors
// unitStockCap but reads the cart's grouped shape.
//   Infinity → unknown stock (no cap)   0 → nothing left for this unit
export function groupUnitCap(group, unit) {
  if (!group || group.stock == null) return Infinity
  const stock = Number(group.stock)
  if (!Number.isFinite(stock)) return Infinity
  if (stock <= 0) return 0
  const units = group.units || []
  const conv = (unit && unit.conv) || groupConv(group)
  const options = units.map((u) => ({ unit: u.unitKey }))
  const rem = remainingUnits({ stock, conv, options, unitKey: unit.unitKey, units })
  return rem == null ? stockForUnit(stock, unit.unitKey, conv, options) : rem
}

// True when a group's committed quantity exceeds its stock pool (all units summed
// at the piece level). Unknown stock (null) → never over.
export function groupOverStock(group) {
  if (!group || group.stock == null) return false
  const stock = Number(group.stock)
  if (!Number.isFinite(stock)) return false
  const units = (group.units || []).map((u) => ({ unitKey: u.unitKey, qty: Number(u.qty) || 0 }))
  if (stock <= 0) return units.some((u) => u.qty > 0)
  const conv = groupConv(group)
  const options = units.map((u) => ({ unit: u.unitKey }))
  const total = totalStockPieces(stock, conv, options)
  // No pack data → fall back to the per-unit ceiling per line.
  if (total <= 0) return units.some((u) => u.qty > stockForUnit(stock, u.unitKey, conv, options))
  return committedPieces(units, conv) > total
}

// Friendly availability for a group, e.g. "18 Cartons 3 Boxes" — the remaining
// pool expressed as the same larger-unit breakdown the cart uses for quantities.
// Returns '' when it can't be derived (no pack data).
export function stockPoolLabel(group) {
  const conv = groupConv(group)
  const units = (group?.units || []).map((u) => ({ unit: u.unitKey }))
  const total = totalStockPieces(group?.stock, conv, units) // in base units
  const perBox = unitBase('box', conv)                       // base units per box
  if (total <= 0 || perBox <= 0) return ''
  const boxes = Math.floor(total / perBox)
  return mergeUnits({ units: [{ unitKey: 'box', qty: boxes, conv }] })
    .map((p) => p.text)
    .join(' ')
}
