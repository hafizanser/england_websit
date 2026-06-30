import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { House, Storefront, Tag, ShoppingBag, UserCircle } from '@phosphor-icons/react'
import { useCart } from '../../context/CartContext'

const items = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/products', label: 'Shop', icon: Storefront },
  { to: '/offers', label: 'Offers', icon: Tag },
  // Account tab → profile (which carries the full order history). Gives mobile
  // users one-tap access to My Profile, matching native-app conventions.
  { to: '/profile', label: 'Account', icon: UserCircle },
]

function Item({ to, label, icon: Icon, end, active }) {
  return (
    <NavLink
      to={to}
      end={end}
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

export default function BottomNav({ onCartOpen }) {
  const { count } = useCart()
  const { pathname } = useLocation()
  const isActive = (to, end) => (end ? pathname === to : pathname.startsWith(to))

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
          <Item key={it.to} {...it} active={isActive(it.to, it.end)} />
        ))}

        {/* center cart button */}
        <button
          type="button"
          onClick={onCartOpen}
          aria-label="Cart kholein"
          className="relative flex flex-1 flex-col items-center gap-1 py-2"
        >
          <span className="relative -mt-5 grid h-14 w-14 place-items-center rounded-full bg-brand-700 text-white shadow-lift ring-4 ring-sand-50 transition-transform active:scale-95">
            <ShoppingBag size={24} weight="fill" />
            {count > 0 && (
              <motion.span
                key={count}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-saffron-400 px-1 text-[11px] font-extrabold text-brand-950 ring-2 ring-sand-50"
              >
                {count > 99 ? '99+' : count}
              </motion.span>
            )}
          </span>
          <span className="text-[10px] font-semibold text-brand-400">Cart</span>
        </button>

        {items.slice(2).map((it) => (
          <Item key={it.to} {...it} active={isActive(it.to, it.end)} />
        ))}
      </div>
    </nav>
  )
}
