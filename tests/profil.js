/* ===========================================================================
   Suite 360 — banc : le dossier « Profil professionnel »

   Ce dossier est ce que la personne emporte. On vérifie donc trois choses que
   personne ne verra si elles cassent :
     • il refuse de se produire quand il n'y a rien dedans (un profil vide
       envoyé à un employeur est pire que pas de profil) ;
     • il contient l'avertissement anti-prédiction, dans la langue affichée ;
     • les niveaux affichés viennent bien d'un calcul, et pas d'un texte.

   Le document n'est jamais écrit sur disque : on intercepte le Blob.

   USAGE :
     node tests/profil.js entevyou.html
   =========================================================================== */

const fs = require("fs");
const cible = process.argv[2] || "entevyou.html";
const html = fs.readFileSync(cible, "utf8");

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
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));

let elements, doc = "";

function neuf(id) {
  const el = {
    id, _h: {}, style: {}, value: "", textContent: "", innerHTML: "", placeholder: "",
    checked: false, disabled: false, open: false, children: [], href: "", download: "",
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    options: Array.from({ length: 12 }, () => ({ text: "" })),
    firstElementChild: { style: {} }, parentNode: { insertBefore() {} },
    setAttribute() {}, removeAttribute() {}, getAttribute: () => null,
    appendChild() {}, removeChild() {}, insertBefore() {}, remove() {},
    focus() {}, scrollIntoView() {}, dispatchEvent() {}, closest: () => null,
    addEventListener(t, f) { (el._h[t] = el._h[t] || []).push(f); },
    click() { (el._h.click || []).forEach((f) => f.call(el, { target: el, preventDefault() {} })); },
    saisir(v) { el.value = v; (el._h.input || []).forEach((f) => f.call(el, {})); },
  };
  return el;
}

let nQ = 0;
function reponse(corps) {
  if (corps.action === "panel") { nQ++; return { question: "Question " + nQ + " ?" }; }
  if (corps.action === "panelrep") return {
    retour: "Un retour.", relance: null,
    notes: { pertinence: 3, preuve: 3, resultat: 1, structure: 2, concision: 2, oral: 3, adaptation: 1 },
  };
  return {};
}

function charger(lang) {
  elements = {}; doc = "";
  global.window = { addEventListener() {}, matchMedia: () => ({ matches: false }), console };
  global.document = {
    getElementById(id) { return ids.has(id) ? (elements[id] = elements[id] || neuf(id)) : null; },
    querySelector: () => neuf("?"), querySelectorAll: () => [], addEventListener() {},
    documentElement: { lang, setAttribute() {}, outerHTML: "" },
    body: { classList: { toggle() {}, add() {}, remove() {} }, appendChild() {}, removeChild() {} },
    createElement: () => neuf("a"),
  };
  global.navigator = { language: lang, languages: [lang], userAgent: "node", sendBeacon() { return true; } };
  global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  global.sessionStorage = global.localStorage;
  global.fetch = (u, o) => {
    let c = {};
    try { c = JSON.parse((o && o.body) || "{}"); } catch (e) {}
    return Promise.resolve({ ok: true, json: () => Promise.resolve(reponse(c)) });
  };
  global.MutationObserver = class { observe() {} };
  global.speechSynthesis = { getVoices: () => [], cancel() {}, addEventListener() {}, speak() {} };
  global.SpeechSynthesisUtterance = class {};
  // on intercepte le document produit au lieu de l'écrire
  global.Blob = class { constructor(parts) { doc = (parts || []).join(""); } };
  global.URL = { createObjectURL: () => "blob:test", revokeObjectURL() {} };
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
  // --------------------------------------------------- 1) profil vide
  console.log("\n— rien n'a encore été produit —");
  charger("fr");
  $("sw-prof").click();
  ok("aucun document n'est produit", doc === "", doc.slice(0, 80));
  ok("la personne est prévenue", /rien produit/.test($("sw-status").textContent), $("sw-status").textContent);

  // --------------------------------------------------- 2) profil rempli
  console.log("\n— après un SWOT et un panel —");
  charger("fr");
  $("cv-name").value = "Marie Dorcéus";
  $("sw-work").value = "Aide-soignante en EHPAD";
  $("sw-goal").value = "Devenir infirmière";
  $("sw-procode").value = "PRO90-TEST-BANC";
  $("sw-panel").click();
  $("pn-go").click();
  await pause(30);
  $("pn-txt").value = "J'ai géré une urgence : sécurité d'abord, puis alerte à l'infirmière.";
  $("pn-send").click();
  await pause(60);
  $("pn-suite").click();
  await pause(60);
  $("pn-txt").value = "Le résident a été pris en charge en moins de dix minutes, sans chute.";
  $("pn-send").click();
  await pause(80);

  $("sw-prof").click();
  ok("un document est produit", doc.length > 400, String(doc.length));
  ok("il s'intitule Profil professionnel", /Profil professionnel/.test(doc), "");
  ok("le nom y figure", /Marie Dorc/.test(doc), "");
  ok("le métier y figure", /Aide-soignante/.test(doc), "");
  ok("l'avertissement anti-prédiction est là", /ne dit pas si un employeur vous recrutera/.test(doc), "");
  ok("la note « mesuré, pas déclaré » est là", /pas de ce que vous déclarez/.test(doc), "");
  ok("le bloc mesuré est là", /Ce qui a été mesuré/.test(doc), "");
  ok("les 7 dimensions sont nommées", ["Pertinence", "Preuve", "Résultat", "Structure", "Concision", "Expression orale", "Adaptation au poste"].every((d) => doc.indexOf(d) > 0), "");
  ok("les niveaux sont calculés (3/3 en pertinence)", /Pertinence\s*:\s*prêt\s*\(3\/3\)/.test(doc), (doc.match(/Pertinence[^<]*/) || [""])[0]);
  ok("un niveau faible reste faible (1/3)", /(Résultat|Adaptation au poste)\s*:\s*à renforcer\s*\(1\/3\)/.test(doc), (doc.match(/Résultat[^<]*/) || [""])[0]);
  ok("aucune note globale n'est affichée", !/\/100|score global|sur 100/i.test(doc), "");
  ok("aucune promesse d'embauche", !/garanti|serez recruté|obtiendrez le poste/i.test(doc), "");
  ok("il dit que rien n'a été envoyé", /n'a été envoyé nulle part/.test(doc), "");

  // --------------------------------------------------- 3) la langue suit
  console.log("\n— en kreyòl —");
  charger("ht");
  $("sw-work").value = "Ed-swayan";
  $("sw-procode").value = "PRO90-TEST-BANC";
  $("sw-panel").click();
  $("pn-go").click();
  await pause(30);
  $("pn-txt").value = "Mwen te jere yon ijans: sekirite rezidan an anvan tout bagay.";
  $("pn-send").click();
  await pause(80);
  $("sw-prof").click();
  ok("le dossier est en kreyòl", /Pwofil pwofesyon/.test(doc), doc.slice(0, 120));
  ok("l'avertissement est traduit", /Li pa di si yon anplwayè ap pran w/.test(doc), "");
  ok("aucun français ne traîne dans le dossier", !/Ce qui a été mesuré|Profil professionnel/.test(doc), "");

  console.log(ko ? "\n❌ " + ko + " vérification(s) en échec\n" : "\n✅ profil professionnel : tout passe\n");
  process.exit(ko ? 1 : 0);
})();
