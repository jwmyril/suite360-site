# -*- coding: utf-8 -*-
"""Régénère entevyou.html (plateforme 360.atmart.ltd) depuis Lojik360_site/swot360.html.

À relancer APRÈS toute modification de swot360.html :
    python tools/regen-entevyou.py
puis commit + push de ce repo. Transformations appliquées :
en-tête/pied neutres Suite360 (avec logo 360), suppression des scripts du site
Lojik, liens de partage -> 360.atmart.ltd, tutoriels -> URL absolue Lojik,
détection de langue + sélecteur, icônes/manifest PWA + service worker.
"""
import io, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(ROOT), "Lojik360_site", "swot360.html")
DST = os.path.join(ROOT, "entevyou.html")

HEAD_LANG = '''<script>/* lang otomatik */
(function(){var S={fr:1,ht:1,en:1,es:1},d=document.documentElement,s=null;
try{s=localStorage.getItem("atmart_lang")}catch(e){}
var l=s&&S[s]?s:null;
if(!l){var n=navigator.languages||[navigator.language||""];
for(var i=0;i<n.length;i++){var c=String(n[i]).toLowerCase().split("-")[0];
if(c==="ht"||c==="hat"){l="ht";break}if(S[c]){l=c;break}}}
d.lang=l||"ht";})();
</script>'''

# Apparence : ce bloc DOIT preceder la feuille de style, sinon eclair blanc au
# chargement puis bascule visible. Voir assets/theme.js.
HEAD_THEME = """<script>/* Theme avant le premier rendu. Ne pas differer. */
(function(){try{var v=localStorage.getItem("atmart_apparence"),
d=v==="sombre"||(v!=="clair"&&window.matchMedia&&
window.matchMedia("(prefers-color-scheme: dark)").matches);
if(v==="clair"||d)document.documentElement.setAttribute("data-theme",d?"dark":"light");
}catch(e){}})();
</script>"""

def header(active):
    def cls(p):
        if p == active:
            return 'style="color:var(--accent);text-decoration:none;font-size:0.9rem;font-weight:600"'
        return 'style="color:var(--ink);text-decoration:none;font-size:0.9rem"'
    return ('<header>\n  <nav class="nav" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.6rem">\n'
            '    <a href="index.html" class="logo"><img src="assets/brand/logo-360-96.png" alt="Suite 360" class="logo-img" />Suite<span>360</span><small id="s360-by">pa Atmart</small></a>\n'
            '    <div style="display:flex;gap:0.9rem;align-items:center;flex-wrap:wrap">\n'
            '      <a href="entevyou.html" ' + cls("entevyou") + '>Entèvyou360</a>\n'
            '      <a href="karye.html" ' + cls("karye") + '>Career360</a>\n'
            '      <select id="s360-lang" aria-label="Lang" style="background:var(--surface-2);color:var(--ink);border:1px solid rgba(255,255,255,0.25);border-radius:8px;padding:0.3rem 0.5rem;font:inherit;font-size:0.85rem">\n'
            '        <option value="en">English</option><option value="es">Español</option><option value="fr">Français</option><option value="ht">Kreyòl</option>\n'
            '      </select>\n    </div>\n  </nav>\n</header>')

FOOTER = ('<footer>\n  <div class="container">\n'
          '    <p class="footer-note">© Atmart LLC — Suite 360 · <a href="kondisyon.html" style="color:var(--ink-dim)" id="f-legal">Kondisyon · Konfidansyalite · Ranbousman</a> · <a href="mailto:sales@atmart.ltd" style="color:var(--accent)">sales@atmart.ltd</a> · '
          '<a href="https://atmart.ltd" style="color:var(--ink-dim)">atmart.ltd</a></p>\n  </div>\n</footer>')

SWITCHER = '''<script>
(function(){var BY={ht:"pa Atmart",fr:"par Atmart",en:"by Atmart",es:"por Atmart"},LEG={ht:"Kondisyon · Konfidansyalite · Ranbousman",fr:"Conditions · Confidentialité · Remboursements",en:"Terms · Privacy · Refunds",es:"Términos · Privacidad · Reembolsos"};
function by(){var l=document.documentElement.lang;var el=document.getElementById("s360-by");if(el){el.textContent=BY[l]||BY.ht;}var fl=document.getElementById("f-legal");if(fl){fl.textContent=LEG[l]||LEG.ht;}}
var sel=document.getElementById("s360-lang");if(sel){sel.value=document.documentElement.lang||"ht";
sel.addEventListener("change",function(){try{localStorage.setItem("atmart_lang",sel.value)}catch(e){}
document.documentElement.lang=sel.value;});}
new MutationObserver(by).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
by();})();
</script>'''

def cut(s, start, end, repl):
    i = s.index(start); j = s.index(end, i) + len(end)
    return s[:i] + repl + s[j:]

s = io.open(SRC, encoding="utf-8").read()
s = s.replace("<title>Entèvyou360 — vin pare pou entèvyou travay ou | Lojik360</title>",
              "<title>Entèvyou360 — vin pare pou entèvyou travay ou | Suite 360</title>")
s = cut(s, "<header>", "</header>", header("entevyou"))
s = cut(s, "<footer>", "</footer>", FOOTER)
s = s.replace('<script src="assets/script.js"></script>\n<script src="assets/i18n.js"></script>', SWITCHER)
for a, b in [
    ("https://lojik360.atmart.ltd/swot360.html", "https://360.atmart.ltd/entevyou.html"),
    ("https://lojik360.atmart.ltd/swot360.fr.html", "https://360.atmart.ltd/entevyou.html"),
    ("https://lojik360.atmart.ltd/swot360.en.html", "https://360.atmart.ltd/entevyou.html"),
    ("https://lojik360.atmart.ltd/swot360.es.html", "https://360.atmart.ltd/entevyou.html"),
    ("lojik360.atmart.ltd/swot360.html", "360.atmart.ltd/entevyou.html"),
    ('href="tutoriels/management-ia.html"', 'href="https://lojik360.atmart.ltd/tutoriels/management-ia.html"'),
    ('href="tutoriels/management-ia.en.html"', 'href="https://lojik360.atmart.ltd/tutoriels/management-ia.en.html"'),
]:
    s = s.replace(a, b)
s = s.replace('<link rel="stylesheet" href="assets/style.css?v=1" />',
              HEAD_THEME + '\n  <link rel="stylesheet" href="assets/style.css?v=3" />\n' + HEAD_LANG)
# PWA : icônes 360 + manifest + theme-color + service worker
s = s.replace('<link rel="icon" type="image/png" href="assets/brand/logo-32.png" />',
              '<link rel="icon" type="image/png" href="assets/brand/logo-360-32.png" />\n'
              '  <link rel="manifest" href="manifest.webmanifest" />\n'
              '  <link rel="canonical" href="https://360.atmart.ltd/entevyou.html" />\n'
              '  <meta property="og:url" content="https://360.atmart.ltd/entevyou.html" />\n'
              '  <meta property="og:image" content="https://360.atmart.ltd/assets/brand/icon-360-512.png" />\n'
              '  <meta name="twitter:card" content="summary" />\n'
              '  <meta name="theme-color" content="#0a1a2f" />')
# Injecter le service worker sur le DERNIER </body> uniquement : le JavaScript
# de la page contient lui-même la chaîne "</body>" (générateur de fichier .doc),
# et un replace() global casserait ce script.
_i = s.rfind("</body>")
s = s[:_i] + '<script defer src="assets/theme.js?v=2"></script>\n' \
    '<script>if("serviceWorker" in navigator){navigator.serviceWorker.register("sw.js");}</script>\n' + s[_i:]
io.open(DST, "w", encoding="utf-8", newline="").write(s)
print("entevyou.html régénéré —", len(s), "caractères")
