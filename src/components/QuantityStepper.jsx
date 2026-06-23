import { Minus, Plus } from '@phosphor-icons/react'

// Compact +/- stepper. `size="sm"` for cards, default for cart rows.
// `full` makes it stretch edge-to-edge so the +/- buttons never clip on
// narrow mobile cards. `unitLabel` makes the +/- aria-labels unit-aware
// ("ek Carton barhayein") for screen-reader clarity.
export default function QuantityStepper({ value, onChange, size = 'md', min = 0, max = 999, full = false, unitLabel = '' }) {
  const dim = size === 'sm' ? 'h-9 w-9' : 'h-10 w-10'
  const text = size === 'sm' ? 'text-sm' : 'text-base'
  const unit = unitLabel ? ` ${unitLabel}` : ''

  const set = (next) => onChange(Math.max(min, Math.min(max, next)))

  return (
    <div
      className={`items-center rounded-full border border-brand-200 bg-white p-1 ${
        full ? 'flex w-full justify-between' : 'inline-flex'
      }`}
    >
      <button
        type="button"
        aria-label={`ek${unit} kam karein`}
        onClick={() => set(value - 1)}
        disabled={value <= min}
        className={`grid ${dim} shrink-0 place-items-center rounded-full text-brand-700 transition-all hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-saffron-500 active:scale-90 disabled:cursor-not-allowed disabled:opacity-30`}
      >
        <Minus size={size === 'sm' ? 14 : 16} weight="bold" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={`Tadaad${unit}`}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10)
          set(Number.isNaN(n) ? 0 : n)
        }}
        className={`${text} ${full ? 'flex-1' : 'w-9'} min-w-0 bg-transparent text-center font-bold tabular-nums text-brand-900 outline-none`}
      />
      <button
        type="button"
        aria-label={`ek${unit} barhayein`}
        onClick={() => set(value + 1)}
        disabled={value >= max}
        className={`grid ${dim} shrink-0 place-items-center rounded-full text-brand-700 transition-all hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-saffron-500 active:scale-90 disabled:cursor-not-allowed disabled:opacity-30`}
      >
        <Plus size={size === 'sm' ? 14 : 16} weight="bold" />
      </button>
    </div>
  )
}
