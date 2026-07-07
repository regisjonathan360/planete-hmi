/* =========================================================
   Planète HMI — Interactions d'interface
   - Pills (filtres) et onglets : sélection active unique
   - Recherche + filtre par genre côté client (grilles internes)
   - Icône recherche : focus le champ, sinon va vers Artistes
   - Toast "démo" pour les actions non encore branchées
   ========================================================= */
(function () {
  "use strict";

  function norm(s) {
    return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }
  function premierMot(s) { return norm(s).split(/[\s/]+/)[0] || ""; }

  /* ---------- Toast ---------- */
  var toast, toastTimer;
  function afficherToast(msg) {
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    requestAnimationFrame(function () { toast.classList.add("is-visible"); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("is-visible"); }, 2200);
  }

  /* ---------- Grille filtrable (Artistes / Classement) ---------- */
  var grille = document.querySelector(".artist-grid, .chart-list");
  var itemsSel = ".a-card, .chart-item";

  function genreDe(el) {
    var g = el.querySelector(".a-card__genre, .chart-item__genre");
    return premierMot(g ? g.textContent : "");
  }
  function nomDe(el) {
    return norm(el.getAttribute("data-preview-artist") ||
      (el.querySelector(".a-card__name, .chart-item__name") || {}).textContent || "");
  }

  var filtreGenre = "all";
  var filtreTexte = "";

  function appliquerFiltres() {
    if (!grille) return;
    var items = grille.querySelectorAll(itemsSel);
    var visibles = 0;
    items.forEach(function (el) {
      var okGenre = (filtreGenre === "all") || (genreDe(el) === filtreGenre);
      var okTexte = !filtreTexte || nomDe(el).indexOf(filtreTexte) !== -1;
      var visible = okGenre && okTexte;
      el.setAttribute("data-hidden", visible ? "false" : "true");
      if (visible) visibles++;
    });
    // Message "aucun résultat"
    var vide = grille.parentNode.querySelector(".filter-empty");
    if (visibles === 0) {
      if (!vide) { vide = document.createElement("p"); vide.className = "filter-empty"; vide.textContent = "Aucun résultat pour ce filtre."; grille.parentNode.insertBefore(vide, grille.nextSibling); }
    } else if (vide) { vide.remove(); }
  }

  /* ---------- Pills : sélection unique + filtre ---------- */
  document.querySelectorAll(".pill-row").forEach(function (row) {
    row.addEventListener("click", function (e) {
      var pill = e.target.closest(".pill");
      if (!pill) return;
      row.querySelectorAll(".pill").forEach(function (p) { p.classList.remove("is-active"); });
      pill.classList.add("is-active");
      var mot = premierMot(pill.textContent);
      filtreGenre = (mot === "tous" || mot === "toutes" || mot === "tout") ? "all" : mot;
      appliquerFiltres();
    });
  });

  /* ---------- Onglets : sélection unique ---------- */
  document.querySelectorAll(".tabs").forEach(function (tabs) {
    tabs.addEventListener("click", function (e) {
      var tab = e.target.closest(".tab");
      if (!tab) return;
      tabs.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("is-active"); t.setAttribute("aria-selected", "false"); });
      tab.classList.add("is-active"); tab.setAttribute("aria-selected", "true");
      if (norm(tab.textContent) !== "artistes") afficherToast("Onglet « " + tab.textContent.trim() + " » — bientôt disponible");
    });
  });

  /* ---------- Recherche (champ) ---------- */
  var champ = document.querySelector('input[type="search"]');
  if (champ) {
    champ.addEventListener("input", function () { filtreTexte = norm(champ.value); appliquerFiltres(); });
  }

  /* (L'icône loupe ouvre la recherche globale : géré dans features.js) */

  /* ---------- Actions de démonstration (retour visuel) ---------- */
  document.addEventListener("click", function (e) {
    var lien = e.target.closest('a[href="#"], .product__body .btn, .event-row .btn, .pagination a, .socials a');
    if (!lien) return;
    e.preventDefault();
    var msg = "Fonctionnalité de démonstration — bientôt disponible";
    if (lien.closest(".product__body")) msg = "Ajouté au panier (démo)";
    else if (lien.closest(".event-row")) msg = "Billetterie de démonstration";
    else if (lien.closest(".pagination")) msg = "Pagination de démonstration";
    afficherToast(msg);
  });
})();
