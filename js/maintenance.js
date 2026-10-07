/* DoKit — maintenance mode checker (#19).
 *
 * Redirects public visitors to maintenance.html when
 * `site_settings/general.maintenanceMode` is true in Firestore.
 *
 * Skipped on: /admin/* (admins must always reach the panel),
 * maintenance.html itself (avoid redirect loops), and when Firebase is
 * unavailable (fail-open: the site keeps working).
 *
 * Vanilla JS, no dependencies. Load AFTER js/firebase.js on public pages.
 */
(function () {
  "use strict";

  function getDb() {
    try {
      return (window.DKF && typeof window.DKF.db === "function") ? window.DKF.db() : null;
    } catch (e) { return null; }
  }

  function pathOf() {
    try { return window.location.pathname || ""; } catch (e) { return ""; }
  }

  function isMaintenancePage() { return /maintenance\.html$/.test(pathOf()); }

  function shouldSkip() {
    var path = pathOf();
    if (/(^|\/)admin(\/|$)/.test(path)) return true; // admin panel stays reachable
    if (/^data:|^about:blank/.test(path)) return true;
    return false;
  }

  /* On maintenance.html itself: show the admin's custom message (no redirect). */
  function renderCustomMessage(db) {
    var el = document.getElementById("maintMsg");
    if (!el) return;
    db.collection("site_settings").doc("general").get().then(function (snap) {
      if (!snap || !snap.exists) return;
      var msg = (snap.data() || {}).maintenanceMessage;
      if (msg) el.textContent = String(msg).slice(0, 200);
    }).catch(function () { /* keep default text */ });
  }

  function targetUrl() {
    try {
      if (window.DKU) return window.DKU("/maintenance.html");
    } catch (e) {}
    // Fallback: resolve relative to the site root segment.
    try {
      var parts = window.location.pathname.split("/");
      // Keep the first path segment (e.g. "/dokit") when it looks like a base.
      if (parts.length > 2 && parts[1]) return "/" + parts[1] + "/maintenance.html";
    } catch (e) {}
    return "/maintenance.html";
  }

  function tryCheck(attempts) {
    if (shouldSkip()) return;
    var db = getDb();
    if (!db) {
      if (attempts < 20) setTimeout(function () { tryCheck(attempts + 1); }, 500);
      return; // fail-open: no Firebase → no redirect
    }
    if (isMaintenancePage()) { renderCustomMessage(db); return; } // no loop
    db.collection("site_settings").doc("general").get().then(function (snap) {
      if (!snap || !snap.exists) return;
      var c = snap.data() || {};
      if (c.maintenanceMode === true) {
        try { window.location.replace(targetUrl()); } catch (e) {}
      }
    }).catch(function () { /* silent: maintenance is optional */ });
  }

  function start() { tryCheck(0); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
