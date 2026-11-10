// Offline copy of the app: the shell, the plan and every photo, so the shopping list and
// recipes work in a shop with no signal. The server stamps the build into the cache name.
const CACHE_NAME = "homeblock-__BUILD__";
const SHELL = ["/", "/styles.css", "/exercises.js", "/planmath.js", "/app.js", "/data/plan.json", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(SHELL.map((url) => new Request(url, { cache: "reload" })));
      // Photos: best effort, a missing one must not block the install.
      try {
        const plan = await (await fetch("/data/plan.json", { cache: "reload" })).json();
        const imgs = new Set(Object.values(plan.prod).map((p) => "/" + p.img));
        await Promise.all([...imgs].map((u) => cache.add(u).catch(() => {})));
      } catch {}
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first; the cached copy stands in when offline. The API is never cached.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
