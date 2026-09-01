# -*- coding: utf-8 -*-
"""Génère une adresse indexable par langue — 6 pages × 4 langues.

POURQUOI. Suite 360 n'avait qu'une seule adresse par page, la langue étant
choisie côté navigateur. Google ne voyait donc qu'une seule langue : le
multilingue, qui est l'argument numéro un du produit, était invisible en
recherche. Un `hreflang` posé sur une adresse unique aurait été un signal FAUX,
pas un signal manquant — il fallait de vraies adresses.

LE CHOIX DU SUFFIXE, et non du sous-dossier. `entevyou.fr.html` plutôt que
`/fr/entevyou.html` : aucune profondeur de chemin ne change, donc AUCUN lien
relatif n'est à réécrire — ni les feuilles, ni les images, ni les liens entre
pages. C'est moins joli et beaucoup moins risqué. Sur un site où un chemin
relatif avait déjà cassé la page 404, le choix se défend.

CE QUE CHAQUE VARIANTE PORTE.
  · <html lang="xx" data-lang-fixe> — l'attribut coupe la détection
    automatique : l'adresse déclare la langue, rien ne doit passer par-dessus.
  · le <title> et la <meta description> de CETTE langue, tirés des clés
    __title / __desc du dictionnaire de la page.
  · un canonical vers elle-même, les quatre alternates, et x-default vers la
    page racine — qui reste la version « auto ».
  · un sélecteur de langue qui NAVIGUE vers la variante sœur : sur une adresse
    qui déclare sa langue, changer de langue doit changer d'adresse, sinon
    l'URL ment.

USAGE :
    python tools/gen-langues.py
À relancer après toute modification d'une des six pages sources.
"""
import io, os, re, sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://360.atmart.ltd"
LANGUES = ["ht", "fr", "en", "es"]
PAGES = ["index.html", "entevyou.html", "karye.html",
         "candidats.html", "organisations.html", "egzanp.html"]


def cle_langue(source, lg, cle):
    """Lit __title ou __desc dans le dictionnaire d'une langue."""
    for anc in ("\n    %s: {" % lg, "\n      %s: {" % lg, "\n    %s: { " % lg):
        i = source.find(anc)
        if i < 0:
            continue
        # jusqu'au dictionnaire suivant
        suite = source[i + 1:]
        m = re.search(r"\n\s{2,6}(ht|fr|en|es):\s*\{", suite)
        corps = suite[:m.start()] if m else suite[:40000]
        v = re.search(cle + r':\s*"((?:[^"\\]|\\.)*)"', corps)
        if v:
            return v.group(1).replace('\\"', '"').replace("\\\\", "\\")
    return None


def variante(nom_page, lg, source):
    titre = cle_langue(source, lg, "__title")
    desc = cle_langue(source, lg, "__desc")
    if not titre or not desc:
        raise SystemExit("!! %s / %s : __title ou __desc manquant" % (nom_page, lg))

    s = source
    base_nom = nom_page[:-5]                       # « entevyou »
    moi = "%s/%s.%s.html" % (BASE, base_nom, lg)

    # 1) la langue est declaree par l'adresse, et l'attribut coupe la detection
    s = re.sub(r'<html lang="[a-z]{2}"', '<html lang="%s" data-lang-fixe' % lg, s, count=1)

    # La source porte deja ses propres alternates : on les retire avant de
    # poser ceux de la variante, sinon chaque balise existe en double et le
    # signal devient ambigu pour un moteur.
    # `  ?` exigeait une ou deux espaces : les balises sans indentation, posées
    # par regen-entevyou.py, survivaient et se retrouvaient en double.
    s = re.sub(r'[ \t]*<link rel="alternate" hreflang="[^"]*"[^>]*/>[ \t]*\n?', "", s)

    # 2) titre et description de CETTE langue
    s = re.sub(r"<title>.*?</title>", lambda m: "<title>%s</title>" % ech(titre), s, count=1, flags=re.S)
    s = re.sub(r'<meta name="description" content="[^"]*"',
               lambda m: '<meta name="description" content="%s"' % ech(desc), s, count=1)
    for prop, val in [("og:title", titre), ("og:description", desc)]:
        s = re.sub(r'<meta property="%s" content="[^"]*"' % prop,
                   lambda m, v=val: '<meta property="%s" content="%s"' % (prop, ech(v)), s, count=1)

    # 3) canonical vers soi + les quatre alternates + x-default vers la racine
    alternates = "\n".join(
        '  <link rel="alternate" hreflang="%s" href="%s/%s.%s.html" />' % (l, BASE, base_nom, l)
        for l in LANGUES)
    bloc = ('  <link rel="canonical" href="%s" />\n' % moi
            + alternates + "\n"
            + '  <link rel="alternate" hreflang="x-default" href="%s/%s" />\n' % (BASE, nom_page))
    if re.search(r'<link rel="canonical"[^>]*/>\s*\n?', s):
        s = re.sub(r'  ?<link rel="canonical"[^>]*/>\s*\n?', bloc, s, count=1)
    else:
        s = s.replace("</head>", bloc + "</head>", 1)
    s = re.sub(r'<meta property="og:url" content="[^"]*"',
               '<meta property="og:url" content="%s"' % moi, s, count=1)

    # 4) le selecteur de langue NAVIGUE : sur une adresse qui declare sa langue,
    #    changer de langue doit changer d'adresse.
    #
    # SUR LE DERNIER `</body>`, JAMAIS LE PREMIER. Le JavaScript de la page
    # contient lui-meme la chaine "</body>" — le generateur de fichier .doc
    # assemble un document HTML complet dans une chaine. Un `replace(..., 1)`
    # injectait donc le script AU MILIEU D'UNE CHAINE JAVASCRIPT : le grand
    # script ne se parsait plus, et les quatre pages par langue d'Entevyou360
    # sont restees mortes en production du 27 au 31/08/2026, sans autre symptome
    # qu'une erreur de console que personne ne lisait.
    #
    # `regen-entevyou.py` porte deja cette regle et ce commentaire pour le
    # service worker. Je ne l'ai pas reportee ici en ecrivant ce fichier.
    i = s.rfind("</body>")
    if i < 0:
        raise SystemExit("!! %s : aucun </body>" % nom_page)
    s = s[:i] + NAVIGATION % (base_nom, nom_page, lg) + s[i:]
    return s


def ech(v):
    return v.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")


NAVIGATION = """<script>/* Adresse par langue : le selecteur change d'ADRESSE, pas seulement
   d'affichage — sinon l'URL dirait une langue et la page en montrerait une autre. */
(function () {
  var sel = document.getElementById("s360-lang");
  if (!sel) return;
  var base = "%s", racine = "%s", ici = "%s";
  sel.value = ici;
  sel.addEventListener("change", function () {
    var l = sel.value;
    try { localStorage.setItem("atmart_lang", l); } catch (e) {}
    location.href = l === ici ? location.href : (base + "." + l + ".html");
  }, true);
  var r = document.getElementById("s360-vers-auto");
  if (r) r.setAttribute("href", racine);
})();
</script>
"""


def main():
    faits = 0
    for page in PAGES:
        chemin = os.path.join(RACINE, page)
        source = io.open(chemin, encoding="utf-8").read()
        for lg in LANGUES:
            sortie = os.path.join(RACINE, "%s.%s.html" % (page[:-5], lg))
            io.open(sortie, "w", encoding="utf-8", newline="").write(variante(page, lg, source))
            faits += 1
        print("  %-22s 4 langues" % page)
    print("%d variantes ecrites" % faits)


if __name__ == "__main__":
    main()
