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
   * state for screen readers. Focus stays on the input.
   * Closure fix 2 (Nov 2026): showText/hideText may be getter
   * functions, evaluated per render — the old captured strings went
   * stale on a mid-session language switch (Show/Hide stayed English
   * in Urdu mode). A dokit:langchange listener (dispatched on
   * document by both i18n engines) re-renders the label in the
   * current language without touching the input type. */
  function bindPwToggle(input, btn, showText, hideText) {
    if (!input || !btn) return;
    function getShow() { return (typeof showText === "function") ? showText() : showText; }
    function getHide() { return (typeof hideText === "function") ? hideText() : hideText; }
    function paint() {
      var visible = input.type === "text";
      var label = visible ? getHide() : getShow();
      btn.textContent = label;
      btn.setAttribute("aria-pressed", visible ? "true" : "false");
      btn.setAttribute("aria-label", label + " password");
    }
    btn.addEventListener("click", function () {
      input.type = (input.type === "password") ? "text" : "password";
      paint();
      try { input.focus(); } catch (e) {}
    });
    if (typeof document !== "undefined" && document.addEventListener) {
      document.addEventListener("dokit:langchange", paint);
    }
    paint();
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
   * labels: [weak, fair, good, strong] strings from the page's DK_STR,
   * OR a getter function returning that array — evaluated per render
   * so a mid-session language switch is honoured (closure fix 2,
   * Nov 2026: the old captured array stayed English in Urdu mode
   * while the hint next to it translated). Call sites re-render on
   * dokit:langchange with the current password value. */
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
      var arr = (typeof labels === "function") ? labels() : labels;
      strong.textContent = (arr && arr[idx]) || "";
      label.appendChild(strong);
    }
  }

  /* Password-length hint with a success state (closure fix, Nov 2026):
   * the hint ("Minimum 6 characters") used to stay visible even for a
   * strong password, reading like a permanent warning. Now it flips to
   * a success line (green, .pw-hint-ok in css/auth.css) once the
   * password meets the length rule, and flips back if the user deletes
   * below it. The rule is the same MIN_LEN the submit validation uses
   * (Firebase minimum 6) — the hint is about length, the meter above
   * it is about strength, so a 6-char "123456" still shows Weak on
   * the meter while the hint correctly reports the length as met.
   * Texts come from getter functions so a mid-session language switch
   * is honoured on the next keystroke; dataset flag stops
   * double-binding. */
  var PW_MIN_LEN = 6;
  function bindPwHint(pwEl, hintEl, getHintText, getOkText) {
    if (!pwEl || !hintEl) return;
    if (hintEl.dataset.dkHint) return;
    hintEl.dataset.dkHint = "1";
    function refresh() {
      var ok = pwEl.value.length >= PW_MIN_LEN;
      hintEl.textContent = ok ? getOkText() : getHintText();
      if (ok) hintEl.classList.add("pw-hint-ok");
      else hintEl.classList.remove("pw-hint-ok");
    }
    pwEl.addEventListener("input", refresh);
    /* Closure fix 2 (Nov 2026): re-render on dokit:langchange too.
     * The hint element carries a data-i18n key (the plain hint), so
     * the engine's apply() rewrites its textContent to the plain
     * hint on every switch — clobbering the success line until the
     * next keystroke. refresh() runs after the engine's apply (the
     * event fires after it), so the length-correct line wins. */
    if (typeof document !== "undefined" && document.addEventListener) {
      document.addEventListener("dokit:langchange", refresh);
    }
    refresh();
  }

  /* Google sign-in safety net (live-verified 18 Nov 2026): the GIS
   * token-client callback normally fires when the chooser is closed
   * without choosing an account — but when the chooser opens as a
   * full tab and that tab is closed, the callback never arrived and
   * the Google button stayed disabled with "Opening Google sign-in…"
   * forever. This arms a one-shot focus listener per click: when the
   * window regains focus while the flow is still active, we wait a
   * beat (the callback may still land first) and then run reset().
   * Returns a disarm() the page calls on every terminal path
   * (credential received / error / callback cancel) so a later
   * focus return cannot reset a finished flow. Alt-tabbing back
   * while the chooser is still open also resets the button — a
   * deliberate trade-off: the user can simply click again, and a
   * stuck disabled button is worse than a re-clickable one. */
  function resetGoogleOnFocusReturn(getActive, reset) {
    var done = false;
    function disarm() {
      if (done) return;
      done = true;
      try { window.removeEventListener("focus", onFocus); } catch (e) {}
    }
    function onFocus() {
      if (done) return;
      setTimeout(function () {
        if (done) return;
        try { if (getActive()) { disarm(); reset(); } } catch (e) {}
      }, 1200);
    }
    try { window.addEventListener("focus", onFocus); } catch (e) {}
    return disarm;
  }

  window.DKAuth = {
    EMAIL_RE: EMAIL_RE,
    bindPwToggle: bindPwToggle,
    bindPwHint: bindPwHint,
    scorePassword: scorePassword,
    renderStrength: renderStrength,
    resetGoogleOnFocusReturn: resetGoogleOnFocusReturn
  };
})();
