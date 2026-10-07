# DoKit — Detailed Ultra-Deep Audit Report
**Date:** October 7, 2026
**Scope:** `~/workspace/dokit-build/` — 196 files (70 HTML, 87 JS, 10 CSS), 3.1 MB
**Method:** Static analysis only (no live browser). `node --check` on all 87 JS files, grep-based reference resolution, CSP/XSS flow review, manual code reading.
**Auditors:** 3 specialist agents (Code Quality + Security · Frontend + Mobile + SEO · Firebase + Features + Performance) + parent cross-verification.
**Rule:** READ-ONLY audit. Nothing was modified. All fixes require user approval.

---

## Overall Score: 69%

| Area | Score | Thik (working) | Drust karna baqi (needs fixing) | Status |
|------|-------|----------------|---------------------------------|--------|
| 💻 Code Quality | 70% | 70% | 30% | ⚠️ Pass with fixes |
| 🔒 Security | 55% | 55% | 45% | ⚠️ Needs work |
| 🎨 Frontend | 82% | 82% | 18% | ✅ Good |
| 📱 Mobile | 93% | 93% | 7% | ✅ Excellent |
| 📈 SEO | 68% | 68% | 32% | ⚠️ Needs work |
| 🔥 Firebase | 52% | 52% | 48% | ⚠️ Needs review |
| ⚙️ Features | 87% | 87% | 13% | ✅ Good |
| ⚡ Performance | 43% | 43% | 57% | ❌ Fail |

**Matlab:** Website ka ~69% hissa thik hai, ~31% me sudhaar ki zaroorat hai. Sab se kamzor: Performance (43%) aur Firebase (52%).

---

## 1. 💻 Code Quality — 70% (70% thik · 30% baqi)

### Working
- 87/87 JS files pass `node --check` — zero syntax errors.
- 687/687 `<script src>` references across 70 HTML pages resolve to existing files — zero broken script refs.
- Zero inline event handlers (`onclick=` etc.) — consistent with strict CSP.
- Consistent camelCase naming in hand-written code; no snake_case mixing.
- Effectively zero `console.log` in production code (single match is inside a typing-test sample text string).
- 197 try/catch blocks across 54 files; defensive `window.X &&` guards before touching optional modules.
- Zero `eval` / `new Function` / string-`setTimeout` anywhere.

### Broken
- `[HIGH]` `js/pages/admin-full.js:753,777,877,921,974` — `auditAdmin()` called but **never defined** (function is named `logAudit`, different signature). All 5 call sites cover every financial admin action (approve/reject deposit, process/reject withdrawal, save payment settings). After the Firestore transaction commits, `.then()` throws `ReferenceError` → no audit entry written, and `loadDeposits()`/`loadWithdrawals()`/`loadDashboard()` never run → admin sees stale "pending" list. (Double-credit prevented by transaction status re-check, but audit trail missing + UX broken.)
- `[MEDIUM]` `js/referral.js:72-73` — dead reward path: calls `window.DKTFWallet.awardTo()` which doesn't exist (module is `window.TFWallet`, no `awardTo` method). Guard silently skips → referral coin rewards (25 coins) never fire, zero errors surfaced.
- `[MEDIUM]` 113 empty `catch {}` blocks across JS — silent failures; errors swallowed without logging.
- `[LOW]` `js/ui.js:16,691` — duplicate `esc()` (plus `t`/`u`/`close` duplicates). File is concatenation of 1 minified + 4 readable IIFE blocks, separate scopes (no hoisting bug) — copy-paste dead weight; minified block double-wraps `window.DKU(window.DKU(…))`.
- `[LOW]` `window.DKUI2` assigned (`js/ui.js:504`) but never consumed — dead code.
- `[LOW]` `js/payments-webhook.js` shipped but never referenced by any HTML — dead scaffold in production.
- `[LOW]` Duplicate function names across files (`boot`, `clear`, `esc`, `getUid`, `getDb`, `fmtDate`, `getBalance`, `getProfile`) — separate IIFE scopes so no runtime conflict, but confusing for maintainers.

### Needs fixing
1. Rename/alias `auditAdmin` → `logAudit` at the 5 call sites in `admin-full.js` (restores audit trail + UI refresh in money flow).
2. Fix `js/referral.js:72` — point at real `window.TFWallet`, implement or remove the `awardTo` reward path.
3. Add logging (or at least `console.warn`) inside the 113 empty catch blocks, prioritized in financial code paths.
4. Remove dead code: `DKUI2`, duplicate helpers in `js/ui.js`, unreferenced `payments-webhook.js` (or wire it when backend exists).

---

## 2. 🔒 Security — 55% (55% thik · 45% baqi)

### Working
- CSP present on all 70 pages; `script-src` has **no** `unsafe-inline`/`unsafe-eval`; Google hosts properly scoped; `object-src 'none'`, `frame-ancestors 'none'` (clickjacking protected).
- XSS escaping discipline mostly good: `esc()` helpers in 9 files, applied to user data in deposit/withdraw tables, API key names, admin user tables, wallet ledger, battle leaderboard, tool cards, search results; assistant chat uses `textContent` for user messages.
- Client-side input validation: amounts via `FinSec.validateAmount` (positive integers, min/max); deposit txnId charset `[A-Za-z0-9\-_]{4,64}`; screenshot must match `data:image/(png|jpeg|jpg|webp);base64,` and ≤500KB.
- Admin gate: panel starts `display:none`; requires signed-in user **and** Firestore `admins/{uid}` doc; `admin-full.js` re-verifies before booting.
- No hardcoded private keys (Firebase web key is public-by-design; OpenAI key is user-provided; reCAPTCHA key is public site key).

### Broken
- `[CRITICAL-CONDITIONAL]` **No Firestore Security Rules in the repo — entire financial trust model is unverifiable from code.** Every money-relevant write is client-side: coin minting (`admin-full.js:440,453,740`), deposit approval, withdrawal locks (`payments-real.js:239`), ledger appends, `auditLog` writes. If console rules are absent/permissive, any authenticated user can mint coins, approve their own deposits, and forge audit entries. **Nothing financial is trustworthy until rules are published and verified.**
- `[HIGH]` `js/pages/admin-full.js:1032-1035` — **stored XSS in admin screenshot viewer**: `w.document.write('<img src="' + t._shotData + '">')` where `_shotData` is the user-submitted deposit `screenshot` from Firestore. The `data:image/*` check exists only in client JS (`submitDeposit`), bypassable by writing the doc directly. Payload like `"><svg onload=…>` breaks out of `src` → executes in admin's same-origin popup → **full admin session compromise** (approve deposits, mint coins, read all user data).
- `[HIGH]` TypeFight coin economy is fully client-authoritative: battles vs client-side bots, placement computed in browser (`typefight-battle.js:273`); `TFWallet.awardBattle()` has no cooldown and writes ledger entries straight from client; `ledgerAppend` (`js/typefight.js:153`) computes its own SHA-256 hash client-side (theater — the attacker *is* the hasher). Currently contained (game earnings only touch `coin_ledger`, not withdrawable `users/{uid}.coins`) — one wiring mistake turns this into real-money withdrawals.
- `[MEDIUM]` Rate limiting is localStorage-only (`FinSec.checkRate`, `js/finsec.js:106`). `payments-real.js` treats it as a real control (3 withdrawals/hour, 5 deposits/hour) — clearing storage or console bypasses it entirely.
- `[MEDIUM]` Client-side canvas CAPTCHA (`js/captcha.js`) is theater — bypassed by skipping `validate()` in console. Real bot defense depends on Firebase App Check, which `js/firebase.js` marks "optional: app still works unenforced" — enforcement status unknown.
- `[MEDIUM]` Audit trail is client-forgeable: `FinSec.auditLog` (`js/finsec.js:181`) writes `security_events` + `admin_audit` directly from browser — any signed-in user can inject/spam entries.
- `[LOW]` `js/pages/admin.js:14` — `user.email` interpolated unescaped into `gate.innerHTML` in `deny()` (Firebase email-format validation makes exploitation unlikely, but it's the exact pattern to avoid).
- `[LOW]` `js/pages/deposit.js` (renderAccounts) — esc fallback when `DKPayReal` missing is the identity function → payment account numbers render unescaped.
- `[LOW]` `js/pages/admin-full.js:672-686` — `data-amt`/`data-uid`/`data-shot` attributes built without `esc()` (safe charsets today; pattern risk).
- `[LOW]` `js/typefight-cert.js:115` — `c.wpm`/`c.accuracy` rendered unescaped (self-XSS only).
- `[LOW]` `js/pages/home.js:19` — local `esc()` doesn't escape single quotes (safe only in current double-quoted contexts).
- `[LOW]` User's OpenAI key in `localStorage` (`dokit_openai_key`) — any XSS could exfiltrate it. Acceptable (user's own key), worth knowing.

### Needs fixing
1. **Publish and verify Firestore Security Rules** (highest priority): lock `users/{uid}` coin fields, `deposits`/`withdrawals` status transitions, `admin_audit`/`security_events` to admin-only writes; validate `screenshot` format server-side.
2. Fix screenshot viewer (`admin-full.js:1032-1035`): never `document.write` user data; use `new Image()` with `.src` assigned as property after re-validating `data:image/…;base64,` prefix.
3. Fix `auditAdmin` → `logAudit` (see Code Quality #1).
4. Move rate limiting server-side (or document as advisory-only).
5. Decide CAPTCHA story: enforce App Check in console, or accept canvas CAPTCHA is cosmetic.
6. Escape `user.email` in `admin.js:14`; fix unescaped esc-fallback in `deposit.js`.
7. Long-term: TypeFight rewards + coin ledger must be computed server-side (Cloud Function) before feeding withdrawable balance.

---

## 3. 🎨 Frontend — 82% (82% thik · 18% baqi)

### Working
- 1141/1141 internal `href`/`src` resolve to existing files/directories — **zero genuinely broken links**.
- 0 static `getElementById`/`querySelector('#…')` mismatches across 27 JS files with ID refs.
- 0 duplicate `id` attributes in any of the 70 pages.
- 10/10 CSS files exist and are referenced correctly.
- i18n integrity: all 45 pages loading `i18n-v2.js` resolve 100% of their `data-i18n` keys — no garbled key text.
- 6/6 `<img>` have `alt`; 0 `target="_blank"` without `noopener`; minimal `!important`; no conflicting class definitions; all CSS `url()` refs valid.

### Broken
- `[HIGH]` `sw.js:1` — CORE cache list includes `./js/i18n.js` which **does not exist** (renamed to `i18n-v2.js`). `cache.addAll(CORE)` rejects on the 404 → service worker installs with **nothing cached** → offline support / `offline.html` fallback broken.
- `[HIGH]` 12 redirect stubs (`lessons.html`, `lesson.html`, `test.html`, `results.html`, `progress.html`, `profile.html`, `signup.html`, `login.html`, `dashboard.html`, `games.html`, `certificate.html`, `practice.html`) use root-absolute `/typing/*.html` in `<meta http-equiv="refresh">`. Site served at `/dokit/` subpath → auto-redirect lands on `github.io/typing/…` → **404**. (Visible fallback `<a>` is relative and works — only automatic redirect broken.)
- `[MEDIUM]` `typing/index.html:92` — unclosed `<section>` (pricing section never closed before FAQ section). Browsers auto-recover; HTML invalid.
- `[LOW]` `typing/urdu.html:119` — empty `<h1 id="activeTitle">` (JS-populated; empty in static HTML).
- `[LOW]` 12 redirect stubs have no h1/meta description — by design, acceptable.

### Needs fixing
1. `sw.js`: replace `./js/i18n.js` with `./js/i18n-v2.js` in CORE (or drop it); bump `CACHE` version.
2. All 12 redirect stubs: change meta refresh `url=/typing/X.html` → relative `url=typing/X.html`.
3. `typing/index.html`: add missing `</section>` before FAQ section.

---

## 4. 📱 Mobile — 93% (93% thik · 7% baqi)

### Working
- 70/70 pages have `<meta name="viewport">`; none disable zoom.
- 10/10 CSS files contain media queries (62 total); breakpoints cover 420/480/559/640/720/768/900/960/1280px.
- 0 fixed pixel widths ≥600px without `max-width`; no `100vw` misuse; `overflow-x` only on intentional scroll wrappers.
- Primary touch targets pass: `.btn` ≈ 50px, `.text-input` ≈ 46px (≥44px WCAG).

### Broken
- `[LOW]` `tools/image-resizer/tool.css:407` — `.ticonbtn` min 34px < 44px WCAG touch target.
- `[LOW]` `css/hub.css:142` — `.btn-sm` computes to ≈40px height < 44px.

### Needs fixing
1. Raise `.ticonbtn` to 44px min-height/width.
2. Increase `.btn-sm` padding to reach 44px height.

---

## 5. 📈 SEO — 68% (68% thik · 32% baqi)

### Working
- 70/70 pages have `<title>` (all unique), `lang`, `theme-color`.
- 57/70 have unique meta descriptions; robots.txt valid with sitemap reference.
- JSON-LD structured data on 7 key pages (index, 5 tool pages, typing/index); `og:image` valid on all 26 pages declaring it (`assets/og-cover.jpg` exists).
- Heading hierarchy clean on 6/8 spot-checked pages.

### Broken
- `[HIGH]` `sitemap.xml` — 10 indexable content pages missing: all 4 blog posts, all 6 guides, `wall-of-love.html`. The site's SEO content pages are invisible to crawlers via sitemap. (42 URLs currently listed.)
- `[MEDIUM]` Canonical/sitemap casing mix: `/DoKit/` (13 sitemap entries; all 32 canonical tags) vs `/dokit/` (29 sitemap entries). Repo is `dokit`; inconsistent casing weakens canonicalization.
- `[MEDIUM]` 38/70 pages lack `<link rel="canonical">` — all 13 `typing/*`, `typefight/verify/index.html`, all 7 `account/*`, `admin/index.html`, 404, offline.
- `[MEDIUM]` 48/70 pages lack Open Graph tags — including all blog posts, all guides, all `typing/*`, `tools/index.html`, `typefight/*` (only 22/70 have OG, 21/70 have Twitter cards).
- `[LOW]` 4 meta descriptions under 50 chars: `status.html` (45), `account/login.html` (29), `account/signup.html` (31), `admin/index.html` (18).
- `[LOW]` 5 guide pages + `typing/test.html` have 2× `<h1>` (guides: intentional EN+Urdu bilingual pattern — low risk); `guides/index.html` and `blog/index.html` skip h1→h3.

### Needs fixing
1. `sitemap.xml`: add 4 blog posts, 6 guides, `wall-of-love.html`; normalize all URLs to lowercase `/dokit/`.
2. Canonicals: fix all 32 from `/DoKit/` → `/dokit/`; add canonical to 38 missing pages (priority: `typing/*`, `tools/*`, `guides/*`, `blog/*`).
3. Add OG (+ Twitter card) tags to blog, guides, `typing/*`, `tools/index.html`, `typefight/*`.
4. Expand 4 short meta descriptions to 50–160 chars.
5. Fix h1→h3 skips on `guides/index.html` / `blog/index.html` (use h2).

---

## 6. 🔥 Firebase — 52% (52% thik · 48% baqi)

### Working
- App Check initialized in `js/firebase.js:30` with `ReCaptchaEnterpriseProvider` + auto-refresh; Firebase compat CDN scripts all use `defer`.
- Admin gate (`js/pages/admin.js`): checks `admins/{uid}` doc; comments state writes to `admins/*` denied by rules.
- Deposit approval (`js/pages/admin-full.js:706`) uses Firestore transaction (balance + hash-chained ledger + status, all-or-nothing); rejects non-pending deposits.
- Withdrawal (`js/payments-real.js`): transactional coin lock into `pending_withdrawal`, 24h cooldown, 3/hour rate limit, input validation.
- API keys (`js/pages/api-keys.js`): good design — only SHA-256 hash stored, raw secret shown once via modal.
- Journey timeline (`js/journey.js`): localStorage + best-effort Firestore sync, never throws offline.

### Broken
- `[CRITICAL-CONDITIONAL]` Client-side financial/admin writes depend on unseen console rules — verify in Firebase console (see Security section). Includes: coin minting (`admin-full.js:440,453,740`), `config/tools` + `config/payments` writes, deposit status updates, users self-creating `deposits` docs with self-declared amounts, `config/cert_counter` incrementable by any client (spam-able serial burn), `ledgerAppend` self-computed hashes.
- `[HIGH]` 5 compound queries need composite indexes (fail at runtime until created in console):
  - `admin-full.js:634-635` — `deposits.where("status","==","pending").orderBy("createdAtMs","desc")`
  - `admin-full.js:799-800` — `withdrawals.where("status","==","pending").orderBy("createdAtMs","desc")`
  - `payments-real.js:281-282` — `deposits.where("userId","==",uid).orderBy("createdAtMs","desc")`
  - `payments-real.js:288-289` — `withdrawals.where("userId","==",uid).orderBy("createdAtMs","desc")`
  - `typefight-cert.js:99-100` — `certificates.where("userId","==",uid).orderBy("createdAt","desc")`
- `[MEDIUM]` App Check initialized but wrapped in try/catch ("optional: app still works unenforced"). Enforcement must be toggled per-service in console — unverifiable from repo.
- `[MEDIUM]` Inconsistent timestamp fields: `createdAt` (server Timestamp), `createdAtMs` (client number), `clientTs`, `ts`, `timestamp` (in `admin_audit`); deposit/withdrawal docs carry both `createdAt` and `createdAtMs`. `toMillis()` normalizers exist but dual-field pattern invites sort bugs.
- `[MEDIUM]` 4 parallel coin/credit systems, no single source of truth: (1) localStorage `dk_coins` (`js/ui.js:782`, user-editable); (2) Firestore `users/{uid}.coins` (deposits/withdrawals); (3) `users/{uid}/coin_ledger` (TypeFight earns, wallet display); (4) `users/{uid}/credits/wallet` + `credit_ledger` (`js/credits.js`). These can and do diverge.
- `[HIGH]` Earn→withdraw balance disconnect: TypeFight/battle/streak earns append only to `coin_ledger` (wallet displays ledger sum), but `submitWithdrawal` (`payments-real.js:223`) checks `users/{uid}.coins` (written only by admin/deposit approval). Earned coins visible in wallet but **un-withdrawable** ("Insufficient balance").

### Needs fixing
1. **Firebase console:** publish/verify Firestore rules (see Security #1); create the 5 composite indexes; turn on App Check Enforcement for Firestore, Auth, Storage.
2. Unify coin balance: one source of truth (recommend Firestore `users/{uid}.coins` maintained transactionally alongside ledger, or ledger-sum everywhere); make withdrawal read the same number the wallet displays; sync TypeFight earns into it.
3. Standardize timestamp fields (pick `createdAt` server Timestamp + derived millis; drop dual fields).

---

## 7. ⚙️ Features — 87% (87% thik · 13% baqi)

### Working
- 0 missing scripts, 0 missing element IDs, 0 syntax errors, 0 broken listeners across 582 checked event-handler wirings.
- 17 page-specific script↔page pairs verified (dashboard, admin, typefight battle/wallet/profile, deposit, withdraw, api-keys, subscription, urdu-typing + keyboard + lessons, all 5 tool pages) — all referenced IDs exist; dynamically-created admin IDs created before wiring.
- `js/dokit-sdk.js` — 7 methods implemented (`countWords`, `compressImage`, `resizeImage`, `convertImage`, `convertCase`, `getProfile`, `getLeaderboard`); header discloses backend not live.

### Broken
- `[HIGH]` `js/referral.js:72-73` — silent referral-reward failure (see Code Quality). Referral recorded, `rewarded` stays `false`, referrer never gets 25 coins, user sees success.
- `[HIGH]` Earn→withdraw balance disconnect (see Firebase). Functional bug: earned coins visible but un-withdrawable.
- `[MEDIUM]` `js/dokit-sdk.js` vs `api/docs.html` — SDK implements 7 methods but docs.html documents zero endpoints formally (only `countWords`/`compressImage` in examples). SDK calls fail with network errors by design (backend not live) — documented in header, but docs/SDK mismatch confuses developers.
- `[LOW]` 2 dead buttons — `admin/index.html:162` `adm2faBtn`, `:175` `admIpAddBtn`: both `disabled` "Coming soon" (intentional Phase-6 scaffolding).
- `[LOW]` 1 render-blocking script — `js/assistant-ai-init.js` (2,297 bytes) on homepage lacks `defer`.

### Needs fixing
1. Fix referral payout (see Code Quality #2).
2. Unify coin balance (see Firebase #2).
3. Document remaining 5 SDK endpoints in `api/docs.html`, or trim SDK to what docs cover.
4. Add `defer` to `assistant-ai-init.js`.

---

## 8. ⚡ Performance — 43% (43% thik · 57% baqi)

### Working
- Hero uses `.webp` (16KB) with `loading="eager"` (correct for LCP); 4 of 6 `<img>` lazy-load (other 2 justified).
- Dead weight already cleaned: `i18n-v2-complete.js`, `i18n-extra.js`, `guides-ur/` removed (730KB saved).
- All Firebase CDN scripts use `defer`.
- Images: 6/6 have alt; no massive unoptimized hero images.

### Broken
- `[HIGH]` Homepage is **~735KB vs 150KB budget (4.9× over)**. 421–436KB of i18n dictionaries (57% of page weight) load on **every** page regardless of user language — 8 language files (`ar, de, es, fr, hi, pt, ru, tr`) + base `i18n-v2.js` (112KB). Only 1 language is ever needed.
- `[MEDIUM]` JS is unminified (avg line length ~55 chars in hand-written files); minification would cut ~30-40%.
- `[MEDIUM]` Dead assets shipped but unreferenced: `assets/og-cover.png` (196KB; only `.jpg` referenced), `assets/hero-illustration.png` (108KB; only `.webp` referenced) — 304KB wasted in repo/clone.
- `[LOW]` `js/assistant-ai-init.js` lacks `defer` (render-blocking, 2.3KB).

### Needs fixing
1. **Lazy-load i18n** — ship only the active language (keep English in base bundle). Cuts homepage from ~735KB to ~315KB. This is the single biggest win.
2. Minify JS for production (keep readable sources in repo).
3. Delete unreferenced PNG assets (304KB).
4. Add `defer` to `assistant-ai-init.js`.
5. Re-audit against <150KB/page budget after lazy-loading (will still need code-splitting or further cuts to fully hit 150KB).

---

## Summary

### Total issues: 44
| Severity | Count |
|----------|-------|
| Critical (conditional) | 1 — Firestore rules unverifiable from repo; entire financial trust model depends on console state |
| High | 10 |
| Medium | 19 |
| Low | 14 |

### Top 10 must-fix (priority order)
1. **Publish + verify Firestore Security Rules** (console) — nothing financial is trustworthy without this.
2. **Fix `auditAdmin` → `logAudit`** (`admin-full.js` ×5) — audit trail + admin UI refresh broken in money flow.
3. **Fix admin screenshot stored XSS** (`admin-full.js:1032-1035`) — admin session compromise vector.
4. **Fix referral payout** (`referral.js:72`) — broken feature, silent failure.
5. **Unify coin balance** — earned coins visible but un-withdrawable (functional bug).
6. **Create 5 composite Firestore indexes** (console) — admin deposit/withdrawal lists + user history fail at runtime without them.
7. **Fix `sw.js`** (`./js/i18n.js` → `./js/i18n-v2.js`) — offline support completely broken.
8. **Fix 12 redirect stubs** (`/typing/` → `typing/`) — auto-redirect 404s.
9. **Lazy-load i18n** — 4.9× over performance budget; single biggest perf win.
10. **Sitemap + canonicals** — add 10 missing content pages; normalize `/DoKit/` → `/dokit/`.

### Overall: 69% complete, 31% needs fixing
Sab se mazboot: Mobile (93%), Features (87%), Frontend (82%).
Sab se kamzor: Performance (43%), Firebase (52%), Security (55%).

**Koi file modify nahi ki gayi. Sab fixes user ki approval ke baad hongi.**
