import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Api, setToken, setUnauthorizedHandler } from '../lib/api.js';
import { pushBack } from '../lib/backstack.js';
import { readSecure, removeSecure, writeSecure } from '../lib/secureStore.js';

// ---------------------------------------------------------------- auth
const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ ready: false, user: null, expired: false });

  const signOutLocal = useCallback(async (expired = false) => {
    setToken(null);
    await removeSecure('token');
    await removeSecure('user');
    setState({ ready: true, user: null, expired });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { signOutLocal(true); });
    (async () => {
      const t = await readSecure('token');
      const u = await readSecure('user');
      if (t) {
        setToken(t);
        let user = null;
        try { user = u ? JSON.parse(u) : null; } catch { /* re-read below */ }
        setState({ ready: true, user: user || { username: '' }, expired: false });
        // Confirm the token is still valid in the background (a 401 signs out).
        Api.me().then((r) => r?.user && setState({ ready: true, user: r.user, expired: false })).catch(() => {});
      } else {
        setState({ ready: true, user: null, expired: false });
      }
    })();
  }, [signOutLocal]);

  const login = useCallback(async (username, password) => {
    const r = await Api.login(username, password);
    setToken(r.token);
    await writeSecure('token', r.token);
    await writeSecure('user', JSON.stringify(r.user));
    setState({ ready: true, user: r.user, expired: false });
    return r.user;
  }, []);

  const logout = useCallback(async () => {
    await Api.logout();
    await signOutLocal(false);
  }, [signOutLocal]);

  const value = useMemo(() => ({ ...state, login, logout }), [state, login, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

// ---------------------------------------------------------------- theme
const ThemeCtx = createContext(null);
const THEME_KEY = 'eo.theme';

function systemDark() {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; }
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || 'light'; } catch { return 'light'; }
  });
  const [sysDark, setSysDark] = useState(systemDark);

  useEffect(() => {
    let mq;
    try { mq = window.matchMedia('(prefers-color-scheme: dark)'); } catch { return undefined; }
    const fn = (e) => setSysDark(e.matches);
    mq.addEventListener?.('change', fn);
    return () => mq.removeEventListener?.('change', fn);
  }, []);

  const resolved = mode === 'system' ? (sysDark ? 'dark' : 'light') : mode;
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#1b150e' : '#ae8040');
  }, [resolved]);

  const choose = useCallback((m) => {
    setMode(m);
    try { localStorage.setItem(THEME_KEY, m); } catch { /* per-device convenience only */ }
  }, []);

  const value = useMemo(() => ({ mode, resolved, choose }), [mode, resolved, choose]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);

// ---------------------------------------------------------------- toast + confirm dialog
const UICtx = createContext(null);

export function UIProvider({ children }) {
  const [toast, setToast] = useState({ message: '', kind: 'info', visible: false, id: 0 });
  const [dialog, setDialog] = useState({ open: false, options: null });
  const timer = useRef(null);

  const showToast = useCallback((message, kind = 'info', ms = 2800) => {
    clearTimeout(timer.current);
    setToast({ message, kind, visible: true, id: Date.now() });
    timer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), ms);
  }, []);

  /** confirm({ title, body, okLabel, cancelLabel, danger, onOk }) */
  const confirm = useCallback((options) => setDialog({ open: true, options }), []);
  const closeDialog = useCallback(() => setDialog((d) => ({ ...d, open: false })), []);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => (dialog.open ? pushBack(closeDialog) : undefined), [dialog.open, closeDialog]);
  useEffect(() => {
    if (!dialog.open) return undefined;
    const k = (e) => { if (e.key === 'Escape') closeDialog(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [dialog.open, closeDialog]);

  const value = useMemo(() => ({ toast: showToast, confirm }), [showToast, confirm]);
  const o = dialog.options || {};
  return (
    <UICtx.Provider value={value}>
      {children}
      <div className={`toast toast--${toast.kind} ${toast.visible ? 'is-visible' : ''}`} role="status" aria-live="polite" key={toast.id}
        onClick={() => setToast((t) => ({ ...t, visible: false }))}>
        <span className="toast__text">{toast.message}</span>
      </div>
      <div className={`dialog-scrim ${dialog.open ? 'is-open' : ''}`} onClick={closeDialog} aria-hidden={!dialog.open}>
        <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" onClick={(e) => e.stopPropagation()}>
          <h3 id="dialog-title">{o.title}</h3>
          {o.body && <p>{o.body}</p>}
          <div className="dialog__actions">
            <button type="button" className={`dialog__ok ${o.danger ? 'dialog__ok--danger' : ''}`}
              onClick={() => { closeDialog(); o.onOk?.(); }}>{o.okLabel || 'ٹھیک ہے'}</button>
            <button type="button" className="dialog__cancel" onClick={closeDialog}>{o.cancelLabel || 'واپس جائیں'}</button>
          </div>
        </div>
      </div>
    </UICtx.Provider>
  );
}

export const useUI = () => useContext(UICtx);
/** Kept for screens written against the old toast API. */
export const useToast = () => useContext(UICtx).toast;
