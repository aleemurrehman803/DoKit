# Case Converter — plugin module

Convert text between six letter cases: UPPER, lower, Title Case (hyphen-aware,
apostrophe-safe), Sentence case, aLtErNaTiNg, iNVERSE. Live character/word
counts, 3-tier clipboard copy.

## Files

- `index.html` — tool page (hero, input/output textareas, mode select, FAQ, how-to, related tools)
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
no `css/tools.css`. All 10-language strings this tool uses (48 keys) are inlined
at the top of `tool.js` and registered via `DKI18N.add()`.

Namespace: `window.CaseConverter` (exposes `convert`, `toTitle`, `toSentence`,
`toAlternating`, `toInverse`, `countWords`).

## How to test

```sh
node --check tools/case-converter/tool.js
```

Pure logic is node-testable (same stubs as the tools-builder self-test):

```sh
node -e "
globalThis.window = globalThis;
const cc = require('./tools/case-converter/tool.js');
console.log(cc.convert(\"don't stop\", 'title'));
console.log(cc.convert('hello world. how are you?', 'sentence'));
"
```

Behavior: open `index.html`, type text, switch modes, copy the output, clear.
