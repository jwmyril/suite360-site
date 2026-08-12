/* ===========================================================================
   Suite 360 — audit de langue
   ---------------------------------------------------------------------------
   POURQUOI : une page qui affiche deux langues à la fois fait douter du
   produit entier. Le défaut est toujours le même — un texte écrit en dur dans
   le HTML, ou un libellé que la fonction de traduction oublie de réécrire.
   On ne le voit pas en relisant le code : il faut comparer les quatre langues.

   COMMENT S'EN SERVIR (avant chaque mise en ligne) :
     1. ouvrir la page à vérifier (entevyou.html, karye.html, index.html…)
     2. ouvrir la console du navigateur (F12 → Console)
     3. coller TOUT ce fichier, puis Entrée
     4. lire le verdict

   Le test parcourt la page dans les 4 langues et signale tout élément dont le
   texte ne change JAMAIS. Les invariants légitimes (marques, adresses e-mail,
   noms de langues) sont listés plus bas — ajoutez-y les nouveaux au lieu de
   les ignorer mentalement.
   =========================================================================== */

(async function auditLangue() {
  var LANGUES = ["ht", "fr", "en", "es"];

  // Invariants assumés : ils DOIVENT être identiques dans les quatre langues.
  // Toute nouvelle entrée ici est une décision, pas un oubli — justifiez-la.
  var INVARIANTS = [
    /^Entèvyou360/, /^Career360$/, /^Suite ?360/, /^Atmart/, /^Arpentaj/,
    /^Lojik360/, /^PRO 90$/, /^First 5 Minutes$/, /⏱ First 5 Minutes$/,
    /^Kreyòl$|^Français$|^English$|^Español$/,
    /@atmart\.ltd/, /atmart\.ltd$/,
    /^ENT-|^PRO90-|^KOACH-/,          // codes
    /^\d/,                             // commence par un chiffre
  ];

  var sel = document.getElementById("s360-lang");
  if (!sel) { console.error("Audit impossible : sélecteur de langue introuvable."); return; }

  function estInvariant(t) {
    return INVARIANTS.some(function (re) { return re.test(t); });
  }

  // On ne lit que les FEUILLES : sinon un parent hérite du texte de ses enfants
  // et tout paraît changer. On exclut les zones de contenu généré par l'IA,
  // qui suit déjà la langue demandée au serveur.
  var EXCLUS = "script,style,#sw-out,#cv-out,#vw-fb,#vw-mqfb,#f5-plan,#f5-fb,.bilan-out,#ad-avis";

  function releve() {
    var m = {};
    document.querySelectorAll("body *").forEach(function (el) {
      if (el.children.length) return;
      var t = (el.textContent || "").trim();
      if (!t || t.length < 4) return;
      if (el.closest(EXCLUS)) return;
      var cle = el.id ? "#" + el.id : el.tagName + "·" + (el.className || "") + "·" + t.slice(0, 20);
      m[cle] = t;
    });
    // les textes d'aide sont aussi de la langue
    document.querySelectorAll("input[placeholder],textarea[placeholder]").forEach(function (el) {
      var p = (el.placeholder || "").trim();
      if (p.length >= 4) m["placeholder#" + (el.id || el.name || p.slice(0, 12))] = p;
    });
    return m;
  }

  var langueInitiale = sel.value;
  var snap = {};
  for (var i = 0; i < LANGUES.length; i++) {
    sel.value = LANGUES[i];
    sel.dispatchEvent(new Event("change"));
    await new Promise(function (r) { setTimeout(r, 400); });
    snap[LANGUES[i]] = releve();
  }
  sel.value = langueInitiale;
  sel.dispatchEvent(new Event("change"));

  var figes = [], partiels = [];
  Object.keys(snap.fr).forEach(function (k) {
    var v = LANGUES.map(function (lg) { return snap[lg][k]; });
    if (v.some(function (x) { return x === undefined; })) return;
    var distinctes = new Set(v).size;
    if (distinctes === 1) {
      if (!estInvariant(v[0])) figes.push({ element: k, texte: v[0].slice(0, 70) });
    } else if (distinctes < LANGUES.length) {
      // deux langues partagent le même texte : souvent une traduction oubliée
      partiels.push({ element: k, textes: v.map(function (x) { return x.slice(0, 32); }) });
    }
  });

  console.log("%c=== AUDIT DE LANGUE — " + location.pathname + " ===", "font-weight:bold");
  console.log("Éléments comparés : " + Object.keys(snap.fr).length);
  if (!figes.length) {
    console.log("%c✅ Aucun texte figé. La page ne mélange pas les langues.", "color:#2ec4b6;font-weight:bold");
  } else {
    console.log("%c❌ " + figes.length + " texte(s) figé(s) — à ajouter au dictionnaire :", "color:#e07a7a;font-weight:bold");
    console.table(figes);
  }
  if (partiels.length) {
    console.log("%c⚠️ " + partiels.length + " texte(s) identiques dans 2 ou 3 langues — à vérifier à la main :", "color:#f4a261");
    console.table(partiels);
  }
  return { figes: figes.length, partiels: partiels.length };
})();
