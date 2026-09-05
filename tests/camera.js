/* ===========================================================================
   Suite 360 — banc : la simulation caméra

   CE QU'IL PROTÈGE EN PRIORITÉ, et ce n'est pas une mesure : c'est une
   PROMESSE. La page annonce, et les conditions d'utilisation répètent, que la
   vidéo ne quitte jamais l'appareil. Une seule ligne de code qui enverrait le
   blob vidéo — ajoutée un jour par distraction, pour « améliorer le retour » —
   ferait de cette phrase un mensonge, sur un produit dont l'argument est la
   discrétion, auprès de gens qui ont de bonnes raisons de se méfier.

   On vérifie donc, dans le code livré : que le blob vidéo n'est jamais passé à
   un `fetch`, et que ce qui part vers /vwa est bien la piste audio CLONÉE.

   Ensuite seulement, on exécute les mesures. Elles sont extraites du fichier
   livré, pas réécrites ici : un banc qui teste sa propre copie ne teste rien.

   USAGE :  node tests/camera.js
   =========================================================================== */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RACINE = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(RACINE, "entevyou.html"), "utf8");

let ko = 0;
const ok = (nom, cond, detail) => {
  console.log((cond ? "  ✅ " : "  ❌ ") + nom + (cond ? "" : "   → " + detail));
  if (!cond) ko++;
};

// Le code, sans ses commentaires : un commentaire qui décrit le danger cite le
// danger, et le banc se déclencherait dessus. Piège rencontré trois fois.
const brut = html.slice(html.indexOf("var camStream"), html.indexOf("function camBrancher"));
const code = brut.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?:^|\n)\s*\/\/.*/g, "");

// ------------------------------------------------------------- la promesse
console.log("\n— la vidéo ne quitte pas l'appareil —");
ok("aucun envoi ne porte le blob vidéo",
  !/fetch\([^)]*camBlob|body:[^}]*camBlob|camMorceaux[^;]*fetch/.test(code),
  "le blob vidéo est passé à une requête réseau");
ok("le seul envoi porte l'audio cloné",
  /camAudio/.test(code) && /new MediaStream\(\[pistes\[0\]\]\)/.test(code),
  "la piste audio n'est pas clonée : c'est le flux entier qui partirait");
ok("un seul appel réseau dans tout le module",
  (code.match(/fetch\(/g) || []).length === 1,
  (code.match(/fetch\(/g) || []).length + " appels — un de trop");
ok("la vidéo vit dans une URL d'objet, pas dans un stockage",
  /URL\.createObjectURL/.test(code) && !/localStorage|sessionStorage|indexedDB/i.test(code),
  "une vidéo de soi n'a rien à faire dans un stockage persistant");
ok("l'URL d'objet est révoquée à l'effacement",
  /revokeObjectURL/.test(code), "sans révocation, la vidéo reste en mémoire");

// --------------------------------------------------------- ce qu'on ne fait pas
console.log("\n— ce que l'outil refuse de mesurer —");
for (const mot of ["FaceDetector", "faceapi", "posture", "eyeContact", "confidence", "smile"]) {
  ok("aucune analyse « " + mot + " »", !new RegExp(mot, "i").test(code),
    "juger un visage ou une posture revient à mesurer l'écart à une norme culturelle");
}

// -------------------------------------------------------------- les mesures
console.log("\n— les mesures, exécutées depuis le fichier livré —");
const sortie = { html: "" };
const bac = {
  // Chaque clé rend son propre nom, SUIVI du gabarit `{n}` : sans lui, le
  // `.replace("{n}", …)` du code n'a rien à remplacer et le nombre mesuré
  // disparaît du rendu — on croirait le code fautif alors que c'est le faux
  // dictionnaire qui est incomplet.
  MSG: new Proxy({}, { get: (_, k) => String(k) + " {n}" }),
  siteLang: () => "fr",
  esc: (t) => String(t == null ? "" : t),
  document: { getElementById: () => ({ set innerHTML(v) { sortie.html = v; } }) },
};
try {
  vm.createContext(bac);
  new vm.Script(brut + "\n").runInContext(bac);
} catch (e) {
  ok("le module s'exécute", false, e.message.slice(0, 90));
}

if (typeof bac.camMesures === "function") {
  const lire = () => sortie.html;

  bac.camMesures(8, "bonjour je m'appelle Marie");
  ok("une réponse de 8 s est signalée trop courte", /camDuree_court/.test(lire()), lire().slice(0, 80));

  bac.camMesures(170, "un texte quelconque");
  ok("une réponse de 2 min 50 est signalée trop longue", /camDuree_long/.test(lire()), "");

  bac.camMesures(75, new Array(120).fill("mot").join(" "));
  ok("75 s et 120 mots donnent un bon rythme", /camRythme_bon/.test(lire()) && /96/.test(lire()),
    lire().slice(0, 120));

  bac.camMesures(60, new Array(40).fill("mot").join(" "));
  ok("40 mots en une minute sont signalés lents", /camRythme_lent/.test(lire()), "");

  // Les mots béquilles : c'est la mesure la plus utile, et la plus facile à
  // rater — un « en fait » se compte en deux mots, pas en un.
  bac.camMesures(60, "euh alors euh en fait je euh voilà du coup je pense");
  ok("les béquilles françaises sont comptées", /euh ×3/.test(lire()), lire().slice(lire().indexOf("×") - 30, lire().indexOf("×") + 30));
  ok("« en fait » est reconnu comme une seule béquille", /en fait ×1/.test(lire()), "");

  bac.camMesures(60, "je suis arrivée en deux mille dix et j'ai travaillé six ans");
  ok("un texte sans béquille le dit", /camAucune/.test(lire()), "");

  // Le mot béquille ne doit pas se déclencher à l'intérieur d'un autre mot.
  bac.camMesures(60, "j'ai un bagage en logistique et une formation en genre humain");
  const faux = (lire().match(/genre ×/g) || []).length;
  ok("« genre » compté une fois, pas dans « genres »", faux <= 1, faux + " occurrences");

  ok("la mention « nous ne notons pas » accompagne chaque mesure",
    /camPasDeNote/.test(lire()), "elle doit être sous les yeux à chaque fois");

  bac.camMesures(60, "");
  ok("sans transcription, la durée reste rendue",
    /camDuree/.test(lire()) && /camSansTexte/.test(lire()), "");
} else {
  ok("camMesures est exportable et testable", false, "fonction introuvable dans le module extrait");
}

console.log(ko ? "\n❌ " + ko + " vérification(s) en échec\n"
  : "\n✅ simulation caméra : la vidéo reste sur l'appareil, les mesures tiennent\n");
process.exit(ko ? 1 : 0);
