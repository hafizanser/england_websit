import { motion } from 'framer-motion'
import { Eyebrow } from './ui'
import { spring } from '../lib/motion'

// Inner-page banner (Products, Categories, Offers, About, Blog).
//
// Redesign (Sep 2026): an editorial header in the same language as the
// homepage sections — mono eyebrow, heavy uppercase display title, the Urdu
// line right under it — on a light paper band, with the banner photograph
// framed on the right from `lg` up. On phones the photo steps aside so the
// banner stays short and the products start near the top of the screen.
//
// Props are unchanged: eyebrow, title, accent, urdu, desc, chips, children
// (CTA slot), image, tone. `crumb` / `hideCrumb` are still accepted so no
// caller has to change.
// eslint-disable-next-line no-unused-vars
export default function PageBanner({ eyebrow, title, accent, urdu, desc, crumb, hideCrumb = false, image = '/banner.jpg', tone = 'brand', chips = [], children }) {
  return (
    <section className="relative overflow-hidden border-b border-brand-900/[0.06] bg-[#FBF8F2]">
      {/* a quiet gold glow + fine dot field, like the reference's paper bands */}
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-saffron-300/20 blur-3xl" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(40,28,14,0.10) 1px, transparent 0)',
          backgroundSize: '22px 22px',
          maskImage: 'linear-gradient(90deg, #000, transparent 70%)',
          WebkitMaskImage: 'linear-gradient(90deg, #000, transparent 70%)',
        }}
      />

      <div className="container-page relative grid items-center gap-8 py-7 sm:py-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-14 lg:py-14">
        <motion.div
          initial={{ opacity: 0, y: 22, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ ...spring, stiffness: 90 }}
          className="min-w-0"
        >
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h1 className="mt-3 text-balance font-grotesk text-[32px] font-extrabold uppercase leading-[0.95] tracking-[-0.035em] text-brand-950 sm:mt-5 sm:text-5xl lg:text-6xl">
            {title} {accent && <span className="text-saffron-500">{accent}</span>}
          </h1>
          {urdu && (
            <p className="urdu mt-1.5 text-lg text-saffron-600 sm:mt-3 sm:text-2xl" dir="rtl" style={{ width: 'fit-content', maxWidth: '100%' }}>
              {urdu}
            </p>
          )}
          {/* Description hidden on mobile so the banner stays short. */}
          {desc && <p className="mt-3 hidden max-w-xl text-[15px] leading-relaxed text-brand-600 sm:block sm:text-[17px]">{desc}</p>}

          {chips.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 sm:mt-6">
              {chips.map((c) => (
                <span
                  key={c.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-900/10 bg-white px-3 py-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-brand-700 sm:gap-2 sm:px-3.5 sm:py-2 sm:text-[11px]"
                >
                  {c.icon && <c.icon size={13} weight="fill" className="text-saffron-500" />}
                  {c.label}
                </span>
              ))}
            </div>
          )}

          {children && <div className="mt-5 sm:mt-7">{children}</div>}
        </motion.div>

        {/* the photograph, framed — desktop only */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
          className="relative hidden lg:block"
        >
          <div
            className={`relative overflow-hidden rounded-[28px] border border-brand-900/10 shadow-[0_40px_80px_-40px_rgba(40,28,14,0.55)] ${
              tone === 'gold' ? 'bg-saffron-100' : 'bg-sand-100'
            }`}
          >
            <img
              src={image}
              alt=""
              aria-hidden
              loading="eager"
              className="aspect-[16/11] w-full object-cover object-center transition-transform duration-[1400ms] ease-out hover:scale-[1.03]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-950/25 via-transparent to-transparent" />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
