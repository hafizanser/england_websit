import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, ThemeProvider, UIProvider, useAuth } from './state/app.jsx';
import { handleBack } from './lib/backstack.js';
import { isNative } from './lib/secureStore.js';
import { Spinner } from './components/ui.jsx';
import Login from './screens/Login.jsx';
import Orders from './screens/Orders.jsx';
import OrderDetail from './screens/OrderDetail.jsx';
import Account from './screens/Account.jsx';

/** Android back button / gesture: close what is open first, then go back, then leave the app. */
function BackHandler() {
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    if (!isNative()) return undefined;
    let sub;
    (async () => {
      const { App: CapApp } = await import('@capacitor/app');
      sub = await CapApp.addListener('backButton', () => {
        if (handleBack()) return;
        if (loc.pathname !== '/') { nav(-1); return; }
        CapApp.minimizeApp();
      });
    })();
    return () => { sub?.remove(); };
  }, [nav, loc.pathname]);
  return null;
}

function Screens() {
  const { ready, user } = useAuth();
  const loc = useLocation();
  if (!ready) {
    return (
      <div className="splash">
        <span className="splash__logo"><img src="./icon-192.png" alt="" /></span>
        <h1 className="splash__title">انگلینڈ آرڈرز</h1>
        <p className="splash__sub">ڈیلیوری اور آرڈر ٹیم</p>
        <Spinner size={22} />
      </div>
    );
  }
  if (!user) return <Login />;
  return (
    <div className="route" key={loc.pathname}>
      <Routes location={loc}>
        <Route path="/" element={<Orders />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/account" element={<Account />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <UIProvider>
        <AuthProvider>
          <HashRouter>
            <BackHandler />
            <Screens />
          </HashRouter>
        </AuthProvider>
      </UIProvider>
    </ThemeProvider>
  );
}
