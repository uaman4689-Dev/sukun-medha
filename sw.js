const CACHE = 'sukun-medha-shell-v6';
const CORE = [
  '/', '/index.html', '/member.html', '/amal.html',
  '/style.css', '/app.js', '/member.js', '/amal.css', '/amal.js',
  '/pwa.js', '/manifest.webmanifest', '/icons/sukun-medha.svg'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(CORE.map(async path => {
      try {
        const response = await fetch(path, { cache: 'reload' });
        if (response.ok) await cache.put(path, response);
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('sukun-medha-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Always fetch current JS/CSS first so installed PWA does not keep stale Amal UI.
  if (/\\.(js|css)$/.test(url.pathname)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response && response.ok) {
          const cache = await caches.open(CACHE);
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      } catch (_) {
        const cache = await caches.open(CACHE);
        return await cache.match(request) || new Response('', { status: 504 });
      }
    })());
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE);
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      } catch (_) {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(request, { ignoreSearch: true }) || await cache.match(url.pathname);
        if (cached) return cached;
        if (url.pathname === '/member.html') {
          const member = await cache.match('/member.html');
          if (member) return member;
        }
        const home = await cache.match('/');
        if (home) return home;
        return new Response('ইন্টারনেট সংযোগ নেই। আগে খোলা পেজটি আবার চেষ্টা করুন।', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    } catch (_) {
      return new Response('', { status: 504 });
    }
  })());
});