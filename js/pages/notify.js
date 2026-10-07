/* DoKit notify-me form (coming-soon.html).
   Binds BEFORE info.js's DOMContentLoaded handler (deferred scripts execute
   before DOMContentLoaded fires), so stopImmediatePropagation() reliably
   supersedes the generic localStorage-only handler in info.js.
   Flow: try Firestore collection "notify_list" via DKF compat first;
   always also mirror to localStorage, then show the success message. */
(function () {
  "use strict";
  var form = document.getElementById("notifyForm");
  if (!form) return;

  function showMsg(ok, text) {
    var box = document.getElementById("notifyMsg");
    if (!box) return;
    box.style.display = "block";
    box.style.borderColor = ok ? "var(--dk-violet, #6C4CF1)" : "var(--danger, #e5484d)";
    box.querySelector("p").textContent = text;
    box.setAttribute("role", "status");
  }

  function toast() {
    try { if (window.DKUI && DKUI.toast) DKUI.toast("notify_ok"); } catch (e) {}
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    e.stopImmediatePropagation(); /* own the form; info.js handler must not run */
    var name = (document.getElementById("nName").value || "").trim();
    var email = (document.getElementById("nEmail").value || "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMsg(false, "Please enter a valid email address.");
      return;
    }

    var record = { name: name, email: email, ts: Date.now(), page: "coming-soon" };

    function done() {
      try { window.localStorage.setItem("dokit_notify", JSON.stringify(record)); } catch (err) {}
      form.reset();
      showMsg(true, "You're on the list! We'll send one email when new tools launch. No spam, ever.");
      toast();
    }

    try {
      var db = (window.DKF && typeof window.DKF.db === "function") ? window.DKF.db() : null;
      if (db) {
        db.collection("notify_list").add(record).then(done, function () { done(); });
        return;
      }
    } catch (err) { /* fall through to local fallback */ }
    done();
  });
})();
