// Service Worker de Framecorreo
// 1) Permite que el navegador ofrezca "Instalar app".
// 2) Deja el terreno listo para notificaciones push reales en el futuro
//    (hoy los toques se muestran mientras la app está abierta; ver index.html).
//
// Sobre la demora en que le llegue una actualización a alguien: además de
// subir CACHE_NAME acá, index.html ahora registra este archivo con
// `updateViaCache: 'none'`, así el navegador nunca sirve una copia
// cacheada de ESTE ARCHIVO (sw.js) al chequear si hay versión nueva, y
// además pide `reg.update()` apenas carga y cada 60s (no solo al volver
// a abrir la app). Entre las tres cosas, una actualización nueva debería
// notarse en, como mucho, un minuto.

const CACHE_NAME = 'framecorreo-v21'; // subir esta versión en cada deploy: v3, v4, v5, v6, v7, v8, v9, v10...
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  // El SW nuevo se instala y se queda esperando ("waiting") hasta que
  // index.html le manda SKIP_WAITING. Eso ya no depende de que el usuario
  // toque un botón: index.html lo hace solo, apenas detecta la instalación
  // (ver registerServiceWorker/applyUpdateSilently), así la app se
  // autoactualiza sin preguntar.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
});

// Mensaje que manda index.html para instalar la versión nueva apenas se
// detecta (auto-actualización, sin preguntarle nada al usuario). Le avisamos
// de vuelta al cliente que mandó el mensaje qué versión (CACHE_NAME) se está
// por activar, para que pueda mostrar un aviso de "se actualizó a..." después
// de recargar la página.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    if (event.source) {
      try { event.source.postMessage({ type: 'FRAMECORREO_UPDATED', version: CACHE_NAME }); } catch (e) {}
    }
    self.skipWaiting();
  }
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

  // Clave: NO tocar pedidos que no sean del propio origen (Firebase, Telegram, etc.).
  // Si dejamos que el Service Worker intercepte esos pedidos, agarra también las
  // conexiones EventSource (streams que quedan abiertas para siempre) e intenta
  // meterlas en la cache con cache.put(), que espera a que el stream termine.
  // Como nunca termina, la conexión en tiempo real queda inestable: a veces
  // pasa igual, a veces se corta o tarda en reconectar. Por eso la sincronización
  // "a veces anda, a veces no". Dejando pasar de largo lo que no es same-origin,
  // esas conexiones quedan intactas y libres de interferencia.
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

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
