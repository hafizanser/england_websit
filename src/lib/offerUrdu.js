// Urdu sub-line for an offer card. The Urdu is GENERATED from the offer's type +
// config so it renders for BOTH seeded offers and admin/API offers (which don't
// carry an `urdu` field — the reason the line was previously missing). An explicit
// `offer.urdu` always wins. Shared by the homepage/Products card (OffersSection)
// and the /offers DealCard so all three surfaces stay identical.

// Urdu unit names, keyed by the same raw unit keys that unitLabelFor understands.
const URDU_UNIT = {
  pc: 'عدد', piece: 'عدد', box: 'باکس', carton: 'کارٹن', cotton: 'کارٹن',
  packet: 'پیکٹ', dozen: 'درجن', bundle: 'بنڈل',
}
const urduUnit = (u) => URDU_UNIT[String(u || '').toLowerCase()] || (u ? String(u) : '')

export function dealUrdu(offer) {
  if (!offer) return ''
  if (offer.urdu) return offer.urdu // explicit translation wins
  const cfg = offer.config || {}

  if (offer.type === 'bxgy') {
    const buy = Number(cfg.buyQty) || 0
    const free = Number(cfg.freeQty) || 0
    if (buy && free) {
      const mu = urduUnit(cfg.mainUnit)
      const fu = urduUnit(cfg.freeUnit || cfg.mainUnit)
      // e.g. "5 کارٹن خریدیں، 1 باکس بالکل مفت" (mirrors "Buy 5 Carton, get 1 Box FREE")
      return `${buy} ${mu} خریدیں، ${free} ${fu} بالکل مفت`.replace(/\s+/g, ' ').trim()
    }
  }
  if (offer.type === 'combo' && cfg.pct) return `پورا بنڈل لیں — ${cfg.pct}% بچت`
  if (offer.type === 'percent' && cfg.pct) return `${cfg.pct}% فوری رعایت`
  if (offer.type === 'shipping') {
    return cfg.minSubtotal
      ? `Rs. ${Number(cfg.minSubtotal).toLocaleString('en-PK')}+ پر مفت ڈیلیوری`
      : 'ہر آرڈر پر مفت ڈیلیوری'
  }
  return ''
}
