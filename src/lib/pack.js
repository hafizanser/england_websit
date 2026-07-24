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

// The "Per Piece Price" shown EVERYWHERE (product cards, listing/search, product
// detail, offers, admin product list, admin Create Order) — the single source of
// truth is the admin "MRP Piece" field (`mrp_piece`) and NOTHING else.
//
// It must never fall back to another price field: not the selling/wholesale price,
// not a box/carton price, and not a value derived from another unit's MRP. The API
// (ProductRepo::toStorefront) and admin raw rows both expose `mrp_piece` directly,
// so one direct read is correct in every context. Deriving from `retail` was the
// old bug: `retail` silently becomes the SELLING price when mrp <= price, and a
// box-derived figure (mrp_box / piecesPerBox) is not the admin's MRP Piece.
//
// Returns null when MRP Piece is blank so callers hide the line rather than show a
// wrong number. (Box/Carton/Bundle/Dozen unit pricing is untouched — see
// perPiecePrice/unitOptions, which are a separate concern.)
export function mrpPerPiece(product) {
  if (!product) return null
  const mrpPiece = Number(product.mrp_piece)
  return Number.isFinite(mrpPiece) && mrpPiece > 0 ? mrpPiece : null
}

// "Rs. 50" — formatted MRP-per-piece amount (rounded, grouped). Empty string when
// there is no value, so callers can hide the line gracefully.
export function mrpPieceLabel(value) {
  const v = Number(value)
  if (!Number.isFinite(v) || v <= 0) return ''
  return `Rs. ${Math.round(v).toLocaleString('en-PK')}`
}

// Order in which a product's SECONDARY sub-unit is resolved — the unit that
// `boxesPerCarton` ("units per main unit") actually counts inside one Carton.
// Mirrors the dashboard's own resolution (AdminProducts → secondaryUnitKey) so
// the storefront line and the admin field can never name it differently.
const SECONDARY_ORDER = ['Box', 'Bundle', 'Packet', 'Dozen', 'Piece']

// The unit LABELS a product actually sells, taken from its unitOptions (each
// `{ unit, label, ... }`) or a bare list of unit keys. Deduped, DB keys resolved
// through unitLabelFor so 'cotton' and 'carton' both land on "Carton".
function availableUnitLabels(options = []) {
  const out = []
  for (const o of options || []) {
    if (!o) continue
    const label = unitLabelFor(typeof o === 'object' ? o.unit : o)
    if (label && !out.includes(label)) out.push(label)
  }
  return out
}

// A single, unambiguous pack-size summary line describing ONLY the units the
// product is actually sold in, e.g.
//   "1 Carton = 36 Box · 1 Box = 24 Pcs"      (carton/box product)
//   "1 Carton = 6 Bundle · 1 Bundle = 80 Pcs" (carton/bundle product)
//   "1 Packet = 8 Pcs"                        (packet-only product)
//
// `options` is the product's unitOptions (or unit-key list). It is what keeps the
// line honest: `boxesPerCarton` is a COUNT, not a unit — it says how many of the
// product's secondary sub-unit fit in a carton, and that sub-unit is a Bundle or a
// Packet just as often as a Box. Naming it "Box" unconditionally (the old
// behaviour) invented a unit the product doesn't sell. Likewise a conversion figure
// left over in the row for a unit the product no longer offers is skipped rather
// than printed.
//
// Passing no options keeps the legacy behaviour (describe whatever the conversions
// define) so callers without a unit list don't lose their line.
// Returns '' when there is no usable conversion data.
export function packSummary(conv = {}, options = []) {
  const c = conv || {}
  const boxesPerCarton = Number(c.boxesPerCarton) || 0
  const pieces = {
    Box: Number(c.piecesPerBox) || 0,
    Bundle: Number(c.piecesPerBundle) || 0,
    Packet: Number(c.piecesPerPacket) || 0,
    Dozen: Number(c.piecesPerDozen) || 0,
  }

  const units = availableUnitLabels(options)
  // No unit list → legacy mode: go by the conversion data alone. Dozen is the one
  // exclusion there, because the API hard-codes piecesPerDozen = 12 on EVERY
  // product, whether or not it is sold by the dozen.
  const sells = (label) => (units.length ? units.includes(label) : label !== 'Dozen')

  const parts = []

  // 1 Carton = N <secondary unit> — only when the product really sells cartons.
  const secondary = SECONDARY_ORDER.find((u) => sells(u))
  if (sells('Carton') && boxesPerCarton > 0) {
    if (secondary && secondary !== 'Piece') parts.push(`1 Carton = ${boxesPerCarton} ${secondary}`)
    // A carton of loose pieces (or of an unnamed sub-unit whose piece count we do
    // know) is still describable — in pieces, the one denominator always valid.
    else if (secondary === 'Piece') parts.push(`1 Carton = ${boxesPerCarton} Pcs`)
    else if (pieces.Box > 0) parts.push(`1 Carton = ${boxesPerCarton * pieces.Box} Pcs`)
  }

  // 1 <sub-unit> = N Pcs, for every sub-unit the product sells that has real
  // piece data. "1 Piece = 1 Pcs" is never useful, so Piece is skipped here.
  for (const u of SECONDARY_ORDER) {
    if (u === 'Piece' || !sells(u) || pieces[u] <= 0) continue
    parts.push(`1 ${u} = ${pieces[u]} Pcs`)
  }

  return parts.join(' · ')
}

// ---------------------------------------------------------------------------
// Retailer profit margin — what a dukaandaar makes reselling at MRP.
// ---------------------------------------------------------------------------

// The product's LARGEST selling unit: the highest-priced option (a Carton costs
// more than a Box costs more than a Piece, so price — not the label — is the
// reliable test, and it keeps working for products with no carton at all).
// Options priced at 0 aren't sellable, so they're ignored. Returns null when the
// product has no priced option.
export function largestUnitOption(options = []) {
  const list = (options || []).filter((o) => o && (Number(o.price) || 0) > 0)
  if (!list.length) return null
  return list.reduce((a, b) => ((Number(b.price) || 0) > (Number(a.price) || 0) ? b : a), list[0])
}

// Profit margin for ONE unit option, as a percentage of MRP:
//   (MRP − wholesale) / MRP × 100
// Same formula the dashboard prints beside every MRP field (AdminProducts →
// mrpRow), so the storefront and the admin can never disagree.
//
// Returns null when it can't be derived — no wholesale price, no MRP, or an MRP
// that isn't above the wholesale price. That last case matters: the API collapses
// `retail` onto `price` whenever mrp <= price (see ProductRepo::toStorefront), so
// a missing MRP would otherwise render as a confident, meaningless "0%".
export function unitProfitMargin(option) {
  const price = Number(option?.price) || 0
  const mrp = Number(option?.retail) || 0
  if (price <= 0 || mrp <= price) return null
  return ((mrp - price) / mrp) * 100
}

// "38%" — rounded margin label. '' when there is nothing to show.
export function marginLabel(pct) {
  return pct == null || !Number.isFinite(pct) ? '' : `${Math.round(pct)}%`
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
