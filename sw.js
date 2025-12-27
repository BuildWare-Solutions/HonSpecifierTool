const CACHE_NAME = "sae-pwa-cache-v1";
const ASSETS = [
    "./",
    "./index.html",
    "./styles.css",
    "./app.js",
    "./manifest.json"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", (event) => {
    const req = event.request;

    // SPA navigation: always serve index.html offline for document requests
    if (req.mode === "navigate") {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE_NAME);
            const cached = await cache.match("./index.html");
            if (cached) return cached;
            return fetch(req);
        })());
        return;
    }

    // Cache-first for static assets
    event.respondWith((async () => {
        const cached = await caches.match(req);
        if (cached) return cached;

        try {
            const fresh = await fetch(req);
            const cache = await caches.open(CACHE_NAME);
            cache.put(req, fresh.clone());
            return fresh;
        } catch {
            // Optional: return something meaningful for offline misses
            return new Response("Offline", { status: 503, statusText: "Offline" });
        }
    })());
});
