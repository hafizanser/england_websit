import { mrpPerPiece, mrpPieceLabel } from '../lib/pack'

// The single price shown across the storefront now that selling prices are hidden:
//   Per Piece Price: Rs. 50
// Renders nothing when a product has no usable MRP data. `product` is a storefront
// product (unitOptions + conversions) or any object exposing mrp_piece.
export default function MrpPerPiece({ product, className = '', size = 'md' }) {
  const label = mrpPieceLabel(mrpPerPiece(product))
  if (!label) return null
  const text = size === 'sm' ? 'text-[11.5px]' : 'text-[13px]'
  return (
    <p className={`${text} font-semibold text-brand-600 ${className}`}>
      Per Piece Price: <span className="font-extrabold text-brand-900">{label}</span>
    </p>
  )
}
