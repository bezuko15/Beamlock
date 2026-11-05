const CACHE = 'beamlock-v6';
const ASSETS = ['./', './index.html', './css/app.css', './js/app.js', './js/config.js', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './vendor/supabase.js', './vendor/xlsx.full.min.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('supabase.co')) return;
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
    const copy = res.clone();
    if (e.request.method === 'GET' && res.ok) caches.open(CACHE).then((c) => c.put(e.request, copy));
    return res;
  }).catch(() => cached)));
});
