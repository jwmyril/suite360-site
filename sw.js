// Suite 360 — service worker PWA.
//
// STRATÉGIE. Réseau d'abord pour les pages HTML (jamais de page figée — leçon
// de l'Explorateur), cache d'abord pour les assets. L'API atmart-chat est
// cross-origin : jamais interceptée.
//
// TROIS DÉFAUTS CORRIGÉS LE 26/08/2026, relevés par un audit externe sur le
// contenu réel du cache en production :
//
//  1. Aucun test de `r.ok` avant `cache.put`. Un asset qui renvoie 404 pendant
//     un déploiement GitHub Pages était figé EN ÉCHEC jusqu'au prochain
//     changement de nom de cache — et la branche assets ne retourne jamais au
//     réseau quand une entrée existe. Le cache contenait `/manifest.json` et
//     `/cette-page-nexiste-pas-123.html` en 404 de 4 488 octets.
//
//  2. La clé de cache incluait la query. Donc `entevyou.html?code=ENT-XXXX-YYYY`
//     — le code payant au retour de Stripe — était stocké verbatim, et le bouton
//     « Oublier » ne retirait que localStorage. Sur poste partagé, le code
//     restait lisible après que la personne ait cru l'effacer.
//     Les clés sont désormais normalisées sur origine + chemin.
//
//  3. Trois mécanismes de version tenus à la main, déjà désynchronisés : CORE
//     préchargeait `style.css?v=1` quand les pages demandaient `?v=3`, et
//     `theme.js` n'y figurait pas. Puisque la clé ignore la query, il ne reste
//     qu'UNE constante à bouger : CACHE.
//
// Et `caches.addAll()` est atomique : si une seule des URL échoue, le service
// worker ne s'installe pas du tout, silencieusement. On met donc en cache
// entrée par entrée. `tests/pwa.js` vérifie en plus que chaque chemin de CORE
// existe réellement dans le dépôt.
const CACHE = "suite360-v52";
const CORE = [
  "/",
  "/index.html",
  "/entevyou.html",
  "/candidats.html",
  "/organisations.html",
  "/karye.html",
  "/assets/style.css",
  "/assets/theme.js",
  "/assets/brand/logo-360-96.png",
  "/assets/brand/icon-360-192.png",
];

// La query ne fait pas partie de l'identité d'une ressource ici : `?v=3` sert
// au cache du NAVIGATEUR, et `?code=` n'est qu'un message pour la page.
function cleDe(url) {
  return new URL(url).origin + new URL(url).pathname;
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(CORE.map((u) =>
        // entrée par entrée : une URL manquante ne doit pas empêcher
        // l'installation entière, en silence.
        fetch(u, { cache: "reload" })
          .then((r) => (r.ok ? c.put(cleDe(new URL(u, location.origin).href), r) : null))
          .catch(() => null)
      )))
      .then(() => self.skipWaiting())
  );
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
  // Le service worker ne se met jamais en cache lui-même : c'est l'amorce
  // classique d'un worker qui ne se met plus à jour.
  if (url.pathname === "/sw.js") return;
  // Médias : laisser passer au réseau. Chrome les demande par Range (206) et
  // cache.put() sur une réponse partielle lève une TypeError.
  if (/\.(mp4|webm|mp3|m4a|mov)$/i.test(url.pathname)) return;

  const cle = cleDe(e.request.url);
  const isPage = url.pathname === "/" || url.pathname.endsWith(".html");

  if (isPage) {
    // réseau d'abord : toujours la version fraîche ; cache seulement hors-ligne
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(cle, cp)); }
          return r;
        })
        .catch(() => caches.match(cle))
    );
  } else {
    e.respondWith(
      caches.match(cle).then((m) => m || fetch(e.request).then((r) => {
        if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(cle, cp)); }
        return r;
      }))
    );
  }
});
