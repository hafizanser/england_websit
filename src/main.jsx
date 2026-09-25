import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { NotifyProvider } from './context/NotifyContext'
import { CartProvider } from './context/CartContext'
import { SessionProvider } from './context/SessionContext'
import { CustomerAuthProvider } from './context/CustomerAuthContext'
import { initSafeAreaVars } from './lib/viewport'
import { initServiceWorker } from './lib/serviceWorker'
import './index.css'
import './theme.css'
// The Sep 2026 redesign layer — restyles everything except the hero.
import './redesign.css'
// Loaded LAST so the iOS/Safari parity layer can correct both stylesheets above.
import './ios.css'

// iOS Safari can still pinch-zoom past viewport maximum-scale in some cases;
// blocking gesture* events keeps the storefront feeling like a native app.
// Scroll / tap remain unaffected.
;['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false })
})

// Freeze the safe-area insets into --sat/--sab before the first render. iOS
// reports a bottom inset that flips between 0px and ~34px as the browser
// toolbar collapses, so every bar sized from env() directly resized mid-scroll;
// Android reports a constant 0px. See lib/viewport.js.
initSafeAreaVars()

// Warms the offline/repeat-visit caches. Deliberately the LAST thing set up and
// deliberately not awaited: it registers after window.load, so nothing it does
// competes with the first screen. See lib/serviceWorker.js — it is a no-op in
// dev, where it tears down any worker a previous production build left behind.
initServiceWorker()

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
