import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from '@phosphor-icons/react'
import { getCategories } from '../api/catalog'
import { useAsync } from '../hooks/useAsync'
import { SectionHeading } from './ui'
import { fadeUp, stagger, viewportOnce } from '../lib/motion'
import { onImgError } from '../lib/img'

const MotionLink = motion(Link)

// Plural-safe item count: "1 item" / "12 items".
const countLabel = (n) => `${n} ${n === 1 ? 'item' : 'items'}`

// Branded fallback tile — used when a category has no admin-uploaded image.
function Fallback({ name }) {
  return (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-brand-100 to-sand-200">
      <span className="font-display text-4xl font-extrabold text-brand-400">
        {(name || '?').trim().charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

function CategoryCard({ cat }) {
  return (
    <MotionLink
      // The REAL database id — /products?cat= filters on tbl_product.category_id.
      // (The old bundled list used slugs like 'tissues', which matched nothing.)
      to={`/products?cat=${cat.id}`}
      state={{ scrollToGrid: true }}
      aria-label={`${cat.name} category dekhein (${countLabel(cat.items ?? 0)})`}
      variants={fadeUp}
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft"
    >
      <div className="relative aspect-[5/4] overflow-hidden bg-sand-100">
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
        {cat.items != null && (
          <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-brand-700 backdrop-blur">
            {countLabel(cat.items)}
          </span>
        )}
        {cat.urdu && (
          <span className="absolute bottom-3 left-3 right-3">
            <span className="urdu block text-right text-sm text-white/90" dir="rtl">
              {cat.urdu}
            </span>
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 p-3.5">
        <span className="min-w-0 flex-1 truncate text-sm font-bold leading-tight text-brand-900">{cat.name}</span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600 transition-all group-hover:bg-saffron-400 group-hover:text-brand-950">
          <ArrowUpRight size={16} weight="bold" />
        </span>
      </div>
    </MotionLink>
  )
}

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft">
      <div className="relative aspect-[5/4] overflow-hidden bg-sand-100">
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      </div>
      <div className="flex items-center justify-between p-3.5">
        <div className="h-3.5 w-2/3 rounded-full bg-sand-200" />
        <div className="h-8 w-8 shrink-0 rounded-full bg-sand-200" />
      </div>
    </div>
  )
}

const GRID_CLASS = 'mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5'

export default function FeaturedCategories() {
  // Categories come ONLY from the admin API (single source of truth), so new
  // admin categories appear here automatically and every tile links with the
  // real id that the products filter expects.
  const { data, loading } = useAsync(() => getCategories(), [])
  const list = (data || []).slice(0, 10)

  // Nothing to show (backend unreachable / no categories) → hide the section
  // rather than render dummy tiles.
  if (!loading && list.length === 0) return null

  return (
    <section id="categories" className="container-page scroll-mt-24 py-16 sm:py-24">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <SectionHeading
          eyebrow={list.length ? `${list.length} badi categories` : 'Categories'}
          title="Har dukaan ka"
          accent="poora saaman"
          urdu="ایک جگہ سے ساری ضرورت"
          desc="Tissue se baby care tak — roz bikne wali har cheez, ek hi supplier se. Stock kabhi khali nahi."
        />
        <Link
          to="/categories"
          className="hidden shrink-0 items-center gap-2 rounded-full border border-brand-200 px-5 py-3 text-sm font-semibold text-brand-800 transition-all hover:bg-white sm:inline-flex"
        >
          Saari categories
          <ArrowUpRight size={16} weight="bold" />
        </Link>
      </div>

      {loading ? (
        <div className={GRID_CLASS}>
          {Array.from({ length: 10 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <motion.div
          variants={stagger(0.06)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className={GRID_CLASS}
        >
          {list.map((cat) => (
            <CategoryCard key={cat.id} cat={cat} />
          ))}
        </motion.div>
      )}
    </section>
  )
}
