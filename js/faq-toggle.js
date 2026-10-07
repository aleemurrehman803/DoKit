/* FAQ language toggle (EN/UR). NOTE: tool pages use CSP script-src 'self' (no inline JS).
   If the toggle does not work, move this block into the tool's tool.js file. */
(function () {
  function init(sec) {
    if (!sec || sec.dataset.faqToggleInit) return;
    sec.dataset.faqToggleInit = "1";
    var btns = sec.querySelectorAll(".faq-lang-btn");
    var en = sec.querySelector(".faq-en");
    var ur = sec.querySelector(".faq-ur");
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        btns.forEach(function (x) {
          var on = x === b;
          x.classList.toggle("is-active", on);
          x.setAttribute("aria-pressed", on ? "true" : "false");
        });
        var lang = b.getAttribute("data-faq-lang");
        if (en) en.hidden = lang !== "en";
        if (ur) ur.hidden = lang !== "ur";
        sec.querySelectorAll("details[open]").forEach(function (d) { d.open = false; });
      });
    });
  }
  document.querySelectorAll("section.tfaq").forEach(init);
})();
