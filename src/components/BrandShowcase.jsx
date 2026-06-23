import { motion } from 'framer-motion'
import { houseBrands } from '../data/site'
import { SectionHeading } from './ui'
import { fadeUp, viewportOnce } from '../lib/motion'

function BrandChip({ b }) {
  const monogram = b.name.charAt(0)
  return (
    <div className="flex w-[210px] shrink-0 items-center gap-3.5 rounded-2xl border border-brand-100 bg-white px-5 py-4 shadow-soft">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-700 text-lg font-black text-saffron-300">
        {monogram}
      </span>
      <div className="leading-tight">
        <p className="text-base font-extrabold tracking-tight text-brand-900">{b.name}</p>
        <p className="text-xs font-medium text-brand-500">{b.cat}</p>
      </div>
    </div>
  )
}

export default function BrandShowcase() {
  const row = [...houseBrands, ...houseBrands]
  return (
    <section className="overflow-hidden bg-sand-100 py-16 sm:py-24">
      <div className="container-page">
        <SectionHeading
          eyebrow="Apne ghar ke brands"
          title="Ek chhat ke neeche,"
          accent="10 bharose-mand brands"
          urdu="ہر زمرے کا اپنا برانڈ"
          desc="Har category ka apna brand — quality hamare control mein, isliye margin aapke control mein."
        />
      </div>

      {/* marquee row 1 */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
        className="relative mt-10"
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-sand-100 to-transparent sm:w-28" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-sand-100 to-transparent sm:w-28" />
        <div className="flex w-max animate-marquee gap-4 pl-4">
          {row.map((b, i) => (
            <BrandChip key={`${b.id}-${i}`} b={b} />
          ))}
        </div>
      </motion.div>

      {/* marquee row 2 — reverse drift */}
      <div className="relative mt-4">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-sand-100 to-transparent sm:w-28" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-sand-100 to-transparent sm:w-28" />
        <div
          className="flex w-max animate-marquee gap-4 pl-4"
          style={{ animationDirection: 'reverse', animationDuration: '34s' }}
        >
          {row.reverse().map((b, i) => (
            <BrandChip key={`r-${b.id}-${i}`} b={b} />
          ))}
        </div>
      </div>
    </section>
  )
}
