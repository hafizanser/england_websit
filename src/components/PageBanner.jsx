import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { House, CaretRight } from '@phosphor-icons/react'
import { Eyebrow } from './ui'
import { spring } from '../lib/motion'

// Premium image-driven page banner — a contained, rounded hero card that mirrors
// the homepage hero aesthetic (warm brand gradient over a photo, soft blobs,
// breadcrumb, trust chips, CTA slot). Used at the top of Products & Offers.
const overlays = {
  brand: 'from-brand-950/95 via-brand-900/88 to-brand-800/78',
  gold: 'from-brand-950/95 via-brand-800/85 to-saffron-700/68',
}

export default function PageBanner({
  eyebrow,
  title,
  accent,
  urdu,
  desc,
  crumb,
  hideCrumb = false,
  image = '/banner.jpg',
  tone = 'brand',
  chips = [],
  children,
}) {
  return (
    <section className="container-page pt-4 sm:pt-7">
      <div className="relative overflow-hidden rounded-[26px] bg-brand-900 shadow-lift sm:rounded-4xl">
        {/* background photo */}
        <img
          src={image}
          alt=""
          aria-hidden
          loading="eager"
          className="absolute inset-0 h-full w-full scale-105 object-cover object-center"
        />
        <div className={`absolute inset-0 bg-gradient-to-br ${overlays[tone] || overlays.brand}`} />
        {/* fine dot texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />
        {/* soft glow blobs */}
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-saffron-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/5 h-56 w-56 rounded-full bg-brand-400/25 blur-3xl" />

        <div className="relative px-5 py-4 sm:px-10 sm:py-12 lg:px-14 lg:py-14">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, stiffness: 90 }}
            className="max-w-2xl"
          >
            {eyebrow && <Eyebrow tone="light">{eyebrow}</Eyebrow>}
            <h1 className="mt-2.5 text-balance text-2xl font-black leading-[1.04] tracking-tight text-white sm:mt-4 sm:text-4xl md:text-5xl">
              {title} {accent && <span className="text-saffron-300">{accent}</span>}
            </h1>
            {urdu && (
              <p
                className="urdu mt-1.5 text-base font-medium text-white sm:mt-3 sm:text-xl"
                dir="rtl"
                style={{ textShadow: '0 1px 10px rgba(26,18,9,0.55)' }}
              >
                {urdu}
              </p>
            )}
            {/* Description hidden on mobile so the banner stays short. */}
            {desc && <p className="mt-3.5 hidden max-w-xl text-sm leading-relaxed text-white/70 sm:mt-4 sm:block sm:text-[15px]">{desc}</p>}

            {chips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 sm:mt-6 sm:gap-2.5">
                {chips.map((c) => (
                  <span
                    key={c.label}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/15 backdrop-blur-sm sm:gap-2 sm:px-3.5 sm:py-2"
                  >
                    {c.icon && <c.icon size={14} weight="fill" className="text-saffron-300" />}
                    {c.label}
                  </span>
                ))}
              </div>
            )}

            {children && <div className="mt-4 sm:mt-6">{children}</div>}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
