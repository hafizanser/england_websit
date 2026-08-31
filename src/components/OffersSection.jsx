import { Link } from 'react-router-dom'
import { products } from '../data/site'
import { catalogKeys } from '../api/cacheKeys'
import { useAsync } from '../hooks/useAsync'
import { getOffers } from '../api/offers'
import { money, unitLabelFor } from '../lib/cartEngine'
import { imgSrc, onImgError } from '../lib/img'
import { dealUrdu } from '../lib/offerUrdu'
import { Reveal, Check } from './Reveal'
import { ErrorState } from './ui'
import MrpPerPiece from './MrpPerPiece'

// ---- offer helpers (mirror the /offers "Featured Deals" cards) --------------
const productMap = new Map(products.map((p) => [p.id, p]))
const resolveProducts = (o) =>
  o.mainProduct ? [o.mainProduct, o.freeProduct].filter(Boolean) : (o.productIds || []).map((id) => productMap.get(id)).filter(Boolean)
const unitPriceOf = (p) => (p ? Number(p.wholesale ?? p.retail ?? 0) : 0)
const offerBanner = (o) => imgSrc(o.config?.banner, o.banner)
const OFFER_TYPE = { combo: 'Bundle deal', percent: 'Promo code', bxgy: 'Free units', shipping: 'Free delivery' }
// Show prices as "Rs. 800" (gap after the prefix, non-breaking) — matches the
// reference and keeps the amount from splitting across lines. No-op without "Rs.".
const padRs = (s) => String(s).replace('Rs.', 'Rs.\u00A0')

// Up to 3 deal facts: buy qty, free item (accent) and real savings (highlight).
function dealFacts(o) {
  const cfg = o.config || {}
  const linked = resolveProducts(o)
  const facts = []
  if (o.type === 'bxgy') {
    const buyQty = Number(cfg.buyQty) || 0
    const freeQty = Number(cfg.freeQty) || 0
    const fp = o.freeProduct || linked[0]
    const freeOpt = fp ? (fp.unitOptions || []).find((u) => u.unit === cfg.freeUnit) || (fp.unitOptions || [])[0] : null
    const unitPrice = freeOpt ? Number(freeOpt.price) || 0 : unitPriceOf(fp)
    const freeValue = unitPrice * freeQty
    if (buyQty) facts.push({ k: 'Khareedein', v: `${buyQty} ${unitLabelFor(cfg.mainUnit || linked[0]?.unit)}` })
    if (freeQty) facts.push({ k: 'Bilkul muft', v: `${freeQty} ${unitLabelFor(cfg.freeUnit || cfg.mainUnit || fp?.unit)}`, accent: true })
    if (freeValue) facts.push({ k: 'Aap ki bachat', v: money(freeValue), highlight: true })
  } else if (o.type === 'combo') {
    if (cfg.pct) facts.push({ k: 'Bundle discount', v: `${cfg.pct}% OFF`, highlight: true })
    if (linked.length) facts.push({ k: 'Items', v: `${linked.length} cartons` })
    facts.push({ k: 'Shart', v: 'Saare items cart mein' })
  } else if (o.type === 'percent') {
    if (cfg.pct) facts.push({ k: 'Discount', v: `${cfg.pct}% OFF`, highlight: true })
    if (cfg.minSubtotal) facts.push({ k: 'Min order', v: money(cfg.minSubtotal) })
    if (o.code) facts.push({ k: 'Code', v: o.code })
  } else if (o.type === 'shipping') {
    facts.push({ k: 'Delivery', v: cfg.minSubtotal ? `${money(cfg.minSubtotal)}+ par free` : 'Har order par free', highlight: true })
    if (cfg.minSubtotal) facts.push({ k: 'Min order', v: money(cfg.minSubtotal) })
  }
  return facts.slice(0, 3)
}

/**
 * "Khaas offers" section — extracted from the homepage so the homepage AND the
 * Products page render the exact same markup + styling (no duplication). Renders
 * nothing when there are no live offers. Uses the .eng theme, so when placed
 * outside the homepage it must sit inside an `.eng` ancestor (see ProductsPage).
 */
export default function OffersSection() {
  const offersA = useAsync(() => getOffers(), [], { cacheKey: catalogKeys.offers() })
  const offers = (!offersA.loading && Array.isArray(offersA.data) ? offersA.data : []).slice(0, 2)
  if (offersA.loading) {
    return (
      <section className="section offers" id="offers" aria-busy="true">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">Offers</span>
            <h2 className="title">Khaas offers, <span className="g">khaas dukaandaron ke liye</span></h2>
            <div className="title-ur ur">خاص آفرز، خاص دکانداروں کے لیے</div>
          </Reveal>
          <Reveal className="offer-benefits">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className="ob" aria-hidden="true">
                <span className="inline-block h-3 w-44 rounded-full bg-sand-200 align-middle" />
              </span>
            ))}
          </Reveal>
          <Reveal className="offer-grid">
            {Array.from({ length: 2 }).map((_, i) => (
              <article className="offer" key={i} aria-hidden="true">
                <div className="offer-media">
                  <div className="relative h-full w-full overflow-hidden bg-sand-100">
                    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                  </div>
                </div>
                <div className="offer-body">
                  <div className="h-4 w-3/4 rounded-full bg-sand-200" />
                  <div className="mt-3 h-3 w-full rounded-full bg-sand-100" />
                  <div className="mt-2 h-3 w-5/6 rounded-full bg-sand-100" />
                  <div className="mt-4 h-11 w-full rounded-full bg-sand-200" />
                </div>
              </article>
            ))}
          </Reveal>
          <Reveal className="offers-all">
            <span className="btn-offers-all" aria-hidden="true">
              <span className="inline-block h-4 w-28 rounded-full bg-sand-200 align-middle" />
            </span>
          </Reveal>
        </div>
      </section>
    )
  }
  // A failed request is NOT the same as "no live offers" — show an honest,
  // retryable error instead of silently dropping the whole banner section.
  if (offersA.error) {
    return (
      <section className="section offers" id="offers">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">Offers</span>
            <h2 className="title">Khaas offers, <span className="g">khaas dukaandaron ke liye</span></h2>
            <div className="title-ur ur">خاص آفرز، خاص دکانداروں کے لیے</div>
          </Reveal>
          <Reveal className="offer-grid">
            <ErrorState message="Offers load nahi huye." onRetry={offersA.reload} />
          </Reveal>
        </div>
      </section>
    )
  }
  if (offers.length === 0) return null

  return (
    <section className="section offers" id="offers">
      <div className="wrap">
        <Reveal>
          <span className="eyebrow">Offers</span>
          <h2 className="title">Khaas offers, <span className="g">khaas dukaandaron ke liye</span></h2>
          <div className="title-ur ur">خاص آفرز، خاص دکانداروں کے لیے</div>
        </Reveal>
        <Reveal className="offer-benefits">
          {[
            'Save up to Rs. 2,000 on bulk orders',
            'Exclusive wholesale pricing',
            'Higher profit on every purchase',
            'Limited-time promotional deals',
          ].map((b) => (
            <span className="ob" key={b}><Check /> {b}</span>
          ))}
        </Reveal>
        <Reveal className="offer-grid">
          {offers.map((o, i) => {
            const facts = dealFacts(o)
            const urdu = dealUrdu(o)
            const linked = resolveProducts(o)
            const cols = facts.length === 1 ? ' one' : facts.length === 2 ? ' two' : ''
            return (
              <article className="offer" key={o.id || o.slug || i}>
                <div className="offer-media">
                  <img src={offerBanner(o)} alt={o.title} loading="lazy" onError={onImgError} />
                  <span className="offer-type">{OFFER_TYPE[o.type] || 'Special offer'}</span>
                  {(o.save || o.save_label) && <span className="offer-save">{o.save || o.save_label}</span>}
                </div>
                <div className="offer-body">
                  <h3>{o.title}</h3>
                  {urdu && <div className="offer-ur ur">{urdu}</div>}
                  {(o.description || o.desc) && <p>{o.description || o.desc}</p>}
                  {linked[0] && <MrpPerPiece product={linked[0]} size="sm" />}
                  {facts.length > 0 && (
                    <div className={`offer-facts${cols}`}>
                      {facts.map((f) => (
                        <div className={`fact${f.highlight ? ' highlight' : f.accent ? ' accent' : ''}`} key={f.k}>
                          <span className="k">{f.k}</span>
                          <span className="v">{padRs(f.v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Link
                    className="offer-cta"
                    to={o.slug ? { pathname: '/offers', search: `?offer=${encodeURIComponent(o.slug)}` } : '/offers'}
                    state={o.slug ? { scrollToOffer: true } : undefined}
                  >
                    Deal dekhein
                    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
                  </Link>
                </div>
              </article>
            )
          })}
        </Reveal>
        <Reveal className="offers-all">
          <Link className="btn-offers-all" to="/offers">
            View All Offers
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
          </Link>
        </Reveal>
      </div>
    </section>
  )
}
