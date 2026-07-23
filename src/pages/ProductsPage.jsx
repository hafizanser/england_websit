import { useEffect, useLayoutEffect, useRef } from 'react'
import { Link, useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import { X, Package, Stack, SquaresFour, Truck, ArrowRight, WhatsappLogo, Tag } from '@phosphor-icons/react'
import PageBanner from '../components/PageBanner'
import OffersSection from '../components/OffersSection'
import ProductCard from '../components/ProductCard'
import { ProductSkeleton, ErrorState, EmptyState } from '../components/ui'
import { getProducts, getCategories } from '../api/catalog'
import { useAsync } from '../hooks/useAsync'
import { waLink } from '../lib/whatsapp'
import { scrollSectionUnderHeader } from '../lib/scroll'

export default function ProductsPage() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
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
    // If this view was opened by a search from another page and found nothing,
    // send the user back where they came from — restoring that page's state and
    // scroll via a real history pop (no reload). Clearing ?q also empties the
    // navbar search box (it syncs to the URL's ?q).
    const origin = location.state?.searchOrigin
    if (qParam && origin && origin !== location.pathname + location.search) {
      navigate(-1)
      return
    }
    // Otherwise (direct/shared link, or a category-only empty state) clear the
    // filters in place.
    const p = new URLSearchParams(params)
    p.delete('q')
    p.delete('cat')
    setParams(p, { replace: true })
  }

  // Empty search (e.g. "lotyn") from the navbar: bounce back automatically so the
  // mobile search drawer / origin page is restored instead of parking on an empty
  // results view. Manual "Filter saaf karein" still covers the same path for
  // deep-links without searchOrigin, and for category-only empties.
  const bouncedEmptySearch = useRef(false)
  useEffect(() => {
    bouncedEmptySearch.current = false
  }, [qParam, location.key])
  useEffect(() => {
    if (loading || error) return
    if (!qParam || data == null || data.length > 0) return
    const origin = location.state?.searchOrigin
    if (!origin || origin === location.pathname + location.search) return
    if (bouncedEmptySearch.current) return
    bouncedEmptySearch.current = true
    navigate(-1)
  }, [loading, error, data, qParam, location.state, location.pathname, location.search, navigate])

  const activeCat = categoryList.find((c) => String(c.id) === String(cat))

  // Smooth-scroll to the on-page Offers section (hash-router safe — no href change).
  const scrollToOffers = () => {
    document.getElementById('offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Deep-links that ask for a category (the footer's category links, the category
  // cards) should land on the FILTER BAR — its top edge flush under the header, so
  // the banner above it is scrolled completely out of sight and the pills + the
  // filtered grid are the first things you see.
  //
  // Deliberately NOT waiting for /products or /categories. Waiting looks like the
  // obvious safe choice and is exactly what produced the bug it was meant to
  // prevent: the page sat parked on the banner for the whole fetch, THEN scrolled.
  // It also buys nothing, because the only thing between the top of the page and
  // this target is the banner — static content, laid out on the first paint. The
  // pills and the grid live BELOW the target line, so their arrival changes the
  // bar's height and the grid's contents but never the bar's top edge, which is the
  // number we scroll to. Late reflow above the target (the banner's product-count
  // chip) is absorbed by scrollSectionUnderHeader, which re-derives its target every
  // frame and holds it through a settle pass.
  //
  // These are LAYOUT effects, not passive ones, and that is the whole trick for the
  // first click. Arriving from another route, this runs before the browser has
  // painted, so the very first frame of the page is already at the filter bar —
  // there is no moment at which the top or the banner is on screen to jump away
  // from. A passive effect would paint the top first and then scroll, which is the
  // glitch. Runs once per navigation.
  const filterAnchorRef = useRef(null)
  const didScrollRef = useRef(false)
  const arrivedRef = useRef(false)
  const wantsGrid = Boolean(location.state?.scrollToGrid)

  // Must also be a layout effect, and declared first: layout effects all run before
  // any passive effect, so a passive reset here would clear the guard only AFTER
  // the landing below had already skipped itself.
  useLayoutEffect(() => {
    didScrollRef.current = false // a new navigation may request the scroll again
  }, [location.key])

  useLayoutEffect(() => {
    if (!wantsGrid || didScrollRef.current || !filterAnchorRef.current) return
    didScrollRef.current = true
    // Landing from another route (this component just mounted — Layout keys its
    // wrapper on pathname) means nothing is on screen yet, so place the page
    // instantly: a glide would have to start somewhere, and the only place to start
    // is the top, which is the jump we are removing. Changing category while
    // already here is the opposite: the page IS on screen, so a glide reads as a
    // deliberate move instead of a teleport.
    const justArrived = !arrivedRef.current
    arrivedRef.current = true
    scrollSectionUnderHeader(filterAnchorRef.current, { smooth: !justArrived })
  }, [wantsGrid, location.key])

  return (
    <>
      <PageBanner
        eyebrow="Poora Catalog"
        title="Saare"
        accent="products"
        urdu="ہر ضرورت کا تھوک مال"
        desc="Tissue se agarbatti tak — sab thok rate par. Category chunein, search karein, aur WhatsApp par rate poochein."
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

      {/* Zero-height sentinel in normal flow, immediately above the sticky bar.
          It is what the landing scroll aims at: the bar itself is unmeasurable
          while pinned (both its rect AND its offsetTop report the pinned spot, so
          scrolling toward it chases its own tail and overshoots). The sentinel
          never moves, so it gives the bar's true resting position. */}
      <div ref={filterAnchorRef} aria-hidden className="h-0" />

      {/* sticky filter bar — parks flush under the header via the height the
          navbar measures and publishes. Do NOT add env(safe-area-inset-top) here:
          the marquee already pads the notch inset, so --header-h includes it. */}
      <div className="sticky top-[var(--header-h)] z-30 border-b border-brand-100 bg-sand-50/90 backdrop-blur-lg">
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
      <section id="products-grid" className="container-page py-10 sm:py-14">
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
            <ErrorState
              message={error?.message || 'Maal load nahi hua — dobara try karein.'}
              onRetry={reload}
            />
          )}

          {!loading &&
            !error &&
            data?.map((p) => <ProductCard key={p.id} p={p} preferLargestUnit showVideo={false} />)}

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
                    <WhatsappLogo size={18} weight="fill" className="shrink-0" /> Order on WhatsApp
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
