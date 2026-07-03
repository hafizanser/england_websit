import { memo, useEffect, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import {
  Tag,
  ArrowRight,
  ArrowDown,
  Check,
  ShoppingBagOpen,
  Sparkle,
  Clock,
  Fire,
  Percent,
  Gift,
  Truck,
  PlusCircle,
  SealCheck,
  WhatsappLogo,
  Copy,
  ChatCircleDots,
} from '@phosphor-icons/react'
import PageBanner from '../components/PageBanner'
import { SectionHeading, EmptyState, ErrorState } from '../components/ui'
import { getOffers } from '../api/offers'
import { useAsync } from '../hooks/useAsync'
import { useNotify } from '../context/NotifyContext'
import { products, commerce } from '../data/site'
import { money, unitLabelFor } from '../lib/cartEngine'
import { waLink } from '../lib/whatsapp'
import { imgSrc, onImgError } from '../lib/img'
import MrpPerPiece from '../components/MrpPerPiece'
import { dealUrdu } from '../lib/offerUrdu'
import { fadeUp, stagger } from '../lib/motion'

const productMap = new Map(products.map((p) => [p.id, p]))

// Admin offers embed their resolved storefront products (mainProduct/freeProduct);
// seeded offers reference bundled product ids. Support both.
const resolveProducts = (offer) => {
  if (offer.mainProduct) return [offer.mainProduct, offer.freeProduct].filter(Boolean)
  return (offer.productIds || []).map((id) => productMap.get(id)).filter(Boolean)
}

// The unit option on the main product that the offer is priced in.
const mainUnitOption = (offer) => {
  const p = offer.mainProduct
  if (!p) return null
  return (p.unitOptions || []).find((o) => o.unit === offer.config?.mainUnit) || (p.unitOptions || [])[0] || null
}

// Per-unit price for a catalogue product (wholesale is the shopkeeper rate).
const unitPriceOf = (p) => (p ? Number(p.wholesale ?? p.retail ?? 0) : 0)

// Use the admin-set banner image when present, else a themed placeholder.
const bannerOf = (offer) => imgSrc(offer.config?.banner, offer.banner)

const typeMeta = {
  combo: { icon: Gift, label: 'Bundle deal' },
  percent: { icon: Percent, label: 'Promo code' },
  bxgy: { icon: Sparkle, label: 'Free units' },
  shipping: { icon: Truck, label: 'Free delivery' },
}

// Render a price with a thin gap after the "Rs." prefix ("Rs. 800", matching the
// reference) and a non-breaking space so the amount never splits across lines —
// fixes the cramped "Rs.800" under font-extrabold. No-op on non-price strings.
const padRs = (s) => String(s).replace('Rs.', 'Rs.\u00A0')

// The three bordered info boxes (KHAREEDEIN / BILKUL MUFT / AAP KI BACHAT …).
// Derived from the offer config + product unit pricing. Savings fall back to the
// wholesale price when an offer has no explicit unit option (seeded offers).
function dealFacts(offer) {
  const cfg = offer.config || {}
  const linked = resolveProducts(offer)
  const facts = []
  if (offer.type === 'bxgy') {
    const buyQty = Number(cfg.buyQty) || 0
    const freeQty = Number(cfg.freeQty) || 0
    const fp = offer.freeProduct || linked[0]
    const freeOpt = fp ? (fp.unitOptions || []).find((o) => o.unit === cfg.freeUnit) || (fp.unitOptions || [])[0] : null
    const unitPrice = freeOpt ? Number(freeOpt.price) || 0 : unitPriceOf(fp)
    const freeValue = unitPrice * freeQty
    if (buyQty) facts.push({ k: 'Khareedein', v: `${buyQty} ${unitLabelFor(cfg.mainUnit || linked[0]?.unit)}` })
    if (freeQty) facts.push({ k: 'Bilkul muft', v: `${freeQty} ${unitLabelFor(cfg.freeUnit || cfg.mainUnit || fp?.unit)}`, accent: true })
    if (freeValue) facts.push({ k: 'Aap ki bachat', v: money(freeValue), highlight: true })
  } else if (offer.type === 'combo') {
    if (cfg.pct) facts.push({ k: 'Bundle discount', v: `${cfg.pct}% OFF`, highlight: true })
    facts.push({ k: 'Items', v: `${linked.length} cartons` })
    facts.push({ k: 'Shart', v: 'Saare items cart mein' })
  } else if (offer.type === 'percent') {
    if (cfg.pct) facts.push({ k: 'Discount', v: `${cfg.pct}% OFF`, highlight: true })
    if (cfg.minSubtotal) facts.push({ k: 'Min order', v: money(cfg.minSubtotal) })
    if (offer.code) facts.push({ k: 'Code', v: offer.code })
  } else if (offer.type === 'shipping') {
    facts.push({ k: 'Delivery', v: cfg.minSubtotal ? `${money(cfg.minSubtotal)}+ par free` : 'Har order par free', highlight: true })
    if (cfg.minSubtotal) facts.push({ k: 'Min order', v: money(cfg.minSubtotal) })
  }
  return facts.slice(0, 3)
}

// Plain-language savings context (Fix F): "{buy} = Rs.{total} · Aap bachayein Rs.{x}".
function dealEconomics(offer) {
  const cfg = offer.config || {}
  const linked = resolveProducts(offer)
  if (offer.type === 'bxgy') {
    const main = linked[0]
    const buyQty = Number(cfg.buyQty) || 0
    const freeQty = Number(cfg.freeQty) || 0
    if (!main || !buyQty) return null
    // Price the offer in its ACTUAL unit option (carton/box/bundle), not the base
    // wholesale — so "5 Carton = …" is (carton price × 5), and the savings equal the
    // free item's value shown in the AAP KI BACHAT tile (identical maths to dealFacts).
    const mainOpt = (main.unitOptions || []).find((o) => o.unit === cfg.mainUnit) || (main.unitOptions || [])[0] || null
    const mainPrice = mainOpt ? Number(mainOpt.price) || 0 : unitPriceOf(main)
    const fp = offer.freeProduct || main
    const freeOpt = (fp.unitOptions || []).find((o) => o.unit === cfg.freeUnit) || (fp.unitOptions || [])[0] || null
    const freePrice = freeOpt ? Number(freeOpt.price) || 0 : unitPriceOf(fp)
    return {
      context: `${buyQty} ${unitLabelFor(cfg.mainUnit || main.unit)} = ${money(mainPrice * buyQty)}`,
      savings: freePrice * freeQty, // = free item value → matches the AAP KI BACHAT tile
    }
  }
  if (offer.type === 'combo') {
    const bundleTotal = linked.reduce((s, p) => s + unitPriceOf(p), 0)
    const pct = Number(cfg.pct) || 0
    if (!bundleTotal || !pct) return null
    return { context: `Bundle = ${money(bundleTotal)}`, savings: Math.round((bundleTotal * pct) / 100) }
  }
  if (offer.type === 'percent') {
    const min = Number(cfg.minSubtotal) || 0
    const pct = Number(cfg.pct) || 0
    if (!min || !pct) return null
    return { context: `${money(min)}+ par ${pct}% off`, savings: Math.round((min * pct) / 100) }
  }
  if (offer.type === 'shipping') {
    const min = Number(cfg.minSubtotal) || 0
    return { context: min ? `${money(min)}+ order par` : 'Har order par', savings: commerce.deliveryFee }
  }
  return null
}

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
}

// A genuine urgency signal (Fix G). Dated expiries become a real "{n} din baqi"
// countdown; stock-limited deals say so; always-on deals surface their real terms
// rather than a fake clock.
function urgencyOf(offer) {
  const exp = String(offer.expiry || '')
  const m = exp.match(/(\d{1,2})\s+([A-Za-z]+)/)
  if (m && MONTHS[m[2].toLowerCase()] != null) {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let target = new Date(now.getFullYear(), MONTHS[m[2].toLowerCase()], Number(m[1]))
    if (target < today) target = new Date(now.getFullYear() + 1, MONTHS[m[2].toLowerCase()], Number(m[1]))
    const days = Math.round((target - today) / 86400000)
    if (days >= 0) return { label: days === 0 ? 'Aaj akhri din' : `${days} din baqi`, urgent: days <= 7 }
  }
  if (/stock/i.test(exp)) return { label: 'Stock khatam hone tak', urgent: true }
  return { label: exp || 'Limited time offer', urgent: false }
}

// ---- Deal enquiry action ----------------------------------------------------
// The purchase flow is now a WhatsApp enquiry (prices are hidden). Each deal's
// button opens WhatsApp pre-filled with the offer so the shopkeeper can ask for
// the rate and how to avail it. A short unit hint (e.g. "3 Carton + 1 Carton
// free") is appended when the offer defines one.
function dealHint(offer) {
  const cfg = offer.config || {}
  if (offer.type === 'bxgy') {
    const p = offer.mainProduct || resolveProducts(offer)[0]
    const buyQty = Number(cfg.buyQty) || 1
    const freeQty = Number(cfg.freeQty) || 0
    const mu = unitLabelFor(cfg.mainUnit || p?.unit)
    const fu = unitLabelFor(cfg.freeUnit || cfg.mainUnit || p?.unit)
    return `${buyQty} ${mu} + ${freeQty} ${fu} free`
  }
  if (offer.type === 'combo') {
    const n = resolveProducts(offer).length
    return n ? `${n} cartons bundle` : null
  }
  if (offer.type === 'percent' && offer.code) return `Code: ${offer.code}`
  return null
}

function dealEnquiryHref(offer) {
  const hint = dealHint(offer)
  const msg =
    `Assalam-o-Alaikum,\n` +
    `Main is offer mein interested hoon.\n\n` +
    `Offer: ${offer.title}\n` +
    (hint ? `Deal: ${hint}\n` : '') +
    `\nPlease price aur availability share kar dein. Shukriya.`
  return waLink(msg)
}

function DealCardAction({ offer }) {
  const hint = dealHint(offer)
  return (
    <a
      href={dealEnquiryHref(offer)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex w-full min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-2xl bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white shadow-soft ring-1 ring-inset ring-white/20 transition-all hover:bg-[#1ebe5d] hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1ebe5d]"
    >
      <span className="inline-flex items-center gap-2">
        <WhatsappLogo size={17} weight="fill" /> WhatsApp pe poochein
      </span>
      {hint && <span className="text-[11px] font-medium opacity-90">({hint})</span>}
    </a>
  )
}

// Copyable promo code chip (Fix J). Non-percent codes auto-apply from the cart;
// percent codes must be entered — labelled accordingly.
function CodeChip({ code, auto }) {
  const { toast } = useNotify()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      toast(`Code ${code} copy ho gaya`)
    } catch {
      toast(`Code: ${code}`, 'info')
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Code ${code} copy karein`}
      title="Code copy karein"
      className="inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-brand-300 bg-sand-50 px-2.5 py-1 text-[11px] font-bold tracking-wider text-brand-700 transition-colors hover:bg-sand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-400"
    >
      {auto ? 'Auto' : 'Code'}: {code} <Copy size={12} weight="bold" />
    </button>
  )
}

// ---- One DealCard for featured AND active (Fixes A, B, C, E) ----------------
// memo()'d + cart-free, so a cart change only re-renders the inner action button.
const DealCard = memo(function DealCard({ offer, featured = false, motionSafe = true }) {
  const meta = typeMeta[offer.type] || typeMeta.percent
  const Icon = meta.icon
  const linked = resolveProducts(offer)
  const facts = dealFacts(offer)
  const econ = dealEconomics(offer)
  const urg = urgencyOf(offer)
  const urdu = dealUrdu(offer)

  return (
    <motion.article
      id={offer.slug}
      {...(motionSafe ? { variants: fadeUp } : {})}
      className={`group flex h-full scroll-mt-28 flex-col overflow-hidden rounded-3xl bg-white shadow-soft ${
        featured ? 'border border-saffron-200 ring-1 ring-saffron-100' : 'border border-brand-100'
      }`}
    >
      {/* Banner — full-colour image, fixed aspect ratio (no CLS, Fix C/M). Only a
          light top scrim for badge legibility — no full-cover wash. */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-sand-100">
        <img
          src={bannerOf(offer)}
          alt={offer.title}
          loading="lazy"
          onError={onImgError}
          width="800"
          height="450"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/35 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-800 shadow-soft backdrop-blur">
            <Icon size={12} weight="fill" /> {offer.kicker}
          </span>
          <span className="rounded-full bg-saffron-300 px-3 py-1 text-sm font-extrabold text-brand-950 shadow-soft">
            {offer.save}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        {/* type badge (FREE UNITS / Bundle deal / …) */}
        <span className={`inline-flex w-max items-center gap-1.5 rounded-full bg-gradient-to-br ${offer.theme} px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white`}>
          <Icon size={12} weight="fill" /> {meta.label}
        </span>

        <div>
          <h3 className="text-lg font-extrabold leading-tight tracking-tight text-brand-950">{offer.title}</h3>
          {urdu && (
            <p dir="rtl" className="urdu mt-1.5 text-right text-[15px] text-brand-700" style={{ lineHeight: 1.85 }}>{urdu}</p>
          )}
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-brand-600">{offer.desc}</p>
        </div>

        {/* product thumbnails + name line */}
        {linked.length > 0 && (
          <div className="flex items-center gap-2.5">
            <div className="flex -space-x-3">
              {linked.map((p) => (
                <img
                  key={p.id}
                  src={imgSrc(p.image)}
                  alt={p.name}
                  loading="lazy"
                  onError={onImgError}
                  width="40"
                  height="40"
                  className="h-10 w-10 rounded-xl border-2 border-white object-cover shadow-soft"
                />
              ))}
            </div>
            <span className="line-clamp-1 text-xs font-medium text-brand-500">{linked.map((p) => p.name).join(' + ')}</span>
          </div>
        )}

        {/* MRP per piece for the offer's product (selling prices are hidden). */}
        {linked[0] && <MrpPerPiece product={linked[0]} size="sm" />}

        {/* 3 bordered info boxes */}
        {facts.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {facts.map((f) => (
              <div key={f.k} className="rounded-xl bg-sand-50 px-3 py-2.5 ring-1 ring-brand-100">
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-brand-400">{f.k}</p>
                <p className={`mt-1 text-[15.5px] font-extrabold leading-tight tabular-nums ${f.highlight ? 'text-green-700' : f.accent ? 'text-red-600' : 'text-brand-900'}`}>{padRs(f.v)}</p>
              </div>
            ))}
          </div>
        )}

        {/* savings clarity line (Fix F) */}
        {econ && (
          <p className="text-[13px] leading-normal text-green-700 tabular-nums">
            <span className="font-semibold">{padRs(econ.context)}</span>
            <span aria-hidden="true" className="px-1.5 text-green-600/60">·</span>
            <span className="whitespace-nowrap font-extrabold text-green-800">Aap bachayein {padRs(money(econ.savings))}</span>
          </p>
        )}

        {/* shartein checklist (consistent on every card, Fix E) */}
        {offer.terms?.length > 0 && (
          <ul className="space-y-1.5">
            {offer.terms.slice(0, 3).map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-brand-600">
                <SealCheck size={15} weight="fill" className="mt-0.5 shrink-0 text-brand-400" />
                {t}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto space-y-3 border-t border-brand-100 pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${urg.urgent ? 'text-saffron-700' : 'text-brand-500'}`}>
              {urg.urgent ? <Fire size={14} weight="fill" /> : <Clock size={13} weight="fill" />} {urg.label}
            </span>
            {offer.code && <CodeChip code={offer.code} auto={offer.type !== 'percent'} />}
          </div>
          <DealCardAction offer={offer} />
        </div>
      </div>
    </motion.article>
  )
})

// Loading skeleton matching the real DealCard layout (Fix L/M — no CLS).
function DealCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft">
      <div className="aspect-[16/9] w-full animate-pulse bg-sand-200" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="h-4 w-24 animate-pulse rounded-full bg-sand-200" />
        <div className="h-5 w-4/5 animate-pulse rounded-full bg-sand-200" />
        <div className="h-3 w-full animate-pulse rounded-full bg-sand-100" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-sand-100" />
          ))}
        </div>
        <div className="mt-2 h-11 animate-pulse rounded-2xl bg-sand-200" />
      </div>
    </div>
  )
}

// Hero CTA block — scrolls to the deals grid. A WhatsApp button sits beside it so
// shoppers can enquire straight away.
function HeroActions({ reduce }) {
  const scrollToDeals = () => {
    const el = document.getElementById('deals')
    if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={scrollToDeals}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-saffron-400 px-5 py-3 text-sm font-bold text-brand-950 shadow-glow transition-all hover:bg-saffron-300 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <ArrowDown size={18} weight="bold" /> Deals dekhein
      </button>
      <a
        href={waLink('Assalam o alaikum! England ki current offers ke baare mein maloomat chahiye.')}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-[#1ebe5d] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <WhatsappLogo size={18} weight="fill" /> WhatsApp pe poochein
      </a>
    </div>
  )
}

const steps = [
  { icon: ShoppingBagOpen, title: 'Deal chunein', text: 'Apni pasand ki offer ya products dekhein.' },
  { icon: Tag, title: 'WhatsApp par poochein', text: 'Offer ka rate aur tafseel WhatsApp par lein.' },
  { icon: Truck, title: 'Agle din delivery', text: 'Order confirm — seedha dukaan par maal.' },
]

export default function OffersPage() {
  const reduce = useReducedMotion()
  // Single data source, single main section (no featured/active split). Every offer
  // is shown once; featured deals are floated to the front and keep their original
  // gold-accented card styling via the `featured` prop.
  const { data, loading, error, reload } = useAsync(() => getOffers(), [])

  const offersList = useMemo(() => {
    const list = Array.isArray(data) ? data : []
    const rank = (o) => (o.featured === 'lg' ? 0 : o.featured ? 1 : 2)
    return [...list].sort((a, b) => rank(a) - rank(b))
  }, [data])

  // Reveal the grid as soon as the offers are loaded — an on-render animation
  // (same fadeUp + stagger keyframes) rather than a scroll/viewport trigger. A
  // whileInView + once observer raced the async load: it could resolve during the
  // skeleton phase and disconnect, leaving the real cards stuck at opacity:0 (the
  // "blank until manual refresh" bug). Animating on mount is deterministic.
  const containerMotion = reduce
    ? {}
    : { variants: stagger(0.06), initial: 'hidden', animate: 'show' }

  // When arriving via the homepage "View All Offers" button (/offers#offers-grid),
  // smoothly scroll to the offers grid so the deal banners sit fully below the
  // sticky navbar (the grid's scroll-mt-24 supplies the top offset).
  const { hash } = useLocation()
  useEffect(() => {
    if (hash !== '#offers-grid') return undefined
    const el = document.getElementById('offers-grid')
    if (!el) return undefined
    const raf = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    })
    return () => cancelAnimationFrame(raf)
  }, [hash, reduce])

  return (
    <>
      <PageBanner
        eyebrow="Limited Time Deals"
        title="Khaas Offers,"
        accent="Khaas Dukaandaron Ke Liye"
        urdu="بچت کا سنہری موقع"
        desc="Bundle deals, promo codes aur seasonal discounts — ek hi jagah. Cart mein daalein, code lagayein, foran bachat."
        crumb="Offers"
        image="/banner.jpg"
        tone="gold"
        chips={[
          { icon: Gift, label: 'Bundle deals' },
          { icon: Percent, label: 'Promo codes' },
          { icon: Truck, label: 'Free delivery' },
        ]}
      >
        <HeroActions reduce={reduce} />
      </PageBanner>

      {/* All offers — one main section, exactly 2 cards per row on desktop */}
      <section id="deals" className="scroll-mt-24 bg-white py-12 sm:py-16">
        <div className="container-page">
          <SectionHeading
            eyebrow="Saari Offers"
            title="Tamam"
            accent="active deals"
            urdu="تمام آفرز ایک جگہ"
            desc="Har deal ke sath uski shartein aur code — seedha cart mein lagayein."
          />

          {/* how it works */}
          <div className="mt-8 grid gap-3 rounded-4xl border border-brand-100 bg-white p-5 shadow-soft sm:grid-cols-3 sm:gap-6 sm:p-7">
            {steps.map((s, i) => (
              <div key={s.title} className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                  <s.icon size={22} weight="fill" />
                </span>
                <div>
                  <p className="flex items-center gap-2 text-sm font-bold text-brand-900">
                    <span className="text-saffron-500">0{i + 1}</span> {s.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-brand-500">{s.text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* single offers grid — exactly 2 per row on desktop & tablet, 1 on mobile.
              Loading / error / empty render in a plain container; the animated grid
              mounts ONLY once the cards exist, so the reveal fires deterministically
              on load instead of racing a viewport observer. */}
          {loading && (
            <div id="offers-grid" className="mt-8 grid scroll-mt-24 gap-5 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => <DealCardSkeleton key={i} />)}
            </div>
          )}

          {!loading && error && (
            <div id="offers-grid" className="mt-8 grid scroll-mt-24 gap-5 sm:grid-cols-2">
              <ErrorState message="Offers load nahi huye — dobara try karein." onRetry={reload} />
            </div>
          )}

          {!loading && !error && offersList.length === 0 && (
            <div id="offers-grid" className="mt-8 grid scroll-mt-24 gap-5 sm:grid-cols-2">
              <EmptyState
                icon={Tag}
                title="Abhi koi active offer nahi"
                text="WhatsApp pe poochein ya products dekhein — nayi deals jald aa rahi hain."
                action={
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    <a
                      href={waLink('Assalam o alaikum! England ki current offers ke baare mein maloomat chahiye.')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1ebe5d] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1ebe5d]"
                    >
                      <ChatCircleDots size={17} weight="fill" /> WhatsApp pe poochein
                    </a>
                    <Link
                      to="/products"
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-brand-200 px-5 py-2.5 text-sm font-bold text-brand-800 transition-colors hover:bg-sand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-400"
                    >
                      Products dekhein <ArrowRight size={16} weight="bold" />
                    </Link>
                  </div>
                }
              />
            </div>
          )}

          {!loading && !error && offersList.length > 0 && (
            <motion.div {...containerMotion} id="offers-grid" className="mt-8 grid scroll-mt-24 gap-5 sm:grid-cols-2">
              {offersList.map((offer) => (
                <DealCard key={offer.id} offer={offer} featured={Boolean(offer.featured)} motionSafe={!reduce} />
              ))}
            </motion.div>
          )}

          {/* Enquiry band — order any deal over WhatsApp */}
          <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-4xl bg-brand-950 p-6 text-white sm:flex-row sm:p-8">
            <div>
              <p className="text-lg font-extrabold tracking-tight">Koi deal pasand aayi?</p>
              <p className="text-sm text-white/70">WhatsApp par poochein — rate aur availability foran mil jayegi.</p>
            </div>
            <a
              href={waLink('Assalam o alaikum! England ki offers ke baare mein maloomat chahiye.')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-bold text-white shadow-glow transition-all hover:bg-[#1ebe5d] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <WhatsappLogo size={18} weight="fill" /> WhatsApp pe poochein
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
