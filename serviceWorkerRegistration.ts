
export function register(config?: any) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Use relative path to support deployments in subpaths
      const swUrl = './sw.js';
      // Always perform the check to handle cloud preview environments (redirects) correctly
      checkValidServiceWorker(swUrl, config);
    });
  }
}

function registerValidSW(swUrl: string, config?: any) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              console.log('New content is available; please refresh.');
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              console.log('Content is cached for offline use.');
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
    })
    .catch((error) => {
      // Suppress specific origin mismatch errors common in preview environments (like AI Studio / StackBlitz)
      // These environments often redirect missing assets to a login page on a different domain.
      const msg = error.message || '';
      if (msg.includes('origin') || msg.includes('scriptURL') || msg.includes('SecurityError') || msg.includes('redirect')) {
          // Silently fail in environments that redirect SW scripts
          return;
      }
      console.error('Error during service worker registration:', error);
    });
}

function checkValidServiceWorker(swUrl: string, config?: any) {
  // Fetch the service worker script to check if it exists and is valid
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      // 1. Check for Redirects (CRITICAL for fixing the Origin Mismatch error)
      if (response.redirected) {
         // Silently abort if redirected to avoid security errors in console
         return;
      }

      // 2. Check Origin Mismatch explicitly if response.url is available
      if (response.url) {
        try {
           // Use window.location.href as base to safely handle relative URLs
           const resUrl = new URL(response.url, window.location.href);
           if (resUrl.origin !== window.location.origin) {
               // Silently abort
               return;
           }
        } catch(e) {
           // Ignore URL parsing errors, but verify content type below
        }
      }

      // 3. Verify Content Type
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // No service worker found. Probably a different app. Reload the page.
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service worker found and valid. Proceed.
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log('No internet connection found. App is running in offline mode.');
    });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}
