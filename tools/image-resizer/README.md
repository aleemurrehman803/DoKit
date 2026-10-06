# Image Resizer — plugin module

Resize any image in seconds: exact pixels or percentage, aspect-ratio lock,
PNG / JPEG / WebP export with quality control. 100% client-side; files never
leave the device.

## Files

- `index.html` — tool page (hero, dropzone, controls, result, FAQ, how-to, related tools)
- `tool.js` — all tool logic (state machine: idle → loading → done | error)
- `tool.css` — full copy of the generic tool component styles (duplication is the
  price of plugin isolation)
- `README.md` — this file

## Dependencies (only these shared files)

- `../../css/tokens.css` — design tokens
- `../../js/i18n.js` — `DKI18N` (10 languages: en, ur, ar, hi, es, fr, pt, de, tr, ru)
- `../../js/ui.js` — `DKUI` v1.0.0 (`renderNav` / `renderFooter` / `init` / `image.*`)

Zero cross-imports: no other tool folder, no `js/tools/`, no `js/image.js`,
no `js/i18n-tools.js`, no `css/tools.css`. All 10-language strings this tool uses
(61 keys) are inlined at the top of `tool.js` and registered via `DKI18N.add()`.

## Image pipeline

`tool.js` defines plugin-local shims with the same signatures as the old shared
`DKIMG` API, each delegating to `DKUI.image` v1.0.0:

| local shim | delegates to |
|---|---|
| `loadImageFile(file)` → `{bitmap, w, h, name, prescaled}` | `DKUI.image.loadFile` + `DKUI.image.fitToMP` (preserves the >16MP pre-scale + notice) |
| `canvasToBlob(canvas, ext, quality)` | `DKUI.image.toBlob(canvas, mime, quality)` |
| `downloadBlob(blob, filename)` | `DKUI.image.download` (iOS-Safari fallback included) |
| `revoke(url)` / `formatBytes(n)` | `DKUI.image.revoke` / `DKUI.image.formatBytes` |

Pure helpers `buildFilename()` / `extToMime()` are inlined verbatim. Load errors
surface coded errors (`TYPE` | `SIZE` | `CORRUPT` | `GIF_ANIMATED`) translated via
the inlined `img.err_*` strings. Namespace: `window.Resizer`.

## How to test

```sh
node --check tools/image-resizer/tool.js
```

Behavior: open `index.html` in a browser, drop a PNG/JPEG/WebP (≤25 MB), change
width/height or percent, toggle the aspect lock, switch output format, download.
Re-run the language switcher — all labels re-render from the inlined tables.
