import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { brand } from '../data/site'
import { useCart } from '../context/CartContext'
import { useAsync } from '../hooks/useAsync'
import { getCategories, getTopSelling } from '../api/catalog'
import { getFeaturedReviews } from '../api/reviews'
import { deliveryCities } from '../components/CitiesDelivery'
import { money, unitLabelFor } from '../lib/cartEngine'
import { imgSrc, onImgError } from '../lib/img'
import VideoReviews from '../components/VideoReviews'
import OffersSection from '../components/OffersSection'
import { Reveal, Check } from '../components/Reveal'

// Single WhatsApp number (mirrors the brand contact).
const waHref = (t) =>
  `https://wa.me/${brand.whatsapp.replace(/[^0-9]/g, '')}${t ? `?text=${encodeURIComponent(t)}` : ''}`

// ---- inline icons -----------------------------------------------------------
const Wa = (p) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.59 5.391l-.999 3.648 3.909-1.026z" /></svg>)
const Pin = (p) => (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M12 21s7-6.5 7-11a7 7 0 10-14 0c0 4.5 7 11 7 11z" /><circle cx="12" cy="10" r="2.4" /></svg>)
const Arrow = (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="m9 18 6-6-6-6" /></svg>)

const heroStats = [
  { n: '12,400', s: '+', l: 'Active dukaandaar', ur: 'دکاندار' },
  { n: '50', s: '+', l: 'Cities mein delivery', ur: 'شہر' },
  { n: '30', s: '+', l: 'Products available', ur: 'پروڈکٹس' },
  { n: '98.', s: '4%', l: 'On-time delivery', ur: 'وقت پر' },
]

// Smooth count-up for a stat value. Animates 0→target once the number scrolls
// into view (self-observing, so it's independent of the Reveal wrapper). Preserves
// the original formatting: thousands commas (12,400) and any trailing non-digit
// like the dot in '98.' (which joins the '4%' suffix → 98.4%). Honors reduced motion.
function CountUp({ value }) {
  const ref = useRef(null)
  const hasComma = value.includes(',')
  const trailing = value.match(/[^\d,]+$/)?.[0] || ''
  const target = parseInt(value.replace(/[^\d]/g, ''), 10) || 0
  const [n, setN] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(target)
      return undefined
    }
    let raf = 0
    let t0 = 0
    const DUR = 1500
    const ease = (t) => 1 - Math.pow(1 - t, 3) // easeOutCubic — fast then settles
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const tick = (ts) => {
        if (!t0) t0 = ts
        const p = Math.min((ts - t0) / DUR, 1)
        setN(Math.round(ease(p) * target))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    io.observe(el)
    return () => { io.disconnect(); if (raf) cancelAnimationFrame(raf) }
  }, [target])

  return <span ref={ref}>{(hasComma ? n.toLocaleString('en-US') : String(n)) + trailing}</span>
}

const features = [
  { t: 'Wholesale rate', d: <>Seedha factory rate — beech ka koi munafa nahi, isliye aapka margin <b>22% tak</b>.</>, icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3h4" /></svg>) },
  { t: 'Agle din delivery', d: 'Aaj order, kal subah maal dukaan pe — dukaan band kiye baghair.', icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z" /><circle cx="6.5" cy="17" r="1.8" /><circle cx="17.5" cy="17" r="1.8" /></svg>) },
  { t: 'Asli maal guarantee', d: '100% original England products — nakli maal ka risk khatam, customer ka bharosa qaim.', icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></svg>) },
  { t: 'Apna sales rep', d: 'Har city mein ek banda jo aapka order aur masla foran handle kare.', icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 11a4 4 0 10-8 0M3 20a7 7 0 0118 0M19 7l1.5 1.5L23 6" /></svg>) },
]

const steps = [
  { n: '1', t: 'Maal chuno ya list bhejo', ur: 'سامان منتخب کریں', p: 'Catalog se add karein ya seedha WhatsApp pe apni list bhej dein — jaise aap likhte ho waise hi.' },
  { n: '2', t: 'Order confirm', ur: 'آرڈر کنفرم', p: 'Rate aur total foran confirm — koi advance nahi, delivery pe payment.' },
  { n: '3', t: 'Agle din dukaan pe', ur: 'اگلے دن ڈلیوری', p: 'Seedha aapki dukaan pe maal — shelf ready, sale ready.' },
]

// ---- product card -----------------------------------------------------------
function HomeProduct({ p, onAdd }) {
  const options = p.unitOptions && p.unitOptions.length
    ? p.unitOptions
    : [{ unit: p.unit, label: unitLabelFor(p.unit), price: p.wholesale, retail: p.retail }]
  const [unit, setUnit] = useState(() => options.reduce((a, b) => (Number(b.price) > Number(a.price) ? b : a), options[0]).unit)
  const sel = options.find((o) => o.unit === unit) || options[0]
  const img = imgSrc(p.images && p.images[0], p.image)

  return (
    <article className="card">
      <div className="media">
        {p.badge && <span className="tag-best">{p.badge}</span>}
        <Link to={`/product/${p.id}`} aria-label={p.name}><img src={img} alt={p.name} loading="lazy" onError={onImgError} /></Link>
      </div>
      <div className="body">
        <span className="cat">{p.category}</span>
        <Link to={`/product/${p.id}`} className="name">{p.name}</Link>
        {options.length > 1 && (
          <div className="unit-toggle">
            {options.map((o) => (
              <button key={o.unit} className={o.unit === unit ? 'active' : ''} onClick={() => setUnit(o.unit)}>{o.label}</button>
            ))}
          </div>
        )}
        <div className="price"><span className="amt">{money(sel.price)}</span><span className="per">/ {sel.label}</span></div>
        <button className="btn btn-wa order-btn" onClick={() => onAdd(p, 1, sel)}>Order karein</button>
      </div>
    </article>
  )
}

// ---- partner (collapsible) --------------------------------------------------
function Partner() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ shop: '', wa: '', city: '' })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const send = () => {
    let msg = 'Partner banna hai.'
    if (form.shop) msg += ` Dukaan: ${form.shop}.`
    if (form.city) msg += ` Sheher: ${form.city}.`
    if (form.wa) msg += ` WhatsApp: ${form.wa}.`
    window.open(waHref(msg), '_blank', 'noopener')
  }
  return (
    <section className="section partner" id="partner">
      <div className="wrap">
        <button className="partner-toggle reveal in" aria-expanded={open} aria-controls="partnerPanel" onClick={() => setOpen((o) => !o)}>
          <div className="lt">
            <h3>Partner banna chahte ho? <span style={{ color: 'var(--gold)' }}>Chhoti dukaan, bara munafa</span></h3>
            <p>England ke saath asli maal seedha wholesale rate pe apni dukaan pe mangwaayein. Tap karke form kholein.</p>
          </div>
          <span className="chev"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg></span>
        </button>
        <div className="partner-panel" id="partnerPanel" style={{ maxHeight: open ? 900 : 0 }}>
          <div className="partner-inner">
            <div className="pstats">
              <div className="pstat"><div className="n">22%</div><div className="l">average margin dukaandaaron ke liye</div></div>
              <div className="pstat"><div className="n">24h</div><div className="l">mein order aapki dukaan pe</div></div>
            </div>
            <div className="field"><label htmlFor="p-shop">Dukaan ka naam</label><input id="p-shop" type="text" value={form.shop} onChange={set('shop')} placeholder="Misaal: Bilal Kiryana Store" /></div>
            <div className="field"><label htmlFor="p-wa">WhatsApp number</label><input id="p-wa" type="tel" inputMode="numeric" value={form.wa} onChange={set('wa')} placeholder="03xx xxxxxxx" /></div>
            <div className="field"><label htmlFor="p-city">Sheher</label><input id="p-city" type="text" value={form.city} onChange={set('city')} placeholder="Misaal: Faisalabad" /></div>
            <button type="button" className="btn btn-wa btn-block" onClick={send}><Wa className="ico" /> Partner banein — abhi</button>
            <div className="form-trust">
              <span className="t"><Check /> Koi advance nahi</span>
              <span className="t"><Check /> Min order kam</span>
              <span className="t"><Check /> Kabhi bhi band kar sakte ho</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  const { add } = useCart()
  const cats = useAsync(() => getCategories(), [])
  const products = useAsync(() => getTopSelling(), [])
  const reviewsA = useAsync(() => getFeaturedReviews(12), [])

  const catList = (cats.data || []).slice(0, 7)
  const top = (products.data || []).filter((p) => p.active !== 0).slice(0, 4)
  const reviews = (reviewsA.data || []).slice(0, 8)
  const cityList = deliveryCities.slice(0, 11)

  // Seamless marquee loops: a base wide enough to exceed the viewport, repeated
  // twice (the -50% keyframe shifts by exactly one base, so the loop is seamless).
  const revBase = reviews.length >= 5 ? reviews : [...reviews, ...reviews]
  const revLoop = [...revBase, ...revBase]
  const cityBase = [...cityList, '__more__']
  const cityLoop = [...cityBase, ...cityBase]

  return (
    <div className="eng" id="top">
      {/* ===== HERO ===== */}
      <section className="hero">
        <div className="wrap hero-grid">
          <Reveal>
            <span className="eyebrow">Pakistan ka apna FMCG partner</span>
            <h1>Aaj order, <span className="g">kal subah maal</span> — dukaan band kiye baghair.</h1>
            <div className="h1-ur ur">آج آرڈر، کل صبح مال</div>
            <p className="sub">Asli England maal, fixed wholesale rate. Ek WhatsApp message pe <b>50+ cities mein agle din delivery</b> — 30+ products ek hi jagah.</p>

            <div className="proof-strip">
              <span className="proof-item"><span className="stars">★★★★★</span><b>4.9</b></span>
              <span className="dot" />
              <span className="proof-pm">
                <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m3 17 6-6 4 4 8-8" /><path d="M17 7h4v4" /></svg>
                <b>70%</b><span className="sm">Profit Margin</span>
              </span>
              <span className="dot" />
              <span className="proof-item">12,400+ <span className="pm">dukaandaar</span></span>
              <span className="proof-hero">
                <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></svg>
                <b>96.7%</b><span className="sm">dobara order</span>
              </span>
              <span className="dot" />
              <span className="proof-item">98.4% <span className="pm">on-time</span></span>
            </div>

            <div className="hero-cta">
              <a className="btn btn-wa" href={waHref('Assalam-o-alaikum, mujhe order karna hai')} target="_blank" rel="noopener noreferrer"><Wa className="ico" /> WhatsApp pe order — 30 sec</a>
              <Link className="btn btn-outline" to="/products"><svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h12" /></svg> Catalog kholo &amp; order</Link>
            </div>

            <div className="trust-row">
              <span className="t"><Check /> Asli maal guarantee</span>
              <span className="t"><Check /> Rs. 5,000+ order pe free delivery</span>
              <span className="t"><Check /> Agle din delivery</span>
            </div>
          </Reveal>

          <Reveal className="hero-visual">
            <img src="/banner.jpg" alt="England product range" loading="eager" />
            <div className="hero-badge">
              <span className="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg></span>
              <span><span className="mini">Ek hi jagah</span>30+ Products</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== STATS ===== */}
      <section className="wrap" style={{ paddingBlock: '8px 0' }}>
        <Reveal className="stats">
          {heroStats.map((s) => (
            <div className="stat" key={s.l}>
              <div className="n"><CountUp value={s.n} /><span className="g">{s.s}</span></div>
              <div className="l">{s.l}</div>
              <div className="wm">{s.ur}</div>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ===== TOP SELLING / PRODUCTS ===== */}
      <section className="section" id="products">
        <div className="wrap">
          <Reveal className="sec-head">
            <div>
              <span className="eyebrow">Top selling · Reorder</span>
              <h2 className="title">Sabse zyada bikne wale <span className="g">products</span></h2>
              <div className="title-ur ur">سب سے زیادہ بکنے والے</div>
              <p className="lead">Wahi maal jo aapke customer roz maangte hain — fixed wholesale rate pe, agle din dukaan pe.</p>
            </div>
            <div className="right"><Link className="btn btn-outline" to="/products">Saara catalog</Link></div>
          </Reveal>
          <Reveal className="prod-grid">
            {top.map((p) => <HomeProduct key={p.id} p={p} onAdd={add} />)}
          </Reveal>
        </div>
      </section>

      {/* ===== CATEGORIES ===== */}
      <section className="section" id="categories" style={{ background: 'var(--cream-soft)', borderBlock: '1px solid var(--line)' }}>
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">Categories</span>
            <h2 className="title">Har dukaan ka <span className="g">poora saaman</span></h2>
            <div className="title-ur ur">ہر دکان کا پورا سامان</div>
            <p className="lead">Tissue se le kar agarbatti, razor, hair color aur soap tak — sab kuch ek hi catalog mein.</p>
          </Reveal>
          <Reveal className="cat-grid">
            {catList.map((c) => (
              <Link className="cat-card" key={c.id} to={`/products?cat=${c.id}`}>
                <div className="media"><img src={imgSrc(c.image)} alt={c.name} loading="lazy" onError={onImgError} /></div>
                <div className="row"><b>{c.name}</b><span className="arr"><Arrow /></span></div>
              </Link>
            ))}
            <Link className="cat-card more" to="/products"><div className="n">30+</div><div>aur products dekhein</div><div className="ur">سب کچھ دیکھیں</div></Link>
          </Reveal>
        </div>
      </section>

      {/* ===== OFFERS ===== */}
      <OffersSection />

      {/* ===== PROBLEM / SOLUTION ===== */}
      <section className="section pas">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow on-dark">Problem</span>
            <h2 className="title" style={{ color: '#fff' }}>Maal ke liye <span className="g">mandi ke chakkar?</span></h2>
          </Reveal>
          <Reveal className="grid">
            <div className="pas-card">
              <span className="k">Purana tareeka</span>
              <h3>Mandi ke chakkar, galat rate, "stock khatam"</h3>
              <p>Dukaan band karo, transport ka kharcha, ghanton ka waqt zaaya — phir bhi kabhi nakli maal, kabhi mehnga rate, kabhi maal poora milta hi nahi.</p>
            </div>
            <div className="pas-card solve">
              <span className="k">Iska hal</span>
              <h3>England pe ek WhatsApp message</h3>
              <p>Asli maal, fixed wholesale rate, agle din seedha aapki dukaan pe. Bas ek message.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== WHY ENGLAND ===== */}
      <section className="section why">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow on-dark">Kyun England</span>
            <h2 className="title" style={{ color: '#fff' }}>Dukaandaar ka <span className="g">sacha partner</span></h2>
            <div className="title-ur ur">دکاندار کا سچا پارٹنر</div>
            <p className="lead" style={{ color: 'rgba(255,255,255,.62)' }}>Sirf maal nahi bechte — aapki dukaan chale, customer khush rahe aur munafa barhe, yeh hamara kaam hai.</p>
            <div className="bigstat"><span className="big">98.4%</span><span className="t">orders agle din time pe delivered</span></div>
          </Reveal>
          <Reveal className="why-grid">
            {features.map((f) => (
              <div className="feat" key={f.t}>
                <div className="fic">{f.icon}</div>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="section">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">Kaise kaam karta hai</span>
            <h2 className="title">3 step mein <span className="g">order poora</span></h2>
            <div className="title-ur ur">آسان تین قدم</div>
          </Reveal>
          <Reveal className="steps">
            {steps.map((s) => (
              <div className="step" key={s.n}>
                <div className="num">{s.n}</div>
                <div><h3>{s.t}</h3><div className="ur">{s.ur}</div><p>{s.p}</p></div>
              </div>
            ))}
          </Reveal>
          <Reveal><span className="time-tag"><svg className="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg> Aaj order → kal subah delivery · ~30 second mein order</span></Reveal>
        </div>
      </section>

      {/* ===== VIDEO REVIEWS ===== */}
      <VideoReviews />

      {/* ===== CITIES ===== */}
      <section className="section cities" style={{ background: 'var(--cream-soft)', borderBlock: '1px solid var(--line)' }}>
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">Poore Pakistan mein delivery</span>
            <h2 className="title">We deliver in <span className="g">50+ cities</span> across Pakistan</h2>
            <div className="title-ur ur">پورے پاکستان میں ڈلیوری</div>
            <p className="lead">Karachi se Khyber tak — 50+ shehron mein agle din delivery. Aapki dukaan jahan bhi ho, maal wahan.</p>
          </Reveal>
          <div className="mq mq--cities" aria-label="Delivery cities">
            <div className="mq-track">
              {cityLoop.map((c, i) => (
                c === '__more__'
                  ? <span className="chip more" key={`m${i}`}>+40 aur shehar</span>
                  : <span className="chip" key={`${c}-${i}`}><span className="pin"><Pin /></span>{c}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== REVIEWS ===== */}
      {reviews.length > 0 && (
        <section className="section">
          <div className="wrap">
            <Reveal>
              <span className="eyebrow">Dukaandaron ki zabaani</span>
              <h2 className="title">Asli dukaandar, <span className="g">asli raye</span></h2>
              <div className="title-ur ur">گاہکوں کی اصل رائے</div>
              <div className="rev-head">
                <span className="rating-pill"><span className="score">4.9</span><span className="stars">★★★★★</span><span className="cnt">· 1,200+ dukaandaaron ki raye</span></span>
              </div>
            </Reveal>
            <div className="mq mq--rev" aria-label="Customer reviews">
              <div className="mq-track">
                {revLoop.map((r, i) => (
                  <div className="review" key={i}>
                    <div className="stars">{'★'.repeat(Math.max(1, Math.min(5, Math.round(r.rating || 5))))}</div>
                    <q>{r.comment}</q>
                    <div className="who">
                      <span className="avatar">{(r.customer_name || 'C').charAt(0).toUpperCase()}</span>
                      <div>
                        <b>{r.customer_name}</b>
                        <div className="meta"><span className="verified">✓ Verified</span> · {r.product_name || 'England'}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===== CLOSER ===== */}
      <section className="section closer">
        <div className="wrap">
          <span className="eyebrow">Aaj order, kal maal</span>
          <h2>Aapki dukaan ka agla order,<br /><span className="y">sirf ek message door</span></h2>
          <div className="h-ur ur">آپ کی دکان کا اگلا آرڈر، صرف ایک میسج دور</div>
          <div className="urgency"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg> Aaj 4 baje tak order = kal subah delivery</div>
          <p className="bd">12,400+ dukaandaar England pe bharosa karte hain. Aaj order karein, kal subah maal aapki dukaan pe.</p>
          <div className="cta">
            <a className="btn btn-wa" href={waHref('Assalam-o-alaikum, order karna hai')} target="_blank" rel="noopener noreferrer"><Wa className="ico" /> WhatsApp pe order karein</a>
            <a className="btn btn-call" href={`tel:${brand.phone.replace(/\s/g, '')}`}><svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3.1-8.7A2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.4-1.4a2 2 0 012.1-.5c.9.3 1.8.6 2.7.7a2 2 0 011.7 2.1z" /></svg> Call: {brand.phone}</a>
          </div>
          <div className="trust">
            <span className="t"><Check /> Asli maal guarantee</span>
            <span className="t"><Check /> Rs. 5,000+ pe free delivery</span>
            <span className="t"><Check /> Agle din delivery</span>
          </div>
        </div>
      </section>

      {/* ===== PARTNER (collapsible) ===== */}
      <Partner />
    </div>
  )
}
