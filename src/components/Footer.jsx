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
import { brand, categories, navLinks } from '../data/site'
import BrandLogo from './BrandLogo'

const waHref = `https://wa.me/${brand.whatsapp.replace(/[^0-9]/g, '')}`

export default function Footer() {
  return (
    <footer className="bg-brand-950 text-[#c9b89f]">
      <div className="container-page py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr_1fr_1.3fr]">
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
                { icon: YoutubeLogo, href: 'https://youtube.com/@englandofficial-t4o?si=VOa0AqTJiZuDCTNX', label: 'YouTube' },
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

          {/* categories */}
          <div>
            <h5 className="text-[13px] font-bold uppercase tracking-[0.1em] text-white">Categories</h5>
            <ul className="mt-4 space-y-2.5">
              {categories.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link to={`/products?cat=${c.id}`} className="group inline-flex items-center gap-1.5 text-[14.5px] text-[#bdab93] transition-colors hover:text-saffron-400">
                    <CaretRight size={13} className="text-saffron-400 transition-transform group-hover:translate-x-0.5" />
                    {c.name}
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
                <a href={`mailto:${brand.email}`} className="break-words hover:text-white">{brand.email}</a>
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
              <WhatsappLogo size={18} weight="fill" /> WhatsApp Pe Order
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-6 text-center text-[13px] text-[#8a7866] sm:flex-row sm:text-left">
          <p>© 2026 {brand.full} · MT Traders. Tamaam haqooq mehfooz.</p>
          <a
            href="https://www.englandcare.com"
            target="_blank"
            rel="noreferrer"
            className="break-words transition-colors hover:text-saffron-400"
          >
            www.englandcare.com
          </a>
        </div>
      </div>
    </footer>
  )
}
