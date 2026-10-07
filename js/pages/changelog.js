/* DoKit — public changelog page.
 * Lists published entries from the `changelog` collection (newest first).
 * CSP-safe: external file only. All content escaped. */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  onReady(function () {
    var box = document.getElementById("clList");
    if (!box) return;

    function render(entries) {
      if (!entries.length) {
        box.innerHTML = "<p>No releases yet — check back soon.</p>";
        return;
      }
      box.innerHTML = entries.map(function (e) {
        var items = Array.isArray(e.items) ? e.items : [];
        return '<article class="cl-entry">' +
          "<h2>" + esc(e.version || "") + "</h2>" +
          '<p class="cl-date">' + esc(e.date || "") + "</p>" +
          "<ul>" + items.map(function (it) {
            return "<li>" + esc(String(it).slice(0, 400)) + "</li>";
          }).join("") + "</ul></article>";
      }).join("");
    }

    try {
      var DKF = window.DKF;
      var db = (DKF && typeof DKF.db === "function") ? DKF.db() : null;
      if (!db) { box.innerHTML = "<p>Couldn't load the changelog right now.</p>"; return; }
      // Single-field equality query only (no composite index needed);
      // sorting is done client-side.
      db.collection("changelog")
        .where("published", "==", true)
        .limit(100).get()
        .then(function (snap) {
          var entries = [];
          snap.forEach(function (doc) { entries.push(doc.data() || {}); });
          entries.sort(function (a, b) { return String(b.date || "") < String(a.date || "") ? -1 : 1; });
          render(entries);
        })
        .catch(function () {
          box.innerHTML = "<p>Couldn't load the changelog right now.</p>";
        });
    } catch (err) {
      box.innerHTML = "<p>Couldn't load the changelog right now.</p>";
    }
  });
})();
