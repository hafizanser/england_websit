import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { List, X, WhatsappLogo, CaretRight, MagnifyingGlass, User, SignOut } from '@phosphor-icons/react'
import { brand, navLinks } from '../data/site'
import { useCart } from '../context/CartContext'
import { useCustomerAuth } from '../context/CustomerAuthContext'
import { spring } from '../lib/motion'
import { lockScroll } from '../lib/scroll'

const waHref = `https://wa.me/${brand.whatsapp.replace(/[^0-9]/g, '')}`

function Logo({ onClick }) {
  // Navbar uses a tightly-trimmed copy of the wordmark. The shared /england-logo.png
  // has large baked-in transparent padding (symmetric left/right, but far more at
  // the bottom than the top) which pushed the badge visually high and inflated the
  // gap to the nav links. The trimmed asset frames the badge edge-to-edge so flex
  // `items-center` centres it truly and the gap-6 spacing reads evenly.
  return (
    <Link to="/" onClick={onClick} aria-label={brand.full} className="flex shrink-0 items-center">
      <img
        src="/england-logo-nav.png"
        alt={brand.full}
        width="712"
        height="351"
        draggable="false"
        className="block h-7 w-auto select-none sm:h-8"
      />
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

export default function Navbar() {
  const [open, setOpen] = useState(false)
  // The top announcement marquee tucks away once the shopper scrolls past the
  // Hero and slides back when the Hero returns to view. Pages without a Hero
  // (everything but Home) keep the bar shown — see the effect below.
  const [hideAnnouncement, setHideAnnouncement] = useState(false)
  const navigate = useNavigate()
  const [, startTransition] = useTransition()
  const { pathname, search } = useLocation()
  const { isLoggedIn, customer, logout } = useCustomerAuth()

  // The URL's ?q= is the single source of truth for the APPLIED search, and this
  // field mirrors it (seeded from the URL so a deep link like /products?q=soap
  // shows its term without an empty first paint).
  //
  // The mirroring is what lets code elsewhere clear this box: ProductsPage's
  // "Filter saaf karein" drops ?q= from the URL and the field follows, with no
  // shared context or cross-component wiring. Typing is never clobbered — the sync
  // only fires when the APPLIED term changes, and typing doesn't touch the URL.
  const appliedQ = new URLSearchParams(search).get('q') || ''
  const [term, setTerm] = useState(appliedQ)
  useEffect(() => {
    setTerm(appliedQ)
  }, [appliedQ])

  // Navigate from the mobile drawer without a UI freeze: close the drawer
  // immediately (urgent) and run the route change inside a transition so React
  // yields to the browser — the drawer-close + page-in animations stay smooth
  // while the (potentially heavy) destination renders concurrently. Modifier /
  // middle clicks fall through to the browser's native new-tab behaviour.
  const closeAndGo = (to) => (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return
    e.preventDefault()
    setOpen(false)
    startTransition(() => navigate(to))
  }

  // Active-state resolver — derived purely from the current route (pathname), never
  // from click state, so the highlight is correct after a refresh, on a direct/deep
  // link, and on browser back/forward (all reflected in useLocation). Query params
  // (?view=, ?cat=, ?q=) only filter WITHIN a section — they don't change which
  // section you're in — so every /products route highlights Products, whichever way
  // you arrived: the navbar link (/products?view=all), the Hero "Products Dekhein"
  // CTA (/products), a footer category link (/products?cat=…), or a search
  // (/products?q=…). The product detail page (/product/:id) counts as Products too.
  const isNavActive = (to) => {
    const path = to.split('?')[0]
    if (path === '/products') return pathname === '/products' || pathname.startsWith('/product/')
    return pathname === path
  }

  // `scrollToGrid` asks ProductsPage to land on the filter bar + results rather
  // than the banner — the same contract the footer's category links use. Searching
  // is a "show me the goods" intent, so the results should be what you land on.
  const runSearch = (e) => {
    e.preventDefault()
    const q = term.trim()
    setOpen(false)
    startTransition(() =>
      navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products', { state: { scrollToGrid: true } }),
    )
  }

  // Clearing the box while viewing results resets to ALL products IN PLACE (drops
  // ?q=, stays on /products). Without this, clearing left the old ?q= applied, or
  // — via the browser's native search "×" + re-submit — bounced you off to Home.
  const onSearchChange = (e) => {
    const v = e.target.value
    setTerm(v)
    if (v === '' && appliedQ && pathname === '/products') {
      startTransition(() => navigate('/products', { state: { scrollToGrid: true } }))
    }
  }

  // Lock background scroll while the mobile menu is open; the counted lock
  // guarantees scroll is restored no matter what else is locking (e.g. a video
  // reel), and never leaves the page stuck after the menu closes.
  useEffect(() => {
    if (!open) return undefined
    return lockScroll()
  }, [open])

  // Auto-close on ANY route change — link taps close instantly via closeAndGo, but
  // this is the safety net for back/forward, logout, or any programmatic navigation
  // so the drawer + scroll-lock can never linger over a new page. Runs a no-op
  // setState when already closed, so it's cheap.
  useEffect(() => {
    setOpen(false)
  }, [pathname, search])

  // Close on Escape (desktop responsive mode / keyboards). Listener is added ONLY
  // while open and removed on close, so there are never duplicate listeners.
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // If the viewport grows to the desktop breakpoint while the drawer is open, the
  // drawer is hidden by `lg:hidden` but `open` would stay true — leaving the body
  // scroll-locked with no visible menu. Force it closed when we cross into desktop.
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)')
    const onChange = (e) => { if (e.matches) setOpen(false) }
    if (mql.addEventListener) mql.addEventListener('change', onChange)
    else mql.addListener(onChange) // Safari < 14
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange)
      else mql.removeListener(onChange)
    }
  }, [])

  // Publish the header's live height as `--header-h` so sticky sub-bars (the
  // products filter bar) can park flush beneath it and scroll code can target it.
  // This can't be a constant: the marquee pads env(safe-area-inset-top) on notched
  // phones and the bar's rows reflow with the viewport, so a hardcoded guess leaves
  // either an overlap or a sliver of the page showing through under the header.
  const headerRef = useRef(null)
  useLayoutEffect(() => {
    const el = headerRef.current
    if (!el) return undefined
    const publish = () => {
      const h = el.getBoundingClientRect().height
      document.documentElement.style.setProperty('--header-h', `${Math.round(h)}px`)
    }
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Hide the announcement marquee once the Hero has scrolled out of view, and
  // reveal it the moment any part of the Hero re-enters. Re-runs per route because
  // the Hero only exists on Home and mounts/unmounts across navigations. On routes
  // WITHOUT a Hero (Products, Offers, …) we fall back to raw scroll position with
  // hysteresis so the bar still tucks away as the shopper scrolls in and returns
  // near the top — same premium behaviour everywhere. The collapse itself is a
  // pure CSS grid-rows transition (no JS animation, no layout jump), and the
  // header's ResizeObserver above republishes --header-h smoothly as it animates
  // so the sticky sub-bars follow without a snap.
  useEffect(() => {
    const hero = document.querySelector('[data-hero]')
    if (hero) {
      const io = new IntersectionObserver(
        ([entry]) => setHideAnnouncement(!entry.isIntersecting),
        { threshold: 0 },
      )
      io.observe(hero)
      return () => io.disconnect()
    }

    // No Hero on this route — drive off scroll position. Two thresholds (not one)
    // give hysteresis so the bar can't flicker while hovering the boundary.
    const SHOW_AT = 48 // px — at/above this, bar is shown
    const HIDE_AT = 140 // px — past this, bar is hidden
    const onScroll = () => {
      const y = window.scrollY
      setHideAnnouncement((prev) => {
        if (prev && y <= SHOW_AT) return false
        if (!prev && y >= HIDE_AT) return true
        return prev
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [pathname])

  return (
    <header ref={headerRef} className="sticky top-0 z-50">
      {/* Announcement marquee — Urdu (pads the notch/status-bar inset on phones).
          Wrapped in a grid-rows collapser: 1fr → 0fr animates the height to zero
          smoothly (no hardcoded height, no reflow jump) when hideAnnouncement is
          set, and the inner min-h-0/overflow-hidden clips the notch padding away
          with it. */}
      <div
        className="grid overflow-hidden transition-[grid-template-rows,opacity] duration-500 ease-in-out motion-reduce:transition-none"
        style={{ gridTemplateRows: hideAnnouncement ? '0fr' : '1fr', opacity: hideAnnouncement ? 0 : 1 }}
        aria-hidden={hideAnnouncement || undefined}
      >
        <div className="min-h-0 overflow-hidden">
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
        </div>
      </div>

      {/* Main bar */}
      <div className="border-b border-brand-100 bg-sand-50/85 backdrop-blur-xl">
        <nav className="container-page flex items-center gap-6 py-3.5">
          <Logo />

          <ul className="hidden items-center gap-6 lg:flex">
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
                onChange={onSearchChange}
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
              aria-label="Order on WhatsApp"
              className="hidden shrink-0 items-center gap-2 rounded-full bg-[#25D366] px-3 py-2.5 text-sm font-bold text-white shadow-md ring-1 ring-inset ring-white/25 transition-all duration-200 hover:bg-[#20bd5a] hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] sm:flex sm:px-5"
            >
              <WhatsappLogo size={18} weight="fill" className="shrink-0 text-white" />
              <span className="hidden whitespace-nowrap sm:inline">Order on WhatsApp</span>
            </a>

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

      {/* Mobile drawer — the backdrop and the panel each live in their own
          AnimatePresence with a single *keyed* child. A bare Fragment holding both
          motion elements made framer-motion's exit tracking unreliable (the panel
          would snap/glitch on close); two single-child presences fix that while
          keeping the exact same fade + spring-slide visuals. */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="nav-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
            className="fixed inset-0 z-50 touch-none bg-brand-950/50 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
            <motion.aside
              key="nav-drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={spring}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="fixed inset-y-0 right-0 z-50 flex w-[84%] max-w-sm flex-col overscroll-contain bg-sand-50 shadow-lift lg:hidden"
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
                  onChange={onSearchChange}
                  placeholder="Maal dhoondein"
                  aria-label="Maal dhoondein"
                  className="w-full bg-transparent text-sm text-brand-800 outline-none placeholder:text-brand-400"
                />
              </form>

              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-3 py-4">
                {navLinks.map((link) => {
                  const active = isNavActive(link.to)
                  return (
                    <Link
                      key={link.label}
                      to={link.to}
                      onClick={closeAndGo(link.to)}
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

              {/* account links — signed-out users reach Login via the Account tab / cart */}
              {isLoggedIn && (
                <div className="border-t border-brand-100 px-3 py-3">
                  <div className="px-2 pb-1">
                    <p className="truncate text-sm font-bold text-brand-900">{customer?.name || 'Mera account'}</p>
                    <p className="truncate text-xs text-brand-400">{customer?.phone}</p>
                  </div>
                  <Link to="/profile" onClick={closeAndGo('/profile')} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-base font-semibold text-brand-900 hover:bg-white">
                    <User size={18} weight="bold" /> My Profile
                  </Link>
                  <button
                    type="button"
                    onClick={async () => { setOpen(false); await logout(); navigate('/') }}
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-base font-semibold text-saffron-700 hover:bg-white"
                  >
                    <SignOut size={18} weight="bold" /> Logout
                  </button>
                </div>
              )}

              <div className="border-t border-brand-100 p-4">
                <a
                  href={waHref}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-[52px] items-center justify-center gap-2.5 rounded-full bg-[#25D366] px-5 text-base font-bold text-white shadow-md ring-1 ring-inset ring-white/25 transition-all duration-200 hover:bg-[#20bd5a] hover:shadow-lg active:scale-[0.98]"
                >
                  <WhatsappLogo size={20} weight="fill" className="shrink-0" /> <span className="whitespace-nowrap">Order on WhatsApp</span>
                </a>
              </div>
            </motion.aside>
        )}
      </AnimatePresence>
    </header>
  )
}
