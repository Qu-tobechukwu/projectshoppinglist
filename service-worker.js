const CACHE_NAME = 'stellies-v1';
const OFFLINE_URL = '/index.html';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/merch.html',
  '/checkout.html',
  '/thankyou.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/assets/logo.svg',
  '/data/products.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  // online-first for API (Netlify function), otherwise cache-first
  if (req.url.includes('/.netlify/functions/') || req.url.includes('script.google.com')) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }
  event.respondWith(
    caches.match(req).then(resp => resp || fetch(req).catch(() => caches.match(OFFLINE_URL)))
  );
});
