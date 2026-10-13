import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { MagnifyingGlass, ArrowElbowDownLeft, ArrowUp, ArrowDown } from '@phosphor-icons/react'
import { allDestinations } from './nav'

// ---------------------------------------------------------------------------
// Jump-to (Ctrl+K / Cmd+K)
// ---------------------------------------------------------------------------
// Twelve destinations is exactly the awkward size: too many to sit in one
// glance, too few to deserve a nested menu. Clicking through a 264px column to
// reach "PDF Catalog" costs a scan of every other label on the way. Typing
// three letters does not.
//
// It also makes the sidebar's collapsed rail usable rather than a compromise:
// with the rail on, the icons handle the four screens somebody lives in, and
// this handles everything else.
//
// Deliberately NOT a fuzzy matcher. Fuzzy matching on a twelve-item list buys
// nothing and starts surfacing "Categories" when you type "rate". A plain
// substring test over the label plus a keyword list is predictable, and
// predictable is the whole point of a keyboard shortcut.

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '')

export function paletteShortcutLabel() {
  return isMac ? '⌘K' : 'Ctrl K'
}

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return allDestinations
    return allDestinations.filter((d) =>
      `${d.label} ${d.group || ''} ${d.keywords || ''}`.toLowerCase().includes(needle),
    )
  }, [q])

  // A fresh query starts at the top; otherwise the highlight can sit past the
  // end of a now-shorter list and Enter navigates somewhere nobody chose.
  useEffect(() => {
    setActive(0)
  }, [q])

  useEffect(() => {
    if (!open) return undefined
    setQ('')
    setActive(0)
    // The input is inside a portal that mounts this frame; focus after paint.
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const go = useCallback(
    (dest) => {
      if (!dest) return
      onClose()
      navigate(dest.to)
    },
    [navigate, onClose],
  )

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % Math.max(1, results.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + results.length) % Math.max(1, results.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(results[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  if (typeof document === 'undefined' || !open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-brand-950/55 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jump to"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-lift"
      >
        <div className="flex items-center gap-3 border-b border-brand-100 px-4">
          <MagnifyingGlass size={18} weight="bold" className="shrink-0 text-brand-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Kahan jana hai?"
            aria-label="Search admin screens"
            className="w-full bg-transparent py-4 text-sm font-medium text-brand-900 outline-none placeholder:text-brand-400"
          />
          <kbd className="shrink-0 rounded-md border border-brand-200 bg-sand-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand-500">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-brand-400">
              &ldquo;{q}&rdquo; ke liye koi screen nahi mili.
            </p>
          )}
          {results.map((d, i) => (
            <button
              key={d.to}
              type="button"
              data-active={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(d)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                i === active ? 'bg-brand-900 text-white' : 'text-brand-700 hover:bg-sand-50'
              }`}
            >
              <d.icon size={17} weight={i === active ? 'fill' : 'regular'} className="shrink-0" />
              <span className="flex-1 text-sm font-semibold">{d.label}</span>
              {d.group && (
                <span className={`text-[11px] font-medium ${i === active ? 'text-white/55' : 'text-brand-400'}`}>
                  {d.group}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-brand-100 bg-sand-50/60 px-4 py-2.5 text-[11px] font-medium text-brand-400">
          <span className="inline-flex items-center gap-1.5">
            <ArrowUp size={11} weight="bold" />
            <ArrowDown size={11} weight="bold" /> chalein
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ArrowElbowDownLeft size={11} weight="bold" /> kholein
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * Wire Ctrl+K / Cmd+K to `onOpen`.
 *
 * Bound on the window rather than on a component, because the shortcut has to
 * work while focus is anywhere — a table cell, a filter box, the page body.
 * Skipped while the caret is in an input so typing "k" in a product name does
 * not teleport the person away mid-edit.
 */
export function usePaletteShortcut(onOpen) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'k' && e.key !== 'K') return
      if (!e.metaKey && !e.ctrlKey) return
      const el = document.activeElement
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (typing && !e.metaKey && !e.ctrlKey) return
      e.preventDefault()
      onOpen()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onOpen])
}
