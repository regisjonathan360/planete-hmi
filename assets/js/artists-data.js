/* =========================================================
   Planète HMI — Grille des artistes
   Utilise en priorité les données réelles collectées
   (data/artists.json). Repli sur des données de démonstration
   si la collecte n'a pas encore tourné.
   ========================================================= */
(function () {
  "use strict";

  var PLACEHOLDER = "image/artists/planet-hmi-artist-placeholder-square.webp.webp";

  // Repli (démonstration) — utilisé uniquement si data/artists.json absent.
  var DEMO = [
    { nom: "Roody Roodboy",       genre: "Konpa",        audience: "12,78M", verifie: true },
    { nom: "Joé Dwèt Filé",       genre: "Konpa",        audience: "8,45M",  verifie: true },
    { nom: "Mikaben",             genre: "Konpa",        audience: "5,60M",  verifie: true },
    { nom: "Rutshelle Guillaume", genre: "Konpa",        audience: "4,10M",  verifie: true },
    { nom: "Naïka",               genre: "Pop / R&B",    audience: "3,90M",  verifie: true },
    { nom: "Wanito",              genre: "Konpa",        audience: "2,40M",  verifie: false },
    { nom: "Emeline Michel",      genre: "Racine",       audience: "2,10M",  verifie: true },
    { nom: "Baky",                genre: "Rap kreyòl",   audience: "1,95M",  verifie: false },
    { nom: "Belo",                genre: "Reggae",       audience: "1,80M",  verifie: true },
    { nom: "BIC",                 genre: "Rap kreyòl",   audience: "1,50M",  verifie: false },
    { nom: "Vwadèzil",            genre: "Rabòday",      audience: "1,20M",  verifie: false },
    { nom: "Darline Desca",       genre: "Pop",          audience: "1,10M",  verifie: true }
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
    var img = a.photo || PLACEHOLDER;
    return (
      '<article class="a-card" data-preview-artist="' + a.nom + '">' +
        '<div class="a-card__media">' +
          '<img src="' + img + '" alt="' + a.nom + '" loading="lazy" width="400" height="400" onerror="this.src=\'' + PLACEHOLDER + '\'" />' +
          (a.verifie ? '<span class="a-card__badge">Vérifié</span>' : '') +
          '<span class="a-card__genre">' + a.genre + '</span>' +
          boutonPreview(a.nom) +
        '</div>' +
        '<h3 class="a-card__name">' + a.nom + '</h3>' +
        '<div class="a-card__meta"><span><span class="star">★</span> ' + a.audience + '</span><span>' + a.genre + '</span></div>' +
      '</article>'
    );
  }

  function rendre(grille, items) {
    grille.innerHTML = items.map(carte).join("");
    if (window.HMI && typeof HMI.rafraichirPreview === "function") {
      HMI.rafraichirPreview();
    }
  }

  // Choisit la meilleure métrique d'audience disponible pour l'affichage.
  function audienceDe(m) {
    if (!m) return "—";
    if (m.spotifyFollowers) return HMI.format.compact(m.spotifyFollowers) + " fans";
    if (m.deezerFans)       return HMI.format.compact(m.deezerFans) + " fans";
    if (m.youtubeAbonnes)   return HMI.format.compact(m.youtubeAbonnes) + " abo.";
    return "—";
  }

  var grille = document.getElementById("artistGrid");
  if (!grille) return;

  rendre(grille, DEMO);

  if (window.HMI && HMI.artists) {
    HMI.artists().then(function (data) {
      if (!data || !data.artistes || !data.artistes.length) return;
      var items = data.artistes.map(function (a) {
        return {
          nom: a.nom,
          genre: a.genre,
          photo: a.photo,
          audience: audienceDe(a.metriques),
          verifie: !!(a.metriques && (a.metriques.spotifyPopularite >= 50 ||
                      (a.metriques.deezerFans || 0) >= 50000))
        };
      });
      rendre(grille, items);
      if (data.meta) HMI.noteSource(grille, data.meta);
    });
  }
})();
