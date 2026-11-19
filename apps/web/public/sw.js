/* global self, caches, fetch, URL, Response, AbortController, setTimeout, clearTimeout */
const shellCache = 'lead-finder-shell-v2';
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(shellCache)
      .then((cache) => cache.addAll(['/', '/crm']))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('lead-finder-shell-') && key !== shellCache)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_SHELL') return;
  const paths = event.data.paths.filter((path) => {
    const url = new URL(path, self.location.origin);
    return url.origin === self.location.origin && url.pathname.startsWith('/_next/static/');
  });
  event.waitUntil(
    caches
      .open(shellCache)
      .then((cache) => Promise.allSettled(paths.map((path) => cache.add(path)))),
  );
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  )
    return;
  if (event.request.mode === 'navigate' && ['/', '/crm'].includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        try {
          const response = await fetch(event.request, { signal: controller.signal });
          if (!response.ok) throw new Error('Shell unavailable');
          const cache = await caches.open(shellCache);
          await cache.put(url.pathname, response.clone());
          return response;
        } catch {
          return (
            (await caches.match(url.pathname)) ??
            new Response('Відкрийте застосунок онлайн один раз, щоб підготувати локальний режим.', {
              status: 503,
              headers: { 'content-type': 'text/plain;charset=utf-8' },
            })
          );
        } finally {
          clearTimeout(timeout);
        }
      })(),
    );
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) {
          const cache = await caches.open(shellCache);
          await cache.put(event.request, response.clone());
        }
        return response;
      })(),
    );
  }
});
