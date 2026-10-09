/* DoKit — Wall of Love testimonial submit (js/wall-of-love.js)
 * Form -> Firestore `testimonials` (status:"pending", admin approves).
 * Spam guards: honeypot + 1 submission/day (localStorage). DNT respected. */
(function () {
  "use strict";
  function T(k, fb) {
    try {
      if (window.DKI18N && typeof window.DKI18N.t === "function") {
        var v = window.DKI18N.t(k);
        if (typeof v === "string" && v !== k) return v;
      }
    } catch (e) {}
    return fb;
  }
  function getDb() {
    try { return (window.DKF && typeof window.DKF.db === "function") ? window.DKF.db() : null; }
    catch (e) { return null; }
  }
  function withDb(fn, n) {
    n = (n == null) ? 12 : n;
    var db = getDb();
    if (db) { try { fn(db); } catch (e) {} return; }
    if (n > 0) setTimeout(function () { withDb(fn, n - 1); }, 500);
  }
  function ts() {
    try {
      if (window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue &&
          typeof window.firebase.firestore.FieldValue.serverTimestamp === "function")
        return window.firebase.firestore.FieldValue.serverTimestamp();
    } catch (e) {}
    return new Date();
  }
  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  ready(function () {
    var form = document.getElementById("wolForm");
    if (!form) return;
    // Respect Do Not Track: still allow the form, but skip persistence.
    var dnt = false;
    try { dnt = window.navigator && window.navigator.doNotTrack === "1"; } catch (e) {}
    var status = document.getElementById("wolStatus");
    function say(key, fb) { status.hidden = false; status.textContent = T(key, fb); }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var hp = document.getElementById("wolWebsite");
      var btn = document.getElementById("wolSubmit");
      if (hp && hp.value) { // honeypot: bot filled it -> pretend success
        say("wol.form_thanks", "Thank you! Your feedback was received.");
        form.reset();
        return;
      }
      try {
        var last = parseInt(window.localStorage.getItem("wol_last") || "0", 10);
        if (Date.now() - last < 864e5) {
          say("wol.form_ratelimit", "You've already sent feedback today \u2014 thank you!");
          return;
        }
      } catch (e2) {}
      var name = String(document.getElementById("wolName").value || "").trim().slice(0, 60);
      var msg = String(document.getElementById("wolMsgText").value || "").trim().slice(0, 500);
      var rating = parseInt((document.getElementById("wolRating") || {}).value || "5", 10) || 5;
      if (!name || !msg) { say("wol.form_error", "Please fill in your name and message."); return; }
      btn.disabled = true;
      var orig = btn.textContent;
      btn.textContent = T("wol.form_sending", "Sending\u2026");
      var done = false;
      function finish(ok) {
        if (done) return;
        done = true;
        btn.disabled = false;
        btn.textContent = orig;
        if (ok) { try { window.localStorage.setItem("wol_last", String(Date.now())); } catch (e3) {} form.reset(); }
        say("wol.form_thanks", "Thank you! Your feedback was received.");
      }
      if (dnt) { finish(true); return; }
      withDb(function (db) {
        try {
          db.collection("testimonials").add({
            name: name, message: msg, rating: rating,
            status: "pending", page: "wall-of-love", createdAt: ts()
          }).then(function () { finish(true); }, function () { finish(false); });
        } catch (err) { finish(false); }
      });
      // Never leave the user stuck on "Sending…".
      setTimeout(function () { finish(false); }, 7000);
    });
  });
})();
