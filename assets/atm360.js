// Suite 360 — socle commun des pages : langue, mesure, pied de page.
// Une page déclare son dictionnaire (4 langues) et sa carte id -> clé, puis :
//   ATM.page({dict: L, map: MAP, event: "view_org"});
// Aucune donnée personnelle n'est envoyée : la mesure ne compte que des événements.
window.ATM = (function () {
  var EP = "https://atmart-chat.atmartllc.workers.dev";
  var BY = { ht: "pa Atmart", fr: "par Atmart", en: "by Atmart", es: "por Atmart" };
  var LEG = {
    ht: "Kondisyon · Konfidansyalite · Ranbousman",
    fr: "Conditions · Confidentialité · Remboursements",
    en: "Terms · Privacy · Refunds",
    es: "Términos · Privacidad · Reembolsos",
  };

  function lang() {
    var l = document.documentElement.lang || "ht";
    return BY[l] ? l : "ht";
  }

  // Compteur d'événement — silencieux, jamais bloquant.
  // fetch + keepalive plutôt que sendBeacon : sendBeacon envoie en mode
  // credentials "include", que notre CORS (origine nommée, sans cookie) refuse.
  function track(name) {
    try {
      fetch(EP + "/ev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name, lang: lang() }),
        keepalive: true,
        credentials: "omit",
      }).catch(function () {});
    } catch (e) {}
  }

  // Applique un dictionnaire : map = { "element-id": ["cleDuDict", htmlOuPas] }
  function apply(dict, map) {
    var t = dict[lang()] || dict.ht;
    for (var id in map) {
      var el = document.getElementById(id);
      if (!el || t[map[id][0]] === undefined) continue;
      if (map[id][1]) el.innerHTML = t[map[id][0]];
      else el.textContent = t[map[id][0]];
    }
    var by = document.getElementById("s360-by");
    if (by) by.textContent = BY[lang()];
    var fl = document.getElementById("f-legal");
    if (fl) fl.textContent = LEG[lang()];
    if (t.__title) document.title = t.__title;
    // placeholders : data-ph="cleDuDict"
    var phs = document.querySelectorAll("[data-ph]");
    for (var i = 0; i < phs.length; i++) {
      var k = phs[i].getAttribute("data-ph");
      if (t[k] !== undefined) phs[i].setAttribute("placeholder", t[k]);
    }
  }

  function page(opts) {
    var dict = opts.dict, map = opts.map || {};
    // le sélecteur peut n'offrir qu'un sous-ensemble de langues : on retire celles
    // que la page ne tient pas (règle maison : jamais de page à moitié traduite).
    var sel = document.getElementById("s360-lang");
    if (sel) {
      for (var i = sel.options.length - 1; i >= 0; i--) {
        if (!dict[sel.options[i].value]) sel.remove(i);
      }
      if (!dict[document.documentElement.lang]) document.documentElement.lang = sel.options[0].value;
      sel.value = document.documentElement.lang;
      sel.addEventListener("change", function () {
        try { localStorage.setItem("atmart_lang", sel.value); } catch (e) {}
        document.documentElement.lang = sel.value;
      });
    }
    new MutationObserver(function () { apply(dict, map); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    apply(dict, map);
    if (opts.event) track(opts.event);
  }

  return { EP: EP, lang: lang, track: track, page: page, apply: apply };
})();
