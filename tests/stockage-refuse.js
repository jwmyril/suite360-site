/* ===========================================================================
   Suite 360 — banc : le stockage peut REFUSER

   Safari en navigation privée, « bloquer toutes les données de site », une
   WebView iOS restreinte : `localStorage` ne renvoie pas null, il LÈVE. Un
   seul accès non protégé et tout ce qui suit dans le script ne s'attache
   jamais — envoi, micro, TTS, téléchargement.

   Le piège : la page s'affiche parfaitement, traduite et normale. L'utilisateur
   voit un produit complet dont aucun bouton ne répond, et n'a aucun message.
   C'est ce qui arrivait à Career360 : deux accès nus sur plus de vingt.

   USAGE :  node tests/stockage-refuse.js
   =========================================================================== */
const fs = require("fs");
const path = require("path");
const RACINE = path.join(__dirname, "..");
const PAGES = ["karye.html", "entevyou.html", "index.html", "candidats.html", "admin.html"];

let ko = 0;
const ok = (nom, cond, detail) => {
  console.log((cond ? "  ✅ " : "  ❌ ") + nom + (cond ? "" : "   → " + detail));
  if (!cond) ko++;
};

function blocPrincipal(html) {
  let best = { len: 0, code: "" }, p = 0;
  while (true) {
    const i = html.indexOf("<script>", p);
    if (i < 0) break;
    const suivant = html.indexOf("<script", i + 8);
    let fin = html.indexOf("</script>", i), k = fin;
    while (true) {
      const n = html.indexOf("</script>", k + 9);
      if (n < 0 || (suivant > 0 && n > suivant)) break;
      fin = n; k = n;
    }
    const code = html.slice(i + 8, fin);
    if (code.length > best.len) best = { len: code.length, code };
    p = i + 8;
  }
  return best.code;
}

function faux() {
  return {
    style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {}, removeAttribute() {}, getAttribute: () => null, addEventListener() {},
    appendChild() {}, removeChild() {}, insertBefore() {}, remove() {}, focus() {}, click() {},
    scrollIntoView() {}, dispatchEvent() {}, closest: () => null,
    options: Array.from({ length: 12 }, () => ({ text: "" })),
    children: [], firstElementChild: { style: {} }, parentNode: { insertBefore() {} },
    value: "", textContent: "", innerHTML: "", placeholder: "", className: "",
    checked: false, disabled: false, open: false, href: "", download: "",
  };
}

console.log("\n— chaque page, avec un stockage qui lève à chaque appel —");
for (const p of PAGES) {
  const html = fs.readFileSync(path.join(RACINE, p), "utf8");
  const code = blocPrincipal(html);
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  global.window = { addEventListener() {}, matchMedia: () => ({ matches: false }), console };
  global.document = {
    getElementById: (id) => (ids.has(id) ? faux() : null),
    querySelector: () => faux(), querySelectorAll: () => [], addEventListener() {},
    documentElement: { lang: "fr", setAttribute() {}, outerHTML: "" },
    body: { classList: { toggle() {}, add() {}, remove() {} }, appendChild() {}, removeChild() {} },
    createElement: () => faux(),
  };
  global.navigator = { language: "fr", languages: ["fr"], userAgent: "node", sendBeacon: () => true };
  const leve = () => { throw new Error("SecurityError: accès au stockage refusé"); };
  global.localStorage = { get length() { leve(); }, key: leve, getItem: leve, setItem: leve, removeItem: leve };
  global.sessionStorage = global.localStorage;
  global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  global.MutationObserver = class { observe() {} };
  global.speechSynthesis = { getVoices: () => [], cancel() {}, addEventListener() {}, speak() {} };
  global.SpeechSynthesisUtterance = class {};
  global.Blob = class {}; global.URL = { createObjectURL: () => "", revokeObjectURL() {} };
  // ATM vient d'assets/atm360.js, charge avant le bloc de page : on le fournit,
  // sinon on mesurerait l'absence d'un script au lieu du refus du stockage.
  global.ATM = { page() {}, track() {}, lang: () => "fr", t: (x) => x };
  let erreur = null;
  try { new Function(code)(); } catch (e) { erreur = e.message; }
  ok(p + " s'exécute jusqu'au bout", !erreur, erreur || "");
}

console.log(ko ? "\n❌ " + ko + " page(s) meurent quand le stockage refuse\n"
                : "\n✅ aucune page ne meurt quand le stockage refuse\n");
process.exit(ko ? 1 : 0);
