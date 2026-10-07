/* DoKit — API docs "notify me at launch" form (api/docs.html).
   Same pattern as js/pages/notify.js: validate the email, then best-effort
   write to the Firestore `notify` collection as
     { email, interest: "api", createdAt }
   (createdAt uses a server timestamp when available). Always mirror to
   localStorage and show the success message; no-ops gracefully when
   Firebase is absent (DKF.db() returns null). CSP-safe: no inline handlers. */
(function () {
  "use strict";
  var form = document.getElementById("apiNotifyForm");
  if (!form) return;

  function showMsg(ok, text) {
    var box = document.getElementById("apiNotifyMsg");
    if (!box) return;
    box.style.display = "block";
    var p = box.querySelector("p");
    if (p) p.textContent = text;
    box.style.color = ok ? "var(--success-text, #1F7A4D)" : "var(--danger, #e5484d)";
    box.setAttribute("role", "status");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = (document.getElementById("apiNotifyEmail").value || "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMsg(false, "Please enter a valid email address.");
      return;
    }

    var F = null;
    try { F = firebase.firestore.FieldValue; } catch (err) { /* compat lib absent */ }
    var record = {
      email: email,
      interest: "api",
      createdAt: F ? F.serverTimestamp() : new Date()
    };

    function done() {
      try {
        window.localStorage.setItem("dokit_api_notify",
          JSON.stringify({ email: email, interest: "api", ts: Date.now() }));
      } catch (err) {}
      form.reset();
      showMsg(true, "You're on the list! We'll send you one email the moment the API backend goes live. No spam, ever.");
    }

    try {
      var d = (window.DKF && typeof window.DKF.db === "function") ? window.DKF.db() : null;
      if (d) {
        d.collection("notify").add(record).then(done, function () { done(); });
        return;
      }
    } catch (err) { /* fall through to local fallback */ }
    done();
  });
})();
