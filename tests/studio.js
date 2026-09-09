/* ===========================================================================
   Suite 360 — banc : le studio d'entretien (assets/studio.js)

   UN SEUL MODULE POUR DEUX PAGES. C'est le point de ce banc autant que des
   mesures : entevyou.html et karye.html appellent le MÊME `assets/studio.js`.
   Ce site a déjà payé deux fois le prix de deux copies qui divergent — la page
   générée contre sa source, style.css contre celui du Worker. On vérifie donc
   que les deux pages chargent le module, et qu'aucune n'en a recopié le corps.

   Puis, comme pour la caméra, la PROMESSE avant la mesure : la vidéo ne part
   pas, et l'outil ne note ni visage ni posture.

   USAGE :  node tests/studio.js
   =========================================================================== */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RACINE = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(RACINE, "assets", "studio.js"), "utf8");
const css = fs.readFileSync(path.join(RACINE, "assets", "studio.css"), "utf8");

let ko = 0;
const ok = (nom, cond, detail) => {
  console.log((cond ? "  ✅ " : "  ❌ ") + nom + (cond ? "" : "   → " + detail));
  if (!cond) ko++;
};
// Sans les commentaires : celui qui explique le danger le cite, et le banc se
// déclencherait dessus. Piège rencontré quatre fois sur ce produit.
const nu = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?:^|\n)\s*\/\/.*/g, "");

// ------------------------------------------------------------ un seul module
console.log("\n— un seul module, deux pages —");
for (const p of ["entevyou.html", "karye.html"]) {
  const s = fs.readFileSync(path.join(RACINE, p), "utf8");
  ok(p + " charge le module", /assets\/studio\.js/.test(s), "le studio n'y est pas branché");
  ok(p + " charge l'habillage", /assets\/studio\.css/.test(s), "la scène s'afficherait sans style");
  ok(p + " n'a pas recopié le module",
    !/var COURT_S = 20|st-orbe.*keyframes/.test(s),
    "une copie du studio dans la page : elle divergera");
  ok(p + " passe une langue au studio", /Studio\.ouvrir\([\s\S]{0,700}?langue:/.test(s),
    "sans langue, le studio parlerait français à tout le monde");
}

// ------------------------------------------------------------- la promesse
console.log("\n— la vidéo ne quitte pas l'appareil —");
ok("le module n'appelle jamais le réseau lui-même",
  !/fetch\(|XMLHttpRequest|sendBeacon/.test(nu),
  "le studio doit déléguer la transcription à la page, et ne rien envoyer seul");
ok("il ne reçoit qu'un blob AUDIO à transcrire",
  /cfg\.transcrire\(b\)/.test(nu) && /new Blob\(audio,/.test(nu),
  "c'est le blob vidéo qui serait passé");
ok("la piste audio est clonée, pas le flux entier",
  /new MediaStream\(\[pistes\[0\]\]\)/.test(nu), "sans clonage, la vidéo partirait avec");
ok("la vidéo vit dans une URL d'objet, jamais dans un stockage",
  /URL\.createObjectURL/.test(nu) && !/localStorage|sessionStorage|indexedDB/i.test(nu),
  "une vidéo de soi n'a rien à faire dans un stockage persistant");
ok("l'URL d'objet est révoquée", /revokeObjectURL/.test(nu), "sinon la vidéo reste en mémoire");
ok("les pistes sont coupées à la fermeture",
  /getTracks\(\)\.forEach\(function \(t\) \{ t\.stop\(\); \}\)/.test(nu),
  "un voyant qui reste allumé est une promesse rompue");
ok("le contexte audio est fermé aussi",
  /ctxAudio\.close/.test(nu), "un AudioContext ouvert garde le micro actif");

console.log("\n— ce que l'outil refuse de mesurer —");
// On regarde le CODE, dictionnaire exclu : la phrase qui promet de ne PAS noter
// la « confiance » contient forcément le mot « confidence ». Quatrième fois que
// ce piège se referme — après le glob wrangler, `style.css?v=` dans sw.js, et
// le commentaire de `esc()`. Un banc ne doit jamais se déclencher sur le texte
// qui décrit le danger.
const codeSeul = nu.slice(0, nu.indexOf("var MOTS = {")) + nu.slice(nu.indexOf("function $(id)"));
for (const mot of ["FaceDetector", "faceapi", "posture", "eyeContact", "confidence", "smile", "emotion"]) {
  ok("aucune analyse « " + mot + " »", !new RegExp(mot, "i").test(codeSeul),
    "juger un visage revient à mesurer l'écart à une norme culturelle");
}

// ---------------------------------------------------------------- l'accueil
console.log("\n— la scène est utilisable —");
ok("elle se ferme au clavier (Échap)", /e\.key === "Escape"/.test(nu),
  "une scène plein écran sans sortie au clavier est un piège");
ok("elle se déclare comme dialogue", /aria-modal/.test(nu) && /role", "dialog/.test(nu), "");
ok("le focus entre dans la scène à l'ouverture", /\$\("st-x"\)\.focus\(\)/.test(nu), "");
ok("les boutons font au moins 44 px", /min-height:\s*44px/.test(css),
  "cible tactile sous le seuil");
ok("la grille ne déborde pas sur un petit écran",
  /minmax\(min\(300px,\s*100%\),\s*1fr\)/.test(css),
  "sans min(), la grille impose sa largeur et la page déborde à 320 px");
ok("l'animation se coupe si la personne l'a demandé",
  /prefers-reduced-motion/.test(css), "une pulsation permanente en plein écran s'impose à tous");

// ---------------------------------------------------- les quatre langues
console.log("\n— les quatre langues portent les mêmes clés —");
const bloc = js.slice(js.indexOf("var MOTS = {"), js.indexOf("function $(id)"));
const cles = {};
for (const lg of ["ht", "fr", "en", "es"]) {
  const i = bloc.indexOf("\n    " + lg + ": {");
  const j = bloc.indexOf("\n    },", i);
  ok("le dictionnaire « " + lg + " » existe", i > 0, "langue absente du module");
  if (i < 0) continue;
  cles[lg] = new Set([...bloc.slice(i, j).matchAll(/(?:^|[,{]\s*)([A-Za-z_]\w*)\s*:/gm)].map((m) => m[1]));
}
const ecarts = [];
for (const lg of ["ht", "en", "es"]) {
  if (!cles[lg] || !cles.fr) continue;
  const manque = [...cles.fr].filter((k) => !cles[lg].has(k));
  const trop = [...cles[lg]].filter((k) => !cles.fr.has(k));
  if (manque.length || trop.length) ecarts.push(lg + " : " + [...manque, ...trop].slice(0, 4).join(", "));
}
ok("aucune clé manquante ni en trop", !ecarts.length, ecarts.join(" | "));

// -------------------------------------------------------------- les mesures
console.log("\n— les mesures, exécutées depuis le module livré —");
let rendu = "";
const bac = {
  window: {}, navigator: {}, Promise,
  document: {
    getElementById: () => ({ set innerHTML(v) { rendu = v; }, textContent: "", setAttribute() {} }),
    createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {}, appendChild() {} }),
    body: { appendChild() {}, classList: { add() {}, remove() {} } },
  },
};
bac.window = bac;
try {
  vm.createContext(bac);
  new vm.Script(js).runInContext(bac);
} catch (e) {
  ok("le module s'évalue", false, e.message.slice(0, 90));
}
const S = bac.Studio;
if (S && S._mesures) {
  const poser = (lg) => S._cfg({ langue: lg });
  poser("fr");

  S._mesures(8, "bonjour");
  ok("8 s : signalé trop court", /sous 20 secondes/.test(rendu), rendu.slice(0, 90));

  S._mesures(170, "un texte");
  ok("2 min 50 : signalé trop long", /2 min 30/.test(rendu), "");

  S._mesures(75, new Array(120).fill("mot").join(" "));
  ok("96 mots/minute : bon rythme", /96 mots par minute/.test(rendu) && /sans effort/.test(rendu), "");

  S._mesures(60, "euh alors euh en fait je euh voilà du coup");
  ok("les béquilles françaises sont comptées", /euh ×3/.test(rendu), "");
  ok("« en fait » compte pour une", /en fait ×1/.test(rendu), "");

  poser("en");
  S._mesures(60, "um so like I um basically you know");
  ok("les béquilles anglaises suivent la langue", /um ×2/.test(rendu) && /like ×1/.test(rendu),
    rendu.slice(rendu.indexOf("×") - 40, rendu.indexOf("×") + 40));
  ok("le texte anglais accompagne la mesure anglaise", /Filler words/.test(rendu), "");

  poser("ht");
  S._mesures(60, "mwen te travay nan yon lopital pandan senk an");
  ok("le kreyòl rend ses propres mots", /Konbyen tan ou pale/.test(rendu), "");

  poser("fr");
  S._mesures(60, "");
  ok("sans transcription, la durée reste rendue", /Durée de votre réponse/.test(rendu), "");
  ok("la mention « nous ne notons pas » accompagne chaque mesure",
    /Nous ne notons NI votre visage/.test(rendu), "elle doit être sous les yeux à chaque fois");
} else {
  ok("le studio expose ses mesures pour être testé", false, "Studio._mesures introuvable");
}

console.log(ko ? "\n❌ " + ko + " vérification(s) en échec\n"
  : "\n✅ studio : un seul module, la vidéo reste sur l'appareil, les mesures tiennent\n");
process.exit(ko ? 1 : 0);
