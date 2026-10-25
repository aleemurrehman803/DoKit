/* DoKit i18n engine — port of the old site's js/i18n-v2.js behaviour.
 *
 * WHAT THIS IS
 *   A plain classic script (no build step, no CDN, no framework). It applies
 *   translations to any element carrying a data-i18n attribute, remembers the
 *   visitor's language, and flips the page direction for RTL languages.
 *
 * WHAT CHANGED vs. THE OLD ENGINE (deliberately, and why)
 *   1. Fallback keeps the author's English text. The old engine's t() returned
 *      a "humanized" key (e.g. "mytool.result" -> "Mytool result") when a key
 *      was missing, which could put a nonsense string on the page. A missing
 *      translation here leaves the element's existing text untouched, so the
 *      worst case is honest English — never a blank element, never a raw key.
 *   2. The old apply() skipped any translation containing a "." character,
 *      which silently blocked most full-sentence translations (footer tagline,
 *      pricing lede, ...). This engine applies any non-empty translation.
 *   3. The old selector was rendered by ui.js renderNav() (JS-built header)
 *      with "beta" tags on ar/hi/de/ru. The new header is static HTML from
 *      the generator, so this engine self-wires the static selector markup
 *      (see bindSelector below) and carries no beta tags: the chrome keys in
 *      i18n-dict.js are fully translated in all 10 languages except the four
 *      newer tool names, which fall back to English (see README.md).
 *   4. Global name is window.DK_I18N. window.DKI18N is kept as an alias so
 *      any old snippet calling DKI18N.t()/setLang() keeps working.
 *
 * CONTRACTS THE PARENT MUST KEEP (see README.md for the full list)
 *   - Load i18n-dict.js BEFORE this file (both with defer, in that order).
 *     The engine still reads window.DK_I18N_DICT live on every lookup, so a
 *     swapped order degrades gracefully instead of breaking.
 *   - Put data-i18n ONLY on leaf elements (elements whose whole text content
 *     is the string). Applying textContent to a wrapper would wipe its child
 *     links/buttons — that is why the footer base line must be split into
 *     spans first (see data-i18n-attributes.md).
 *   - data-i18n-ph sets placeholder, data-i18n-aria sets aria-label,
 *     data-i18n-title sets title. Never put data-i18n on an <input>: its
 *     visible text is the placeholder, not textContent.
 *
 * STORAGE & URL CONTRACTS (unchanged from the old site, so returning
 * visitors and shared links keep working)
 *   - Choice persists as localStorage "dokit_lang" (same key as the old site).
 *   - "?lang=xx" on any URL forces that language for this visit AND persists
 *     it — kept because the old site used it for sharing/testing links.
 *   - An unknown or missing stored value falls back to "en", never to a
 *     broken state. localStorage access is wrapped in try/catch because
 *     private-mode browsers can throw on access.
 */
(function () {
  'use strict';

  /* Languages in selector order, with the native name shown in the menu.
   * WHY this order and these names: copied exactly from the old header
   * (ui.js language list), so returning visitors see the same menu. */
  var LANGS = [
    ['en', 'English'],
    ['ur', 'اردو'],
    ['ar', 'العربية'],
    ['hi', 'हिन्दी'],
    ['es', 'Español'],
    ['fr', 'Français'],
    ['pt', 'Português'],
    ['de', 'Deutsch'],
    ['tr', 'Türkçe'],
    ['ru', 'Русский']
  ];

  /* WHY only these two are RTL: the old engine flipped direction for exactly
   * ur and ar. The other eight languages are LTR even when their script is
   * non-Latin (Hindi, Russian), so they must NOT be added here. */
  var RTL_LANGS = { ur: true, ar: true };

  var STORAGE_KEY = 'dokit_lang';

  /* Is this code a valid language? Used to reject junk from storage/URL so a
   * corrupted value can never leave the page in an unknown-language state. */
  function isLang(code) {
    for (var i = 0; i < LANGS.length; i++) {
      if (LANGS[i][0] === code) return true;
    }
    return false;
  }

  /* Resolve the current language: URL "?lang=" wins (and is persisted, as on
   * the old site), then the stored choice, then English. */
  function current() {
    try {
      var q = new URLSearchParams(window.location.search).get('lang');
      if (q && isLang(q)) {
        try { window.localStorage.setItem(STORAGE_KEY, q); } catch (e) { /* private mode: ignore */ }
        return q;
      }
    } catch (e) { /* old browsers without URLSearchParams: fall through */ }
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && isLang(stored)) return stored;
    } catch (e) { /* private mode: ignore */ }
    return 'en';
  }

  /* Translate one key. Returns null when there is NO translation in either
   * the current language or English — the caller then keeps the element's
   * existing text, so nothing ever renders blank or as a raw key.
   * WHY read the dict live here instead of caching it at load: if a future
   * supplemental dict file (DK_I18N.add) lands after this script, lookups
   * still see it without a reload. */
  function t(key) {
    var dict = window.DK_I18N_DICT || {};
    var lang = current();
    var perLang = dict[lang] || {};
    if (typeof perLang[key] === 'string' && perLang[key] !== '') return perLang[key];
    var en = dict.en || {};
    if (typeof en[key] === 'string' && en[key] !== '') return en[key];
    return null;
  }

  /* Apply translations to every marked element on the page, and set
   * <html lang> + <html dir>. WHY set dir here on every apply (not just on
   * language change): a page rendered server-side as lang="en" dir="ltr"
   * must be corrected for a returning ur/ar visitor even if nothing else
   * on the page changes. */
  function apply(lang) {
    lang = lang || current();
    var root = document.documentElement;
    root.lang = lang;
    root.dir = RTL_LANGS[lang] ? 'rtl' : 'ltr';

    /* data-i18n: element text. Inputs/textareas show their placeholder, not
     * textContent, so for them the translation goes to placeholder instead
     * (same rule the old engine used). */
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var value = t(nodes[i].getAttribute('data-i18n'));
      if (value === null) continue; /* no translation anywhere: keep author's English */
      var tag = nodes[i].tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') nodes[i].setAttribute('placeholder', value);
      else nodes[i].textContent = value;
    }

    /* data-i18n-ph / -aria / -title: attributes, never text. Split into three
     * loops (not one generic loop) so a typo in one attribute name cannot
     * silently write a translation into the wrong attribute. */
    var ph = document.querySelectorAll('[data-i18n-ph]');
    for (var p = 0; p < ph.length; p++) {
      var v = t(ph[p].getAttribute('data-i18n-ph'));
      if (v !== null) ph[p].setAttribute('placeholder', v);
    }
    var aria = document.querySelectorAll('[data-i18n-aria]');
    for (var a = 0; a < aria.length; a++) {
      var av = t(aria[a].getAttribute('data-i18n-aria'));
      if (av !== null) aria[a].setAttribute('aria-label', av);
    }
    var titles = document.querySelectorAll('[data-i18n-title]');
    for (var ti = 0; ti < titles.length; ti++) {
      var tv = t(titles[ti].getAttribute('data-i18n-title'));
      if (tv !== null) titles[ti].setAttribute('title', tv);
    }

    refreshSelector(lang);
  }

  /* Keep the header selector in sync with the active language: the current
   * language label, the button's aria-label, and which menu item is marked
   * selected. WHY a separate function: setLang(), apply(), and the initial
   * load all need it, and dynamic pages can call refresh() after injecting
   * new markup without re-applying every translation. */
  function refreshSelector(lang) {
    lang = lang || current();
    var label = lang;
    for (var i = 0; i < LANGS.length; i++) {
      if (LANGS[i][0] === lang) label = LANGS[i][1];
    }
    var cur = document.getElementById('langCur');
    if (cur) cur.textContent = label;
    var btn = document.getElementById('langBtn');
    if (btn) {
      var selectLabel = t('lang_select_label') || 'Language';
      btn.setAttribute('aria-label', selectLabel + ': ' + label);
    }
    var menu = document.getElementById('langMenu');
    if (menu) {
      var items = menu.querySelectorAll('li[data-lang]');
      for (var j = 0; j < items.length; j++) {
        items[j].setAttribute('aria-selected', String(items[j].getAttribute('data-lang') === lang));
      }
    }
  }

  /* Switch language: persist, re-apply, and tell the page. WHY dispatch a
   * custom event (old contract "dokit:langchange"): static [data-i18n] nodes
   * update automatically, but JS-rendered text (tool results, dynamic cards)
   * cannot — listeners re-render themselves on this event instead of the
   * engine having to know about every widget. */
  function setLang(code) {
    if (!isLang(code)) code = 'en';
    try { window.localStorage.setItem(STORAGE_KEY, code); } catch (e) { /* private mode: ignore */ }
    apply(code);
    try {
      document.dispatchEvent(new CustomEvent('dokit:langchange', { detail: { lang: code } }));
    } catch (e) { /* very old browsers: translation already applied above */ }
  }

  /* Wire the static header selector (header-selector.html). WHY self-wire
   * here instead of in main.js: the selector must work on every page even if
   * main.js changes, and keeping all language behaviour in one file means
   * there is exactly one place to fix selector bugs. The dataset flag stops
   * double-binding if this script ever runs twice. */
  function bindSelector() {
    var btn = document.getElementById('langBtn');
    var menu = document.getElementById('langMenu');
    if (!btn || !menu) return;
    if (btn.dataset.i18nBound) return;
    btn.dataset.i18nBound = '1';

    function close() {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation(); /* WHY: the document click-closer below would otherwise close it instantly */
      var willOpen = menu.hidden;
      menu.hidden = !willOpen;
      btn.setAttribute('aria-expanded', String(willOpen));
    });
    document.addEventListener('click', close);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') close();
    });
    function pick(item) {
      if (!item) return;
      setLang(item.getAttribute('data-lang'));
      close();
    }
    menu.addEventListener('click', function (ev) {
      var item = ev.target.closest ? ev.target.closest('li[data-lang]') : null;
      pick(item);
    });
    menu.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var item = ev.target.closest ? ev.target.closest('li[data-lang]') : null;
      if (item) { ev.preventDefault(); pick(item); }
    });
  }

  /* Public API. getLang/refresh are aliases kept because the old engine
   * exposed them and old snippets may call them. */
  var api = {
    langs: LANGS.map(function (l) { return l[0]; }),
    current: current,
    getLang: current,
    setLang: setLang,
    t: t,
    apply: apply,
    refresh: apply,
    refreshSelector: refreshSelector,
    /* Merge a supplemental dictionary (old "DKI18N.add" contract). WHY keep
     * this: if the parent later ports more old dict files (tool pages, guides),
     * they can load as before without touching this engine — and the merge
     * re-applies immediately so the new strings show without a reload. */
    add: function (lang, dict) {
      if (!isLang(lang) || !dict || typeof dict !== 'object') return;
      window.DK_I18N_DICT = window.DK_I18N_DICT || {};
      window.DK_I18N_DICT[lang] = window.DK_I18N_DICT[lang] || {};
      for (var k in dict) {
        if (Object.prototype.hasOwnProperty.call(dict, k) && typeof dict[k] === 'string') {
          window.DK_I18N_DICT[lang][k] = dict[k];
        }
      }
      apply(current());
    }
  };
  window.DK_I18N = api;
  window.DKI18N = api; /* alias: old global name, same object, no second system */

  /* Initial run: apply stored/URL language and wire the selector. Deferred
   * scripts run after parsing, so the DOM is ready; the readyState check is
   * only belt-and-braces for non-defer loading. */
  function init() {
    apply(current());
    bindSelector();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
