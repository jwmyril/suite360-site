/* ===========================================================================
   Suite 360 — banc : TOUS les scripts de TOUTES les pages compilent

   POURQUOI CELUI-CI EN PLUS DE `script-harness.js`. Ce dernier prend le bloc
   `<script>` **le plus long** d'**une seule** page. C'est ce qu'il fallait pour
   entevyou.html, dont le script fait 200 Ko. Mais ça laisse dehors :
     · toutes les autres pages ;
     · tous les petits blocs, dont le script de tête qui applique la langue.

   Le 31/08/2026, `karye.html` portait une erreur de syntaxe dans ce petit bloc
   — une liste `var` fermée par une virgule ouverte, suivie d'un commentaire
   puis d'un `if`. Le script entier ne se parsait pas, donc la langue mémorisée
   n'était jamais appliquée : un anglophone arrivant depuis l'accueil anglais
   atterrissait sur une page française. **En production, sans aucun symptôme
   visible** — et la console était déjà noyée par une erreur permanente de CSP.

   DEUXIÈME CONTRÔLE : le `+ +`. `'texte' + + '<h2>…'` applique le PLUS UNAIRE à
   une chaîne, ce qui donne `NaN`. La syntaxe est valide, donc aucun compilateur
   ne s'en plaint — mais `kondisyon.html` affichait « NaN » à la place de la
   section Remboursements, dans les quatre langues, sur la page légale.

   USAGE :  node tests/syntaxe.js
   =========================================================================== */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RACINE = path.join(__dirname, "..");

let ko = 0;
const ok = (nom, cond, detail) => {
  console.log((cond ? "  ✅ " : "  ❌ ") + nom + (cond ? "" : "   → " + detail));
  if (!cond) ko++;
};

// Le jeton Google est une ligne de texte brut, pas une page.
const IGNORE = /^google[0-9a-f]+\.html$/;
const pages = fs.readdirSync(RACINE)
  .filter((f) => f.endsWith(".html") && !IGNORE.test(f));

/* Extraction : on s'arrête au PREMIER `</script>`, comme un navigateur.
   C'est la règle du HTML, sans exception — un `</script>` littéral à
   l'intérieur d'une chaîne JavaScript ferme quand même l'élément. Un fichier
   qui en contiendrait un serait cassé, pas mal analysé.

   `script-harness.js` porte une parade qui étend la fin tant que le
   `</script>` suivant précède le prochain `<script`. Elle a été écrite pour
   entevyou.html et **elle est fausse** : appliquée aux variantes par langue,
   où gen-langues.py injecte un script de plus, elle fusionne deux blocs et
   invente une erreur de syntaxe. Vérifié : les balises sont équilibrées
   (6 ouvertures / 6 fermetures dans la source, 7/7 dans les variantes), donc
   la règle simple est la bonne. */
function blocs(html) {
  const out = [];
  let p = 0;
  while (true) {
    const i = html.indexOf("<script", p);
    if (i < 0) break;
    const finBalise = html.indexOf(">", i);
    if (finBalise < 0) break;
    const attrs = html.slice(i, finBalise);
    p = finBalise + 1;
    const fin = html.indexOf("</script>", p);
    if (fin < 0) break;
    // Un script EXTERNE n'a rien à compiler ici. Et un `type` qui n'est pas du
    // JavaScript — `application/ld+json` porte les données structurées — n'est
    // pas exécuté par le navigateur non plus : le compiler inventerait une
    // erreur de syntaxe sur du JSON parfaitement valide.
    const type = (/\btype=["']?([^"'\s>]+)/.exec(attrs) || [, ""])[1].toLowerCase();
    const estJs = !type || /^(text\/javascript|application\/javascript|module)$/.test(type);
    if (!/\bsrc=/.test(attrs) && estJs) {
      out.push({ debut: html.slice(0, p).split("\n").length, code: html.slice(p, fin) });
    }
    p = fin + 9;
  }
  return out;
}

console.log("\n— chaque script en ligne compile-t-il ? —");
const casses = [];
let total = 0;
for (const f of pages) {
  const html = fs.readFileSync(path.join(RACINE, f), "utf8");
  for (const b of blocs(html)) {
    if (!b.code.trim()) continue;
    total += 1;
    try {
      // compile sans exécuter : on cherche une SyntaxError, pas un effet.
      new vm.Script(b.code, { filename: f });
    } catch (e) {
      casses.push(f + " ligne ~" + b.debut + " : " + e.message.slice(0, 70));
    }
  }
}
ok(total + " bloc(s) analysé(s) sur " + pages.length + " page(s)",
  !casses.length, casses.slice(0, 4).join(" | "));

console.log("\n— le plus unaire appliqué à une chaîne (produit « NaN ») —");
// `'a' + + 'b'` est syntaxiquement valide et donne "aNaN". Aucun compilateur ne
// le signale ; seul l'affichage le révèle, et personne ne relit une page légale.
const nan = [];
for (const f of pages) {
  const html = fs.readFileSync(path.join(RACINE, f), "utf8");
  for (const b of blocs(html)) {
    const m = b.code.match(/\+\s+\+\s*['"`]/g);
    if (m) nan.push(f + " × " + m.length);
  }
}
ok("aucune concaténation « + + » avant une chaîne", !nan.length,
  nan.join(", ") + " — produit le mot NaN dans la page");

console.log(ko ? "\n❌ " + ko + " vérification(s) en échec\n"
  : "\n✅ syntaxe : tous les scripts de toutes les pages compilent\n");
process.exit(ko ? 1 : 0);
