// R2B Ops Service Worker v3
// Strategy: network-first for all JS/CSS/API; cache-first only for icons/images.
// JS chunks are intentionally NOT cached to prevent React version mismatches on update.

const CACHE_VERSION = 'r2b-ops-v3';

// Install: skip waiting immediately so new SW takes over right away
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

// Activate: delete ALL old caches and claim all clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for everything except static icons/images
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always use network for:
  // - API and tRPC calls
  // - JS and CSS files (Vite hashed chunks — never cache these)
  // - Vite dev server internals
  // - HTML navigation (always get fresh HTML)
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.includes('/@') ||
    url.pathname.includes('/.vite/') ||
    url.pathname.includes('/node_modules/') ||
    event.request.mode === 'navigate'
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first only for static image/icon assets
  if (
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Default: network-first, no caching
  event.respondWith(fetch(event.request));
});

// ─── Push — show notification ─────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'R2B Ops', body: 'New enrollment', icon: '/icon-192.png', url: '/' };

  if (event.data) {
    try {
      data = { ...data, ...JSON.parse(event.data.text()) };
    } catch (_) {}
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: '/icon-192.png',
      tag: 'r2b-enrollment',   // replaces previous notification so they don't stack
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: data.url },
      actions: [
        { action: 'view', title: 'View Class' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

// ─── Notification click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
