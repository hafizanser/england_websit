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
