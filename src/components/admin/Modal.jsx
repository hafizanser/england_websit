import { AnimatePresence, motion } from 'framer-motion'
import { X } from '@phosphor-icons/react'
import { spring } from '../../lib/motion'

export default function Modal({ open, title, onClose, children, footer }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-brand-950/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={spring}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-4xl bg-white shadow-lift ring-1 ring-brand-100 sm:inset-y-0 sm:my-auto sm:h-fit sm:rounded-4xl"
          >
            <div className="flex items-center justify-between border-b border-brand-100 bg-gradient-to-b from-sand-50 to-white px-5 py-4">
              <h3 className="font-display text-lg font-extrabold tracking-tight text-brand-950">{title}</h3>
              <button
                onClick={onClose}
                aria-label="Band karein"
                className="grid h-9 w-9 place-items-center rounded-xl border border-brand-200 bg-white text-brand-700 transition-all hover:bg-sand-50 active:scale-90"
              >
                <X size={18} weight="bold" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-sand-50/40 px-5 py-5">{children}</div>
            {footer && <div className="border-t border-brand-100 bg-white px-5 py-4">{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export const field = 'w-full rounded-2xl border border-brand-200 bg-white px-4 py-2.5 text-sm text-brand-900 outline-none transition-all placeholder:text-brand-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100/70'
export const fieldLabel = 'mb-1.5 block text-sm font-semibold text-brand-800'
