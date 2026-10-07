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
    submitBtn.textContent = b ? "Logging in…" : "Log In";
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
      if (gErr) gErr.textContent = "Google sign-in failed to load. Check connection and try again.";
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { eErr.textContent = "Please enter a valid email address."; ok = false; }
    if (pw.value.length < 6) { pErr.textContent = "Password must be at least 6 characters."; ok = false; }
    if (!cap || !cap.validate()) {
      if (cErr) cErr.textContent = "Please enter the security code shown above.";
      if (cap) cap.refresh();
      ok = false;
    }
    if (!ok) return;
    if (!window.DKF || !DKF.auth()) {
      if (gErr) gErr.textContent = "Sign-in is still loading. Please wait a moment and try again.";
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
      // CAPTCHA is required every time, including Google sign-in.
      if (cErr) cErr.textContent = "";
      if (gErr) gErr.textContent = "";
      if (!cap || !cap.validate()) {
        if (cErr) cErr.textContent = "Please enter the security code shown above.";
        if (cap) cap.refresh();
        return;
      }
      gBtn.disabled = true;
      if (gErr) gErr.textContent = "Opening Google sign-in…";
      withGIS(function () {
        try {
          var tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GIS_CLIENT_ID,
            scope: "openid email profile",
            ux_mode: "popup",
            callback: function (tokenResp) {
              if (!tokenResp || !tokenResp.access_token) {
                gBtn.disabled = false;
                if (gErr) gErr.textContent = "Google sign-in was cancelled.";
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
          if (gErr) gErr.textContent = "Google sign-in could not start. Please try again.";
        }
      });
    });
  }
});
