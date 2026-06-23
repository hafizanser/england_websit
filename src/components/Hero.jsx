import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, CaretLeft, CaretRight, Truck, Sparkle } from '@phosphor-icons/react'
import { heroSlides, stats } from '../data/site'
import { spring } from '../lib/motion'

const AUTOPLAY = 5200

export default function Hero() {
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(1)
  const timer = useRef(null)
  const slide = heroSlides[index]

  const go = useCallback((next) => {
    setDir(next > index ? 1 : -1)
    setIndex((next + heroSlides.length) % heroSlides.length)
  }, [index])

  useEffect(() => {
    timer.current = setTimeout(() => {
      setDir(1)
      setIndex((i) => (i + 1) % heroSlides.length)
    }, AUTOPLAY)
    return () => clearTimeout(timer.current)
  }, [index])

  return (
    <section id="top" className="relative">
      <div className="container-page pt-6 sm:pt-8">
        <div className="relative overflow-hidden rounded-4xl bg-brand-900 shadow-lift">
          {/* animated gradient backdrop */}
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id + '-bg'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className={`absolute inset-0 bg-gradient-to-br ${slide.theme}`}
            />
          </AnimatePresence>

          {/* decorative blobs */}
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-saffron-300/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-brand-300/20 blur-3xl" />

          <div className="relative grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6 lg:p-14">
            {/* text */}
            <div className="min-h-[280px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={slide.id + '-text'}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ ...spring, stiffness: 90 }}
                  className="flex flex-col items-start gap-5"
                >
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white ring-1 ring-white/20">
                    <Sparkle size={13} weight="fill" className="text-saffron-300" />
                    {slide.kicker}
                  </span>

                  <h1 className="text-balance text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-5xl lg:text-6xl">
                    {slide.title}
                    <br />
                    <span className="text-saffron-300">{slide.titleAccent}</span>
                  </h1>

                  <p className="urdu text-xl text-white/90 sm:text-2xl" dir="rtl">
                    {slide.urdu}
                  </p>

                  <p className="max-w-md text-[15px] leading-relaxed text-white/80 sm:text-base">
                    {slide.text}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <Link
                      to={slide.primaryTo}
                      className="group inline-flex items-center gap-2 rounded-full bg-saffron-400 px-6 py-3.5 text-sm font-bold text-brand-950 shadow-glow transition-all hover:bg-saffron-300 active:translate-y-px"
                    >
                      {slide.primary}
                      <ArrowRight
                        size={18}
                        weight="bold"
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </Link>
                    <Link
                      to={slide.secondaryTo}
                      className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/15 active:translate-y-px"
                    >
                      {slide.secondary}
                    </Link>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* image card */}
            <div className="relative">
              <AnimatePresence mode="popLayout" custom={dir}>
                <motion.div
                  key={slide.id + '-img'}
                  custom={dir}
                  initial={{ opacity: 0, scale: 0.94, x: dir * 40 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.94, x: dir * -40 }}
                  transition={spring}
                  className="relative overflow-hidden rounded-3xl shadow-lift ring-1 ring-white/15"
                >
                  <img
                    src={slide.image}
                    alt={slide.titleAccent}
                    className="aspect-[4/3] w-full object-cover lg:aspect-[5/4]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-950/40 to-transparent" />
                  <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-2xl bg-white/95 px-4 py-2.5 shadow-soft backdrop-blur">
                    <Truck size={18} weight="fill" className="text-brand-700" />
                    <span className="text-sm font-bold text-brand-900">{slide.badge}</span>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* floating price chip */}
              <motion.div
                aria-hidden
                className="absolute -left-3 -top-3 hidden rounded-2xl bg-white px-4 py-3 shadow-lift sm:block"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-400">
                  Thok rate se
                </p>
                <p className="text-xl font-extrabold tracking-tight text-brand-800">
                  Rs.41<span className="text-sm font-semibold text-brand-400">/pack</span>
                </p>
              </motion.div>
            </div>
          </div>

          {/* controls */}
          <div className="relative flex items-center justify-between gap-4 px-6 pb-6 sm:px-10 sm:pb-8 lg:px-14">
            <div className="flex items-center gap-2">
              {heroSlides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Slide ${i + 1}`}
                  onClick={() => go(i)}
                  className="group h-1.5 overflow-hidden rounded-full bg-white/25 transition-all"
                  style={{ width: i === index ? 40 : 16 }}
                >
                  {i === index && (
                    <motion.span
                      key={index}
                      className="block h-full rounded-full bg-saffron-300"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: AUTOPLAY / 1000, ease: 'linear' }}
                    />
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Pichla"
                onClick={() => go(index - 1)}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/25 text-white transition-all hover:bg-white/15 active:translate-y-px"
              >
                <CaretLeft size={18} weight="bold" />
              </button>
              <button
                type="button"
                aria-label="Agla"
                onClick={() => go(index + 1)}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/25 text-white transition-all hover:bg-white/15 active:translate-y-px"
              >
                <CaretRight size={18} weight="bold" />
              </button>
            </div>
          </div>
        </div>

        {/* trust stats */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ ...spring, delay: i * 0.06 }}
              className="rounded-3xl border border-brand-100 bg-white p-4 shadow-soft sm:p-5"
            >
              <p className="flex items-baseline gap-1 font-display text-2xl font-extrabold tracking-tight text-brand-900 sm:text-3xl">
                {s.value}
                <span className="text-sm font-bold text-saffron-600">{s.suffix}</span>
              </p>
              <p className="mt-1 text-sm font-semibold text-brand-900">{s.label}</p>
              <p className="text-xs text-brand-500">{s.sub}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
