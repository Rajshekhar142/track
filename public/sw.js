// Basic service worker for caching app shell + runtime caching
const CACHE_NAME = 'life-tracker-shell-v1';
const RUNTIME_CACHE = 'life-tracker-runtime-v1';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/src/main.tsx',     // dev server resolves; in production Vite outputs built assets (we still cache fallback files)
  '/src/styles.css',
  '/manifest.json'
];

// Install: cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => {
        if (k !== CACHE_NAME && k !== RUNTIME_CACHE) return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for shell, network-first for API/runtime
self.addEventListener('fetch', (event) => {
  const req = event.request;
  // only handle GET requests
  if (req.method !== 'GET') return;

  // handle navigation / HTML: network-first (so users get updates), fallback to cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        // save in runtime cache
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // static resources: cache-first
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(networkRes => {
        // put into runtime cache for future
        return caches.open(RUNTIME_CACHE).then(cache => {
          try { cache.put(req, networkRes.clone()); } catch (err) { /* some requests may be opaque */ }
          return networkRes;
        });
      }).catch(() => {
        // fallback for images or fonts can be added here
        return cached;
      });
    })
  );
});
