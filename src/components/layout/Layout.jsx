import { Outlet, useLocation } from 'react-router-dom'
import Navbar from '../Navbar'
import Footer from '../Footer'
import FloatingWhatsApp from '../FloatingWhatsApp'
import CartDrawer from '../cart/CartDrawer'
import BottomNav from './BottomNav'
import ScrollToTop from './ScrollToTop'
import { useCart } from '../../context/CartContext'

export default function Layout() {
  // Drawer visibility lives in CartContext so adding from any page auto-opens it.
  const { cartOpen, openCart, closeCart } = useCart()
  const { pathname } = useLocation()

  return (
    <div className="grain flex min-h-[100dvh] flex-col bg-sand-50">
      <ScrollToTop />
      <Navbar onCartOpen={openCart} />
      {/* extra bottom padding on mobile clears the bottom nav + home-bar inset */}
      <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        {/* keyed wrapper → subtle app-like page transition on each route (phones) */}
        <div key={pathname} className="app-page">
          <Outlet context={{ openCart }} />
        </div>
      </main>
      <Footer />
      <FloatingWhatsApp />
      <CartDrawer open={cartOpen} onClose={closeCart} />
      <BottomNav onCartOpen={openCart} />
    </div>
  )
}
