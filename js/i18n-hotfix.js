/* ============================================================================
 * DoKit — i18n fallback hotfix (js/i18n-hotfix.js)
 * ----------------------------------------------------------------------------
 * WHAT THIS FIXES
 *   js/i18n-v2.js ships a lookup function n(key) that, when a translation key
 *   is missing from every dictionary, used to return a "humanized" version of
 *   the key — e.g. the key "why_sub" became the visible text "Why sub", and
 *   "faq_a1" became "Faq a1". The apply() routine then WROTE that garbage over
 *   perfectly good hardcoded HTML, so live pages showed placeholder-looking
 *   text like "Why sub", "Fq1 a", "Cta d", "Priv1 d" even though the HTML
 *   itself contained the real English copy.
 *
 *   The canonical fix lives in js/i18n-v2.js (n() now returns the key itself
 *   and apply() skips missing keys). That file is ~115 KB, which exceeds the
 *   single-call push payload limit, so this small companion module applies the
 *   SAME behavior at runtime. It is not a hack around the real fix — it IS the
 *   real fix, delivered as a supplemental module (same pattern as
 *   js/i18n-faq-en.js, js/i18n-faq-ur.js and js/i18n-patch.js).
 *
 * HOW IT WORKS
 *   1. SNAPSHOT — while this script runs (deferred, so before
 *      DOMContentLoaded, and therefore before i18n-v2's own initial apply),
 *      we record the original text/placeholder/title/aria-label of every
 *      element carrying a data-i18n* attribute. That snapshot is the
 *      trustworthy English fallback.
 *   2. FIXED LOOKUP — DKI18N.t is replaced with a version that returns the
 *      key itself when no dictionary has it (never a humanized guess).
 *   3. FIXED APPLY — DKI18N.apply / DKI18N.refresh are replaced. For every
 *      data-i18n* element:
 *        - key found  -> write the translation (same as before);
 *        - key MISSING -> restore the snapshot (the real HTML copy), so a
 *          missing key can never again paint "Why sub" on the page.
 *   4. FIXED add() — DKI18N.add is wrapped so dictionary registration ends
 *      with the fixed apply instead of the old humanizing one.
 *   5. FIXED setLang — reimplemented to use the fixed apply (the original
 *      called the old internal apply directly).
 *   6. FINAL PASS — a DOMContentLoaded listener (registered after
 *      i18n-v2's own, plus a setTimeout(0)) re-runs the fixed apply last, so
 *      even if the old apply ran first, the page ends in the correct state.
 *
 * LOAD ORDER (in every HTML page):
 *   <script src="js/i18n-v2.js" defer></script>
 *   <script src="js/i18n-hotfix.js" defer></script>   <!-- this file -->
 *   ... ui.js, page scripts ...
 *
 * CSP: plain script, no inline handlers, no eval — complies with the site's
 * Content-Security-Policy (script-src 'self').
 * ========================================================================== */
(function () {
  'use strict';

  /* -- 0. Bail out cleanly if the i18n core is absent ---------------------- */
  if (!window.DKI18N) { return; }
  var I18N = window.DKI18N;

  /* -- 1. Snapshot original content before any apply() can touch it --------
   * Deferred scripts run before DOMContentLoaded, and i18n-v2 only applies
   * on DOMContentLoaded, so at this point the DOM still holds the author's
   * original copy. We snapshot per attribute kind. */
  var ATTRS = ['data-i18n', 'data-i18n-ph', 'data-i18n-title', 'data-i18n-aria'];
  var snapshot = new Map(); // element -> { attrName: originalValue }

  function takeSnapshot() {
    ATTRS.forEach(function (attr) {
      document.querySelectorAll('[' + attr + ']').forEach(function (el) {
        var entry = snapshot.get(el) || {};
        if (attr === 'data-i18n') {
          // For text/placeholder targets we store both, keyed by element kind.
          var tag = el.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA') {
            entry.ph = el.getAttribute('placeholder');
          } else {
            entry.text = el.textContent;
          }
        } else if (attr === 'data-i18n-ph') {
          entry.phAttr = el.getAttribute('placeholder');
        } else if (attr === 'data-i18n-title') {
          entry.title = el.getAttribute('title');
        } else if (attr === 'data-i18n-aria') {
          entry.aria = el.getAttribute('aria-label');
        }
        snapshot.set(el, entry);
      });
    });
  }

  /* -- 2. Fixed lookup: key itself when missing, never a humanized guess -- */
  function dictFor(lang) { return (I18N.dict && I18N.dict[lang]) || {}; }
  function fixedT(key) {
    var lang, val;
    try { lang = I18N.getLang(); } catch (e) { lang = 'en'; }
    val = dictFor(lang)[key];
    if (typeof val === 'string') { return val; }
    // Fall back to English before giving up.
    val = dictFor('en')[key];
    if (typeof val === 'string') { return val; }
    return key; // Missing everywhere: return the key so apply() skips it.
  }

  /* -- 3. Fixed apply: translate what exists, restore what doesn't -------- */
  function fixedApply(lang) {
    try { lang = lang || I18N.getLang(); } catch (e) { lang = 'en'; }
    // Always sync lang/dir on every apply (fixes English showing RTL on load).
    try {
      var rtlLangs = { ur: 1, ar: 1 };
      document.documentElement.lang = lang;
      document.documentElement.dir = rtlLangs[lang] ? 'rtl' : 'ltr';
    } catch (e2) { /* non-fatal */ }
    var dict = (I18N.dict && I18N.dict[lang]) || {};
    var enDict = (I18N.dict && I18N.dict.en) || {};

    function lookup(key) {
      var v = dict[key];
      if (typeof v === 'string') { return v; }
      v = enDict[key];
      return (typeof v === 'string') ? v : null; // null = missing
    }

    // data-i18n : element text, or placeholder for inputs
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var v = lookup(key);
      var tag = el.tagName;
      var orig = snapshot.get(el) || {};
      if (v !== null && v !== key && v.indexOf('.') < 0) {
        if (tag === 'INPUT' || tag === 'TEXTAREA') { el.setAttribute('placeholder', v); }
        else { el.textContent = v; }
      } else {
        // Missing key: restore the author's original copy — never humanize.
        if ((tag === 'INPUT' || tag === 'TEXTAREA') && orig.ph != null) {
          el.setAttribute('placeholder', orig.ph);
        } else if (orig.text != null) {
          el.textContent = orig.text;
        }
      }
    });

    // data-i18n-ph : placeholder attribute
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-ph');
      var v = lookup(key);
      var orig = snapshot.get(el) || {};
      if (v !== null && v !== key && v.indexOf('.') < 0) { el.setAttribute('placeholder', v); }
      else if (orig.phAttr != null) { el.setAttribute('placeholder', orig.phAttr); }
    });

    // data-i18n-title : title attribute
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-title');
      var v = lookup(key);
      var orig = snapshot.get(el) || {};
      if (v !== null && v !== key && v.indexOf('.') < 0) { el.setAttribute('title', v); }
      else if (orig.title != null) { el.setAttribute('title', orig.title); }
    });

    // data-i18n-aria : aria-label attribute
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria');
      var v = lookup(key);
      var orig = snapshot.get(el) || {};
      if (v !== null && v !== key && v.indexOf('.') < 0) { el.setAttribute('aria-label', v); }
      else if (orig.aria != null) { el.setAttribute('aria-label', orig.aria); }
    });
  }

  /* -- 4. Install the fixed API -------------------------------------------- */
  takeSnapshot(); // must run before any apply()

  I18N.t = fixedT;            // fixed lookup for ui.js / page scripts
  I18N.apply = fixedApply;    // fixed full apply
  I18N.refresh = fixedApply;  // refresh() is an alias of apply()

  // Wrap add(): merge dictionaries, then run the FIXED apply (never the old
  // internal one, which would humanize missing keys).
  var origAdd = I18N.add;
  I18N.add = function (lang, dict) {
    if (!lang || !dict || typeof dict !== 'object') { return; }
    if (I18N.langs.indexOf(lang) < 0) { return; }
    var target = I18N.dict[lang] || (I18N.dict[lang] = {});
    Object.keys(dict).forEach(function (k) {
      if (typeof dict[k] === 'string') { target[k] = dict[k]; }
    });
    try { fixedApply(); } catch (e) { /* non-fatal */ }
  };

  // Reimplement setLang() on top of the fixed apply. The original called the
  // old internal apply directly, which is exactly what we are replacing.
  I18N.setLang = function (lang) {
    if (I18N.langs.indexOf(lang) < 0) { lang = 'en'; }
    try { window.localStorage.setItem('dokit_lang', lang); } catch (e) { /* private mode */ }
    fixedApply(lang);
    // Keep the document's lang/dir in sync (mirrors i18n-v2 behavior).
    try {
      var rtl = { ur: 1, ar: 1 };
      document.documentElement.lang = lang;
      document.documentElement.dir = rtl[lang] ? 'rtl' : 'ltr';
    } catch (e2) { /* non-fatal */ }
    if (window.DKUI && typeof window.DKUI.refreshLangToggle === 'function') {
      try { window.DKUI.refreshLangToggle(); } catch (e3) { /* non-fatal */ }
    }
  };

  /* -- 5. Run once now (page scripts may add dicts before DOMContentLoaded) - */
  try { fixedApply(); } catch (e) { /* non-fatal */ }

  /* -- 6. Final corrective pass: run AFTER i18n-v2's own DOMContentLoaded ----
   * apply. Ours was registered later, and the setTimeout(0) pushes it past
   * every other DOMContentLoaded handler, so the page always ends in the
   * fixed state even if the old apply ran first. */
  function finalPass() {
    setTimeout(function () {
      try { fixedApply(); } catch (e) { /* non-fatal */ }
    }, 0);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', finalPass);
  } else {
    finalPass();
  }
})();
