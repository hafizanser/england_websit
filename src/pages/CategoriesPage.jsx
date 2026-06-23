import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  SquaresFour,
  MagnifyingGlass,
  WhatsappLogo,
  Phone,
  BellRinging,
  X,
} from '@phosphor-icons/react'
import PageBanner from '../components/PageBanner'
import { getCategories } from '../api/catalog'
import { useAsync } from '../hooks/useAsync'
import { ErrorState, EmptyState } from '../components/ui'
import { fadeUp, stagger } from '../lib/motion'
import { brand } from '../data/site'
import { waLink } from '../lib/whatsapp'

const MotionLink = motion(Link)

// Plural-safe item count: "1 item" / "0 items" / "12 items".
const countLabel = (n) => `${n} ${n === 1 ? 'item' : 'items'}`

// Quick filter chips. Categories are bucketed by id; any category not listed
// here still appears under "Sab" so nothing is ever hidden by accident.
const GROUPS = [
  { key: 'all', label: 'Sab' },
  { key: 'personal', label: 'Personal care', ids: ['shampoo', 'soap', 'razors', 'haircare', 'hellodr'] },
  { key: 'ghar', label: 'Ghar', ids: ['tissues', 'mosquito', 'agarbati'] },
  { key: 'health', label: 'Health', ids: ['ispaghol', 'babycare'] },
]

// Branded fallback tile — used only when a category has no admin-uploaded image.
function Fallback({ name }) {
  return (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-brand-100 to-sand-200">
      <span className="font-display text-4xl font-extrabold text-brand-400">
        {(name || '?').trim().charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

function CategoryCard({ cat, active, reduce }) {
  // A 0-count category is "coming soon": instead of a dead-end products link it
  // opens a prefilled WhatsApp notify message.
  const comingSoon = cat.items === 0
  const hasCount = cat.items != null

  const notifyMsg = `${cat.name} ka stock aate hi mujhe batayein please.`

  // Shared visual classes for both the internal Link and the WhatsApp anchor.
  const baseClass = `group relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-soft transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-saffron-500 focus-visible:ring-offset-2 focus-visible:ring-offset-sand-50 ${
    active
      ? 'border-2 border-saffron-400 shadow-lift ring-2 ring-saffron-200'
      : 'border border-brand-100'
  }`

  // Motion props are stripped entirely when the user prefers reduced motion —
  // only opacity/transform are ever animated, never layout.
  const motionProps = reduce
    ? {}
    : {
        variants: fadeUp,
        whileHover: { y: -6 },
        transition: { type: 'spring', stiffness: 220, damping: 18 },
      }

  const thumb = (
    <div className="relative aspect-[1/0.9] overflow-hidden bg-sand-100">
      {cat.image ? (
        <img
          src={cat.image}
          alt={cat.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        />
      ) : (
        <Fallback name={cat.name} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-brand-950/70 via-brand-950/10 to-transparent" />

      {/* Count / status badge */}
      {active ? (
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-saffron-400 px-2.5 py-1 text-[11px] font-extrabold text-brand-950 shadow-soft">
          <Check size={12} weight="bold" /> Selected
        </span>
      ) : comingSoon ? (
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-saffron-400 px-2.5 py-1 text-[11px] font-extrabold text-brand-950 shadow-soft">
          <BellRinging size={12} weight="fill" /> Jald aa raha hai
        </span>
      ) : hasCount ? (
        // Dark text on solid white — WCAG AA contrast on the photo.
        <span className="absolute right-3 top-3 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-brand-800 shadow-soft">
          {countLabel(cat.items)}
        </span>
      ) : null}

      {cat.urdu && (
        <span className="absolute bottom-3 left-3 right-3">
          <span className="urdu block text-right text-sm text-white/90" dir="rtl">
            {cat.urdu}
          </span>
        </span>
      )}
    </div>
  )

  // Footer CTA — a label (not arrow-only) so the affordance reads clearly.
  const footer = (
    <div className="flex items-center justify-between gap-2 p-3.5">
      <span className="min-w-0 flex-1 truncate text-sm font-bold leading-tight text-brand-900">
        {cat.name}
      </span>
      {comingSoon ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-[#0e8a47]">
          Mujhe batayein
          <WhatsappLogo size={15} weight="fill" />
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-brand-600 transition-colors group-hover:text-saffron-700">
          Products dekhein
          <ArrowRight size={15} weight="bold" />
        </span>
      )}
    </div>
  )

  // Coming-soon → external WhatsApp notify; otherwise → internal products route.
  if (comingSoon) {
    return (
      <motion.a
        href={waLink(notifyMsg)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${cat.name} abhi available nahi — WhatsApp par stock ki ittela maangein`}
        className={baseClass}
        {...motionProps}
      >
        {thumb}
        {footer}
      </motion.a>
    )
  }

  return (
    <MotionLink
      to={`/products?cat=${cat.id}`}
      aria-current={active ? 'true' : undefined}
      aria-label={`${cat.name} category dekhein${hasCount ? ` (${countLabel(cat.items)})` : ''}`}
      className={baseClass}
      {...motionProps}
    >
      {thumb}
      {footer}
    </MotionLink>
  )
}

function CategorySkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft">
      <div className="relative aspect-[1/0.9] overflow-hidden bg-sand-100">
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      </div>
      <div className="flex items-center justify-between p-3.5">
        <div className="h-3.5 w-2/3 rounded-full bg-sand-200" />
        <div className="h-3.5 w-24 rounded-full bg-sand-200" />
      </div>
    </div>
  )
}

// Grid columns: 2 (mobile) → 3 (≥760px) → 5 (≥1100px). Arbitrary screen
// variants keep it independent of the default breakpoint scale.
const GRID_CLASS =
  'grid grid-cols-2 gap-3 min-[760px]:grid-cols-3 sm:gap-4 min-[1100px]:grid-cols-5'

export default function CategoriesPage() {
  const [params] = useSearchParams()
  const activeCat = params.get('cat')
  const reduce = useReducedMotion()

  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('all')

  // Categories come ONLY from the admin catalogue API (single source of truth).
  const { data, loading, error, reload } = useAsync(() => getCategories(), [])
  const list = data || []

  // Client-side filter: by name (case-insensitive) + active quick-filter group.
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const activeGroup = GROUPS.find((g) => g.key === group)
    return list.filter((cat) => {
      const matchesText = !needle || (cat.name || '').toLowerCase().includes(needle)
      const matchesGroup =
        !activeGroup || activeGroup.key === 'all' || activeGroup.ids?.includes(cat.id)
      return matchesText && matchesGroup
    })
  }, [list, query, group])

  const showGrid = !loading && !error && list.length > 0
  const noMatches = showGrid && filtered.length === 0

  // Prefilled order message for the conversion CTAs.
  const orderMsg =
    'Assalam o alaikum! Main England se order dena chahta hoon. Meri list ye hai:\n\n'
  const phoneHref = `tel:${brand.phone.replace(/\s+/g, '')}`

  return (
    <>
      <PageBanner
        eyebrow="Saara Catalog"
        title="Categories,"
        accent="har dukaan ka saaman"
        urdu="ہر دکان کا پورا سامان"
        desc="Tissue se le kar agarbatti, razor, hair color aur soap tak — sab kuch ek hi catalog mein."
        hideCrumb
        image="/banner.jpg"
        tone="brand"
        chips={[{ icon: SquaresFour, label: list.length ? `${list.length} Categories` : 'Saari categories' }]}
      />

      {/* Always-visible search — the nav search is hidden on phones, so this is
          the primary way mobile users filter the catalogue. */}
      {showGrid && (
        <div className="container-page mt-5 sm:mt-7">
          <label className="flex items-center gap-2.5 rounded-full border border-brand-100 bg-white px-4 py-3 shadow-soft focus-within:border-saffron-400">
            <MagnifyingGlass size={18} weight="bold" className="shrink-0 text-brand-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Category dhondein… (misaal: tissue, soap)"
              aria-label="Category dhondein"
              className="w-full min-w-0 bg-transparent text-sm text-brand-800 outline-none placeholder:text-brand-400"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Search saaf karein"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-brand-400 hover:bg-brand-50 hover:text-brand-700"
              >
                <X size={14} weight="bold" />
              </button>
            )}
          </label>

          {/* Quick group chips */}
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {GROUPS.map((g) => {
              const on = group === g.key
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setGroup(g.key)}
                  aria-pressed={on}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                    on
                      ? 'bg-brand-700 text-white shadow-soft'
                      : 'border border-brand-100 bg-white text-brand-600 hover:border-saffron-300 hover:text-saffron-700'
                  }`}
                >
                  {g.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <section className="container-page py-8 sm:py-12">
      {/* Loading skeletons */}
      {loading && (
        <div className={`mt-2 ${GRID_CLASS}`}>
          {Array.from({ length: 10 }).map((_, i) => (
            <CategorySkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="mt-2 grid grid-cols-1">
          <ErrorState message={error.message} onRetry={reload} />
        </div>
      )}

      {/* Empty (no categories at all) */}
      {!loading && !error && list.length === 0 && (
        <div className="mt-2 grid grid-cols-1">
          <EmptyState
            icon={SquaresFour}
            title="No categories available"
            text="Admin panel se categories add karein — yahan khud-ba-khud show hongi."
          />
        </div>
      )}

      {/* No search/filter matches */}
      {noMatches && (
        <EmptyState
          icon={MagnifyingGlass}
          title="Kuch nahi mila"
          text={`"${query || GROUPS.find((g) => g.key === group)?.label}" ke liye koi category nahi mili. Doosra naam try karein.`}
          action={
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setGroup('all')
              }}
              className="mt-5 rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-800 active:translate-y-px"
            >
              Sab dikhayein
            </button>
          }
        />
      )}

      {/* Category grid — animate on mount (cascades to async-loaded cards) */}
      {showGrid && !noMatches && (
        <motion.div
          key={`${query}-${group}`}
          variants={reduce ? undefined : stagger(0.06)}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'show'}
          className={GRID_CLASS}
        >
          {filtered.map((cat) => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              active={String(activeCat) === String(cat.id)}
              reduce={reduce}
            />
          ))}
        </motion.div>
      )}
      </section>

      {/* Conversion band — bulk order via WhatsApp / call */}
      {showGrid && (
        <section className="container-page pb-12 sm:pb-16">
          <div className="relative overflow-hidden rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-900 to-brand-700 p-6 shadow-lift sm:p-10">
            <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-saffron-300/20 blur-3xl" />
            <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <h2 className="text-balance text-xl font-black leading-tight text-white sm:text-3xl">
                  List ready hai? Saara order ek WhatsApp pe bhejein
                </h2>
                <p className="urdu mt-2 text-sm text-white/80 sm:text-base" dir="rtl">
                  پوری لسٹ واٹس ایپ پر بھیجیں — ہم باقی سنبھال لیں گے
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <a
                  href={waLink(orderMsg)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-[#1ebe5d] active:translate-y-px"
                >
                  <WhatsappLogo size={20} weight="fill" /> WhatsApp pe order
                </a>
                <a
                  href={phoneHref}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition-all hover:bg-white/20 active:translate-y-px"
                >
                  <Phone size={18} weight="fill" /> Call: {brand.phone}
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Sticky mobile order bar — sits just above the bottom nav, respecting the
          safe-area inset. Hidden on desktop where the floating button covers it. */}
      {showGrid && (
        <div
          className="fixed inset-x-0 z-30 px-3 md:hidden"
          style={{ bottom: 'calc(3.75rem + env(safe-area-inset-bottom))' }}
        >
          <a
            href={waLink(orderMsg)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-bold text-white shadow-lift active:translate-y-px"
          >
            <WhatsappLogo size={20} weight="fill" /> WhatsApp pe order bhejein
          </a>
        </div>
      )}
    </>
  )
}
