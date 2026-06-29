import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AdminAuthProvider, useAdminAuth } from '../../context/AdminAuthContext'
import AdminLayout from '../../components/admin/AdminLayout'
import { Loader } from '../../components/admin/ui'
import AdminLogin from './AdminLogin'
import AdminDashboard from './AdminDashboard'
import AdminOrders from './AdminOrders'
import AdminOrderDetail from './AdminOrderDetail'
import AdminCreateOrder from './AdminCreateOrder'
import AdminCustomers from './AdminCustomers'
import AdminCustomerDetail from './AdminCustomerDetail'
import AdminProducts from './AdminProducts'
import AdminCategories from './AdminCategories'
import AdminOffers from './AdminOffers'
import AdminBlogs from './AdminBlogs'
import AdminProfitList from './AdminProfitList'
import AdminProfitDetails from './AdminProfitDetails'
import ProfitGuard from './ProfitGuard'
import AdminReviews from './AdminReviews'

function RequireAdmin({ children }) {
  const { user, loading } = useAdminAuth()
  const location = useLocation()
  // While the stored session token is being validated against the server
  // (on first load / refresh), render nothing but a loader — never the page —
  // so protected content can't flash before auth resolves.
  if (loading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-sand-100">
        <Loader label="Verify ho raha hai..." />
      </div>
    )
  }
  // Not authenticated → bounce to login, remembering where they were headed.
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location }} />
  return children
}

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/new" element={<AdminCreateOrder />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="invoices" element={<Navigate to="/admin/orders" replace />} />
          <Route path="invoices/:id" element={<Navigate to="/admin/orders" replace />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="customers/:id" element={<AdminCustomerDetail />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="offers" element={<AdminOffers />} />
          <Route path="blogs" element={<AdminBlogs />} />
          <Route path="reviews" element={<AdminReviews />} />
          {/* PIN-gated section — ProfitGuard requires the PIN on every entry and
              clears it on leave (memory-only, mounted while under /admin/profits). */}
          <Route path="profits" element={<ProfitGuard />}>
            <Route index element={<AdminProfitList />} />
            <Route path=":id" element={<AdminProfitDetails />} />
          </Route>
          <Route path="profit" element={<Navigate to="/admin/profits" replace />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </AdminAuthProvider>
  )
}
