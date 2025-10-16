// service-worker.js
const CACHE_NAME = 'stellies-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/menu.html',
  '/merch.html',
  '/checkout.html',
  '/success.html',
  '/assets/logo.svg',
  '/styles.css',
  '/script.js',
  '/data/food.json',
  '/data/merch.json'
];

// Install event – cache everything
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Caching assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate event – clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch event – serve from cache first
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return (
        cachedResponse ||
        fetch(event.request).then(response => {
          return caches.open(CACHE_NAME).then(cache => {
            // Clone response so both browser & cache can use it
            cache.put(event.request, response.clone());
            return response;
          });
        })
      );
    })
  );
});
