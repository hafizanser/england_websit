import { Link } from 'react-router-dom'
import {
  Phone,
  EnvelopeSimple,
  MapPin,
  WhatsappLogo,
  FacebookLogo,
  InstagramLogo,
  TiktokLogo,
  YoutubeLogo,
  CaretRight,
} from '@phosphor-icons/react'
import { brand, navLinks } from '../data/site'
import { getCategories } from '../api/catalog'
import { catalogKeys } from '../api/cacheKeys'
import { useAsync } from '../hooks/useAsync'
import BrandLogo from './BrandLogo'

const waHref = `https://wa.me/${brand.whatsapp.replace(/[^0-9]/g, '')}`

// Gmail's compose URL rather than `mailto:`. A mailto: link only opens something
// if the visitor's OS/browser has a mail handler registered, and when there isn't
// one the click is silently swallowed — nothing opens, no error, no feedback. That
// is not a rare edge: Windows commonly maps mailto: straight back to the browser,
// which then drops it unless a webmail handler was explicitly allowed. Our address
// is a Gmail one and our customers are overwhelmingly Gmail/Android, so pointing
// at Gmail directly means the click always lands somewhere.
//
// `view=cm&fs=1` opens a full compose window; `to` prefills the recipient. No `/u/0`
// on purpose — that would pin the compose to Google account 0, whereas this lets
// Gmail use whichever account the visitor is signed into (the From address is the
// user's choice, never ours).
const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(brand.email)}`

export default function Footer() {
  // Categories MUST come from the admin API — they carry the real database ids
  // that /products?cat= filters on. The old bundled `categories` list used
  // hardcoded slugs ('tissues'), which never match tbl_product.category_id
  // (numeric), so every footer link returned 0 products.
  //
  // We show ALL categories the API returns (no hardcoded list, no fixed cap), so
  // any category added in the Admin panel appears here automatically. The backend's
  // storefront() query already excludes inactive categories (is_active = 0); we
  // additionally drop empty ones (0 products) here — their /products?cat= link would
  // land on an empty grid, making a footer shortcut to one a dead end. The list
  // scrolls within its column (see the <ul> below) so a long catalogue never
  // stretches the footer or breaks column alignment.
  const { data: cats, loading: catsLoading } = useAsync(() => getCategories(), [], {
    cacheKey: catalogKeys.categories(),
  })
  const categoryList = (!catsLoading && Array.isArray(cats) ? cats : []).filter((c) => (c.items ?? 1) > 0)

  return (
    <footer className="bg-brand-950 text-[#c9b89f]">
      <div className="container-page py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr_1.9fr_1.3fr]">
          {/* brand */}
          <div>
            <Link to="/" aria-label={brand.full} className="inline-flex items-center">
              <BrandLogo tone="light" className="h-12" />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#a8967e]">
              Pakistan ka apna FMCG wholesale partner. Tissue, agarbatti, razor, hair color, soap aur
              bohot kuch — asli maal, wholesale rate, 40+ cities mein delivery.
            </p>
            <p className="urdu mt-3 text-base text-[#a8967e]" dir="rtl">{brand.trustUrdu}</p>

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              {[
                { icon: WhatsappLogo, href: waHref, label: 'WhatsApp' },
                { icon: FacebookLogo, href: 'https://www.facebook.com/share/1HM1wq5ry3/?mibextid=wwXIfr', label: 'Facebook' },
                { icon: InstagramLogo, href: 'https://www.instagram.com/englandwaly/', label: 'Instagram' },
                { icon: TiktokLogo, href: 'https://www.tiktok.com/@englandofficial0?_r=1&_t=ZS-97TitChU7f8', label: 'TikTok' },
                { icon: YoutubeLogo, href: 'https://www.youtube.com/@englandwaly', label: 'YouTube' },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-white/8 text-white/80 ring-1 ring-white/10 transition-all duration-300 hover:-translate-y-0.5 hover:bg-saffron-400 hover:text-brand-950 hover:ring-saffron-300/50 hover:shadow-[0_10px_22px_-10px_rgba(245,176,65,0.8)] active:translate-y-0"
                >
                  <Icon size={18} weight="fill" />
                </a>
              ))}
            </div>
          </div>

          {/* company */}
          <div>
            <h5 className="text-[13px] font-bold uppercase tracking-[0.1em] text-white">Company</h5>
            <ul className="mt-4 space-y-2.5">
              {navLinks.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="group inline-flex items-center gap-1.5 text-[14.5px] text-[#bdab93] transition-colors hover:text-saffron-400">
                    <CaretRight size={13} className="text-saffron-400 transition-transform group-hover:translate-x-0.5" />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* categories — a responsive multi-column grid instead of one long
              scrolling column, so this block's height stays close to the other
              footer columns and never over-stretches the footer. Columns:
              2 on mobile/tablet, 2 in the narrower lg slot, 3 from xl up. */}
          <div>
            <h5 className="text-[13px] font-bold uppercase tracking-[0.1em] text-white">Categories</h5>
            <ul className="mt-3 -ml-2 grid grid-cols-2 gap-x-2 gap-y-0.5 xl:grid-cols-3">
              {catsLoading && Array.from({ length: 12 }).map((_, i) => (
                <li key={i} className="min-w-0 px-2 py-1.5">
                  <div className="h-4 w-full rounded-full bg-white/10" aria-hidden="true" />
                </li>
              ))}
              {!catsLoading && categoryList.map((c) => (
                <li key={c.id} className="min-w-0">
                  {/* `state.scrollToGrid` tells ProductsPage to land on the product
                      grid instead of the banner (the global ScrollToTop resets to
                      the top on every route change). */}
                  <Link
                    to={`/products?cat=${c.id}`}
                    state={{ scrollToGrid: true }}
                    className="group flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-[14px] leading-snug text-[#bdab93] transition-all duration-200 hover:bg-white/5 hover:text-saffron-400 active:scale-[0.98]"
                  >
                    <CaretRight size={13} weight="bold" className="mt-[3px] shrink-0 text-saffron-400/70 transition-transform group-hover:translate-x-0.5 group-hover:text-saffron-400" />
                    <span className="min-w-0 break-words">{c.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* contact */}
          <div>
            <h5 className="text-[13px] font-bold uppercase tracking-[0.1em] text-white">Raabta</h5>
            <ul className="mt-4 space-y-3.5 text-[14px] text-[#bdab93]">
              <li className="flex items-start gap-3">
                <Phone size={18} weight="fill" className="mt-0.5 shrink-0 text-saffron-300" />
                <a href={`tel:${brand.phone.replace(/\s/g, '')}`} className="hover:text-white">{brand.phone}</a>
              </li>
              <li className="flex items-start gap-3">
                <EnvelopeSimple size={18} weight="fill" className="mt-0.5 shrink-0 text-saffron-300" />
                <a
                  href={gmailHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-words hover:text-white"
                >
                  {brand.email}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={18} weight="fill" className="mt-0.5 shrink-0 text-saffron-300" />
                <span>{brand.address}</span>
              </li>
            </ul>
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-wa-500 px-5 py-3 text-sm font-bold text-white shadow-[0_14px_28px_-12px_rgba(31,168,85,0.9)] ring-1 ring-wa-400/50 transition-all hover:-translate-y-0.5 hover:bg-wa-600 active:translate-y-0"
            >
              <WhatsappLogo size={18} weight="fill" className="shrink-0" /> <span className="whitespace-nowrap">Order on WhatsApp</span>
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-center gap-3 py-6 text-center text-[13px] text-[#8a7866]">
          <p>© 2026 {brand.full} · MT Traders. Tamaam haqooq mehfooz.</p>
        </div>
      </div>
    </footer>
  )
}
