// ---------------------------------------------------------------------------
// Cart pricing & offers engine — pure functions, no React.
// ---------------------------------------------------------------------------
import { offers, commerce, products } from '../data/site'

const byId = new Map(products.map((p) => [p.id, p]))
const offerByCode = new Map(offers.filter((o) => o.code).map((o) => [o.code.toUpperCase(), o]))

export function findOfferByCode(code) {
  return offerByCode.get(String(code || '').trim().toUpperCase()) || null
}

// Human label for a unit key/value (e.g. 'cotton' -> 'Carton').
export function unitLabelFor(u) {
  const m = { pc: 'Piece', piece: 'Piece', box: 'Box', carton: 'Carton', cotton: 'Carton', packet: 'Packet', dozen: 'Dozen', bundle: 'Bundle' }
  return m[String(u || '').toLowerCase()] || (u ? String(u) : 'Unit')
}

// Cart line identity = product id + unit type, so each unit of a product is a
// distinct line (1 Carton and 1 Bundle of the same product are separate items).
export function rowKey(id, unitKey) {
  return `${id}__${String(unitKey || 'unit')}`
}

// Resolve stored cart rows into priced line items.
// Rows carry a product snapshot (name/price/etc.) captured at add-time, so the
// cart is self-consistent even if the catalogue changes. Older {id, qty}-only
// rows are backfilled from the bundled catalogue.
export function hydrate(rows) {
  return rows
    .filter((r) => r && r.id && r.qty > 0)
    .map((r) => {
      const p = byId.get(r.id)
      const unitKey = r.unitKey ?? r.unit ?? p?.unit ?? 'pc'
      const merged = {
        id: r.id,
        key: r.key ?? rowKey(r.id, unitKey),
        name: r.name ?? p?.name ?? r.id,
        sub: r.sub ?? p?.sub ?? '',
        unit: r.unit ?? p?.unit ?? 'pc',
        unitKey,
        seed: r.seed ?? p?.seed ?? 'product',
        image: r.image ?? p?.image ?? null,
        category: r.category ?? p?.category ?? '',
        categoryId: r.categoryId ?? p?.categoryId ?? '',
        retail: Number(r.retail ?? p?.retail ?? 0),
        wholesale: Number(r.wholesale ?? p?.wholesale ?? 0),
        conv: r.conv ?? p?.conversions ?? null,
        qty: r.qty,
      }
      merged.lineTotal = merged.wholesale * merged.qty
      merged.lineRetail = merged.retail * merged.qty
      return merged
    })
}

// Build a compact, self-contained cart row snapshot from a product object.
// `unitOption` (from product.unitOptions) prices the line by the chosen unit;
// when omitted the product's primary unit/price is used.
export function toRow(product, qty = 1, unitOption = null) {
  const wholesale = unitOption ? Number(unitOption.price) || 0 : Number(product.wholesale) || 0
  const retail = unitOption ? Number(unitOption.retail ?? unitOption.price) || 0 : Number(product.retail) || 0
  const unitKey = unitOption ? unitOption.unit : product.unit
  const unitLabel = unitOption ? unitOption.label : unitLabelFor(product.unit)
  return {
    id: product.id,
    key: rowKey(product.id, unitKey),
    name: product.name,
    sub: product.sub,
    unit: unitLabel,
    unitKey,
    seed: product.seed,
    image: product.image ?? null,
    category: product.category,
    categoryId: product.categoryId ?? product.category_id ?? '',
    retail,
    wholesale,
    conv: product.conversions ?? null,
    qty,
  }
}

// ---------------------------------------------------------------------------
// Display-only unit roll-up. Using the dashboard conversion factors, a product
// group's unit lines collapse into the friendliest larger-unit breakdown, e.g.
// a 12-Box line with 10 Box/Carton -> [1 Carton, 2 Boxes]. This NEVER changes
// the underlying cart lines, quantities, prices, offers or order total — it is
// purely how the quantity is shown in the cart.
// ---------------------------------------------------------------------------
const UNIT_PLURAL = { Carton: 'Cartons', Box: 'Boxes', Piece: 'Pieces', Dozen: 'Dozens', Packet: 'Packets', Bundle: 'Bundles', Unit: 'Units' }
const UNIT_ORDER = ['Carton', 'Box', 'Dozen', 'Packet', 'Bundle', 'Piece', 'Unit']
const pluralUnit = (label, qty) => (qty === 1 ? label : (UNIT_PLURAL[label] || `${label}s`))

export function mergeUnits(group) {
  const counts = {}
  const add = (label, n) => { if (n > 0) counts[label] = (counts[label] || 0) + n }
  for (const u of group.units || []) {
    const label = unitLabelFor(u.unitKey)
    const c = u.conv || {}
    const qty = u.qty
    if (label === 'Box' && c.boxesPerCarton > 0) {
      add('Carton', Math.floor(qty / c.boxesPerCarton))
      add('Box', qty % c.boxesPerCarton)
    } else if (label === 'Piece' && c.piecesPerBox > 0) {
      const boxes = Math.floor(qty / c.piecesPerBox)
      add('Piece', qty % c.piecesPerBox)
      if (c.boxesPerCarton > 0) {
        add('Carton', Math.floor(boxes / c.boxesPerCarton))
        add('Box', boxes % c.boxesPerCarton)
      } else {
        add('Box', boxes)
      }
    } else {
      add(label, qty)
    }
  }
  const parts = []
  const push = (label) => parts.push({ label, qty: counts[label], text: `${counts[label]} ${pluralUnit(label, counts[label])}` })
  for (const label of UNIT_ORDER) if (counts[label]) push(label)
  for (const label in counts) if (!UNIT_ORDER.includes(label)) push(label)
  return parts
}

// Group hydrated line items by product, so the same product (with multiple
// units) renders as ONE card with its unit lines nested inside.
export function groupByProduct(items) {
  const map = new Map()
  for (const it of items) {
    if (!map.has(it.id)) {
      map.set(it.id, { id: it.id, name: it.name, sub: it.sub, image: it.image, seed: it.seed, units: [], total: 0, qty: 0 })
    }
    const g = map.get(it.id)
    g.units.push(it)
    g.total += it.lineTotal
    g.qty += it.qty
  }
  return [...map.values()]
}

const lineTotal = (i) => i.wholesale * i.qty

// Derive the FREE items a cart has earned from active "buy X get Y free" admin
// offers. Pure + separate from paid pricing: free lines have wholesale 0 and an
// isFree flag, so they display as clearly-labelled Rs.0 rows without affecting
// the order total. Recomputed whenever paid quantities change.
export function computeFreeItems(offers, items) {
  if (!Array.isArray(offers) || !offers.length || !Array.isArray(items) || !items.length) return []
  const free = []
  for (const offer of offers) {
    const cfg = offer.config || {}
    const mainId = (offer.productIds || [])[0]
    const fp = offer.freeProduct
    const buyQty = Number(cfg.buyQty) || 0
    const freeQty = Number(cfg.freeQty) || 0
    if (!cfg.isFreeOffer || !mainId || !fp || buyQty <= 0 || freeQty <= 0) continue

    // Compare units by their canonical label so raw keys (cotton/box) and stored
    // labels (Carton/Box) match — works for the cart, admin order, and order detail.
    const mainUnit = cfg.mainUnit
    const sameUnit = (a, b) => unitLabelFor(a) === unitLabelFor(b)
    const paidQty = items
      .filter((i) => String(i.id) === String(mainId) && (!mainUnit || sameUnit(i.unitKey, mainUnit)) && !i.isFree)
      .reduce((s, i) => s + i.qty, 0)
    if (paidQty < buyQty) continue

    const freeCount = Math.floor(paidQty / buyQty) * freeQty
    if (freeCount <= 0) continue

    const freeUnit = cfg.freeUnit || fp.unit
    const opt = (fp.unitOptions || []).find((o) => o.unit === freeUnit) || (fp.unitOptions || [])[0]
    free.push({
      id: fp.id,
      key: `${fp.id}__${freeUnit}__free__${offer.id}`,
      name: fp.name,
      image: fp.image || null,
      seed: fp.seed,
      unit: opt?.label || unitLabelFor(freeUnit),
      unitKey: freeUnit,
      qty: freeCount,
      wholesale: 0,
      retail: Number(opt?.retail ?? opt?.price ?? 0),
      lineTotal: 0,
      isFree: true,
      offerTitle: offer.title,
    })
  }
  return free
}

// Evaluate a single offer against the current items + subtotal.
export function evaluateOffer(offer, items, subtotal) {
  const cfg = offer.config || {}
  switch (offer.type) {
    case 'bxgy': {
      const group = (cfg.buyQty || 0) + (cfg.freeQty || 0)
      let discount = 0
      let freeUnits = 0
      ;(offer.productIds || []).forEach((pid) => {
        const it = items.find((i) => i.id === pid)
        if (it && group > 0) {
          const free = Math.floor(it.qty / group) * cfg.freeQty
          freeUnits += free
          discount += free * it.wholesale
        }
      })
      return { applicable: discount > 0, discount, freeUnits, label: offer.title }
    }
    case 'shipping': {
      const min = cfg.minSubtotal || 0
      return { applicable: subtotal >= min, discount: 0, freeShipping: subtotal >= min }
    }
    case 'percent': {
      const min = cfg.minSubtotal || 0
      const base = cfg.categoryId
        ? items.filter((i) => i.categoryId === cfg.categoryId).reduce((s, i) => s + lineTotal(i), 0)
        : subtotal
      const applicable = base > 0 && subtotal >= min
      return {
        applicable,
        discount: applicable ? Math.round((base * cfg.pct) / 100) : 0,
        label: offer.title,
        reason: !applicable
          ? min && subtotal < min
            ? `Min order Rs.${min.toLocaleString('en-PK')}`
            : 'Cart mein eligible items nahi'
          : undefined,
      }
    }
    case 'combo': {
      const ids = offer.productIds || []
      const allPresent = ids.length > 0 && ids.every((pid) => items.some((i) => i.id === pid))
      const base = items.filter((i) => ids.includes(i.id)).reduce((s, i) => s + lineTotal(i), 0)
      return {
        applicable: allPresent,
        discount: allPresent ? Math.round((base * (cfg.pct || 0)) / 100) : 0,
        label: offer.title,
        reason: !allPresent ? 'Bundle ke saare items add karein' : undefined,
      }
    }
    default:
      return { applicable: false, discount: 0 }
  }
}

// Derive the full order summary. `appliedCode` is an optional manual promo.
export function deriveTotals(items, appliedCode) {
  const subtotal = items.reduce((s, i) => s + lineTotal(i), 0)
  const count = items.reduce((s, i) => s + i.qty, 0)
  const lines = []
  let freeShipping = false

  // Auto offers (always-on): buy-x-get-y + free shipping threshold
  offers
    .filter((o) => o.type === 'bxgy' || o.type === 'shipping')
    .forEach((o) => {
      const r = evaluateOffer(o, items, subtotal)
      if (!r.applicable) return
      if (r.freeShipping) freeShipping = true
      if (r.discount > 0) lines.push({ id: o.id, label: o.title, note: o.save, amount: r.discount, auto: true })
    })

  // Manual applied code (one at a time)
  const offer = appliedCode ? findOfferByCode(appliedCode) : null
  let codeStatus = null
  if (offer) {
    const r = evaluateOffer(offer, items, subtotal)
    if (r.applicable && (r.discount > 0 || offer.type === 'shipping')) {
      if (r.discount > 0) lines.push({ id: offer.id, label: offer.title, note: offer.code, amount: r.discount, code: true })
      if (r.freeShipping) freeShipping = true
      codeStatus = { ok: true, code: offer.code, offer }
    } else {
      codeStatus = { ok: false, code: offer.code, reason: r.reason || 'Yeh code is cart par nahi lagta', offer }
    }
  }

  const discount = lines.reduce((s, l) => s + l.amount, 0)
  const total = Math.max(0, subtotal - discount) // no delivery charges
  // Savings = retail/MRP total − your wholesale total. This is the wholesale-rate
  // advantage ONLY (the promo discount is shown separately as its own line, so we
  // don't double-count it here). Clamped so the figure can never exceed the order
  // total — a savings number larger than the total reads as fake/buggy.
  const retailSavings = items.reduce((s, i) => s + Math.max(0, i.lineRetail - i.lineTotal), 0)
  const savings = Math.min(retailSavings, total)

  return {
    count,
    subtotal,
    lines,
    discount,
    delivery: 0,
    deliveryFree: true,
    total,
    savings,
    codeStatus,
  }
}

export const money = (n) =>
  `${commerce.currency}${Math.round(n).toLocaleString('en-PK')}`
