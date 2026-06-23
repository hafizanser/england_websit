import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Home from './pages/Home'
import ProductsPage from './pages/ProductsPage'
import ProductDetailPage from './pages/ProductDetailPage'
import CategoriesPage from './pages/CategoriesPage'
import OffersPage from './pages/OffersPage'
import BlogPage from './pages/BlogPage'
import BlogDetailPage from './pages/BlogDetailPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import MyProfilePage from './pages/MyProfilePage'
import WholesalePage from './pages/WholesalePage'
import AboutPage from './pages/AboutPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import OrderHistoryPage from './pages/OrderHistoryPage'
import OrderDetailPage from './pages/OrderDetailPage'
import NotFound from './pages/NotFound'

// Admin panel is a separate bundle — never loaded for storefront visitors.
const AdminApp = lazy(() => import('./pages/admin/AdminApp'))

export default function App() {
  return (
    <Routes>
      {/* Admin panel — self-contained (own layout + auth) */}
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<div className="grid min-h-[100dvh] place-items-center bg-sand-100 text-brand-400">Loading…</div>}>
            <AdminApp />
          </Suspense>
        }
      />

      {/* Storefront */}
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="product/:id" element={<ProductDetailPage />} />
        <Route path="offers" element={<OffersPage />} />
        <Route path="blog" element={<BlogPage />} />
        <Route path="blog/:slug" element={<BlogDetailPage />} />
        <Route path="wholesale" element={<WholesalePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="profile" element={<MyProfilePage />} />
        <Route path="orders" element={<OrderHistoryPage />} />
        <Route path="order/:code" element={<OrderDetailPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
