import { motion } from 'framer-motion'
import {
  Tag,
  Truck,
  Handshake,
  ShieldCheck,
  ChatCircleDots,
  ArrowsClockwise,
  SealCheck,
} from '@phosphor-icons/react'
import { reasons } from '../data/site'
import { Eyebrow } from './ui'
import { fadeUp, stagger, viewportOnce } from '../lib/motion'

const iconMap = {
  tag: Tag,
  truck: Truck,
  handshake: Handshake,
  shield: ShieldCheck,
  chat: ChatCircleDots,
  rotate: ArrowsClockwise,
}

export default function WhyChooseUs() {
  return (
    <section className="bg-brand-950 py-16 text-white sm:py-24">
      <div className="container-page grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        {/* left — sticky intro */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="lg:sticky lg:top-28"
        >
          <Eyebrow tone="light">Kyun England?</Eyebrow>
          <h2 className="mt-5 text-balance text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl">
            Dukaandar ka{' '}
            <span className="text-saffron-300">sacha partner</span>
          </h2>
          <p className="urdu mt-3 text-xl text-white/80" dir="rtl">
            صرف سپلائر نہیں، ساتھی
          </p>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/70">
            18 saal se hum Pakistan ke chhote dukaandaron ke sath khade hain. Sahi rate, waqt par
            delivery aur izzat ke sath maamla — yehi hamari pehchaan hai.
          </p>

          <div className="mt-8 flex items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-saffron-400 text-brand-950">
              <SealCheck size={26} weight="fill" />
            </span>
            <div>
              <p className="text-2xl font-extrabold tracking-tight">98.4%</p>
              <p className="text-sm text-white/70">On-time delivery, pichle 12 mahine</p>
            </div>
          </div>
        </motion.div>

        {/* right — divided reason list */}
        <motion.ul
          variants={stagger(0.07)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="divide-y divide-white/10 border-y border-white/10"
        >
          {reasons.map((r) => {
            const Icon = iconMap[r.icon]
            return (
              <motion.li
                key={r.id}
                variants={fadeUp}
                className="group flex items-start gap-4 py-6 transition-colors sm:gap-6"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/8 text-saffron-300 ring-1 ring-white/10 transition-all group-hover:bg-saffron-400 group-hover:text-brand-950 sm:h-14 sm:w-14">
                  <Icon size={24} weight="bold" />
                </span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="text-lg font-bold tracking-tight sm:text-xl">{r.title}</h3>
                    <span className="urdu text-sm text-saffron-200/80" dir="rtl">
                      {r.urdu}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-white/65 sm:text-[15px]">
                    {r.text}
                  </p>
                </div>
              </motion.li>
            )
          })}
        </motion.ul>
      </div>
    </section>
  )
}
