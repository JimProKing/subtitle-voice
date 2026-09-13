const CACHE = 'subtitle-voice-v3';
const PRECACHE = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/app.js',
  '/js/config.js',
  '/js/a11y.js',
  '/js/camera.js',
  '/js/preprocess.js',
  '/js/ocr.js',
  '/js/subtitle.js',
  '/js/tts.js',
  '/js/help.js',
  '/js/settings.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-512.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirst(req));
    return;
  }
  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) {
    const copy = res.clone();
    const cache = await caches.open(CACHE);
    cache.put(req, copy);
  }
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    const cache = await caches.open(CACHE);
    cache.put(req, res.clone());
    return res;
  } catch {
    return (await caches.match(req)) || caches.match('/index.html');
  }
}
