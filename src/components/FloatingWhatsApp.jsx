import { useRef } from 'react'
import { motion } from 'framer-motion'
import { WhatsappLogo } from '@phosphor-icons/react'
import { brand } from '../data/site'

// Draggable WhatsApp button. Starts pinned to the bottom-right; the user can
// drag it anywhere within the viewport. A drag won't trigger the link.
export default function FloatingWhatsApp() {
  const constraintsRef = useRef(null)
  const wasDragged = useRef(false)
  const href = `https://wa.me/${brand.whatsapp.replace(/[^0-9]/g, '')}`

  return (
    <div ref={constraintsRef} className="pointer-events-none fixed inset-0 z-40">
      <motion.a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label="WhatsApp par order karein (drag to move)"
        drag
        dragConstraints={constraintsRef}
        dragMomentum={false}
        dragElastic={0.12}
        onDragStart={() => { wasDragged.current = true }}
        onDragEnd={() => { window.setTimeout(() => { wasDragged.current = false }, 80) }}
        onClick={(e) => { if (wasDragged.current) e.preventDefault() }}
        whileDrag={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.8, type: 'spring', stiffness: 200, damping: 16 }}
        className="pointer-events-auto absolute bottom-24 right-4 flex cursor-grab touch-none select-none flex-col items-center gap-1.5 active:cursor-grabbing lg:bottom-7 lg:right-7"
      >
        <span className="relative grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg">
          <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366]/60" />
          <WhatsappLogo size={32} weight="fill" className="relative text-white" />
        </span>
        <span
          className="urdu inline-flex items-center justify-center rounded-full bg-[#25D366] px-3 py-1 text-[11px] font-bold text-white shadow-lg"
          dir="rtl"
          style={{ lineHeight: 1, fontFamily: "'Noto Nastaliq Urdu', serif", paddingBottom: '6px', paddingTop: '4px' }}
        >
          آرڈر کریں
        </span>
      </motion.a>
    </div>
  )
}
