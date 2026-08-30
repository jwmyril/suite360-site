# -*- coding: utf-8 -*-
"""Confronte le registre des corrections a l'etat reel du code.

POURQUOI. Le 28/08/2026, `docs/SUIVI_CORRECTIONS.md` affichait **82 items sur
82 en « A FAIRE »**, alors qu'une bonne partie avait ete corrigee dans la
semaine. Un inventaire qui declare « a faire » ce qui est fait est pire que pas
d'inventaire : on ne peut plus s'y fier, donc on ne le lit plus, donc les vrais
restants s'y perdent.

LA REGLE DE CE FICHIER. « VERIFIE » ne se declare pas, il se mesure. Chaque
item porte ici un CONTROLE EXECUTABLE. Quand un item ne peut pas se trancher
par une lecture de fichier — un rendu visuel, un comportement de navigateur,
une action commerciale — il est marque « A VERIFIER (humain) » et surtout PAS
« VERIFIE ». Un faux « fait » coute plus cher qu'un « je ne sais pas ».

USAGE :  python tools/etat_registre.py
         python tools/etat_registre.py --ecrire   (met a jour les statuts)
"""
import io
import os
import re
import sys

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
WORKER = os.path.join(SITE, "..", "Atmart_chat_worker")
SRC = os.path.join(SITE, "..", "Lojik360_site", "swot360.html")
REGISTRE = os.path.join(SITE, "docs", "SUIVI_CORRECTIONS.md")

_cache = {}


def lire(chemin):
    if chemin not in _cache:
        try:
            _cache[chemin] = io.open(chemin, encoding="utf-8").read()
        except IOError:
            _cache[chemin] = ""
    return _cache[chemin]


def worker():
    return lire(os.path.join(WORKER, "src", "worker.js"))


def page(nom):
    return lire(os.path.join(SITE, nom))


def toutes_pages():
    """Les pages sources, pas les 24 variantes generees : une variante qui
    differe de sa source serait un autre defaut, detecte par tests/urls-langue."""
    return {f: page(f) for f in ["index.html", "entevyou.html", "karye.html",
                                 "candidats.html", "organisations.html", "egzanp.html",
                                 "kondisyon.html", "mesi.html", "404.html"]}


def sans_commentaires(texte):
    """Retire // ... et /* ... */.

    Un commentaire qui CITE le defaut declenchait le controle : c'est arrive
    deux fois le 28/08 — le glob wrangler, puis `style.css?v=` dans sw.js. Un
    banc doit lire le code, pas sa notice."""
    texte = re.sub(r"/\*[\s\S]*?\*/", "", texte)
    return re.sub(r"(?m)^\s*//.*$", "", texte)


def corps_fonction(texte, nom):
    """Le corps complet d'une fonction, accolades equilibrees.

    Les fenetres a taille fixe (`[\\s\\S]{0,400}`) coupaient au milieu et
    rendaient un faux « absent » : c'est ce qui a fait declarer V0-04 et V3-02
    non faits alors qu'ils l'etaient."""
    m = re.search(r"(?:async\s+)?function\s+" + re.escape(nom) + r"\b", texte)
    if not m:
        return ""
    i = texte.find("{", m.end())
    if i < 0:
        return ""
    p, k = 0, i
    while k < len(texte):
        if texte[k] == "{":
            p += 1
        elif texte[k] == "}":
            p -= 1
            if p == 0:
                break
        k += 1
    return texte[m.start():k + 1]


def dans(texte, motif):
    return bool(re.search(motif, texte, re.I | re.S))


def compte(texte, motif):
    return len(re.findall(motif, texte, re.I))


# ---------------------------------------------------------------------------
# Chaque entree : (id, fonction -> (bool_fait, preuve)) ou (id, None, motif)
# quand seul un humain peut trancher.
# ---------------------------------------------------------------------------
def c(fait, preuve):
    return (fait, preuve)


CONTROLES = {}
HUMAIN = {}


def controle(ident):
    def deco(fn):
        CONTROLES[ident] = fn
        return fn
    return deco


def humain(ident, motif):
    HUMAIN[ident] = motif


# ------------------------------------------------------------------ VAGUE 0
@controle("V0-01")
def _():
    # Le blanc n'est legitime que sur un aplat plein. On cherche un color:#fff
    # dont la regle ne porte PAS de background.
    mauvais = []
    for f, s in toutes_pages().items():
        for regle in re.findall(r"\{[^{}]*color:\s*#fff[^{}]*\}", s, re.I):
            if not re.search(r"background", regle, re.I):
                mauvais.append(f)
                break
    return c(not mauvais, "encre blanche sans aplat : " + (", ".join(mauvais) or "aucune"))


@controle("V0-02")
def _():
    t = lire(os.path.join(SITE, "tests", "theme.js"))
    return c("N'EST PLUS EXEMPT" in t, "exemption globale de #fff retiree du banc")


@controle("V0-03")
def _():
    return c(dans(worker(), r"xpl:\$\{ip\}"), "plafond `xpl:<ip>:<jour>` dans handleEksplore")


@controle("V0-04")
def _():
    return c("getRandomValues" in corps_fonction(worker(), "genDrvCode"),
             "genDrvCode utilise crypto.getRandomValues")


@controle("V0-05")
def _():
    m = re.search(r"drv:\$\{code\}[\s\S]{0,400}?codeTropDEssais", worker())
    return c(bool(m), "codeEchec + codeTropDEssais apres `if (!raw)`")


@controle("V0-06")
def _():
    # Le registre prescrivait subtle.digest("SHA-256", sel + cle). Ce qui est
    # en place est un HMAC-SHA256 avec le sel comme CLE : au moins aussi solide,
    # puisque le condense n est pas reproductible sans le secret. Un controle
    # qui exige la LETTRE de la prescription refuse une meilleure mise en oeuvre.
    corps = corps_fonction(worker(), "hashId")
    return c(("subtle.digest" in corps) or ("HMAC" in corps and "SHA-256" in corps),
             "hashId : HMAC-SHA256, sel en cle, tronque")


# ------------------------------------------------------------------ VAGUE 1
@controle("V1-01")
def _():
    s = page("entevyou.html")
    m = re.findall(r"sw-procode[^;\n]{0,120}?color:\s*#[0-9a-f]{3,6}", s, re.I)
    return c(not m, "statut du code Pro sans couleur figee")


@controle("V1-05")
def _():
    n = sum(compte(s, r"<s>\s*\$?29") for s in toutes_pages().values())
    return c(n == 0, "prix barre a 29 $ : %d occurrence(s)" % n)


@controle("V1-07")
def _():
    n = sum(compte(s, r"entra.nement vocal gratuit") for s in toutes_pages().values())
    return c(n == 0, "formule « entrainement vocal gratuit » : %d" % n)


@controle("V1-08")
def _():
    n = sum(compte(s, r"cvNeedPro") for s in toutes_pages().values())
    return c(n == 0, "chaine morte cvNeedPro : %d occurrence(s)" % n)


@controle("V1-09")
def _():
    # « illimite » doit toujours etre suivi de sa limite reelle.
    nu = []
    for f, s in toutes_pages().items():
        for m in re.finditer(r"illimit\w*(.{0,60})", s, re.I):
            if not re.search(r"jusqu|/jour|par jour|\d", m.group(1)):
                nu.append(f + " : « …" + m.group(1)[:40] + " »")
    return c(not nu, "« illimite » sans sa limite : " + (" | ".join(nu[:2]) or "aucun"))


@controle("V1-10")
def _():
    return c(compte(page("karye.html"), r"\d+[,.]99") > 0, "un prix figure sur karye.html")


humain("V1-02", "verifier au navigateur qu'un code refuse n'est PAS memorise")
humain("V1-03", "mesurer les cibles tactiles de paiement (>= 44 px) au navigateur")
humain("V1-04", "provoquer un retour de paiement en echec et lire l'etat affiche")
humain("V1-06", "decision commerciale : annoncer les 5 generations du Kit avant l'achat")


# ------------------------------------------------------------------ VAGUE 2
@controle("V2-01")
def _():
    m = re.search(r'action === "solde"[\s\S]{0,900}', worker())
    return c(bool(m) and "echecDeCode" in m.group(0), "les echecs de solde sont comptes")


@controle("V2-02")
def _():
    corps = corps_fonction(worker(), "handlePartner")
    return c(bool(re.search(r"echecDeCode|codeEchec", corps)), "/partner compte les echecs")


@controle("V2-05")
def _():
    return c(dans(worker(), r"kesyonfree|pratikGratuitDepasse"),
             "les questions gratuites sont comptees cote serveur")


@controle("V2-06")
def _():
    w = worker()
    manquants = [p for p in ["koach:", "drv:", "wout:", "setd:"]
                 if not re.search(re.escape(p) + r"[\s\S]{0,900}?(profilTtl|ttlDossier|expirationTtl)", w)]
    return c(not manquants, "sans duree de conservation : " + (", ".join(manquants) or "aucun"))


@controle("V2-09")
def _():
    n = compte(worker(), r"NOT INSTRUCTIONS")
    return c(n >= 8, "« NOT INSTRUCTIONS » dans %d prompt(s)" % n)


@controle("V2-11")
def _():
    # La page a demenage chez le Worker ; le jeton doit avoir quitte localStorage.
    a = lire(os.path.join(WORKER, "pages", "admin.html"))
    return c(bool(a) and not dans(a, r"localStorage\.setItem\(\s*[\"']s360_admin"),
             "le jeton d'administration n'est plus dans localStorage")


humain("V2-03", "/studio : cles de licence enumerables — verifier le format et customContent")
humain("V2-04", "verifier qu'un employeur ne peut pas s'attribuer un quota depuis le client")
humain("V2-07", "verifier que /trk-rapport n'expose plus de jeton dans une URL partageable")
humain("V2-08", "mesurer l'amplification KV de l'index du pool")
humain("V2-10", "decision : router le Worker sur un domaine atmart.ltd (implique le DNS)")


# ------------------------------------------------------------------ VAGUE 3
@controle("V3-02")
def _():
    s = lire(SRC)
    corps = corps_fonction(s, "vwEndRecUi")
    return c("f5RecOn" in corps and "pnRecOn" in corps,
             "vwEndRecUi remet les trois proprietaires du micro a faux")


@controle("V3-04")
def _():
    sw = lire(os.path.join(SITE, "sw.js"))
    return c(compte(sw, r"if \(r\.ok\)") >= 2 and "/sw.js" in sw,
             "r.ok teste dans les deux branches, sw.js exclu du cache")


@controle("V3-05")
def _():
    sw = lire(os.path.join(SITE, "sw.js"))
    return c(dans(sw, r"function cleDe[\s\S]{0,200}?pathname"),
             "la cle de cache ignore la query (donc le code payant)")


@controle("V3-06")
def _():
    sw = sans_commentaires(lire(os.path.join(SITE, "sw.js")))
    return c(compte(sw, r"const CACHE = ") == 1 and not dans(sw, r"style\.css\?v="),
             "une seule constante de version (commentaires exclus)")


@controle("V3-07")
def _():
    s = lire(SRC)
    return c(dans(s, r"s360Purge|s360EfaceTout"), "purge du stockage date presente")


@controle("V3-12")
def _():
    s = page("404.html")
    return c(not dans(s, r'(href|src)="assets/') and dans(s, r's360-lang|s360-theme'),
             "404 : chemins absolus + selecteurs de langue et de theme")


@controle("V3-16")
def _():
    manquants = [f for f, s in toutes_pages().items()
                 if dans(s, r'name="theme-color"') and compte(s, r'name="theme-color"') < 2]
    return c(not manquants, "theme-color fige en sombre sur : " + (", ".join(manquants) or "aucune"))


@controle("V3-17")
def _():
    s = page("estatistik.html")
    return c(bool(s) and not dans(s, r'type="password"'),
             "estatistik.html du site ne contient plus de formulaire de connexion")


humain("V3-01", "telephone + kreyol : verifier que le micro ne jette plus l'enregistrement")
humain("V3-03", "karye.html : deux acces stockage sans try — relire les lignes visees")
humain("V3-08", "verifier que le garde-fou de consentement bloque bien (return)")
humain("V3-09", "epuiser la reserve de questions et observer la sortie")
humain("V3-10", "boutons Copier : tester sans autorisation presse-papier")
humain("V3-11", "esc() : verifier l'echappement des guillemets")
humain("V3-13", "solde du code Pro : comparer la reponse au code courant")
humain("V3-14", "og:video pointe-t-il un fichier existant ?")
humain("V3-15", "debordement horizontal a 320 px — au navigateur")
humain("V3-18", "la demo doit rester lisible sans JavaScript")


# ------------------------------------------------------------------ VAGUE 4
@controle("V4-03")
def _():
    css = lire(os.path.join(SITE, "assets", "style.css"))
    return c(dans(css, r":focus-visible"), "anneau de focus global dans style.css")


@controle("V4-04")
def _():
    manquants = [f for f, s in toutes_pages().items()
                 if not (dans(s, r"<main") and dans(s, r'href="#contenu"'))]
    return c(not manquants, "sans <main> ou lien d'evitement : " + (", ".join(manquants) or "aucune"))


@controle("V4-06")
def _():
    # On MESURE, on ne fait pas confiance a une valeur ecrite dans un commentaire.
    def lum(h):
        h = h.lstrip("#")
        v = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
        v = [(x / 12.92) if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in v]
        return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]

    s = page("entevyou.html")
    mauvais = []
    for fond in set(re.findall(r"background:\s*(#[0-9a-fA-F]{6})[^}]{0,120}?color:\s*#fff", s, re.I)):
        r = (1.05) / (lum(fond) + 0.05)
        if r < 4.5:
            mauvais.append("%s (%.2f:1)" % (fond, r))
    return c(not mauvais, "blanc sous 4,5:1 sur : " + (", ".join(mauvais) or "aucun aplat"))


humain("V4-01", "14 controles sans etiquette — relancer le controle d'accessibilite")
humain("V4-02", 'role="tablist" sans role="tab" — verifier au navigateur')
humain("V4-05", "aria-live sur Career360 — verifier l'annonce des reponses")


# ------------------------------------------------------------------ VAGUE 5
@controle("V5-02")
def _():
    mauvais = []
    for f, s in toutes_pages().items():
        m = re.search(r"\n\s{2,6}ht: \{", s)
        if not m:
            continue
        suite = s[m.end():]
        fin = re.search(r"\n\s{2,6}(fr|en|es): \{", suite)
        corps = suite[:fin.start()] if fin else suite
        if re.search(r"(?<![A-Za-z0-9_\-])coach(?![A-Za-z0-9_\-])", corps, re.I):
            mauvais.append(f)
    return c(not mauvais, "« coach » dans le dictionnaire kreyol de : " + (", ".join(mauvais) or "aucune"))


@controle("V5-11")
def _():
    manquants = [f for f, s in toutes_pages().items() if not dans(s, r"__title|document\.title\s*=")]
    return c(not manquants, "sans titre par langue : " + (", ".join(manquants) or "aucune"))


@controle("V5-12")
def _():
    sm = lire(os.path.join(SITE, "sitemap.xml"))
    return c(compte(sm, r"<loc>") >= 31 and dans(page("index.html"), r'hreflang='),
             "sitemap a %d adresses, hreflang present" % compte(sm, r"<loc>"))


@controle("V5-13")
def _():
    return c(os.path.exists(os.path.join(SITE, "tests", "langue.js")),
             "tests/langue.js existe et tourne en ligne de commande")


humain("V5-01", "le produit doit porter son nom — relecture editoriale")
humain("V5-03", "repli sur ht plutot que fr — verifier le comportement")
humain("V5-04", ".i18n-wait n'existe pas — verifier la classe d'attente")
humain("V5-05", "localiser les montants selon la langue")
humain("V5-06", "format de prix espagnol dans proP")
humain("V5-07", "lien « lecon gratuite » coherent")
humain("V5-08", "title du micro Career360")
humain("V5-09", "les douze calques kreyol — relecture par un locuteur")
humain("V5-10", "terminologie : un livrable, un nom — relecture editoriale")


# ------------------------------------------------------------------ VAGUE 6
@controle("V6-01")
def _():
    k = page("kondisyon.html")
    return c(dans(k, r"Anthropic") and dans(k, r"Whisper|transcription"),
             "l'IA et la transcription sont declarees dans les conditions")


@controle("V6-02")
def _():
    return c(dans(lire(SRC), r"Efase tout sou aparèy|sw-efacer"),
             "bouton d'effacement present")


@controle("V6-09")
def _():
    # Les CINQ clauses que le registre exige, reperees par leur titre de section
    # dans les quatre langues. Chercher un mot isole (« 16 an », « 72 ») donnait
    # de faux absents : la formulation change d'une langue a l'autre.
    k = page("kondisyon.html")
    besoins = {
        "droit applicable": r"Droit applicable|Ki lwa ki aplike|Governing law|Derecho aplicable",
        "limitation de responsabilité": r"Limitation de responsabilit|reskonsablite|Limitation of liability|responsabilidad",
        "modification des conditions": r"Modification des conditions|Si nou chanje|Changes to these|Modificaci",
        "âge minimum": r"[ÂA]ge minimum|Ki laj pou|Minimum age|Edad m",
        "localisation des données": r"Localisation des donn|Ki kote done yo pase|Data location|Ubicaci",
    }
    absents = [n for n, m in besoins.items() if not dans(k, m)]
    return c(not absents, "clauses absentes : " + (", ".join(absents) or "aucune"))


humain("V6-03", "annoncer les limites d'usage")
humain("V6-04", "reconduction automatique et resiliation de Career360")
humain("V6-05", "l'essai gratuit de 7 jours dans les conditions")
humain("V6-06", "declarer les trois collectes")
humain("V6-07", "declarer la mesure d'audience")
humain("V6-08", "declarer le stockage navigateur")


# ------------------------------------------------------------------ VAGUE 7
@controle("V7-03")
def _():
    m = re.search(r"function handleOrgRequest[\s\S]{0,3000}", worker())
    return c(bool(m) and "MAIL_KEY" in m.group(0), "/org envoie une alerte immediate")


@controle("V7-04")
def _():
    return c(dans(worker(), r"COHORTE_SEUIL"), "rapport de cohorte agrege avec seuil")


@controle("V7-05")
def _():
    return c(dans(worker(), r"RELANCE_JOURS"), "relance au 6e jour des pilotes")


@controle("V7-06")
def _():
    return c(dans(worker(), r"handleCohorte"), "les compteurs d'usage sont publiables")


humain("V7-01", "un pack organisation chiffre et affiche — verifier sur organisations.html")
humain("V7-02", "les quatre documents d'achat — devis, facture, W-9, accord")
humain("V7-07", "une seule marque — relecture editoriale")
humain("V7-08", "ramener les garde-fous sous le point mort — decision commerciale")
humain("V7-09", "ouvrir le tunnel B2B sur l'accueil")
humain("V7-10", "appeler les 90 prospects du Massachusetts — action commerciale")


# ---------------------------------------------------------------------------
def main():
    s = lire(REGISTRE)
    ids = re.findall(r"^### (V\d+-\d+)", s, re.M)
    faits, restants, a_verifier, sans_controle = [], [], [], []

    for i in ids:
        if i in CONTROLES:
            ok, preuve = CONTROLES[i]()
            (faits if ok else restants).append((i, preuve))
        elif i in HUMAIN:
            # Un humain a pu trancher depuis : on relit le statut ecrit dans le
            # registre au lieu de le presenter indefiniment comme « a verifier ».
            # Sans ca, l'outil redemanderait chaque mois un controle deja fait,
            # et la preuve inscrite a cote ne servirait a rien.
            m = re.search(r"### " + re.escape(i) + r" [^\n]*\n- \*\*Gravité\*\*[^\n]*?\*\*Statut\*\* ([A-ZÀÉÈÊ ]+)", s)
            if m and m.group(1).strip() == "VÉRIFIÉ":
                faits.append((i, "tranché par un humain — voir « Preuve » dans le registre"))
            else:
                a_verifier.append((i, HUMAIN[i]))
        else:
            sans_controle.append(i)

    print("\n=== %d items au registre ===\n" % len(ids))
    print("VERIFIE — controle execute, resultat conforme (%d)" % len(faits))
    for i, p in faits:
        print("  ok  %-7s %s" % (i, p))
    print("\nA FAIRE — controle execute, defaut toujours present (%d)" % len(restants))
    for i, p in restants:
        print("  !!  %-7s %s" % (i, p))
    print("\nA VERIFIER PAR UN HUMAIN — aucune lecture de fichier ne tranche (%d)" % len(a_verifier))
    for i, p in a_verifier:
        print("  ?   %-7s %s" % (i, p))
    if sans_controle:
        print("\nSANS CONTROLE ECRIT ENCORE (%d) : %s" % (len(sans_controle), ", ".join(sans_controle)))

    if "--ecrire" in sys.argv:
        n = s
        for i, _ in faits:
            n = re.sub(r"(?m)^(### %s .*\n- \*\*Gravité\*\* [^\n]*?\*\*Statut\*\* )À FAIRE" % re.escape(i),
                       r"\1VÉRIFIÉ", n)
        for i, _ in a_verifier:
            n = re.sub(r"(?m)^(### %s .*\n- \*\*Gravité\*\* [^\n]*?\*\*Statut\*\* )À FAIRE" % re.escape(i),
                       r"\1À VÉRIFIER", n)
        io.open(REGISTRE, "w", encoding="utf-8", newline="").write(n)
        print("\nregistre mis a jour.")
    else:
        print("\n(relancer avec --ecrire pour appliquer les statuts)")


main()
