/* ===========================================================================
   Suite 360 — banc : les fondations d'accessibilité

   Ce n'est pas un confort : un community college public l'exige souvent par
   contrat (Section 508 / WCAG 2.1 AA). Et ce sont des défauts qu'on ne voit
   jamais en se relisant — seulement au lecteur d'écran.

   Quatre règles, celles que l'audit a trouvées enfreintes :
     • tout contrôle porte une étiquette (<label for>, aria-label ou -labelledby) ;
     • chaque page a un <main> et un lien d'évitement au clavier ;
     • un role="tablist" sans role="tab" est annoncé de travers — donc pire
       que pas de rôle du tout ;
     • une zone de statut qui change toute seule doit être annoncée (aria-live),
       sinon les erreurs sont muettes.

   USAGE :  node tests/acces.js
   =========================================================================== */
const fs = require("fs");
const path = require("path");
const RACINE = path.join(__dirname, "..");
const PAGES = fs.readdirSync(RACINE).filter((f) => f.endsWith(".html"));

let ko = 0;
const ok = (nom, cond, detail) => {
  console.log((cond ? "  ✅ " : "  ❌ ") + nom + (cond ? "" : "   → " + detail));
  if (!cond) ko++;
};

console.log("\n— les contrôles portent-ils une étiquette ? —");
const nus = [];
for (const p of PAGES) {
  const s = fs.readFileSync(path.join(RACINE, p), "utf8");
  const labels = new Set([...s.matchAll(/<label[^>]*\sfor="([^"]+)"/g)].map((m) => m[1]));
  for (const m of s.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const att = m[2];
    if (/type="(hidden|submit|button)"/.test(att)) continue;
    if (/aria-label(ledby)?=/.test(att)) continue;
    const id = (att.match(/\bid="([^"]+)"/) || [, null])[1];
    if (id && labels.has(id)) continue;
    nus.push(p + " → " + (id || "(sans id)"));
  }
}
ok("aucun contrôle sans étiquette", !nus.length, nus.slice(0, 8).join(", "));

console.log("\n— la structure de page —");
const sansMain = PAGES.filter((p) => !fs.readFileSync(path.join(RACINE, p), "utf8").includes("<main"));
const sansSaut = PAGES.filter((p) => !fs.readFileSync(path.join(RACINE, p), "utf8").includes('class="saut"'));
ok("chaque page a un <main>", !sansMain.length, sansMain.join(", "));
ok("chaque page a un lien d'évitement", !sansSaut.length, sansSaut.join(", "));
ok("la cible du lien d'évitement est focalisable",
  PAGES.every((p) => {
    const s = fs.readFileSync(path.join(RACINE, p), "utf8");
    return !s.includes('href="#contenu"') || /id="contenu"[^>]*tabindex="-1"/.test(s);
  }), "un <main id=contenu> sans tabindex ne reçoit pas le focus");

console.log("\n— les rôles ARIA ne mentent pas —");
const tablistNus = PAGES.filter((p) => {
  const s = fs.readFileSync(path.join(RACINE, p), "utf8");
  return s.includes('role="tablist"') && !s.includes('role="tab"');
});
ok("aucun role=tablist sans role=tab", !tablistNus.length, tablistNus.join(", "));

console.log("\n— les statuts qui changent seuls sont annoncés —");
const kar = fs.readFileSync(path.join(RACINE, "karye.html"), "utf8");
const statuts = [...kar.matchAll(/<p class="ky-status"[^>]*>/g)].map((m) => m[0]);
ok("les zones de statut de Career360 ont aria-live",
  statuts.length > 0 && statuts.every((t) => t.includes("aria-live")),
  statuts.filter((t) => !t.includes("aria-live")).join(" "));

console.log(ko ? "\n❌ " + ko + " vérification(s) en échec\n" : "\n✅ accessibilité : les fondations sont là\n");
process.exit(ko ? 1 : 0);
