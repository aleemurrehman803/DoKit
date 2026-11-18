# Board Photo — BISE & University Exam Photo Maker

Standalone tool at `/tools/board-photo/`. Makes exam/admission photos for
Pakistani boards & universities at each board's exact pixel size, background
and KB limit.

## How it works

1. **Find your board** — searchable list of 30+ boards & universities
   (BISEs, BIE Karachi, FBISE, AJK Board, LUMS, NUST, UET Lahore,
   Punjab University, University of Karachi, IBA, COMSATS, AIOU, …).
   Each entry shows a spec card: exact px, background colour, max KB,
   plus a **✓ Verified specs** badge (read from an official board
   notification/website) or a **⚠ Typical** badge (board hasn't published
   specs — common Pakistani exam standard, confirm with the board).
2. **Upload your photo** — drag & drop or browse (PNG/JPEG/WebP ≤ 25 MB).
3. **Auto-fit** — the photo is cover-cropped to the board's exact
   dimensions (head-safe: crop biased toward the top so the face keeps
   headroom; the face itself is never altered), then JPEG quality is
   binary-searched to fit at/under the KB target.
4. **Download** — `board-photo-<id>.jpg`, ready for the board portal.

Boards not listed: use the generic **"Pakistani admission (typical)"**
preset or the **Custom size** fields (width/height/KB all editable).

## Bulk Photo (500-image studio)

Switch **Photo mode** to **Bulk Photo** for batch work:

- Up to 500 photos per session, same board spec as Single mode.
- 7 upload methods: Select Photos, drag & drop (files, ZIP, folders),
  ZIP upload, folder select, camera, clipboard paste (Ctrl+V), Add More.
- One manager: select all/none, remove, reorder (drag or ↑/↓), replace,
  retry failed, clear-all (confirmed), per-photo preview/edit/download.
- Editing scopes: Global (apply to all), Selected (apply to selected),
  Individual (own overrides always win). Crop: Exact or Smart Subject
  Framing. Undo/redo per photo. Custom editing presets (localStorage).
- Processing queue (2 workers, pause/resume/cancel), session restore
  via IndexedDB (manifest + capped blobs), one-click ZIP export
  (`1.jpg…N.jpg` in final order, integrity-checked).
- Privacy: 100% client-side — photos never leave the device. No text,
  logo or watermark is ever drawn on a photo (serial numbers live only
  in filenames).

## Files

- `index.html` — page (hero, 3 steps, how-to, tips, FAQ, related tools,
  FAQPage + HowTo JSON-LD; canonical `/tools/board-photo/`)
- `tool.js` — vanilla JS, no dependencies (CSP-safe: `script-src 'self'`)
- `tool.css` — DoKit design tokens + dark mode + board-specific styles
  (spec card, badges, preview)
- `bulk.css` — Bulk workspace styles (live tokens only; no new design)
- `../assets/js/board-photo-bulk.js` — bulk DOM engine (manager, editor,
  queue, export, IndexedDB session)
- `../assets/js/board-photo-bulk-logic.js` — pure rules (UMD, Node-tested)
- `../assets/js/board-photo-zip.js` + `../assets/js/vendor/fflate.min.js`
  — ZIP in/out (fflate 0.8.2, MIT, vendored; no runtime CDN)
- `../js/i18n-boardphoto.js` — `bp.*` + `bpb.*` keys, all 10 locales
  (note: the page now loads this file; it was previously dormant)

## Data

Board specs live in `tool.js` (`BOARDS`), copied from
`../image-resizer/board-specs-verified.json`. If that JSON is updated,
re-copy the changed entries into `tool.js`.

## Privacy

100% client-side — photos never leave the device.
