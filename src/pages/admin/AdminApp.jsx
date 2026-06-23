import { Routes, Route, Navigate } from 'react-router-dom'
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
import AdminReviews from './AdminReviews'

function RequireAdmin({ children }) {
  const { user, loading } = useAdminAuth()
  if (loading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-sand-100">
        <Loader label="Verify ho raha hai..." />
      </div>
    )
  }
  if (!user) return <Navigate to="/admin/login" replace />
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
          <Route path="profits" element={<AdminProfitList />} />
          <Route path="profits/:id" element={<AdminProfitDetails />} />
          <Route path="profit" element={<Navigate to="/admin/profits" replace />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </AdminAuthProvider>
  )
}
