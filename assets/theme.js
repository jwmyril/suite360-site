/* Apparence : Automatique, Clair, Sombre — Suite 360, 13/08/2026.

   MÊME MÉCANIQUE QUE L'EXPLORATEUR HAÏTI, volontairement : deux produits
   d'Atmart ne doivent pas avoir deux façons de changer de thème.

   CE QUI SE PASSE AVANT CE FICHIER. Un script minuscule, posé dans le <head>
   de chaque page AVANT la feuille de style, lit la préférence et pose
   `data-theme` sur <html>. Il doit rester là, en ligne et synchrone : chargé
   d'ici, il s'exécuterait après le premier rendu et le lecteur verrait un
   éclair blanc avant que le sombre ne s'applique.

   CE QU'IL NE FAIT PAS. Il n'envoie rien et ne mesure rien. L'apparence que
   quelqu'un choisit dit quelque chose de lui — l'heure à laquelle il
   travaille, sa vue, son matériel — et cela ne regarde pas Atmart.

   LA PRÉFÉRENCE EST COMMUNE AUX QUATRE LANGUES : la clé ne porte pas la
   langue. Choisir sombre en kreyòl et retrouver du clair en français serait
   un défaut. */
(function () {
  "use strict";
  var CLE = "atmart_apparence";
  var VALEURS = ["auto", "clair", "sombre"];
  var BARRE = { clair: "#FFFFFF", sombre: "#0a1a2f" };

  /* Le contrôle porte ses propres mots : les neuf pages de Suite 360 n'ont pas
     toutes le même dictionnaire, et en ajouter un dixième aurait multiplié les
     occasions d'oublier une langue. */
  var MOTS = {
    ht: { t: "Aparans", auto: "Otomatik", clair: "Klè", sombre: "Fonse",
          saut: "Ale dirèk nan kontni an" },
    fr: { t: "Apparence", auto: "Automatique", clair: "Clair", sombre: "Sombre",
          saut: "Aller directement au contenu" },
    en: { t: "Appearance", auto: "Automatic", clair: "Light", sombre: "Dark",
          saut: "Skip to the main content" },
    es: { t: "Apariencia", auto: "Automático", clair: "Claro", sombre: "Oscuro",
          saut: "Ir directamente al contenido" },
  };
  function mots() { return MOTS[document.documentElement.lang] || MOTS.ht; }

  function lu() {
    try {
      var v = localStorage.getItem(CLE);
      return VALEURS.indexOf(v) > -1 ? v : "auto";
    } catch (e) { return "auto"; }
  }
  function systemeSombre() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function effectif(choix) {
    if (choix === "clair" || choix === "sombre") return choix;
    return systemeSombre() ? "sombre" : "clair";
  }

  function appliquer(choix) {
    var e = document.documentElement;
    /* En « auto » on RETIRE l'attribut au lieu d'écrire une valeur : la feuille
       contient déjà la règle média, et lui laisser la main évite qu'un
       changement de réglage système pendant la visite trouve un attribut figé
       en travers. */
    if (choix === "auto") e.removeAttribute("data-theme");
    else e.setAttribute("data-theme", choix === "sombre" ? "dark" : "light");

    /* La barre du navigateur. Les pages declarent DEUX balises `theme-color`
       portant chacune un `media` : c'est le seul etat correct avant que ce
       script ne tourne, ou s'il ne tourne pas du tout — auparavant une balise
       unique et figee en sombre laissait la barre bleu nuit sur une page claire.

       On les remplace donc entierement au lieu d'ecraser le contenu de la
       premiere : lui poser la couleur sombre alors que son `media` dit « clair »
       donnerait une balise qui se contredit. En « auto », on repose la paire —
       elle suit le reglage systeme meme s'il change pendant la visite, ce qu'une
       valeur figee ne peut pas faire. */
    var vieilles = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < vieilles.length; i++) vieilles[i].parentNode.removeChild(vieilles[i]);

    var pose = function (couleur, media) {
      var m = document.createElement("meta");
      m.setAttribute("name", "theme-color");
      m.setAttribute("content", couleur);
      if (media) m.setAttribute("media", media);
      document.head.appendChild(m);
    };
    if (choix === "auto") {
      pose(BARRE.clair, "(prefers-color-scheme: light)");
      pose(BARRE.sombre, "(prefers-color-scheme: dark)");
    } else {
      pose(BARRE[effectif(choix)], null);
    }
  }

  var boite = null;

  function traduire() {
    // Le lien d'evitement vit hors du controle : il se traduit meme si le
    // selecteur d'apparence n'a pas encore ete pose.
    var lien = document.querySelector("a.saut");
    if (lien) lien.textContent = mots().saut;
    if (!boite) return;
    var t = mots(), s = boite.querySelector("select");
    s.setAttribute("aria-label", t.t);
    s.setAttribute("title", t.t);
    /* On réécrit le texte des <option> DÉJÀ PRÉSENTES au lieu de reconstruire
       le innerHTML : reconstruire une liste déroulante pendant qu'on la
       traduit efface la valeur choisie. */
    s.options[0].text = t.auto; s.options[1].text = t.clair; s.options[2].text = t.sombre;
  }

  function poser() {
    traduire();          // le lien d'evitement, meme sur les pages sans selecteur
    var lg = document.getElementById("s360-lang");
    if (!lg || document.getElementById("s360-theme")) return;
    var d = document.createElement("span");
    d.style.cssText = "display:inline-flex;align-items:center;margin-right:0.4rem";
    d.innerHTML = '<select id="s360-theme" style="background:var(--surface-2);color:var(--ink);'
      + 'border:1px solid var(--border-fort);border-radius:8px;padding:0.3rem 0.5rem;'
      + 'font:inherit;font-size:0.85rem;min-height:36px">'
      + '<option value="auto"></option><option value="clair"></option><option value="sombre"></option>'
      + "</select>";
    lg.parentNode.insertBefore(d, lg);
    boite = d;
    var s = d.querySelector("select");
    s.value = lu();
    s.addEventListener("change", function () {
      try { localStorage.setItem(CLE, s.value); } catch (e) {}
      appliquer(s.value);
    });
    traduire();
    /* La langue peut changer après nous : le sélecteur de langue réécrit
       `documentElement.lang`. On suit, sinon « Automatique » reste en français
       au milieu d'une page kreyòl — et une page à moitié traduite est pire
       qu'une page qui ne l'est pas. */
    lg.addEventListener("change", function () { setTimeout(traduire, 0); });
    try {
      new MutationObserver(traduire).observe(document.documentElement,
        { attributes: true, attributeFilter: ["lang"] });
    } catch (e) {}
  }

  /* Le système change d'avis en cours de visite — bascule nocturne, réglage
     modifié dans un autre onglet. En « auto » la page suit sans rechargement ;
     un choix explicite, lui, ne bouge pas. */
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var suivre = function () { if (lu() === "auto") appliquer("auto"); };
    if (mq.addEventListener) mq.addEventListener("change", suivre);
    else if (mq.addListener) mq.addListener(suivre);
  }

  appliquer(lu());
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", poser);
  else poser();
})();
