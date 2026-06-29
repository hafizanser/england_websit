import { useEffect, useRef } from 'react'
import { LockKey, CircleNotch, WarningCircle } from '@phosphor-icons/react'
import { Card } from './ui'

/**
 * Reusable 4-digit PIN unlock card for the PIN-gated profit pages.
 * Presentational only — the parent owns the pin/error/loading state and
 * decides what counts as a successful unlock.
 */
export default function ProfitPinGate({
  pin,
  setPin,
  onSubmit,
  error,
  loading,
  title = 'Profit Analytics',
  subtitle = 'Yeh page protected hai. 4-digit PIN daalein.',
}) {
  // Reliably focus the PIN field whenever the gate opens (autoFocus is unreliable
  // when the gate mounts after an async check / on a route transition). Placing the
  // caret at the end keeps typing correct if a value is ever pre-filled.
  const inputRef = useRef(null)
  useEffect(() => {
    const t = setTimeout(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      const end = el.value.length
      try {
        el.setSelectionRange(end, end)
      } catch {
        /* some input types don't support selection range — safe to ignore */
      }
    }, 0)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="grid min-h-[60dvh] place-items-center">
      <Card className="w-full max-w-sm p-8 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-700 text-saffron-300">
          <LockKey size={30} weight="fill" />
        </span>
        <h1 className="mt-4 text-xl font-extrabold tracking-tight text-brand-900">{title}</h1>
        <p className="mt-1 text-sm text-brand-500">{subtitle}</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input
            ref={inputRef}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            aria-label="4-digit PIN"
            placeholder="••••"
            // pl matches the trailing tracking so the digits + caret stay centered.
            className="w-full rounded-2xl border border-brand-200 bg-sand-50 py-3 pl-[0.5em] text-center text-2xl font-black tracking-[0.5em] text-brand-900 outline-none focus:border-brand-500 focus:bg-white"
          />
          {error && (
            <p className="flex items-center justify-center gap-2 rounded-xl bg-saffron-50 px-3 py-2 text-sm font-medium text-saffron-800">
              <WarningCircle size={18} weight="fill" /> {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || pin.length !== 4}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-6 py-3 text-sm font-bold text-white shadow-soft hover:bg-brand-800 disabled:opacity-50"
          >
            {loading ? <CircleNotch size={18} className="animate-spin" /> : <LockKey size={18} weight="bold" />} Unlock
          </button>
        </form>
      </Card>
    </div>
  )
}
