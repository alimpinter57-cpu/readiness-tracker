/* Readiness PWA service worker.
 * Cache the app shell for offline navigation; keep user data in localStorage.
 * Supabase requests remain network-dependent and are never faked as successful.
 */
const CACHE_NAME = "readiness-offline-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./summary.html",
  "./latihan/latihan.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./Store/style.css",
  "./Store/enhancements.css",
  "./Store/ui-polish.css",
  "./Store/summary.css",
  "./Store/store.js",
  "./Store/supabase-config.js",
  "./Store/cloud.js",
  "./Store/home.js",
  "./Store/summary.js",
  "./Store/latihan.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("readiness-offline-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Do not intercept Supabase/CDN requests: cloud auth and sync must report
  // their real network status rather than returning stale or fabricated data.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        return cached || caches.match("./index.html");
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
