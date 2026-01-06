
/* eslint-disable no-restricted-globals */
const CACHE_NAME = 'nexus-v3.2-patch'; // Updated version
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

// Installation phase: Lock in core shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Nexus SW] Pre-caching Core Shell');
      return cache.addAll(PRE_CACHE_RESOURCES);
    })
  );
});

// Activation phase: Purge legacy layers
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Nexus SW] Purging obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Intelligent Fetch strategy: Network Speed Agnostic
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Skip non-GET and local/private requests
  if (request.method !== 'GET') return;

  // 2. Data/API Policy: Network First, Fallback to Cache
  const isDataRequest = url.hostname.includes('supabase.co') || 
                        url.hostname.includes('googleapis.com');
  
  if (isDataRequest) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If successful, cache it for offline redundancy
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 3. Static/Asset Policy: Cache First, Revalidate in background (SWR)
  const isCdnAsset = AGGRESSIVE_CACHE_HOSTS.some(host => url.hostname.includes(host));
  
  if (isCdnAsset || PRE_CACHE_RESOURCES.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        }).catch(() => {
          // Silent fail - return cached if available
        });
        
        return cached || networkFetch;
      })
    );
    return;
  }

  // 4. Navigation/App-Shell Policy: Stale-While-Revalidate
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
          return response;
        }).catch(() => cached);
        
        return cached || networkFetch;
      })
    );
    return;
  }

  // 5. Default: Cache Match or Network
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
