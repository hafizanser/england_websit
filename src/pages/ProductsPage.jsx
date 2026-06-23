import { Link, useSearchParams } from 'react-router-dom'
import { X, Package, Stack, SquaresFour, Truck, ArrowRight, WhatsappLogo, Tag } from '@phosphor-icons/react'
import PageBanner from '../components/PageBanner'
import OffersSection from '../components/OffersSection'
import ProductCard from '../components/ProductCard'
import { ProductSkeleton, ErrorState, EmptyState } from '../components/ui'
import { getProducts, getCategories } from '../api/catalog'
import { useAsync } from '../hooks/useAsync'
import { useCart } from '../context/CartContext'
import { money } from '../lib/cartEngine'
import { waLink } from '../lib/whatsapp'

// Build an itemized WhatsApp order message from the live cart.
function buildOrderMsg(items, totals) {
  if (!items.length) return 'Assalam o alaikum! Main England se order dena chahta hoon.'
  const lines = items.map((i) => `• ${i.name} — ${i.qty} ${i.unit} (${money(i.lineTotal)})`)
  return `Assalam o alaikum! England se mera order:\n\n${lines.join('\n')}\n\nTotal: ${money(totals.total)}`
}

// Sticky bottom cart bar (mobile only) — sits above the bottom nav, respects the
// safe-area inset. Isolated component so it owns its cart subscription.
function MobileCartBar() {
  const { items, totals, count } = useCart()
  if (count === 0) return null
  return (
    <div
      className="fixed inset-x-0 z-30 px-3 md:hidden"
      style={{ bottom: 'calc(3.75rem + env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-stretch gap-2 rounded-full bg-brand-900 p-1.5 shadow-lift">
        <Link
          to="/cart"
          aria-live="polite"
          className="flex min-h-[48px] flex-1 flex-col justify-center rounded-full px-4 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-400"
        >
          <span className="text-[11px] font-semibold text-white/70">Cart ({count})</span>
          <span className="text-sm font-extrabold leading-tight">{money(totals.total)}</span>
        </Link>
        <a
          href={waLink(buildOrderMsg(items, totals))}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[48px] items-center gap-1.5 rounded-full bg-[#25D366] px-5 text-sm font-bold text-white transition-colors hover:bg-[#1ebe5d] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <WhatsappLogo size={18} weight="fill" /> Order bhejein <ArrowRight size={15} weight="bold" />
        </a>
      </div>
    </div>
  )
}

export default function ProductsPage() {
  const [params, setParams] = useSearchParams()
  // Accept both ?cat= (internal convention) and ?category= (external/deep links).
  const cat = params.get('cat') || params.get('category') || 'all'
  // Search term comes straight from the URL (?q=) — the navbar search drives it,
  // and the chip in the results header lets you clear it.
  const qParam = (params.get('q') || '').trim()

  const { data, loading, error, reload } = useAsync(
    () => getProducts({ cat, q: qParam, sort: 'popular' }),
    [cat, qParam],
  )

  // Categories come from the dashboard catalogue (same source as products).
  const { data: cats } = useAsync(() => getCategories(), [])
  const categoryList = cats || []

  const setCat = (next) => {
    const p = new URLSearchParams(params)
    if (next === 'all') p.delete('cat')
    else p.set('cat', next)
    setParams(p, { replace: true })
  }

  const clearSearch = () => {
    const p = new URLSearchParams(params)
    p.delete('q')
    setParams(p, { replace: true })
  }

  const resetFilters = () => {
    const p = new URLSearchParams(params)
    p.delete('q')
    p.delete('cat')
    setParams(p, { replace: true })
  }

  const activeCat = categoryList.find((c) => String(c.id) === String(cat))

  // Smooth-scroll to the on-page Offers section (hash-router safe — no href change).
  const scrollToOffers = () => {
    document.getElementById('offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <PageBanner
        eyebrow="Poora Catalog"
        title="Saare"
        accent="products"
        urdu="ہر ضرورت کا تھوک مال"
        desc="Tissue se agarbatti tak — sab thok rate par. Category chunein, search karein, aur seedha cart mein daalein."
        hideCrumb
        image="/banner.jpg"
        tone="brand"
        chips={[
          { icon: Stack, label: `${data?.length ? data.length + '+' : '320+'} products` },
          { icon: SquaresFour, label: `${categoryList.length || 10} Categories` },
          { icon: Truck, label: 'Agle din delivery' },
        ]}
      >
        <Link
          to="/offers"
          className="inline-flex items-center gap-2 rounded-full bg-saffron-400 px-5 py-3 text-sm font-bold text-brand-950 shadow-glow transition-all hover:bg-saffron-300 active:translate-y-px"
        >
          Aaj ki offers dekhein <ArrowRight size={16} weight="bold" />
        </Link>
      </PageBanner>

      {/* sticky filter bar — offset includes the notch inset so it aligns under
          the sticky header on phones with a safe-area top */}
      <div className="sticky top-[calc(92px+env(safe-area-inset-top))] z-30 border-b border-brand-100 bg-sand-50/90 backdrop-blur-lg">
        <div className="container-page py-4">
          {/* category pills — horizontal scroll, no wrap, no page overflow */}
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            <CatPill active={cat === 'all'} onClick={() => setCat('all')} label="All" />
            {categoryList.map((c) => (
              <CatPill key={c.id} active={String(cat) === String(c.id)} onClick={() => setCat(c.id)} label={c.name} />
            ))}
          </div>
        </div>
      </div>

      {/* results */}
      <section className="container-page py-10 sm:py-14">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-brand-600" aria-live="polite">
            {loading ? (
              'Load ho raha hai...'
            ) : (
              <>
                <span className="font-bold text-brand-900">{data?.length || 0}</span> products
                {activeCat ? ` — ${activeCat.name}` : ''}
              </>
            )}
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {qParam && (
              <button
                type="button"
                onClick={clearSearch}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:border-brand-300"
              >
                <span className="text-brand-500">Search:</span> "{qParam}"
                <X size={13} weight="bold" className="text-brand-400" />
              </button>
            )}
            <button
              type="button"
              onClick={scrollToOffers}
              className="inline-flex items-center gap-1.5 rounded-full border border-saffron-300 bg-saffron-50 px-4 py-2 text-sm font-bold text-saffron-800 transition-all hover:border-saffron-400 hover:bg-saffron-100 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-500"
            >
              <Tag size={15} weight="bold" /> Offers
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-5 min-[760px]:grid-cols-3 min-[1100px]:grid-cols-4">
          {loading && Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)}

          {!loading && error && (
            <ErrorState message="Maal load nahi hua — dobara try karein." onRetry={reload} />
          )}

          {!loading &&
            !error &&
            data?.map((p) => <ProductCard key={p.id} p={p} preferLargestUnit />)}

          {!loading && !error && data?.length === 0 && (
            <EmptyState
              icon={Package}
              title="Is category mein abhi maal nahi"
              text="Doosri category dekhein ya WhatsApp pe poochein."
              action={
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-800 active:translate-y-px"
                  >
                    Filter saaf karein
                  </button>
                  <a
                    href={waLink(
                      `Assalam o alaikum! ${activeCat ? activeCat.name + ' ' : ''}stock ke baare mein maloomat chahiye.`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1ebe5d] active:translate-y-px"
                  >
                    <WhatsappLogo size={18} weight="fill" /> WhatsApp pe poochein
                  </a>
                </div>
              }
            />
          )}
        </div>
      </section>

      {/* Offers — same section as the homepage (reused component). Wrapped in
          `.eng` so the theme-scoped offer styles apply on this Tailwind page. */}
      <div className="eng">
        <OffersSection />
      </div>

      <MobileCartBar />
    </>
  )
}

function CatPill({ active, onClick, label }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-[40px] shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-500 active:scale-95 sm:text-sm ${
        active
          ? 'bg-brand-700 text-white shadow-soft'
          : 'border border-brand-200 bg-white text-brand-700 hover:border-brand-300'
      }`}
    >
      {label}
    </button>
  )
}
