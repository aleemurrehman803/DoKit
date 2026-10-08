/* DoKit privacy-first analytics — first-party only, no third-party trackers.
   Events: pageview {page, lang, ts} + tool_used {page, tool, action, ts}.
   NO PII: no cookies, no fingerprinting, no IP storage, referrer host only.
   Respects navigator.doNotTrack === "1" (sends nothing).
   Batched via Firestore WriteBatch every 5s to protect Spark quota.
   All failures are silent — analytics never breaks the site.
   Firestore rules (already deployed): match /analytics/{evtId} allow create
   when page is a non-empty string <= 200 chars; read = admin only. */
(function () {
  "use strict";
  if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return;

  var QUEUE = [];
  var FLUSH_MS = 5000;
  var MAX_BATCH = 40;
  var flushing = false;

  function lang() {
    try { return (window.DKI18N && DKI18N.getLang && DKI18N.getLang()) || document.documentElement.lang || "en"; }
    catch (e) { return "en"; }
  }
  function page() {
    try {
      var p = window.location.pathname || "/";
      // normalize: strip trailing "index.html"
      p = p.replace(/index\.html$/, "");
      return p.slice(0, 200) || "/";
    } catch (e) { return "/"; }
  }
  function toolSlug() {
    var m = page().match(/^\/DoKit\/tools\/([^\/]+)\/?$/) || window.location.pathname.match(/\/tools\/([^\/]+)\/?$/);
    return m ? m[1].slice(0, 60) : null;
  }

  function enqueue(type, extra) {
    try {
      var e = { type: type, page: page(), lang: String(lang()).slice(0, 8), ts: null };
      if (extra && typeof extra === "object") {
        for (var k in extra) {
          if (Object.prototype.hasOwnProperty.call(extra, k) && typeof extra[k] === "string")
            e[k] = extra[k].slice(0, 120);
        }
      }
      // referrer host only, never full URL
      try {
        var r = document.referrer ? new URL(document.referrer).hostname : "";
        if (r && r !== window.location.hostname) e.ref = r.slice(0, 80);
      } catch (e2) {}
      QUEUE.push(e);
      if (QUEUE.length >= MAX_BATCH) flush();
    } catch (e3) {}
  }

  function flush() {
    if (flushing || !QUEUE.length) return;
    var db = null;
    try { db = (window.DKF && window.DKF.db) ? window.DKF.db() : null; } catch (e) {}
    if (!db) { QUEUE.length = 0; return; } // firebase not ready — drop silently
    flushing = true;
    var batch = QUEUE.splice(0, MAX_BATCH);
    try {
      var wb = db.batch();
      var col = db.collection("analytics");
      batch.forEach(function (e) {
        e.ts = firebase.firestore.FieldValue.serverTimestamp();
        wb.set(col.doc(), e);
      });
      wb.commit().then(function () { flushing = false; if (QUEUE.length) flush(); },
        function () { flushing = false; /* quota/rules error — drop silently */ });
    } catch (e) { flushing = false; }
  }

  // pageview on load
  function init() {
    try {
      enqueue("pageview", {});
      setInterval(flush, FLUSH_MS);
      // flush when tab hides (best-effort)
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") flush();
      });
      // generic tool_used: clicks on primary buttons inside tool pages
      var slug = toolSlug();
      if (slug) {
        document.addEventListener("click", function (ev) {
          try {
            var b = ev.target && ev.target.closest ? ev.target.closest("button, a.btn, input[type=submit]") : null;
            if (!b) return;
            var label = (b.textContent || b.value || "").trim().slice(0, 40);
            enqueue("tool_used", { tool: slug, action: label });
          } catch (e) {}
        }, { passive: true });
      }
    } catch (e) {}
  }

  window.DKAnalytics = {
    track: function (type, extra) { enqueue(String(type).slice(0, 30), extra || {}); },
    toolUsed: function (tool, action) { enqueue("tool_used", { tool: tool, action: action }); },
    flush: flush
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
