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
    submitBtn.textContent = b ? "Creating account…" : "Create Account";
  }

  // CAPTCHA is required on every signup attempt.
  var cap = null;
  if (window.DKCaptcha) {
    cap = DKCaptcha.init(
      document.getElementById("capCanvas"),
      document.getElementById("capInput"),
      document.getElementById("capRefresh")
    );
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
    if (nm.length < 2) { nErr.textContent = "Please enter your name."; ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { eErr.textContent = "Please enter a valid email address."; ok = false; }
    if (pw.value.length < 6) { pErr.textContent = "Password must be at least 6 characters."; ok = false; }
    if (!cap || !cap.validate()) {
      if (cErr) cErr.textContent = "Please enter the security code shown above.";
      if (cap) cap.refresh();
      ok = false;
    }
    if (!ok) return;
    if (!window.DKF || !DKF.auth()) {
      if (gErr) gErr.textContent = "Sign-up is still loading. Please wait a moment and try again.";
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
