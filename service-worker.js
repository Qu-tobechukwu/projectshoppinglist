const CACHE_NAME = 'golden-grove-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/splash.html',
  '/merch.html',
  '/checkout.html',
  '/thankyou.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/assets/logo.svg',
  '/data/products.json',
  '/data/merch.json',
  '/data/ads.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        // update in background
        fetch(req).then(res => { if(res && res.status === 200) caches.open(CACHE_NAME).then(c => c.put(req, res.clone())); }).catch(()=>{});
        return cached;
      }
      return fetch(req).then(res => {
        if(res && res.status === 200 && req.destination !== 'document') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return res;
      }).catch(()=>caches.match('/index.html'));
    })
  );
});
