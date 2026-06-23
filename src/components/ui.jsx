import { motion } from 'framer-motion'
import { Star } from '@phosphor-icons/react'
import { fadeUp, viewportOnce } from '../lib/motion'

// Small eyebrow label used above section headings
export function Eyebrow({ children, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700 ring-brand-100',
    saffron: 'bg-saffron-50 text-saffron-700 ring-saffron-100',
    light: 'bg-white/10 text-white ring-white/15',
  }
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ring-1 ${tones[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}

// Section heading: English title + Urdu sub-line, left aligned (anti-center bias)
export function SectionHeading({ eyebrow, tone, title, accent, urdu, desc, align = 'left' }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      className={`flex w-full flex-col gap-4 ${
        align === 'center' ? 'items-center text-center' : 'items-start'
      }`}
    >
      {eyebrow && <Eyebrow tone={tone}>{eyebrow}</Eyebrow>}
      <h2 className="max-w-3xl text-balance text-3xl font-extrabold leading-[1.05] tracking-tight text-brand-950 sm:text-4xl md:text-5xl">
        {title} {accent && <span className="text-saffron-500">{accent}</span>}
      </h2>
      {urdu && (
        <p className="urdu text-lg text-brand-600 sm:text-xl" dir="rtl">
          {urdu}
        </p>
      )}
      {desc && (
        <p
          className={`max-w-[60ch] text-[15px] leading-relaxed text-brand-700/80 sm:text-base ${
            align === 'center' ? 'mx-auto' : ''
          }`}
        >
          {desc}
        </p>
      )}
    </motion.div>
  )
}

export function Stars({ rating = 5, size = 14 }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          weight={i <= Math.round(rating) ? 'fill' : 'regular'}
          className={i <= Math.round(rating) ? 'text-saffron-400' : 'text-brand-200'}
        />
      ))}
    </span>
  )
}

// Skeleton placeholder matching the product card layout (loading state)
export function ProductSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft">
      <div className="relative aspect-square overflow-hidden bg-sand-100">
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      </div>
      <div className="space-y-3 p-4">
        <div className="h-3 w-1/3 rounded-full bg-sand-200" />
        <div className="h-3.5 w-4/5 rounded-full bg-sand-200" />
        <div className="h-3 w-3/5 rounded-full bg-sand-200" />
        <div className="flex items-center justify-between pt-2">
          <div className="h-6 w-20 rounded-full bg-sand-200" />
          <div className="h-11 w-11 rounded-2xl bg-sand-200" />
        </div>
      </div>
    </div>
  )
}

// Inline error block with retry
export function ErrorState({ message, onRetry }) {
  return (
    <div className="col-span-full grid place-items-center rounded-3xl border border-dashed border-saffron-300 bg-saffron-50 px-6 py-14 text-center">
      <p className="text-base font-bold text-saffron-900">Kuch ghadbad ho gayi</p>
      <p className="mt-1 max-w-sm text-sm text-saffron-700">{message || 'Maloomat load nahi ho saki.'}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-800 active:translate-y-px"
        >
          Dobara koshish karein
        </button>
      )}
    </div>
  )
}

// Empty result block
export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="col-span-full grid place-items-center rounded-3xl border border-dashed border-brand-200 bg-sand-50 px-6 py-16 text-center">
      {Icon && <Icon size={38} className="text-brand-300" weight="duotone" />}
      <p className="mt-3 text-base font-semibold text-brand-800">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-brand-500">{text}</p>}
      {action}
    </div>
  )
}

// Reusable category/product image tile with a soft branded gradient wash.
export function ImageTile({ seed, alt, className = '', ratio = 'aspect-[4/3]', children }) {
  return (
    <div className={`relative overflow-hidden ${ratio} ${className}`}>
      <img
        src={`https://picsum.photos/seed/${seed}/700/560`}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.07]"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-950/55 via-brand-950/5 to-transparent" />
      {children}
    </div>
  )
}
