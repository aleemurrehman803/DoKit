/* DoKit — shared auth-page helpers (account/login.html + account/signup.html).
 * One home for the logic both pages need, so it is never copied per page:
 * show/hide password toggles, password-strength scoring + meter rendering,
 * and the shared email check. Loaded BEFORE js/pages/login.js / signup.js.
 * Every function guards missing elements, so a page without a given
 * control simply skips it. No Firebase calls here — handlers stay in the
 * page scripts. CSP: plain script, no inline handlers, no eval. */
(function () {
  "use strict";

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* Show/hide toggle for a password input. btn text swaps Show/Hide
   * (labels passed in so each page can i18n them); aria-pressed tracks
   * state for screen readers. Focus stays on the input. */
  function bindPwToggle(input, btn, showText, hideText) {
    if (!input || !btn) return;
    btn.addEventListener("click", function () {
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? hideText : showText;
      btn.setAttribute("aria-pressed", show ? "true" : "false");
      btn.setAttribute("aria-label", show ? hideText + " password" : showText + " password");
      try { input.focus(); } catch (e) {}
    });
  }

  /* Strength score 0-4: +1 each for length >= 8, mixed case, a digit,
   * a symbol. (Length < 6 still scores 0 — Firebase minimum is 6.) */
  function scorePassword(pw) {
    if (!pw) return 0;
    var score = 0;
    if (pw.length >= 8) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  }

  /* Paint the 4-segment meter (data-score) and the label under it.
   * labels: [weak, fair, good, strong] strings from the page's DK_STR. */
  function renderStrength(meter, label, pw, labels) {
    if (!meter && !label) return;
    var score = scorePassword(pw);
    if (meter) meter.setAttribute("data-score", String(score));
    if (label) {
      if (!pw) {
        label.textContent = "";
        label.removeAttribute("data-level");
        return;
      }
      var idx = Math.max(0, Math.min(3, score - 1));
      label.setAttribute("data-level", String(score));
      label.innerHTML = "";
      var strong = document.createElement("strong");
      strong.textContent = labels[idx] || "";
      label.appendChild(strong);
    }
  }

  window.DKAuth = {
    EMAIL_RE: EMAIL_RE,
    bindPwToggle: bindPwToggle,
    scorePassword: scorePassword,
    renderStrength: renderStrength
  };
})();
