import { useState } from 'react'
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Gauge,
  Receipt,
  UsersThree,
  Package,
  SquaresFour,
  Tag,
  Article,
  ChartLineUp,
  SignOut,
  List,
  X,
  ArrowSquareOut,
  Storefront,
  Globe,
  Star,
} from '@phosphor-icons/react'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { brand } from '../../data/site'
import BrandLogo from '../BrandLogo'
import { spring } from '../../lib/motion'
import NotificationBell from './NotificationBell'

// Grouped navigation — premium SaaS sidebar with labelled sections.
const sections = [
  { label: 'General', items: [{ to: '/admin', label: 'Dashboard', icon: Gauge, end: true }] },
  {
    label: 'Orders',
    items: [
      {
        to: '/admin/orders',
        label: 'All Orders',
        icon: Receipt,
        children: [
          { to: '/admin/orders?source=admin', label: 'Dashboard Orders', icon: Storefront },
          { to: '/admin/orders?source=website', label: 'Website Orders', icon: Globe },
        ],
      },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/admin/products', label: 'Products', icon: Package },
      { to: '/admin/categories', label: 'Categories', icon: SquaresFour },
      { to: '/admin/offers', label: 'Offers', icon: Tag },
      { to: '/admin/blogs', label: 'Blog', icon: Article },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/admin/customers', label: 'Customers', icon: UsersThree },
      { to: '/admin/reviews', label: 'Ratings & Reviews', icon: Star },
    ],
  },
  { label: 'Finance', items: [{ to: '/admin/profits', label: 'Profit Breakdown', icon: ChartLineUp }] },
]

function SidebarContent({ user, onLogout, onNavigate }) {
  const location = useLocation()
  return (
    <div className="flex h-full flex-col">
      {/* brand */}
      <Link to="/admin" onClick={onNavigate} aria-label={`${brand.full} Admin Suite`} className="flex items-center gap-3 px-5 py-5">
        <BrandLogo tone="light" className="h-9" />
        <span className="rounded-md bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-saffron-300/80">Admin Suite</span>
      </Link>

      <nav className="sidebar-scroll flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">{section.label}</p>
            <div className="space-y-0.5">
              {section.items.map((n) => (
                <div key={n.to}>
                  <NavLink
                    to={n.to}
                    end={n.end}
                    onClick={onNavigate}
                    className={({ isActive }) => {
                      const active = isActive && (!n.children || location.search === '')
                      return `group relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                        active
                          ? 'bg-gradient-to-r from-white/[0.14] to-white/[0.04] text-white ring-1 ring-white/10'
                          : 'text-white/60 hover:bg-white/[0.06] hover:text-white'
                      }`
                    }}
                  >
                    {({ isActive }) => {
                      const active = isActive && (!n.children || location.search === '')
                      return (
                        <>
                          {active && (
                            <motion.span
                              layoutId="nav-bar"
                              transition={spring}
                              className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-saffron-400"
                            />
                          )}
                          <n.icon size={19} weight={active ? 'fill' : 'regular'} className={active ? 'text-saffron-300' : ''} />
                          {n.label}
                        </>
                      )
                    }}
                  </NavLink>
                  {n.children && (
                    <div className="ml-5 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                      {n.children.map((c) => {
                        const active =
                          location.pathname === '/admin/orders' && location.search === c.to.slice(c.to.indexOf('?'))
                        return (
                          <Link
                            key={c.to}
                            to={c.to}
                            onClick={onNavigate}
                            className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors ${
                              active ? 'bg-white/[0.08] text-saffron-300' : 'text-white/45 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <c.icon size={15} weight="fill" /> {c.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-white/10 p-3">
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-white/55 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ArrowSquareOut size={18} weight="bold" /> Storefront dekhein
        </Link>
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/[0.06] px-3.5 py-3 ring-1 ring-white/10">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-extrabold text-white">
              {(user?.username || 'A').charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{user?.username}</p>
              <p className="text-[11px] text-white/45">Administrator</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Logout"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white/80 transition-colors hover:bg-saffron-400 hover:text-brand-950"
          >
            <SignOut size={18} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const { user, logout } = useAdminAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="mesh-cream min-h-[100dvh]">
      {/* desktop sidebar */}
      <aside className="mesh-warm fixed inset-y-0 left-0 hidden w-64 overflow-hidden lg:block">
        <span className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-saffron-400/30 to-transparent" />
        <SidebarContent user={user} onLogout={handleLogout} />
      </aside>

      {/* mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-brand-100 bg-sand-50/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link to="/admin" aria-label={`${brand.full} Admin`} className="flex items-center gap-2">
          <BrandLogo tone="dark" className="h-8" />
          <span className="font-display text-base font-extrabold tracking-tight text-brand-400">Admin</span>
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-brand-200 bg-white text-brand-800 shadow-card transition-transform active:scale-90"
          >
            <List size={20} weight="bold" />
          </button>
        </div>
      </div>

      {/* mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-brand-950/55 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={spring}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-brand-950 to-brand-900 shadow-lift lg:hidden"
            >
              <div className="flex justify-end p-3">
                <button
                  type="button"
                  aria-label="Band karein"
                  onClick={() => setOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white"
                >
                  <X size={18} weight="bold" />
                </button>
              </div>
              <SidebarContent user={user} onLogout={handleLogout} onNavigate={() => setOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* content */}
      <main className="lg:pl-64">
        {/* desktop top bar with notification bell */}
        <div className="sticky top-0 z-20 hidden items-center justify-end border-b border-brand-100 bg-sand-50/80 px-8 py-3 backdrop-blur-xl lg:flex">
          <NotificationBell />
        </div>
        <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
