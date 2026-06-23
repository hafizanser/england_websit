import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Tag } from '@phosphor-icons/react'
import { offers } from '../data/site'
import { SectionHeading } from './ui'
import { fadeUp, stagger, viewportOnce } from '../lib/motion'

const MotionLink = motion(Link)

function OfferCard({ offer }) {
  const big = offer.featured === 'lg'
  return (
    <MotionLink
      to="/offers"
      variants={fadeUp}
      whileHover={{ y: -5 }}
      transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      className={`group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-4xl p-6 text-white shadow-lift sm:p-8 ${
        big ? 'lg:row-span-2' : ''
      }`}
    >
      <img
        src={`https://picsum.photos/seed/${offer.seed}/800/600`}
        alt={offer.title}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
      />
      <div className={`absolute inset-0 bg-gradient-to-br ${offer.theme} opacity-90`} />
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ring-white/20">
          <Tag size={12} weight="fill" /> {offer.kicker}
        </span>
        <span className="rounded-full bg-saffron-300 px-3 py-1 text-[12px] font-extrabold text-brand-950 shadow-soft">
          {offer.save}
        </span>
      </div>

      <div className="relative mt-4">
        <h3 className={`font-black leading-tight tracking-tight ${big ? 'text-3xl sm:text-4xl' : 'text-2xl'}`}>
          {offer.title}
        </h3>
        <p className={`mt-2 max-w-sm text-white/85 ${big ? 'text-base' : 'text-sm'}`}>{offer.desc}</p>
        <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-brand-900 shadow-soft transition-all group-hover:gap-3">
          Deal dekhein
          <ArrowRight size={16} weight="bold" />
        </span>
      </div>
    </MotionLink>
  )
}

export default function SpecialOffers() {
  const big = offers.find((o) => o.featured === 'lg')
  const small = offers.filter((o) => o.featured === 'sm').slice(0, 2)

  return (
    <section id="offers" className="container-page scroll-mt-24 py-16 sm:py-24">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <SectionHeading
          eyebrow="Limited time deals"
          tone="saffron"
          title="Khaas offers,"
          accent="khaas dukaandaron ke liye"
          urdu="بچت کا سنہری موقع"
          desc="Bundle deals aur seasonal discounts — jitna zyada lein, utna zyada bachayein."
        />
        <Link
          to="/offers"
          className="hidden shrink-0 items-center gap-2 rounded-full border border-brand-200 px-5 py-3 text-sm font-semibold text-brand-800 transition-all hover:bg-white sm:inline-flex"
        >
          Saari offers <ArrowRight size={16} weight="bold" />
        </Link>
      </div>

      <motion.div
        variants={stagger(0.1)}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
        className="mt-10 grid gap-4 lg:grid-cols-2"
      >
        {big && <OfferCard offer={big} />}
        <div className="grid gap-4">
          {small.map((o) => (
            <OfferCard key={o.id} offer={o} />
          ))}
        </div>
      </motion.div>

      <div className="mt-8 flex justify-center sm:hidden">
        <Link
          to="/offers"
          className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-sm font-bold text-white shadow-soft active:translate-y-px"
        >
          Saari offers dekhein <ArrowRight size={16} weight="bold" />
        </Link>
      </div>
    </section>
  )
}
