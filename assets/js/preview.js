/* =========================================================
   Planète HMI — Système de "hover preview" audio
   ---------------------------------------------------------
   - Preload intelligent au survol (débounce), lecture au
     survol soutenu avec repli sur clic si l'autoplay est
     bloqué, un seul extrait à la fois, fondu d'entrée/sortie.
   - Couche d'adaptateurs : Deezer (JSONP, sans clé), mock,
     et état "non configuré". Une seule interface :
         chercherExtrait({ artiste, titre }) -> Promise<Resultat>
     Resultat = { statut, urlExtrait?, titre?, artiste?, source? }
     statut ∈ "ok" | "vide" | "erreur" | "non-configure"
   - Respecte prefers-reduced-motion (anim) et Save-Data
     (pas de préchargement automatique).
   ========================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------
     CONFIGURATION
     Changer FOURNISSEUR pour basculer de source sans toucher
     à l'UI : "deezer" | "mock" | "aucun".
     --------------------------------------------------------- */
  var FOURNISSEUR = "deezer";
  var DELAI_PRELOAD = 220;   // ms avant préchargement au survol
  var DELAI_LECTURE = 130;   // ms de survol supplémentaire avant lecture
  var VOLUME_CIBLE = 0.7;
  var DUREE_FONDU = 260;     // ms

  var saveData = !!(navigator.connection && navigator.connection.saveData);

  /* =========================================================
     ADAPTATEURS
     ========================================================= */

  /* --- Utilitaire JSONP (nécessaire car l'API Deezer
         n'envoie pas d'en-têtes CORS ; elle supporte
         officiellement output=jsonp&callback=). --- */
  function jsonp(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var cb = "__hmi_jsonp_" + Math.random().toString(36).slice(2);
      var script = document.createElement("script");
      var done = false;

      var timer = setTimeout(function () {
        if (!done) { nettoyer(); reject(new Error("timeout")); }
      }, timeoutMs || 8000);

      function nettoyer() {
        done = true;
        clearTimeout(timer);
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[cb] = function (data) { nettoyer(); resolve(data); };
      script.onerror = function () { if (!done) { nettoyer(); reject(new Error("réseau")); } };
      script.src = url + (url.indexOf("?") === -1 ? "?" : "&") + "output=jsonp&callback=" + cb;
      document.head.appendChild(script);
    });
  }

  /* Normalise un nom : minuscules, sans accents ni espaces superflus.
     Permet une correspondance fiable entre le nom demandé et le nom
     renvoyé par l'API (ex. "Vwadèzil" == "Vwadezil"). */
  function normaliser(s) {
    if (!s) return "";
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  /* --- Adaptateur Deezer (extraits publics 30 s) ---
     La recherche est floue : on demande plusieurs résultats et on ne
     retient QUE ceux dont le nom d'artiste correspond exactement.
     Sinon on renvoie "vide" (mieux vaut "indisponible" qu'un mauvais
     morceau). */
  function deezerChercherExtrait(req) {
    var q = req.titre ? (req.artiste + " " + req.titre) : req.artiste;
    var url = "https://api.deezer.com/search?limit=15&q=" + encodeURIComponent(q);
    var cible = normaliser(req.artiste);
    return jsonp(url, 8000).then(function (rep) {
      var liste = (rep && rep.data) || [];
      var t = null;
      for (var i = 0; i < liste.length; i++) {
        if (liste[i].preview && normaliser(liste[i].artist && liste[i].artist.name) === cible) {
          t = liste[i]; break;
        }
      }
      if (!t) return { statut: "vide" };
      return {
        statut: "ok",
        urlExtrait: t.preview,
        titre: t.title,
        artiste: t.artist && t.artist.name,
        source: "Deezer"
      };
    }).catch(function () {
      return { statut: "erreur" };
    });
  }

  /* --- Adaptateur mock (démo hors-ligne, sans réseau) ---
         Pas d'extrait réel : renvoie un état "vide" marqué
         démo. Sert de repli sûr et de socle de test. */
  function mockChercherExtrait() {
    return Promise.resolve({ statut: "vide", source: "mock" });
  }

  /* --- État "non configuré" --- */
  function aucunFournisseur() {
    return Promise.resolve({ statut: "non-configure" });
  }

  var ADAPTATEURS = {
    deezer: deezerChercherExtrait,
    mock: mockChercherExtrait,
    aucun: aucunFournisseur
  };

  var chercherExtrait = ADAPTATEURS[FOURNISSEUR] || aucunFournisseur;

  /* Cache par artiste : évite de refaire une requête. */
  var cache = new Map();
  function chercherExtraitCache(req) {
    var cle = (req.artiste || "") + "|" + (req.titre || "");
    if (cache.has(cle)) return cache.get(cle);
    var p = chercherExtrait(req);
    cache.set(cle, p);
    return p;
  }

  /* =========================================================
     LECTEUR AUDIO PARTAGÉ (un seul extrait à la fois)
     ========================================================= */
  var audio = new Audio();
  audio.preload = "none";
  audio.crossOrigin = "anonymous";
  audio.volume = 0;

  var lecteurActif = null;   // carte en cours
  var fonduTimer = null;

  function fondu(vers, apres) {
    if (fonduTimer) { clearInterval(fonduTimer); fonduTimer = null; }
    if (reduceMotion) { audio.volume = vers; if (apres) apres(); return; }
    var depart = audio.volume;
    var t0 = performance.now();
    fonduTimer = setInterval(function () {
      var k = Math.min(1, (performance.now() - t0) / DUREE_FONDU);
      audio.volume = depart + (vers - depart) * k;
      if (k >= 1) { clearInterval(fonduTimer); fonduTimer = null; if (apres) apres(); }
    }, 16);
  }

  function arreterLecture() {
    if (!lecteurActif) return;
    var carte = lecteurActif;
    fondu(0, function () {
      audio.pause();
      try { audio.currentTime = 0; } catch (e) {}
    });
    definirEtat(carte, "pret");
    lecteurActif = null;
  }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* =========================================================
     GESTION D'UNE CARTE
     ========================================================= */
  function definirEtat(carte, etat) {
    // etats : idle | chargement | pret | lecture | indispo | non-configure
    carte.dataset.previewState = etat;
    var btn = carte.querySelector("[data-preview-toggle]");
    if (!btn) return;
    var nom = carte.getAttribute("data-preview-artist") || "l'artiste";
    if (etat === "lecture") btn.setAttribute("aria-label", "Arrêter l'extrait de " + nom);
    else if (etat === "indispo") btn.setAttribute("aria-label", "Extrait indisponible pour " + nom);
    else if (etat === "non-configure") btn.setAttribute("aria-label", "Écoute non configurée");
    else btn.setAttribute("aria-label", "Écouter un extrait de " + nom);
    btn.disabled = (etat === "indispo" || etat === "non-configure");
  }

  function jouerCarte(carte) {
    var req = { artiste: carte.getAttribute("data-preview-artist") };
    if (!req.artiste) return;

    // Coupe l'extrait précédent
    if (lecteurActif && lecteurActif !== carte) arreterLecture();

    definirEtat(carte, "chargement");
    chercherExtraitCache(req).then(function (res) {
      if (res.statut === "non-configure") { definirEtat(carte, "non-configure"); return; }
      if (res.statut !== "ok" || !res.urlExtrait) { definirEtat(carte, "indispo"); return; }

      // Si l'utilisateur a déjà quitté la carte avant la réponse, on ne lance pas.
      if (carte.dataset.previewIntent !== "1") { definirEtat(carte, "pret"); return; }

      if (audio.src !== res.urlExtrait) audio.src = res.urlExtrait;
      audio.currentTime = 0;
      audio.volume = 0;
      lecteurActif = carte;

      var p = audio.play();
      if (p && typeof p.then === "function") {
        p.then(function () {
          definirEtat(carte, "lecture");
          fondu(VOLUME_CIBLE);
        }).catch(function () {
          // Autoplay bloqué : on reste "prêt", la lecture se fera au clic.
          lecteurActif = null;
          definirEtat(carte, "pret");
        });
      } else {
        definirEtat(carte, "lecture");
        fondu(VOLUME_CIBLE);
      }
    });
  }

  function precharger(carte) {
    var req = { artiste: carte.getAttribute("data-preview-artist") };
    if (!req.artiste) return;
    if (carte.dataset.previewState === "chargement" || carte.dataset.previewState === "lecture") return;
    definirEtat(carte, "chargement");
    chercherExtraitCache(req).then(function (res) {
      if (res.statut === "ok" && res.urlExtrait) {
        // Prépare la balise pour une lecture quasi instantanée.
        if (audio.src !== res.urlExtrait && !lecteurActif) {
          audio.src = res.urlExtrait;
          audio.load();
        }
        definirEtat(carte, "pret");
      } else if (res.statut === "non-configure") {
        definirEtat(carte, "non-configure");
      } else {
        definirEtat(carte, "indispo");
      }
    });
  }

  /* =========================================================
     CÂBLAGE DES ÉVÉNEMENTS
     ========================================================= */
  function initCarte(carte) {
    var timerPreload = null;
    var timerLecture = null;

    function survolDebut() {
      carte.dataset.previewIntent = "1";
      if (saveData) return; // Économie de données : pas d'auto-préchargement
      timerPreload = setTimeout(function () { precharger(carte); }, DELAI_PRELOAD);
      timerLecture = setTimeout(function () {
        if (carte.dataset.previewIntent === "1" && lecteurActif !== carte) jouerCarte(carte);
      }, DELAI_PRELOAD + DELAI_LECTURE);
    }

    function survolFin() {
      carte.dataset.previewIntent = "0";
      clearTimeout(timerPreload);
      clearTimeout(timerLecture);
      if (lecteurActif === carte) arreterLecture();
    }

    carte.addEventListener("pointerenter", survolDebut);
    carte.addEventListener("pointerleave", survolFin);

    // Contrôle explicite (clic / clavier) — chemin accessible et
    // geste utilisateur fiable pour débloquer l'audio.
    var btn = carte.querySelector("[data-preview-toggle]");
    if (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (lecteurActif === carte) {
          arreterLecture();
        } else {
          carte.dataset.previewIntent = "1";
          jouerCarte(carte);
        }
      });
      // Focus clavier = préchargement (sans lecture auto)
      btn.addEventListener("focus", function () {
        if (!saveData) precharger(carte);
      });
    }

    definirEtat(carte, "idle");
  }

  /* Fin d'extrait -> reset visuel */
  audio.addEventListener("ended", function () {
    if (lecteurActif) { definirEtat(lecteurActif, "pret"); lecteurActif = null; }
  });
  audio.addEventListener("error", function () {
    if (lecteurActif) { definirEtat(lecteurActif, "indispo"); lecteurActif = null; }
  });

  document.addEventListener("DOMContentLoaded", function () {
    var cartes = document.querySelectorAll("[data-preview-artist]");
    cartes.forEach(initCarte);
  });
})();
