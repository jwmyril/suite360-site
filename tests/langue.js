/* ===========================================================================
   Suite 360 — banc : les fuites de langue, en ligne de commande

   POURQUOI CELUI-CI EN PLUS. `tests/langue-audit.js` se colle dans la console
   d'un navigateur : c'est excellent pour un contrôle final, mais ça ne peut
   pas tourner avant une mise en ligne, donc en pratique ça ne tourne pas. Il
   n'existait donc AUCUN garde-fou automatisable contre les fuites de langue —
   alors que le défaut est arrivé quatre fois.

   Deux contrôles statiques, qui attrapent la classe de défaut vécue :
     1. un élément qui porte du texte en dur dans le HTML et que la fonction
        de traduction n'atteint jamais restera dans sa langue d'origine ;
     2. les quatre dictionnaires doivent avoir exactement les mêmes clés.

   USAGE :  node tests/langue.js
   =========================================================================== */
const fs = require("fs");
const path = require("path");
const RACINE = path.join(__dirname, "..");
const PAGES = ["index.html", "entevyou.html", "karye.html", "candidats.html",
  "organisations.html", "egzanp.html", "kondisyon.html", "mesi.html"];

// Ids dont le texte n'a PAS à changer d'une langue à l'autre. En ajouter un
// est une décision, pas un oubli.
const INVARIANTS = /^(s360-lang|s360-theme|s360-by|sw-procode|sw-solde|sw-memo|ky-code|ad-|st-|pf-contact|pf-ville|cv-)/;

let ko = 0;
const ok = (nom, cond, detail) => {
  console.log((cond ? "  ✅ " : "  ❌ ") + nom + (cond ? "" : "   → " + detail));
  if (!cond) ko++;
};

console.log("\n— un texte en dur que la traduction n'atteint jamais —");
const orphelins = [];
for (const p of PAGES) {
  const s = fs.readFileSync(path.join(RACINE, p), "utf8");
  // Les ids que le SCRIPT cite. On ne regarde que les blocs <script> : en
  // scannant tout le fichier, chaque `id="x"` se citait lui-même et le
  // contrôle ne pouvait plus jamais échouer. Vérifié en injectant un défaut.
  const scripts = [...s.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
  const cites = new Set();
  for (const m of scripts.matchAll(/["'`]([A-Za-z][\w-]{1,40})["'`]/g)) cites.add(m[1]);
  // les éléments porteurs de texte : on ne juge que ceux qui ont un id
  for (const m of s.matchAll(/<(h1|h2|h3|h4|p|span|button|summary|li|label)\b[^>]*\bid="([^"]+)"[^>]*>([^<]{3,})</g)) {
    const [, , id, texte] = m;
    if (INVARIANTS.test(id)) continue;
    if (cites.has(id)) continue;
    if (!/[A-Za-zÀ-ÿ]{3}/.test(texte)) continue;          // pas de vrai mot
    orphelins.push(p + " → #" + id + " « " + texte.trim().slice(0, 34) + " »");
  }
}
ok("aucun texte en dur hors de portée de la traduction",
  !orphelins.length, orphelins.slice(0, 6).join(" | "));

console.log("\n— le lien d'évitement suit-il la langue ? —");
// Il n'a pas d'id, donc le contrôle précédent ne le voyait pas. Il est traduit
// par assets/theme.js, qui est chargé sur toutes les pages.
const tjs = fs.readFileSync(path.join(RACINE, "assets", "theme.js"), "utf8");
ok("les quatre langues du lien d'évitement sont déclarées",
  ["ht", "fr", "en", "es"].every((l) => new RegExp(l + ":[^}]*saut:").test(tjs)),
  "manque dans assets/theme.js");
ok("il est traduit même sur une page sans sélecteur de langue",
  tjs.indexOf("function poser() {\n    traduire();") > 0,
  "poser() sort tôt sur admin et estatistik : traduire() doit passer avant");

console.log("\n— les quatre dictionnaires ont-ils les mêmes clés ? —");
const ecarts = [];
for (const p of PAGES) {
  const s = fs.readFileSync(path.join(RACINE, p), "utf8");
  const dicos = {};
  for (const lg of ["ht", "fr", "en", "es"]) {
    const i = s.search(new RegExp("\n\s{2,6}" + lg + ": \{"));
    if (i < 0) continue;
    // jusqu'au début du dictionnaire suivant, ou la fin de l'objet L
    const suite = s.slice(i + 1);
    const fin = suite.search(/\n\s{2,6}(ht|fr|en|es): \{|\n\s{2}\};/);
    const corps = fin > 0 ? suite.slice(0, fin) : suite.slice(0, 20000);
    dicos[lg] = new Set([...corps.matchAll(/(?:^|[,{]\s*)([A-Za-z_][\w]*)\s*:/g)].map((m) => m[1]));
  }
  const langues = Object.keys(dicos);
  if (langues.length < 2) continue;
  const ref = dicos[langues[0]];
  for (const lg of langues.slice(1)) {
    const manque = [...ref].filter((k) => !dicos[lg].has(k));
    const enTrop = [...dicos[lg]].filter((k) => !ref.has(k));
    if (manque.length || enTrop.length) {
      ecarts.push(p + " (" + lg + ") : " + [...manque, ...enTrop].slice(0, 4).join(", "));
    }
  }
}
ok("aucune clé manquante ni en trop", !ecarts.length, ecarts.slice(0, 5).join(" | "));

console.log("\n— des mots anglais laissés dans le kreyòl ? —");
// Le kreyòl s'écrit comme il se prononce. Un mot resté en graphie anglaise au
// milieu d'une phrase kreyòl se lit deux fois : une pour buter dessus, une pour
// comprendre. Sur un produit dont l'argument est « nous vous parlons dans votre
// langue », c'est l'argument lui-même qui se défait.
//
// Cette liste s'allonge au fil des retours. Chaque entrée dit la forme à écrire :
// un banc qui signale sans proposer se contourne en supprimant la phrase.
const ANGLICISMES = [
  ["coach", "koach"],
  ["feedback", "dire ce qui est bon et ce qui est à corriger — pas de mot unique"],
  ["interview", "entèvyou"],
  ["meeting", "reyinyon"],
  ["training", "fòmasyon"],
  ["skills", "konpetans"],
];

function dicoHt(s) {
  const m = /\n\s{2,6}ht: \{/.exec(s);
  if (!m) return "";
  const suite = s.slice(m.index + m[0].length);
  const f = /\n\s{2,6}(fr|en|es): \{/.exec(suite);
  return f ? suite.slice(0, f.index) : suite;
}

const fautes = [];
for (const p of PAGES) {
  const corps = dicoHt(fs.readFileSync(path.join(RACINE, p), "utf8"));
  if (!corps) continue;
  for (const [mot, forme] of ANGLICISMES) {
    // le mot seul : ni « coachId », ni un identifiant qui le contient
    const n = (corps.match(new RegExp("(?<![A-Za-z0-9_-])" + mot + "(?![A-Za-z0-9_-])", "gi")) || []).length;
    if (n) fautes.push(p + " → « " + mot + " » ×" + n + " (écrire : " + forme + ")");
  }
}
ok("aucun anglicisme dans les dictionnaires kreyòl", !fautes.length, fautes.join(" | "));

console.log("\n— chaque page déclare un titre par langue —");
const sansTitre = PAGES.filter((p) => {
  const s = fs.readFileSync(path.join(RACINE, p), "utf8");
  return !/__title|document\.title\s*=/.test(s);
});
ok("le titre de l'onglet suit la langue", !sansTitre.length, sansTitre.join(", "));

console.log(ko ? "\n❌ " + ko + " vérification(s) en échec\n" : "\n✅ langue : aucune fuite détectée\n");
process.exit(ko ? 1 : 0);
