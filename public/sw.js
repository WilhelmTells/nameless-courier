// Lets the game be installed and played offline. Pages come from the network
// first (so a new version arrives as soon as there is one) and fall back to
// the copy kept here; everything else (scripts, styles, icons, all with
// versioned names) is kept on first use and served from here after that.
const CACHE = "courier";

// On install, keep the page and everything it links to, so the game works
// offline from the first visit on.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const page = await fetch(self.registration.scope);
      const html = await page.clone().text();
      await cache.put(self.registration.scope, page);
      const links = [...html.matchAll(/(?:href|src)="([^"#?]+)"/g)].map((m) => new URL(m[1], self.registration.scope).href);
      await cache.addAll([...new Set(links)].filter((url) => url.startsWith(self.registration.scope)));
      await self.skipWaiting();
    })().catch(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request, { ignoreSearch: true }).then((hit) => hit ?? caches.match(self.registration.scope))),
    );
    return;
  }
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
