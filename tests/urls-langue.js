/* ===========================================================================
   Suite 360 — banc : les adresses par langue

   24 fichiers générés, c'est 24 occasions de dériver. Ce banc vérifie qu'ils
   sont EXACTEMENT ce que le générateur produirait aujourd'hui, et que les
   signaux envoyés aux moteurs sont cohérents.

   Un groupe hreflang incomplet ou qui ne se déclare pas lui-même est ignoré
   en entier par Google : mieux vaut aucun signal qu'un signal à moitié.

   USAGE :  node tests/urls-langue.js
   =========================================================================== */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const RACINE = path.join(__dirname, "..");
const BASE = "https://360.atmart.ltd";
const LANGUES = ["ht", "fr", "en", "es"];
const PAGES = ["index", "entevyou", "karye", "candidats", "organisations", "egzanp"];

let ko = 0;
const ok = (nom, cond, detail) => {
  console.log((cond ? "  ✅ " : "  ❌ ") + nom + (cond ? "" : "   → " + detail));
  if (!cond) ko++;
};

console.log("\n— les 24 variantes existent —");
const absentes = [];
for (const p of PAGES) for (const l of LANGUES) {
  if (!fs.existsSync(path.join(RACINE, `${p}.${l}.html`))) absentes.push(`${p}.${l}.html`);
}
ok("aucune variante manquante", !absentes.length, absentes.join(", "));

console.log("\n— chacune déclare sa langue et s'y tient —");
const pbLangue = [], pbCanon = [], pbGroupe = [], pbTitre = [];
for (const p of PAGES) for (const l of LANGUES) {
  const f = `${p}.${l}.html`;
  const s = fs.readFileSync(path.join(RACINE, f), "utf8");
  if (!new RegExp(`<html lang="${l}" data-lang-fixe`).test(s)) pbLangue.push(f);
  if (!s.includes(`<link rel="canonical" href="${BASE}/${p}.${l}.html" />`)) pbCanon.push(f);
  // le groupe doit être complet ET se contenir lui-même
  const manque = LANGUES.filter((g) => !s.includes(`hreflang="${g}" href="${BASE}/${p}.${g}.html"`));
  if (manque.length || !s.includes('hreflang="x-default"')) pbGroupe.push(f + " (" + manque.join(",") + ")");
  const t = (s.match(/<title>([^<]*)<\/title>/) || [, ""])[1];
  if (!t || t.length < 10) pbTitre.push(f);
}
ok("l'attribut data-lang-fixe coupe la détection automatique", !pbLangue.length, pbLangue.join(", "));
ok("chaque variante est canonique d'elle-même", !pbCanon.length, pbCanon.join(", "));
ok("chaque groupe hreflang est complet et se contient", !pbGroupe.length, pbGroupe.slice(0, 4).join(" | "));
ok("chaque variante a un titre", !pbTitre.length, pbTitre.join(", "));

console.log("\n— deux langues ne partagent jamais le même titre —");
const doublons = [];
for (const p of PAGES) {
  const vus = {};
  for (const l of LANGUES) {
    const s = fs.readFileSync(path.join(RACINE, `${p}.${l}.html`), "utf8");
    const t = (s.match(/<title>([^<]*)<\/title>/) || [, ""])[1];
    if (vus[t]) doublons.push(`${p}: ${vus[t]} et ${l}`);
    vus[t] = l;
  }
}
ok("chaque langue a son propre titre", !doublons.length, doublons.join(", "));

console.log("\n— les variantes sont-elles à jour ? —");
// On régénère dans un dossier temporaire et on compare octet à octet.
const avant = {};
for (const p of PAGES) for (const l of LANGUES) {
  avant[`${p}.${l}.html`] = fs.readFileSync(path.join(RACINE, `${p}.${l}.html`), "utf8");
}
execFileSync("python", [path.join(RACINE, "tools", "gen-langues.py")], { cwd: RACINE, stdio: "ignore" });
const derive = Object.keys(avant).filter(
  (f) => fs.readFileSync(path.join(RACINE, f), "utf8") !== avant[f]);
ok("aucune variante n'a dérivé de sa source", !derive.length,
  derive.join(", ") + " — relancer tools/gen-langues.py et committer");

console.log("\n— le sitemap —");
const sm = fs.readFileSync(path.join(RACINE, "sitemap.xml"), "utf8");
const absentesSm = [];
for (const p of PAGES) for (const l of LANGUES) {
  if (!sm.includes(`${BASE}/${p}.${l}.html</loc>`)) absentesSm.push(`${p}.${l}`);
}
ok("le sitemap liste les 24 variantes", !absentesSm.length, absentesSm.join(", "));
ok("le sitemap porte les alternates", sm.includes("xhtml:link") && sm.includes("x-default"), "");

console.log(ko ? "\n❌ " + ko + " vérification(s) en échec\n" : "\n✅ adresses par langue : tout passe\n");
process.exit(ko ? 1 : 0);
