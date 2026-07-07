/* =========================================================
   Planète HMI — Fonctionnalités client
   1) Recherche globale (overlay) via l'API publique Deezer
   2) Favoris persistants (localStorage) : cœur sur les cartes,
      compteur dans l'en-tête, panneau de gestion.
   Aucun backend, aucune dépendance.
   ========================================================= */
(function () {
  "use strict";

  /* ---------- Utilitaires ---------- */
  function esc(s) {
    return (s || "").replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function norm(s) {
    return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }
  function jsonp(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var cb = "__hmi_j_" + Math.random().toString(36).slice(2);
      var s = document.createElement("script");
      var done = false;
      var timer = setTimeout(function () { if (!done) { cleanup(); reject(new Error("timeout")); } }, timeoutMs || 8000);
      function cleanup() { done = true; clearTimeout(timer); try { delete window[cb]; } catch (e) { window[cb] = undefined; } if (s.parentNode) s.parentNode.removeChild(s); }
      window[cb] = function (d) { cleanup(); resolve(d); };
      s.onerror = function () { if (!done) { cleanup(); reject(new Error("réseau")); } };
      s.src = url + (url.indexOf("?") === -1 ? "?" : "&") + "output=jsonp&callback=" + cb;
      document.head.appendChild(s);
    });
  }

  /* Lecteur partagé (un seul extrait à la fois pour recherche + favoris) */
  var audio = new Audio();
  audio.preload = "none";
  var playingBtn = null;
  function stopAudio() {
    audio.pause();
    if (playingBtn) { playingBtn.classList.remove("is-playing"); playingBtn = null; }
  }
  function playFrom(url, btn) {
    if (!url) return;
    if (playingBtn === btn && !audio.paused) { stopAudio(); return; }
    stopAudio();
    audio.src = url; audio.currentTime = 0;
    var p = audio.play();
    if (p && p.then) p.then(function () { playingBtn = btn; btn.classList.add("is-playing"); }).catch(function () {});
  }
  audio.addEventListener("ended", stopAudio);

  /* =========================================================
     1) RECHERCHE GLOBALE
     ========================================================= */
  var loupe = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  var searchOverlay = document.createElement("div");
  searchOverlay.className = "overlay";
  searchOverlay.setAttribute("role", "dialog");
  searchOverlay.setAttribute("aria-modal", "true");
  searchOverlay.setAttribute("aria-label", "Recherche");
  searchOverlay.hidden = true;
  searchOverlay.innerHTML =
    '<div class="overlay__panel">' +
      '<div class="overlay__head">' +
        '<label class="field field--grow">' + loupe +
          '<input type="search" placeholder="Rechercher un artiste, un titre…" aria-label="Recherche globale" />' +
        '</label>' +
        '<button class="overlay__close" type="button" aria-label="Fermer">✕</button>' +
      '</div>' +
      '<div class="overlay__results" aria-live="polite"></div>' +
    '</div>';
  document.body.appendChild(searchOverlay);

  var sInput = searchOverlay.querySelector("input");
  var sResults = searchOverlay.querySelector(".overlay__results");
  var lastFocus = null;

  function openSearch() {
    lastFocus = document.activeElement;
    searchOverlay.hidden = false;
    document.body.classList.add("no-scroll");
    setTimeout(function () { sInput.focus(); }, 40);
  }
  function closeSearch() {
    searchOverlay.hidden = true;
    document.body.classList.remove("no-scroll");
    sResults.innerHTML = ""; sInput.value = ""; stopAudio();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  var sTimer;
  sInput.addEventListener("input", function () {
    var q = sInput.value.trim();
    clearTimeout(sTimer);
    if (q.length < 2) { sResults.innerHTML = ""; return; }
    sResults.innerHTML = '<p class="overlay__hint">Recherche…</p>';
    sTimer = setTimeout(function () { runSearch(q); }, 320);
  });

  function runSearch(q) {
    jsonp("https://api.deezer.com/search?limit=10&q=" + encodeURIComponent(q)).then(function (rep) {
      var list = (rep && rep.data) || [];
      if (!list.length) { sResults.innerHTML = '<p class="overlay__hint">Aucun résultat.</p>'; return; }
      sResults.innerHTML = list.map(function (t) {
        var cover = (t.album && t.album.cover_small) || "";
        return '<button class="result" type="button" data-preview="' + (t.preview || "") + '" data-artist="' + esc(t.artist && t.artist.name) + '">' +
          (cover ? '<img class="result__cover" src="' + cover + '" alt="" width="44" height="44" loading="lazy" />' : '<span class="result__cover"></span>') +
          '<span class="result__meta"><span class="result__title">' + esc(t.title) + '</span>' +
          '<span class="result__artist">' + esc(t.artist && t.artist.name) + '</span></span>' +
          '<span class="result__play" aria-hidden="true">▶</span>' +
        '</button>';
      }).join("");
    }).catch(function () { sResults.innerHTML = '<p class="overlay__hint">Recherche indisponible.</p>'; });
  }

  sResults.addEventListener("click", function (e) {
    var btn = e.target.closest(".result"); if (!btn) return;
    playFrom(btn.getAttribute("data-preview"), btn);
  });
  searchOverlay.querySelector(".overlay__close").addEventListener("click", closeSearch);
  searchOverlay.addEventListener("click", function (e) { if (e.target === searchOverlay) closeSearch(); });

  /* Ouvre la recherche depuis toute icône loupe (sauf le bouton favoris) */
  document.querySelectorAll(".icon-btn:not(.fav-open)").forEach(function (b) {
    b.addEventListener("click", function (e) { e.preventDefault(); openSearch(); });
  });

  /* =========================================================
     2) FAVORIS (localStorage)
     ========================================================= */
  var LS_KEY = "hmi:favoris";
  var favSet = new Set();
  try { (JSON.parse(localStorage.getItem(LS_KEY)) || []).forEach(function (n) { favSet.add(n); }); } catch (e) {}
  function saveFav() { try { localStorage.setItem(LS_KEY, JSON.stringify(Array.from(favSet))); } catch (e) {} }

  var coeur = '<span aria-hidden="true">♥</span>';

  function ajouterCoeur(el) {
    var name = el.getAttribute("data-preview-artist");
    if (!name) return;
    var media = el.querySelector(".a-card__media, .podium__media");
    var coin = media || el.classList.contains("short");
    var inline = el.classList.contains("mini");
    if (!coin && !inline) return; // on saute les lignes de chart (grille fixe)
    var hote = coin ? (media || el) : el;
    if (hote.querySelector(":scope > .fav-btn")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fav-btn " + (coin ? "fav-btn--corner" : "fav-btn--inline");
    btn.setAttribute("data-fav-name", name);
    btn.innerHTML = coeur;
    hote.appendChild(btn);
    majCoeur(btn);
  }
  function majCoeur(btn) {
    var name = btn.getAttribute("data-fav-name");
    var actif = favSet.has(name);
    btn.classList.toggle("is-active", actif);
    btn.setAttribute("aria-pressed", String(actif));
    btn.setAttribute("aria-label", (actif ? "Retirer " : "Ajouter ") + name + (actif ? " des favoris" : " aux favoris"));
  }
  function majTousLesCoeurs(name) {
    document.querySelectorAll('.fav-btn[data-fav-name="' + (window.CSS && CSS.escape ? CSS.escape(name) : name) + '"]').forEach(majCoeur);
  }
  function toggleFav(name) {
    if (favSet.has(name)) favSet.delete(name); else favSet.add(name);
    saveFav(); majCompteur();
  }

  /* Délégation : clic sur un cœur */
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".fav-btn"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var name = b.getAttribute("data-fav-name");
    toggleFav(name); majTousLesCoeurs(name);
    if (favPanelOpen()) renderFavPanel();
  });

  /* Bouton favoris dans l'en-tête + compteur (UN SEUL) */
  var favOpenBtn = null;
  var firstActions = document.querySelector(".topbar__actions");
  if (firstActions && !firstActions.querySelector(".fav-open")) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "icon-btn fav-open"; b.setAttribute("aria-label", "Mes favoris");
    b.innerHTML = '<span aria-hidden="true">♥</span><span class="fav-open__count">0</span>';
    firstActions.insertBefore(b, firstActions.firstChild);
    favOpenBtn = b;
    b.addEventListener("click", openFavPanel);
  }
  function majCompteur() {
    document.querySelectorAll(".fav-open__count").forEach(function (c) { c.textContent = favSet.size; });
    document.querySelectorAll(".fav-open").forEach(function (b) { b.classList.toggle("has-fav", favSet.size > 0); });
  }

  /* Panneau favoris (réutilise le style overlay) */
  var favOverlay = document.createElement("div");
  favOverlay.className = "overlay";
  favOverlay.setAttribute("role", "dialog");
  favOverlay.setAttribute("aria-modal", "true");
  favOverlay.setAttribute("aria-label", "Mes favoris");
  favOverlay.hidden = true;
  favOverlay.innerHTML =
    '<div class="overlay__panel">' +
      '<div class="overlay__head"><h2 class="overlay__title">Mes favoris</h2>' +
      '<button class="overlay__close" type="button" aria-label="Fermer">✕</button></div>' +
      '<div class="overlay__results fav-list"></div>' +
    '</div>';
  document.body.appendChild(favOverlay);
  var favList = favOverlay.querySelector(".fav-list");
  favOverlay.querySelector(".overlay__close").addEventListener("click", closeFavPanel);
  favOverlay.addEventListener("click", function (e) { if (e.target === favOverlay) closeFavPanel(); });

  function favPanelOpen() { return !favOverlay.hidden; }
  function openFavPanel() { renderFavPanel(); favOverlay.hidden = false; document.body.classList.add("no-scroll"); }
  function closeFavPanel() { favOverlay.hidden = true; document.body.classList.remove("no-scroll"); stopAudio(); }
  function renderFavPanel() {
    var arr = Array.from(favSet);
    if (!arr.length) { favList.innerHTML = '<p class="overlay__hint">Aucun favori pour le moment. Ajoutez des artistes avec le cœur ♥.</p>'; return; }
    favList.innerHTML = arr.map(function (name) {
      return '<div class="result result--fav" data-artist="' + esc(name) + '">' +
        '<span class="result__meta"><span class="result__title">' + esc(name) + '</span></span>' +
        '<button class="result__play" type="button" data-fav-play="' + esc(name) + '" aria-label="Écouter un extrait de ' + esc(name) + '">▶</button>' +
        '<button class="result__remove" type="button" data-fav-remove="' + esc(name) + '" aria-label="Retirer ' + esc(name) + '">✕</button>' +
      '</div>';
    }).join("");
  }
  favList.addEventListener("click", function (e) {
    var rm = e.target.closest("[data-fav-remove]");
    if (rm) { var n = rm.getAttribute("data-fav-remove"); favSet.delete(n); saveFav(); majCompteur(); majTousLesCoeurs(n); renderFavPanel(); return; }
    var pl = e.target.closest("[data-fav-play]");
    if (pl) {
      var name = pl.getAttribute("data-fav-play");
      pl.textContent = "…";
      jsonp("https://api.deezer.com/search?limit=15&q=" + encodeURIComponent(name)).then(function (rep) {
        var list = (rep && rep.data) || [], t = null, cible = norm(name);
        for (var i = 0; i < list.length; i++) { if (list[i].preview && norm(list[i].artist && list[i].artist.name) === cible) { t = list[i]; break; } }
        pl.textContent = "▶";
        if (t) playFrom(t.preview, pl); 
      }).catch(function () { pl.textContent = "▶"; });
    }
  });

  /* Échap ferme les overlays ouverts */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!searchOverlay.hidden) closeSearch();
    if (!favOverlay.hidden) closeFavPanel();
  });

  /* Init : injecte les cœurs sur toutes les entités artistes */
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-preview-artist]").forEach(ajouterCoeur);
    majCompteur();
  });
})();
