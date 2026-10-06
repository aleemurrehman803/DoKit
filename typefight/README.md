# TypeFight (teaser)

**What it is:** An isolated teaser page for the future TypeFight concept —
skill-based typing battles (entry → pot → winner). This is NOT the game itself;
the real-money game needs a backend and is planned for Phase 5. This page only
explains the concept, the anti-fraud pillars, and captures "notify me" emails.

## Files

| File | Purpose |
|---|---|
| `index.html` | Teaser page. Loads the 3 shared files + `tool.css` + `tool.js`. CSP meta, PWA tags, EN/UR full text, other 8 languages show English with an honest "full translation coming soon" note. |
| `tool.css` | Page-specific styles only (hero, steps, phase note). Shared tokens/components come from `css/tokens.css` + `css/hub.css`. |
| `tool.js` | `TypeFight.*` namespace: `TypeFight.init()` binds the notify form and the language fallback note. All UI strings added via `DKI18N.add()` (10 languages). |
| `README.md` | This file. |

## Dependencies (ONLY these shared files)

- `css/tokens.css` — design tokens
- `js/ui.js` — DoKit Shared UI API v1.0.0 (`DKUI.renderNav/renderFooter/toast/init`)
- `js/i18n.js` — 10-language dictionary (`DKI18N`)

Zero cross-imports: this module never imports another tool's files. No shared
mutable globals — the only shared surface is the `DKI18N` dictionary (append-only
via `.add()`) and the read-only `DKUI` API.

## Local storage

- Key: `dokit:typefight:notify` → `{"name","email","ts"}`
- All access wrapped in try/catch (private-mode safe). Clearing site data removes it.

## How to test

1. Serve the repo root (e.g. `python3 -m http.server`) and open `/typefight/`.
2. Check: hero renders, 3 steps, 4 anti-fraud cards, Phase-5 honesty note.
3. Submit the notify form → success toast; verify `localStorage` key `dokit:typefight:notify`.
4. Switch language to اردو → RTL layout, full Urdu text. Switch to العربية → Arabic chrome, English body + "translation coming soon" note.
5. Toggle dark mode; check 360px width (bottom-sheet not needed here — no chat on this page... the assistant IS included: check the FAB opens the panel).
6. `node --check tool.js`.
