/* DoKit — login page (Firebase Auth: email/password + Google). */
document.addEventListener("DOMContentLoaded", function () {
  try { window.DKUI && (DKUI.renderNav("login"), DKUI.renderFooter(), DKUI.init()); } catch (e) {}

  var form = document.getElementById("loginForm");
  var email = document.getElementById("email");
  var pw = document.getElementById("password");
  var eErr = document.getElementById("err-email");
  var pErr = document.getElementById("err-password");
  var gErr = document.getElementById("err-general");
  var submitBtn = form.querySelector('button[type="submit"]');

  function setBusy(b) {
    submitBtn.disabled = b;
    submitBtn.textContent = b ? "Logging in…" : "Log In";
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
    var em = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { eErr.textContent = "Please enter a valid email address."; ok = false; }
    if (pw.value.length < 6) { pErr.textContent = "Password must be at least 6 characters."; ok = false; }
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
        if (gErr) gErr.textContent = DKF.friendlyError(err);
      });
  });

  var gBtn = document.getElementById("googleBtn");
  if (gBtn) {
    gBtn.addEventListener("click", function () {
      if (!window.DKF || !DKF.auth()) return;
      if (gErr) gErr.textContent = "";
      gBtn.disabled = true;
      DKF.auth().signInWithPopup(DKF.googleProvider())
        .then(function (cred) { return DKF.ensureUserDoc(cred.user); })
        .then(function () { window.location.href = "dashboard.html"; })
        .catch(function (err) {
          gBtn.disabled = false;
          if (gErr) gErr.textContent = DKF.friendlyError(err);
        });
    });
  }
});
