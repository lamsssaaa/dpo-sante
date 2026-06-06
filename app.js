/* DPO Romandie — amélioration progressive (le contenu fonctionne sans JS) */
(function () {
  "use strict";
  if (window.__rf) clearTimeout(window.__rf); /* annule le filet de sécurité : le JS tourne */
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 1) État du header au scroll */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("scrolled", window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* 2) Révélation au scroll (les éléments sont déjà visibles si JS/IO absents) */
  var targets = document.querySelectorAll("[data-reveal]");
  if (reduce || !("IntersectionObserver" in window)) {
    targets.forEach(function (el) { el.classList.add("is-revealed"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("is-revealed"); io.unobserve(e.target); }
    });
  }, { rootMargin: "0px 0px -7% 0px", threshold: 0.06 });
  targets.forEach(function (el) { io.observe(el); });
})();
