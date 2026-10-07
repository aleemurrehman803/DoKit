/* i18n: user-facing strings via DKI18N (other languages fall back to English). */
var DK_STR = {
  "su_busy": "Creating account…",
  "su_create": "Create Account",
  "su_gfail": "Google sign-in failed to load. Check connection and try again.",
  "su_name": "Please enter your name.",
  "su_email": "Please enter a valid email address.",
  "su_pw": "Password must be at least 6 characters.",
  "su_captcha": "Please enter the security code shown above.",
  "su_loading": "Sign-up is still loading. Please wait a moment and try again.",
  "su_gopen": "Opening Google sign-in…",
  "su_gcancel": "Google sign-in was cancelled.",
  "su_gstart": "Google sign-in could not start. Please try again.",
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
  var nErr = document.getElementById("err-name");
  var eErr = document.getElementById("err-email");
  var pErr = document.getElementById("err-password");
  var gErr = document.getElementById("err-general");
  var cErr = document.getElementById("err-captcha");
  var submitBtn = form.querySelector('button[type="submit"]');

  function setBusy(b) {
    submitBtn.disabled = b;
    submitBtn.textContent = b ? dkT("su_busy") : dkT("su_create");
  }

  // CAPTCHA is required on every signup attempt.
  var cap = null;
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
      gBtn.disabled = false;
      if (gErr) gErr.textContent = dkT("su_gfail");
    };
    document.head.appendChild(s);
  }

  if (window.DKF) {
    DKF.onUser(function (user) {
      if (user) window.location.href = "dashboard.html";
    });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var ok = true;
    nErr.textContent = ""; eErr.textContent = ""; pErr.textContent = "";
    if (gErr) gErr.textContent = "";
    if (cErr) cErr.textContent = "";
    var nm = nameEl.value.trim();
    var em = email.value.trim();
    if (nm.length < 2) { nErr.textContent = dkT("su_name"); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { eErr.textContent = dkT("su_email"); ok = false; }
    if (pw.value.length < 6) { pErr.textContent = dkT("su_pw"); ok = false; }
    if (!cap || !cap.validate()) {
      if (cErr) cErr.textContent = dkT("su_captcha");
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

  var gBtn = document.getElementById("googleBtn");
  if (gBtn) {
    gBtn.addEventListener("click", function () {
      if (!window.DKF || !DKF.auth()) return;
      // CAPTCHA is required every time, including Google sign-in.
      if (cErr) cErr.textContent = "";
      if (gErr) gErr.textContent = "";
      if (!cap || !cap.validate()) {
        if (cErr) cErr.textContent = dkT("su_captcha");
        if (cap) cap.refresh();
        return;
      }
      gBtn.disabled = true;
      if (gErr) gErr.textContent = dkT("su_gopen");
      withGIS(function () {
        try {
          var tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GIS_CLIENT_ID,
            scope: "openid email profile",
            ux_mode: "popup",
            callback: function (tokenResp) {
              if (!tokenResp || !tokenResp.access_token) {
                gBtn.disabled = false;
                if (gErr) gErr.textContent = dkT("su_gcancel");
                return;
              }
              var cred = firebase.auth.GoogleAuthProvider.credential(null, tokenResp.access_token);
              DKF.auth().signInWithCredential(cred)
                .then(function (uc) { return DKF.ensureUserDoc(uc.user); })
                .then(function () { window.location.href = "dashboard.html"; })
                .catch(function (err) {
                  gBtn.disabled = false;
                  if (cap) cap.refresh();
                  if (gErr) gErr.textContent = DKF.friendlyError(err);
                });
            }
          });
          tokenClient.requestAccessToken();
        } catch (e) {
          gBtn.disabled = false;
          if (gErr) gErr.textContent = dkT("su_gstart");
        }
      });
    });
  }
});
