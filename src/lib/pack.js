// ---------------------------------------------------------------------------
// Pack-size helpers — turn the dashboard's conversion factors into ONE
// consistent, readable representation used by every product card. Keeping this
// logic here (not inline per card) guarantees identical formatting everywhere.
// ---------------------------------------------------------------------------
import { unitLabelFor } from './cartEngine'
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
