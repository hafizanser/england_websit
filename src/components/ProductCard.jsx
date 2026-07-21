import { memo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { CheckCircle, Package } from '@phosphor-icons/react'
import { orderUnitOptions, unitLabelFor } from '../lib/cartEngine'
import { spring } from '../lib/motion'
import { packSummary } from '../lib/pack'
import { productVideo } from '../lib/productMedia'
import EnquiryButton from './EnquiryButton'
import MrpPerPiece from './MrpPerPiece'
import ProductGallery from './ProductGallery'
import ProductVideoBadge from './ProductVideoBadge'

// Stock pill — AA-contrast, derived from total_stock_cotton (in cartons).
function StockBadge({ stock }) {
  if (stock <= 0) {
    return (
      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
        Stock khatam
      </span>
    )
  }
  if (stock <= 5) {
    return (
      <span className="shrink-0 rounded-full bg-saffron-100 px-2 py-0.5 text-[10px] font-bold text-saffron-900">
        Sirf {stock} carton bachay
      </span>
    )
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
      <CheckCircle size={11} weight="fill" /> Stock mein
    </span>
  )
}

// Unit chooser + WhatsApp enquiry — the purchase flow is now a WhatsApp enquiry
// (prices are hidden). The customer picks a unit (Carton / Box / Bundle / …) and
// the button opens WhatsApp pre-filled with the product name + that unit.
// Isolated + memoized so unit selection re-renders ONLY this control.
const CardEnquiry = memo(function CardEnquiry({ p, options, selected, onUnit }) {
  return (
    <div className="mt-auto flex flex-col gap-2.5 pt-2.5">
      {/* Unit pills — single row; active unit highlighted, refined gold hover. */}
      {options.length > 1 && (
        <div role="group" aria-label="Unit chunein" className="no-scrollbar -mx-0.5 flex gap-1.5 overflow-x-auto px-0.5">
          {options.map((o) => {
            const on = selected.unit === o.unit
            return (
              <button
                key={o.unit}
                type="button"
                aria-pressed={on}
                onClick={() => onUnit(o.unit)}
                className={`min-h-[34px] shrink-0 rounded-full px-3.5 py-1 text-[11.5px] font-bold tracking-tight transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-saffron-500 active:scale-95 ${
                  on
                    ? 'bg-brand-700 text-white shadow-soft ring-1 ring-inset ring-white/15'
                    : 'border border-brand-200 bg-white text-brand-700 hover:border-saffron-300 hover:bg-saffron-50/50 hover:text-saffron-800'
                }`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )}

      <EnquiryButton name={p.name} unit={selected.label} size="md" />
    </div>
  )
})

function ProductCardBase({ p, preferLargestUnit = false, linkToProduct = true, showVideo = false }) {
  const reduce = useReducedMotion()

  // Preview clip for the corner play badge (null when the product has none — the
  // badge then never renders). Resolved once per render; the modal inside the
  // badge stays unmounted until clicked, so no video downloads on the grid.
  const video = showVideo ? productVideo(p) : null

  // All unit types available for this product (from the database), with the
  // primary unit as a fallback when the product declares none. Carton leads the
  // row — display order only; the default below still picks by price.
  const options = orderUnitOptions(
    p.unitOptions && p.unitOptions.length ? p.unitOptions : [{ unit: p.unit, label: unitLabelFor(p.unit) }],
  )
  // Default unit: on the full catalog prefer the largest selling unit (e.g.
  // Carton = highest per-unit price); elsewhere keep the product's primary unit.
  // Unchanged by the reorder — it scans every option rather than trusting order.
  const [selUnit, setSelUnit] = useState(() =>
    preferLargestUnit && options.length
      ? options.reduce((a, b) => ((b.price || 0) > (a.price || 0) ? b : a), options[0]).unit
      : options[0]?.unit,
  )
  const selected = options.find((o) => o.unit === selUnit) || options[0]

  // Derived pack info (consistent across every card via the shared helper).
  const conv = p.conversions || {}
  const pack = packSummary(conv)
  const stock = Number(p.stock) || 0

  // Image content shared by the linked (storefront) and non-linked media
  // wrappers, so the two branches can never visually drift.
  const mediaInner = (
    <ProductGallery
      images={p.images && p.images.length ? p.images : [p.image]}
      alt={p.name}
      size="sm"
      zoomSingle
      frameClassName="aspect-square overflow-hidden bg-sand-100"
    />
  )

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={reduce ? false : { opacity: 1, y: 0 }}
      transition={reduce ? undefined : spring}
      whileHover={reduce ? undefined : { y: -6 }}
      className="group flex flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft focus-within:ring-2 focus-within:ring-saffron-400/50"
    >
      {/* Media — clean, edge-to-edge image (fixed aspect ratio → no CLS). Links to
          the product page on the storefront; callers can disable that (admin) so a
          click never navigates away from an in-progress form. The video badge (when
          present) lives OUTSIDE the <Link> so it stays valid markup and its click
          opens the modal instead of navigating. */}
      <div className="relative">
        {linkToProduct ? (
          <Link
            to={`/product/${p.id}`}
            aria-label={p.name}
            className="relative block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-500"
          >
            {mediaInner}
          </Link>
        ) : (
          <div className="relative block">{mediaInner}</div>
        )}
        {video && (
          <ProductVideoBadge src={video.src} kind={video.kind} poster={video.poster || p.image} name={p.name} />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          {/* category tag — AA contrast (brand-700 on brand-50) */}
          <span className="w-fit min-w-0 truncate rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
            {p.category}
          </span>
          <StockBadge stock={stock} />
        </div>

        <div>
          {linkToProduct ? (
            <Link to={`/product/${p.id}`} className="block">
              <h3 className="line-clamp-2 text-sm font-bold leading-snug text-brand-950 transition-colors hover:text-brand-700">{p.name}</h3>
            </Link>
          ) : (
            <h3 className="line-clamp-2 text-sm font-bold leading-snug text-brand-950">{p.name}</h3>
          )}
          {/* Description always renders on a single clean line with ellipsis. */}
          <p className="mt-0.5 truncate text-xs text-brand-500" title={p.sub}>{(p.sub || '').replace(/\s*\\\s*/g, ' · ').replace(/\s+/g, ' ').trim()}</p>
        </div>

        {/* Consistent pack-size line — AA contrast, single source of truth. */}
        {pack && (
          <p className="flex items-start gap-1 text-[11px] font-medium leading-snug text-brand-600">
            <Package size={13} weight="bold" className="mt-0.5 shrink-0 text-brand-400" />
            <span>{pack}</span>
          </p>
        )}

        {/* MRP per piece — the only price shown (selling prices are hidden). */}
        <MrpPerPiece product={p} />

        {/* MOQ — minimum order for the selected unit */}
        <span className="w-fit rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700">
          Min order: 1 {selected.label}
        </span>

        <CardEnquiry p={p} options={options} selected={selected} onUnit={setSelUnit} />
      </div>
    </motion.article>
  )
}

// Memoized: re-renders only when its product prop changes.
export default memo(ProductCardBase)
