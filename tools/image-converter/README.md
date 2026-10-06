# Image Converter — plugin module

Convert between PNG, JPEG, and WebP. Multi-file queue (max 10) with per-file
progress bars and status; per-file errors never kill the queue; downloads are
individual. 100% client-side; files never leave the device.

## Files

- `index.html` — tool page (hero, dropzone, format/quality controls, queue list, FAQ, how-to, related tools)
- `tool.js` — all tool logic (sequential queue pump)
- `tool.css` — full copy of the generic tool component styles (duplication is the
  price of plugin isolation)
- `README.md` — this file

## Dependencies (only these shared files)

- `../../css/tokens.css` — design tokens
- `../../js/i18n.js` — `DKI18N` (10 languages: en, ur, ar, hi, es, fr, pt, de, tr, ru)
- `../../js/ui.js` — `DKUI` v1.0.0 (`renderNav` / `renderFooter` / `init` / `image.*`)

Zero cross-imports: no other tool folder, no `js/tools/`, no `js/image.js`,
no `js/i18n-tools.js`, no `css/tools.css`. All 10-language strings this tool uses
(53 keys) are inlined at the top of `tool.js` and registered via `DKI18N.add()`.

## Image pipeline

`tool.js` defines plugin-local shims with the same signatures as the old shared
`DKIMG` API, each delegating to `DKUI.image` v1.0.0:

| local shim | delegates to |
|---|---|
| `loadImageFile(file)` → `{bitmap, w, h, name, prescaled}` | `DKUI.image.loadFile` + `DKUI.image.fitToMP` (preserves the >16MP pre-scale) |
| `canvasToBlob(canvas, ext, quality)` | `DKUI.image.toBlob(canvas, mime, quality)` |
| `downloadBlob(blob, filename)` | `DKUI.image.download` (iOS-Safari fallback included) |
| `revoke(url)` / `formatBytes(n)` | `DKUI.image.revoke` / `DKUI.image.formatBytes` |

Pure helpers `buildFilename()` / `extToMime()` are inlined verbatim; a local
`toastMsgFallback()` replaces the old `DKIMG.toastMsg`. Changing format/quality
re-queues finished files for re-conversion. Namespace: `window.Converter`.

## How to test

```sh
node --check tools/image-converter/tool.js
```

Behavior: open `index.html`, add up to 10 images, watch per-file progress, retry a
failed file, remove a file, change format (finished files re-convert), download
individual results.
