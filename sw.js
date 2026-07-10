// Service Worker de Framecorreo
// 1) Permite que el navegador ofrezca "Instalar app".
// 2) Deja el terreno listo para notificaciones push reales en el futuro
//    (hoy los toques se muestran mientras la app está abierta; ver index.html).

const CACHE_NAME = 'framecorreo-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// ─── Push real (para cuando se configure Firebase Cloud Messaging u otro
// servicio de push). Por ahora no se dispara desde ningún backend, pero
// queda listo: si en el futuro llega un push, se muestra la notificación. ───
self.addEventListener('push', (event) => {
  let data = { title: 'Framecorreo', body: 'Te llegó un toque 💌' };
  try { if (event.data) data = event.data.json(); } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Framecorreo', {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [80, 40, 80]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes('index.html') || c.url.endsWith('/'));
      if (existing) return existing.focus();
      return clients.openWindow('./index.html');
    })
  );
});
