/* ===========================================================================
   Suite 360 — Studio d'entretien (module partagé)

   Entèvyou360 Pro et Career360 utilisent LE MÊME studio. Un seul fichier, pas
   deux copies : ce site a déjà payé deux fois le prix de deux copies qui
   divergent (entevyou.html contre sa source, style.css contre celui du Worker).

   ---------------------------------------------------------------------------
   CE QU'IL FAIT, EN TROIS TEMPS
     1. PRÉPARATION — on se voit, et trois contrôles sont MESURÉS : la caméra
        répond, le micro vous entend, la lumière suffit. Dire « placez-vous dans
        une pièce bien éclairée » ne sert à rien : la moitié des gens croiront
        l'être. On mesure, et on le dit.
     2. PRÊT — le coach est là, on annonce ce qui va se passer, on démarre.
     3. SÉANCE — la question est lue à voix haute, on répond, on se regarde.

   CE QU'IL NE FAIT PAS, ET C'EST UNE DÉCISION
     Aucune note sur le visage, la posture, le regard ou « la confiance ». Ces
     signaux varient d'une culture à l'autre : les noter revient à mesurer
     l'écart à une norme, sur un produit fait pour des gens que cette norme
     dessert déjà. La caméra est un miroir, pas un jury.

   LA VIDÉO NE QUITTE PAS L'APPAREIL. MediaRecorder → Blob → lecture locale.
   Seule une piste AUDIO CLONÉE peut partir pour la transcription, par le chemin
   déjà décrit aux conditions d'utilisation.

   ---------------------------------------------------------------------------
   USAGE
     Studio.ouvrir({
       etape: "1",
       titre: "Entraînement à l'entretien",
       question: "Parlez-moi de vous.",
       mots: { ... },              // dictionnaire de CETTE langue
       parler: function (txt) {},  // TTS fourni par la page
       transcrire: function (blobAudio) { return Promise<string>; },
       onFini: function ({ texte, secondes, blob }) {},
     });
   =========================================================================== */
window.Studio = (function () {
  "use strict";

  var COURT_S = 20, LONG_S = 150, MAX_S = 180;
  var LUM_MIN = 42;            // sur 255 — en dessous, le visage se devine à peine

  var flux = null, recVideo = null, recAudio = null;
  var morceaux = [], audio = [], url = null, blob = null;
  var t0 = 0, tic = null, enCours = false;
  var ctxAudio = null, analyseur = null, sondeLum = null;
  var cfg = null, scene = null, etat = "prep";

  /* Le studio porte SES PROPRES MOTS, comme le contrôle d'apparence. Les pages
     qui l'utilisent n'ont pas le même dictionnaire, et en ajouter un troisième
     multiplierait les occasions d'oublier une langue — c'est déjà arrivé
     quatre fois sur ce produit. Le kreyòl est écrit depuis le sens, pas traduit
     du français. */
  var MOTS = {
    ht: {
      prepTitre: "Gade tèt ou anvan ou kòmanse",
      deroule: "Men sa k pral pase : koach la ap li kesyon an byen fò, epi mikwo a ap louvri. Reponn tankou ou ta reponn yon moun. Vize ant 45 segond ak 2 minit.",
      prepNote: "Se pou ou wè tèt ou. Videyo a rete sou aparèy ou.",
      ckCam: "Kamera a ap mache", ckCamKo: "Nou pa jwenn kamera a",
      ckMic: "Nou tande w", ckMicKo: "Nou pa tande anyen — pale yon ti kras",
      ckLum: "Limyè a ase", ckLumKo: "Twò fè nwa — vire tèt ou bò yon fenèt oswa limen yon lanp",
      pretTitre: "Koach la la",
      videoReste: "Videyo a RETE sou aparèy ou. Li pa janm voye ban nou. Se son an sèlman ki ka pati pou transkripsyon.",
      camRefus: "Ou pa bay kamera a otorizasyon — pa gen pwoblèm, ou ka fè egzèsis la ak vwa w sèlman.",
      btnPret: "Mwen pare →", btnSansCam: "Kontinye san kamera →",
      btnDemarrer: "⏺ Kòmanse", btnStop: "⏹ Mwen fini",
      btnRefaire: "↺ Refè l", btnFini: "Fèmen", btnFermer: "Fèmen",
      mDuree: "Konbyen tan ou pale",
      mDureeCourt: "Kout anpil : anba 20 segond, ou pa gen tan bay yon egzanp.",
      mDureeLong: "Long : apre 2 minit 30, moun k ap koute w la pèdi fil la.",
      mDureeBon: "Bon longè pou yon repons nan yon entèvyou.",
      mRythme: "Vitès ou pale", mWpm: "{n} mo pa minit",
      mRythmeLent: "Ou pale dousman — sa ka vle di w ap chèche mo w yo.",
      mRythmeVite: "Ou pale vit — ralanti, moun nan bezwen tan.",
      mRythmeBon: "Bon vitès : moun nan ka swiv ou.",
      mBequilles: "Ti mo ou repete san ou pa konnen", mAucune: "Nou pa jwenn okenn — sa bèl.",
      mSansTexte: "Nou pa t ka tande tèks la; longè a rete valab.",
      pasDeNote: "Nou PA bay nòt sou figi w, rad ou, jès ou, ni sou « konfyans » ou. Bagay sa yo chanje ant yon kilti ak yon lòt epi yo pa di anyen sou travay ou.",
    },
    fr: {
      prepTitre: "Regardez-vous avant de commencer",
      deroule: "Voici ce qui va se passer : le coach lit la question à voix haute, puis le micro s'ouvre. Répondez comme vous répondriez à quelqu'un. Visez entre 45 secondes et 2 minutes.",
      prepNote: "C'est pour vous voir. La vidéo reste sur votre appareil.",
      ckCam: "La caméra fonctionne", ckCamKo: "Caméra introuvable",
      ckMic: "On vous entend", ckMicKo: "On n'entend rien — parlez un peu",
      ckLum: "La lumière suffit", ckLumKo: "Trop sombre — tournez-vous vers une fenêtre ou allumez une lampe",
      pretTitre: "Le coach est là",
      videoReste: "La vidéo RESTE sur votre appareil. Elle ne nous est jamais envoyée. Seul le son peut partir, pour la transcription.",
      camRefus: "Caméra refusée — aucun problème, l'exercice fonctionne à la voix seule.",
      btnPret: "Je suis prêt →", btnSansCam: "Continuer sans caméra →",
      btnDemarrer: "⏺ Commencer", btnStop: "⏹ J'ai fini",
      btnRefaire: "↺ Recommencer", btnFini: "Terminer", btnFermer: "Fermer",
      mDuree: "Durée de votre réponse",
      mDureeCourt: "Très court : sous 20 secondes, pas le temps d'un exemple.",
      mDureeLong: "Long : passé 2 min 30, votre interlocuteur décroche.",
      mDureeBon: "Bonne longueur pour une réponse d'entretien.",
      mRythme: "Rythme de parole", mWpm: "{n} mots par minute",
      mRythmeLent: "Vous parlez lentement — souvent le signe qu'on cherche ses mots.",
      mRythmeVite: "Vous parlez vite — ralentissez, on a besoin de temps.",
      mRythmeBon: "Bon rythme : on vous suit sans effort.",
      mBequilles: "Mots béquilles", mAucune: "Aucun repéré — c'est rare et c'est bien.",
      mSansTexte: "La parole n'a pas pu être transcrite ; la durée reste valable.",
      pasDeNote: "Nous ne notons NI votre visage, NI votre tenue, NI vos gestes, NI votre « confiance ». Ces signaux varient d'une culture à l'autre et ne disent rien de votre travail.",
    },
    en: {
      prepTitre: "Look at yourself before you start",
      deroule: "Here is what happens: the coach reads the question out loud, then the microphone opens. Answer as you would answer a person. Aim for 45 seconds to 2 minutes.",
      prepNote: "This is for you to see yourself. The video stays on your device.",
      ckCam: "The camera works", ckCamKo: "No camera found",
      ckMic: "We can hear you", ckMicKo: "We hear nothing — say a few words",
      ckLum: "There is enough light", ckLumKo: "Too dark — face a window or turn on a lamp",
      pretTitre: "Your coach is here",
      videoReste: "The video STAYS on your device. It is never sent to us. Only the sound may leave, for transcription.",
      camRefus: "Camera declined — no problem, the exercise works with voice alone.",
      btnPret: "I'm ready →", btnSansCam: "Continue without camera →",
      btnDemarrer: "⏺ Start", btnStop: "⏹ I'm done",
      btnRefaire: "↺ Try again", btnFini: "Finish", btnFermer: "Close",
      mDuree: "Length of your answer",
      mDureeCourt: "Very short: under 20 seconds there's no room for an example.",
      mDureeLong: "Long: past 2 min 30, your listener drifts.",
      mDureeBon: "Good length for an interview answer.",
      mRythme: "Speaking pace", mWpm: "{n} words per minute",
      mRythmeLent: "You're speaking slowly — often a sign of searching for words.",
      mRythmeVite: "You're speaking fast — slow down, people need time.",
      mRythmeBon: "Good pace: easy to follow.",
      mBequilles: "Filler words", mAucune: "None found — that's rare, and good.",
      mSansTexte: "Speech could not be transcribed; the timing still stands.",
      pasDeNote: "We do NOT score your face, your clothes, your gestures or your « confidence ». Those signals differ from one culture to another and say nothing about your work.",
    },
    es: {
      prepTitre: "Mírate antes de empezar",
      deroule: "Esto es lo que va a pasar: el coach lee la pregunta en voz alta y luego se abre el micrófono. Responde como le responderías a alguien. Apunta a entre 45 segundos y 2 minutos.",
      prepNote: "Es para que te veas. El video se queda en tu dispositivo.",
      ckCam: "La cámara funciona", ckCamKo: "No se encuentra la cámara",
      ckMic: "Te oímos", ckMicKo: "No oímos nada — di unas palabras",
      ckLum: "Hay suficiente luz", ckLumKo: "Demasiado oscuro — ponte frente a una ventana o enciende una lámpara",
      pretTitre: "Tu coach está aquí",
      videoReste: "El video SE QUEDA en tu dispositivo. Nunca nos llega. Solo el sonido puede salir, para la transcripción.",
      camRefus: "Cámara denegada — no pasa nada, el ejercicio funciona solo con la voz.",
      btnPret: "Estoy listo →", btnSansCam: "Seguir sin cámara →",
      btnDemarrer: "⏺ Empezar", btnStop: "⏹ Terminé",
      btnRefaire: "↺ Repetir", btnFini: "Terminar", btnFermer: "Cerrar",
      mDuree: "Duración de tu respuesta",
      mDureeCourt: "Muy corta: por debajo de 20 segundos no da tiempo a un ejemplo.",
      mDureeLong: "Larga: pasados 2 min 30, quien te escucha se desconecta.",
      mDureeBon: "Buena duración para una respuesta de entrevista.",
      mRythme: "Ritmo al hablar", mWpm: "{n} palabras por minuto",
      mRythmeLent: "Hablas despacio — suele indicar que buscas las palabras.",
      mRythmeVite: "Hablas rápido — baja el ritmo, hace falta tiempo.",
      mRythmeBon: "Buen ritmo: se te sigue sin esfuerzo.",
      mBequilles: "Muletillas", mAucune: "Ninguna encontrada — es raro, y es bueno.",
      mSansTexte: "No se pudo transcribir el audio; la duración sigue siendo válida.",
      pasDeNote: "NO puntuamos tu cara, tu ropa, tus gestos ni tu « confianza ». Esas señales cambian de una cultura a otra y no dicen nada de tu trabajo.",
    },
  };

  function $(id) { return document.getElementById(id); }
  function M(k) {
    if (cfg && cfg.mots && cfg.mots[k]) return cfg.mots[k];
    var d = MOTS[(cfg && cfg.langue) || "fr"] || MOTS.fr;
    return d[k] || MOTS.fr[k] || k;
  }
  function ech(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function mmss(s) { var m = Math.floor(s / 60), r = s % 60; return m + ":" + (r < 10 ? "0" : "") + r; }

  function dispo() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }

  /* ------------------------------------------------------------- la scène */
  function batir() {
    if (scene) return scene;
    scene = document.createElement("div");
    scene.className = "st-scene";
    scene.setAttribute("role", "dialog");
    scene.setAttribute("aria-modal", "true");
    scene.setAttribute("aria-labelledby", "st-titre");
    scene.innerHTML =
      '<div class="st-tete">'
      + '<span class="st-num" id="st-num" aria-hidden="true">1</span>'
      + '<h2 id="st-titre"></h2>'
      + '<button type="button" class="st-fermer" id="st-x">✕</button>'
      + "</div>"
      + '<div class="st-corps">'
      + '<div class="st-carte">'
      + '<h3 id="st-g-titre"></h3><p id="st-g-note"></p>'
      + '<video id="st-live" class="st-video miroir" playsinline muted autoplay></video>'
      + '<video id="st-play" class="st-video" controls playsinline hidden></video>'
      + '<ul class="st-checks" id="st-checks"></ul>'
      + "</div>"
      + '<div class="st-carte">'
      + '<h3 id="st-d-titre"></h3>'
      + '<div class="st-presence"><div class="st-orbe" id="st-orbe"></div></div>'
      + '<p class="st-question" id="st-q"></p>'
      + '<p class="st-chrono" id="st-chrono"></p>'
      + '<div class="st-actions" id="st-actions"></div>'
      + '<div class="st-mesures" id="st-mesures"></div>'
      + '<p class="st-note" id="st-note"></p>'
      + "</div></div>";
    document.body.appendChild(scene);
    $("st-x").addEventListener("click", fermer);
    // Échap ferme : une scène plein écran sans sortie au clavier est un piège.
    scene.addEventListener("keydown", function (e) { if (e.key === "Escape") fermer(); });
    return scene;
  }

  function boutons(liste) {
    var z = $("st-actions");
    z.innerHTML = "";
    liste.forEach(function (b) {
      var el = document.createElement("button");
      el.type = "button";
      el.className = "st-btn" + (b.fort ? " fort" : "");
      el.textContent = b.texte;
      if (b.off) el.disabled = true;
      el.addEventListener("click", b.action);
      z.appendChild(el);
    });
  }

  function orbe(e) { $("st-orbe").setAttribute("data-etat", e || ""); }

  /* ------------------------------------------- les trois contrôles mesurés */
  var CHECKS = [
    { id: "cam", cle: "ckCam" },
    { id: "mic", cle: "ckMic" },
    { id: "lum", cle: "ckLum" },
  ];
  function dessinerChecks(res) {
    $("st-checks").innerHTML = CHECKS.map(function (c) {
      var e = res[c.id];
      var p = e === true ? "✓" : (e === false ? "!" : "…");
      var etatAttr = e === true ? "ok" : (e === false ? "ko" : "");
      var txt = e === false ? M(c.cle + "Ko") : M(c.cle);
      return '<li data-etat="' + etatAttr + '"><span class="st-pastille">' + p + "</span>"
        + "<span>" + ech(txt) + "</span></li>";
    }).join("");
  }

  function ecouterNiveau(res) {
    // Le micro : on ne demande pas « m'entendez-vous ? », on regarde le niveau.
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctxAudio = new AC();
      var src = ctxAudio.createMediaStreamSource(flux);
      analyseur = ctxAudio.createAnalyser();
      analyseur.fftSize = 512;
      src.connect(analyseur);
      var buf = new Uint8Array(analyseur.fftSize);
      var pic = 0, tours = 0;
      var boucle = setInterval(function () {
        analyseur.getByteTimeDomainData(buf);
        var s = 0;
        for (var i = 0; i < buf.length; i++) { var v = (buf[i] - 128) / 128; s += v * v; }
        pic = Math.max(pic, Math.sqrt(s / buf.length));
        if (++tours > 24) {           // ~3 s
          clearInterval(boucle);
          res.mic = pic > 0.012;      // un souffle suffit ; on ne juge pas la voix
          dessinerChecks(res);
        }
      }, 125);
    } catch (e) { /* pas de mesure : on laisse le point en attente, jamais en faux OK */ }
  }

  function mesurerLumiere(res) {
    // Luminance moyenne d'une image réduite. Une pièce trop sombre est un vrai
    // problème, corrigeable en trente secondes — et personne ne s'en rend
    // compte sur son propre écran.
    var v = $("st-live");
    var c = document.createElement("canvas");
    c.width = 32; c.height = 24;
    sondeLum = setInterval(function () {
      if (!v.videoWidth) return;
      try {
        var g = c.getContext("2d");
        g.drawImage(v, 0, 0, c.width, c.height);
        var d = g.getImageData(0, 0, c.width, c.height).data, t = 0;
        for (var i = 0; i < d.length; i += 4) t += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        res.lum = (t / (d.length / 4)) >= LUM_MIN;
        dessinerChecks(res);
      } catch (e) { clearInterval(sondeLum); sondeLum = null; }
    }, 900);
  }

  /* --------------------------------------------------------- 1. préparation */
  function preparation() {
    etat = "prep";
    $("st-num").textContent = cfg.etape || "1";
    $("st-titre").textContent = cfg.titre || "";
    $("st-g-titre").textContent = M("prepTitre");
    $("st-g-note").textContent = M("prepNote");
    $("st-d-titre").textContent = M("pretTitre");
    // Le panneau droit ne reste pas vide : on annonce ce qui va se passer AVANT
    // que la personne appuie sur « Je suis pret ».
    $("st-q").textContent = M("deroule");
    $("st-q").style.fontWeight = "400";
    $("st-chrono").textContent = "";
    $("st-mesures").innerHTML = "";
    $("st-note").textContent = M("videoReste");
    $("st-play").hidden = true;
    $("st-live").hidden = false;
    orbe("");

    var res = { cam: null, mic: null, lum: null };
    dessinerChecks(res);
    boutons([{ texte: M("btnFermer"), action: fermer }]);

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: true,
    }).then(function (st) {
      flux = st;
      $("st-live").srcObject = st;
      res.cam = true;
      dessinerChecks(res);
      ecouterNiveau(res);
      mesurerLumiere(res);
      boutons([
        { texte: M("btnPret"), fort: true, action: pret },
        { texte: M("btnFermer"), action: fermer },
      ]);
    }).catch(function () {
      res.cam = false;
      dessinerChecks(res);
      // Un refus n'est pas une panne : c'est un choix, et la séance sans caméra
      // reste possible. On ne barre pas la route.
      $("st-note").textContent = M("camRefus");
      boutons([
        { texte: M("btnSansCam"), fort: true, action: function () { pret(true); } },
        { texte: M("btnFermer"), action: fermer },
      ]);
    });
  }

  /* -------------------------------------------------------------- 2. prêt */
  function pret(sansCam) {
    etat = "pret";
    $("st-d-titre").textContent = M("pretTitre");
    $("st-q").textContent = cfg.question || "";
    $("st-q").style.fontWeight = "600";
    $("st-note").textContent = sansCam ? M("camRefus") : M("videoReste");
    orbe("");
    boutons([
      { texte: M("btnDemarrer"), fort: true, action: function () { demarrer(sansCam); } },
      { texte: M("btnFermer"), action: fermer },
    ]);
  }

  /* ------------------------------------------------------------ 3. séance */
  function demarrer(sansCam) {
    etat = "seance";
    $("st-mesures").innerHTML = "";
    morceaux = []; audio = [];

    // Le coach lit la question : on l'entend avant d'y répondre, comme dans un
    // vrai entretien. Puis on écoute.
    orbe("parle");
    var apres = function () {
      orbe("ecoute");
      lancerEnregistrement(sansCam);
    };
    if (cfg.parler) { try { cfg.parler(cfg.question, apres); } catch (e) { apres(); } }
    else { apres(); }
    boutons([{ texte: M("btnStop"), fort: true, off: true, action: function () {} }]);
  }

  function lancerEnregistrement(sansCam) {
    if (!flux) { finir(0, sansCam); return; }
    try {
      if (!sansCam) {
        recVideo = new MediaRecorder(flux);
        recVideo.ondataavailable = function (e) { if (e.data && e.data.size) morceaux.push(e.data); };
        recVideo.onstop = function () { finir(Math.round((Date.now() - t0) / 1000), sansCam); };
      }
      var pistes = flux.getAudioTracks();
      if (pistes.length) {
        recAudio = new MediaRecorder(new MediaStream([pistes[0]]));
        recAudio.ondataavailable = function (e) { if (e.data && e.data.size) audio.push(e.data); };
        if (sansCam) recAudio.onstop = function () { finir(Math.round((Date.now() - t0) / 1000), sansCam); };
      }
    } catch (e) { return; }

    if (recVideo) recVideo.start();
    if (recAudio) recAudio.start();
    enCours = true; t0 = Date.now();
    boutons([{ texte: M("btnStop"), fort: true, action: arreter }]);
    tic = setInterval(function () {
      var s = Math.round((Date.now() - t0) / 1000);
      var c = $("st-chrono");
      c.textContent = mmss(s);
      c.setAttribute("data-alerte", s > LONG_S ? "1" : "0");
      if (s >= MAX_S) arreter();
    }, 250);
  }

  function arreter() {
    if (!enCours) return;
    enCours = false;
    if (tic) { clearInterval(tic); tic = null; }
    orbe("");
    try { if (recVideo && recVideo.state !== "inactive") recVideo.stop(); } catch (e) {}
    try { if (recAudio && recAudio.state !== "inactive") recAudio.stop(); } catch (e) {}
  }

  function finir(secondes, sansCam) {
    etat = "revue";
    if (!sansCam && morceaux.length) {
      try {
        blob = new Blob(morceaux, { type: (recVideo && recVideo.mimeType) || "video/webm" });
        url = URL.createObjectURL(blob);
        $("st-play").src = url;
        $("st-play").hidden = false;
        $("st-live").hidden = true;
      } catch (e) {}
    }
    mesures(secondes, "");
    boutons([
      { texte: M("btnRefaire"), action: function () { effacer(); pret(sansCam); } },
      { texte: M("btnFini"), fort: true, action: fermer },
    ]);

    if (audio.length && cfg.transcrire) {
      var b = new Blob(audio, { type: "audio/webm" });
      Promise.resolve(cfg.transcrire(b)).then(function (txt) {
        if (txt) {
          mesures(secondes, txt);
          if (cfg.onFini) cfg.onFini({ texte: txt, secondes: secondes, blob: blob || null });
        }
      }).catch(function () { /* la durée reste valable sans transcription */ });
    } else if (cfg.onFini) {
      cfg.onFini({ texte: "", secondes: secondes, blob: blob || null });
    }
  }

  /* ------------------------------------------------------------ mesures */
  var BEQUILLES = {
    ht: ["ee", "eee", "enben", "kidonk", "bon", "ok"],
    fr: ["euh", "heu", "hein", "en fait", "du coup", "genre", "voila", "voilà"],
    en: ["um", "uh", "like", "you know", "sort of", "kind of", "basically", "actually"],
    es: ["eh", "este", "o sea", "bueno", "digamos", "pues"],
  };

  function mesures(secondes, texte) {
    var L = [];
    var etatD = secondes < COURT_S ? "Court" : (secondes > LONG_S ? "Long" : "Bon");
    L.push([M("mDuree"), mmss(secondes), M("mDuree" + etatD)]);

    if (texte) {
      var mots = texte.trim().split(/\s+/).filter(Boolean).length;
      var wpm = Math.round(mots / (secondes / 60));
      var er = wpm < 90 ? "Lent" : (wpm > 180 ? "Vite" : "Bon");
      L.push([M("mRythme"), M("mWpm").replace("{n}", wpm), M("mRythme" + er)]);

      var liste = BEQUILLES[(cfg && cfg.langue) || "fr"] || BEQUILLES.fr;
      var n = 0, vus = [];
      var bas = " " + texte.toLowerCase().replace(/[.,;:!?]/g, " ") + " ";
      liste.forEach(function (m) {
        var c = bas.split(" " + m + " ").length - 1;
        if (c > 0) { n += c; vus.push(m + " ×" + c); }
      });
      L.push([M("mBequilles"), String(n), vus.length ? vus.join(", ") : M("mAucune")]);
    } else {
      L.push([M("mRythme"), "—", M("mSansTexte")]);
    }

    $("st-mesures").innerHTML =
      "<table>" + L.map(function (x) {
        return "<tr><td>" + ech(x[0]) + '</td><td class="v">' + ech(x[1]) + "</td></tr>"
          + '<tr class="d"><td colspan="2">' + ech(x[2]) + "</td></tr>";
      }).join("") + "</table>"
      + '<p class="st-note">' + ech(M("pasDeNote")) + "</p>";
  }

  /* ------------------------------------------------------ fermeture nette */
  function effacer() {
    try { if (url) { URL.revokeObjectURL(url); url = null; } } catch (e) {}
    blob = null; morceaux = []; audio = [];
    var p = $("st-play");
    if (p) { p.removeAttribute("src"); p.hidden = true; }
    var l = $("st-live"); if (l) l.hidden = false;
    var m = $("st-mesures"); if (m) m.innerHTML = "";
    var c = $("st-chrono"); if (c) c.textContent = "";
  }

  function rendre() {
    // LE SEUL endroit qui rend les périphériques. Un voyant qui reste allumé
    // sur ce produit est une promesse rompue.
    arreter();
    if (sondeLum) { clearInterval(sondeLum); sondeLum = null; }
    try { if (ctxAudio && ctxAudio.close) ctxAudio.close(); } catch (e) {}
    ctxAudio = null; analyseur = null;
    try { if (flux) flux.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    flux = null; recVideo = null; recAudio = null;
    var l = $("st-live");
    if (l) { try { l.srcObject = null; } catch (e) {} }
  }

  function fermer() {
    rendre();
    effacer();
    if (scene) scene.setAttribute("data-ouvert", "0");
    document.body.classList.remove("st-fige");
    if (cfg && cfg.onFerme) { try { cfg.onFerme(); } catch (e) {} }
  }

  function ouvrir(options) {
    if (!dispo()) { if (options && options.onIndispo) options.onIndispo(); return false; }
    cfg = options || {};
    batir();
    scene.setAttribute("data-ouvert", "1");
    document.body.classList.add("st-fige");
    preparation();
    $("st-x").focus();
    return true;
  }

  return { ouvrir: ouvrir, fermer: fermer, dispo: dispo, _mesures: mesures, _cfg: function (c) { cfg = c; } };
})();
