import { useTransition } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { House, Storefront, Tag, WhatsappLogo, UserCircle } from '@phosphor-icons/react'
import { waLink } from '../../lib/whatsapp'

const items = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/products', label: 'Shop', icon: Storefront },
  { to: '/offers', label: 'Offers', icon: Tag },
  // Account tab → profile (which carries the full order history). Gives mobile
  // users one-tap access to My Profile, matching native-app conventions.
  { to: '/profile', label: 'Account', icon: UserCircle },
]

function Item({ to, label, icon: Icon, end, active, onNav }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNav(to)}
      className="tap-target relative flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-opacity active:opacity-60"
    >
      {active && (
        <motion.span
          layoutId="bottomnav-pill"
          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          className="absolute -top-px h-1 w-8 rounded-full bg-saffron-400"
        />
      )}
      <Icon size={23} weight={active ? 'fill' : 'regular'} className={active ? 'text-brand-800' : 'text-brand-400'} />
      <span className={`text-[10px] font-semibold ${active ? 'text-brand-800' : 'text-brand-400'}`}>{label}</span>
    </NavLink>
  )
}

export default function BottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [, startTransition] = useTransition()
  const isActive = (to, end) => (end ? pathname === to : pathname.startsWith(to))

  // Smooth tab switch: run the route change in a transition so React yields to the
  // browser and the tab-bar/page-in animations never freeze on mobile. Modifier /
  // middle clicks keep their native new-tab behaviour.
  const onNav = (to) => (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return
    e.preventDefault()
    startTransition(() => navigate(to))
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-100 bg-sand-50/95 backdrop-blur-lg md:hidden"
      style={{
        // Robust safe-area padding (consistent on notched + non-notched devices).
        paddingBottom: 'max(env(safe-area-inset-bottom), 0px)',
        // Pin to its own compositor layer so the fixed + backdrop-blur bar never
        // re-rasterises with the page on scroll — kills the shimmer/jitter/shake
        // on Android & iOS while keeping it perfectly fixed to the bottom.
        transform: 'translateZ(0)',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
      }}
    >
      <div className="mx-auto flex max-w-md items-stretch px-2">
        {items.slice(0, 2).map((it) => (
          <Item key={it.to} {...it} active={isActive(it.to, it.end)} onNav={onNav} />
        ))}

        {/* center WhatsApp button — opens WhatsApp to place an order / ask for rates */}
        <a
          href={waLink()}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Order on WhatsApp"
          className="relative flex flex-1 flex-col items-center gap-1 py-2"
        >
          <span className="relative -mt-5 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lift ring-4 ring-sand-50 transition-transform active:scale-95">
            <WhatsappLogo size={26} weight="fill" />
          </span>
          <span className="text-[10px] font-semibold text-brand-400">WhatsApp</span>
        </a>

        {items.slice(2).map((it) => (
          <Item key={it.to} {...it} active={isActive(it.to, it.end)} onNav={onNav} />
        ))}
      </div>
    </nav>
  )
}
