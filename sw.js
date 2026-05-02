// Family Meal Plan — Service Worker v3
// Caches the full app shell (including split JS modules) on first load.

var CACHE = 'meal-plan-v14';
var ASSETS = [
  '/family-meal-plan/',
  '/family-meal-plan/index.html',
  '/family-meal-plan/ff-data.js',
  '/family-meal-plan/ff-engine.js'
];

// Install — pre-cache shell
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — delete old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k)   { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — cache-first for same-origin, network-first for CDN (Google Fonts)
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Google Fonts — network-first, fall back to cache
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      fetch(e.request).then(function(resp) {
        var clone = resp.clone();
        caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
        return resp;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }

  // Everything else — cache-first
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(resp) {
        // Only cache successful same-origin responses
        if (resp && resp.status === 200 && e.request.url.startsWith(self.location.origin)) {
          var clone = resp.clone();
          caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
        }
        return resp;
      });
    })
  );
});
