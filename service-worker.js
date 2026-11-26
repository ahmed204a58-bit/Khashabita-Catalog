const CACHE_NAME = "khashabita-pwa-v3";
const APP_SHELL = [
  "./index.html",
  "./manifest.webmanifest",
  "./app.js?v=20261126-pwa3",
  "./khashabita-icon-192.png",
  "./khashabita-icon-512.png",
  "./favicon.ico",
  "./favicon-512.png",
  "./khashabita-banner-new.png.png",
  "./logo-khashabita.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("khashabita-pwa-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) {
        caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      }
      return response;
    }).catch(async () => {
      const exact = await caches.match(request, { ignoreSearch: true });
      return exact || caches.match(new URL("./index.html", self.registration.scope));
    }));
    return;
  }

  const cacheable = ["script", "style", "image", "font"].includes(request.destination) ||
    /\.(?:webmanifest|json|svg|ico|png|jpe?g|webp)$/i.test(url.pathname);

  if (cacheable) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(async () => {
      return (await caches.match(request, { ignoreSearch: true })) || Response.error();
    }));
  }
});
