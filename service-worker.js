const CACHE_NAME = "khashabita-pwa-v7";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./app.js?v=20261126-pwa7",
  "./khashabita-icon-192.png",
  "./khashabita-icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // A failed optional asset must never abort service-worker installation.
    await Promise.allSettled(APP_SHELL.map(async path => {
      const url = new URL(path, self.registration.scope);
      try {
        const response = await fetch(url, { cache: "reload" });
        if (response.ok && response.type === "basic") {
          await cache.put(url.href, response);
        } else {
          console.warn("Khashabita shell asset unavailable:", path, response.status);
        }
      } catch (error) {
        console.warn("Khashabita shell asset skipped:", path, error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith("khashabita-pwa-") && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function saveToCache(request, response) {
  if (!response || !response.ok || response.type !== "basic") return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        event.waitUntil(saveToCache(request, response).catch(() => {}));
        return response;
      } catch (_) {
        const exact = await caches.match(request, { ignoreSearch: true });
        return exact || caches.match(new URL("./index.html", self.registration.scope));
      }
    })());
    return;
  }

  const cacheable = ["script", "style", "image", "font"].includes(request.destination) ||
    /\.(?:webmanifest|json|svg|ico|png|jpe?g|webp)$/i.test(url.pathname);

  if (cacheable) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        event.waitUntil(saveToCache(request, response).catch(() => {}));
        return response;
      } catch (_) {
        return (await caches.match(request, { ignoreSearch: true })) || Response.error();
      }
    })());
  }
});
