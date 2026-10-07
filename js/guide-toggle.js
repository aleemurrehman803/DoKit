/* Guide language toggle (EN/UR). Generic version of faq-toggle.js for guide pages.
   Targets any section containing .guide-lang-toggle and toggles .guide-en / .guide-ur within it.
   CSP-safe: this is an external script (script-src 'self'). */
(function () {
  function init(sec) {
    if (!sec || sec.dataset.guideToggleInit) return;
    sec.dataset.guideToggleInit = "1";
    var btns = sec.querySelectorAll(".guide-lang-btn");
    var en = sec.querySelector(".guide-en");
    var ur = sec.querySelector(".guide-ur");
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        btns.forEach(function (x) {
          var on = x === b;
          x.classList.toggle("is-active", on);
          x.setAttribute("aria-pressed", on ? "true" : "false");
        });
        var lang = b.getAttribute("data-guide-lang");
        if (en) en.hidden = lang !== "en";
        if (ur) ur.hidden = lang !== "ur";
        sec.querySelectorAll("details[open]").forEach(function (d) { d.open = false; });
        window.scrollTo({ top: sec.getBoundingClientRect().top + window.scrollY - 20, behavior: "smooth" });
      });
    });
  }
  document.querySelectorAll("section.guide-lang").forEach(init);
})();
