/* i18n: user-facing strings via DKI18N (other languages fall back to English). */
var DK_STR = {
  "li_busy": "Logging in…",
  "li_login": "Log In",
  "li_gfail": "Google sign-in failed to load. Check connection and try again.",
  "li_email": "Please enter a valid email address.",
  "li_pw": "Password must be at least 6 characters.",
  "li_captcha": "Please enter the security code shown above.",
  "li_captcha_wrong": "Incorrect security code. Please try the new code shown above.",
  "li_loading": "Sign-in is still loading. Please wait a moment and try again.",
  "li_gopen": "Opening Google sign-in…",
  "li_gcancel": "Google sign-in was cancelled.",
  "li_gstart": "Google sign-in could not start. Please try again.",
  "li_show": "Show",
  "li_hide": "Hide",
  "li_forgot": "Forgot password?",
  "li_reset_sending": "Sending reset email…",
  "li_reset_sent": "Password reset email sent. Check your inbox (and spam folder).",
};
try { if (window.DKI18N) DKI18N.add("en", DK_STR); } catch (e) {}
function dkT(k) { try { if (window.DKI18N) return DKI18N.t(k); } catch (e) {} return DK_STR[k] || k; }
/* DoKit — login page (Firebase Auth: email/password + Google). */
document.addEventListener("DOMContentLoaded", function () {
  try { window.DKUI && (DKUI.renderNav("login"), DKUI.renderFooter(), DKUI.init()); } catch (e) {}

  var form = document.getElementById("loginForm");
  var email = document.getElementById("email");
  var pw = document.getElementById("password");
  var eErr = document.getElementById("err-email");
  var pErr = document.getElementById("err-password");
  var gErr = document.getElementById("err-general");
  var cErr = document.getElementById("err-captcha");
  var okEl = document.getElementById("ok-general");
  var rememberMe = document.getElementById("rememberMe");
  var forgotLink = document.getElementById("forgotLink");
  var submitBtn = form.querySelector('button[type="submit"]');

  function setBusy(b) {
    submitBtn.disabled = b;
    submitBtn.textContent = b ? dkT("li_busy") : dkT("li_login");
  }

  // Show/hide password (shared helper in js/pages/auth-common.js).
  // Closure fix 2 (Nov 2026): pass getters, not captured strings, so
  // a mid-session language switch re-renders Show/Hide in the new
  // language (the old captured dkT() values stayed English in UR).
  if (window.DKAuth) DKAuth.bindPwToggle(pw, document.getElementById("pwToggle"),
    function () { return dkT("li_show"); }, function () { return dkT("li_hide"); });

  /* Remember Me: Firebase default persistence is LOCAL (stay signed in),
   * so a checked box needs no call at all — and skipping it keeps the
   * Google popup on the direct click-gesture path (no async hop that a
   * popup blocker could mistake for a background window). Only an
   * UNCHECKED box calls setPersistence(SESSION) — signed out when the
   * browser/tab closes. A failure here never blocks sign-in. */
  function applyPersistence() {
    if (rememberMe && rememberMe.checked) return Promise.resolve();
    try {
      var a = window.DKF && DKF.auth();
      var P = (window.firebase && firebase.auth && firebase.auth.Auth) ? firebase.auth.Auth.Persistence : null;
      if (!a || !P) return Promise.resolve();
      return a.setPersistence(P.SESSION);
    } catch (e) { return Promise.resolve(); }
  }

  // CAPTCHA is required on every login attempt.
  var cap = null;
  var capInput = document.getElementById("capInput");
  if (window.DKCaptcha) {
    cap = DKCaptcha.init(
      document.getElementById("capCanvas"),
      document.getElementById("capInput"),
      document.getElementById("capRefresh"),
      document.getElementById("capAudio")
    );
  }

  // Google Identity Services (GIS): direct Google sign-in, bypassing the
  // Firebase auth handler entirely. Permanent solution.
  var GIS_CLIENT_ID = "890427724515-j312112q9sf8c9cmq3mfq5k2gi8dadhc.apps.googleusercontent.com";
  function withGIS(fn) {
    if (window.google && google.accounts && google.accounts.oauth2) return fn();
    var s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = fn;
    s.onerror = function () {
      gFlowActive = false;
      if (gDisarm) gDisarm();
      gBtn.disabled = false;
      if (gErr) gErr.textContent = dkT("li_gfail");
    };
    document.head.appendChild(s);
  }

  // Already signed in? Skip to dashboard.
  if (window.DKF) {
    DKF.onUser(function (user) {
      if (user) window.location.href = "dashboard.html";
    });
    /* Closure fix (Nov 2026): warm the App Check token now, while
     * the user fills the form — see DKF.warmAppCheck. */
    try { DKF.warmAppCheck(); } catch (e) {}
  }

  /* Forgot password: NEW minimal flow on this page (the DKF login page
   * previously had no reset UI; the reset itself is plain Firebase
   * sendPasswordResetEmail, the same call the account index pages use).
   * Uses the email already typed in the form; errors come from
   * DKF.friendlyError like every other auth error on this page. */
  if (forgotLink) {
    forgotLink.addEventListener("click", function (ev) {
      ev.preventDefault();
      if (forgotLink.getAttribute("aria-disabled") === "true") return;
      if (okEl) { okEl.hidden = true; okEl.textContent = ""; }
      if (gErr) gErr.textContent = "";
      if (eErr) eErr.textContent = ""; /* 390px verify, 19 Nov 2026: without
        this, a stale "enter a valid email" error from an earlier empty
        click stayed visible next to the loading/sent message after the
        user typed an email and clicked again. */
      var em = email.value.trim();
      var emailOk = window.DKAuth ? DKAuth.EMAIL_RE.test(em) : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
      if (!emailOk) {
        eErr.textContent = dkT("li_email");
        try { email.focus(); } catch (e) {}
        return;
      }
      if (!window.DKF || !DKF.auth()) {
        if (gErr) gErr.textContent = dkT("li_loading");
        return;
      }
      eErr.textContent = "";
      forgotLink.setAttribute("aria-disabled", "true");
      forgotLink.textContent = dkT("li_reset_sending");
      DKF.auth().sendPasswordResetEmail(em)
        .then(function () {
          forgotLink.removeAttribute("aria-disabled");
          forgotLink.textContent = dkT("li_forgot");
          if (okEl) { okEl.textContent = dkT("li_reset_sent"); okEl.hidden = false; }
        })
        .catch(function (err) {
          forgotLink.removeAttribute("aria-disabled");
          forgotLink.textContent = dkT("li_forgot");
          if (gErr) gErr.textContent = DKF.friendlyError(err);
        });
    });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var ok = true;
    eErr.textContent = ""; pErr.textContent = "";
    if (gErr) gErr.textContent = "";
    if (cErr) cErr.textContent = "";
    if (okEl) { okEl.hidden = true; okEl.textContent = ""; }
    var em = email.value.trim();
    var emailOk = window.DKAuth ? DKAuth.EMAIL_RE.test(em) : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
    if (!emailOk) { eErr.textContent = dkT("li_email"); ok = false; }
    if (pw.value.length < 6) { pErr.textContent = dkT("li_pw"); ok = false; }
    /* Closure fix 3 (Nov 2026): distinguish empty vs wrong code —
     * a wrong code used to show the "please enter" prompt, which reads
     * as if nothing was typed. Read the input BEFORE cap.refresh()
     * clears it. */
    if (!cap || !cap.validate()) {
      if (cErr) cErr.textContent = dkT(capInput && capInput.value.trim() ? "li_captcha_wrong" : "li_captcha");
      if (cap) cap.refresh();
      ok = false;
    }
    if (!ok) return;
    if (!window.DKF || !DKF.auth()) {
      if (gErr) gErr.textContent = dkT("li_loading");
      return;
    }
    setBusy(true);
    // Honour Remember Me first, then sign in (unchanged handler).
    applyPersistence().then(function () {
      return DKF.auth().signInWithEmailAndPassword(em, pw.value);
    })
      .then(function (cred) { return DKF.ensureUserDoc(cred.user); })
      .then(function () { window.location.href = "dashboard.html"; })
      .catch(function (err) {
        setBusy(false);
        if (cap) cap.refresh(); // fresh code for the next attempt
        if (gErr) gErr.textContent = DKF.friendlyError(err);
      });
  });

  /* Google flow state for the focus-return safety net (see
   * DKAuth.resetGoogleOnFocusReturn in js/pages/auth-common.js):
   * true from click until the flow ends (credential, cancel, error). */
  var gFlowActive = false;
  var gDisarm = null;
  function gReset() {
    gFlowActive = false;
    if (gBtn) gBtn.disabled = false;
    if (gErr) gErr.textContent = dkT("li_gcancel");
  }

  var gBtn = document.getElementById("googleBtn");
  if (gBtn) {
    gBtn.addEventListener("click", function () {
      if (!window.DKF || !DKF.auth()) return;
      // CAPTCHA disabled for Google login — Google verifies users itself. Re-enable if needed.
      // if (!cap || !cap.validate()) {
      //   if (cErr) cErr.textContent = dkT("li_captcha");
      //   if (cap) cap.refresh();
      //   return;
      // }
      if (cErr) cErr.textContent = "";
      if (gErr) gErr.textContent = "";
      if (okEl) { okEl.hidden = true; okEl.textContent = ""; }
      gBtn.disabled = true;
      if (gErr) gErr.textContent = dkT("li_gopen");
      // Arm the safety net: if the chooser closes without the GIS
      // callback ever firing, a focus return re-enables the button.
      gFlowActive = true;
      if (gDisarm) gDisarm();
      if (window.DKAuth) gDisarm = DKAuth.resetGoogleOnFocusReturn(function () { return gFlowActive; }, gReset);
      // Remember Me applies to Google sign-in too.
      applyPersistence().then(function () {
        withGIS(function () {
          try {
            var tokenClient = google.accounts.oauth2.initTokenClient({
              client_id: GIS_CLIENT_ID,
              scope: "openid email profile",
              ux_mode: "popup",
              callback: function (tokenResp) {
                if (!tokenResp || !tokenResp.access_token) {
                  gFlowActive = false;
                  if (gDisarm) gDisarm();
                  gBtn.disabled = false;
                  if (gErr) gErr.textContent = dkT("li_gcancel");
                  return;
                }
                var cred = firebase.auth.GoogleAuthProvider.credential(null, tokenResp.access_token);
                DKF.auth().signInWithCredential(cred)
                  .then(function (uc) { return DKF.ensureUserDoc(uc.user); })
                  .then(function () { window.location.href = "dashboard.html"; })
                  .catch(function (err) {
                    gFlowActive = false;
                    if (gDisarm) gDisarm();
                    gBtn.disabled = false;
                    if (cap) cap.refresh();
                    if (gErr) gErr.textContent = DKF.friendlyError(err);
                  });
              }
            });
            tokenClient.requestAccessToken();
          } catch (e) {
            gFlowActive = false;
            if (gDisarm) gDisarm();
            gBtn.disabled = false;
            if (gErr) gErr.textContent = dkT("li_gstart");
          }
        });
      });
    });
  }
});
