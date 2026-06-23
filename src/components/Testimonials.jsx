import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Quotes, MapPin } from '@phosphor-icons/react'
import { testimonials } from '../data/site'
import { SectionHeading, Stars } from './ui'
import { fadeUp, spring, viewportOnce } from '../lib/motion'

const AUTOPLAY = 6000

export default function Testimonials() {
  const [active, setActive] = useState(0)
  const t = testimonials[active]

  useEffect(() => {
    const id = setTimeout(() => setActive((a) => (a + 1) % testimonials.length), AUTOPLAY)
    return () => clearTimeout(id)
  }, [active])

  return (
    <section id="reviews" className="scroll-mt-24 bg-white py-16 sm:py-24">
      <div className="container-page">
        <SectionHeading
          eyebrow="Dukaandaron ki zubani"
          tone="saffron"
          title="12,400+ dukaanein,"
          accent="ek hi bharosa"
          urdu="جن کا تجربہ بولتا ہے"
          desc="Pakistan bhar ke dukaandar England ke sath kyun jude hain — unki apni baat mein."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          {/* active testimonial */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="relative overflow-hidden rounded-4xl bg-brand-950 p-7 text-white shadow-lift sm:p-10"
          >
            <Quotes size={72} weight="fill" className="absolute -right-2 -top-2 text-white/5" />
            <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-brand-600/30 blur-3xl" />

            <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-saffron-400 text-brand-950">
              <Quotes size={24} weight="fill" />
            </span>

            <AnimatePresence mode="wait">
              <motion.blockquote
                key={t.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ ...spring, stiffness: 90 }}
                className="relative mt-6"
              >
                <p className="text-balance text-xl font-medium leading-relaxed tracking-tight sm:text-2xl">
                  &ldquo;{t.text}&rdquo;
                </p>

                <footer className="mt-7 flex items-center gap-4">
                  <img
                    src={`https://picsum.photos/seed/${t.seed}/120/120`}
                    alt={t.name}
                    className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white/15"
                  />
                  <div>
                    <p className="text-base font-bold">{t.name}</p>
                    <p className="text-sm text-white/70">{t.shop}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-saffron-200">
                      <MapPin size={12} weight="fill" /> {t.city}
                    </p>
                  </div>
                  <div className="ml-auto self-start">
                    <Stars rating={t.rating} size={16} />
                  </div>
                </footer>
              </motion.blockquote>
            </AnimatePresence>

            {/* progress dots */}
            <div className="relative mt-8 flex items-center gap-2">
              {testimonials.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Review ${i + 1}`}
                  onClick={() => setActive(i)}
                  className="h-1.5 rounded-full bg-white/25 transition-all"
                  style={{ width: i === active ? 32 : 14, background: i === active ? '#c7a05b' : undefined }}
                />
              ))}
            </div>
          </motion.div>

          {/* selectable list */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="flex flex-col gap-2.5"
          >
            {testimonials.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(i)}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${
                  i === active
                    ? 'border-brand-200 bg-sand-50 shadow-soft'
                    : 'border-transparent hover:bg-sand-50'
                }`}
              >
                <img
                  src={`https://picsum.photos/seed/${item.seed}/96/96`}
                  alt={item.name}
                  className={`h-11 w-11 rounded-xl object-cover transition-all ${
                    i === active ? 'ring-2 ring-saffron-400' : 'opacity-80'
                  }`}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-brand-900">{item.name}</p>
                  <p className="truncate text-xs text-brand-500">
                    {item.shop} • {item.city}
                  </p>
                </div>
              </button>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
