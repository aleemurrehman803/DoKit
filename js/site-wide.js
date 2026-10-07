/* DoKit — site-wide public loader: announcement bar + frontend features.
 *
 * Reads the PUBLIC Firestore doc `site_settings/announcement` and injects a
 * dismissible bar above the site header when the announcement is enabled and
 * within its date range. Also honors the `announcement_bar` feature flag
 * (site_settings/flags) — if the flag is explicitly false, the bar stays off.
 *
 * Also loads css/features.css + js/features.js (WhatsApp share, feedback,
 * newsletter, shortcuts, recents, favorites, tutorials, analytics).
 *
 * No-op when Firebase is unavailable or the docs don't exist: the site works
 * exactly as before. All strings are inserted via textContent (XSS-safe);
 * the link URL is allow-listed (relative or http(s) only). No inline
 * handlers — CSP-safe. Vanilla JS, no dependencies.
 */
(function () {
  "use strict";

  var DISMISS_KEY = "dokit_ann_dismissed_v1";
  var BAR_ID = "dk-announce-bar";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function getDb() {
    try {
      return (window.DKF && typeof window.DKF.db === "function") ? window.DKF.db() : null;
    } catch (e) { return null; }
  }

  function inDateRange(a) {
    var now = Date.now();
    // Scheduled publishing (#5): a "scheduled" announcement with a future
    // publishAt stays hidden until its time (or until the admin due-check /
    // Cloud Function flips it to "live").
    // Scheduled publishing (#5): hidden while status is "scheduled" (until
    // the admin panel's due-check or a Cloud Function flips it to "live"),
    // or while publishAt is still in the future.
    var pubAt = Number(a.publishAt) || 0;
    if (a.status === "scheduled") return false;
    if (pubAt && pubAt > now) return false;
    if (a.startDate) {
      var s = Date.parse(a.startDate + "T00:00:00");
      if (!isNaN(s) && now < s) return false;
    }
    if (a.endDate) {
      var e = Date.parse(a.endDate + "T23:59:59");
      if (!isNaN(e) && now > e) return false;
    }
    return true;
  }

  function safeUrl(u) {
    if (!u) return null;
    u = String(u).trim();
    if (u.charAt(0) === "/") return u; // relative link
    if (/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(u)) return u;
    return null;
  }

  function wasDismissed(version) {
    try {
      return window.sessionStorage.getItem(DISMISS_KEY) === String(version);
    } catch (e) { return false; }
  }

  function markDismissed(version) {
    try { window.sessionStorage.setItem(DISMISS_KEY, String(version)); } catch (e) {}
  }

  function renderBar(a, version) {
    if (document.getElementById(BAR_ID)) return;
    var bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.setAttribute("role", "note");
    bar.setAttribute("style",
      "background:#6C4CF1;color:#fff;text-align:center;padding:.55rem 2.5rem .55rem 1rem;" +
      "font-size:.92rem;position:relative;z-index:60;line-height:1.4;");

    var msg = document.createElement("span");
    msg.textContent = a.text;
    bar.appendChild(msg);

    var url = safeUrl(a.linkUrl);
    if (url && a.linkText) {
      var link = document.createElement("a");
      link.href = url;
      link.textContent = " " + a.linkText;
      link.setAttribute("style", "color:#fff;font-weight:700;text-decoration:underline;");
      if (url.charAt(0) !== "/") { link.target = "_blank"; link.rel = "noopener"; }
      bar.appendChild(link);
    }

    var close = document.createElement("button");
    close.type = "button";
    close.textContent = "✕";
    close.setAttribute("aria-label", "Dismiss announcement");
    close.setAttribute("style",
      "position:absolute;right:.6rem;top:50%;transform:translateY(-50%);background:none;" +
      "border:none;color:#fff;font-size:1rem;cursor:pointer;padding:.25rem .5rem;");
    close.addEventListener("click", function () {
      markDismissed(version);
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    });
    bar.appendChild(close);

    if (document.body) document.body.insertBefore(bar, document.body.firstChild);
  }

  function tryLoad(attempts) {
    var db = getDb();
    if (!db) {
      // Firebase not ready yet (deferred scripts) — retry briefly, then give up quietly.
      if (attempts < 20) setTimeout(function () { tryLoad(attempts + 1); }, 500);
      return;
    }
    var annRef = db.collection("site_settings").doc("announcement");
    var flagsRef = db.collection("site_settings").doc("flags");
    Promise.all([
      annRef.get().catch(function () { return null; }),
      flagsRef.get().catch(function () { return null; })
    ]).then(function (res) {
      var annSnap = res[0], flagsSnap = res[1];
      if (!annSnap || !annSnap.exists) return;
      var a = annSnap.data() || {};
      if (!a.enabled || !a.text) return;
      // Feature flag can force the bar off.
      if (flagsSnap && flagsSnap.exists) {
        var flags = flagsSnap.data() || {};
        if (flags.announcement_bar === false) return;
      }
      if (!inDateRange(a)) return;
      var version = a.updatedAt && a.updatedAt.toMillis
        ? a.updatedAt.toMillis()
        : String(a.text).length + ":" + (a.startDate || "") + (a.endDate || "");
      if (wasDismissed(version)) return;
      renderBar(a, version);
    }).catch(function () { /* silent: bar is optional */ });
  }

  function start() {
    tryLoad(0);
    // Render nav + footer on pages without a dedicated page script (e.g. tool pages).
    // Uses dk-footer id (tool pages) or site-foot id (main pages).
    try {
      if (window.DKUI) {
        if (document.getElementById("site-nav") && !document.getElementById("site-nav").hasChildNodes()) {
          DKUI.renderNav("");
        } else if (document.getElementById("site-nav")) {
          // Nav placeholder exists but may be empty — render anyway if no brand link.
          if (!document.querySelector("#site-nav .brand")) DKUI.renderNav("");
        }
        var footEl = document.getElementById("dk-footer") || document.getElementById("site-foot");
        if (footEl && !footEl.hasChildNodes()) {
          DKUI.renderFooter();
        }
      }
    } catch (e) { /* silent: nav/footer are progressive enhancement */ }
    // Load DoKit frontend features (css/features.css + js/features.js):
    // WhatsApp share, feedback modal, newsletter row, keyboard shortcuts,
    // recent tools, favorites, tutorial sections, page-view analytics.
    // features.js is self-guarding and no-ops when its targets are missing.
    try {
      var U = (typeof window.DKU === "function") ? window.DKU : function (p) { return p; };
      var head = document.head || document.getElementsByTagName("head")[0];
      if (head) {
        if (!document.querySelector('link[data-dkf="features-css"]')) {
          var fl = document.createElement("link");
          fl.rel = "stylesheet";
          fl.setAttribute("data-dkf", "features-css");
          fl.href = U("/css/features.css");
          head.appendChild(fl);
        }
        if (!document.querySelector('script[data-dkf="features-js"]')) {
          var fs = document.createElement("script");
          fs.setAttribute("data-dkf", "features-js");
          fs.src = U("/js/features.js");
          fs.defer = true;
          head.appendChild(fs);
        }
      }
    } catch (e) { /* silent: features are progressive enhancement */ }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
