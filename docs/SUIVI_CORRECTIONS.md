# Suite 360 — registre de suivi des corrections

Issu de la revue critique du **26 août 2026** (audit multi-agents : sécurité backend,
code front, parcours réel, langue & conformité, produit & modèle).

Ce fichier est la **source de vérité machine**. La colonne `Statut` n'est mise à jour
qu'après **vérification exécutée**, jamais sur déclaration.

---

## Conventions

**Racines**

| Alias | Chemin |
|---|---|
| `$SITE` | `Power_BI_Claude\Suite360_site` |
| `$WORKER` | `Power_BI_Claude\Atmart_chat_worker` |
| `$SRC` | `Power_BI_Claude\Lojik360_site\swot360.html` |

> **RÈGLE ABSOLUE — `entevyou.html` est un fichier généré.**
> Toute modification doit être faite dans **`$SRC`** puis suivie de
> `python tools/regen-entevyou.py` depuis `$SITE`.
> Une modification faite directement dans `entevyou.html` sera écrasée sans avertissement.
> État vérifié le 26/08/2026 : régénération = 0 ligne de diff, les deux fichiers sont synchrones.

**Statuts** — `À FAIRE` · `EN COURS` · `À VÉRIFIER` (le dev annonce fini) · `PARTIEL` (une moitié faite, l'autre non) · `VÉRIFIÉ` (contrôle passé) · `REFUSÉ` (décision de ne pas faire, avec motif)

**Effort** — `XS` < 15 min · `S` < 1 h · `M` demi-journée · `L` 1–2 jours · `XL` décision ou chantier

**Gravité** — `CRITIQUE` · `ÉLEVÉ` · `MOYEN` · `FAIBLE`

---

# VAGUE 0 — Urgences

*Ce qui fait perdre de l'argent ou expose des données personnelles, maintenant.*

### V0-01 · Rendre les prix visibles en thème clair
- **Gravité** CRITIQUE — **Effort** S — **Statut** VÉRIFIÉ
- **Où** 8 pages de `$SITE` : `index.html`, `candidats.html`, `organisations.html`, `egzanp.html`, `karye.html`, `admin.html`, `estatistik.html`, `404.html`
- **Problème** `:root` nu définit `--fond:#FFFFFF` (le clair est le défaut) et aucune page ne redéfinit quoi que ce soit sous `[data-theme="light"]`. Les `color:#fff` des blocs `<style>` de page produisent du blanc sur blanc. `candidats.html` : 19 éléments sous le seuil, dont **les 3 prix**, au ratio **1,00:1**.
- **À faire** Remplacer les `color:#fff` par `color: var(--ink)`. **Deux exceptions à conserver** : `karye.html` `.ky-mic.rec` (encre sur aplat `--danger`) et `egzanp.html` `background:#fff` (le papier du CV).
- **Vérification**
  ```bash
  # 1. plus aucun color:#fff hors exceptions
  grep -n "color:#fff\|color: #fff" $SITE/*.html | grep -v "ky-mic.rec"
  # attendu : aucune ligne

  # 2. contraste mesuré en thème clair sur candidats.html
  #    (navigateur, data-theme="light") : tout texte >= 4.5:1
  ```

### V0-02 · Resserrer l'exemption du banc de thème
- **Gravité** ÉLEVÉ — **Effort** S — **Statut** VÉRIFIÉ
- **Où** `$SITE/tests/theme.js:118`
- **Problème** `EXEMPTS` exempte `#fff` globalement. C'est ce qui fait que le banc affiche « aucune couleur figée ne subsiste » alors que le thème clair est cassé. **Un test qui ne peut pas échouer ne protège rien.**
- **À faire** Restreindre l'exemption au contexte (`background:#fff`, ou `color:#fff` seulement dans une règle portant aussi `background:var(--danger|--accent)`), ou lister les sélecteurs exemptés nommément.
- **Vérification (test de mutation)** Réintroduire volontairement `color:#fff` sur `.cd-plan .price`, lancer le banc → il **doit** échouer. Puis retirer la mutation.

### V0-03 · Plafonner `/eksplore`
- **Gravité** CRITIQUE — **Effort** XS — **Statut** VÉRIFIÉ
- **Où** `$WORKER/src/worker.js:4356-4394`
- **Problème** Seule route appelant le modèle sans code d'accès, sans quota IP, sans compteur. `langue:"ht"` y force Sonnet. Budget mensuel épuisable en quelques heures depuis une seule machine, sans trace.
- **À faire** Copier le bloc de comptage KV utilisé partout ailleurs, avant l'appel au modèle.
- **Vérification**
  ```bash
  sed -n '4356,4400p' $WORKER/src/worker.js | grep -c "RATE_LIMIT"
  # attendu : >= 1
  ```

### V0-04 · `genDrvCode` → générateur cryptographique
- **Gravité** CRITIQUE — **Effort** XS — **Statut** VÉRIFIÉ
- **Où** `$WORKER/src/worker.js:3569-3575`
- **Problème** `Math.random()` — xorshift non cryptographique, état reconstructible depuis quelques sorties. Ce code est le seul justificatif d'accès au dossier d'un chauffeur (nom, téléphone, ville, nationalité, **statut d'autorisation de travail**).
- **À faire** Reprendre le motif **déjà correct ligne 2917** (`crypto.getRandomValues`).
- **Vérification**
  ```bash
  sed -n '3560,3585p' $WORKER/src/worker.js | grep -c "Math.random"   # attendu : 0
  sed -n '3560,3585p' $WORKER/src/worker.js | grep -c "getRandomValues" # attendu : >= 1
  ```

### V0-05 · `/rejistre` — plafonner les essais de code
- **Gravité** CRITIQUE — **Effort** XS — **Statut** VÉRIFIÉ
- **Où** `$WORKER/src/worker.js:3620-3626`
- **Problème** Aucun `codeEchec()` sur le 403, contrairement à `handleWout:3188` et `handleKoach:2940`. Essais illimités sur `get`, `update`, `status` et **`delete`**.
- **À faire** Ajouter les 3 lignes de `handleWout:3188-3192` après le `if (!raw)`.
- **Vérification**
  ```bash
  sed -n '3610,3670p' $WORKER/src/worker.js | grep -c "codeEchec\|echecDeCode"  # attendu : >= 1
  ```

### V0-06 · `hashId` — condensé non réversible
- **Gravité** CRITIQUE — **Effort** S — **Statut** VÉRIFIÉ
- **Où** `$WORKER/src/worker.js:3701-3705` (usages : 3826, 3835, 3846, 3861, 3891)
- **Problème** DJB2, affine sur ℤ/2³², inversible par rencontre-au-milieu en quelques secondes. L'`id` est donné gratuitement par `action:"list"` alors que nom+téléphone coûtent un crédit → un employeur payant extrait tout le pool pour un crédit.
- **À faire** `crypto.subtle.digest("SHA-256", enc(env.ANON_SALT + key))` tronqué à 12 hex.
- **Effet de bord à traiter** invalide les `st.selected` déjà en base — migrer ou accepter, mais le **décider explicitement**.
- **Vérification**
  ```bash
  grep -n "5381" $WORKER/src/worker.js          # attendu : 0
  sed -n '3695,3712p' $WORKER/src/worker.js | grep -c "subtle.digest"  # attendu : >= 1
  ```

---

# VAGUE 1 — Le moment du paiement

*Là où un client qui a sorti sa carte devient un client fâché.*

### V1-01 · Statut du code Pro : couleurs en dur → variables de thème
- **Gravité** ÉLEVÉ — **Effort** XS — **Statut** VÉRIFIÉ
- **Où** `$SRC` (puis régénérer) — recherche `#f4a261` et `#9db2c7`
- **Problème** Posées en style **inline** par le JS, donc elles écrasent les variables de thème *et persistent au changement de thème*. En clair : **1,93:1** et **2,04:1** (seuil 4,5). Votre propre commentaire dit que ce statut doit être vu « NOIR SUR BLANC, sinon une génération part sans qu'elle s'en aperçoive ».
- **À faire** `var(--danger)` / `var(--accent)` / `var(--ink-dim)` selon le cas.
- **Vérification**
  ```bash
  grep -c "#f4a261\|#9db2c7" $SRC     # attendu : 0
  ```

### V1-02 · Ne mémoriser qu'un code validé par le serveur
- **Gravité** ÉLEVÉ — **Effort** S — **Statut** VÉRIFIÉ
- **Preuve** Vérifié au navigateur le 29/08/2026 : un code refusé (PRO90-ZZZZZZZZ) n'apparaît dans AUCUNE clé de localStorage ni de sessionStorage, et la page annonce « cette génération sera gratuite ».
- **Où** `$SRC` — écriture de `localStorage.entevyou_pro`
- **Problème** Un code rejeté en 403 est enregistré quand même, re-rempli au rechargement, et le site affirme « Ce code est enregistré sur cet appareil ». Combiné à V1-01 (message invisible), la faute de frappe d'un client payant devient permanente et inexplicable.
- **À faire** N'écrire qu'après réponse serveur positive.
- **Vérification** Navigateur : saisir un code au bon format mais faux → recharger → le champ doit être **vide** et `localStorage.entevyou_pro` absent.

### V1-03 · Cibles tactiles de paiement
- **Gravité** ÉLEVÉ — **Effort** S — **Statut** VÉRIFIÉ
- **Preuve** Mesuré au navigateur le 29/08/2026, fenêtre de 375 px : 10 cibles de paiement examinées, **0 sous 44 px**.
- **Où** `$SITE/index.html` (`#e-buy`, `#e-buy90`, `#k-buy`), `$SRC` (`#ep-3`)
- **Problème** Mesuré à 375 px : `#e-buy` 147×**16**, `#k-buy` 184×**16**, `#ep-3` 80×**15**. Tous en `display:inline; padding:0`. Minimum WCAG 24×24, recommandation Apple/Google 44×44. Les CTA **gratuits** font 335×49.
- **Aggravation** `#e-buy` (9,99 $) et `#e-buy90` (19,99 $) sont **sur la même ligne**, séparés d'un point médian : deux tarifs différents à toucher côte à côte en 16 px.
- **À faire** `display:inline-block` + `padding` → hauteur ≥ 44 px ; séparer les deux tarifs sur deux lignes ou deux blocs distincts.
- **Vérification** Navigateur à 375 px : `getBoundingClientRect().height >= 44` sur les 4 sélecteurs ; les deux liens de prix n'ont plus le même `y`.

### V1-04 · Retour de paiement : état terminal
- **Gravité** MOYEN — **Effort** XS — **Statut** PARTIEL
- **Preuve** 31/08 : `grep echec` → 0. La boucle s'arrête au 60e essai sans poser d'état terminal, l'écran continue d'afficher « restez sur cette page ». **Mais** `sales@atmart.ltd` est affiché en permanence : le client n'est jamais sans recours. Reste à poser l'état terminal et l'identifiant de session.
- **Où** `$SITE/mesi.html:242-253`
- **Problème** Au 60ᵉ essai (~2 min 30) la boucle s'arrête sans poser d'état terminal : le client qui a payé voit l'horloge indéfiniment, sans message ni contact. Le `.catch` ligne 252 est aussi silencieux.
- **À faire** État `echec` avec `sales@atmart.ltd` et l'identifiant de session Stripe.
- **Vérification** `grep -n "echec\|sales@atmart" $SITE/mesi.html` → présent dans la branche de fin de boucle **et** dans le `.catch`.

### V1-05 · Retirer le prix barré à 29 $
- **Gravité** ÉLEVÉ — **Effort** XS — **Statut** VÉRIFIÉ
- **Où** `$SRC` — 4 chaînes (ht/fr/en/es)
- **Problème** Aucune page n'affiche 29 $, le lien Stripe est identique partout, le JSON-LD déclare une offre unique à 9.99. **Prix de référence non pratiqué = pratique tarifaire trompeuse** (FTC ; droit de la consommation UE si vu depuis l'Europe).
- **À faire** Supprimer `<s>29 $</s>` / `<s>$29</s>`. Si un prix de lancement a réellement existé, l'écrire en durée datée.
- **Vérification**
  ```bash
  grep -c "<s>29 \$\|<s>\$29" $SRC     # attendu : 0
  ```

### V1-06 · Annoncer les 5 générations du Kit AVANT l'achat
- **Gravité** MOYEN — **Effort** S — **Statut** À VÉRIFIER
- **Où** `$SITE/index.html`, `$SITE/candidats.html` — 4 langues
- **Problème** Le plafond n'apparaît que dans le bloc paywall, **après** l'achat. Un acheteur qui a lu « un CV adapté à CHAQUE annonce » le découvre en le heurtant.
- **Vérification** `grep -c "5 gen\|5 jenerasyon\|5 generaciones\|5 generations"` sur les deux fichiers → ≥ 4 (une par langue).

### V1-07 · Corriger « entraînement vocal gratuit » → « 1 question offerte »
- **Gravité** MOYEN — **Effort** S — **Statut** VÉRIFIÉ
- **Où** `$SITE/index.html`, `$SITE/candidats.html`, et `Atmart_business/PLAN_MARKETING_SUITE360.md`
- **Problème** Listé dans la colonne *Gratuit* sans limite, alors que `PRATIK_GRATUIT = 1` (`worker.js:1613`). **Un conseiller qui teste devant sa cohorte se fait bloquer à la deuxième question.**
- **Vérification** Lecture des colonnes Gratuit dans les 4 langues + `grep "gratuitement" $PLAN`.

### V1-08 · Déplacer le CV dans la colonne Gratuit
- **Gravité** MOYEN — **Effort** S — **Statut** VÉRIFIÉ
- **Où** `$SITE/index.html:180`, `$SITE/candidats.html:130`
- **Problème** Le CV est vendu comme fonction Pro alors que le code le donne gratuitement (`cvBtn: "📄 CV pa konpetans — GRATIS"`, 3/jour). Séquelle de la bascule « CV gratuit, entretien payant ».
- **À faire** Ligne CV en colonne Gratuit avec sa limite ; la ligne Pro décrit ce qui est réellement réservé (le CV **adapté à chaque annonce**). Supprimer aussi la chaîne morte `cvNeedPro` des 4 dictionnaires.
- **Vérification** `grep -c "cvNeedPro" $SRC` → 0 ; lecture des colonnes.

### V1-09 · « Illimité (jusqu'à 8 par jour) »
- **Gravité** FAIBLE — **Effort** XS — **Statut** VÉRIFIÉ
- **Problème** La même phrase dit illimité *et* plafonné, dans les 4 langues.

### V1-10 · Afficher le prix de Career360 sur sa propre page
- **Gravité** MOYEN — **Effort** XS — **Statut** VÉRIFIÉ
- **Où** `$SITE/karye.html`
- **Problème** **Zéro** occurrence d'un montant sur toute la page rendue. Le seul chemin vers le tarif est un lien de 14 px. Quelqu'un qui arrive par un lien partagé part sans savoir le prix.
- **Vérification** `grep -c "14,99\|14.99" $SITE/karye.html` → ≥ 4 (une par langue).

---

# VAGUE 2 — Sécurité restante

### V2-01 · `action:"solde"`, `proUse`, `proValide` → compter les échecs
- **Gravité** ÉLEVÉ — **Effort** S — **Statut** VÉRIFIÉ
- **Où** `worker.js:2668-2683`, `1396-1417`, `1423-1435`
- **Problème** Contournent `pro90Autorise` en lisant le KV directement. `solde` est un oracle riche (`{type, exp, restantJour}` ou 403), interrogeable sans limite.
- **Note** `proValide`/`proUse` reçoivent `env` mais pas `request` — 3 signatures à élargir.

### V2-02 · `/partner` — format, plafond, et codes plus longs
- **Gravité** ÉLEVÉ — **Effort** S — **Statut** VÉRIFIÉ
- **Où** `worker.js:559-582`
- **Problème** Format `PART-XXXX` = ~923 000 combinaisons, énumérables en une nuit. Chaque code trouvé livre nom du partenaire, taux de commission et **CA brut mensuel sur 12 mois**.
- **À faire** Regex de format + `echecDeCode` + allonger à 8 caractères.

### V2-03 · `/studio` — clés de licence énumérables + `customContent` non déclaré
- **Gravité** MOYEN — **Effort** S — **Statut** À FAIRE
- **Preuve** 31/08 : aucun des deux volets. `license` accepté sans regex ni borne (worker.js:4476), `echecDeCode` jamais appelé sur le 403 (4528). `customContent` toujours injecté sans « NOT INSTRUCTIONS » (curriculumBlock:195-203, rpSystem:3090).
- **Où** `worker.js:4046-4047`, `curriculumBlock:176-184`
- **Problème** Pas de format, pas de comptage. Une licence valide = 20 générations/jour à 16 000 jetons — la génération la plus chère. Et `customContent` (9 000 caractères) entre dans le prompt système **sans le `NOT INSTRUCTIONS`** présent dans les 8 autres prompts.

### V2-04 · Le quota employeur ne doit pas venir du client
- **Gravité** ÉLEVÉ — **Effort** XS — **Statut** VÉRIFIÉ
- **Preuve** 31/08 : `st.quota` se pose à la vente, valeur du client ignorée (worker.js:4211-4216). Zéro occurrence de `p.profile.quota`.
- **Où** `worker.js:3769`, `3772`
- **Problème** `{"action":"start","profile":{"quota":50}}` → 50 crédits au lieu de 5. Chaque crédit = un nom + un téléphone.
- **Vérification** `sed -n '3760,3780p' worker.js | grep -c "p.profile.quota"` → 0.

### V2-05 · Compter les questions gratuites côté serveur
- **Gravité** MOYEN — **Effort** S — **Statut** VÉRIFIÉ
- **Où** `worker.js:2451`, `2621`
- **Problème** `index` / `qIndex` viennent du navigateur. Envoyer toujours `index:0` donne une séance complète sur Sonnet sans code. Le mur payant est décoratif.
- **À faire** `kesyonfree:<IP>:<jour>` sur le modèle de `f5Quota` (1773-1782).

### V2-06 · Durée de conservation sur `koach:`, `drv:`, `wout:`, `setd:`
- **Gravité** MOYEN — **Effort** S — **Statut** VÉRIFIÉ
- **Où** `worker.js:2947`, `3196`, `3487`, `3616`, `3637`
- **Problème** `koach:` contient `st.hist`, l'historique **complet** des conversations de coaching. Un essai gratuit de 7 jours laisse la conversation en base pour toujours.
- **À faire** Réutiliser `profilTtl(st.exp)` (2292-2298, déjà testé).

### V2-07 · `/trk-rapport` en POST
- **Gravité** MOYEN — **Effort** XS — **Statut** PARTIEL
- **Preuve** 31/08 : un jeton HMAC éphémère 1 h a été ajouté (worker.js:4643-4660) — mieux que prescrit. **Mais** `trkAutorise` garde la branche héritée (4664-4665) qui accepte encore le jeton d'administration en `?token=`, et la route reste un GET (4950).
- **Où** `worker.js:4226`
- **Problème** Jeton admin en paramètre d'URL → historique du navigateur, journaux Cloudflare. Or ce jeton sert aussi de clé de signature de session et de sel d'anonymisation.

### V2-08 · Index agrégé du pool (amplification KV)
- **Gravité** MOYEN — **Effort** M — **Statut** À VÉRIFIER
- **Où** `worker.js:3707-3728`
- **Problème** Jusqu'à 9 000 lectures KV par `action:"list"`, 40 listes/jour/employeur → 360 000 lectures déclenchables. Votre commentaire ligne 4232 dit que le quota `list` a **déjà** été épuisé le 20/08 et « a cassé tout le rapport ».
- **À faire** Clé d'index unique rafraîchie par le cron existant, comme `trkcamp:` (4204).

### V2-09 · `NOT INSTRUCTIONS` sur le prompt CV
- **Gravité** FAIBLE — **Effort** XS — **Statut** VÉRIFIÉ
- **Où** `worker.js:1541-1542` — `oldCv` et `jobDesc`
- **Note** `oldCv` provient souvent d'un PDF extrait, donc d'un fichier que la personne n'a pas écrit.

### V2-10 · Router le Worker sur un domaine `atmart.ltd`
- **Gravité** ÉLEVÉ — **Effort** M — **Statut** À VÉRIFIER
- **Problème** Le front appelle `atmart-chat.atmartllc.workers.dev`. Un `workers.dev` n'appartient à aucune zone : **aucune règle WAF ou Rate Limiting de zone ne peut s'y appliquer**. Tant que ce n'est pas fait, tout plafonnement doit être applicatif.

### V2-11 · Jeton admin hors de `localStorage`
- **Gravité** MOYEN — **Effort** S — **Statut** VÉRIFIÉ
- **Où** `$SITE/admin.html:152,190` ; `$SITE/estatistik.html:81`
- **Problème** Persistant, sans expiration côté client, sous une CSP en `unsafe-inline` qui n'offre aucun confinement. `estatistik.html` écrit le `STATS_TOKEN` brut **avant** validation et ne le retire pas en cas de refus.
- **À faire** `sessionStorage` au minimum ; idéalement cookie `HttpOnly; Secure; SameSite=Strict` posé par le Worker.

---

# VAGUE 3 — Robustesse du front

### V3-01 · Le micro jette l'enregistrement (téléphone + kreyòl)
- **Gravité** ÉLEVÉ — **Effort** XS — **Statut** À VÉRIFIER
- **Où** `$SRC` — deux occurrences de `vwStopRec(true)` (correspondant à `entevyou.html:1488` et `:1802`)
- **Problème** `vwStopRec(true)` remplace `rec.onstop`, or c'est la **seule** voie de transcription sur mobile et en kreyòl. **First 5 Minutes et le Panel Simulator n'ont jamais fonctionné au micro sur téléphone.**
- **À faire** `vwStopRec(false)`. Le mode silencieux n'a de sens que pour `vwStopAll()` / `vwReset()`.
- **Vérification** `grep -c "vwStopRec(true)" $SRC` → 0 hors `vwStopAll`/`vwReset`. Puis test réel sur téléphone.

### V3-02 · Un seul propriétaire du micro
- **Gravité** ÉLEVÉ — **Effort** S — **Statut** VÉRIFIÉ
- **Où** `$SRC` — `vwEndRecUi()`
- **Problème** Ne remet que l'état de `vw-mic`. Conséquences : double clic nécessaire pour relancer ; transcription qui atterrit dans la mauvaise boîte ; et sur `sr.onend` spontané **le micro reste ouvert, la MediaStream fuit**, témoin d'enregistrement allumé.
- **À faire** `vwEndRecUi()` remet `f5RecOn` et `pnRecOn` à faux, restaure les trois libellés, remet `vwCible = vwAns`, coupe `vwMedia` et les pistes.

### V3-03 · `karye.html` — deux accès stockage sans `try`
- **Gravité** ÉLEVÉ — **Effort** XS — **Statut** VÉRIFIÉ
- **Preuve** 31/08 : audit exhaustif — 10 accès au stockage dans karye.html, **0 non gardé** ; 11/11 dans les 4 variantes de langue.
- **Où** `$SITE/karye.html:391` et `:592`
- **Problème** Les **seuls** accès non gardés du dépôt (sur 22). Si `localStorage` lève, rien de ce qui suit ne s'attache : envoi, micro, TTS, téléchargement, essai. Et comme `applyLang()` est appelé **avant**, la page s'affiche parfaitement traduite et parfaitement morte.
- **Vérification** Navigateur avec données de site bloquées → les boutons de Career360 répondent.

### V3-04 · Le service worker ne doit pas mettre les erreurs en cache
- **Gravité** ÉLEVÉ — **Effort** XS — **Statut** VÉRIFIÉ
- **Où** `$SITE/sw.js:47-49` (et la branche page)
- **Problème** Pas de test `r.ok`. Deux 404 sont **actuellement** figées dans le cache de production (`/manifest.json`, une URL inexistante). Et `/sw.js` s'y met lui-même en cache-first — amorce classique d'un worker qui ne se met plus à jour.
- **À faire** `if (r.ok && r.status < 400) c.put(...)` dans les deux branches ; exclure `sw.js` du handler comme les `.mp4` (ligne 36).

### V3-05 · Ne plus écrire les codes payants dans le CacheStorage
- **Gravité** ÉLEVÉ — **Effort** XS — **Statut** VÉRIFIÉ
- **Où** `$SITE/sw.js:42`
- **Problème** La clé inclut la query (prouvé : `style.css?v=1` et `?v=3` coexistent en production). Donc `entevyou.html?code=ENT-XXXX-YYYY` est stocké verbatim, et « Oublier » ne retire que `localStorage`.
- **À faire** `c.put(new Request(url.origin + url.pathname), cp)`. Le repli hors ligne utilise déjà `ignoreSearch:true`, rien ne casse.

### V3-06 · Une seule constante de version
- **Gravité** MOYEN — **Effort** S — **Statut** VÉRIFIÉ
- **Où** `$SITE/sw.js:5,13,14` · 11 pages · `tools/regen-entevyou.py:89,104`
- **Problème** Trois mécanismes tenus à la main sur 13 fichiers, **déjà désynchronisés** (`CORE` précharge `style.css?v=1`, les pages demandent `?v=3` ; `theme.js` absent de `CORE`). Deux de vos commits sont consacrés à ce seul problème.
- **Rappel** `caches.addAll(CORE)` est atomique : une URL en échec = service worker non installé, silencieusement.
- **Vérification** `grep -n "style.css?v=" $SITE/sw.js $SITE/*.html | awk -F'v=' '{print $2}' | sort -u` → une seule valeur.

### V3-07 · Purger le stockage daté
- **Gravité** MOYEN — **Effort** S — **Statut** VÉRIFIÉ
- **Où** `$SRC` — `f5Cle()`, `pnCle()`, `prepEcrit`
- **Problème** Une paire de clés par jour, jusqu'à 40 Ko/jour, jamais supprimées ; au bout de quelques mois `QuotaExceededError` **avalé par un `catch` vide**. L'utilisateur perd la reprise sans message, et ses réponses des mois précédents restent sur l'appareil. Le bouton « effacer » n'efface que le jour courant.
- **À faire** Balayer `localStorage` au démarrage, supprimer toute clé `^s360_(f5|pn):` d'une autre date ; signaler l'échec d'écriture.

### V3-08 · Le garde-fou de consentement doit bloquer
- **Gravité** ÉLEVÉ — **Effort** XS — **Statut** VÉRIFIÉ
- **Preuve** 31/08 : `if (!ok) { pfEtat(MSG.pfBesoinOk); return; }` (swot360.html:2042), placé avant toute construction de `profil`. Action `efase` dédiée qui n'envoie que le code.
- **Où** `$SRC` — `if (!ok) { pfEtat(MSG.pfBesoinOk); }` sans `return`
- **Problème** `MSG.pfBesoinOk` est traduit en 4 langues et **ne peut jamais être vu**. La requête part avec `optin:false` mais transporte nom, contact, ville, SWOT et CV complets.
- **À faire** Ajouter `return` ; action `efase` dédiée n'envoyant que le code.

### V3-09 · Sortie propre quand la réserve de questions est épuisée
- **Gravité** MOYEN — **Effort** S — **Statut** À FAIRE
- **Preuve** 31/08 : la branche `else` n'écrit que dans `#vw-status` ; `#vw-q` n'est jamais vidé, `vw-send` jamais désactivé, aucun bouton de reprise. L'envoi part avec `question: undefined`.
- **Où** `$SRC` — `vwSecours()`
- **Problème** Cas réel d'un abonné Pro 90 atteignant son plafond en pleine séance : « le recruteur prépare sa question… » reste à l'écran indéfiniment, `vw-send` reste actif et envoie `question: undefined`.

### V3-10 · Boutons « Copier » sans filet
- **Gravité** MOYEN — **Effort** XS — **Statut** À FAIRE
- **Preuve** 31/08 : 3 boutons nus (entevyou 3575 et 3740, mesi 243). Rejet simulé en direct → aucun message, `Uncaught (in promise) NotAllowedError`. Seul `partagerApp()` est protégé.
- **Où** `$SRC` (copier CV, copier rapport) · `$SITE/mesi.html:232` (copier le code payant)
- **Problème** Ni détection, ni `.catch`. Le bouton ne fait rien et n'affiche rien. Sur `mesi.html`, c'est par ce bouton qu'un client qui vient de payer récupère son code. Le motif correct existe déjà dans `partagerApp`.

### V3-11 · `esc()` doit échapper les guillemets
- **Gravité** MOYEN — **Effort** XS — **Statut** À FAIRE
- **Preuve** 31/08 : **le défaut a déménagé et s'est aggravé** — voir V0-09. Le fichier visé au registre n'est plus qu'une redirection.
- **Où** `$SRC` · `$SITE/estatistik.html:141`
- **Problème** Sert dans un attribut avec une valeur venue du formulaire public. Non exploitable aujourd'hui **uniquement** parce que la regex d'e-mail interdit les espaces — sécurité par accident.

### V3-12 · Chemins absolus dans la page 404
- **Gravité** MOYEN — **Effort** XS — **Statut** VÉRIFIÉ
- **Où** `$SITE/404.html`
- **Problème** Sur `/blog/xxx` : feuille de style en 404 → page sans style, logo cassé, liens produits en 404. Seul « Accueil » marche. La page qui doit rattraper un visiteur perdu est elle-même perdue.
- **À faire** `/assets/…`, `/entevyou.html`, `/karye.html`. Ajouter aussi les sélecteurs de langue et de thème.
- **Vérification** `grep -c 'href="assets\|href="entevyou\|src="assets' $SITE/404.html` → 0.

### V3-13 · Solde du code Pro : rapprocher la réponse du code courant
- **Gravité** FAIBLE — **Effort** S — **Statut** À FAIRE
- **Preuve** 31/08 : les 4 classes utilisent bien des variables de thème, mais un `style` en ligne (entevyou.html:372) fixe `color:var(--accent)` et les écrase toutes — le message d'erreur s'affiche **en vert de succès**. Le verrou anti-course reste sans jeton de requête.
- **Problème** Une réponse en vol peut peindre le solde du code A sous le code B. Couleurs figées en dur, dont `#2ec4b6` — dont `style.css:7` dit lui-même « 2,17:1 sur blanc, illisible ».

### V3-14 · `og:video` pointe un fichier inexistant
- **Gravité** FAIBLE — **Effort** XS — **Statut** À FAIRE
- **Preuve** 31/08 : `demo-entevyou360.mp4` n'existe pas ; le dossier ne contient que `demo-{ht,fr,en,es}.mp4`. Balise identique dans les 5 variantes d'index.
- **Où** `$SITE/index.html:26` — `demo-entevyou360.mp4` n'existe pas (les fichiers sont `demo-{ht,fr,en,es}.mp4`). Tout partage de l'accueil renvoie une vidéo morte.

### V3-15 · Débordement horizontal à 320 px
- **Gravité** FAIBLE — **Effort** XS — **Statut** À FAIRE
- **Preuve** 31/08 : **le registre disait VÉRIFIÉ, c'était faux.** Mesuré à 320 px : `scrollWidth 327` pour `clientWidth 320`. `minmax(min(280px,100%),1fr)` n'a jamais été appliqué (index.html:57, 128, 162). La mesure précédente avait été faite à 375 px, où il n'y a effectivement aucun débordement.
- **Où** `$SITE/index.html:47`, `:144`
- **Mesuré** `scrollWidth 327` pour `clientWidth 320`. `minmax(280px,1fr)` + 40 px de padding = 320 sans marge.
- **À faire** `minmax(min(280px, 100%), 1fr)`.

### V3-16 · `theme-color` figé en sombre
- **Gravité** FAIBLE — **Effort** XS — **Statut** VÉRIFIÉ
- En thème clair sur mobile, la barre du navigateur reste bleu nuit au-dessus d'une page blanche. Ajouter l'attribut `media`.

### V3-17 · Supprimer `estatistik.html`
- **Gravité** FAIBLE — **Effort** XS — **Statut** VÉRIFIÉ
- 153 lignes, référencée par aucune page, et **authentification plus faible** que `admin.html` pour les mêmes données. Une seconde porte, moins solide, sans usage.

### V3-18 · La démo ne doit pas dépendre entièrement du JS
- **Gravité** FAIBLE — **Effort** S — **Statut** À FAIRE
- **Preuve** 31/08 : le `<video>` servi n'a ni `src`, ni `poster`, ni `width`, ni `height` (5 variantes). Saut de mise en page mesuré : **+558 px**.
- Le `<video>` n'a ni `src`, ni `poster`, ni dimensions dans le HTML : si `atm360.js` ne charge pas, lecteur vide **et** texte figé dans un mélange kreyòl/français. Ajouter `width`/`height` supprime aussi le saut de mise en page.

---

# VAGUE 4 — Accessibilité

### V4-01 · 14 contrôles sans étiquette
- **Gravité** MOYEN — **Effort** S — **Statut** VÉRIFIÉ
- **Preuve** 31/08 : mesuré au navigateur sur les 9 pages publiques — **0 contrôle visible sans nom accessible**. `vw-ans` et `ky-input` ont un `aria-label`. Réserve de traduction traitée en V5-14.
- `entevyou` 8 (dont `vw-ans`, la zone de réponse de la pratique) · `admin` 3 (identifiant, mot de passe) · `estatistik` 2 · `karye` 1 (`ky-input`, la saisie principale)

### V4-02 · `role="tablist"` sans aucun `role="tab"`
- **Gravité** MOYEN — **Effort** S — **Statut** PARTIEL
- **Preuve** 31/08 : le correctif a **retiré** `role="tablist"` (commit 764c4af) — l'annonce de travers a bien disparu. Mais aucun motif d'onglets n'a été construit : ni `role="tab"`, ni `aria-selected`, ni `tabpanel`, ni navigation aux flèches, ni déplacement du focus. L'état actif n'est porté que par une classe CSS.
- Les panneaux n'ont pas `role="tabpanel"`, pas de navigation aux flèches, pas de déplacement du focus. **Un tablist sans tab est annoncé de travers — moins bon que pas de rôle du tout.**

### V4-03 · Anneau de focus global
- **Gravité** MOYEN — **Effort** XS — **Statut** VÉRIFIÉ
- `:focus-visible` n'existe que sur une page. Le jeton `--focus` est défini dans `style.css` et utilisé **zéro fois**. Trois `outline:none` sans remplacement.

### V4-04 · `<main>` et lien d'évitement
- **Gravité** FAIBLE — **Effort** S — **Statut** VÉRIFIÉ
- Absents des 9 pages de contenu. `index.html` n'a par ailleurs aucun `<h2>` (H1 → H3 direct) et `egzanp.html` a deux `<h1>`.

### V4-05 · `aria-live` sur Career360
- **Gravité** MOYEN — **Effort** XS — **Statut** VÉRIFIÉ
- **Preuve** 31/08 : DOM rendu — `#ky-status1` et `#ky-status2` portent `aria-live="polite"`.
- Les deux zones de statut n'en ont pas : **toutes les erreurs de Career360 sont muettes** pour un lecteur d'écran, alors qu'`entevyou.html` en compte 15.

---

### V4-06 · Blanc sur le vert d'envoi : 4,31:1
- **Gravité** MOYEN — **Effort** XS — **Statut** VÉRIFIÉ
- **Où** `$SRC` puis `$SITE/entevyou.html` : `.vw-btn.send`
- **Problème** `color:#fff` sur `background:#128c4a`. Contraste mesuré : **4,31:1**, sous le seuil AA de 4,5:1 — et `.vw-btn` est à `font-size:0.88rem` (≈ 14 px), donc du texte NORMAL, pas du grand texte.
- **Pourquoi le banc ne l'a pas vu** `tests/theme.js` exempte `#128c4a` en tant que couleur de marque. L'exemption est légitime pour le THÈME (ce n'est pas un jeton de thème), mais elle dispense aussi de MESURER. Deux bancs distincts : la cohérence de thème, et le contraste.
- **À faire** Assombrir le vert jusqu'à atteindre 4,5:1, ou déclarer le bouton en grand texte. Puis ajouter la mesure de contraste à `tests/acces.js`, pour la classe de défaut, pas pour ce cas.
- **Trouvé le** 28/08/2026, en vérifiant V0-01.

---

# VAGUE 5 — Langue

> Complétude i18n **vérifiée saine** : 11 fichiers, 4 langues, zéro clé manquante. Les défauts ci-dessous sont de contenu, pas de structure.

### V5-01 · Le produit doit porter son nom
- **Gravité** ÉLEVÉ — **Effort** XS — **Statut** PARTIEL
- **Preuve** 31/08 : la carte image est corrigée (`Entèvyou360 · pa Atmart`). **Mais** les partages fr/en/es pointent encore « sur Lojik360 », la chaîne ht traîne toujours sa traduction française finale disant « SWOT360 », et `SWOT360` compte 21 occurrences dans entevyou.html.
- **Où** `$SRC` — 4 messages de partage + la carte image (`Lojik360 · pa Atmart`)
- **Problème** « Mwen fèk fè Entèvyou360 mwen **sou Lojik360** » dans les 4 langues. Votre canal d'acquisition envoie vers un nom qui n'est pas celui de la page. La version ht traîne en plus une traduction française collée en fin de chaîne qui dit « SWOT360 ».
- **Vérification** `grep -c "Lojik360" $SRC` → 0.

### V5-02 · `coach` → `koach` en kreyòl
- **Gravité** MOYEN — **Effort** XS — **Statut** VÉRIFIÉ
- 14 occurrences `coach` contre 3 `koach` dans le seul `karye.html` ht ; idem `index.html` et `entevyou`. L'utilisateur lit les deux formes sur le même écran. **Ne pas toucher aux clés** (`docCoach`) ni aux valeurs fr/en/es.

### V5-03 · Repli sur `ht`, pas `fr`
- **Gravité** MOYEN — **Effort** XS — **Statut** À FAIRE
- **Preuve** 31/08 : `candidats.html:48`, `egzanp.html:48`, `organisations.html:50` replient encore sur `"fr"`. Résidu voisin : `karye.html:363` retombe aussi sur `fr`.
- `candidats.html:39`, `organisations.html:41`, `egzanp.html:39` replient sur `"fr"` quand les 6 autres pages replient sur `"ht"`. Un visiteur lusophone change de langue en changeant de page.

### V5-04 · `.i18n-wait` n'existe pas
- **Gravité** MOYEN — **Effort** XS — **Statut** À FAIRE
- **Preuve** 31/08 : **toujours aucune règle CSS** `.i18n-wait` dans le dépôt. La classe est posée puis retirée après 1 500 ms, sans rien masquer. Les 3 pages visées n'ont toujours pas le garde-fou.
- `karye.html:40` ajoute la classe pour masquer le rendu avant réécriture — **la règle CSS n'existe nulle part**, la classe ne masque rien. Et 3 pages n'ont même pas le garde-fou.
- **À faire** `html.i18n-wait body{visibility:hidden}` dans `style.css` + porter la ligne sur `candidats`, `organisations`, `egzanp`.

### V5-05 · Localiser les montants
- **Gravité** MOYEN — **Effort** S — **Statut** À FAIRE
- **Preuve** 31/08 : mesuré sur 4 écrans (index et candidats, en et es) — carte `9,99 $` contre bouton `$9.99`, à 478 px l'un de l'autre. Bonus : `candidats.en/es` affichent `0 $` là où index affiche « Free » / « Gratis ».
- Les montants sont des nœuds texte sans `id`, absents de la MAP. En anglais la carte affiche `9,99 $` pendant que le bouton dessous affiche `$9.99`. Idem `19,99 $`, `14,99 $`, `0 $`.

### V5-06 · Format de prix espagnol dans `proP`
- **Gravité** FAIBLE — **Effort** XS — **Statut** À FAIRE
- **Preuve** 31/08 : `swot360.html:936`, `proP` du dictionnaire `es`, écrit toujours `9,99 $` / `19,99 $` alors que les lignes 914 et 919 du même dictionnaire écrivent `$9.99` / `$19.99`.
- Toutes les autres chaînes es écrivent `$9.99` ; celle-ci écrit `9,99 $`.

### V5-07 · Lien « leçon gratuite » cohérent
- **Gravité** FAIBLE — **Effort** XS — **Statut** À FAIRE
- **Preuve** 31/08 : inchangé. La chaîne **ht** insère toujours le titre français « Management & carrière à l'ère de l'IA » dans une phrase kreyòl (swot360.html:774), et la chaîne **es** pointe vers `management-ia.en.html` (:918) en affichant le titre anglais.
- ht insère un titre français brut dans une phrase kreyòl ; es pointe vers la version `.en.html` et affiche le titre en anglais.

### V5-08 · `title` du micro Career360
- **Gravité** FAIBLE — **Effort** XS — **Statut** VÉRIFIÉ
- **Preuve** 31/08 : fait autrement que prescrit, et correctement — `kvSync()` réécrit `m.title = t.mic` (karye.html:630), appelé par `applyLang()` à l'init et sur MutationObserver.
- `karye.html:165` — `title="Répondre à voix haute"` en dur, jamais traduit, alors que la clé `t.mic` existe déjà.

### V5-09 · Les douze calques kreyòl
- **Gravité** MOYEN — **Effort** S — **Statut** À VÉRIFIER
- Dont : `jamè` → `Non, li pa fè sa` (calque de *jamais*) · `pilòt` → `esè` (en kreyòl c'est le pilote d'avion) · `feedback` → `di w sa k bon ak sa pou w ranfòse` (formule déjà employée ailleurs chez vous) · `bay ou` → `ba ou` · `demonstrasyon` → `egzanp` · `vireman` → `transfè labank`.

### V5-10 · Terminologie : un livrable, un nom
- **Gravité** FAIBLE — **Effort** S — **Statut** À FAIRE
- **Preuve** 31/08 : inchangé, et symétrique dans les 4 langues — `ATS` contre `logiciels de recrutement`, `carte SWOT` contre `Carte WhatsApp`, et « Deck » en dur partout.
- Le CV : `lojisyèl rekritman` vs `sistèm ATS`. Le livrable : `Kat WhatsApp` vs `Deck`, et « Deck » en dur dans les 4 langues alors que c'est opaque pour le public visé.

### V5-11 · `<title>` et meta description traduits
- **Gravité** MOYEN — **Effort** S — **Statut** VÉRIFIÉ
- Figés sur `index`, `entevyou`, `karye`, `mesi` — l'accueil ouvert en anglais garde un onglet et un snippet Google en kreyòl. Le mécanisme correct existe déjà sur les 4 autres pages.

### V5-12 · `hreflang` et sitemap multilingue
- **Gravité** MOYEN — **Effort** S — **Statut** VÉRIFIÉ
- Quatre langues réelles, zéro `<link rel="alternate">`, aucun signal i18n dans le sitemap. **Votre argument numéro un est invisible pour Google.**

### V5-13 · Rendre `langue-audit.js` exécutable
- **Gravité** MOYEN — **Effort** S — **Statut** VÉRIFIÉ
- Sort en erreur sous `node` (`document is not defined`). **Il n'existe donc aucun garde-fou automatisable contre les fuites de langue**, alors que la procédure exige qu'il passe avant chaque mise en ligne.
- **À faire** Le rendre exécutable sans navigateur (extraction + comparaison des tables), ou le déplacer dans `tests/navigateur/` et écrire un vrai test node à sa place.

---

# VAGUE 6 — Conformité documentaire

*Tout se joue dans `$SITE/kondisyon.html`, sauf mention contraire.*

### V6-01 · Déclarer l'IA et la transcription
- **Gravité** ÉLEVÉ — **Effort** M — **Statut** VÉRIFIÉ
- **Problème** **Zéro occurrence** de `IA`, `AI`, `entèlijans atifisyèl` ou d'un sous-traitant sur 196 lignes. Or **l'audio kreyòl quitte l'appareil** vers un service de transcription tiers. Les conditions disent « les enregistrements servent uniquement à la transcription » sans jamais dire que la voix sort du téléphone, ni vers qui.
- **Pourquoi c'est le point le plus lourd** Le produit demande à des immigrants de raconter leur parcours à voix haute.
- **À faire** Section « Entèlijans atifisyèl » nommant le fournisseur de modèle, le service de transcription, ce qui est transmis, ce qui est conservé de leur côté, et le fait que les sorties doivent être relues.

### V6-02 · Reformuler « rien n'est stocké » + bouton d'effacement
- **Gravité** ÉLEVÉ — **Effort** S — **Statut** VÉRIFIÉ
- **Problème** Promesse faite en 4 langues sur 3 pages, contredite par `s360_prep` qui écrit en **`localStorage`** le rapport complet **et** `{question, réponse, retour}`. Aucun bouton n'efface, et l'entrée d'hier n'est jamais supprimée.
- **Pourquoi c'est grave ici** `organisations.html` vend l'usage en atelier sur poste partagé : le participant suivant peut rouvrir le SWOT et les réponses orales du précédent.
- **À faire (deux volets)** (a) purger dans `prepLit()` + bouton « Efase sa ki sou aparèy sa a » ; (b) reformuler en « nous ne gardons rien **sur nos serveurs** ; ce que vous faites aujourd'hui reste sur votre appareil pour que vous puissiez continuer, et vous pouvez l'effacer ».

### V6-03 · Annoncer les limites d'usage
- **Gravité** MOYEN — **Effort** S — **Statut** PARTIEL
- **Preuve** 31/08 : SWOT (5/jour) et CV (3/jour) annoncés dans les 4 langues ✅. **Career360 : 0/4** — le plafond n'apparaît que dans le message d'erreur, et le chiffre y est faux (voir V6-11).
- Vos conditions renvoient explicitement à « la page de vente », mais 3 SWOT/jour, 3 CV/jour et **30 messages/jour pour Career360 à 14,99 $** n'y figurent nulle part. Un abonné payant découvre son plafond en le heurtant.

### V6-04 · Reconduction automatique et résiliation de Career360
- **Gravité** MOYEN — **Effort** S — **Statut** À FAIRE
- **Preuve** 31/08 : le renouvellement est réel (`invoice.paid` repousse `st.exp` de 34 jours, worker.js:878) mais n'est écrit nulle part. **Aucune procédure d'annulation n'existe** : pas de portail Stripe, pas de `cancel_at_period_end`, aucun `customer.subscription.deleted`.
- Nulle part le site n'écrit que le prélèvement se renouvelle chaque mois jusqu'à résiliation, ni **comment annuler**. Contraste frappant avec Entèvyou360 qui précise correctement « pa gen renouvèlman otomatik ».

### V6-05 · L'essai gratuit de 7 jours dans les conditions
- **Gravité** MOYEN — **Effort** XS — **Statut** À FAIRE
- **Preuve** 31/08 : `grep -i "essai|trial|esè|prueba|7 jou"` sur kondisyon.html → **0 résultat**, dans les 4 langues.
- Annoncé sur 2 pages, implémenté, **absent des conditions** : ni durée, ni échéance, ni règle « un seul par personne ». Point positif à écrire : il ne demande pas de carte, donc pas de piège.

### V6-06 · Déclarer les trois collectes
- **Gravité** MOYEN — **Effort** S — **Statut** PARTIEL
- **Preuve** 31/08 : (a) profil Pro 90 — durée donnée (90 j après échéance), contenu non énuméré ; (b) **formulaire organisations : aucune mention**, alors que le §4 affirme « aucun e-mail requis » et que le Worker conserve 1 an ; (c) témoignages — conservés **sans TTL**, ni durée ni retrait indiqués.
- Profil professionnel Pro 90 (contact, ville, SWOT, CV) · formulaire organisations (organisation, personne, e-mail, téléphone, ville) · témoignages. Les conditions affirment « aucune création de compte, aucun e-mail requis » et ne décrivent de dossier que pour Career360.

### V6-07 · Déclarer la mesure d'audience
- **Gravité** FAIBLE — **Effort** XS — **Statut** VÉRIFIÉ
- **Preuve** 31/08 : déclaration présente dans les 4 langues (kondisyon.html:162). Réserve : la phrase est inexacte sur les IP — traitée en V6-10.
- `/ev` envoie `{name, lang, src}`. C'est sobre et sans identifiant — mais le §4 laisse entendre qu'aucune mesure n'a lieu. Une ligne suffit.

### V6-08 · Déclarer le stockage navigateur
- **Gravité** FAIBLE — **Effort** XS — **Statut** À FAIRE
- **Preuve** 31/08 : une phrase générique, **aucune clé nommée**. Huit clés persistantes réellement écrites, plus `sessionStorage.s360_form`, plus le service worker.
- Sept clés persistantes + un service worker, aucune notice. Signaler en particulier `entevyou_pro` et `karye360_code` (le code d'accès reste sur l'appareil).

### V6-09 · Clauses juridiques manquantes
- **Gravité** MOYEN — **Effort** M — **Statut** VÉRIFIÉ
- Droit applicable et juridiction · limitation de responsabilité · procédure de modification des conditions · âge minimum (vous ciblez des collèges) · localisation des données et transfert international (hébergement US, utilisateurs en Haïti et dans la diaspora).

---

# VAGUE 7 — Commercial

*Rien ici n'est un bug. C'est ce qui sépare un produit d'une entreprise.*

### V7-01 · Un pack organisation chiffré et affiché
- **Gravité** ÉLEVÉ — **Effort** L — **Statut** PARTIEL
- **Preuve** 31/08 : le pack existe et est décrit dans les 4 langues (50 participants, 4 semaines, présentation, rapport anonyme). **Il manque le prix** — la FAQ renvoie toujours à l'appel.
- **Problème** `grep` sur tout le site : `facture|invoice|W-9|devis|purchase order|net 30` → **0 résultat**. La FAQ répond « nous en discutons lors de l'appel ». Les seuls boutons d'achat sont trois liens Stripe grand public. **Une organisation ne peut pas vous payer.**
- **À faire** Un seul pack — 50 codes, 12 mois, formation des conseillers, rapport de cohorte — avec un prix affiché (repère : 6–10 $ par participant et par an).
- **Note** Votre `STRATEGIE_B2B.md` a identifié ce trou le 29/07, mot pour mot.

### V7-02 · Les quatre documents d'achat
- **Gravité** ÉLEVÉ — **Effort** M — **Statut** À FAIRE
- **Preuve** 31/08 : `find` → **0 PDF** dans tout le site. Le seul fichier contenant « facture » ou « W-9 » est le registre lui-même.
- Devis type, facture type, W-9 d'Atmart LLC, accord de traitement des données signable (une demi-page suffit).

### V7-03 · Alerte e-mail immédiate sur `/org`
- **Gravité** ÉLEVÉ — **Effort** XS — **Statut** VÉRIFIÉ
- **Où** `worker.js:585`
- **Problème** Le lead B2B attend le bilan de 11 h UTC — jusqu'à 24 h. Pendant ce temps `/demande` porte votre propre commentaire : « l'e-mail part TOUT DE SUITE — une demande de licence ne doit pas attendre le bilan du lendemain. » **La bonne règle existe, appliquée au mauvais formulaire.** Le code est à copier tel quel.

### V7-04 · Trancher : « rien conservé » vs. rapport au bailleur
- **Gravité** ÉLEVÉ — **Effort** XL (décision) — **Statut** VÉRIFIÉ
- **Problème** Votre argument juridique auprès des organisations est exactement ce qu'un programme subventionné **ne peut pas accepter** : il doit prouver à son bailleur ce que chaque participant a fait. Les deux positions ne tiennent pas ensemble, et le choix décide de votre marché.
- **Sortie proposée** Un rapport de cohorte **agrégé**, conçu comme pièce justificative de subvention, sans donnée individuelle.

### V7-05 · Rendre l'essai gratuit convertible
- **Gravité** ÉLEVÉ — **Effort** M — **Statut** VÉRIFIÉ
- **Où** `worker.js:2911` — `handleKoachTrial`
- **Problème** Code généré, expiré à J+7, IP bloquée 180 jours, **sans carte, sans e-mail, sans compte**. Personne ne peut être relancé au jour 6. Votre différenciateur « san kont, san imèl » et votre conversion sont la même pièce prise par les deux bouts.
- **À décider** collecter un e-mail optionnel au démarrage de l'essai, **ou** assumer que l'essai est un outil de notoriété et non de conversion. Les deux sont défendables ; l'implicite actuel ne l'est pas.

### V7-06 · Publier les compteurs d'usage
- **Gravité** MOYEN — **Effort** S — **Statut** VÉRIFIÉ
- Le Worker les tient déjà (`ev:swot_done:*`) et `estatistik.html` les affiche en privé. **Un vrai nombre bat une page vide** face à un acheteur sceptique — et vous n'avez aujourd'hui ni client nommé, ni témoignage, ni chiffre public.

### V7-07 · Une seule marque
- **Gravité** MOYEN — **Effort** M — **Statut** À FAIRE
- **Preuve** 31/08 : **5 marques** encore présentes sur le sous-domaine (Suite 360, Atmart, Entèvyou360, Career360, Lojik360), plus « SWOT360 Deep » qui ne correspond à aucune marque annoncée. Point positif : Driver360, Arpentaj, Atelier ATM et l'Explorateur ont disparu du sous-domaine.
- Le visiteur rencontre 4 marques et 4 SKU sur un seul sous-domaine, et l'outil signe ses partages « Lojik360 » (voir V5-01). Un directeur qui vérifie le fournisseur voit la même société vendre de la préparation d'entretien, des permis de conduire, des jeux de données **et des affiches d'art**.

### V7-08 · Ramener les garde-fous sous le point mort
- **Gravité** MOYEN — **Effort** XS — **Statut** PARTIEL
- **Preuve** 31/08 : `KOACH_DAILY_MSGS` est passé de 30 à **20** (worker.js:3203) — la moitié faite, et la page ne l'a pas suivi (voir V6-11). En revanche `PRO90_DAILY` reste à **8** et aucun plafond en coût cumulé n'existe : Pro 90 jou casse toujours vers 105 générations pour 720 autorisées.
- Career360 bascule en perte vers 20 messages/jour, `KOACH_DAILY_MSGS` est réglé à **30**. Pro 90 jou casse vers 105 générations, le plafond en autorise **720**. Les marges réelles sont saines (85–90 %) : le problème est que la protection est placée au-dessus du seuil, pas le prix.

### V7-09 · Ouvrir le tunnel B2B sur l'accueil
- **Gravité** MOYEN — **Effort** M — **Statut** À VÉRIFIER
- Le hero est écrit pour le candidat ; l'acheteur est relégué dans une carte secondaire, et les bons arguments (qui existent, et sont bons) sont une page plus loin. 142 des 174 prospects sont anglophones.

### V7-10 · Appeler les 90 prospects du Massachusetts
- **Gravité** ÉLEVÉ — **Effort** L — **Statut** À VÉRIFIER
- 174 prospects vérifiés, **un** e-mail envoyé le 18/08, aucun statut « réponse », « rdv » ou « relance » dans le journal. Le script d'appel existe déjà et il est bon — il lui manque un prix (V7-01).
- **Dépend de** V7-01, V7-02, V7-03.

---

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
  `o.email` vient du formulaire public `organisations.html`, sans authentification, et la validation serveur `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` (worker.js:4577) **autorise l'apostrophe**.
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

## Journal des vérifications

| Date | Portée | Résultat |
|---|---|---|
| 2026-08-26 | Revue initiale — 5 axes | 3 CRITIQUE · 11 ÉLEVÉ · 14 MOYEN · 9 points vérifiés sains |
| 2026-08-26 | Synchronisation `$SRC` → `entevyou.html` | Régénération = 0 ligne de diff ✅ |
| 2026-08-26 | Déploiement local = origin/main = production | 4 fichiers, hash identiques ✅ |
| 2026-08-31 | Passe de contrôle sur les 40 « à vérifier » — 3 agents (code, navigateur, contenu) | 7 vérifiés · 7 partiels · 21 défauts confirmés · **3 découvertes critiques** (V0-07, V0-08, V0-09) · V3-15 rétrogradé : le registre le disait vérifié à tort |
