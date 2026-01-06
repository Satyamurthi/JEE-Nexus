
/* eslint-disable no-restricted-globals */
const CACHE_NAME = 'jee-nexus-v2-cache-first';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/mhchem.min.js'
];

// Domains that should be cached aggressively (Cache First)
const CACHE_DOMAINS = [
  'esm.sh',
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net'
];

// Install: Cache core static assets immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache, pre-fetching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: The Core Logic for "Any Speed" Loading
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // 1. API Calls / Supabase: Network First (Fresh data is priority)
  if (requestUrl.pathname.includes('/rest/v1/') || requestUrl.hostname.includes('supabase.co') || requestUrl.hostname.includes('googleapis.com')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Optional: Cache successful GET API responses for offline viewing if needed
          // For now, keeping it strictly network first for data integrity
          return response;
        })
        .catch(() => {
          // If offline, try to find a cached match if we implemented API caching
          return caches.match(event.request);
        })
    );
    return;
  }

  // 2. External CDNs (Libraries/Fonts): Cache First
  // Once downloaded, we trust the cache forever (until version change in URL)
  if (CACHE_DOMAINS.some(domain => requestUrl.hostname.includes(domain))) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'cors' && networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. App Shell / Navigation: Stale-While-Revalidate
  // Serve cached index.html immediately, update in background
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put('/index.html', networkResponse.clone());
          });
          return networkResponse;
        });
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 4. Default: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Cache valid responses
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((err) => {
          // Network failed, nothing to do if not in cache
      });
      return cachedResponse || fetchPromise;
    })
  );
});
