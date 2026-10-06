# DoKit — Every tool you'll ever need.

DoKit is a free toolbox of online utilities that run **entirely in your
browser**. No sign-up, no uploads, no tracking. Your files never leave your
device — there is no server to hack, because there is no server.

**Live site:** https://aleemurrehman803.github.io/dokit/ (custom domain
`getdokit.com` planned)

## What's inside

- **5 free tools** (`/tools/`): Image Resizer, Image Compressor, Image
  Converter, Word Counter, Case Converter
- **Typing school** (`/typing/`): the full TypeMaster suite — lessons, speed
  tests, games, certificates (flagship section)
- **TypeFight** (`/typefight/`): teaser for upcoming skill-based typing battles
- **DoKit Assistant**: an in-site guide that answers questions about every
  tool, in your language
- **Company pages**: About, Contact, Pricing, FAQ, Privacy, Terms, Coming Soon

## Key properties

- **Private by design** — all processing happens on-device (`<canvas>`,
  local text). Nothing is uploaded anywhere.
- **10 languages** — English, اردو, العربية, हिन्दी, Español, Français,
  Português, Deutsch, Türkçe, Русский — with right-to-left layout for Urdu
  and Arabic. UI chrome ships in all 10; long-form articles (privacy, terms,
  FAQ) are fully translated in English + Urdu, and show English with an
  honest "full translation coming soon" note in the other languages.
- **PWA-ready** — installable (`manifest.webmanifest`), works offline after
  the first visit (service worker `sw.js` + `offline.html`).
- **Zero dependencies** — no npm, no CDN libraries. Vanilla HTML/CSS/JS.
- **Accessible** — skip links, focus rings, aria labels, keyboard-operable.

## Repository layout (plugin architecture)

```
index.html / about.html / contact.html / ...   hub + company pages
tools/index.html                                searchable tool directory
typefight/          index.html, tool.js (TypeFight.*), tool.css, README.md
typing/             TypeMaster suite (self-contained legacy module)
css/                tokens.css (design tokens), hub.css (component library)
js/                 i18n.js (DKI18N), ui.js (DKUI Shared UI API v1.0.0),
                    tools-data.js, assistant.js, assistant-kb.js, pages/
assets/             logo.svg, icon.svg, og-cover.svg
```

**Module rules** (bind every contributor):

1. One tool = one folder. Zero cross-imports between tool folders.
2. Tool JS depends ONLY on the 3 shared files: `css/tokens.css`,
   `js/ui.js`, `js/i18n.js`.
3. No shared mutable globals — the only shared surfaces are the read-only
   `DKUI` API and the append-only `DKI18N` dictionary.
4. New modules use localStorage prefix `dokit:<name>:*` (the `/typing/`
   suite keeps its legacy `typemaster_*` keys — do not rename).
5. Each tool ships its own JS namespace (`TypeFight.*`, …) and its own
   `README.md` so the folder is understandable alone.

## Assets note

- `assets/og-cover.svg` (1200×630) is the designed social cover; it is
  converted to PNG at publish time (SVG is the source of truth).
- `assets/icon.svg` is the PWA master icon; `icon-192.png` / `icon-512.png`
  referenced by the manifest are generated from it at publish time.

## Security & privacy model

Static site, no backend. User content is never placed into `innerHTML`;
file processing is client-side with type allowlist (PNG/JPEG/WebP) and a
25 MB cap; canvas redraw strips EXIF data. See `privacy.html` for the
user-facing policy.
