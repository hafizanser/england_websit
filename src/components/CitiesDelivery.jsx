import { motion } from 'framer-motion'
import { MapPin, Truck } from '@phosphor-icons/react'
import { SectionHeading } from './ui'
import { fadeUp, viewportOnce } from '../lib/motion'

// 50+ delivery cities across Pakistan — drives the marquee.
export const deliveryCities = [
  'Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Gujranwala',
  'Peshawar', 'Quetta', 'Sialkot', 'Hyderabad', 'Bahawalpur', 'Sargodha', 'Sukkur',
  'Sheikhupura', 'Mardan', 'Gujrat', 'Kasur', 'Rahim Yar Khan', 'Sahiwal', 'Okara',
  'Wah Cantt', 'Dera Ghazi Khan', 'Mirpur Khas', 'Nawabshah', 'Mingora', 'Chiniot',
  'Kamoke', 'Hafizabad', 'Sadiqabad', 'Burewala', 'Jhang', 'Khanewal', 'Muzaffargarh',
  'Kohat', 'Jhelum', 'Abbottabad', 'Mandi Bahauddin', 'Daska', 'Gojra', 'Pakpattan',
  'Bhakkar', 'Charsadda', 'Jacobabad', 'Vehari', 'Nowshera', 'Khairpur', 'Dadu',
  'Bahawalnagar', 'Khushab', 'Mansehra', 'Larkana',
]

function CityChip({ name }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-brand-100 bg-white px-5 py-3.5 shadow-soft">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-700 text-saffron-300">
        <MapPin size={16} weight="fill" />
      </span>
      <span className="whitespace-nowrap text-[15px] font-bold tracking-tight text-brand-900">{name}</span>
    </div>
  )
}

export default function CitiesDelivery() {
  const a = deliveryCities.slice(0, 27)
  const b = deliveryCities.slice(27)
  const rowA = [...a, ...a]
  const rowB = [...b, ...b]

  return (
    <section className="overflow-hidden bg-sand-100 py-16 sm:py-24">
      <div className="container-page">
        <SectionHeading
          eyebrow="Poore Pakistan mein delivery"
          tone="saffron"
          title="We deliver in"
          accent="50+ cities across Pakistan"
          urdu="پورے پاکستان میں ڈلیوری"
          desc="Karachi se Khyber tak — 50+ shehron mein agle din delivery. Aapki dukaan jahan bhi ho, England ka maal wahan pohanchta hai."
        />

        <div className="mt-7 flex flex-wrap gap-2.5">
          {[
            { icon: Truck, label: 'Agle din delivery' },
            { icon: MapPin, label: '50+ cities' },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-800 shadow-soft ring-1 ring-brand-100">
              <Icon size={15} weight="fill" className="text-saffron-600" /> {label}
            </span>
          ))}
        </div>
      </div>

      {/* marquee row 1 */}
      <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={viewportOnce} className="relative mt-10">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-sand-100 to-transparent sm:w-28" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-sand-100 to-transparent sm:w-28" />
        <div className="flex w-max animate-marquee gap-3 pl-3">
          {rowA.map((c, i) => (
            <CityChip key={`a-${c}-${i}`} name={c} />
          ))}
        </div>
      </motion.div>

      {/* marquee row 2 — reverse drift */}
      <div className="relative mt-3">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-sand-100 to-transparent sm:w-28" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-sand-100 to-transparent sm:w-28" />
        <div className="flex w-max animate-marquee gap-3 pl-3" style={{ animationDirection: 'reverse', animationDuration: '34s' }}>
          {rowB.map((c, i) => (
            <CityChip key={`b-${c}-${i}`} name={c} />
          ))}
        </div>
      </div>
    </section>
  )
}
