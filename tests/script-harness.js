/* ===========================================================================
   Suite 360 — banc d'essai du script d'une page
   ---------------------------------------------------------------------------
   POURQUOI : sur entevyou.html, une erreur d'exécution n'importe où dans le
   script fait que TOUT ce qui suit ne s'attache jamais — sans rien afficher
   en console. La page semble simplement « ne plus répondre », et elle reste
   dans une seule langue. C'est arrivé quatre fois le 11/08/2026.

   Deux pièges de vérification à connaître :
     • `node --check` sur un bloc extrait par regex non gourmande NE SUFFIT PAS :
       la chaîne "</script>" existe à l'intérieur du JS (fonction dlDoc), donc
       la regex tronque le script et valide un fragment. Ce banc prend le bloc
       le PLUS LONG, en sautant les faux "</script>".
     • une syntaxe valide ne garantit rien : l'erreur est à l'exécution.

   USAGE :
     node tests/script-harness.js entevyou.html
   =========================================================================== */

const fs = require("fs");
const cible = process.argv[2] || "entevyou.html";
const html = fs.readFileSync(cible, "utf8");

// --- 1) extraire le bloc <script> le plus long, faux "</script>" compris ----
let best = { len: 0, code: "" };
let p = 0;
while (true) {
  const i = html.indexOf("<script>", p);
  if (i < 0) break;
  // Le script suivant peut porter des attributs (<script defer src=...>) :
  // chercher "<script>" en laissait passer un et le bloc debordait dans le HTML.
  const suivant = html.indexOf("<script", i + 8);
  let fin = html.indexOf("</script>", i);
  let k = fin;
  while (true) {
    const n = html.indexOf("</script>", k + 9);
    if (n < 0 || (suivant > 0 && n > suivant)) break;
    fin = n; k = n;
  }
  const code = html.slice(i + 8, fin);
  if (code.length > best.len) best = { len: code.length, code };
  p = i + 8;
}
console.log("Bloc analysé : " + best.len + " caractères");

// --- 2) syntaxe --------------------------------------------------------------
try { new Function(best.code); console.log("✅ Syntaxe valide"); }
catch (e) { console.log("❌ SYNTAXE : " + e.message); process.exit(1); }

// --- 3) exécution dans un DOM minimal ---------------------------------------
// getElementById ne renvoie un objet QUE pour les id réellement présents dans
// le HTML : un id absent provoque la même erreur que dans le navigateur, et on
// sait immédiatement lequel.
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
let dernierId = null;
const faux = () => ({
  style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  setAttribute() {}, removeAttribute() {}, getAttribute: () => null, addEventListener() {},
  appendChild() {}, removeChild() {}, insertBefore() {}, remove() {}, focus() {}, click() {},
  scrollIntoView() {}, dispatchEvent() {}, closest: () => null,
  options: Array.from({ length: 12 }, () => ({ text: "" })),
  children: [], firstElementChild: { style: {} },
  value: "", textContent: "", innerHTML: "", placeholder: "",
  checked: false, disabled: false, open: false, parentNode: { insertBefore() {} },
});
global.window = { addEventListener() {}, matchMedia: () => ({ matches: false }), console };
global.document = {
  getElementById(id) { dernierId = id; return ids.has(id) ? faux() : null; },
  querySelector: () => faux(), querySelectorAll: () => [], addEventListener() {},
  documentElement: { lang: "fr", setAttribute() {}, outerHTML: "" },
  body: { classList: { toggle() {}, add() {}, remove() {} }, appendChild() {}, removeChild() {} },
  createElement: () => faux(),
};
global.navigator = { language: "fr", languages: ["fr"], userAgent: "node" };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.sessionStorage = global.localStorage;
global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
global.MutationObserver = class { observe() {} };
global.speechSynthesis = { getVoices: () => [], cancel() {}, addEventListener() {}, speak() {} };
global.SpeechSynthesisUtterance = class {};

try {
  new Function(best.code)();
  console.log("✅ Le script s'exécute jusqu'au bout — tous les gestionnaires s'attachent.");
} catch (e) {
  console.log("❌ ERREUR D'EXÉCUTION : " + e.message);
  console.log("   dernier getElementById demandé : " + dernierId);
  console.log("   (si cet id n'existe pas dans le HTML, c'est la cause)");
  process.exit(1);
}
