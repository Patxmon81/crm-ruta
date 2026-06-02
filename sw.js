const CACHE = 'crm-rutas-v1';

const FILES = [
  './',
  './index.html',
  './rutero.html',
  './clientes.html',
  './visita.html',
  './historial.html',
  './config.js',
  './favicon.svg',
  './manifest.json',
  './css/styles.css',
  './js/db.js',
  './js/clientes.js',
  './js/visitas.js',
];

// Instalar: guardar todos los archivos en caché
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(FILES))
  );
  self.skipWaiting();
});

// Activar: limpiar cachés antiguas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: caché primero, red como fallback
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
