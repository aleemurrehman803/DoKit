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
          fs.src = U("/js/features.js?v=20261008-22");
          fs.defer = true;
          head.appendChild(fs);
        }
      }
    } catch (e) { /* silent: features are progressive enhancement */ }
  }
  /* ---------- idle prefetch of likely-next pages (speed) ----------
     Homepage  -> image-resizer + typing (most-visited next pages).
     Tool page -> homepage (common back-nav target).
     Uses <link rel="prefetch">, injected once on idle so it never
     competes with critical resources. CSP-safe (link prefetch of
     same-origin documents is allowed by default-src 'self'). */
  function initPrefetch() {
    try {
      var path = location.pathname;
      var isHome = /(^|\/)index\.html$/.test(path) || path === "/" || /\/DoKit\/?$/.test(path);
      var isTool = path.indexOf("/tools/") !== -1;
      var urls = [];
      if (isHome) {
        urls.push("/tools/image-resizer/", "/typing/");
      } else if (isTool) {
        urls.push("/");
      } else {
        return; /* other pages: nothing predictable to prefetch */
      }
      var U = (typeof window.DKU === "function") ? window.DKU : function (x) { return x; };
      var run = function () {
        var head = document.head || document.getElementsByTagName("head")[0];
        if (!head) return;
        urls.forEach(function (u) {
          var href = U(u);
          if (head.querySelector('link[rel="prefetch"][href="' + href + '"]')) return;
          var l = document.createElement("link");
          l.rel = "prefetch";
          l.href = href;
          l.setAttribute("data-dk-prefetch", "1");
          head.appendChild(l);
        });
      };
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(run, { timeout: 4000 });
      } else {
        setTimeout(run, 2500);
      }
    } catch (e) { /* silent: prefetch is best-effort */ }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { start(); initPrefetch(); });
  else { start(); initPrefetch(); }
})();

/* DoKit PWA install prompt (Phase 2, Oct 2026).
 * Listens for beforeinstallprompt, shows a dismissible custom banner with an
 * Install button only when the browser actually offers installation.
 * i18n: keys registered via DKI18N.add (EN + UR, others fall back to EN).
 * CSP-safe: no inline handlers, all strings via textContent. */
(function () {
  "use strict";
  var DISMISS_KEY = "dokit_pwa_dismissed_v1";
  var DISMISS_DAYS = 14;

  function t(key) {
    return (window.DKI18N && typeof window.DKI18N.t === "function") ? window.DKI18N.t(key) : key;
  }
  function regI18n() {
    var en = {
      "pwa.install_title": "Install DoKit",
      "pwa.install_desc": "Add DoKit to your home screen — open tools instantly, even offline.",
      "pwa.install_btn": "Install",
      "pwa.dismiss": "Not now"
    };
    var ur = {
      "pwa.install_title": "ڈوکٹ انسٹال کریں",
      "pwa.install_desc": "ڈوکٹ کو ہوم اسکرین پر رکھیں — ٹولز فوراً کھولیں، آف لائن بھی۔",
      "pwa.install_btn": "انسٹال کریں",
      "pwa.dismiss": "ابھی نہیں"
    };
    if (window.DKI18N && typeof window.DKI18N.add === "function") {
      window.DKI18N.add("en", en);
      window.DKI18N.add("ur", ur);
    } else {
      (window.__DKI18N_QUEUE__ = window.__DKI18N_QUEUE__ || []).push(["en", en], ["ur", ur]);
    }
  }
  function dismissed() {
    try {
      var v = window.localStorage.getItem(DISMISS_KEY);
      return v && (Date.now() - parseInt(v, 10)) < DISMISS_DAYS * 864e5;
    } catch (e) { return false; }
  }
  function markDismissed() {
    try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
  }
  function isInstalled() {
    try {
      return window.matchMedia && (window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches) ||
        (window.navigator && window.navigator.standalone === true);
    } catch (e) { return false; }
  }
  function showBanner(deferredPrompt) {
    if (document.getElementById("dk-pwa-banner") || isInstalled() || dismissed()) return;
    var bar = document.createElement("div");
    bar.id = "dk-pwa-banner";
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-live", "polite");
    bar.style.cssText = "position:fixed;inset-inline:1rem;bottom:1rem;z-index:9990;" +
      "display:flex;gap:.75rem;align-items:center;" +
      "background:var(--surface,#1d1836);color:var(--text,#fff);" +
      "border:1px solid var(--border,#3a3265);border-radius:1rem;" +
      "padding:.8rem 1rem;box-shadow:0 12px 32px rgba(0,0,0,.35);max-width:26rem;margin-inline:auto;";
    var icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.style.fontSize = "1.6rem";
    icon.textContent = "📲";
    var txt = document.createElement("div");
    txt.style.cssText = "flex:1;min-width:0";
    var h = document.createElement("strong");
    h.style.display = "block";
    h.textContent = t("pwa.install_title");
    h.setAttribute("data-i18n", "pwa.install_title");
    var p = document.createElement("p");
    p.style.cssText = "margin:.15rem 0 0;font-size:.85rem;opacity:.85";
    p.textContent = t("pwa.install_desc");
    p.setAttribute("data-i18n", "pwa.install_desc");
    txt.appendChild(h); txt.appendChild(p);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tbtn tbtn-primary tbtn-sm";
    btn.textContent = t("pwa.install_btn");
    btn.setAttribute("data-i18n", "pwa.install_btn");
    btn.addEventListener("click", function () {
      markDismissed();
      bar.remove();
      try {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () { deferredPrompt = null; }).catch(function () {});
      } catch (e) {}
    });
    var x = document.createElement("button");
    x.type = "button";
    x.className = "tbtn tbtn-ghost tbtn-sm";
    x.setAttribute("aria-label", t("pwa.dismiss"));
    x.textContent = "✕";
    x.addEventListener("click", function () { markDismissed(); bar.remove(); });
    bar.appendChild(icon); bar.appendChild(txt); bar.appendChild(btn); bar.appendChild(x);
    document.body.appendChild(bar);
  }
  function init() {
    regI18n();
    if (isInstalled()) return;
    var deferred = null;
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferred = e;
      // Small delay so it doesn't fight the first-visit tour for attention.
      setTimeout(function () { if (deferred) showBanner(deferred); }, 4000);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

/* Phase3 A1: privacy-first analytics loader (first-party, DNT-respecting). */
(function(){try{var sc=document.createElement("script");sc.src=(window.DKU?window.DKU("/js/analytics.js"):"/DoKit/js/analytics.js");sc.defer=true;document.head.appendChild(sc);}catch(e){}})();
