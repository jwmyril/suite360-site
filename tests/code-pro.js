/* ===========================================================================
   Suite 360 — banc : le code Pro et son statut

   POURQUOI CE BANC. Quelqu'un paie 9,99 $, tape son code de travers une fois,
   et la faute devient permanente : le code était enregistré sur le seul FORMAT,
   sans jamais demander au serveur s'il était valide. Le refus, lui, s'affichait
   à 1,93:1 en thème clair — donc invisible. Les deux défauts se composaient en
   un client bloqué qui ne comprend pas pourquoi.

   On vérifie ici la règle : SEUL le serveur décide si un code est mémorisé.

   USAGE :  node tests/code-pro.js entevyou.html
   =========================================================================== */
const fs = require("fs");
const cible = process.argv[2] || "entevyou.html";
const html = fs.readFileSync(cible, "utf8");

let best = { len: 0, code: "" };
let p = 0;
while (true) {
  const i = html.indexOf("<script>", p);
  if (i < 0) break;
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
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));

const disque = {};
let elements, reponse = { ok: false, body: { error: "pro_invalid" } };

function neuf(id) {
  const el = {
    id, _h: {}, style: {}, value: "", textContent: "", innerHTML: "", className: "",
    placeholder: "", checked: false, disabled: false, open: false, children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    options: Array.from({ length: 12 }, () => ({ text: "" })),
    firstElementChild: { style: {} }, parentNode: { insertBefore() {} },
    setAttribute() {}, removeAttribute() {}, getAttribute: () => null,
    appendChild() {}, removeChild() {}, insertBefore() {}, remove() {},
    focus() {}, scrollIntoView() {}, dispatchEvent() {}, closest: () => null,
    addEventListener(t, f) { (el._h[t] = el._h[t] || []).push(f); },
    click() { (el._h.click || []).forEach((f) => f.call(el, { target: el, preventDefault() {} })); },
    declencher(t) { (el._h[t] || []).forEach((f) => f.call(el, {})); },
  };
  return el;
}

function charger() {
  elements = {};
  global.window = { addEventListener() {}, matchMedia: () => ({ matches: false }), console };
  global.document = {
    getElementById(id) { return ids.has(id) ? (elements[id] = elements[id] || neuf(id)) : null; },
    querySelector: () => neuf("?"), querySelectorAll: () => [], addEventListener() {},
    documentElement: { lang: "fr", setAttribute() {}, outerHTML: "" },
    body: { classList: { toggle() {}, add() {}, remove() {} }, appendChild() {}, removeChild() {} },
    createElement: () => neuf("?"),
  };
  global.navigator = { language: "fr", languages: ["fr"], userAgent: "node", sendBeacon: () => true };
  global.localStorage = {
    getItem: (k) => (k in disque ? disque[k] : null),
    setItem: (k, v) => { disque[k] = String(v); },
    removeItem: (k) => { delete disque[k]; },
  };
  global.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  global.fetch = () => Promise.resolve({
    ok: reponse.ok,
    json: () => Promise.resolve(reponse.body),
  });
  global.MutationObserver = class { observe() {} };
  global.speechSynthesis = { getVoices: () => [], cancel() {}, addEventListener() {}, speak() {} };
  global.SpeechSynthesisUtterance = class {};
  global.URLSearchParams = class { constructor() {} get() { return null; } };
  new Function(best.code)();
}

const $ = (id) => document.getElementById(id);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let ko = 0;
const ok = (nom, cond, detail) => {
  console.log((cond ? "  ✅ " : "  ❌ ") + nom + (cond ? "" : "   → " + detail));
  if (!cond) ko++;
};

(async function () {
  console.log("\n— un code que le serveur REFUSE —");
  reponse = { ok: false, body: { error: "pro_invalid" } };
  charger();
  $("sw-procode").value = "PRO90-AAAA-BBBB";
  $("sw-procode").declencher("blur");
  await pause(60);
  ok("il n'est PAS enregistré sur l'appareil", disque["entevyou_pro"] === undefined,
    "enregistré : " + disque["entevyou_pro"]);
  ok("le refus est affiché", ($("sw-solde").textContent || "").length > 3, $("sw-solde").textContent);
  ok("il est peint par une classe, pas par un hexadécimal en ligne",
    $("sw-solde").className === "solde-ko" && !$("sw-solde").style.color,
    "classe=" + $("sw-solde").className + " couleur=" + $("sw-solde").style.color);

  console.log("\n— un code que le serveur ACCEPTE —");
  reponse = { ok: true, body: { type: "pro90", exp: "2026-11-11", restantJour: 8, expire: false } };
  charger();
  $("sw-procode").value = "PRO90-N3VD-TFCS";
  $("sw-procode").declencher("blur");
  await pause(60);
  ok("il est enregistré", disque["entevyou_pro"] === "PRO90-N3VD-TFCS", String(disque["entevyou_pro"]));
  ok("le solde est affiché en couleur d'accord", $("sw-solde").className === "solde-ok", $("sw-solde").className);

  console.log("\n— un code valide devenu invalide (révoqué, expiré) —");
  reponse = { ok: false, body: { error: "pro_invalid" } };
  charger();
  $("sw-procode").value = "PRO90-N3VD-TFCS";
  $("sw-procode").declencher("blur");
  await pause(60);
  ok("il est OUBLIÉ, pas re-rempli à vie", disque["entevyou_pro"] === undefined,
    "reste : " + disque["entevyou_pro"]);

  console.log("\n— plus aucune couleur en dur posée sur le DOM —");
  const enDur = (best.code.match(/style\.color\s*=\s*"#/g) || []).length;
  ok("zéro `style.color = \"#...\"` dans le script", enDur === 0, enDur + " occurrence(s)");

  console.log(ko ? "\n❌ " + ko + " vérification(s) en échec\n" : "\n✅ code Pro : tout passe\n");
  process.exit(ko ? 1 : 0);
})();
