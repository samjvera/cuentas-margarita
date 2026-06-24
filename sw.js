/* ============================================================
   Neteo · Service Worker
   Estrategia:
   - Shell de la app (HTML, iconos, manifest) → Cache First
   - Firebase SDK y Realtime DB → Network Only (datos en tiempo real)
   - Monitor Dólar / BCV → Network First
   ============================================================ */

const CACHE_NAME = 'neteo-v1';

// Recursos del shell que se cachean al instalar
const SHELL_ASSETS = [
  './cuentas-margarita.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-192x192-maskable.png',
  './icons/icon-512x512.png',
  './icons/icon-512x512-maskable.png',
  './icons/apple-touch-icon.png',
];

// Dominios que NUNCA deben cachearse (tiempo real / auth)
const NETWORK_ONLY_HOSTS = [
  'firebaseio.com',
  'firebase.googleapis.com',
  'firebaseapp.com',
  'googleapis.com',
];

// ── Install: pre-cachear el shell ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  );
  // Activar inmediatamente sin esperar a que se cierre la pestaña anterior
  self.skipWaiting();
});

// ── Activate: limpiar caches viejas ───────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: estrategia híbrida ──────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Network Only para Firebase y servicios de tiempo real
  if (NETWORK_ONLY_HOSTS.some(host => url.hostname.includes(host))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Network Only para peticiones POST/PUT/DELETE
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 3. Cache First para recursos del shell (same-origin o gstatic Firebase SDK)
  if (url.origin === self.location.origin || url.hostname.includes('gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          // Solo cachear respuestas válidas
          if (response && response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 4. Network First para el resto (APIs externas como Monitor Dólar)
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
