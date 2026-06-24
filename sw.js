/* ============================================================
   Neteo · Service Worker
   ============================================================ */

const CACHE_NAME = 'neteo-v1';

// Solo cacheamos el HTML principal (los íconos van inline en el HTML)
const SHELL_ASSETS = [
  './cuentas-margarita.html',
];

// Dominios que NUNCA deben cachearse (Firebase tiempo real)
const NETWORK_ONLY_HOSTS = [
  'firebaseio.com',
  'firebase.googleapis.com',
  'firebaseapp.com',
  'googleapis.com',
  'gstatic.com',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network Only para Firebase
  if (NETWORK_ONLY_HOSTS.some(host => url.hostname.includes(host))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network Only para POST/PUT/DELETE
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache First para el shell
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network First para el resto
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
