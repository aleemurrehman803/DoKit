/* DoKit — contact form: Firestore first, mailto fallback.
   Binds #dk-contact-form (a unique id so js/pages/info.js's legacy
   #contactForm handler does not double-submit). CSP-safe: external file only. */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function toast(msg) {
    try { if (window.DKUI && typeof DKUI.toast === "function") DKUI.toast(msg); } catch (e) {}
  }

  function showResult(sent, name) {
    var box = $("contactResult");
    if (!box) return;
    var title = box.querySelector("[data-cf-title]");
    var body = box.querySelector("[data-cf-body]");
    if (sent) {
      if (title) title.textContent = "Message received \u2014 thank you!";
      if (body) body.textContent = "Thanks" + (name ? " " + name : "") +
        "! Your message has been saved securely and we'll get back to you within 24\u201348 hours.";
    } else {
      if (title) title.textContent = "Opening your email app\u2026";
      if (body) body.textContent = "Your email app should open with everything pre-filled \u2014 just press send. " +
        "If it didn't open, write to malikjalil014@gmail.com instead. Nothing was lost.";
    }
    box.hidden = false;
    try { box.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) {}
  }

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  onReady(function () {
    var form = $("dk-contact-form");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      if (typeof form.reportValidity === "function" && !form.reportValidity()) return;

      var name = $("cfName").value.trim();
      var email = $("cfEmail").value.trim();
      var subject = $("cfSubject").value;
      var message = $("cfMessage").value.trim();

      var mailBody = "Name: " + name + "\nEmail: " + email + "\nSubject: " + subject + "\n\n" + message;

      function mailtoFallback() {
        window.location.href = "mailto:malikjalil014@gmail.com?subject=" +
          encodeURIComponent("[DoKit] " + subject) + "&body=" + encodeURIComponent(mailBody);
        showResult(false);
        toast("Opening your email app\u2026");
      }

      var payload = {
        name: name,
        email: email,
        subject: subject,
        message: message,
        page: window.location.pathname,
        userAgent: String(navigator.userAgent || "").slice(0, 200)
      };
      try {
        payload.createdAt = (window.firebase && firebase.firestore && firebase.firestore.FieldValue)
          ? firebase.firestore.FieldValue.serverTimestamp()
          : new Date().toISOString();
      } catch (err) {
        payload.createdAt = new Date().toISOString();
      }

      try {
        var DKF = window.DKF;
        var db = (DKF && typeof DKF.db === "function") ? DKF.db() : null;
        if (db) {
          db.collection("contact_messages").add(payload).then(
            function () {
              form.reset();
              showResult(true, name);
              toast("Message sent \u2014 thank you!");
            },
            function () { mailtoFallback(); }
          );
          return;
        }
      } catch (err) { /* fall through to mailto */ }

      mailtoFallback();
    });
  });
})();
