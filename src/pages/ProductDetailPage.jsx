import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Truck,
  ShieldCheck,
  Package,
  ListChecks,
  Gift,
} from '@phosphor-icons/react'
import { getProductById } from '../api/catalog'
import { catalogKeys } from '../api/cacheKeys'
import { getOffers } from '../api/offers'
import { useAsync } from '../hooks/useAsync'
import { ErrorState } from '../components/ui'
import ProductReviews from '../components/ProductReviews'
import RelatedProducts from '../components/RelatedProducts'
import EnquiryButton from '../components/EnquiryButton'
import MrpPerPiece from '../components/MrpPerPiece'
import ProductGallery from '../components/ProductGallery'
import { orderUnitOptions, unitLabelFor } from '../lib/cartEngine'

// Split admin text (newline / bullet separated) into clean bullet points.
function toBullets(text) {
  return String(text || '')
    .split(/\r?\n|•/)
    .map((s) => s.replace(/\s*\\\s*/g, ' / ').replace(/^[\s\-*]+/, '').trim())
    .filter(Boolean)
}

// Parse the short "unit info" string into one bullet per unit, e.g.
//   "24 Pcs \Box 36 Box \Carton"  ->  ["24 Pcs / Box", "36 Box / Carton"]
// Handles explicit separators (newline, bullet, comma, semicolon) and the
// run-together admin format where a new quantity follows a unit word.
function unitBullets(text) {
  const raw = String(text || '').replace(/\r/g, '').trim()
  if (!raw) return []
  let s = raw.replace(/[•;]/g, '\n').replace(/,(?=\s)/g, '\n')
  // Break before a fresh quantity that starts right after a unit word
  // ("...Box 36 Box..." -> "...Box\n36 Box...").
  s = s.replace(/([^\d\s\\/])\s+(?=\d)/g, '$1\n')
  return s
    .split(/\n+/)
    .map((x) => x.replace(/\s*\\\s*/g, ' / ').replace(/^[\s\-*,]+/, '').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean)
}

function Gallery({ images, name, overview = [] }) {
  return (
    <ProductGallery
      images={images}
      alt={name}
      size="lg"
      arrows="always"
      thumbnails
      priority
      className="lg:sticky lg:top-24"
      frameClassName="aspect-square overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft"
    >
      {/* Packaging badge — premium glass/dashed overlay pinned to the TOP-RIGHT
          of the image (~16px inset), on BOTH desktop and mobile. Compact so it
          never masks the product; the dark translucent glass + white text keeps
          it readable on any photo, and the padding/text scale down a touch on
          small screens. Values are dynamic; decorative → never blocks the image
          controls. */}
      {overview.length > 0 && (
        <div className="pointer-events-none absolute right-4 top-4 z-20 max-w-[60%] rounded-xl border border-dashed border-white/60 bg-brand-950/45 px-2.5 py-1.5 text-white shadow-soft backdrop-blur-md sm:rounded-2xl sm:px-3 sm:py-2">
          <ul className="space-y-0.5 sm:space-y-1">
            {overview.map((b, i) => (
              <li key={i} className="flex items-center gap-1.5 text-[10px] font-semibold leading-tight sm:text-xs">
                <span className="h-1 w-1 shrink-0 rounded-full bg-saffron-300 sm:h-1.5 sm:w-1.5" />
                <span className="whitespace-nowrap">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ProductGallery>
  )
}

function DetailSkeleton() {
  return (
    <div className="grid animate-pulse gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="aspect-square rounded-3xl bg-sand-200" />
      <div className="flex flex-col gap-4">
        <div className="h-4 w-24 rounded-full bg-sand-200" />
        <div className="h-9 w-3/4 rounded-xl bg-sand-200" />
        <div className="h-7 w-40 rounded-lg bg-sand-200" />
        <div className="mt-2 h-24 w-full rounded-2xl bg-sand-200" />
        <div className="mt-2 h-12 w-full rounded-full bg-sand-200" />
      </div>
    </div>
  )
}

export default function ProductDetailPage() {
  const { id } = useParams()
  // Cached so a shopper walking a category — product, Back, next product, Back —
  // pays for each product once, and so Back to the grid finds the list still there.
  const { data: p, loading, error, reload } = useAsync(() => getProductById(id), [id], {
    cacheKey: catalogKeys.product(id),
  })
  const { data: offers } = useAsync(() => getOffers(), [], { cacheKey: catalogKeys.offers() })

  // Every available unit type for this product (Piece / Box / Carton …), Carton
  // first. The reorder is display-only, but this page defaults to options[0] —
  // so it now opens on Carton, matching what the card that linked here showed.
  const options = orderUnitOptions(
    p && p.unitOptions && p.unitOptions.length
      ? p.unitOptions
      : (p ? [{ unit: p.unit, label: unitLabelFor(p.unit) }] : []),
  )

  // Active "buy X get Y free" offer for THIS product — shown as an info banner so
  // shoppers know the deal before enquiring on WhatsApp.
  const offer = useMemo(
    () => (offers || []).find((o) => o?.config?.isFreeOffer && (o.productIds || []).some((pid) => String(pid) === String(p?.id))) || null,
    [offers, p],
  )
  const oc = offer?.config || null

  // Selected unit. Default to the offer's unit (so the deal applies straight away)
  // otherwise the first available unit.
  const [selUnit, setSelUnit] = useState('')
  useEffect(() => {
    if (!options.length) return
    const match = oc?.mainUnit && options.find((o) => unitLabelFor(o.unit) === unitLabelFor(oc.mainUnit))
    setSelUnit((match || options[0]).unit)
  }, [p?.id, offer]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = options.find((o) => o.unit === selUnit) || options[0] || null
  const stock = Number(p?.stock) || 0
  const outOfStock = !!p && stock <= 0
  const shortBullets = p ? unitBullets(p.sub) : []
  const detailBullets = p ? toBullets(p.description) : []

  return (
    <section className="container-page pt-8 pb-28 sm:py-12 md:pb-12">
      <Link
        to="/products"
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-500 transition-colors hover:text-brand-800"
      >
        <ArrowLeft size={16} weight="bold" /> Back to Products
      </Link>

      {loading && <DetailSkeleton />}

      {!loading && error && <ErrorState message={error.message} onRetry={reload} />}

      {!loading && !error && !p && (
        <div className="rounded-3xl border border-brand-100 bg-white p-12 text-center shadow-soft">
          <Package size={40} weight="duotone" className="mx-auto text-brand-300" />
          <h1 className="mt-4 text-xl font-bold text-brand-900">Product nahi mila</h1>
          <p className="mt-1 text-sm text-brand-500">Shayad yeh product hata diya gaya hai.</p>
          <Link
            to="/products"
            className="mt-6 inline-flex rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-800"
          >
            Catalog dekhein
          </Link>
        </div>
      )}

      {!loading && !error && p && (
        <>
          {/* Main section */}
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
            {/* LEFT — gallery (with the packaging badge overlaid on the image) */}
            <Gallery images={p.images} name={p.name} overview={shortBullets} />

            {/* RIGHT — info */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col"
            >
              <div className="flex flex-wrap items-center gap-3">
                {p.category && (
                  <Link
                    to={`/products?cat=${p.categoryId}`}
                    state={{ scrollToGrid: true }}
                    className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-600 transition-colors hover:bg-brand-100"
                  >
                    {p.category}
                  </Link>
                )}
                {p.stock > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
                    <Check size={13} weight="bold" /> Stock mein
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-red-500">Stock khatam</span>
                )}
              </div>

              <h1 className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-tight text-brand-950 sm:text-3xl md:text-4xl">
                {p.name}
              </h1>

              {/* MRP per piece — the only price shown (selling prices are hidden). */}
              <MrpPerPiece product={p} className="mt-4 text-base" />

              {/* Product Overview — premium card directly below the per-piece price.
                  Renders the product's per-unit packaging info as clean bullets (or a
                  single tidy paragraph when there's just one point). All values are
                  dynamic (from the product data) — nothing is hardcoded. */}
              {shortBullets.length > 0 && (
                <div className="mt-6 rounded-3xl border border-brand-100 bg-gradient-to-b from-sand-50 to-white p-5 shadow-soft sm:p-6">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-700 text-white">
                      <ListChecks size={16} weight="bold" />
                    </span>
                    <h2 className="font-display text-[15px] font-extrabold tracking-tight text-brand-950">
                      Product Overview
                    </h2>
                  </div>

                  {shortBullets.length === 1 ? (
                    <p className="mt-4 text-[15px] leading-relaxed text-brand-700">{shortBullets[0]}</p>
                  ) : (
                    <ul className="mt-4 flex flex-col gap-3">
                      {shortBullets.map((b, i) => (
                        <li key={i} className="flex items-start gap-3 text-[15px] leading-relaxed text-brand-700">
                          <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                            <Check size={12} weight="bold" />
                          </span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Enquiry panel — unit selection + WhatsApp enquiry (prices are shared
                  over WhatsApp). */}
              <div className="mt-7 rounded-3xl border border-brand-100 bg-white p-4 shadow-soft sm:p-5">
                {/* Unit type selection */}
                {options.length > 1 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-400">Unit chunein</p>
                    <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {options.map((o) => {
                        const active = selected && o.unit === selected.unit
                        return (
                          <button
                            key={o.unit}
                            type="button"
                            onClick={() => setSelUnit(o.unit)}
                            className={`rounded-2xl border px-3 py-2.5 text-center transition-all active:scale-[0.97] ${
                              active ? 'border-brand-700 bg-brand-50 ring-1 ring-brand-200' : 'border-brand-200 bg-white hover:border-brand-300'
                            }`}
                          >
                            <span className={`block text-sm font-bold ${active ? 'text-brand-900' : 'text-brand-700'}`}>{o.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Active offer — buy X get Y free (informational) */}
                {offer && oc && (
                  <div className={`${options.length > 1 ? 'mt-4' : ''} rounded-2xl border border-green-200 bg-green-50/70 p-3.5`}>
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-green-600 text-white"><Gift size={18} weight="fill" /></span>
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-green-800">
                          {oc.buyQty} {unitLabelFor(oc.mainUnit)} khareedein — {oc.freeQty} {unitLabelFor(oc.freeUnit)} {offer.freeProduct?.name || 'isi product'} FREE
                        </p>
                        <p className="mt-0.5 text-xs text-green-700">Tafseel ke liye WhatsApp par poochein.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Selected unit + WhatsApp enquiry */}
                <div className={options.length > 1 || (offer && oc) ? 'mt-4 border-t border-brand-100 pt-4' : ''}>
                  {selected && (
                    <p className="mb-3 flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-brand-500">Selected unit</span>
                      <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-900">{selected.label}</span>
                    </p>
                  )}
                  {outOfStock ? (
                    <div className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-full bg-brand-300 px-6 py-3.5 text-sm font-bold text-white">
                      Out of Stock
                    </div>
                  ) : (
                    <EnquiryButton name={p.name} unit={selected ? selected.label : p.unit} size="lg" label="Order on WhatsApp" />
                  )}
                  <p className="mt-2 text-center text-[11px] text-brand-400">Rate aur availability WhatsApp par foran mil jayegi.</p>
                </div>
              </div>

              {/* Trust strip */}
              <div className="mt-7 grid grid-cols-1 gap-3 rounded-2xl border border-brand-100 bg-white/60 p-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <Truck size={18} weight="fill" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-brand-900">Agle din delivery</p>
                    <p className="text-xs text-brand-500">40+ shehron mein</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <ShieldCheck size={18} weight="fill" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-brand-900">Asli maal guarantee</p>
                    <p className="text-xs text-brand-500">100% original</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Detailed description section */}
          {detailBullets.length > 0 && (
            <div className="mt-12 sm:mt-16">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-white">
                  <ListChecks size={18} weight="bold" />
                </span>
                <h2 className="font-display text-xl font-extrabold tracking-tight text-brand-950 sm:text-2xl">
                  Tafseeli maloomat
                </h2>
              </div>

              <div className="mt-5 rounded-3xl border border-brand-100 bg-white p-5 shadow-soft sm:p-7">
                <ul className="grid gap-3.5 sm:grid-cols-2">
                  {detailBullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-brand-700">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-saffron-100 text-saffron-700">
                        <Check size={12} weight="bold" />
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Related products — same category first, topped up with random picks
              from other categories. Reuses the Products-page card as-is. */}
          <RelatedProducts product={p} />

          {/* Reviews & ratings — placed after Related Products so shoppers see
              more of the catalog first, then social proof. */}
          <ProductReviews productId={p.id} />

          {/* Sticky mobile enquiry bar — native app pattern, always in reach.
              Sits above the bottom nav and respects the home-bar safe area. */}
          {selected && (
            <div
              data-fixed-chrome
              className="fixed inset-x-0 z-30 px-3 md:hidden"
              // --sab is the frozen, measured home-bar inset (lib/viewport.js).
              // With raw env() this bar sat 34px higher or lower depending on
              // whether Safari's toolbar happened to be collapsed, so it drifted
              // over the bottom nav mid-scroll instead of resting above it.
              style={{ bottom: 'calc(3.75rem + var(--sab))' }}
            >
              <div className="flex items-center gap-3 rounded-2xl bg-white p-2 pl-4 shadow-lift ring-1 ring-brand-100">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-brand-400">{p.name}</p>
                  <p className="font-display text-sm font-extrabold leading-tight tracking-tight text-brand-900">
                    {selected.label}
                  </p>
                </div>
                {outOfStock ? (
                  <span className="inline-flex min-h-[48px] shrink-0 cursor-not-allowed items-center rounded-xl bg-brand-300 px-5 text-sm font-bold text-white">Out of Stock</span>
                ) : (
                  <EnquiryButton name={p.name} unit={selected.label} size="md" full={false} label="Order on WhatsApp" className="min-h-[48px]" />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
