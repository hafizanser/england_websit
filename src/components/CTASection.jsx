import { motion } from 'framer-motion'
import { WhatsappLogo, Phone, ArrowRight } from '@phosphor-icons/react'
import { brand } from '../data/site'
import { fadeUp, viewportOnce } from '../lib/motion'

export default function CTASection() {
  return (
    <section className="container-page py-16 sm:py-24">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
        className="relative overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 p-8 text-center shadow-lift sm:p-14"
      >
        {/* decorative */}
        <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-saffron-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-brand-400/30 blur-3xl" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />

        <div className="relative mx-auto max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white ring-1 ring-white/20">
            Aaj hi shuru karein
          </span>
          <h2 className="mt-5 text-balance text-3xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl">
            Aapki dukaan ka agla order,
            <br />
            <span className="text-saffron-300">sirf ek message door</span>
          </h2>
          <p className="urdu mx-auto mt-4 max-w-md text-xl text-white/85" dir="rtl">
            آج آرڈر کریں، کل دکان پر مال حاضر
          </p>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/80">
            WhatsApp par apni list bhejein ya call karein. Hamari team rate, stock aur delivery —
            sab kuch minute mein confirm kar degi.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={`https://wa.me/${brand.whatsapp.replace(/[^0-9]/g, '')}`}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-saffron-400 px-7 py-4 text-base font-bold text-brand-950 shadow-glow transition-all hover:bg-saffron-300 active:translate-y-px sm:w-auto"
            >
              <WhatsappLogo size={22} weight="fill" />
              WhatsApp par order
              <ArrowRight size={18} weight="bold" className="transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href={`tel:${brand.phone.replace(/\s/g, '')}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/30 bg-white/5 px-7 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/15 active:translate-y-px sm:w-auto"
            >
              <Phone size={20} weight="fill" />
              {brand.phone}
            </a>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
