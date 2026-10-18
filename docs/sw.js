'use strict';
// Increment this version when changing the application shell.
const VERSION = '1.2.0';
const PREFIX = `bible-studies:${self.registration.scope}:`;
const CACHE = `${PREFIX}${VERSION}`;
const url = path => new URL(path, self.registration.scope).href;
const SHELL = ['./', 'index.html', 'styles.css', 'config.js', 'app.js', 'manifest.webmanifest', 'assets/icon.svg', 'assets/icon-180.png', 'assets/icon-192.png', 'assets/icon-512.png', 'studies/index.json'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL.map(url));
    const catalog = await (await cache.match(url('studies/index.json'))).json();
    // Cache the current library; future weekly additions are cached as they are opened.
    await cache.addAll(catalog.studies.flatMap(study => [study.file, study.cover]).map(url));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const oldCaches = (await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== CACHE);
    // Keep previously opened studies available after app updates.
    for (const key of oldCaches) {
      const old = await caches.open(key);
      for (const request of await old.keys()) {
        if (!(await cache.match(request)) && /\/assets\//.test(new URL(request.url).pathname)) {
          await cache.put(request, await old.match(request));
        }
      }
      await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const target = new URL(request.url);
  if (request.method !== 'GET' || !target.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request, {signal: AbortSignal.timeout(5000)});
      if (response.ok && response.type !== 'opaque') await cache.put(request, response.clone());
      return response;
    } catch {
      const saved = await cache.match(request);
      if (saved) return saved;
      if (request.mode === 'navigate') return (await cache.match(url('index.html'))) || Response.error();
      return Response.error();
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'SAVE_STUDY' || !Array.isArray(event.data.paths)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const path of event.data.paths) {
      if (typeof path !== 'string' || !/^(studies|assets)\/[\w.-]+\.(json|jpg|png)$/.test(path)) continue;
      const response = await fetch(url(path));
      if (response.ok) await cache.put(url(path), response);
    }
  })().catch(() => {}));
});
