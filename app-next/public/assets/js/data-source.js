/* =========================================================
   Planète HMI — Source de données
   Charge les fichiers JSON générés automatiquement par le
   collecteur (scripts/collect-data.mjs, via GitHub Actions).
   Expose des helpers et un repli propre si les données ne
   sont pas encore disponibles.
   ========================================================= */
(function () {
  "use strict";

  var HMI = (window.HMI = window.HMI || {});
  var cache = {};

  function fetchJSON(path) {
    if (cache[path]) return cache[path];
    cache[path] = fetch(path, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .catch(function () {
        return null; // repli silencieux : le site utilisera la démo
      });
    return cache[path];
  }

  // Formate un entier en notation compacte française : 1,23M / 45,6k
  function compact(n) {
    if (n == null || isNaN(n)) return null;
    n = Number(n);
    if (n >= 1e9) return (n / 1e9).toFixed(2).replace(".", ",") + "Md";
    if (n >= 1e6) return (n / 1e6).toFixed(2).replace(".", ",") + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(".", ",") + "k";
    return String(n);
  }

  // "72.6" -> "72,6"
  function score(n) {
    if (n == null || isNaN(n)) return null;
    return (Math.round(Number(n) * 10) / 10).toString().replace(".", ",");
  }

  // Date ISO -> "5 juil. 2026"
  function dateFr(iso) {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString("fr-FR", {
        day: "numeric", month: "short", year: "numeric"
      });
    } catch (e) { return null; }
  }

  // Insère une légende de source au-dessus d'un conteneur.
  function noteSource(refElement, meta) {
    if (!refElement || !meta) return;
    if (refElement.previousElementSibling &&
        refElement.previousElementSibling.classList.contains("data-note")) {
      return; // déjà posée
    }
    var p = document.createElement("p");
    p.className = "data-note";
    var srcs = (meta.sources || []).join(", ") || "démonstration";
    p.innerHTML =
      '<span class="data-note__live">● en direct</span> Données ' +
      srcs + (meta.genereLe ? " — mises à jour le " + dateFr(meta.genereLe) : "");
    p.title = meta.note || "";
    refElement.parentNode.insertBefore(p, refElement);
  }

  HMI.fetchJSON = fetchJSON;
  HMI.rankings = function () { return fetchJSON("/data/rankings.json"); };
  HMI.artists = function () { return fetchJSON("/data/artists.json"); };
  HMI.format = { compact: compact, score: score, dateFr: dateFr };
  HMI.noteSource = noteSource;
})();
