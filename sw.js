const CACHE_NAME = "hdu-0854-workbench-v10";
const ASSET_VERSION = "20260803.2";
const CORE_ASSETS = [
  "./",
  "./index.html",
  `./styles.css?v=${ASSET_VERSION}`,
  `./app.js?v=${ASSET_VERSION}`,
  "./manifest.json",
  "./app-icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./vendor/lucide.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  const shouldRefresh = event.request.mode === "navigate" ||
    ["document", "script", "style"].includes(event.request.destination);

  if (shouldRefresh) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match("./index.html"))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached ||
      fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match("./index.html"))
    )
  );
});
