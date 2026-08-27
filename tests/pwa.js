/* ===========================================================================
   Suite 360 — banc : le service worker

   Trois défauts de cache ne se voient jamais en développement, seulement chez
   le visiteur qui revient :
     • une réponse en échec mise en cache y reste figée jusqu'au prochain
       changement de nom de cache ;
     • une clé qui inclut la query stocke `?code=ENT-XXXX` — un code payant —
       et le bouton « Oublier » ne l'atteint pas ;
     • `caches.addAll()` est ATOMIQUE : une seule URL manquante et le service
       worker ne s'installe pas du tout, en silence.

   USAGE :  node tests/pwa.js
   =========================================================================== */
const fs = require("fs");
const path = require("path");
const RACINE = path.join(__dirname, "..");
const sw = fs.readFileSync(path.join(RACINE, "sw.js"), "utf8");
// On juge le CODE, pas les commentaires : celui de sw.js parle d'addAll() pour
// expliquer pourquoi il ne l'emploie plus, et le banc s'y laissait prendre.
const code = sw.replace(/^\s*\/\/.*$/gm, "");

let ko = 0;
const ok = (nom, cond, detail) => {
  console.log((cond ? "  ✅ " : "  ❌ ") + nom + (cond ? "" : "   → " + detail));
  if (!cond) ko++;
};

console.log("\n— ce qui entre dans le cache —");
const puts = sw.match(/c\.put\(/g) || [];
ok("chaque mise en cache est gardée par r.ok",
  (sw.match(/if \(r\.ok\)/g) || []).length + (sw.match(/r\.ok \?/g) || []).length >= puts.length,
  puts.length + " put(), " + ((sw.match(/if \(r\.ok\)/g) || []).length + (sw.match(/r\.ok \?/g) || []).length) + " garde(s)");
ok("les clés sont normalisées sur origine + chemin", /function cleDe/.test(sw) && /pathname/.test(sw), "");
ok("aucun put() ne prend la requête brute comme clé", !/c\.put\(e\.request/.test(sw), "");
ok("le service worker ne se met pas en cache lui-même", /pathname === "\/sw\.js"\) return/.test(sw), "");
ok("l'installation n'est pas atomique", !/addAll\(/.test(code), "addAll() présent : une URL manquante bloquerait tout");

console.log("\n— la liste préchargée —");
const core = (sw.match(/const CORE = \[([\s\S]*?)\];/) || [, ""])[1]
  .split("\n").map((l) => (l.match(/"([^"]+)"/) || [, ""])[1]).filter(Boolean);
ok("CORE n'est pas vide", core.length > 0, "");
const manquants = core.filter((u) => {
  const p = u === "/" ? "index.html" : u.replace(/^\//, "").split("?")[0];
  return !fs.existsSync(path.join(RACINE, p));
});
ok("chaque chemin de CORE existe dans le dépôt", !manquants.length, manquants.join(", "));
const avecQuery = core.filter((u) => u.indexOf("?") > -1);
ok("aucune entrée de CORE ne porte de query",
  !avecQuery.length, avecQuery.join(", ") + " — la query se désynchronise des pages");

console.log("\n— une seule constante de version —");
const v = (sw.match(/const CACHE = "suite360-v(\d+)"/) || [, null])[1];
ok("le nom de cache porte un numéro", !!v, String(v));

console.log(ko ? "\n❌ " + ko + " vérification(s) en échec\n" : "\n✅ service worker : tout passe\n");
process.exit(ko ? 1 : 0);
