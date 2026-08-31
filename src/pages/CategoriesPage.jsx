import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowClockwise,
  ArrowRight,
  Check,
  CloudSlash,
  SquaresFour,
  MagnifyingGlass,
  WhatsappLogo,
  Phone,
  BellRinging,
  X,
} from '@phosphor-icons/react'
import PageBanner from '../components/PageBanner'
import { getCategories } from '../api/catalog'
import { catalogKeys } from '../api/cacheKeys'
import { useAsync } from '../hooks/useAsync'
import { fadeUp, stagger } from '../lib/motion'
import { brand } from '../data/site'
import { waLink } from '../lib/whatsapp'
import { onImgError } from '../lib/img'

const MotionLink = motion(Link)

// Plural-safe item count: "1 item" / "0 items" / "12 items".
const countLabel = (n) => `${n} ${n === 1 ? 'item' : 'items'}`

// Quick filter chips are built AT RUNTIME from the admin categories API:
//   [ All, ...every category ]
// The old hardcoded buckets (Personal care / Ghar / Health) grouped by slug ids
// ('shampoo', 'tissues', …) which never match the real numeric category ids from
// the database, so those filters silently matched nothing. Building the chips from
// the API means categories added in the Admin panel appear here automatically with
// no code change.
const ALL_KEY = 'all'
const buildGroups = (list) => [
  { key: ALL_KEY, label: 'All' },
  ...list.map((c) => ({ key: String(c.id), label: c.name })),
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
          decoding="async"
          onError={onImgError}
          className="img-placeholder-bg h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
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
      state={{ scrollToGrid: true }}
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

// One light sweep across a placeholder. It spans the WHOLE card rather than
// only the thumbnail, so the highlight travels the card in a single pass
// instead of stopping at the footer.
function Shimmer({ delay = 0 }) {
  return (
    <span
      aria-hidden="true"
      style={{ animationDelay: `${delay}ms` }}
      className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent"
    />
  )
}

// Built to the same box as CategoryCard — identical radius, border, aspect
// ratio and footer padding — so the grid does not resize by a single pixel
// when the real cards replace it.
function CategorySkeleton({ index = 0 }) {
  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft"
    >
      <div className="relative aspect-[1/0.9] bg-sand-100">
        {/* Stands in for the count badge, so the thumb's visual weight matches. */}
        <span className="absolute right-3 top-3 h-[22px] w-16 rounded-full bg-white/70" />
      </div>
      <div className="flex items-center justify-between gap-2 p-3.5">
        <span className="h-3.5 w-1/2 rounded-full bg-sand-200" />
        <span className="h-3.5 w-20 rounded-full bg-sand-100" />
      </div>
      {/* Offset per card so the grid ripples rather than flashing in unison. */}
      <Shimmer delay={(index % 5) * 130} />
    </div>
  )
}

function ChipSkeleton({ width, delay = 0 }) {
  return (
    <span
      aria-hidden="true"
      className={`relative shrink-0 overflow-hidden rounded-full border border-brand-100 bg-white ${width} h-[34px]`}
    >
      <Shimmer delay={delay} />
    </span>
  )
}

// Widths vary so the row reads as words rather than as a row of identical bars.
const CHIP_SKELETON_WIDTHS = ['w-14', 'w-24', 'w-20', 'w-28', 'w-16', 'w-24']

// Shown only once the request has genuinely failed — a transient blip is
// retried behind the skeletons and never reaches this. Deliberately quiet: a
// hairline card in the page's own surface colour with a ghost button, not an
// alarm panel that makes a hiccup look like a broken shop.
function LoadFailed({ error, onRetry, retrying }) {
  // The API's own messages name ports and servers, which is right for the admin
  // panel and wrong for a shopkeeper. Translate the two the customer can
  // actually act on and keep the rest generic.
  const message =
    error?.code === 'NETWORK' || error?.code === 'TIMEOUT'
      ? 'Internet ya server se rabta nahi ho raha. Thodi der baad dobara koshish karein.'
      : 'Categories abhi mangwai nahi ja sakeen. Aap dobara koshish kar sakte hain.'

  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-brand-100 bg-white px-6 py-12 text-center shadow-soft sm:flex-row sm:justify-center sm:gap-6 sm:py-10 sm:text-left">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sand-100 text-brand-400">
        <CloudSlash size={24} weight="duotone" />
      </span>

      <div className="min-w-0">
        <p className="text-[15px] font-bold text-brand-900">Categories load nahi ho sakeen</p>
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-brand-500">{message}</p>
      </div>

      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border border-brand-200 bg-white px-5 text-[13px] font-semibold text-brand-700 transition-colors hover:border-saffron-300 hover:text-saffron-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ArrowClockwise size={15} weight="bold" className={retrying ? 'animate-spin-slow' : ''} />
        {retrying ? 'Koshish ho rahi hai…' : 'Try again'}
      </button>
    </div>
  )
}

// The catalogue is genuinely empty — nothing failed, so there is nothing to
// retry and no error language. Just says so, and offers the one action that
// still works.
function NoCategories() {
  return (
    <div className="grid place-items-center rounded-3xl border border-brand-100 bg-white px-6 py-16 text-center shadow-soft">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-sand-100 text-brand-300">
        <SquaresFour size={26} weight="duotone" />
      </span>
      <p className="mt-4 text-base font-bold text-brand-900">Abhi koi category nahi</p>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-brand-500">
        Naya stock aate hi categories yahan khud-ba-khud nazar aayengi.
      </p>
      <a
        href={waLink('Assalam o alaikum! Aapke paas kaunsi categories available hain?')}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex min-h-[42px] items-center gap-2 rounded-full bg-[#25D366] px-6 text-sm font-bold text-white shadow-soft transition-all hover:bg-[#1ebe5d] active:translate-y-px"
      >
        <WhatsappLogo size={18} weight="fill" /> WhatsApp par poochhein
      </a>
    </div>
  )
}

// Grid columns: 2 (mobile) → 3 (≥760px) → 5 (≥1100px). Arbitrary screen
// variants keep it independent of the default breakpoint scale.
const GRID_CLASS =
  'grid grid-cols-2 gap-3 min-[760px]:grid-cols-3 sm:gap-4 min-[1100px]:grid-cols-5'

const SKELETON_COUNT = 10

export default function CategoriesPage() {
  const [params] = useSearchParams()
  const activeCat = params.get('cat')
  const reduce = useReducedMotion()

  const [query, setQuery] = useState('')
  const [group, setGroup] = useState(ALL_KEY)

  // Categories come ONLY from the admin catalogue API (single source of truth).
  //
  // Two silent retries: a dropped connection or a 5xx is retried behind the
  // skeletons, so a hiccup costs the visitor a moment of shimmer rather than an
  // error panel they have to dismiss. `error` is therefore only ever set once
  // the request has actually, finally failed.
  const { data, loading, error, retrying, reload } = useAsync(() => getCategories(), [], {
    retries: 2,
    cacheKey: catalogKeys.categories(),
  })
  const list = data || []

  // Chips are derived from the live list, so new admin categories show up here
  // with no code change.
  const groups = useMemo(() => buildGroups(list), [list])
  const activeGroupLabel = groups.find((g) => g.key === String(group))?.label || ''

  // Client-side filter: by name (case-insensitive) + the selected category chip.
  // Ids are compared as strings so a numeric DB id and a URL/state string match.
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return list.filter((cat) => {
      const matchesText = !needle || (cat.name || '').toLowerCase().includes(needle)
      const matchesGroup = group === ALL_KEY || String(cat.id) === String(group)
      return matchesText && matchesGroup
    })
  }, [list, query, group])

  const showGrid = !loading && !error && list.length > 0
  const noMatches = showGrid && filtered.length === 0

  // The search + chips render while loading too (as placeholders), so the grid
  // never gets pushed down the page when the data lands. They are held back
  // only in the two states where there is genuinely nothing to filter.
  const showControls = loading || showGrid

  // One shared entrance for whichever state wins. Stripped under reduced
  // motion, where the swap is instant.
  const fade = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
        transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] },
      }

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
      {showControls && (
        <div className="container-page mt-5 sm:mt-7">
          <label
            className={`flex items-center gap-2.5 rounded-full border border-brand-100 bg-white px-4 py-3 shadow-soft transition-opacity focus-within:border-saffron-400 ${
              loading ? 'opacity-60' : ''
            }`}
          >
            <MagnifyingGlass size={18} weight="bold" className="shrink-0 text-brand-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // Present but inert while loading: the box holds its place in the
              // layout without pretending it can filter an empty list yet.
              disabled={loading}
              placeholder="Category dhondein… (misaal: tissue, soap)"
              aria-label="Category dhondein"
              className="w-full min-w-0 bg-transparent text-sm text-brand-800 outline-none placeholder:text-brand-400 disabled:cursor-default"
            />
            {query && !loading && (
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

          {/* Quick category chips — built from the live admin categories. The
              placeholder row is the same height as the real one, so nothing
              below it moves when the chips arrive. */}
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {loading
              ? CHIP_SKELETON_WIDTHS.map((w, i) => (
                  <ChipSkeleton key={i} width={w} delay={i * 110} />
                ))
              : groups.map((g) => {
                  const on = String(group) === String(g.key)
                  return (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setGroup(g.key)}
                      aria-pressed={on}
                      className={`h-[34px] shrink-0 rounded-full px-4 text-xs font-bold transition-colors ${
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

      {/* Exactly one of these is mounted at a time and they cross-fade, so the
          skeletons hand over to the grid rather than being swapped out under
          the visitor. `mode="wait"` keeps them from overlapping mid-fade. */}
      <section className="container-page py-8 sm:py-12" aria-busy={loading}>
        <AnimatePresence mode="wait" initial={false}>
          {loading ? (
            <motion.div key="loading" {...fade} className={GRID_CLASS}>
              <p className="sr-only" role="status">
                Categories load ho rahi hain…
              </p>
              {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <CategorySkeleton key={i} index={i} />
              ))}
            </motion.div>
          ) : error ? (
            <motion.div key="error" {...fade}>
              <LoadFailed error={error} onRetry={reload} retrying={retrying} />
            </motion.div>
          ) : list.length === 0 ? (
            <motion.div key="empty" {...fade}>
              <NoCategories />
            </motion.div>
          ) : noMatches ? (
            <motion.div key="nomatch" {...fade}>
              <div className="grid place-items-center rounded-3xl border border-brand-100 bg-white px-6 py-16 text-center shadow-soft">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-sand-100 text-brand-300">
                  <MagnifyingGlass size={26} weight="duotone" />
                </span>
                <p className="mt-4 text-base font-bold text-brand-900">Kuch nahi mila</p>
                <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-brand-500">
                  &ldquo;{query || activeGroupLabel}&rdquo; ke liye koi category nahi mili. Doosra
                  naam try karein.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setGroup(ALL_KEY)
                  }}
                  className="mt-6 inline-flex min-h-[42px] items-center rounded-full bg-brand-700 px-6 text-sm font-semibold text-white transition-all hover:bg-brand-800 active:translate-y-px"
                >
                  Sab dikhayein
                </button>
              </div>
            </motion.div>
          ) : (
            /* Not re-keyed on query/group: re-running the whole cascade on every
               keystroke reads as a flicker. Cards that survive a filter change
               stay put; new ones fade in on their own as they mount. */
            <motion.div
              key="grid"
              variants={reduce ? undefined : stagger(0.05)}
              initial={reduce ? undefined : 'hidden'}
              animate={reduce ? undefined : 'show'}
              exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.15 } }}
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
        </AnimatePresence>
      </section>

      {/* Conversion band — bulk order via WhatsApp / call. Rendered in every
          state: it depends on no catalogue data, and gating it on the grid was
          shifting the whole page when the categories landed. It doubles as the
          way out when the catalogue itself could not be loaded. */}
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
                <WhatsappLogo size={20} weight="fill" className="shrink-0" /> <span className="whitespace-nowrap">Order on WhatsApp</span>
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
    </>
  )
}
