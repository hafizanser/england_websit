import { motion } from 'framer-motion'
import { Handshake, ShieldCheck, Truck, MapPin, Buildings } from '@phosphor-icons/react'
import PageBanner from '../components/PageBanner'
import { SectionHeading } from '../components/ui'
import Testimonials from '../components/Testimonials'
import CTASection from '../components/CTASection'
import { about, stats, brand } from '../data/site'
import { fadeUp, stagger, viewportOnce } from '../lib/motion'

const valueIcons = { handshake: Handshake, shield: ShieldCheck, truck: Truck }

export default function AboutPage() {
  return (
    <>
      <PageBanner
        eyebrow="Hamari Kahani"
        title="2007 se"
        accent="dukaandaron ke sath"
        urdu="بھروسے کا اٹھارہ سالہ سفر"
        desc={about.intro}
        hideCrumb
        image="/banner.jpg"
        tone="brand"
        chips={[
          { icon: Truck, label: '47 shehron mein delivery' },
          { icon: Handshake, label: '18 saal ka bharosa' },
          { icon: ShieldCheck, label: 'Asli maal guarantee' },
        ]}
      />

      {/* story split */}
      <section className="container-page py-16 sm:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={viewportOnce}
            transition={{ type: 'spring', stiffness: 80, damping: 18 }}
            className="relative overflow-hidden rounded-4xl shadow-lift"
          >
            <img
              src="https://picsum.photos/seed/barkat-warehouse-team/900/760"
              alt="England warehouse"
              className="aspect-[5/4] w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-950/50 to-transparent" />
            <div className="absolute bottom-5 left-5 inline-flex items-center gap-2 rounded-2xl bg-white/95 px-4 py-2.5 shadow-soft backdrop-blur">
              <MapPin size={18} weight="fill" className="text-brand-700" />
              <span className="text-sm font-bold text-brand-900">SITE Area, Karachi</span>
            </div>
          </motion.div>

          <motion.div variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={viewportOnce}>
            <SectionHeading
              eyebrow="Kaun hain hum"
              title="Ek dukaan se"
              accent="47 shehron tak"
              urdu="چھوٹے دکاندار کا بڑا ساتھی"
            />
            <div className="mt-5 space-y-4">
              {about.story.map((p, i) => (
                <motion.p key={i} variants={fadeUp} className="text-[15px] leading-relaxed text-brand-700/85">
                  {p}
                </motion.p>
              ))}
            </div>
            <motion.div variants={fadeUp} className="mt-7 grid grid-cols-2 gap-3">
              {stats.slice(0, 4).map((s) => (
                <div key={s.label} className="rounded-3xl border border-brand-100 bg-white p-4 shadow-soft">
                  <p className="flex items-baseline gap-1 text-2xl font-extrabold tracking-tight text-brand-800">
                    {s.value}
                    <span className="text-sm font-bold text-saffron-500">{s.suffix}</span>
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-brand-900">{s.label}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* milestones */}
      <section className="bg-white py-16 sm:py-24">
        <div className="container-page">
          <SectionHeading
            eyebrow="Hamara safar"
            tone="saffron"
            title="Qadam ba"
            accent="qadam"
            urdu="سنگ میل"
            desc="Chhoti shuruaat se aaj tak — har saal naye dukaandaron ka bharosa."
          />
          <motion.ol
            variants={stagger(0.1)}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {about.milestones.map((m, i) => (
              <motion.li
                key={m.year}
                variants={fadeUp}
                className="relative rounded-3xl border border-brand-100 bg-sand-50 p-6 shadow-soft"
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-700 text-saffron-300">
                  <Buildings size={22} weight="fill" />
                </span>
                <p className="mt-4 text-2xl font-black tracking-tight text-brand-800">{m.year}</p>
                <p className="mt-1 text-sm leading-relaxed text-brand-600">{m.text}</p>
                <span className="absolute right-5 top-5 text-4xl font-black text-brand-100">
                  0{i + 1}
                </span>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </section>

      {/* values */}
      <section className="container-page py-16 sm:py-24">
        <SectionHeading
          eyebrow="Hamare usool"
          title="Jin par"
          accent="hum khade hain"
          urdu="ہماری بنیادی اقدار"
          align="center"
        />
        <motion.div
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="mx-auto mt-10 grid max-w-4xl gap-5 sm:grid-cols-3"
        >
          {about.values.map((v) => {
            const Icon = valueIcons[v.icon] || ShieldCheck
            return (
              <motion.div
                key={v.title}
                variants={fadeUp}
                className="rounded-4xl border border-brand-100 bg-white p-7 text-center shadow-soft"
              >
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                  <Icon size={28} weight="fill" />
                </span>
                <h3 className="mt-4 text-lg font-extrabold tracking-tight text-brand-900">{v.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-brand-600">{v.text}</p>
              </motion.div>
            )
          })}
        </motion.div>
      </section>

      <Testimonials />
      <CTASection />
    </>
  )
}
