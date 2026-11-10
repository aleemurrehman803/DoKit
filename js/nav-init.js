/* DoKit — shared nav/footer init (js/nav-init.js).
 *
 * WHY this file exists (CQ-003, 10 Nov 2026): the guides, wall-of-love,
 * status and api/docs pages rendered their nav/footer ONLY from an inline
 * <script> calling DKUI.renderNav/renderFooter — but their own CSP
 * (script-src 'self', no 'unsafe-inline') blocks inline scripts, so
 * #site-nav and #site-foot stayed empty: no navigation, no footer, and
 * no theme/language init (DKUI.init never ran). Other pages already make
 * the same call from external page scripts (js/pages/home.js, info.js,
 * login.js, ...); these pages had no such script. This one shared module
 * does the same call from an external file the CSP allows — DRY, no
 * per-page inline script, no CSP hash to maintain.
 *
 * The nav section comes from #site-nav[data-section] ("guides", "love",
 * ...); pages without the attribute get "" (no nav item marked active).
 * It also stamps #statusTime when present: status.html's inline stamp
 * was blocked by the same CSP, so the "last checked" time stayed "—".
 */
(function () {
  "use strict";

  /* Stamp the status page's "last checked" time (no-op elsewhere). */
  function stampStatusTime() {
    var el = document.getElementById("statusTime");
    if (!el) return;
    try {
      el.textContent = new Date().toLocaleString(undefined, {
        dateStyle: "medium", timeStyle: "short"
      });
    } catch (e) {
      el.textContent = new Date().toString();
    }
  }

  function init() {
    try {
      if (window.DKUI) {
        var nav = document.getElementById("site-nav");
        var section = (nav && nav.getAttribute("data-section")) || "";
        DKUI.renderNav(section);
        DKUI.renderFooter();
        DKUI.init();
      }
    } catch (e) {
      /* Nav is decorative; a render failure must never break the page. */
    }
    stampStatusTime();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
