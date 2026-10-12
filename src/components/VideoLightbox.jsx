import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from '@phosphor-icons/react'
import { spring } from '../lib/motion'
import { lockScroll } from '../lib/scroll'
import { onImgError } from '../lib/img'

// Centered lightbox that plays a product clip over a blurred, dark backdrop.
// Portalled to <body> so the card's `overflow-hidden` / `rounded-3xl` never clip
// it and it always centres on the viewport. Closes on ESC, on a backdrop click,
// and on the close button. The <video>/<img> only mounts while `open` is true, so
// nothing downloads until the shopper actually opens the modal (lazy by design).
export default function VideoLightbox({ open, onClose, src, kind = 'video', poster, title = '' }) {
  // A clip that will not load — the file is missing, the host dropped the
  // connection, or this browser cannot decode the container. Before this the
  // modal just showed a black rectangle for ever, which looks like the site is
  // broken rather than like one clip being unavailable. Reset whenever the
  // modal is opened again, so "try again" is always one close-and-reopen away.
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (open) setFailed(false)
  }, [open, src])

  // ESC to close + background scroll lock, wired only while open.
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const unlock = lockScroll()
    return () => {
      window.removeEventListener('keydown', onKey)
      unlock()
    }
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="video-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={title ? `${title} — video` : 'Product video'}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-950/75 p-4 backdrop-blur-md sm:p-6"
        >
          <motion.div
            key="video-panel"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={spring}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-brand-950 shadow-lift ring-1 ring-white/10"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Band karein"
              className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-brand-950/60 text-white backdrop-blur-md transition-all hover:bg-brand-950/80 hover:scale-105 active:scale-95"
            >
              <X size={20} weight="bold" />
            </button>

            {failed ? (
              <div className="grid min-h-[40vh] place-items-center px-6 py-16 text-center">
                <div>
                  <p className="text-base font-bold text-white">Video abhi chal nahi saki</p>
                  <p className="mt-1 text-sm text-white/70">
                    Internet slow ho sakta hai. Product ki tamam tafseelat aur tasveerein
                    neeche mojood hain.
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-6 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-brand-900 transition-all hover:bg-white/90 active:translate-y-px"
                  >
                    Band karein
                  </button>
                </div>
              </div>
            ) : kind === 'gif' ? (
              <img
                src={src}
                alt={title}
                loading="lazy"
                onError={onImgError}
                className="mx-auto block max-h-[82vh] w-full object-contain"
              />
            ) : (
              <video
                src={src}
                poster={poster || undefined}
                controls
                autoPlay
                muted
                playsInline
                // The clip is only requested once this modal is open, so there
                // is no reason to hold back here — "metadata" would make the
                // shopper wait for a second round-trip after they have already
                // said they want to watch it.
                preload="auto"
                onError={() => setFailed(true)}
                className="mx-auto block max-h-[82vh] w-full bg-black object-contain"
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
