/* ===========================================================================
   Suite 360 — banc : Automatique / Clair / Sombre

   Un thème clair qui « a l'air bien » sur l'écran du développeur peut être
   illisible dehors, sur un téléphone, pour quelqu'un qui voit mal. On MESURE
   donc les contrastes des deux palettes (WCAG 2.1), au lieu de les supposer.

   On vérifie aussi les trois pièges qui rendent un thème cassé :
     • le script de tête doit précéder la feuille de style (sinon éclair blanc) ;
     • « auto » doit RETIRER data-theme, pas écrire une valeur ;
     • aucune couleur de texte ou de fond ne doit rester figée dans les pages,
       sinon elle ne bascule pas — sauf le papier (CV, .doc) et l'impression.

   USAGE :  node tests/theme.js
   =========================================================================== */
const fs = require("fs");
const path = require("path");
const RACINE = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(RACINE, "assets", "style.css"), "utf8");

let ko = 0;
const ok = (nom, cond, detail) => {
  console.log((cond ? "  ✅ " : "  ❌ ") + nom + (cond ? "" : "   → " + detail));
  if (!cond) ko++;
};

// ---------------------------------------------------------------- contraste
function lum(hex) {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c) : h.match(/../g);
  const [r, g, b] = v.map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
};

function bloc(entete) {
  const i = css.indexOf(entete);
  if (i < 0) throw new Error("bloc introuvable : " + entete);
  const j = css.indexOf("}", i);
  const out = {};
  css.slice(i, j).replace(/(--[\w-]+)\s*:\s*([^;]+);/g, (m, k, v) => { out[k] = v.trim(); return m; });
  return out;
}

const clair = bloc(":root {");
const sombre = bloc(':root[data-theme="dark"] {');

console.log("\n— contrastes mesurés, thème CLAIR —");
[["texte principal", "--ink", "--fond", 4.5],
 ["texte secondaire", "--ink-2", "--fond", 4.5],
 ["texte atténué", "--ink-dim", "--fond", 4.5],
 ["accent (liens, chiffres)", "--accent", "--fond", 4.5],
 ["lien", "--lien", "--fond", 4.5],
 ["danger", "--danger", "--fond", 4.5],
 ["attention", "--attention", "--fond", 4.5],
 ["danger doux", "--danger-doux", "--fond", 4.5],
 ["accent doux", "--accent-doux", "--fond", 4.5],
 ["lien doux", "--lien-doux", "--fond", 4.5],
 ["encre sur aplat d'accent", "--sur-accent", "--accent", 4.5],
].forEach(([nom, t, f, seuil]) => {
  const r = ratio(clair[t], clair[f]);
  ok(nom + " (" + r + ":1)", r >= seuil, "sous le seuil AA de " + seuil + ":1");
});

console.log("\n— contrastes mesurés, thème SOMBRE —");
[["texte principal", "--ink", "--fond", 4.5],
 ["texte secondaire", "--ink-2", "--fond", 4.5],
 ["texte atténué", "--ink-dim", "--fond", 4.5],
 ["accent", "--accent", "--fond", 4.5],
 ["lien", "--lien", "--fond", 4.5],
 ["danger", "--danger", "--fond", 4.5],
 ["attention", "--attention", "--fond", 4.5],
 ["danger doux", "--danger-doux", "--fond", 4.5],
 ["accent doux", "--accent-doux", "--fond", 4.5],
 ["lien doux", "--lien-doux", "--fond", 4.5],
 ["encre sur aplat d'accent", "--sur-accent", "--accent", 4.5],
].forEach(([nom, t, f, seuil]) => {
  const r = ratio(sombre[t], sombre[f]);
  ok(nom + " (" + r + ":1)", r >= seuil, "sous le seuil AA de " + seuil + ":1");
});

console.log("\n— les trois états —");
ok("le thème clair est la base (:root)", /:root \{[\s\S]*?color-scheme: light/.test(css), "");
ok("« auto » suit le système", /@media \(prefers-color-scheme: dark\)/.test(css), "");
ok("un choix « clair » explicite l'emporte sur le système",
  /:root:not\(\[data-theme="light"\]\)/.test(css), "le :not manque : la requête média écraserait le choix");
ok("un choix « sombre » explicite l'emporte", /:root\[data-theme="dark"\] \{/.test(css), "");
ok("les alias hérités renvoient aux rôles", /--navy: var\(--fond\)/.test(css), "");

// ---------------------------------------------------------------- theme.js
const tjs = fs.readFileSync(path.join(RACINE, "assets", "theme.js"), "utf8");
console.log("\n— le contrôle —");
ok("« auto » RETIRE l'attribut au lieu d'écrire une valeur",
  /choix === "auto"\) e\.removeAttribute\("data-theme"\)/.test(tjs), "");
ok("les quatre langues sont portées par le contrôle lui-même",
  ["ht:", "fr:", "en:", "es:"].every((l) => tjs.indexOf(l) > 0), "");
ok("il ne mesure ni n'envoie rien", !/fetch\(|sendBeacon|mesure\(/.test(tjs), "un thème choisi ne regarde pas Atmart");
ok("il traduit les <option> en place au lieu de les recréer",
  /options\[0\]\.text/.test(tjs) && !/select\.innerHTML\s*=/.test(tjs), "");
ok("la barre système suit le thème", /theme-color/.test(tjs), "");

// ---------------------------------------------------------------- les pages
const PAGES = ["index.html", "entevyou.html", "karye.html", "candidats.html",
  "organisations.html", "egzanp.html", "kondisyon.html", "mesi.html", "404.html", "admin.html"];
console.log("\n— les pages —");
// Exemptions ASSUMÉES — en ajouter une est une décision, pas un oubli :
//   #fff / #ffffff / #111 : le papier (aperçu du CV) et l'encre sur aplat plein ;
//   #128c4a               : le vert WhatsApp — une marque, pas une couleur de thème ;
//   #fff3cd / #2b1a06     : le surligneur d'egzanp.html — un surligneur reste
//                           jaune pâle à encre foncée dans les deux thèmes.
const EXEMPTS = /#fff\b|#ffffff\b|#111\b|#128c4a\b|#fff3cd\b|#2b1a06\b/i;
let sansTete = [], apresStyle = [], figees = [];
PAGES.forEach((p) => {
  const s = fs.readFileSync(path.join(RACINE, p), "utf8");
  const i = s.indexOf("atmart_apparence"), j = s.indexOf("assets/style.css");
  if (i < 0) sansTete.push(p);
  else if (j > 0 && i > j) apresStyle.push(p);

  // couleurs figées restantes, hors papier et hors impression
  let u = s;
  const doc = u.match(/var css = "body\{font-family:Calibri[\s\S]*?";/);
  if (doc) u = u.replace(doc[0], "");
  u = u.replace(/@media print\{[\s\S]{0,400}?\}\s*\}/g, "");
  const restes = (u.match(/(?<![-\w])(color|background|background-color)\s*:\s*#[0-9a-fA-F]{3,6}\b/g) || [])
    .filter((x) => !EXEMPTS.test(x));
  if (restes.length) figees.push(p + " → " + restes.slice(0, 3).join(", "));
});
ok("toutes les pages portent le script de tête", !sansTete.length, sansTete.join(", "));
ok("il précède toujours la feuille de style", !apresStyle.length, apresStyle.join(", "));
ok("aucune couleur figée ne subsiste (hors papier et impression)", !figees.length, figees.join(" | "));

console.log(ko ? "\n❌ " + ko + " vérification(s) en échec\n" : "\n✅ thème : tout passe\n");
process.exit(ko ? 1 : 0);
