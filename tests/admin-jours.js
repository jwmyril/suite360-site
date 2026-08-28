/* ===========================================================================
   Suite 360 — banc : les tableaux « jour par jour » du tableau de bord

   On extrait les fonctions du tableau de bord et on les nourrit de données
   fabriquées. Un tableau de bord qui affiche un mauvais chiffre ne lève
   aucune erreur : il ment silencieusement, et on décide sur ce mensonge.

   USAGE :  node tests/admin-jours.js
   =========================================================================== */
const fs = require("fs");
// Le tableau de bord est servi par le Worker depuis le 28/08/2026 : GitHub
// Pages ne pouvait poser aucun en-tete sur la page ou se tape le mot de passe.
// Le banc suit la page, sinon il controlerait une redirection.
const src = fs.readFileSync(require("path").join(
  __dirname, "..", "..", "Atmart_chat_worker", "pages", "admin.html"), "utf8");

function extrait(nom) {
  const i = src.indexOf("function " + nom + "(");
  if (i < 0) throw new Error("introuvable : " + nom);
  let p = 0, k = src.indexOf("{", i);
  for (; k < src.length; k++) {
    if (src[k] === "{") p++;
    else if (src[k] === "}") { p--; if (p === 0) break; }
  }
  return src.slice(i, k + 1);
}

const cibles = {};
const prelude = `
  var derniersJours = null;
  function esc(t){ return t == null ? "" : String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function $(id){ return cibles[id] = cibles[id] || { id, innerHTML: "" }; }
`;
const code = prelude + [extrait("serie"), extrait("joursTries"), extrait("tableJours"), extrait("peindreJours")].join("\n")
  + "; return { peindreJours, joursTries, get derniersJours(){ return derniersJours; } };";
const F = new Function("cibles", code)(cibles);

let ko = 0;
const ok = (nom, cond, detail) => {
  console.log((cond ? "  ✅ " : "  ❌ ") + nom + (cond ? "" : "   → " + detail));
  if (!cond) ko++;
};

// ---- jeu de données : 3 jours, avec des trous exprès -----------------------
const d = {
  days: 3,
  visiteurs: { "2026-08-11": 5, "2026-08-12": 20, "2026-08-13": 8 },
  byDay: {
    view_entevyou: { "2026-08-12": 20, "2026-08-13": 6 },
    swot_done:     { "2026-08-12": 7,  "2026-08-13": 2 },
    cv_ok:         { "2026-08-12": 3 },
    voice_done:    { "2026-08-12": 4,  "2026-08-13": 1 },
    buy_click_kit: { "2026-08-12": 2 },
    buy_click_90:  { "2026-08-12": 1 },
    code_delivered:{ "2026-08-12": 1 },
    view_karye:    { "2026-08-12": 9,  "2026-08-11": 4 },
    karye_start:   { "2026-08-12": 3 },
    karye_done:    { "2026-08-12": 2 },
    trial_created: { "2026-08-12": 2 },
    buy_click_career: { "2026-08-11": 1 },
  },
};

console.log("\n— les jours —");
const jours = F.joursTries(d);
ok("tous les jours vus sont repris", jours.length === 3, jours.join(","));
ok("le plus récent est en tête", jours[0] === "2026-08-13", jours[0]);

console.log("\n— Entèvyou360 —");
F.peindreJours(d);
const R = F.derniersJours;
const ligne = (t, j) => t.find((r) => r[0] === j);
const e12 = ligne(R.ligEnt, "2026-08-12");
ok("ouvertures du 12", e12[1] === 20, String(e12[1]));
ok("SWOT terminés du 12", e12[2] === 7, String(e12[2]));
ok("CV produits du 12 (cv_ok, pas le clic)", e12[3] === 3, String(e12[3]));
ok("exercices coach du 12", e12[4] === 4, String(e12[4]));
ok("ouvertures sans SWOT = 20 − 7", e12[5] === 13, String(e12[5]));
ok("clics paiement = kit + 90", e12[6] === 3, String(e12[6]));
const e11 = ligne(R.ligEnt, "2026-08-11");
ok("un jour sans aucune ouverture reste à 0, jamais négatif", e11[1] === 0 && e11[5] === 0, JSON.stringify(e11));
const totE = R.ligEnt[R.ligEnt.length - 1];
ok("la ligne Total est présente", totE[0] === "Total", String(totE[0]));
ok("total des ouvertures = 26", totE[1] === 26, String(totE[1]));
ok("total sans SWOT = 13 + 4", totE[5] === 17, String(totE[5]));

console.log("\n— Career360 —");
const k12 = ligne(R.ligKar, "2026-08-12");
ok("ouvertures du 12", k12[1] === 9, String(k12[1]));
ok("séances ouvertes du 12", k12[2] === 3, String(k12[2]));
ok("échanges avec le coach du 12", k12[3] === 2, String(k12[3]));
ok("ouvertures sans échange = 9 − 2", k12[4] === 7, String(k12[4]));
ok("essais 7 j du 12", k12[5] === 2, String(k12[5]));

console.log("\n— l'avertissement —");
const note = cibles["ad-jour-note"].innerHTML;
ok("le tableau dit qu'il compte des actions", /actions, pas des personnes/.test(note), "");
ok("il dit que personne n'est identifiable", /personne[\s\S]{0,30}identifiable/.test(note), "");
ok("il avertit que les ventes ne sont pas par produit", /pas réparti par produit/.test(note), "");

console.log("\n— l'en-tête du tableau —");
const html = cibles["ad-jour-ent"].innerHTML;
ok("les colonnes demandées sont là",
  ["Date", "Ouvertures", "SWOT terminé", "CV produit", "Exercice coach", "Ouvertures sans SWOT", "Codes livrés"]
    .every((c) => html.indexOf(c) > 0), "");

console.log(ko ? "\n❌ " + ko + " vérification(s) en échec\n" : "\n✅ tableaux jour par jour : tout passe\n");
process.exit(ko ? 1 : 0);
