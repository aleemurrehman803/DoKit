/* i18n: user-facing strings via DKI18N (other languages fall back to English). */
var DK_STR = {
  "su_busy": "Creating account…",
  "su_create": "Create Account",
  "su_gfail": "Google sign-in failed to load. Check connection and try again.",
  "su_name": "Please enter your name.",
  "su_email": "Please enter a valid email address.",
  "su_pw": "Password must be at least 6 characters.",
  "su_pw_match": "Passwords do not match.",
  "su_pw_hint": "Minimum 6 characters",
  "su_pw_len_ok": "✓ Password is at least 6 characters.",
  "su_terms": "Please accept the Terms of Service and Privacy Policy to continue.",
  "su_captcha": "Please enter the security code shown above.",
  "su_captcha_wrong": "Incorrect security code. Please try the new code shown above.",
  "su_loading": "Sign-up is still loading. Please wait a moment and try again.",
  "su_gopen": "Opening Google sign-in…",
  "su_gcancel": "Google sign-in was cancelled.",
  "su_gstart": "Google sign-in could not start. Please try again.",
  "su_show": "Show",
  "su_hide": "Hide",
  "su_strength_weak": "Weak",
  "su_strength_fair": "Fair",
  "su_strength_good": "Good",
  "su_strength_strong": "Strong",
};
try { if (window.DKI18N) DKI18N.add("en", DK_STR); } catch (e) {}
function dkT(k) { try { if (window.DKI18N) return DKI18N.t(k); } catch (e) {} return DK_STR[k] || k; }
/* DoKit — signup page (Firebase Auth: create account + Google). */
document.addEventListener("DOMContentLoaded", function () {
  try { window.DKUI && (DKUI.renderNav("signup"), DKUI.renderFooter(), DKUI.init()); } catch (e) {}

  var form = document.getElementById("signupForm");
  var nameEl = document.getElementById("name");
  var email = document.getElementById("email");
  var pw = document.getElementById("password");
  var confirmEl = document.getElementById("confirm");
  var termsEl = document.getElementById("terms");
  var nErr = document.getElementById("err-name");
  var eErr = document.getElementById("err-email");
  var pErr = document.getElementById("err-password");
  var cfErr = document.getElementById("err-confirm");
  var tErr = document.getElementById("err-terms");
  var gErr = document.getElementById("err-general");
  var cErr = document.getElementById("err-captcha");
  var submitBtn = form.querySelector('button[type="submit"]');

  function setBusy(b) {
    submitBtn.disabled = b;
    submitBtn.textContent = b ? dkT("su_busy") : dkT("su_create");
  }

  // Show/hide toggles (shared helper in js/pages/auth-common.js).
  // Closure fix 2 (Nov 2026): pass getters, not captured strings, so
  // a mid-session language switch re-renders Show/Hide in the new
  // language (the old captured dkT() values stayed English in UR).
  if (window.DKAuth) {
    DKAuth.bindPwToggle(pw, document.getElementById("pwToggle"),
      function () { return dkT("su_show"); }, function () { return dkT("su_hide"); });
    DKAuth.bindPwToggle(confirmEl, document.getElementById("confirmToggle"),
      function () { return dkT("su_show"); }, function () { return dkT("su_hide"); });
  }

  // Live password-strength meter + confirm-match feedback while typing.
  var meter = document.getElementById("pwMeter");
  var strengthLabel = document.getElementById("pw-strength-label");
  /* Closure fix 2 (Nov 2026): strength words via a getter, evaluated
   * per render — the old array was captured once at bind time and
   * stayed English ("Strong") after a switch to Urdu, while the
   * hint next to it translated. Re-render on dokit:langchange so a
   * switch mid-form updates the word without another keystroke. */
  function strengthWords() {
    return [dkT("su_strength_weak"), dkT("su_strength_fair"), dkT("su_strength_good"), dkT("su_strength_strong")];
  }
  function refreshStrength() {
    if (window.DKAuth) DKAuth.renderStrength(meter, strengthLabel, pw.value, strengthWords);
  }
  document.addEventListener("dokit:langchange", refreshStrength);
  function refreshConfirm() {
    if (!cfErr || !confirmEl) return;
    // Only flag a mismatch once the user has typed something in confirm.
    cfErr.textContent = (confirmEl.value && confirmEl.value !== pw.value) ? dkT("su_pw_match") : "";
  }
  if (pw) pw.addEventListener("input", function () { refreshStrength(); refreshConfirm(); });
  if (confirmEl) confirmEl.addEventListener("input", refreshConfirm);
  refreshStrength();

  // Closure fix (Nov 2026): the "Minimum 6 characters" hint used to
  // stay visible even for a strong password — same shared helper as
  // the directory pages, so it flips to a success line once the
  // length rule is met (the hint is about length; the meter above
  // it is about strength).
  if (window.DKAuth && DKAuth.bindPwHint) {
    DKAuth.bindPwHint(pw, document.getElementById("pwd-hint"),
      function () { return dkT("su_pw_hint"); },
      function () { return dkT("su_pw_len_ok"); });
  }

  // CAPTCHA is required on every signup attempt.
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
      if (gErr) gErr.textContent = dkT("su_gfail");
    };
    document.head.appendChild(s);
  }

  if (window.DKF) {
    DKF.onUser(function (user) {
      if (user) window.location.href = "dashboard.html";
    });
    /* Closure fix (Nov 2026): warm the App Check token now, while
     * the user fills the form — see DKF.warmAppCheck. */
    try { DKF.warmAppCheck(); } catch (e) {}
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var ok = true;
    nErr.textContent = ""; eErr.textContent = ""; pErr.textContent = "";
    if (cfErr) cfErr.textContent = "";
    if (tErr) tErr.textContent = "";
    if (gErr) gErr.textContent = "";
    if (cErr) cErr.textContent = "";
    var nm = nameEl.value.trim();
    var em = email.value.trim();
    var emailOk = window.DKAuth ? DKAuth.EMAIL_RE.test(em) : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
    if (nm.length < 2) { nErr.textContent = dkT("su_name"); ok = false; }
    if (!emailOk) { eErr.textContent = dkT("su_email"); ok = false; }
    if (pw.value.length < 6) { pErr.textContent = dkT("su_pw"); ok = false; }
    if (confirmEl && confirmEl.value !== pw.value) { if (cfErr) cfErr.textContent = dkT("su_pw_match"); ok = false; }
    if (termsEl && !termsEl.checked) { if (tErr) tErr.textContent = dkT("su_terms"); ok = false; }
    /* Closure fix 3 (Nov 2026): distinguish empty vs wrong code —
     * a wrong code used to show the "please enter" prompt, which reads
     * as if nothing was typed. Read the input BEFORE cap.refresh()
     * clears it. */
    if (!cap || !cap.validate()) {
      if (cErr) cErr.textContent = dkT(capInput && capInput.value.trim() ? "su_captcha_wrong" : "su_captcha");
      if (cap) cap.refresh();
      ok = false;
    }
    if (!ok) return;
    if (!window.DKF || !DKF.auth()) {
      if (gErr) gErr.textContent = dkT("su_loading");
      return;
    }
    setBusy(true);
    DKF.auth().createUserWithEmailAndPassword(em, pw.value)
      .then(function (cred) {
        return cred.user.updateProfile({ displayName: nm }).catch(function () {}).then(function () { return cred.user; });
      })
      .then(function (user) { return DKF.ensureUserDoc(user); })
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
    if (gErr) gErr.textContent = dkT("su_gcancel");
  }

  var gBtn = document.getElementById("googleBtn");
  if (gBtn) {
    gBtn.addEventListener("click", function () {
      if (!window.DKF || !DKF.auth()) return;
      // CAPTCHA is required every time, including Google sign-in.
      if (cErr) cErr.textContent = "";
      if (gErr) gErr.textContent = "";
      if (!cap || !cap.validate()) {
        if (cErr) cErr.textContent = dkT(capInput && capInput.value.trim() ? "su_captcha_wrong" : "su_captcha");
        if (cap) cap.refresh();
        return;
      }
      gBtn.disabled = true;
      if (gErr) gErr.textContent = dkT("su_gopen");
      // Arm the safety net: if the chooser closes without the GIS
      // callback ever firing, a focus return re-enables the button.
      gFlowActive = true;
      if (gDisarm) gDisarm();
      if (window.DKAuth) gDisarm = DKAuth.resetGoogleOnFocusReturn(function () { return gFlowActive; }, gReset);
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
                if (gErr) gErr.textContent = dkT("su_gcancel");
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
          if (gErr) gErr.textContent = dkT("su_gstart");
        }
      });
    });
  }
});
