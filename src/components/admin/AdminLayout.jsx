import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  SignOut,
  List,
  X,
  ArrowSquareOut,
  CaretDown,
  SidebarSimple,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { brand } from '../../data/site'
import BrandLogo from '../BrandLogo'
import { spring } from '../../lib/motion'
import NotificationBell from './NotificationBell'
import CommandPalette, { usePaletteShortcut, paletteShortcutLabel } from './CommandPalette'
import { DASHBOARD, navGroups } from './nav'

// ===========================================================================
// Admin chrome.
// ===========================================================================
// The dark rail against cream content is the England brand and it stays. What
// changed is everything competing inside it.
//
// ONE ACTIVE TREATMENT. The old active row carried three at once: a gradient
// wash, a white ring, AND a sliding accent bar. Three signals for one piece of
// information read as a glitch rather than as emphasis. It is now a single
// tinted surface with the accent bar, and the bar is the thing that animates
// between rows.
//
// COLLAPSIBLE. The column is 264px of a 1440px screen. On the order and product
// tables — the two screens anybody actually lives in — that is 18% of the
// viewport spent on navigation that is not being used. The rail keeps the icons
// and hands the width back, the choice is remembered, and Ctrl+K reaches
// anything the icons do not.
//
// NO NESTED CARD. The account block used to be a bordered, ringed panel sitting
// inside a bordered panel. It is a row with a hairline above it now.
// ===========================================================================

const RAIL_KEY = 'eng.admin.rail'
const W_FULL = 'w-[264px]'
const W_RAIL = 'w-[76px]'

// ---------------------------------------------------------------------------
// One nav row. `rail` collapses it to its icon and promotes the label into a
// hover tooltip, so a collapsed sidebar is still readable rather than a guess.
// ---------------------------------------------------------------------------
function NavRow({ item, rail, onNavigate, depth = 0 }) {
  const location = useLocation()
  // A row with children owns the bare path; its children own the query strings.
  // Without this the parent stays lit while a child is selected and two rows
  // claim to be the current page.
  const selfActive = (isActive) => isActive && (!item.children || location.search === '')

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={rail ? item.label : undefined}
      className={({ isActive }) =>
        `group/row relative flex items-center rounded-xl text-sm font-semibold transition-colors duration-150 ${
          rail ? 'justify-center px-0 py-2.5' : `gap-3 py-2.5 ${depth ? 'pl-3 pr-3' : 'px-3'}`
        } ${
          selfActive(isActive)
            ? 'bg-saffron-400/[0.14] text-white'
            : 'text-white/55 hover:bg-white/[0.05] hover:text-white'
        }`
      }
    >
      {({ isActive }) => {
        const active = selfActive(isActive)
        return (
          <>
            {active && (
              <motion.span
                layoutId="admin-nav-marker"
                transition={spring}
                className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-saffron-400"
              />
            )}
            <item.icon
              size={depth ? 16 : 18}
              weight={active ? 'fill' : 'regular'}
              className={`shrink-0 ${active ? 'text-saffron-300' : ''}`}
            />
            {!rail && <span className="truncate">{item.label}</span>}
            {/* Rail tooltip. Rendered only in rail mode so it cannot interfere
                with pointer targets in the expanded column. */}
            {rail && (
              <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-lg bg-brand-950 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lift ring-1 ring-white/10 group-hover/row:block">
                {item.label}
              </span>
            )}
          </>
        )
      }}
    </NavLink>
  )
}

// ---------------------------------------------------------------------------
// A parent row plus its sub-routes. Closed by default, opened when you are
// inside it — the two sub-views used to be permanently on screen, adding two
// rows of noise to every other screen in the app.
// ---------------------------------------------------------------------------
function NavBranch({ item, rail, onNavigate }) {
  const location = useLocation()
  const inside = location.pathname.startsWith(item.to)
  const [open, setOpen] = useState(inside)

  useEffect(() => {
    if (inside) setOpen(true)
  }, [inside])

  if (rail) return <NavRow item={item} rail onNavigate={onNavigate} />

  return (
    <div>
      <div className="flex items-center">
        <div className="min-w-0 flex-1">
          <NavRow item={item} rail={false} onNavigate={onNavigate} />
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`${item.label} ke sub-screens ${open ? 'band karein' : 'kholein'}`}
          className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <CaretDown size={13} weight="bold" className={`transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
        </button>
      </div>
      {open && (
        <div className="ml-[22px] mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
          {item.children.map((c) => {
            const active =
              location.pathname === item.to && location.search === c.to.slice(c.to.indexOf('?'))
            return (
              <Link
                key={c.to}
                to={c.to}
                onClick={onNavigate}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                  active ? 'bg-saffron-400/[0.12] text-saffron-200' : 'text-white/45 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <c.icon size={15} weight={active ? 'fill' : 'regular'} className="shrink-0" />
                <span className="truncate">{c.label}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SidebarContent({ user, onLogout, onNavigate, rail, onToggleRail, onOpenPalette }) {
  return (
    <div className="flex h-full flex-col">
      {/* --- brand + collapse ------------------------------------------- */}
      <div className={`flex h-16 shrink-0 items-center ${rail ? 'justify-center px-0' : 'justify-between pl-5 pr-3'}`}>
        {rail ? (
          // In the rail the mark IS the control: it is the only brand left on
          // screen, and clicking it is the obvious way back to the full column.
          <button
            type="button"
            onClick={onToggleRail}
            aria-label="Sidebar kholein"
            title="Sidebar kholein"
            className="grid h-10 w-10 place-items-center rounded-xl transition-colors hover:bg-white/[0.06]"
          >
            <BrandLogo tone="light" className="h-6" />
          </button>
        ) : (
          <>
            <Link to="/admin" onClick={onNavigate} aria-label={`${brand.full} Admin`} className="flex items-center gap-2.5">
              <BrandLogo tone="light" className="h-8" />
              <span className="font-display text-sm font-extrabold tracking-tight text-white/80">Admin</span>
            </Link>
            {onToggleRail && (
              <button
                type="button"
                onClick={onToggleRail}
                aria-label="Sidebar band karein"
                className="grid h-8 w-8 place-items-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <SidebarSimple size={17} weight="bold" />
              </button>
            )}
          </>
        )}
      </div>

      {/* --- jump-to (mobile drawer only) --------------------------------- */}
      {/* On desktop this control lives in the top bar. Showing it in both
          places put two identical affordances on screen at the same time; the
          drawer needs its own because the top-bar version is hidden below lg. */}
      {onOpenPalette && (
        <div className="shrink-0 px-3 pb-2">
          <button
            type="button"
            onClick={onOpenPalette}
            className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-white/45 transition-colors hover:border-white/20 hover:text-white"
          >
            <MagnifyingGlass size={16} weight="bold" className="shrink-0" />
            <span className="flex-1 text-left text-[13px] font-medium">Jump to...</span>
          </button>
        </div>
      )}

      {/* --- navigation --------------------------------------------------- */}
      <nav className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        <div className="space-y-0.5">
          <NavRow item={DASHBOARD} rail={rail} onNavigate={onNavigate} />
        </div>

        {navGroups.map((group) => (
          <div key={group.label} className="mt-5">
            {rail ? (
              <div className="mx-auto mb-2 h-px w-7 bg-white/10" />
            ) : (
              <p className="px-3 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/25">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) =>
                item.children ? (
                  <NavBranch key={item.to} item={item} rail={rail} onNavigate={onNavigate} />
                ) : (
                  <NavRow key={item.to} item={item} rail={rail} onNavigate={onNavigate} />
                ),
              )}
            </div>
          </div>
        ))}
      </nav>

      {/* --- storefront + account ----------------------------------------- */}
      <div className="shrink-0 border-t border-white/10 px-3 py-3">
        <Link
          to="/"
          onClick={onNavigate}
          title={rail ? 'Storefront dekhein' : undefined}
          className={`group/row relative flex items-center rounded-xl text-[13px] font-medium text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white ${
            rail ? 'justify-center py-2.5' : 'gap-3 px-3 py-2.5'
          }`}
        >
          <ArrowSquareOut size={17} weight="bold" className="shrink-0" />
          {!rail && 'Storefront dekhein'}
          {rail && (
            <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-lg bg-brand-950 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lift ring-1 ring-white/10 group-hover/row:block">
              Storefront dekhein
            </span>
          )}
        </Link>

        <div className={`mt-2 flex items-center ${rail ? 'justify-center' : 'gap-2.5 px-1'}`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-saffron-400 font-display text-sm font-extrabold text-brand-950">
            {(user?.username || 'A').charAt(0).toUpperCase()}
          </span>
          {!rail && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-white">{user?.username}</p>
                <p className="text-[11px] text-white/40">Administrator</p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                aria-label="Logout"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <SignOut size={16} weight="bold" />
              </button>
            </>
          )}
        </div>
        {rail && (
          <button
            type="button"
            onClick={onLogout}
            aria-label="Logout"
            className="mt-2 grid h-9 w-full place-items-center rounded-xl text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <SignOut size={16} weight="bold" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const { user, logout } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawer, setDrawer] = useState(false)
  const [palette, setPalette] = useState(false)

  // Remembered across visits: whoever works in the order table all day should
  // not re-collapse the rail every morning. Read lazily so the first paint is
  // already in the right shape — deriving it in an effect would flash the wide
  // column and shove the content sideways a frame later.
  const [rail, setRail] = useState(() => {
    try {
      return localStorage.getItem(RAIL_KEY) === '1'
    } catch {
      return false
    }
  })

  const toggleRail = useCallback(() => {
    setRail((r) => {
      try {
        localStorage.setItem(RAIL_KEY, r ? '0' : '1')
      } catch {
        /* private mode — the choice just does not outlive the tab */
      }
      return !r
    })
  }, [])

  const openPalette = useCallback(() => setPalette(true), [])
  usePaletteShortcut(openPalette)

  // `[` toggles the rail, the same key Linear and VS Code use for it. Ignored
  // while typing, or it would eat the bracket in a product description.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey) return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      e.preventDefault()
      toggleRail()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleRail])

  // A route change closes the drawer. Doing it here rather than on every link
  // means a navigation from anywhere — a card, a breadcrumb, the palette —
  // closes it, not just the ones that remembered to pass a handler.
  useEffect(() => {
    setDrawer(false)
  }, [location.pathname, location.search])

  const handleLogout = async () => {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="min-h-[100dvh] bg-sand-50">
      {/* ---------------------------- desktop rail ---------------------------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden bg-brand-950 transition-[width] duration-200 ease-out lg:block ${
          rail ? W_RAIL : W_FULL
        }`}
      >
        <span className="pointer-events-none absolute inset-y-0 right-0 w-px bg-white/[0.07]" />
        <SidebarContent user={user} onLogout={handleLogout} rail={rail} onToggleRail={toggleRail} />
      </aside>

      {/* ---------------------------- mobile drawer --------------------------- */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
              className="fixed inset-0 z-40 bg-brand-950/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={spring}
              className="fixed inset-y-0 left-0 z-50 w-[276px] bg-brand-950 shadow-lift lg:hidden"
            >
              <button
                type="button"
                aria-label="Band karein"
                onClick={() => setDrawer(false)}
                className="absolute right-3 top-4 z-10 grid h-8 w-8 place-items-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={17} weight="bold" />
              </button>
              <SidebarContent
                user={user}
                onLogout={handleLogout}
                onNavigate={() => setDrawer(false)}
                rail={false}
                onOpenPalette={() => {
                  setDrawer(false)
                  openPalette()
                }}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ------------------------------- content ------------------------------ */}
      <div className={`transition-[padding] duration-200 ease-out ${rail ? 'lg:pl-[76px]' : 'lg:pl-[264px]'}`}>
        {/* Top bar. It used to hold a bell and 64px of nothing; it now carries
            the things that belong to the whole app rather than to one screen —
            the menu, the jump-to, the date, notifications. Each page keeps its
            own <AdminTitle>, so there is deliberately no page name up here to
            say the same thing twice. */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-brand-100 bg-sand-50/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setDrawer(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand-200 bg-white text-brand-800 transition-transform active:scale-95 lg:hidden"
          >
            <List size={18} weight="bold" />
          </button>

          <Link to="/admin" aria-label={`${brand.full} Admin`} className="lg:hidden">
            <BrandLogo tone="dark" className="h-7" />
          </Link>

          <button
            type="button"
            onClick={openPalette}
            className="hidden min-w-[220px] items-center gap-2.5 rounded-xl border border-brand-200 bg-white px-3 py-2 text-brand-400 transition-colors hover:border-brand-300 hover:text-brand-600 lg:flex"
          >
            <MagnifyingGlass size={16} weight="bold" className="shrink-0" />
            <span className="flex-1 text-left text-[13px] font-medium">Jump to...</span>
            <kbd className="rounded border border-brand-200 bg-sand-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand-400">
              {paletteShortcutLabel()}
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden font-mono text-[11px] font-medium uppercase tracking-wide text-brand-400 sm:block">
              {today}
            </span>
            <NotificationBell />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  )
}
