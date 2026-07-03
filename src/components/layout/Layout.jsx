import { Outlet, useLocation } from 'react-router-dom'
import Navbar from '../Navbar'
import Footer from '../Footer'
import FloatingWhatsApp from '../FloatingWhatsApp'
import BottomNav from './BottomNav'
import ScrollToTop from './ScrollToTop'

export default function Layout() {
  const { pathname } = useLocation()

  return (
    <div className="grain flex min-h-[100dvh] flex-col bg-sand-50">
      <ScrollToTop />
      <Navbar />
      {/* extra bottom padding on mobile clears the bottom nav + home-bar inset */}
      <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
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
