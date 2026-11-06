const CACHE = 'beamlock-v25';
const ASSETS = ['./', './index.html', './css/app.css', './js/app.js', './js/present.js', './js/config.js', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-192.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './vendor/supabase.js', './vendor/xlsx.full.min.js'];

function shellRequest(request) {
  if (request.mode === 'navigate') return true;
  const url = new URL(request.url);
  return url.origin === self.location.origin && /\.(html|js|css)$/.test(url.pathname);
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(windows.map(async (client) => {
      try { if (client.url) await client.navigate(client.url); } catch (_) {}
    }));
  })());
});

function dropOldCaches() {
  return caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))));
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.hostname.includes('supabase.co')) return;
  if (event.request.method !== 'GET') return;
  if (shellRequest(event.request)) event.waitUntil(dropOldCaches());
  if (shellRequest(event.request)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request);
        if (fresh && fresh.ok) {
          const copy = fresh.clone();
          const cache = await caches.open(CACHE);
          await cache.put(event.request, copy);
        }
        return fresh;
      } catch (_) {
        return (await caches.match(event.request)) || (await caches.match('./index.html'));
      }
    })());
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    }
    return res;
  }).catch(() => cached || caches.match('./index.html'))));
});
