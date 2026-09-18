import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const swTemplate = fileURLToPath(new URL('./src/sw/service-worker.js', import.meta.url))

/**
 * Emit `dist/sw.js` from src/sw/service-worker.js, with the build stamped into
 * it.
 *
 * The worker needs three things it cannot know by reading its own source: the
 * identity of the build it belongs to, the origin of the API, and the list of
 * hashed filenames to precache. All three are only knowable HERE, once rollup
 * has named the output — which is the whole reason the worker is generated
 * rather than dropped in public/ and maintained by hand. A hand-kept list is a
 * list that goes stale, and a stale precache list is a visitor pinned to a build
 * that no longer exists on the server.
 *
 * The build id is a hash of the emitted filenames, not a timestamp. Those names
 * already contain content hashes, so it changes when and only when the output
 * does: rebuilding the same source twice produces the same id, and the worker is
 * byte-identical, so browsers do not see an update and nobody's caches are
 * dropped for nothing.
 */
function englandServiceWorker(apiBase) {
  return {
    name: 'england-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).sort()

      // What a storefront visitor needs to open the site with the network off.
      // The admin chunk is excluded on purpose: it is a separate application
      // nobody browsing the catalogue will ever load, and precaching it would
      // spend a shopkeeper's data on a screen they cannot even sign in to.
      const precache = [
        'index.html',
        ...files.filter(
          (f) =>
            /^assets\/.+\.(js|css)$/.test(f) &&
            !/admin/i.test(f) &&
            // html2canvas + jspdf are the invoice/PDF path — a few hundred KB
            // that only the admin panel and the order pages reach for.
            !/(html2canvas|jspdf|purify|index\.es)/i.test(f) &&
            // The in-browser video transcoder (~700 KB). Only an admin saving a
            // large product clip ever loads it, and it is fetched on demand
            // when they do — precaching it would spend every SHOPPER's data on
            // a tool they will never touch.
            !/mediabunny/i.test(f),
        ),
        // The loader's wordmark: this is the FIRST paint on every visit, so it
        // is the one image worth having before anything asks for it.
        'england-loader-mark.webp',
        'site.webmanifest',
      ]

      const build = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 12)

      // VITE_API_BASE COMES IN TWO SHAPES, and the worker has to recognise the
      // API under both:
      //
      //   https://api-store.codelps.com   a separate origin
      //   /api                            same origin as the storefront, behind
      //                                   a path prefix
      //
      // An earlier version of this ran `new URL(apiBase)` and took the origin.
      // That throws on the relative form — which is the form the live site
      // actually uses — and the fallback it landed on matched nothing, so the
      // deployed worker quietly cached no catalogue JSON and no product images
      // at all. Splitting it into an origin AND a prefix is what makes both
      // shapes describable; an empty origin means "wherever this worker is
      // served from", which is the only honest answer for a relative base,
      // because the deploy host is not knowable at build time.
      let apiOrigin = ''
      let apiPrefix = ''

      const base = String(apiBase || '').trim()
      if (/^https?:\/\//i.test(base)) {
        const url = new URL(base)
        apiOrigin = url.origin
        apiPrefix = url.pathname.replace(/\/+$/, '')
      } else {
        apiPrefix = base.replace(/\/+$/, '')
        if (apiPrefix && !apiPrefix.startsWith('/')) apiPrefix = '/' + apiPrefix
      }

      const source = readFileSync(swTemplate, 'utf8')
        .replace('__ENG_BUILD__', build)
        .replace('__ENG_API_ORIGIN__', apiOrigin)
        .replace('__ENG_API_PREFIX__', apiPrefix)
        .replace('__ENG_PRECACHE__', JSON.stringify(precache))

      // Deliberately unhashed. A service worker is found by URL, and that URL
      // has to stay the same across deploys or every visitor would keep the old
      // worker forever while a new one accumulated beside it.
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// base './' keeps asset paths relative so the build works when served from a
// sub-folder under XAMPP (e.g. http://localhost/FMCG_project/dist/). The app
// uses HashRouter so deep links and refreshes work without server rewrites.
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // The API base is baked into the bundle by Vite's own env handling; the
  // service worker needs the same value, and `loadEnv` is how a config file
  // reads it (import.meta.env does not exist out here).
  const env = loadEnv(mode, process.cwd(), '')

  return {
    base: './',
    plugins: [react(), englandServiceWorker(env.VITE_API_BASE || '')],
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
            // Named, not for caching reasons but so the service worker's precache
            // filter above can recognise and skip it. Left to Rollup it is
            // emitted as `index-[hash].js` — the same stem as the app's own
            // entry chunk, so it cannot be excluded by name. It stays a lazy
            // chunk: its only importer is a dynamic import() in
            // lib/videoCompress.js.
            mediabunny: ['mediabunny'],
          },
        },
      },
    },
  }
})
