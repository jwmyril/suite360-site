#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Applique au registre les verdicts de la passe de contrôle du 31/08/2026.

Chaque statut posé ici vient d'un contrôle EXÉCUTÉ (lecture de code ciblée,
mesure au navigateur sur la production, ou test node), jamais d'une déclaration.
Script à usage unique, conservé pour que la mise à jour soit auditable.
"""
import io
import os
import re
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
REG = os.path.join(ICI, "..", "docs", "SUIVI_CORRECTIONS.md")

# id -> (statut, preuve courte)
VERDICTS = {
    # --- vérifiés ---
    "V2-04": ("VÉRIFIÉ", "31/08 : `st.quota` se pose à la vente, valeur du client ignorée (worker.js:4211-4216). Zéro occurrence de `p.profile.quota`."),
    "V3-03": ("VÉRIFIÉ", "31/08 : audit exhaustif — 10 accès au stockage dans karye.html, **0 non gardé** ; 11/11 dans les 4 variantes de langue."),
    "V3-08": ("VÉRIFIÉ", "31/08 : `if (!ok) { pfEtat(MSG.pfBesoinOk); return; }` (swot360.html:2042), placé avant toute construction de `profil`. Action `efase` dédiée qui n'envoie que le code."),
    "V5-08": ("VÉRIFIÉ", "31/08 : fait autrement que prescrit, et correctement — `kvSync()` réécrit `m.title = t.mic` (karye.html:630), appelé par `applyLang()` à l'init et sur MutationObserver."),
    "V4-01": ("VÉRIFIÉ", "31/08 : mesuré au navigateur sur les 9 pages publiques — **0 contrôle visible sans nom accessible**. `vw-ans` et `ky-input` ont un `aria-label`. Réserve de traduction traitée en V5-14."),
    "V4-05": ("VÉRIFIÉ", "31/08 : DOM rendu — `#ky-status1` et `#ky-status2` portent `aria-live=\"polite\"`."),
    "V6-07": ("VÉRIFIÉ", "31/08 : déclaration présente dans les 4 langues (kondisyon.html:162). Réserve : la phrase est inexacte sur les IP — traitée en V6-10."),

    # --- partiels ---
    "V1-04": ("PARTIEL", "31/08 : `grep echec` → 0. La boucle s'arrête au 60e essai sans poser d'état terminal, l'écran continue d'afficher « restez sur cette page ». **Mais** `sales@atmart.ltd` est affiché en permanence : le client n'est jamais sans recours. Reste à poser l'état terminal et l'identifiant de session."),
    "V2-07": ("PARTIEL", "31/08 : un jeton HMAC éphémère 1 h a été ajouté (worker.js:4643-4660) — mieux que prescrit. **Mais** `trkAutorise` garde la branche héritée (4664-4665) qui accepte encore le jeton d'administration en `?token=`, et la route reste un GET (4950)."),
    "V4-02": ("PARTIEL", "31/08 : le correctif a **retiré** `role=\"tablist\"` (commit 764c4af) — l'annonce de travers a bien disparu. Mais aucun motif d'onglets n'a été construit : ni `role=\"tab\"`, ni `aria-selected`, ni `tabpanel`, ni navigation aux flèches, ni déplacement du focus. L'état actif n'est porté que par une classe CSS."),
    "V5-01": ("PARTIEL", "31/08 : la carte image est corrigée (`Entèvyou360 · pa Atmart`). **Mais** les partages fr/en/es pointent encore « sur Lojik360 », la chaîne ht traîne toujours sa traduction française finale disant « SWOT360 », et `SWOT360` compte 21 occurrences dans entevyou.html."),
    "V6-03": ("PARTIEL", "31/08 : SWOT (5/jour) et CV (3/jour) annoncés dans les 4 langues ✅. **Career360 : 0/4** — le plafond n'apparaît que dans le message d'erreur, et le chiffre y est faux (voir V6-11)."),
    "V6-06": ("PARTIEL", "31/08 : (a) profil Pro 90 — durée donnée (90 j après échéance), contenu non énuméré ; (b) **formulaire organisations : aucune mention**, alors que le §4 affirme « aucun e-mail requis » et que le Worker conserve 1 an ; (c) témoignages — conservés **sans TTL**, ni durée ni retrait indiqués."),
    "V7-01": ("PARTIEL", "31/08 : le pack existe et est décrit dans les 4 langues (50 participants, 4 semaines, présentation, rapport anonyme). **Il manque le prix** — la FAQ renvoie toujours à l'appel."),

    # --- défauts toujours présents ---
    "V2-03": ("À FAIRE", "31/08 : aucun des deux volets. `license` accepté sans regex ni borne (worker.js:4476), `echecDeCode` jamais appelé sur le 403 (4528). `customContent` toujours injecté sans « NOT INSTRUCTIONS » (curriculumBlock:195-203, rpSystem:3090)."),
    "V3-09": ("À FAIRE", "31/08 : la branche `else` n'écrit que dans `#vw-status` ; `#vw-q` n'est jamais vidé, `vw-send` jamais désactivé, aucun bouton de reprise. L'envoi part avec `question: undefined`."),
    "V3-10": ("À FAIRE", "31/08 : 3 boutons nus (entevyou 3575 et 3740, mesi 243). Rejet simulé en direct → aucun message, `Uncaught (in promise) NotAllowedError`. Seul `partagerApp()` est protégé."),
    "V3-11": ("À FAIRE", "31/08 : **le défaut a déménagé et s'est aggravé** — voir V0-09. Le fichier visé au registre n'est plus qu'une redirection."),
    "V3-13": ("À FAIRE", "31/08 : les 4 classes utilisent bien des variables de thème, mais un `style` en ligne (entevyou.html:372) fixe `color:var(--accent)` et les écrase toutes — le message d'erreur s'affiche **en vert de succès**. Le verrou anti-course reste sans jeton de requête."),
    "V3-14": ("À FAIRE", "31/08 : `demo-entevyou360.mp4` n'existe pas ; le dossier ne contient que `demo-{ht,fr,en,es}.mp4`. Balise identique dans les 5 variantes d'index."),
    "V3-15": ("À FAIRE", "31/08 : **le registre disait VÉRIFIÉ, c'était faux.** Mesuré à 320 px : `scrollWidth 327` pour `clientWidth 320`. `minmax(min(280px,100%),1fr)` n'a jamais été appliqué (index.html:57, 128, 162). La mesure précédente avait été faite à 375 px, où il n'y a effectivement aucun débordement."),
    "V3-18": ("À FAIRE", "31/08 : le `<video>` servi n'a ni `src`, ni `poster`, ni `width`, ni `height` (5 variantes). Saut de mise en page mesuré : **+558 px**."),
    "V5-03": ("À FAIRE", "31/08 : `candidats.html:48`, `egzanp.html:48`, `organisations.html:50` replient encore sur `\"fr\"`. Résidu voisin : `karye.html:363` retombe aussi sur `fr`."),
    "V5-04": ("À FAIRE", "31/08 : **toujours aucune règle CSS** `.i18n-wait` dans le dépôt. La classe est posée puis retirée après 1 500 ms, sans rien masquer. Les 3 pages visées n'ont toujours pas le garde-fou."),
    "V5-05": ("À FAIRE", "31/08 : mesuré sur 4 écrans (index et candidats, en et es) — carte `9,99 $` contre bouton `$9.99`, à 478 px l'un de l'autre. Bonus : `candidats.en/es` affichent `0 $` là où index affiche « Free » / « Gratis »."),
    "V5-06": ("À FAIRE", "31/08 : `swot360.html:936`, `proP` du dictionnaire `es`, écrit toujours `9,99 $` / `19,99 $` alors que les lignes 914 et 919 du même dictionnaire écrivent `$9.99` / `$19.99`."),
    "V5-10": ("À FAIRE", "31/08 : inchangé, et symétrique dans les 4 langues — `ATS` contre `logiciels de recrutement`, `carte SWOT` contre `Carte WhatsApp`, et « Deck » en dur partout."),
    "V6-04": ("À FAIRE", "31/08 : le renouvellement est réel (`invoice.paid` repousse `st.exp` de 34 jours, worker.js:878) mais n'est écrit nulle part. **Aucune procédure d'annulation n'existe** : pas de portail Stripe, pas de `cancel_at_period_end`, aucun `customer.subscription.deleted`."),
    "V6-05": ("À FAIRE", "31/08 : `grep -i \"essai|trial|esè|prueba|7 jou\"` sur kondisyon.html → **0 résultat**, dans les 4 langues."),
    "V6-08": ("À FAIRE", "31/08 : une phrase générique, **aucune clé nommée**. Huit clés persistantes réellement écrites, plus `sessionStorage.s360_form`, plus le service worker."),
    "V7-02": ("À FAIRE", "31/08 : `find` → **0 PDF** dans tout le site. Le seul fichier contenant « facture » ou « W-9 » est le registre lui-même."),
    "V7-07": ("À FAIRE", "31/08 : **5 marques** encore présentes sur le sous-domaine (Suite 360, Atmart, Entèvyou360, Career360, Lojik360), plus « SWOT360 Deep » qui ne correspond à aucune marque annoncée. Point positif : Driver360, Arpentaj, Atelier ATM et l'Explorateur ont disparu du sous-domaine."),
}

NOUVEAUX = """
---

# VAGUE 0 bis — Découvertes de la passe du 31/08/2026

*Trois défauts que le registre ne pouvait pas voir : deux parce qu'ils sont nés
après l'audit, un parce que le code avait déménagé sous son critère.*

### V0-07 · `karye.html` : erreur de syntaxe bloquante en production
- **Gravité** CRITIQUE — **Effort** XS — **Statut** À FAIRE
- **Où** `$SITE/karye.html:39-43` — et les 4 variantes `karye.{fr,en,es,ht}.html`
- **Problème** La liste `var` du script de langue se termine par une **virgule ouverte**, suivie d'un commentaire puis d'un `if` :
  ```js
  (function(){var S={fr:1,ht:1,en:1,es:1},d=document.documentElement,
  /* ... */
  if(d.hasAttribute("data-lang-fixe"))return;
  s=null;try{s=localStorage.getItem("atmart_lang")}catch(e){}
  ```
  `node --check` : **`SyntaxError: Unexpected token 'if'`**. Le script entier ne se parse jamais.
  Comparer avec `index.html:44`, qui referme correctement : `d=document.documentElement,s=null;`
- **Conséquence mesurée** `/karye.html` s'affiche **en français** alors que toutes les autres pages basculent en anglais pour le même navigateur. Or `index.en.html` pointe vers `karye.html` : un visiteur anglophone qui clique « Career360 » depuis l'accueil anglais atterrit sur une page française. `window.__atmLang` n'est jamais posé, le garde-fou de langue ne s'active pas.
- **Vérification**
  ```bash
  # extraire le 1er <script> de karye.html et le passer à node
  node --check <extrait>   # attendu : aucune erreur
  ```

### V0-08 · Les conditions affichent `NaN` à la place de la section Remboursements
- **Gravité** CRITIQUE — **Effort** XS — **Statut** À FAIRE
- **Où** `$SITE/kondisyon.html` lignes **130, 174, 218, 262** — une par langue
- **Problème** `+ + '<h2>12. Ranbousman</h2>'` — le double `+` applique le **plus unaire** à une chaîne, ce qui donne `NaN`. Vérifié sous node, puis **vérifié sur le site en ligne** : la page saute de la section 11 à la section 13, et le visiteur lit le mot `NaN` là où devrait figurer le titre, suivi de la politique de remboursement devenue orpheline.
- **Pourquoi c'est grave** C'est la page légale, en production, dans les 4 langues, et c'est précisément la section qui porte l'annulation et le remboursement.
- **Vérification**
  ```bash
  grep -c "+ *+ *'" kondisyon.html          # attendu : 0
  # puis, au navigateur : document.body.innerText ne contient plus "NaN"
  # et la numérotation va de 11 à 12 à 13
  ```

### V0-09 · XSS stocké dans le tableau de bord, injectable par le formulaire public
- **Gravité** CRITIQUE — **Effort** XS — **Statut** À FAIRE
- **Où** `$WORKER/../pages/estatistik.html:92` (la fonction) et `:188` (l'usage). Même `esc()` dans `pages/admin.html:164`.
- **Problème** `esc()` passe par `textContent → innerHTML` : cela échappe `&`, `<`, `>` mais **jamais les guillemets**. Ligne 188, le résultat est écrit **dans un attribut à guillemets simples** :
  ```js
  "<a href='mailto:" + esc(o.email) + "' style='color:var(--accent)'>"
  ```
  `o.email` vient du formulaire public `organisations.html`, sans authentification, et la validation serveur `EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/` (worker.js:4577) **autorise l'apostrophe**.
- **Preuve exécutée le 31/08** dans un vrai moteur de rendu, avec la charge `x'onmouseover='...@evil.co` :
  ```
  passe EMAIL_RE : true
  attributs réellement créés :
    href        = mailto:x
    onmouseover = ...
    style       = color:teal
  ```
  Le navigateur crée bien un attribut événementiel exécutable. Le JavaScript s'exécute dans la session d'administration au survol de la demande — et le jeton de session de cette page vit dans `sessionStorage` (commentaire ligne 94), donc lisible par ce JavaScript.
- **À faire** Échapper `"` et `'` dans `esc()`, ou poser l'adresse via `encodeURIComponent` dans un attribut à guillemets doubles.
- **Note de méthode** Cet item remplace `V3-11` : son critère pointait `$SITE/estatistik.html:141`, fichier devenu une simple redirection quand l'administration a quitté GitHub Pages (commit `4ee3bad`). **Un critère de vérification ancré sur un chemin de fichier devient aveugle dès que le code déménage.**
- **Vérification**
  ```bash
  grep -n "function esc" $WORKER/../pages/estatistik.html   # doit échapper " et '
  ```

---

# Compléments du 31/08/2026

### V5-14 · Les noms accessibles ne suivent pas la langue
- **Gravité** MOYEN — **Effort** S — **Statut** À FAIRE
- **Où** `vw-ans` (entevyou, `aria-label` en kreyòl) · `ky-input` (karye, `aria-label` en kreyòl et `placeholder` en français) — **dans les 5 variantes de chaque page**
- **Problème** V4-01 est tenu au sens strict : chaque contrôle a un nom accessible. Mais ce nom est figé, identique dans les 4 langues. Un lecteur d'écran anglophone sur la page anglaise entend du kreyòl. Même famille que V5-08.

### V6-10 · Les conditions affirment ne conserver aucune adresse IP — c'est inexact
- **Gravité** ÉLEVÉ — **Effort** XS — **Statut** À FAIRE
- **Où** `$SITE/kondisyon.html:162` contre `$WORKER/src/worker.js:452`
- **Problème** La clause dit « sans conserver aucune adresse IP ». Le code écrit la clé `evip:${CF-Connecting-IP}:${jour}` avec `EV_TTL = 34 560 000`, soit **400 jours**. L'adresse est donc conservée en clair, comme clé, pendant plus d'un an.
- **À faire** Le compteur est **journalier** : un TTL de 400 jours n'a aucune utilité. Hacher l'IP (HMAC salé) ou ramener le TTL à 2 jours — l'un ou l'autre règle à la fois l'inexactitude et un stockage inutile. Sinon, corriger la phrase.

### V6-11 · Career360 promet 30 messages par jour, le code en applique 20
- **Gravité** ÉLEVÉ — **Effort** XS — **Statut** À FAIRE
- **Où** `$SITE/karye.html` lignes 250, 281, 312, 343 (les 4 langues) contre `$WORKER/src/worker.js:3203`
- **Problème** `KOACH_DAILY_MSGS` est passé à **20** — c'était exactement la demande de V7-08, ramener le garde-fou sous le point mort. **La page n'a pas suivi.** Un abonné à 14,99 $/mois est coupé à 20 par un message qui lui annonce 30.
- **Leçon** Le chiffre vit à deux endroits sans lien entre eux. Toute correction d'un plafond doit balayer les pages qui l'annoncent.

### V3-19 · La CSP bloque la mesure d'audience Cloudflare sur chaque page
- **Gravité** FAIBLE — **Effort** XS — **Statut** À FAIRE
- **Problème** 9 chargements propres → 9 erreurs identiques : `beacon.min.js` de Cloudflare Insights est injecté par la zone et refusé par `script-src 'self' 'unsafe-inline'`. Sans effet fonctionnel, mais la mesure ne remonte rien **et le bruit masque les vraies erreurs de console** — c'est ce qui a permis à V0-07 de passer inaperçu.
- **À faire** Autoriser l'hôte dans la CSP, ou désactiver Web Analytics dans la zone. Ne pas laisser une erreur permanente dans la console.

### V7-11 · L'adresse de vente dépend de JavaScript
- **Gravité** FAIBLE — **Effort** XS — **Statut** À FAIRE
- **Problème** Cloudflare masque les adresses e-mail sur 6 pages (10 adresses) : sans JavaScript, `sales@atmart.ltd` s'affiche `[email protected]`. Bénin en soi — sauf que cette adresse est aujourd'hui **le seul chemin par lequel une organisation peut acheter**, tant que V7-01 et V7-02 sont ouverts.
- **À faire** Décider : désactiver l'obfuscation dans la zone, ou afficher l'adresse aussi en texte non cliquable.
"""


def maj(texte):
    modifies = []
    for ident, (statut, preuve) in VERDICTS.items():
        # remplace la ligne de statut de l'item
        motif = re.compile(
            r"(### " + re.escape(ident) + r" ·[^\n]*\n- \*\*Gravité\*\* [^\n]*?\*\*Statut\*\* )([^\n]+)"
        )
        if not motif.search(texte):
            print("  !! introuvable :", ident)
            continue
        texte = motif.sub(lambda m: m.group(1) + statut, texte, count=1)

        # insère / remplace la ligne de preuve juste après le statut
        anc = re.compile(
            r"(### " + re.escape(ident) + r" ·[^\n]*\n- \*\*Gravité\*\*[^\n]*\n)(- \*\*Preuve\*\*[^\n]*\n)?"
        )
        texte = anc.sub(lambda m: m.group(1) + "- **Preuve** " + preuve + "\n", texte, count=1)
        modifies.append(ident)
    return texte, modifies


def main():
    with io.open(REG, encoding="utf-8") as f:
        t = f.read()

    t, modifies = maj(t)

    if "VAGUE 0 bis" not in t:
        marque = "\n## Journal des vérifications"
        if marque in t:
            t = t.replace(marque, NOUVEAUX + marque, 1)
        else:
            t += NOUVEAUX

    ligne = ("| 2026-08-31 | Passe de contrôle sur les 40 « à vérifier » — 3 agents "
             "(code, navigateur, contenu) | 7 vérifiés · 7 partiels · 21 défauts confirmés · "
             "**3 découvertes critiques** (V0-07, V0-08, V0-09) · V3-15 rétrogradé : le registre "
             "le disait vérifié à tort |\n")
    if "2026-08-31" not in t:
        t = t.rstrip("\n") + "\n" + ligne

    with io.open(REG, "w", encoding="utf-8") as f:
        f.write(t)

    print("Items mis à jour :", len(modifies))
    print(", ".join(sorted(modifies)))


if __name__ == "__main__":
    main()
