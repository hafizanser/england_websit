import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { List, X, WhatsappLogo, CaretRight, ShoppingBag, MagnifyingGlass, SignIn, UserPlus, User, SignOut } from '@phosphor-icons/react'
import { brand, navLinks } from '../data/site'
import BrandLogo from './BrandLogo'
import { useCart } from '../context/CartContext'
import { useCustomerAuth } from '../context/CustomerAuthContext'
import { spring } from '../lib/motion'

const waHref = `https://wa.me/${brand.whatsapp.replace(/[^0-9]/g, '')}`

function Logo({ onClick }) {
  return (
    <Link to="/" onClick={onClick} aria-label={brand.full} className="flex items-center">
      <BrandLogo tone="dark" className="h-9 sm:h-10" />
    </Link>
  )
}

// Profile shortcut — only shown once the cart has at least one item (sits next to
// the Cart icon, same pill style). Logged-in → My Profile; otherwise → Login.
// Reacts live to cart + auth state via the contexts (no refresh needed).
function ProfileButton() {
  const { count } = useCart()
  const { isLoggedIn } = useCustomerAuth()
  const navigate = useNavigate()
  if (count === 0) return null
  return (
    <button
      type="button"
      onClick={() => navigate(isLoggedIn ? '/profile' : '/login')}
      aria-label={isLoggedIn ? 'My Profile kholein' : 'Login karein'}
      className="grid h-10 w-10 place-items-center rounded-full border border-brand-200 bg-white text-brand-800 transition-all hover:border-saffron-400 hover:text-saffron-700 active:translate-y-px"
    >
      <User size={19} weight="bold" />
    </button>
  )
}

function CartButton({ onClick }) {
  const { count } = useCart()
  // Hide the cart entirely when empty; reappears as soon as an item is added.
  if (count === 0) return null
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Cart kholein, ${count} items`}
      className="relative grid h-10 w-10 place-items-center rounded-full border border-brand-200 bg-white text-brand-800 transition-all hover:border-saffron-400 hover:text-saffron-700 active:translate-y-px"
    >
      <ShoppingBag size={19} weight="bold" />
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={spring}
            aria-live="polite"
            className="absolute -right-1.5 -top-1.5 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-saffron-500 px-1 text-[11px] font-extrabold text-white ring-2 ring-sand-50"
          >
            {count > 99 ? '99+' : count}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}

export default function Navbar({ onCartOpen }) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const { isLoggedIn, customer, logout } = useCustomerAuth()

  // Active-state resolver. The two product entries share the /products path, so
  // we disambiguate them by the `view` query param — only one is ever active.
  const currentView = new URLSearchParams(search).get('view')
  const isNavActive = (to) => {
    const [path, qs] = to.split('?')
    if (path !== pathname) return false
    if (path === '/products') {
      const linkView = new URLSearchParams(qs || '').get('view')
      return (linkView || null) === (currentView || null)
    }
    return true
  }

  const runSearch = (e) => {
    e.preventDefault()
    const q = term.trim()
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products')
    setOpen(false)
  }

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header className="sticky top-0 z-50">
      {/* Announcement marquee — Urdu (pads the notch/status-bar inset on phones) */}
      <div
        className="overflow-hidden border-b border-white/5 bg-brand-950 py-2 text-[13px] text-saffron-200/85"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <div className="flex w-max animate-marquee gap-12 whitespace-nowrap" dir="rtl">
          {Array.from({ length: 2 }).map((_, dup) => (
            <div key={dup} className="flex gap-12">
              <span className="urdu">انگلینڈ — جس پر پورے پاکستان کا بھروسہ</span>
              <span className="urdu">5,000 سے زائد کے آرڈر پر مفت ڈیلیوری</span>
              <span className="urdu">اگلے دن دکان پر ڈیلیوری · 40 سے زائد شہروں میں</span>
              <span className="urdu">اصل مال، تھوک ریٹ — واٹس ایپ پر آرڈر کریں</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main bar */}
      <div className="border-b border-brand-100 bg-sand-50/85 backdrop-blur-xl">
        <nav className="container-page flex items-center gap-5 py-3.5">
          <Logo />

          <ul className="ml-2 hidden items-center gap-6 lg:flex">
            {navLinks.map((link) => {
              const active = isNavActive(link.to)
              return (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className={`group relative inline-block py-1 text-sm font-semibold transition-colors ${active ? 'text-saffron-700' : 'text-brand-600 hover:text-saffron-700'}`}
                  >
                    {link.label}
                    {/* hover underline for inactive items */}
                    {!active && (
                      <span className="absolute -bottom-0.5 left-0 h-0.5 w-full origin-left scale-x-0 rounded-full bg-saffron-300 transition-transform duration-300 ease-out group-hover:scale-x-100" />
                    )}
                    {/* animated active indicator — slides smoothly between pages */}
                    {active && (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full bg-saffron-500"
                        transition={spring}
                      />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
            {/* Inline search — hidden on phones (the drawer carries a full-width
                search field there) so the top bar stays clean and uncramped. */}
            <form
              onSubmit={runSearch}
              role="search"
              className="hidden min-w-0 flex-1 items-center gap-2.5 rounded-full border border-brand-100 bg-white px-4 py-2.5 transition-colors focus-within:border-saffron-400 hover:border-brand-200 sm:flex lg:mx-1 lg:max-w-2xl"
            >
              <MagnifyingGlass size={16} weight="bold" className="shrink-0 text-brand-400" />
              <input
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Maal Dhondein"
                aria-label="Maal Dhondein"
                className="w-full min-w-0 bg-transparent text-sm text-brand-800 outline-none placeholder:text-brand-400"
              />
            </form>

            {/* Mobile-only search trigger → opens the drawer's search field. */}
            <button
              type="button"
              aria-label="Maal dhoondein"
              onClick={() => setOpen(true)}
              className="grid h-11 w-11 place-items-center rounded-full border border-brand-200 bg-white text-brand-800 transition-all active:scale-95 sm:hidden"
            >
              <MagnifyingGlass size={19} weight="bold" />
            </button>

            {/* WhatsApp — hidden on phones (the floating button covers it there). */}
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp Pe Order"
              className="hidden shrink-0 items-center gap-2 rounded-full bg-[#25D366] px-3 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-[#1ebe5d] hover:-translate-y-0.5 active:translate-y-0 sm:flex sm:px-5"
            >
              <WhatsappLogo size={18} weight="fill" className="text-white" />
              <span className="hidden sm:inline">WhatsApp Pe Order</span>
            </a>

            <CartButton onClick={onCartOpen} />

            <ProfileButton />

            <button
              type="button"
              aria-label="Menu kholein"
              onClick={() => setOpen(true)}
              className="grid h-11 w-11 place-items-center rounded-xl border border-brand-200 bg-white text-brand-800 transition-all active:scale-95 lg:hidden"
            >
              <List size={20} weight="bold" />
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-brand-950/50 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={spring}
              className="fixed inset-y-0 right-0 z-50 flex w-[84%] max-w-sm flex-col bg-sand-50 shadow-lift lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-brand-100 px-5 py-4">
                <Logo onClick={() => setOpen(false)} />
                <button
                  type="button"
                  aria-label="Band karein"
                  onClick={() => setOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-brand-200 bg-white text-brand-800"
                >
                  <X size={20} weight="bold" />
                </button>
              </div>

              <form onSubmit={runSearch} className="mx-3 mt-4 flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-3">
                <MagnifyingGlass size={18} weight="bold" className="shrink-0 text-brand-400" />
                <input
                  type="search"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Maal dhoondein"
                  aria-label="Maal dhoondein"
                  className="w-full bg-transparent text-sm text-brand-800 outline-none placeholder:text-brand-400"
                />
              </form>

              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
                {navLinks.map((link) => {
                  const active = isNavActive(link.to)
                  return (
                    <Link
                      key={link.label}
                      to={link.to}
                      onClick={() => setOpen(false)}
                      className={`flex items-center justify-between rounded-2xl px-4 py-3.5 text-base font-semibold transition-colors ${
                        active ? 'bg-white text-saffron-700 shadow-soft' : 'text-brand-900 hover:bg-white'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        {link.label}
                        <span className="urdu text-sm text-brand-400" dir="rtl">{link.urdu}</span>
                      </span>
                      <CaretRight size={16} className="text-brand-300" />
                    </Link>
                  )
                })}
              </nav>

              {/* account links */}
              <div className="border-t border-brand-100 px-3 py-3">
                {isLoggedIn ? (
                  <>
                    <div className="px-2 pb-1">
                      <p className="truncate text-sm font-bold text-brand-900">{customer?.name || 'Mera account'}</p>
                      <p className="truncate text-xs text-brand-400">{customer?.phone}</p>
                    </div>
                    <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-base font-semibold text-brand-900 hover:bg-white">
                      <User size={18} weight="bold" /> My Profile
                    </Link>
                    <button
                      type="button"
                      onClick={async () => { setOpen(false); await logout(); navigate('/') }}
                      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-base font-semibold text-saffron-700 hover:bg-white"
                    >
                      <SignOut size={18} weight="bold" /> Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/register" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-base font-semibold text-brand-900 hover:bg-white">
                      <UserPlus size={18} weight="bold" /> Register
                    </Link>
                    <Link to="/login" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-base font-semibold text-brand-900 hover:bg-white">
                      <SignIn size={18} weight="bold" /> Login
                    </Link>
                  </>
                )}
              </div>

              <div className="border-t border-brand-100 p-4">
                <a
                  href={waHref}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-3.5 text-base font-bold text-white shadow-soft active:translate-y-px"
                >
                  <WhatsappLogo size={20} weight="fill" /> WhatsApp pe order karein
                </a>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
