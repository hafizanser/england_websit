import { useTransition } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { House, Storefront, Tag, WhatsappLogo } from '@phosphor-icons/react'
import { waLink } from '../../lib/whatsapp'

// Split around the centre WhatsApp button, which renders between the groups.
const leftItems = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/products', label: 'Shop', icon: Storefront },
]
const rightItems = [{ to: '/offers', label: 'Offers', icon: Tag }]

function Item({ to, label, icon: Icon, end, active, onNav, reduce }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNav(to)}
      className="tap-target relative flex flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-[18px] py-2 transition-transform duration-150 active:scale-95"
    >
      {/* Shared-layout highlight: slides between tabs instead of cross-fading. */}
      {active && (
        <motion.span
          layoutId="bottomnav-pill"
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
          className="absolute inset-0 rounded-[18px] bg-white shadow-[0_2px_8px_-2px_rgba(60,42,18,0.16)] ring-1 ring-brand-100"
        />
      )}
      <span className="relative z-10 flex flex-col items-center gap-1">
        <Icon
          size={22}
          weight={active ? 'fill' : 'regular'}
          className={`transition-colors duration-200 ${active ? 'text-brand-800' : 'text-brand-400'}`}
        />
        <span
          className={`text-[10px] font-semibold leading-none transition-colors duration-200 ${
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
      className="fixed inset-x-0 bottom-0 z-40 px-3 md:hidden"
      style={{
        // Robust safe-area padding (consistent on notched + non-notched devices).
        // The 8px floor keeps the floating bar off the screen edge on devices
        // that report no inset.
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        // Pin to its own compositor layer so the fixed + backdrop-blur bar never
        // re-rasterises with the page on scroll — kills the shimmer/jitter/shake
        // on Android & iOS while keeping it perfectly fixed to the bottom.
        transform: 'translateZ(0)',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
      }}
    >
      <div className="mx-auto flex max-w-md items-stretch gap-1 rounded-[26px] border border-white/70 bg-sand-50/80 p-1.5 shadow-[0_10px_34px_-10px_rgba(60,42,18,0.34),0_2px_8px_-3px_rgba(60,42,18,0.14)] backdrop-blur-2xl">
        {leftItems.map((it) => (
          <Item key={it.to} {...it} active={isActive(it.to, it.end)} onNav={onNav} reduce={reduce} />
        ))}

        {/* center WhatsApp button — opens WhatsApp to place an order / ask for rates */}
        <a
          href={waLink()}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Order on WhatsApp"
          className="tap-target group relative flex flex-1 basis-0 flex-col items-center justify-center gap-1 py-2"
        >
          {/* Icon-sized slot keeps this column's layout identical to the tabs, so the
              "WhatsApp" label sits on the same line as Home / Shop / Offers. The FAB
              itself is absolute — it lifts out of the bar without adding height. */}
          <span className="relative block h-[22px] w-[22px]">
            <span className="absolute bottom-0 left-1/2 grid h-[52px] w-[52px] -translate-x-1/2 place-items-center rounded-full bg-gradient-to-b from-[#2fdd72] to-[#1fbe5c] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.34),0_8px_18px_-6px_rgba(31,190,92,0.9)] ring-4 ring-sand-50 transition-transform duration-150 group-active:scale-95">
              <WhatsappLogo size={25} weight="fill" />
            </span>
          </span>
          <span className="text-[10px] font-semibold leading-none text-brand-400">WhatsApp</span>
        </a>

        {rightItems.map((it) => (
          <Item key={it.to} {...it} active={isActive(it.to, it.end)} onNav={onNav} reduce={reduce} />
        ))}
      </div>
    </nav>
  )
}
