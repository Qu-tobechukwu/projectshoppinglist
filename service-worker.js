const CACHE_NAME = 'eden-creates-v1';
const ASSETS = [
  './',
  './index.html',
  './merch.html',
  './checkout.html',
  './thankyou.html',
  './style.css',
  './script.js',
  './install.js',
  './manifest.json',
  './assets/logo.svg',
  './data/products.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  // prefer network for dynamic endpoints; otherwise cache-first
  if(req.url.includes('/.netlify/functions/') || req.url.includes('script.google.com')){
    event.respondWith(fetch(req).catch(()=>caches.match(req)));
    return;
  }
  event.respondWith(
    caches.match(req).then(resp => resp || fetch(req).catch(()=> caches.match('./index.html')))
  );
});
