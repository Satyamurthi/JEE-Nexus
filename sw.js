/* eslint-disable no-restricted-globals */
const CACHE_NAME = 'nexus-v3.5-stable';
const PRE_CACHE_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
  'https://esm.sh/react@^19.2.3',
  'https://esm.sh/react-dom@^19.2.3'
];

const AGGRESSIVE_CACHE_HOSTS = [
  'esm.sh',
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'cdn-icons-png.flaticon.com'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRE_CACHE_RESOURCES).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Data/API Policy: Network Only, with standard error handling
  const isDataRequest = url.hostname.includes('supabase.co') || 
                        url.hostname.includes('googleapis.com') ||
                        url.hostname.includes('huggingface.co');
  
  if (isDataRequest) {
    // We don't interfere with dynamic API calls that might have sensitive headers
    // but we catch network errors to prevent 'Failed to fetch' noise
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request).then(cached => {
            if (cached) return cached;
            return new Response(JSON.stringify({ error: 'Network unavailable' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            });
        });
      })
    );
    return;
  }

  // Navigation Policy: Stale-While-Revalidate for index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => {
        const networkFetch = fetch('/index.html').then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
          return response;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Static Assets: Cache First
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
          if (response && response.status === 200 && (url.origin === location.origin || AGGRESSIVE_CACHE_HOSTS.some(h => url.hostname.includes(h)))) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
      }).catch(() => new Response('Asset unavailable', { status: 404 }));
    })
  );
});