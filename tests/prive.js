/* ===========================================================================
   Suite 360 — banc : ce qui ne doit JAMAIS être servi publiquement

   POURQUOI. Le 31/08/2026, `https://360.atmart.ltd/docs/SUIVI_CORRECTIONS.md`
   répondait **HTTP 200, 41 Ko** : la liste complète des faiblesses connues du
   produit, lisible par n'importe qui. Elle avait été poussée avec le site les
   28 et 29 août — personne ne s'était demandé si `docs/` serait servi.
   La revue de sécurité, elle, porte en tête « Ne pas diffuser ».

   Le défaut n'était pas dans le contenu : il était dans le fait qu'un dossier
   du dépôt EST une adresse du site. Un fichier interne posé à côté du code
   devient public au prochain `git push`, sans que rien ne le signale.

   Ce banc interroge la PRODUCTION. Il a donc besoin du réseau ; sans réseau il
   le dit et ne prétend pas avoir vérifié.

   USAGE :  node tests/prive.js
   =========================================================================== */

const https = require("https");

const PRIVES = [
  ["/docs/SUIVI_CORRECTIONS.md", "le registre des faiblesses connues"],
  ["/tools/gen-langues.py", "les scripts de fabrication"],
  ["/tools/etat_registre.py", "les scripts de fabrication"],
  // Un banc de CE dépôt : `securite.js` vit dans Atmart_chat_worker, son 404
  // ne prouvait donc rien sur l'exclusion de `tests/` ici.
  ["/tests/theme.js", "les bancs, qui décrivent les défauts corrigés"],
  ["/tests/syntaxe.js", "les bancs"],
  ["/_config.yml", "la configuration de publication"],
];

// Deux pages publiques : si elles répondaient 404, l'exclusion aurait mordu
// trop large et on aurait dépublié le site en croyant le protéger.
const PUBLIQUES = [["/index.html", 200], ["/entevyou.html", 200], ["/sitemap.xml", 200]];

function statut(chemin) {
  return new Promise((res) => {
    const req = https.get({ host: "360.atmart.ltd", path: chemin + "?v=" + Date.now(), timeout: 20000 },
      (r) => { r.resume(); res(r.statusCode); });
    req.on("timeout", () => { req.destroy(); res(0); });
    req.on("error", () => res(0));
  });
}

(async () => {
  let ko = 0, reseau = true;
  const ok = (nom, cond, detail) => {
    console.log((cond ? "  ✅ " : "  ❌ ") + nom + (cond ? "" : "   → " + detail));
    if (!cond) ko++;
  };

  console.log("\n— ce qui doit rester privé —");
  for (const [chemin, quoi] of PRIVES) {
    const s = await statut(chemin);
    if (s === 0) { reseau = false; console.log("  ⏭  " + chemin + " — pas de réseau"); continue; }
    ok(chemin, s === 404, "HTTP " + s + " — " + quoi + " est PUBLIC");
  }

  console.log("\n— et le site, lui, doit rester servi —");
  for (const [chemin, attendu] of PUBLIQUES) {
    const s = await statut(chemin);
    if (s === 0) { reseau = false; console.log("  ⏭  " + chemin + " — pas de réseau"); continue; }
    ok(chemin, s === attendu, "HTTP " + s + " au lieu de " + attendu
      + " — l'exclusion a mordu trop large");
  }

  if (!reseau) {
    console.log("\n⚠️  Réseau indisponible : ce banc n'a rien pu vérifier. "
      + "Ne pas le compter comme réussi.\n");
    process.exit(2);
  }
  console.log(ko ? "\n❌ " + ko + " vérification(s) en échec\n"
    : "\n✅ rien de privé n'est servi, et le site l'est\n");
  process.exit(ko ? 1 : 0);
})();
