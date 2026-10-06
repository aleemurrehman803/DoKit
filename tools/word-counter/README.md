# Word Counter — plugin module

Live text statistics: words, characters (with/without spaces), sentences,
paragraphs, reading time, speaking time, plus a top-10 keyword density table
with English + Urdu stopword filtering. 3-tier clipboard copy.

## Files

- `index.html` — tool page (hero, textarea, stat cards, keyword table, FAQ, how-to, related tools)
- `tool.js` — all tool logic, incl. node-testable pure functions
- `tool.css` — full copy of the generic tool component styles (duplication is the
  price of plugin isolation)
- `README.md` — this file

## Dependencies (only these shared files)

- `../../css/tokens.css` — design tokens
- `../../js/i18n.js` — `DKI18N` (10 languages: en, ur, ar, hi, es, fr, pt, de, tr, ru)
- `../../js/ui.js` — `DKUI` v1.0.0 (`renderNav` / `renderFooter` / `init`)

This tool never used the image utils; its only former shared dep was a
`DKIMG.toastMsg` fallback, now a plugin-local `toastMsgFallback()`. Zero
cross-imports: no other tool folder, no `js/tools/`, no `js/i18n-tools.js`,
no `css/tools.css`. All 10-language strings this tool uses (49 keys) are inlined
at the top of `tool.js` and registered via `DKI18N.add()`.

Namespace: `window.WordCounter` (exposes `countText`, `topKeywords`, `wordsOf`).

## How to test

```sh
node --check tools/word-counter/tool.js
```

Pure logic is node-testable (same stubs as the tools-builder self-test):

```sh
node -e "
globalThis.window = globalThis;
const wc = require('./tools/word-counter/tool.js');
console.log(wc.countText('hello world. hi!'));
console.log(wc.topKeywords('the cat sat on the mat mat', 3).map(k => k.word + ':' + k.count));
"
```

Behavior: open `index.html`, type/paste text (try Urdu), watch live stats and the
keyword table, copy the stats, clear.
