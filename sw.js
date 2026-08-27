// Suite 360 — service worker PWA.
// Stratégie : RÉSEAU D'ABORD pour les pages HTML (jamais de page figée — leçon
// de l'Explorateur), cache d'abord pour les assets. L'API atmart-chat est
// cross-origin : jamais interceptée.
const CACHE = "suite360-v43";
const CORE = [
  "/",
  "/index.html",
  "/entevyou.html",
  "/candidats.html",
  "/organisations.html",
  "/karye.html",
  "/assets/style.css?v=1",
  "/assets/atm360.js?v=3",
  "/assets/brand/logo-360-96.png",
  "/assets/brand/icon-360-192.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // Médias : laisser passer au réseau. Chrome les demande par Range (206) et
  // cache.put() sur une réponse partielle lève une TypeError.
  if (/\.(mp4|webm|mp3|m4a|mov)$/i.test(url.pathname)) return;
  const isPage = url.pathname === "/" || url.pathname.endsWith(".html");
  if (isPage) {
    // réseau d'abord : toujours la version fraîche ; cache seulement hors-ligne
    e.respondWith(
      fetch(e.request)
        .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return r; })
        .catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then((m) => m || fetch(e.request).then((r) => {
        const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return r;
      }))
    );
  }
});
