import { createContext, useContext, useEffect, useMemo, useReducer, useCallback, useState, useRef } from 'react'
import { hydrate, deriveTotals, findOfferByCode, toRow, unitLabelFor, rowKey, computeFreeItems } from '../lib/cartEngine'
import { getOffers } from '../api/offers'
import { getServerCart, saveServerCart, clearServerCart } from '../api/cart'
import { useNotify } from './NotifyContext'
import { useCustomerAuth } from './CustomerAuthContext'

const STORAGE_KEY = 'barkat.cart.v2'

const CartContext = createContext(null)

const initialState = { rows: [], code: null }

// Merge duplicate lines (same product id + unit) and drop invalid rows, so each
// product-unit is exactly one line and quantities/subtotal can never diverge.
function normalize(rows) {
  const byKey = new Map()
  for (const r of rows || []) {
    if (!r || !r.id) continue
    const qty = Math.max(0, Math.min(999, Number(r.qty) || 0))
    if (qty === 0) continue
    const key = r.key || rowKey(r.id, r.unitKey || r.unit)
    const row = { ...r, key, qty }
    if (byKey.has(key)) {
      const prev = byKey.get(key)
      byKey.set(key, { ...prev, ...row, qty: Math.min(999, prev.qty + qty) })
    } else {
      byKey.set(key, row)
    }
  }
  return [...byKey.values()]
}

// Union two row sets by line key, keeping the larger quantity (never doubles).
// Used to fold a saved server cart into the local cart at login.
function mergeRows(a, b) {
  const map = new Map()
  for (const r of [...(a || []), ...(b || [])]) {
    if (!r || !r.id) continue
    const qty = Math.max(0, Math.min(999, Number(r.qty) || 0))
    if (qty === 0) continue
    const key = r.key || rowKey(r.id, r.unitKey || r.unit)
    const existing = map.get(key)
    if (!existing || qty > existing.qty) map.set(key, { ...r, key, qty })
  }
  return [...map.values()]
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    const parsed = JSON.parse(raw)
    return {
      rows: normalize(parsed.rows),
      code: typeof parsed.code === 'string' ? parsed.code : null,
    }
  } catch {
    return initialState
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const { row, qty } = action
      const existing = state.rows.find((r) => r.key === row.key)
      const rows = existing
        ? state.rows.map((r) =>
            r.key === row.key ? { ...row, qty: Math.min(999, r.qty + qty) } : r,
          )
        : [...state.rows, { ...row, qty }]
      return { ...state, rows: normalize(rows) }
    }
    case 'SET_QTY': {
      const qty = Math.max(0, Math.min(999, action.qty))
      // only ever touch an existing line (by key); removing at qty 0
      const rows = state.rows
        .map((r) => (r.key === action.key ? { ...r, qty } : r))
        .filter((r) => r.qty > 0)
      return { ...state, rows }
    }
    case 'REMOVE':
      return { ...state, rows: state.rows.filter((r) => r.key !== action.key) }
    case 'SET_ROWS':
      return {
        ...state,
        rows: normalize(action.rows),
        code: action.code !== undefined ? action.code : state.code,
      }
    case 'CLEAR':
      return { ...state, rows: [], code: null }
    case 'APPLY_CODE':
      return { ...state, code: action.code }
    case 'REMOVE_CODE':
      return { ...state, code: null }
    default:
      return state
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  const { toast } = useNotify()
  const { customer } = useCustomerAuth()
  const syncedIdRef = useRef(null)
  const saveTimer = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* storage unavailable */
    }
  }, [state])

  // On login: pull the customer's saved cart and union it with whatever is in
  // this browser, so prior items survive — then persist the merged result.
  useEffect(() => {
    const cid = customer?.id
    if (!cid) {
      syncedIdRef.current = null
      return
    }
    if (syncedIdRef.current === cid) return
    let alive = true
    ;(async () => {
      try {
        const server = await getServerCart() // { rows, code }
        if (!alive) return
        syncedIdRef.current = cid
        const merged = normalize(mergeRows(state.rows, server.rows))
        const code = state.code || server.code || null
        dispatch({ type: 'SET_ROWS', rows: merged, code })
        try { await saveServerCart(merged, code) } catch { /* offline */ }
      } catch {
        // Couldn't read the server cart; still mark synced so we save forward.
        if (alive) syncedIdRef.current = cid
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id])

  // While logged in, debounce-persist every cart change to the account.
  useEffect(() => {
    if (!customer?.id || syncedIdRef.current !== customer.id) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveServerCart(state.rows, state.code).catch(() => {})
    }, 600)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [state.rows, state.code, customer?.id])

  const items = useMemo(() => hydrate(state.rows), [state.rows])
  const totals = useMemo(() => deriveTotals(items, state.code), [items, state.code])

  // Active admin offers → derived FREE items (buy-X-get-Y). Loaded once; the
  // free lines recompute automatically as paid quantities change.
  const [offers, setOffers] = useState([])
  useEffect(() => {
    let alive = true
    getOffers()
      .then((o) => alive && setOffers(Array.isArray(o) ? o : []))
      .catch(() => {})
    return () => { alive = false }
  }, [])
  const freeItems = useMemo(() => computeFreeItems(offers, items), [offers, items])

  // Badge = number of UNIQUE products (a product with multiple units counts once).
  const count = useMemo(() => new Set(state.rows.map((r) => r.id)).size, [state.rows])
  // Total units (sum of quantities) — kept for places that need a unit total.
  const units = useMemo(() => state.rows.reduce((s, r) => s + r.qty, 0), [state.rows])

  // Add `qty` of a product in a specific unit. Each product-unit is its own cart
  // line, so the "Already in your cart" warning only fires for the SAME unit.
  const add = useCallback((product, qty = 1, unitOption = null) => {
    const opt = unitOption || (product.unitOptions && product.unitOptions[0]) || null
    const row = toRow(product, qty, opt)
    const prev = state.rows.find((r) => r.key === row.key)?.qty || 0
    dispatch({ type: 'ADD', row, qty })
    const label = opt?.label || unitLabelFor(product.unit)
    const plural = (n) => (n === 1 ? label : `${label}s`)
    if (prev > 0 && qty === prev) {
      toast(`Already in your cart — You already added ${prev} ${plural(prev)} of ${product.name}.`, 'warning')
    } else {
      toast(`Added to cart — ${product.name} (${qty} ${plural(qty)})`, 'success')
    }
  }, [state.rows, toast])

  // Remove one unit of a specific product-unit line.
  const decrement = useCallback((product, unitOption = null) => {
    const opt = unitOption || (product.unitOptions && product.unitOptions[0]) || null
    const key = rowKey(product.id, opt ? opt.unit : product.unit)
    const cur = state.rows.find((r) => r.key === key)?.qty || 0
    const label = opt?.label || unitLabelFor(product.unit)
    if (cur <= 0) {
      toast(`Nothing to remove — Add ${product.name} to your cart first.`, 'warning')
      return
    }
    dispatch({ type: 'SET_QTY', key, qty: cur - 1 })
    toast(`Removed from cart — ${product.name} (1 ${label})`, 'info')
  }, [state.rows, toast])

  const addMany = useCallback((products, label) => {
    products.forEach((p) => dispatch({ type: 'ADD', row: toRow(p, 1, (p.unitOptions && p.unitOptions[0]) || null), qty: 1 }))
    toast(label || `${products.length} items cart mein shamil`)
  }, [toast])

  const setQty = useCallback((key, qty) => dispatch({ type: 'SET_QTY', key, qty }), [])
  const remove = useCallback((key) => dispatch({ type: 'REMOVE', key }), [])
  // Re-insert previously-removed line snapshots verbatim (powers the cart's "undo
  // remove"). Hydrated items already carry the full row shape, so they round-trip
  // through ADD untouched. No toast — the undo UI is its own feedback.
  const restore = useCallback((rows) => {
    ;(rows || []).forEach((r) => r && dispatch({ type: 'ADD', row: r, qty: r.qty }))
  }, [])
  // Clearing is the ONLY thing that wipes the saved cart on the account too.
  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' })
    if (customer?.id) clearServerCart().catch(() => {})
  }, [customer?.id])

  const applyCode = useCallback((code) => {
    const offer = findOfferByCode(code)
    if (!offer) {
      toast('Yeh code maujood nahi hai', 'error')
      return false
    }
    dispatch({ type: 'APPLY_CODE', code: offer.code })
    toast(`Code ${offer.code} apply ho gaya`)
    return true
  }, [toast])

  const removeCode = useCallback(() => dispatch({ type: 'REMOVE_CODE' }), [])
  // qtyOf(id, unit) → quantity of that exact unit line; qtyOf(id) → total across
  // all units of the product (used for "is this product in the cart at all").
  const qtyOf = useCallback(
    (id, unit) => {
      if (unit != null) return state.rows.find((r) => r.key === rowKey(id, unit))?.qty || 0
      return state.rows.filter((r) => r.id === id).reduce((s, r) => s + r.qty, 0)
    },
    [state.rows],
  )

  const value = useMemo(
    () => ({
      items,
      freeItems,
      offers,
      rows: state.rows,
      code: state.code,
      totals,
      count,
      units,
      add,
      decrement,
      addMany,
      setQty,
      remove,
      restore,
      clear,
      applyCode,
      removeCode,
      qtyOf,
      toast,
    }),
    [items, freeItems, offers, state.rows, state.code, totals, count, units, add, decrement, addMany, setQty, remove, restore, clear, applyCode, removeCode, qtyOf, toast],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
