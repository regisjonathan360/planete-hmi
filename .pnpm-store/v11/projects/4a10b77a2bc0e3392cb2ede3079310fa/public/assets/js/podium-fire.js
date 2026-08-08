/* =========================================================
   Planète HMI — Podium en feu
   ---------------------------------------------------------
   1. Révélation : à l'entrée du podium dans le viewport, une
      explosion de flammes le dévoile, puis les flammes
      s'éteignent.
   2. Survol : la carte survolée (celle dont l'extrait audio
      se lance) s'embrase seule — les autres restent froides,
      c'est le `:hover` du CSS qui s'en charge.

   Le markup des flammes est injecté ici, et non écrit en dur,
   pour rester synchronisé entre le podium de démo
   (static-pages/index.html) et le podium dynamique
   (src/lib/home/podium-html.ts).

   Palette par place — voir « PODIUM EN FEU » dans style.css :
     1re place -> bleutée, 2e -> blanc/jaune, 3e -> orange/rouge.
   ========================================================= */
(function () {
  "use strict";

  var LANGUES = 9;               // langues de flamme par carte
  var BRAISES = 26;              // braises projetées par l'explosion
  var DUREE_EXPLOSION = 2000;    // ms : doit couvrir la plus longue animation

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function creer(tag, classe) {
    var noeud = document.createElement(tag);
    if (classe) noeud.className = classe;
    return noeud;
  }

  function alea(min, max) {
    return min + Math.random() * (max - min);
  }

  /* ---------------------------------------------------------
     Couche de flammes d'une carte (embrasement au survol)
     --------------------------------------------------------- */
  function creerFlammes() {
    var couche = creer("span", "podium-fire");
    couche.setAttribute("aria-hidden", "true");

    couche.appendChild(creer("span", "podium-fire__glow"));

    var corps = creer("span", "podium-fire__body");
    for (var i = 0; i < LANGUES; i++) {
      var langue = creer("i");
      // Réparties sur toute la largeur ; plus hautes sur les bords pour que
      // le feu enveloppe la carte au lieu de masquer la photo.
      var x = ((i + 0.5) / LANGUES) * 100 + alea(-3.5, 3.5);
      var bord = Math.abs(x - 50) / 50; // 0 au centre, 1 aux extrémités
      langue.style.setProperty("--x", x.toFixed(2) + "%");
      langue.style.setProperty("--w", alea(22, 40).toFixed(1) + "%");
      langue.style.setProperty("--h", (44 + bord * 44 + alea(-8, 12)).toFixed(1) + "%");
      langue.style.setProperty("--d", Math.round(alea(900, 1600)) + "ms");
      // Délai négatif : chaque langue démarre à un point différent du cycle,
      // sinon les neuf battent à l'unisson et l'effet devient mécanique.
      langue.style.setProperty("--dl", Math.round(alea(-1600, 0)) + "ms");
      corps.appendChild(langue);
    }
    couche.appendChild(corps);

    couche.appendChild(creer("span", "podium-fire__core"));
    return couche;
  }

  /* ---------------------------------------------------------
     Couche d'explosion, commune au podium
     --------------------------------------------------------- */
  function creerExplosion() {
    var blast = creer("span", "podium-blast");
    blast.setAttribute("aria-hidden", "true");

    blast.appendChild(creer("span", "podium-blast__flash"));
    blast.appendChild(creer("span", "podium-blast__ring"));
    blast.appendChild(creer("span", "podium-blast__ring podium-blast__ring--late"));
    blast.appendChild(creer("span", "podium-blast__mass"));

    var braises = creer("span", "podium-blast__embers");
    for (var i = 0; i < BRAISES; i++) {
      var braise = creer("i");
      // Hémisphère supérieur : les braises partent vers le haut.
      var angle = (alea(-168, -12) * Math.PI) / 180;
      var distance = alea(140, 430);
      braise.style.setProperty("--ex", Math.round(Math.cos(angle) * distance) + "px");
      braise.style.setProperty("--ey", Math.round(Math.sin(angle) * distance) + "px");
      braise.style.setProperty("--es", alea(3, 8).toFixed(1) + "px");
      braise.style.setProperty("--ed", Math.round(alea(900, 1700)) + "ms");
      braise.style.setProperty("--edl", Math.round(alea(0, 260)) + "ms");
      braises.appendChild(braise);
    }
    blast.appendChild(braises);

    return blast;
  }

  /* Ordre d'apparition : le vainqueur émerge en premier. */
  function ordreApparition(carte) {
    if (carte.classList.contains("podium__card--gold")) return 0;
    if (carte.classList.contains("podium__card--silver")) return 1;
    return 2;
  }

  function declencher(podium, blast) {
    // Deux frames : garantit que l'état « armé » (cartes masquées) est peint
    // avant le démarrage des animations, sinon le navigateur peut les fusionner.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        podium.classList.add("is-erupting");
        setTimeout(function () {
          podium.classList.remove("fire-armed");
          podium.classList.remove("is-erupting");
          podium.classList.add("is-erupted");
          // La couche d'explosion ne sert qu'une fois : on la retire pour
          // libérer les compositions GPU (flous, blend modes).
          if (blast.parentNode) blast.parentNode.removeChild(blast);
        }, DUREE_EXPLOSION);
      });
    });
  }

  function init() {
    var podium = document.querySelector(".podium");
    if (!podium || podium.dataset.fireBound === "1") return;
    var cartes = podium.querySelectorAll(".podium__card");
    if (!cartes.length) return;
    podium.dataset.fireBound = "1";

    Array.prototype.forEach.call(cartes, function (carte) {
      carte.style.setProperty("--fire-order", ordreApparition(carte));
      carte.appendChild(creerFlammes());
    });

    // Mouvement réduit ou pas d'IntersectionObserver : podium visible d'emblée,
    // sans explosion (le CSS masque aussi les flammes dans ce cas).
    if (reduceMotion || !("IntersectionObserver" in window)) {
      podium.classList.add("is-erupted");
      return;
    }

    var blast = creerExplosion();
    podium.appendChild(blast);
    // `fire-armed` masque les cartes. Ajouté par JS uniquement : sans JS, le
    // podium reste visible normalement.
    podium.classList.add("fire-armed");

    var io = new IntersectionObserver(
      function (entrees) {
        for (var i = 0; i < entrees.length; i++) {
          if (!entrees[i].isIntersecting) continue;
          io.disconnect();
          declencher(podium, blast);
          return;
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -6% 0px" }
    );
    io.observe(podium);
  }

  // Le script est chargé après l'hydratation : DOMContentLoaded peut déjà
  // avoir eu lieu. On initialise immédiatement dans ce cas.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  // Exposé pour ré-armer l'effet si le podium est régénéré (même convention
  // que window.HMI.rafraichirPreview).
  window.HMI = window.HMI || {};
  window.HMI.rearmerPodiumFeu = init;
})();
