# Typing — TypeMaster Suite (DoKit flagship section)

**What it is:** The complete TypeMaster typing school, moved verbatim from its
standalone site into the DoKit hub at `/typing/`. Structured lessons (44),
timed typing tests, 2 games, smart practice drills, progress tracking with
charts, printable certificates, dashboard/profile, and EN+UR interface with
dark mode. It is the flagship entry in the hub's Tools menu ("Typing").

## Files

| Path | Purpose |
|---|---|
| `index.html` | Typing home (lives at `/typing/`) |
| `lessons.html`, `lesson.html` | Lesson browser + lesson runner |
| `test.html`, `results.html` | Timed test + results |
| `games.html` | Word Fall, Word Sprint |
| `practice.html` | Smart-practice drills |
| `progress.html` | Charts + history |
| `dashboard.html`, `profile.html` | Account-lite dashboard + settings |
| `login.html`, `signup.html` | Local "accounts" (device-only) |
| `certificate.html` | Printable certificate |
| `faq.html` | Typing-section FAQ |
| `css/` | Typing's own styles (`main.css`) — NOT hub tokens |
| `js/` | Typing's own engine: `engine.js`, `curriculum.js`, `test-data.js`, `storage.js`, `gamification.js`, `keyboard.js`, `urdu.js`, `urdu2.js`, `charts.js`, `certificate.js`, `games.js`, `practice.js`, `ui.js`, `pages/*.js` |

## Dependencies

Self-contained. Its JS/CSS reference each other with **relative paths**
(`css/main.css`, `js/...`) so the whole folder works under `/typing/` with no
changes. The ONLY hub integration is 4 link replacements in `js/ui.js` and
`js/pages/profile.js` sending "home" links to `/` (the DoKit hub) instead of
`index.html`. It does **not** use the hub's `css/tokens.css`, `js/ui.js`
(`DKUI`), or `js/i18n.js` (`DKI18N`) — it ships its own `UI`/`I18N`.

## Local storage — LEGACY KEYS, DO NOT RENAME

This suite predates DoKit. Its storage keys are historical; renaming them would
wipe existing users' progress. Leave them exactly as-is:

- `typemaster_*` — settings, progress, accounts (see `js/storage.js`)

New DoKit modules must use the `dokit:<name>:*` prefix instead — that rule does
not apply retroactively here.

## How to test

1. Serve the repo root and open `/typing/`.
2. Run a lesson, a 60s test, one game round; check progress charts update.
3. Toggle language (EN/اردو) and theme; reload — settings persist.
4. Click the brand / Home link → must land on `/` (DoKit hub), not `/typing/index.html`.
5. `node --check js/ui.js js/pages/profile.js` (the two hub-patched files).
