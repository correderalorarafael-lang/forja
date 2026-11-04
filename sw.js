// La app (HTML/JS) se pide siempre a internet y solo se usa la copia guardada sin conexión;
// las fotos de ejercicios se sirven desde la copia (no cambian). Cambia C en cada versión.
const C = 'forja-v19';
const SHELL = ['./', 'index.html', 'ejercicios.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// Aviso enviado por el servidor forja-push al acabar el descanso (llega aunque el móvil esté bloqueado).
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch {}
  e.waitUntil(self.registration.showNotification(d.title || 'Forja', { body: d.body || '¡Descanso terminado! Vuelve a tu entrenamiento 💪',
    icon: 'icon-192.png', badge: 'icon-192.png', tag: 'descanso', renotify: true, vibrate: [200, 100, 200, 100, 200] }));
});
// Tocar la notificación de fin de descanso: vuelve a Forja (o la abre).
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => cs[0] ? cs[0].focus() : clients.openWindow('./')));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const keep = res => { if (res.ok) { const copy = res.clone(); caches.open(C).then(c => c.put(e.request, copy)); } return res; };
  if (url.pathname.includes('/img/')) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(keep)));
  } else {
    e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(keep)
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./'))));
  }
});
