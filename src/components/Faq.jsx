import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from '@phosphor-icons/react'
import { faqs } from '../data/site'
import { SectionHeading } from './ui'
import { spring } from '../lib/motion'

function Item({ item, open, onToggle }) {
  return (
    <div className="border-b border-brand-100">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-base font-bold text-brand-900 sm:text-lg">{item.q}</span>
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-all ${
            open ? 'rotate-45 bg-brand-700 text-white' : 'bg-brand-50 text-brand-700'
          }`}
        >
          <Plus size={18} weight="bold" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring}
            className="overflow-hidden"
          >
            <p className="pb-5 pr-12 text-[15px] leading-relaxed text-brand-600">{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Faq() {
  const [open, setOpen] = useState(0)
  return (
    <section className="container-page py-16 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <SectionHeading
          eyebrow="Aam sawalat"
          title="Aksar"
          accent="poochhe jaate hain"
          urdu="آپ کے سوالات کے جواب"
          desc="Koi aur sawal? WhatsApp ya call par hamari team hazir hai."
        />
        <div>
          {faqs.map((item, i) => (
            <Item key={item.q} item={item} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
          ))}
        </div>
      </div>
    </section>
  )
}
