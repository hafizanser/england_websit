import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// `--mode android` reads .env.android (+ .env.android.local). An Android build must
// point at a server the phone can reach: localhost / 127.0.0.1 there is the phone
// itself, so the build stops instead of shipping an app that can never connect.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const api = (env.VITE_API_BASE || '').trim();
  if (mode === 'android') {
    if (!api) throw new Error('Set VITE_API_BASE in .env.android (or .env.android.local) before an Android build.');
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(api)) {
      throw new Error(`VITE_API_BASE=${api} points at the phone itself. Use the PC's LAN address or the live API.`);
    }
    // The pre-1.3 default api-store.codelps.com no longer exists; an app built against it can never connect.
    if (/api-store\.codelps\.com/i.test(api)) {
      throw new Error(`VITE_API_BASE=${api} is the retired API host. Set VITE_API_BASE=https://englandwaly.com/api in .env.android.`);
    }
  }
  return {
    base: './',
    plugins: [react()],
    build: { target: 'es2019', chunkSizeWarningLimit: 900 },
    // Dev / review: with VITE_API_BASE empty the app calls /app/* on its own origin and
    // Vite forwards it to the local England backend (no CORS changes needed).
    server: { host: true, port: 5180, proxy: { '/app': { target: env.VITE_DEV_PROXY || 'http://127.0.0.1:8010', changeOrigin: true } } },
    preview: { host: true, port: 5181, proxy: { '/app': { target: env.VITE_DEV_PROXY || 'http://127.0.0.1:8010', changeOrigin: true } } },
    test: { environment: 'jsdom', globals: true },
  };
});
