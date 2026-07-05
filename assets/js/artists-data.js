/* =========================================================
   Planète HMI — Données artistes (démonstration)
   Génère les cartes de la page Artistes. Les noms servent
   aussi de requête pour l'aperçu audio (data-preview-artist).
   ========================================================= */
(function () {
  "use strict";

  var IMG = "image/artists/planet-hmi-artist-placeholder-square.webp.webp";

  // Données de démonstration. À remplacer par une vraie source.
  var ARTISTES = [
    { nom: "Roody Roodboy",       genre: "Konpa",        ecoutes: "12,78M", verifie: true },
    { nom: "Joé Dwèt Filé",       genre: "Konpa",        ecoutes: "8,45M",  verifie: true },
    { nom: "Mikaben",             genre: "Konpa",        ecoutes: "5,60M",  verifie: true },
    { nom: "Rutshelle Guillaume", genre: "Konpa",        ecoutes: "4,10M",  verifie: true },
    { nom: "Naïka",               genre: "Pop / R&B",    ecoutes: "3,90M",  verifie: true },
    { nom: "Wanito",              genre: "Konpa",        ecoutes: "2,40M",  verifie: false },
    { nom: "Emeline Michel",      genre: "Racine",       ecoutes: "2,10M",  verifie: true },
    { nom: "Baky",                genre: "Rap kreyòl",   ecoutes: "1,95M",  verifie: false },
    { nom: "Belo",                genre: "Reggae",       ecoutes: "1,80M",  verifie: true },
    { nom: "BIC",                 genre: "Rap kreyòl",   ecoutes: "1,50M",  verifie: false },
    { nom: "Vwadèzil",            genre: "Rabòday",      ecoutes: "1,20M",  verifie: false },
    { nom: "Darline Desca",       genre: "Pop",          ecoutes: "1,10M",  verifie: true }
  ];

  function boutonPreview(nom) {
    return (
      '<button class="preview-btn" type="button" aria-label="Écouter un extrait de ' + nom + '" data-preview-toggle>' +
        '<span class="preview-btn__icon preview-btn__icon--play" aria-hidden="true"></span>' +
        '<span class="preview-btn__icon preview-btn__icon--pause" aria-hidden="true"></span>' +
        '<span class="preview-btn__spinner" aria-hidden="true"></span>' +
        '<span class="preview-btn__eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' +
      '</button>'
    );
  }

  function carte(a) {
    return (
      '<article class="a-card" data-preview-artist="' + a.nom + '">' +
        '<div class="a-card__media">' +
          '<img src="' + IMG + '" alt="' + a.nom + '" loading="lazy" width="400" height="400" />' +
          (a.verifie ? '<span class="a-card__badge">Vérifié</span>' : '') +
          '<span class="a-card__genre">' + a.genre + '</span>' +
          boutonPreview(a.nom) +
        '</div>' +
        '<h3 class="a-card__name">' + a.nom + '</h3>' +
        '<div class="a-card__meta"><span><span class="star">★</span> ' + a.ecoutes + '</span><span>' + a.genre + '</span></div>' +
      '</article>'
    );
  }

  var grille = document.getElementById("artistGrid");
  if (grille) {
    grille.innerHTML = ARTISTES.map(carte).join("");
  }
})();
