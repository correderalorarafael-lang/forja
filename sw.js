// shortcut: cache-first app shell; bump C on every release so phones pick up the new version.
const C = 'forja-v2';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(['./', 'index.html', 'ejercicios.js', 'manifest.json', 'icon.svg'])));
  self.skipWaiting();
});
self.addEventListener('activate', e =>
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k))))));
// Las fotos de ejercicios se guardan la primera vez que se ven, para tenerlas sin conexión.
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
  if (res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(C).then(c => c.put(e.request, copy)); }
  return res;
}))));
