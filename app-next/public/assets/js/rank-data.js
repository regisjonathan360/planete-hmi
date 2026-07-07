/* =========================================================
   Planète HMI — Classement des artistes
   Utilise en priorité les données réelles collectées
   (data/rankings.json). Repli sur des données de démonstration
   si la collecte n'a pas encore tourné.
   ========================================================= */
(function () {
  "use strict";

  var PLACEHOLDER = "image/artists/planet-hmi-artist-placeholder-square.webp.webp";

  // Repli (démonstration) — utilisé uniquement si data/rankings.json absent.
  var DEMO = [
    { nom: "Roody Roodboy",       titre: "Nouvo Jenerasyon",   genre: "Konpa",       score: "98,4", trend: 5 },
    { nom: "Joé Dwèt Filé",       titre: "Lanmou Total",        genre: "Konpa",       score: "95,1", trend: 2 },
    { nom: "Kevinna",             titre: "Sèl Ou",              genre: "Pop",         score: "92,7", trend: -1 },
    { nom: "Mikaben",             titre: "Ale",                 genre: "Konpa",       score: "91,3", trend: 0 },
    { nom: "Rutshelle Guillaume", titre: "Kite'm Kriye",        genre: "Konpa",       score: "90,2", trend: 3 },
    { nom: "Naïka",               titre: "Angel",               genre: "Pop / R&B",   score: "88,9", trend: 4 },
    { nom: "Baky",                titre: "Detwe Mo",            genre: "Rap kreyòl",  score: "86,5", trend: -2 },
    { nom: "Emeline Michel",      titre: "Beni Yo",             genre: "Racine",      score: "85,1", trend: 1 },
    { nom: "Belo",                titre: "Lakay",               genre: "Reggae",      score: "83,7", trend: 0 },
    { nom: "BIC",                 titre: "Nwèl Anmè",           genre: "Rap kreyòl",  score: "82,0", trend: 6 },
    { nom: "Wanito",              titre: "Espwa",               genre: "Konpa",       score: "80,4", trend: -1 },
    { nom: "Vwadèzil",            titre: "Rara Vibe",           genre: "Rabòday",     score: "78,9", trend: 2 }
  ];

  function trendBadge(t) {
    if (t == null) return "";
    if (t > 0) return '<span class="trend up">▲ ' + t + '</span>';
    if (t < 0) return '<span class="trend down">▼ ' + Math.abs(t) + '</span>';
    return '<span class="trend" style="color:var(--cream-dim)">▬</span>';
  }

  function bouton(nom) {
    return (
      '<button class="preview-btn preview-btn--sm" type="button" aria-label="Écouter un extrait de ' + nom + '" data-preview-toggle>' +
        '<span class="preview-btn__icon preview-btn__icon--play" aria-hidden="true"></span>' +
        '<span class="preview-btn__icon preview-btn__icon--pause" aria-hidden="true"></span>' +
        '<span class="preview-btn__spinner" aria-hidden="true"></span>' +
        '<span class="preview-btn__eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' +
      '</button>'
    );
  }

  function ligne(a, i) {
    var img = a.photo || PLACEHOLDER;
    var titre = a.titre || a.genre;
    return (
      '<div class="chart-item" data-preview-artist="' + a.nom + '">' +
        '<span class="chart-item__rank">' + (i + 1) + '</span>' +
        '<img class="chart-item__cover" src="' + img + '" alt="' + a.nom + '" loading="lazy" width="56" height="56" onerror="this.src=\'' + PLACEHOLDER + '\'" />' +
        '<div class="chart-item__meta"><span class="chart-item__name">' + a.nom + '</span><span class="chart-item__sub">' + titre + '</span></div>' +
        '<span class="chart-item__genre">' + a.genre + '</span>' +
        '<span class="chart-item__stat"><b>' + a.score + '</b> HMI</span>' +
        trendBadge(a.trend) +
        bouton(a.nom) +
      '</div>'
    );
  }

  function rendre(liste, items) {
    liste.innerHTML = items.map(ligne).join("");
    if (window.HMI && typeof HMI.rafraichirPreview === "function") {
      HMI.rafraichirPreview();
    }
  }

  var liste = document.getElementById("rankList");
  if (!liste) return;

  // Rendu immédiat en démo, puis remplacement par les vraies données si dispo.
  var fallback = DEMO.map(function (d) {
    return { nom: d.nom, titre: d.titre, genre: d.genre, score: d.score, trend: d.trend, photo: null };
  });
  rendre(liste, fallback);

  if (window.HMI && HMI.rankings) {
    HMI.rankings().then(function (data) {
      if (!data || !data.classement || !data.classement.length) return;
      var items = data.classement.map(function (c) {
        return {
          nom: c.nom,
          titre: c.titre,
          genre: c.genre,
          score: HMI.format.score(c.score),
          trend: null,
          photo: c.photo
        };
      });
      rendre(liste, items);
      if (data.meta) HMI.noteSource(liste, data.meta);
    });
  }
})();
