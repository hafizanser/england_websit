import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Question,
  Warning,
  CheckCircle,
  Trash,
  Info,
  X,
  WarningCircle,
} from '@phosphor-icons/react'
import { spring } from '../lib/motion'

const NotifyContext = createContext(null)

const toneStyles = {
  default: { icon: Question, ring: 'bg-brand-50 text-brand-600', btn: 'bg-brand-700 hover:bg-brand-800' },
  question: { icon: Question, ring: 'bg-brand-50 text-brand-600', btn: 'bg-brand-700 hover:bg-brand-800' },
  success: { icon: CheckCircle, ring: 'bg-brand-50 text-brand-600', btn: 'bg-brand-700 hover:bg-brand-800' },
  warning: { icon: Warning, ring: 'bg-saffron-50 text-saffron-600', btn: 'bg-saffron-500 hover:bg-saffron-600' },
  danger: { icon: Trash, ring: 'bg-red-50 text-red-600', btn: 'bg-red-600 hover:bg-red-700' },
  info: { icon: Info, ring: 'bg-brand-50 text-brand-600', btn: 'bg-brand-700 hover:bg-brand-800' },
}

let toastSeq = 0

export function NotifyProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const [toasts, setToasts] = useState([])
  const resolver = useRef(null)

  const close = useCallback((value) => {
    if (resolver.current) {
      resolver.current(value)
      resolver.current = null
    }
    setDialog(null)
  }, [])

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolver.current = resolve
      setDialog({
        kind: 'confirm',
        tone: opts.tone || 'question',
        title: opts.title || 'Pakka?',
        text: opts.text || '',
        confirmText: opts.confirmText || 'Haan',
        cancelText: opts.cancelText || 'Cancel',
      })
    })
  }, [])

  const alert = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolver.current = resolve
      setDialog({
        kind: 'alert',
        tone: opts.tone || 'info',
        title: opts.title || '',
        text: opts.text || '',
        confirmText: opts.confirmText || 'Theek hai',
      })
    })
  }, [])

  const toast = useCallback((message, tone = 'success') => {
    const id = ++toastSeq
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800)
  }, [])

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const success = useCallback((m) => toast(m, 'success'), [toast])
  const error = useCallback((m) => toast(m, 'error'), [toast])

  const value = useMemo(
    () => ({ confirm, alert, toast, success, error }),
    [confirm, alert, toast, success, error],
  )

  const s = dialog ? toneStyles[dialog.tone] || toneStyles.default : null
  const Icon = s?.icon || Question

  return (
    <NotifyContext.Provider value={value}>
      {children}

      {/* SweetAlert-style modal */}
      <AnimatePresence>
        {dialog && (
          <div className="fixed inset-0 z-[80] grid place-items-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => close(false)}
              className="absolute inset-0 bg-brand-950/55 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, y: 24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={spring}
              className="relative w-full max-w-sm overflow-hidden rounded-4xl bg-white p-7 text-center shadow-lift ring-1 ring-brand-100"
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-sand-50 to-transparent" />
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ ...spring, delay: 0.05 }}
                className={`relative mx-auto grid h-16 w-16 place-items-center rounded-2xl shadow-card ring-1 ring-white/40 ${s.ring}`}
              >
                <Icon size={32} weight="fill" />
              </motion.span>
              {dialog.title && (
                <h3 className="relative mt-4 text-xl font-extrabold tracking-tight text-brand-950">{dialog.title}</h3>
              )}
              {dialog.text && <p className="relative mt-2 text-sm leading-relaxed text-brand-600">{dialog.text}</p>}

              <div className="relative mt-6 flex gap-3">
                {dialog.kind === 'confirm' && (
                  <button
                    type="button"
                    onClick={() => close(false)}
                    className="flex-1 rounded-2xl border border-brand-200 bg-white px-5 py-3 text-sm font-bold text-brand-700 transition-all hover:bg-sand-50 active:translate-y-px"
                  >
                    {dialog.cancelText}
                  </button>
                )}
                <button
                  type="button"
                  autoFocus
                  onClick={() => close(true)}
                  className={`flex-1 rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-soft transition-all active:translate-y-px ${s.btn}`}
                >
                  {dialog.confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toasts */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[85] flex flex-col items-center gap-2 px-4 sm:bottom-7 sm:right-7 sm:left-auto sm:items-end"
      >
        <AnimatePresence>
          {toasts.map((t) => {
            const styles = {
              success: { box: 'bg-brand-900 text-white ring-white/10', icon: CheckCircle, ic: 'text-saffron-300', close: 'hover:bg-white/15' },
              error: { box: 'bg-red-50 text-red-900 ring-red-200', icon: WarningCircle, ic: 'text-red-600', close: 'hover:bg-red-200' },
              warning: { box: 'bg-saffron-50 text-saffron-900 ring-saffron-200', icon: Warning, ic: 'text-saffron-600', close: 'hover:bg-saffron-200' },
              info: { box: 'bg-brand-900 text-white ring-white/10', icon: Info, ic: 'text-saffron-300', close: 'hover:bg-white/15' },
            }
            const st = styles[t.tone] || styles.success
            const TIcon = st.icon
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={spring}
                className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl px-4 py-3 shadow-lift ring-1 ${st.box}`}
              >
                <TIcon size={22} weight="fill" className={st.ic} />
                <p className="flex-1 text-sm font-semibold">{t.message}</p>
                <button
                  type="button"
                  aria-label="Band karein"
                  onClick={() => dismissToast(t.id)}
                  className={`grid h-6 w-6 place-items-center rounded-full transition-colors ${st.close}`}
                >
                  <X size={14} weight="bold" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </NotifyContext.Provider>
  )
}

export function useNotify() {
  const ctx = useContext(NotifyContext)
  if (!ctx) throw new Error('useNotify must be used within NotifyProvider')
  return ctx
}
