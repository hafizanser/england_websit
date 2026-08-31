import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps asset paths relative so the build works when served from a
// sub-folder under XAMPP (e.g. http://localhost/FMCG_project/dist/). The app
// uses HashRouter so deep links and refreshes work without server rewrites.
// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    // Emitted filenames all carry a content hash, which is the precondition for
    // the one-year `immutable` header public/.htaccess puts on /assets/. These
    // are Vite's defaults, spelled out rather than assumed: the caching policy
    // depends on them, so an accidental change here must be visible as a diff in
    // this file and not as stale bundles on shoppers' phones a month later.
    // index.html itself is served `no-cache`, so a deploy is picked up on the
    // next load and only the files that actually changed are re-downloaded.
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        // Split heavy vendors into cacheable chunks. The point is cache
        // longevity, not just size: react/framer-motion/phosphor change on a
        // dependency bump, app code changes weekly, and separating them means a
        // normal deploy leaves ~500 KB of vendor bundle untouched in the
        // shopper's cache.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          icons: ['@phosphor-icons/react'],
        },
      },
    },
  },
})
