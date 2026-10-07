/* i18n: user-facing strings via DKI18N (other languages fall back to English). */
var DK_STR = {
  "li_busy": "Logging in…",
  "li_login": "Log In",
  "li_gfail": "Google sign-in failed to load. Check connection and try again.",
  "li_email": "Please enter a valid email address.",
  "li_pw": "Password must be at least 6 characters.",
  "li_captcha": "Please enter the security code shown above.",
  "li_loading": "Sign-in is still loading. Please wait a moment and try again.",
  "li_gopen": "Opening Google sign-in…",
  "li_gcancel": "Google sign-in was cancelled.",
  "li_gstart": "Google sign-in could not start. Please try again.",
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
  var submitBtn = form.querySelector('button[type="submit"]');

  function setBusy(b) {
    submitBtn.disabled = b;
    submitBtn.textContent = b ? dkT("li_busy") : dkT("li_login");
  }

  // CAPTCHA is required on every login attempt.
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
      if (gErr) gErr.textContent = dkT("li_gfail");
    };
    document.head.appendChild(s);
  }

  // Already signed in? Skip to dashboard.
  if (window.DKF) {
    DKF.onUser(function (user) {
      if (user) window.location.href = "dashboard.html";
    });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var ok = true;
    eErr.textContent = ""; pErr.textContent = "";
    if (gErr) gErr.textContent = "";
    if (cErr) cErr.textContent = "";
    var em = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { eErr.textContent = dkT("li_email"); ok = false; }
    if (pw.value.length < 6) { pErr.textContent = dkT("li_pw"); ok = false; }
    if (!cap || !cap.validate()) {
      if (cErr) cErr.textContent = dkT("li_captcha");
      if (cap) cap.refresh();
      ok = false;
    }
    if (!ok) return;
    if (!window.DKF || !DKF.auth()) {
      if (gErr) gErr.textContent = dkT("li_loading");
      return;
    }
    setBusy(true);
    DKF.auth().signInWithEmailAndPassword(em, pw.value)
      .then(function (cred) { return DKF.ensureUserDoc(cred.user); })
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
      // CAPTCHA disabled for Google login — Google verifies users itself. Re-enable if needed.
      // if (!cap || !cap.validate()) {
      //   if (cErr) cErr.textContent = dkT("li_captcha");
      //   if (cap) cap.refresh();
      //   return;
      // }
      if (cErr) cErr.textContent = "";
      if (gErr) gErr.textContent = "";
      gBtn.disabled = true;
      if (gErr) gErr.textContent = dkT("li_gopen");
      withGIS(function () {
        try {
          var tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GIS_CLIENT_ID,
            scope: "openid email profile",
            ux_mode: "popup",
            callback: function (tokenResp) {
              if (!tokenResp || !tokenResp.access_token) {
                gBtn.disabled = false;
                if (gErr) gErr.textContent = dkT("li_gcancel");
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
          if (gErr) gErr.textContent = dkT("li_gstart");
        }
      });
    });
  }
});
