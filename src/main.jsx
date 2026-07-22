import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { NotifyProvider } from './context/NotifyContext'
import { CartProvider } from './context/CartContext'
import { SessionProvider } from './context/SessionContext'
import { CustomerAuthProvider } from './context/CustomerAuthContext'
import './index.css'
import './theme.css'

// iOS Safari can still pinch-zoom past viewport maximum-scale in some cases;
// blocking gesture* events keeps the storefront feeling like a native app.
// Scroll / tap remain unaffected.
;['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false })
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <NotifyProvider>
        <CustomerAuthProvider>
          <SessionProvider>
            <CartProvider>
              <App />
            </CartProvider>
          </SessionProvider>
        </CustomerAuthProvider>
      </NotifyProvider>
    </HashRouter>
  </React.StrictMode>,
)
