# DoKit i18n Developer Guide

**10 languages:** `en`, `ur`, `ar`, `hi`, `es`, `fr`, `pt`, `de`, `tr`, `ru`
**Engine:** `js/i18n-v2.js` → `window.DKI18N` · **Do not create a second system.**

---

## 1. The golden rule

> **Component → Translation Key → Central Dictionary → All 10 Languages**

- ❌ Never hard-code user-facing text (`<button>Submit</button>`).
- ❌ Never create a separate language state, selector, or `localStorage` key.
- ❌ Never invent tool-specific translation logic.
- ✅ Every user-visible string goes through `DKI18N`.

## 2. Static HTML — use `data-i18n` attributes

```html
<h1 data-i18n="mytool.title">My Tool</h1>
<input data-i18n-ph="mytool.search_ph" placeholder="Search…">
<button data-i18n-aria="mytool.go" aria-label="Go">…</button>
<button data-i18n-title="mytool.tip" title="Tip">…</button>
```

The HTML fallback text (English) is the safety net: if a key is missing, the
page keeps the author's English copy instead of showing a raw key.

## 3. JavaScript-rendered text — use `DKI18N.t()`

```js
function t(k, fb) {
  var v = (window.DKI18N && typeof window.DKI18N.t === 'function') ? window.DKI18N.t(k) : null;
  return (typeof v === 'string' && v) ? v : (fb || k);
}
el.textContent = t('mytool.result', 'Result');
```

Missing keys return a **humanized fallback** (`mytool.result` → "Mytool result"),
never a raw key. A `console.warn('[i18n] missing key: …')` fires so you notice.

## 4. React to language changes

Static `[data-i18n]` nodes update automatically. **JS-rendered** content
(dropdowns, cards, results, canvas labels) must re-render — subscribe:

```js
document.addEventListener('dokit:langchange', function (e) {
  // e.detail.lang === 'ur' | 'en' | …
  try { renderMyDynamicUI(); } catch (err) { /* non-fatal */ }
});
```

This replaces the old fragile pattern of monkey-patching `DKI18N.setLang`.

## 5. Registering dictionaries

Supplemental dict files use the queue-safe pattern (never a silent `return`):

```js
(function () {
  function __dkAdd(l, d) {
    if (window.DKI18N && typeof window.DKI18N.add === 'function') { window.DKI18N.add(l, d); }
    else {
      (window.__DKI18N_QUEUE__ = window.__DKI18N_QUEUE__ || []).push([l, d]);
      if (window.console && console.warn) console.warn('[i18n] DKI18N not ready - queued dict for ' + l);
    }
  }
  __dkAdd('en', { 'mytool.title': 'My Tool' });
  __dkAdd('ur', { 'mytool.title': 'میرا ٹول' });
  // … all 10 languages
})();
```

Queued dicts are drained automatically when the core engine initializes.

## 6. Key naming

- Namespace per tool/page: `mytool.title`, `mytool.search_ph` (dotted).
- Shared UI: `common.*`, `tool_*` (homepage cards), `img.*` (image errors).
- Placeholders end with `_ph`, aria labels are registered for `data-i18n-aria`.
- Placeholders inside strings use `{name}` and must be preserved in every language.

## 7. RTL

`ur` and `ar` set `document.dir = 'rtl'` automatically. Use **CSS logical
properties** (`margin-inline-start`, not `margin-left`) so layouts mirror
without duplicated markup.

## 8. Before you push — run the checker

```bash
node scripts/i18n-check.js
```

It fails (exit 1) when:
- English is missing any key used in a `data-i18n*` attribute,
- any language ships an **empty** translation,
- any `tool_*` homepage key is missing in any language.

Missing non-English keys are warnings (English fallback covers them) — but
translate them anyway.

## 9. URL parameter

`?lang=ur` on any URL forces that language on load (and persists it).
Useful for sharing/testing: `https://…/DoKit/tools/word-counter/?lang=ur`.

## 10. What NOT to translate

IDs, usernames, URLs, database values, code, brand names — only localize
content intended for users.

---

*Phase 3 architecture (Oct 2026): fail-safe fallback → queue-safe loading →
`dokit:langchange` reactivity → build-time coverage check.*
