import { useState } from 'react'

// Reusable typeahead: a text input with a filtered suggestion dropdown and
// keyboard navigation (↑/↓/Enter/Esc). The parent owns `value` + filtering and
// receives the chosen item via onPick — this only renders the input + list.
// Used for the Mobile (existing customers) and Shehar (city) fields on the
// admin New Order page.
export default function Typeahead({
  value,
  onChange,
  onPick,
  items = [],
  renderItem,
  placeholder,
  inputMode,
  invalid = false,
  onBlur,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(-1)

  const close = () => { setOpen(false); setHi(-1) }

  const onKeyDown = (e) => {
    if (!open || !items.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter' && hi >= 0) { e.preventDefault(); onPick(items[hi]); close() }
    else if (e.key === 'Escape') close()
  }

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e); setOpen(true); setHi(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => { setTimeout(close, 120); onBlur?.(e) }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-label={ariaLabel}
        autoComplete="off"
        className={`w-full rounded-[10px] border px-3 py-[11px] text-sm text-[#2A2117] outline-none transition-all placeholder:text-[#9C9078] ${
          invalid
            ? 'border-[#B23B2E] bg-[#F6E4E1] focus:ring-4 focus:ring-[#B23B2E]/15'
            : 'border-[#D9CDB1] bg-white focus:border-[#3A2E1F] focus:ring-4 focus:ring-[#3A2E1F]/10'
        }`}
      />
      {open && items.length > 0 && (
        <ul className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 max-h-64 overflow-y-auto rounded-[11px] border border-[#D9CDB1] bg-white p-1 shadow-[0_12px_30px_rgba(58,46,31,0.16)]">
          {items.map((it, idx) => (
            <li key={it.key}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onPick(it); close() }}
                onMouseEnter={() => setHi(idx)}
                className={`block w-full rounded-lg px-3 py-2.5 text-left transition-colors ${idx === hi ? 'bg-[#f5edda]' : 'hover:bg-[#f5edda]'}`}
              >
                {renderItem(it)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
