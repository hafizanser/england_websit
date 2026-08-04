import { Outlet, useLocation } from 'react-router-dom'
import Navbar from '../Navbar'
import Footer from '../Footer'
import FloatingWhatsApp from '../FloatingWhatsApp'
import BottomNav from './BottomNav'
import ScrollToTop from './ScrollToTop'

export default function Layout() {
  const { pathname } = useLocation()

  return (
    // min-h-app (ios.css) = 100svh with a 100vh fallback, NOT 100dvh: the
    // dynamic unit grows and shrinks by the height of Safari's toolbar on every
    // scroll direction change, relaying out the whole shell. The small viewport
    // unit is constant, so iOS settles where Android already sits.
    <div className="grain min-h-app flex flex-col bg-sand-50">
      <ScrollToTop />
      <Navbar />
      {/* extra bottom padding on mobile clears the floating bottom nav (~74px)
          plus the home-bar inset. --sab is the frozen, measured safe-area inset
          (lib/viewport.js); raw env() would change this clearance mid-scroll on
          iOS and leave it fixed at 0 on Android. */}
      <main className="flex-1 pb-[calc(5.25rem+var(--sab))] md:pb-0">
        {/* keyed wrapper → subtle app-like page transition on each route (phones) */}
        <div key={pathname} className="app-page">
          <Outlet />
        </div>
      </main>
      <Footer />
      <FloatingWhatsApp />
      <BottomNav />
    </div>
  )
}
