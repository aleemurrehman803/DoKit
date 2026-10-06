# Image Resizer — plugin module

Bulk image studio: upload many images at once, review them in serial order,
crop and edit backgrounds per image (or via batch), resize with exact pixels
or percent, hit a target file size (MB→KB), and download results individually
or as one ZIP. 100% client-side; files never leave the device.

## Files

- `index.html` — tool page (batch panel, board/university presets, dropzone,
  review queue, process, results, editor modal, FAQ, how-to, related tools)
- `tool.js` — all tool logic (readable source; state machine per queue item:
  loading → ready → working → done | error)
- `tool.css` — full copy of the generic tool component styles plus resizer
  extensions (duplication is the price of plugin isolation)
- `README.md` — this file

## Dependencies (only these shared files)

- `../../css/tokens.css` — design tokens
- `../../js/i18n.js` — `DKI18N` (10 languages: en, ur, ar, hi, es, fr, pt, de, tr, ru)
- `../../js/ui.js` — `DKUI` v1.0.0 (`renderNav` / `renderFooter` / `init` / `image.*`)

Zero cross-imports: no other tool folder, no `js/tools/`, no `js/image.js`,
no `js/i18n-tools.js`, no `css/tools.css`. All 10-language strings this tool uses
(~220 keys) are declared at the top of `tool.js` and registered via
`DKI18N.add()` — full EN + UR, other 8 languages fall back to English
automatically via `DKI18N.t()`.

## User flow

1. **Batch panel (top):** crop aspect, crop-vs-pad fit mode, background action
   (keep / transparent / solid color), optional corner-sample auto-removal,
   dimensions, format, quality, target KB, DPI (PNG), rename pattern,
   watermark, social-size presets, saved setting presets. “Apply to all”
   writes these into every queued image. **Manual by default:** nothing runs
   automatically — every auto feature is an explicit button labeled
   “Auto-…” with a “click for automatic” note.
2. **Board / University photo section:** searchable preset list. Selecting a
   preset fills dimensions, background color, target KB and format (all fields
   stay manually editable). One-click explicit buttons: passport-safe
   auto-crop, auto background, auto-enhance. Face-integrity note shown:
   “Your face is never altered.”
3. **Upload:** multi-file input + drag-drop (25 MB per file). Count shown
   (“N images uploaded”).
4. **Review:** serial-numbered thumbnails (1..N) with checkboxes, drag-reorder
   (desktop) / arrows (mobile), duplicate, per-image info panel + EXIF viewer.
   Tick faulty ones → “Edit selected” opens the editor for each, one by one.
   Download mode: separate files or single ZIP. “Download Now” processes
   everything, then downloads in the chosen mode.
5. **Per-image editor modal:** Crop tab (drag box, aspect presets, touch
   supported, face-centering guide overlay), Background tab (click-to-sample
   color + tolerance chroma removal, manual eraser brush, transparent/solid
   replace, reset), Adjust tab (rotate/flip, brightness/contrast/saturation/
   grayscale/sepia filters, auto-enhance, rounded corners, border, before/
   after compare). Undo/redo (10 steps). Edits invalidate stale results
   (dirty-flag → re-process required).
6. **Process:** per-image crop → pad → resize (batch dims, aspect lock uses
   each image's own ratio) → watermark → JPEG/WebP binary-search quality for
   target KB (or quality slider) → optional PNG DPI metadata → results grid
   with per-image download.
7. **ZIP:** “Download all as ZIP” builds a real ZIP in vanilla JS (stored
   entries, CRC32, UTF-8 names, images inside a `dokit-images/` folder) —
   no libraries, CSP-safe.

## Board / university presets (data: `BOARD_PRESETS` in tool.js)

Each preset: `{ id, name, w, h, bg, kb, fmt, verified, note }`.

**Verified specs** (`verified:true`):
- BISE Peshawar — 300×300 px, white background, JPG (official notification 2022)
- BIE Karachi — passport-size photo, blue background (official site)
- BBISE Quetta (Balochistan) — white background picture (portal)
- BISE Bahawalpur — 100–150×150–200 px, 8–22 KB, blue background,
  head-to-shoulder framing; photo must not be blurry, no makeup/niqab/mask,
  face fully visible (Notification No. 132-Registration, 27-08-2026).
  Format not officially specified → JPG default.

**All other boards/universities** (BISE Lahore/Gujranwala/Rawalpindi/Multan/
Faisalabad/Sargodha/D.G. Khan/Sahiwal, BISE Hyderabad/Sukkur/Larkana/
Mirpurkhas, BISE Mardan/Swat/Kohat/Abbottabad/D.I. Khan, AJK Mirpur, FBISE,
Punjab University, Karachi University, NUST, COMSATS, LUMS, IBA Karachi,
UET Lahore, AIOU, plus a generic “Pakistani admission” preset) use the common
Pakistani exam standard (200×230 px, white background, JPG, ≤50 KB),
`verified:false`, tagged **“typical — please confirm with your board”**
(localized). Never presented as official.

## Image pipeline

`tool.js` defines plugin-local shims with the same signatures as the old shared
`DKIMG` API, each delegating to `DKUI.image` v1.0.0:

| local shim | delegates to |
|---|---|
| `DKUI.image.loadFile` | type/size/animated-GIF validation + `createImageBitmap` |
| `DKUI.image.fitToMP` | >16MP pre-scale + notice |
| `DKUI.image.toBlob` | canvas → Blob (mime, quality) |
| `DKUI.image.download` | blob download (iOS-Safari fallback included) |
| `DKUI.image.formatBytes` / `revoke` | size labels / URL cleanup |

Pure helpers: `buildFilename()` (+ `{n}` rename pattern), `extToMime()`,
`centerCrop()`, `passportSafeCrop()`, `cornerSampleColor()`, `chromaKey()`,
`pixelFilters()`, `autoEnhance()` (global histogram stretch only),
`drawWatermark()`, `pngSetDpi()` (pHYs chunk), `parseExifDv()`/`readExif()`
(read-only), `encodeToTarget()` (binary-search quality), `makeZip()`/`crc32()`,
`bakeRotate()`/`bakeFlip()`/`bakeRounded()`/`bakeBorder()`.
Load errors surface coded errors (`TYPE` | `SIZE` | `CORRUPT` | `GIF_ANIMATED`)
translated via the inlined `img.err_*` strings. Namespace: `window.Resizer`.

## Face-integrity rules (non-negotiable, enforced in code + UI)

- **Auto-enhance = global histogram stretch only.** No skin smoothing, no face
  slimming, no feature changes (`autoEnhance()` touches R/G/B levels only).
- **Background change = only background pixels change.** Chroma-key removes
  sampled-color pixels; the subject pixels stay pixel-identical. Tolerance is
  user-controlled; the manual eraser handles edges.
- **Crop/resize/rotate/flip = pure geometric transforms.**
- **Manual by default.** No silent auto-processing: every auto feature is a
  clearly-labeled button (“Auto-crop”, “Auto background”, “Auto-enhance”)
  with a localized “click for automatic” note. Selecting a board preset only
  fills settings — nothing is applied until the user clicks.
- **Passport-safe auto-crop** keeps the top of the photo (headroom) and trims
  from the bottom; sides are center-trimmed. It never cuts into the face
  under normal framing (head in the upper part of the photo).
- Visible integrity note in the Board section (localized): “Your face is
  never altered — only size, background and framing change.”

## Honest limitations (surfaced in UI + FAQ)

- **No RAR output.** RAR is a proprietary format that cannot be created in a
  browser. ZIP only (opens everywhere).
- **Background removal is NOT AI.** It is color-based chroma keying (sampled
  color or corner sampling + tolerance). Best on plain, single-color
  backgrounds; the UI says so explicitly.
- **PNG can't hit exact KB targets** (lossless) — the tool says so and
  produces the smallest PNG instead.
- **JPEG has no transparency** — edited images with alpha are exported as PNG
  (the format can't hold alpha; the tool coerces at export, never silently
  dropping transparency).
- **DPI is written into PNG metadata (pHYs) only.** JPEG EXIF DPI embedding
  is out of scope; the UI documents this.
- **Board presets marked “typical” are not official specs.** Only the three
  verified presets carry confirmed specs; everything else must be confirmed
  with the board.

## How to test

```sh
node --check tools/image-resizer/tool.js
```

Behavior: open `index.html`, set batch options, drop several PNG/JPEG/WebP
(≤25 MB each), check the count, tick a checkbox, “Edit selected”, crop/erase,
“Apply to all”, “Download Now” as ZIP — then unzip and compare. Board flow:
open the Board section, search “Peshawar”, select it, click the three auto
buttons one by one, download. Re-run the language switcher — all labels
re-render from the inlined tables.
