import { useTransition } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { House, Storefront, SquaresFour, Tag, WhatsappLogo } from '@phosphor-icons/react'
import { waLink } from '../../lib/whatsapp'

// Five slots, WhatsApp FAB dead-center: Home · Shop · [WA] · Categories · Offers
const leftItems = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/products', label: 'Shop', icon: Storefront, match: (path) => path === '/products' || path.startsWith('/product/') },
]

const rightItems = [
  { to: '/categories', label: 'Categories', icon: SquaresFour, premium: true },
  { to: '/offers', label: 'Offers', icon: Tag },
]

function Item({ to, label, icon: Icon, end, active, onNav, reduce, premium = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNav(to)}
      className="tap-target relative flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-[18px] py-2.5 transition-transform duration-150 active:scale-95"
    >
      {active && (
        <motion.span
          layoutId="bottomnav-pill"
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
          className="absolute inset-0 rounded-[18px] bg-white shadow-[0_2px_8px_-2px_rgba(60,42,18,0.16)] ring-1 ring-brand-100"
        />
      )}
      <span className="relative z-10 flex flex-col items-center gap-1">
        <Icon
          size={premium ? 24 : 23}
          weight={active ? 'fill' : premium ? 'duotone' : 'regular'}
          className={`transition-colors duration-200 ${
            active ? 'text-brand-800' : 'text-brand-400'
          }`}
        />
        <span
          className={`max-w-full truncate px-0.5 text-[10px] font-semibold leading-none transition-colors duration-200 ${
            active ? 'text-brand-800' : 'text-brand-400'
          }`}
        >
          {label}
        </span>
      </span>
    </NavLink>
  )
}

export default function BottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [, startTransition] = useTransition()
  const reduce = useReducedMotion()

  const isActive = (it) => {
    if (it.match) return it.match(pathname)
    return it.end ? pathname === it.to : pathname.startsWith(it.to)
  }

  const onNav = (to) => (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return
    e.preventDefault()
    startTransition(() => navigate(to))
  }

  return (
    <nav
      data-bottom-nav
      className="fixed inset-x-0 bottom-0 z-40 px-3 md:hidden"
      style={{
        // Room for the elevated WhatsApp FAB so it isn't clipped by the nav edge.
        paddingTop: 18,
        // Home-indicator clearance lives OUT here, as an offset of the whole bar,
        // rather than as inner padding on the pill below. Padding the pill made
        // it ~34px taller on iOS than on Android (where the inset is always 0),
        // so the same nav read as two different components. As an outer offset
        // the pill keeps identical geometry on both platforms and simply floats
        // higher on a notched iPhone, which is the only difference the hardware
        // actually requires. `--sab` is the frozen, measured inset (see
        // lib/viewport.js) — raw env() flips 0px ⇄ 34px as Safari's toolbar
        // collapses, which resized this bar mid-scroll.
        paddingBottom: 'var(--sab)',
        transform: 'translateZ(0)',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
      }}
    >
      <div
        // bg is near-opaque on purpose: `transform: translateZ(0)` on the <nav>
        // above establishes a backdrop root, so the blur has nothing behind it
        // to sample — WebKit and Blink resolve that case differently. At 92% the
        // surface looks the same whether or not the blur resolves.
        className="relative mx-auto flex max-w-md items-stretch gap-0.5 rounded-[26px] border border-white/70 bg-sand-50/[0.92] px-1.5 pb-1.5 pt-1.5 shadow-[0_10px_34px_-10px_rgba(60,42,18,0.34),0_2px_8px_-3px_rgba(60,42,18,0.14)] backdrop-blur-2xl"
      >
        {leftItems.map((it) => (
          <Item key={it.to} {...it} active={isActive(it)} onNav={onNav} reduce={reduce} />
        ))}

        {/* Center WhatsApp — circular elevated FAB (matches reference). */}
        <div className="relative flex min-w-0 flex-1 basis-0 flex-col items-center justify-end gap-1 pb-2.5 pt-1">
          <a
            href={waLink()}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Order on WhatsApp"
            className="tap-target relative z-20 -mt-8 flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_22px_-4px_rgba(37,211,102,0.65),0_2px_8px_-2px_rgba(37,211,102,0.45),inset_0_1px_0_rgba(255,255,255,0.35)] ring-[3px] ring-[#25D366]/22 transition-transform duration-150 active:scale-95"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-2.5 rounded-full bg-[#25D366]/18 blur-md"
            />
            <WhatsappLogo size={28} weight="fill" className="relative z-10 text-white" />
          </a>
          <span className="relative z-10 text-[10px] font-semibold leading-none text-brand-400">
            WhatsApp
          </span>
        </div>

        {rightItems.map((it) => (
          <Item key={it.to} {...it} active={isActive(it)} onNav={onNav} reduce={reduce} />
        ))}
      </div>
    </nav>
  )
}
