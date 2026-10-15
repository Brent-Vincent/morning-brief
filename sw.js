const CACHE_NAME = 'morning-brief-v1';
const ROOT = new URL('./', self.location.href);
const HEADLINES = new URL('data/headlines.json', ROOT);
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'install.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'data/headlines.json'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL.map(path => new URL(path, ROOT).href))));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('morning-brief-') && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  const isHeadlines = url.pathname === HEADLINES.pathname;
  const isShell = SHELL.some(path => new URL(path, ROOT).pathname === url.pathname);
  if (!isHeadlines && !isShell && event.request.mode !== 'navigate') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = isHeadlines ? HEADLINES.href : url.href;
    try {
      const response = await fetch(event.request);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (isHeadlines) {
        const data = await response.clone().json();
        if (!Array.isArray(data.articles)) throw new Error('Invalid headlines');
      }
      await cache.put(cacheKey, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        const home = await cache.match(ROOT.href);
        if (home) return home;
      }
      return Response.error();
    }
  })());
});
