/* =========================================================
   Planète HMI — Interactions front
   - Menu mobile accessible
   - Parallaxe légère des couches cosmiques (transform uniquement)
   - Révélation au défilement (IntersectionObserver)
   Respecte prefers-reduced-motion.
   ========================================================= */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Menu mobile ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var menu = document.getElementById("menu-mobile");

  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      menu.hidden = open;
    });
    // Ferme le menu après un clic sur un lien
    menu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        toggle.setAttribute("aria-expanded", "false");
        menu.hidden = true;
      });
    });
  }

  /* ---------- Révélation au défilement ---------- */
  var revealables = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealables.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Parallaxe cosmique ---------- */
  if (!reduceMotion) {
    var layers = Array.prototype.slice.call(document.querySelectorAll("[data-depth]"));
    var ticking = false;

    function update() {
      var y = window.scrollY || window.pageYOffset;
      for (var i = 0; i < layers.length; i++) {
        var depth = parseFloat(layers[i].getAttribute("data-depth")) || 0;
        layers[i].style.setProperty("--py", (y * depth).toFixed(2) + "px");
      }
      ticking = false;
    }

    window.addEventListener("scroll", function () {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });

    update();
  }
})();
