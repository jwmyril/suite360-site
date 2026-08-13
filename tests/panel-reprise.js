/* ===========================================================================
   Suite 360 — banc d'interaction : reprise de l'entretien Panel Simulator
   ---------------------------------------------------------------------------
   POURQUOI un second banc : script-harness.js prouve que le script s'exécute
   et que les gestionnaires s'attachent. Il ne prouve PAS qu'un scénario
   fonctionne, parce que son DOM est jetable (chaque getElementById renvoie un
   objet neuf, addEventListener ne retient rien).

   Ici, les éléments sont mémorisés par id et les gestionnaires sont rejouables.
   On simule donc un vrai parcours, puis une FERMETURE DE L'APPLICATION : le
   script est ré-exécuté à neuf sur le même localStorage, exactement comme un
   rechargement de page.

   USAGE :
     node tests/panel-reprise.js entevyou.html
   =========================================================================== */

const fs = require("fs");
const cible = process.argv[2] || "entevyou.html";
const html = fs.readFileSync(cible, "utf8");

// --- extraction du bloc le plus long (même règle que script-harness) --------
let best = { len: 0, code: "" };
let p = 0;
while (true) {
  const i = html.indexOf("<script>", p);
  if (i < 0) break;
  const suivant = html.indexOf("<script>", i + 8);
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

// --- le disque : il SURVIT au rechargement, c'est tout l'intérêt ------------
const disque = {};
const stockage = {
  getItem: (k) => (k in disque ? disque[k] : null),
  setItem: (k, v) => { disque[k] = String(v); },
  removeItem: (k) => { delete disque[k]; },
};

let elements, appels, paroles = 0;

function neuf(id) {
  const el = {
    id, _h: {}, style: {}, value: "", textContent: "", innerHTML: "", placeholder: "",
    checked: false, disabled: false, open: false, children: [],
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

// --- réponses du Worker, déterministes --------------------------------------
let nQuestion = 0;
function faussesReponses(corps) {
  const a = corps.action;
  if (a === "panel") { nQuestion++; return { question: "Question numéro " + nQuestion + " ?" }; }
  if (a === "panelrep") {
    return {
      retour: "Un retour du panéliste.",
      relance: corps.relances < 1 ? "Et le résultat concret ?" : null,
      notes: { pertinence: 2, preuve: 2, resultat: 1, structure: 2, concision: 3, oral: 2, adaptation: 2 },
    };
  }
  if (a === "panelrapport") return { rapport: "📊 NIVEAU\n\nLigne de bilan.", moyennes: {}, tours: (corps.tours || []).length };
  return {};
}

function charger() {
  elements = {}; appels = [];
  global.window = { addEventListener() {}, matchMedia: () => ({ matches: false }), console };
  global.document = {
    getElementById(id) {
      if (!ids.has(id)) return null;
      return (elements[id] = elements[id] || neuf(id));
    },
    querySelector: () => neuf("?"), querySelectorAll: () => [], addEventListener() {},
    documentElement: { lang: "fr", setAttribute() {}, outerHTML: "" },
    body: { classList: { toggle() {}, add() {}, remove() {} }, appendChild() {}, removeChild() {} },
    createElement: () => neuf("?"),
  };
  global.navigator = { language: "fr", languages: ["fr"], userAgent: "node", sendBeacon() { return true; } };
  global.localStorage = stockage;
  global.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  global.fetch = (url, opt) => {
    let corps = {};
    try { corps = JSON.parse((opt && opt.body) || "{}"); } catch (e) {}
    if (corps.action) appels.push(corps.action);
    return Promise.resolve({ ok: true, json: () => Promise.resolve(faussesReponses(corps)) });
  };
  global.MutationObserver = class { observe() {} };
  global.speechSynthesis = { getVoices: () => [], cancel() {}, addEventListener() {}, speak() { paroles++; } };
  global.SpeechSynthesisUtterance = class {};
  new Function(best.code)();
}

const $ = (id) => document.getElementById(id);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

let ko = 0;
function ok(nom, cond, detail) {
  console.log((cond ? "  ✅ " : "  ❌ ") + nom + (cond ? "" : "   → " + detail));
  if (!cond) ko++;
}

(async function () {
  // ======================= séance 1 : on répond ============================
  console.log("\n— séance 1 —");
  charger();
  $("sw-procode").value = "PRO90-TEST-BANC";
  $("sw-panel").click();
  ok("le panneau s'ouvre déverrouillé", $("pn-corps").style.display === "", $("pn-corps").style.display);
  ok("aucune reprise proposée au départ", $("pn-reprise").style.display === "none", $("pn-reprise").style.display);

  $("pn-go").click();
  await pause(30);
  ok("la 1re question s'affiche", /Question numéro 1/.test($("pn-q").innerHTML), $("pn-q").innerHTML);

  $("pn-txt").saisir("Je gère les urgences en commençant par la sécurité du résident, puis j'alerte.");
  await pause(900); // l'écriture est différée de 600 ms — on l'attend
  ok("le brouillon est enregistré", /Je gère les urgences/.test(disque[Object.keys(disque)[0]] || ""), JSON.stringify(disque));

  $("pn-send").click();
  await pause(900);
  ok("le retour du panéliste s'affiche", /retour du panéliste/.test($("pn-fb").innerHTML), $("pn-fb").innerHTML);
  ok("une relance est proposée", $("pn-suite-row").style.display === "flex", $("pn-suite-row").style.display);

  const cle = Object.keys(disque)[0];
  const avant = JSON.parse(disque[cle]);
  ok("l'entretien est sur le disque", !!cle && cle.indexOf("s360_pn:") === 0, cle);
  ok("1 tour enregistré", avant.tours.length === 1, JSON.stringify(avant.tours));
  ok("état = suite", avant.etat === "suite", avant.etat);
  ok("la relance est la question courante", /résultat concret/.test(avant.q), avant.q);

  // ============ l'utilisateur quitte l'application, puis revient ============
  console.log("\n— l'application est fermée puis rouverte —");
  charger();                       // script ré-exécuté à neuf, même disque
  $("sw-procode").value = "PRO90-TEST-BANC";
  $("sw-panel").click();
  ok("la reprise est proposée", $("pn-reprise").style.display === "", $("pn-reprise").style.display);
  ok("rien n'est affiché avant le choix", $("pn-live").style.display !== "", $("pn-live").style.display);

  paroles = 0;
  $("pn-reprendre").click();
  ok("la question est revenue", /résultat concret/.test($("pn-q").innerHTML), $("pn-q").innerHTML);
  ok("le retour est revenu", /retour du panéliste/.test($("pn-fb").innerHTML), $("pn-fb").innerHTML);
  ok("le bloc de reprise disparaît", $("pn-reprise").style.display === "none", $("pn-reprise").style.display);
  ok("aucune lecture à voix haute à la reprise", paroles === 0, paroles + " appel(s) à speak()");

  // on continue là où on s'était arrêté
  $("pn-suite").click();
  ok("la relance devient la question posée", /résultat concret/.test($("pn-q").innerHTML), $("pn-q").innerHTML);
  $("pn-txt").saisir("Le résident a été pris en charge en moins de dix minutes, sans chute.");
  $("pn-send").click();
  await pause(900);
  const apres = JSON.parse(disque[cle]);
  ok("2 tours enregistrés", apres.tours.length === 2, JSON.stringify(apres.tours.length));
  ok("plafond de relances tenu", apres.rel === 0, String(apres.rel));

  // ==================== « commencer un autre » efface ======================
  console.log("\n— on redémarre un entretien —");
  charger();
  $("sw-procode").value = "PRO90-TEST-BANC";
  $("sw-panel").click();
  $("pn-neuf").click();
  await pause(900);
  const neufEtat = JSON.parse(disque[cle] || "{}");
  ok("l'ancien entretien est effacé", (neufEtat.tours || []).length === 0, JSON.stringify(neufEtat.tours));
  ok("une nouvelle question est posée", /Question numéro/.test($("pn-q").innerHTML), $("pn-q").innerHTML);

  console.log(ko ? "\n❌ " + ko + " vérification(s) en échec\n" : "\n✅ reprise de l'entretien : tout passe\n");
  process.exit(ko ? 1 : 0);
})();
