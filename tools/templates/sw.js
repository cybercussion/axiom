/**
 * Axiom PWA service worker (template — seeded by `node tools/create-seo.js --pwa`).
 *
 * Strategy, and why:
 *  - NAVIGATIONS are network-first; the cached shell is an OFFLINE FALLBACK only. The
 *    site's _headers make every HTML load revalidate so a deploy reaches everyone at
 *    once — a cache-first worker would defeat that.
 *  - Same-origin ASSETS (JS/CSS/img) are stale-while-revalidate: served from cache so
 *    route-module imports never stall a view transition, refreshed in the background.
 *  - Same-origin API paths (API_PREFIXES) are NEVER touched. Per-user responses served
 *    stale put the UI permanently one refresh behind (ev, 2026-06-21). Cross-origin
 *    requests pass straight through.
 *  - CACHE carries the build id (tools/minify.js replaces __BUILD_ID__ at build time), so
 *    each deploy gets an isolated, internally consistent cache and activate() purges the
 *    previous build's. Unbuilt (dev) copies keep the literal placeholder, which is fine.
 *
 * Validation gotcha: after a deploy, a hard reload bypasses HTTP cache for the DOCUMENT
 * only — lazily imported feature modules still come from this worker's cache until the
 * new worker activates (~2 natural loads). To see a fresh build immediately:
 *   (await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());
 *   (await caches.keys()).forEach(k => caches.delete(k));
 */
const CACHE = 'axiom-__BUILD_ID__';
const API_PREFIXES = ['/api/'];
// Minimal offline shell. Everything else is cached on first successful fetch.
const SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (API_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html').then((cached) => cached || caches.match('/'))
      )
    );
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    const fetched = fetch(request)
      .then((res) => { cachePut(request, res.clone()); return res; })
      .catch(() => null);
    if (cached) { event.waitUntil(fetched); return cached; }
    return (await fetched) || new Response('', { status: 504, statusText: 'Offline' });
  })());
});

function cachePut(request, response) {
  // Only complete, same-origin OK responses (skip opaque/range/error responses).
  if (!response || !response.ok || response.type === 'opaque') return;
  caches.open(CACHE).then((cache) => cache.put(request, response)).catch(() => {});
}
