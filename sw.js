const CACHE_NAME = 'sydenham-departures-v2';
// Resolve against sw.js URL so this works at repo root OR GitHub Pages project paths (/Sydenham/).
const base = new URL('.', self.location).href;
const urlsToCache = [
  base,
  new URL('index.html', self.location).href,
  new URL('manifest.json', self.location).href,
  new URL('icon-192.png', self.location).href,
  new URL('icon-512.png', self.location).href
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
}); 