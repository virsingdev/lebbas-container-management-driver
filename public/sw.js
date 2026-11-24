// LEBBAS Driver service worker. Caches app shell/static assets only. API responses are never cached here
// (route data is stored in IndexedDB by the app). Bump VERSION to roll out a new cache.
const VERSION = 'v1';
const STATIC = `lcd-static-${VERSION}`;
const PAGES = `lcd-pages-${VERSION}`;
self.addEventListener('install', (e) => { e.waitUntil(caches.open(STATIC).then((c) => c.addAll(['/offline.html', '/manifest.webmanifest', '/icons/icon-192.png']))); });
self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('lcd-') && ![STATIC, PAGES].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const c = r.clone(); caches.open(STATIC).then((x) => x.put(req, c)); } return r; })));
    return;
  }
  // Pages and Next.js RSC payloads: network first, fall back to the last copy seen online.
  e.respondWith(fetch(req).then((r) => {
    if (r.ok && !r.redirected) { const c = r.clone(); caches.open(PAGES).then((x) => x.put(req, c)); }
    return r;
  }).catch(async () => (await caches.match(req)) || (req.mode === 'navigate' ? (await caches.match('/')) || caches.match('/offline.html') : Response.error())));
});
