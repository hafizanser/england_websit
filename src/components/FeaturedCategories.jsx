import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from '@phosphor-icons/react'
import { categories } from '../data/site'
import { SectionHeading } from './ui'
import { fadeUp, stagger, viewportOnce } from '../lib/motion'

const MotionLink = motion(Link)

function CategoryCard({ cat }) {
  const Icon = cat.icon
  return (
    <MotionLink
      to={`/products?cat=${cat.id}`}
      variants={fadeUp}
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft"
    >
      <div className="relative aspect-[5/4] overflow-hidden">
        <img
          src={`https://picsum.photos/seed/${cat.seed}/520/420`}
          alt={cat.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950/70 via-brand-950/10 to-transparent" />
        <span className={`absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-xl ${cat.tint} shadow-soft ring-1 ring-white/60`}>
          <Icon size={20} weight="fill" />
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-brand-700 backdrop-blur">
          {cat.items} items
        </span>
        <span className="absolute bottom-3 left-3 right-3">
          <span className="urdu block text-right text-sm text-white/90" dir="rtl">
            {cat.urdu}
          </span>
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 p-3.5">
        <span className="text-sm font-bold leading-tight text-brand-900">{cat.name}</span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600 transition-all group-hover:bg-saffron-400 group-hover:text-brand-950">
          <ArrowUpRight size={16} weight="bold" />
        </span>
      </div>
    </MotionLink>
  )
}

export default function FeaturedCategories() {
  return (
    <section id="categories" className="container-page scroll-mt-24 py-16 sm:py-24">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <SectionHeading
          eyebrow="10 badi categories"
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

      <motion.div
        variants={stagger(0.06)}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
        className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5"
      >
        {categories.map((cat) => (
          <CategoryCard key={cat.id} cat={cat} />
        ))}
      </motion.div>
    </section>
  )
}
