// Registration and teardown for the storefront's service worker.
//
// The worker itself is src/sw/service-worker.js, emitted as sw.js by the plugin
// in vite.config.js. This module is the page's side of the arrangement, and it
// is three small decisions:
//
//   1. PRODUCTION ONLY. In dev, Vite serves modules it rewrites on every save;
//      a worker caching them is a guaranteed afternoon of debugging a stale file
//      that "definitely saved". So dev does the opposite — it actively tears any
//      existing registration down, because a developer who once opened the built
//      site on localhost would otherwise keep being served by it.
//
//   2. AFTER `load`. Registering kicks off the precache — a megabyte or so of
//      the build, mostly answered from the browser's own HTTP cache but not for
//      free. Doing that while the first screen is still painting takes bandwidth
//      from the thing the visitor is waiting for. The worker's entire value is
//      on the NEXT visit, so it can afford to wait for this one to finish.
//
//   3. RELATIVE TO document.baseURI. The app builds with `base: './'` and can be
//      served from a sub-folder; a hardcoded '/sw.js' would register at the
//      wrong scope (or 404) on exactly the deployments that path was chosen for.

import { noteCatalogVersion } from './queryCache'

export function initServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  if (!import.meta.env.PROD) {
    unregisterAll()
    return
  }

  // The worker posts here when a background revalidation finds that the API's
  // X-Catalog-Version has moved. This is the other half of the cache being
  // allowed to serve stale catalogue JSON: the body the app was handed carries
  // the OLD token, so the app cannot detect a change by reading it. Routing the
  // news into the same noteCatalogVersion() that the HTTP layer calls means an
  // admin's edit lands on screen through exactly the path it always did — the
  // in-memory cache is dropped and every mounted hook re-reads in place, this
  // time hitting a worker cache that already holds the new answer.
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'eng:catalog-version') {
      noteCatalogVersion(event.data.version)
    }
  })

  const start = () => {
    const url = new URL('sw.js', document.baseURI).href

    navigator.serviceWorker
      // `updateViaCache: 'none'` so the worker SCRIPT itself is always
      // revalidated. Without it browsers may serve sw.js from the HTTP cache for
      // up to a day, which would mean a deploy's new worker — and therefore its
      // new precache list — simply does not exist for a while.
      .register(url, { updateViaCache: 'none' })
      .then(() => {
        // A worker that was already installed on a previous visit is holding a
        // catalogue version this page has never seen. Ask for it, rather than
        // waiting for a write to happen to occur while this tab is open.
        navigator.serviceWorker.ready.then((reg) => {
          const worker = reg.active || navigator.serviceWorker.controller
          if (worker) worker.postMessage({ type: 'eng:sync' })
        })
      })
      .catch(() => {
        // An unsupported context, a blocked worker, a private window. The site
        // works exactly as it did before this file existed — nothing here is on
        // any critical path, so a failure is not worth telling anyone about.
      })
  }

  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}

// Used in dev, and available as the escape hatch if the worker ever has to be
// switched off in production: ship a build whose main.jsx calls this instead,
// and the next visit un-installs itself and drops every cache it created.
export function unregisterAll() {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((reg) => reg.unregister()))
    .catch(() => {})

  if (typeof caches === 'undefined') return
  caches
    .keys()
    .then((names) => names.filter((n) => n.startsWith('eng-')).forEach((n) => caches.delete(n)))
    .catch(() => {})
}
