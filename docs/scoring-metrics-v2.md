# DoKit scoring metrics — the single reference (v2)

- **Status:** WP-4 / TYPE-01 — the metric paper. This document is the single
  reference the scoring code implements. Code cites it; it cites the code.
  If this paper and a code comment disagree, this paper wins and the code
  is a bug.
- **Authority:** Architecture §6 (Unicode / grapheme rules), §8.6 (session
  integrity), §9 (result compatibility); Test Center spec §1.5–§1.7;
  audit W2 §3 (formulas as found) and C1/C2/C8/C9/C12.
- **Decisions applied:** D-2 (net WPM everywhere from `v2`, tag
  `v2-net-grapheme`); TYPE-15 (pre-gate Urdu lesson completions
  grandfathered — this paper changes no completion record; DECIDED BY
  OWNER DELEGATION 9 Nov 2026 ~08:13 PM PKT, veto-able: GRANDFATHER —
  see §8); TYPE-16
  (exclude `verified:false` from certificate `bestTest` — implemented per
  the design; DECIDED BY OWNER DELEGATION 9 Nov 2026 ~08:13 PM PKT,
  veto-able: EXCLUDE — see §8).
- **History rule (non-negotiable):** historical records keep their recorded
  numbers and their tags. No migration recomputes old WPM/accuracy, and
  no UI relabels a gross figure as net. New records only.

## 1. What "WPM" means (v2, canonical, all languages)

One label, one meaning. From metric version `v2` onward every language
uses **net WPM**:

| Quantity | Formula (`v2-net-grapheme`) |
|---|---|
| Correct graphemes | Grapheme-cluster comparison of typed vs passage after NFC (see §2). A position counts as correct only when the whole grapheme cluster matches. |
| Net WPM | `round((correctGraphemes / 5) / minutes)` |
| Gross WPM | `round((typedGraphemes / 5) / minutes)` — computed and stored for diagnostics, **never** displayed as "WPM". |
| Accuracy | `typedGraphemes ? round(correctGraphemes / typedGraphemes * 100) : 100` |
| Minutes | Elapsed seconds / 60, from first keystroke to finish (per-mode timer rule unchanged). |

Implementation: `assets/js/dk-scoring.js` (`window.DKScoring.score()`).
No mode, page, or game may compute its own WPM. The legacy engine's
`gwpm`/`nwpm` (which counts retyped keypresses) is a retired scoring
path; its historical records keep their tags (§4).

## 2. Grapheme counting

- **Primitive:** `Intl.Segmenter(locale, { granularity: 'grapheme' })`
  where available. **Never count UTF-16 code units as visible
  characters** — `String.length` and `typed[i] === passage[i]` index
  loops are not character counts.
- **Fallback (no Segmenter):** a documented approximation in
  `dk-scoring.js` — code-point walk, following combining marks
  (`\p{M}`), ZWJ-joined sequences, variation selectors, emoji modifiers
  and regional-indicator pairs attach to the preceding cluster. The
  fallback is fixture-tested against the same corpus as the Segmenter
  path (`implementation/scripts/wp4_type02_corpus.js`); any divergence
  is recorded in the check JSON, never assumed away.
- **Normalization:** NFC on passage **and** typed input before compare,
  once, at the scoring-service boundary. The normalized form is what is
  scored; stored passage text is not rewritten.
- **Digraphs (Urdu):** under UAX #29 (`Intl.Segmenter`, the normative
  primitive) a digraph output (`بھ`, `تھ`, `پھ`, `جھ`, `دھ`, `ڑھ`)
  segments as **two** grapheme clusters — both letters are ordinary
  letters, not combining marks. Architecture §6.1 prose says "one
  visible grapheme"; that does not match Segmenter behaviour, so it is
  recorded as open decision **O-8** (§8) and the formula (§6.3,
  "Segmenter-segmented") governs: digraphs count 2, exactly as UTF-16
  did. The v2 fix for Urdu is the diacritic / ZWNJ / astral counting,
  not the digraph count.
- **ZWNJ (U+200C):** under Segmenter it attaches to the **preceding**
  cluster (`ی‌` is one cluster with `ی`); a ZWNJ with no preceding
  character is its own cluster. It is never silently stripped or
  inserted, and it must be typed to match. Architecture §6.1 prose
  ("counts as one grapheme") is likewise recorded under **O-8** — the
  count a ZWNJ contributes is 0 when it follows a character, 1 when
  it starts a cluster.
- **Joining is display, not scoring:** Urdu word-level display
  (whole-word `ok`/`bad` spans, Nastaliq-safe) is unchanged; scoring
  counts graphemes. A word is judged only once its trailing space is
  typed (baseline behaviour, preserved).

## 3. What v1 actually computed (labelled, not changed)

| Source (v1) | WPM numerator | Tag on old records |
|---|---|---|
| EN test, EN lessons/practice, TypeFight, UR lesson viewer, UR converter practice | correct chars (UTF-16 units) | `v1-net-utf16` |
| UR timed test (live + old controller) | **all typed chars** (UTF-16 units, incl. errors) | `v1-gross-utf16` |
| Legacy engine (`Typer`) | `totalKeys` incl. backspace-corrected retypes (`gwpm`); `totalKeys − wrongKeys` (`nwpm`) | `v1-net-utf16` (legacy path; `gwpm` is a gross variant of the same counting) |

A `v1-gross-utf16` Urdu figure is never plotted on the same trend line
as a `v2-net-grapheme` figure without a visible break and label
(Architecture §6.2/§9.2 — the chart split itself is WP-7 shared-services
work; see §7).

## 4. Result-record tags (v2)

Every `v2` result carries: `metricVersion: 'v2-net-grapheme'`,
`language` (`'en'` / `'ur'`), `graphemeVersion` (`'segmenter'` or
`'fallback'`), `contentVersion` (every lesson/passage store now carries a
per-item version — WP-5 TYPE-13, §10.1 — stamped as
'<store>:<version>', e.g. `'en-test:1'`; custom practice text
carries no version, so the field is omitted there),
`verified` (boolean, §5), `sessionId` (unique per session, §6),
`mode` (`'timed'` / `'lesson'` / `'practice'`), `contentId`
(e.g. `'en-test:home'`, `'urdu-test:t1'`, `'lesson:b-jf'`). Readers
must tolerate records without these fields (they are `v1`) and must
never assume a tag's presence. `date`, `wpm`, `acc` on old rows are
never rewritten; backfilling a tag by source is additive only.

## 5. Verified flag

- A result is `verified:true` only when no paste landed during the
  session (paste event or `insertFromPaste` input). Any paste sets
  `verified:false` on the saved result. Lesson/practice engines track
  paste the same way as the timed test.
- **Certificates:** `certificate.js` (`pick()` / `bests()` /
  `bestTest()`) excludes `verified:false` results from certificate
  eligibility for kind `'Test'`. A pasted test can never be the "best
  test" on a certificate. Records without a `verified` field (`v1`)
  stay eligible — they predate the flag and must not be retroactively
  disqualified. Battle results carry no `verified` flag and are
  unaffected.
- **Already-issued certificates are frozen records** (`dk_cert_Test`):
  a certificate issued before this change is not rewritten or revoked
  by it; only future `bestTest` selection changes.
- **Referral activation does NOT consume `verified`** (traced 9 Nov
  2026: `referrals.js` `recordActivation(wpm, accuracy, chars)` takes
  no verified parameter and its comment states "No anti-cheat is
  claimed"). Speed-milestone checks elsewhere in `referrals.js`
  already count verified-only results. Whether activation itself
  should require a verified test is an open owner decision (§7) —
  not changed in WP-4.

## 6. Sub-second rejection (C2)

The English rule is the shared rule: **a run finishing with elapsed
< 1000 ms is rejected, not scored** — not saved, no XP, no referral
activation, no `lastTestAt`, no challenge marker. The Urdu elapsed
floor (`Math.max(1, …)`) is removed as a scoring path: flooring would
turn a paste into a ~120 WPM score. The rule applies to the live EN
timed test, the live UR timed test, and lessons/practice
(`DKType.createEngine` + the UR lesson viewer). A rejected run shows
an honest message and the user can retry immediately (reset, not a
lockout). The 1-second live-display clamp (WPM shows 0 until 1 s has
elapsed) is a display clamp only, not a scoring floor.

## 7. Dedup (C12)

`DK2.saveResult` gains idempotency: a finish is not appended if the
**immediately preceding saved result** has the same `sessionId` **and**
the same `contentId` **and** the same `metricVersion`. The dedup key
is the session id, not a heuristic on WPM values — two genuinely
identical scores from two sessions are two results; the same session
submitted twice is one. A duplicate attempt returns the existing
result (no error, no second row). Records without a `sessionId`
(`v1`) are never deduped. History is never deleted by dedup. The
200-result cap is unchanged.

## 8. Open decisions / ambiguities (recorded, not silently resolved)

| # | Ambiguity | Implemented rule | Decided by |
|---|---|---|---|
| O-1 | Test Center spec §1.5 says dedup applies "within the dedup window" but names no duration. | The implementation checks only the immediately preceding saved result (the architecture's wording, §8.6). No time window is applied. | Owner/coordinator: whether a numeric window (e.g. 60 s) should also dedupe same-session re-saves deeper in history. |
| O-2 | Arch §8.6 applies the 1000 ms gate to "every mode and every language", but a very short lesson (a few characters) can genuinely finish in < 1 s. | Uniform 1000 ms gate everywhere, with reset-and-retry (no lockout, no XP loss beyond the rejected attempt). | Owner/coordinator: whether short lessons need a lower threshold or a minimum-length exemption. |
| O-3 | TYPE-16: exclude `verified:false` from `bestTest`. | Implemented per the design (see §5). | DECIDED BY OWNER DELEGATION 9 Nov 2026 ~08:13 PM PKT (veto-able): EXCLUDE. Tracker TYPE-16 DONE — VERIFIED. |
| O-4 | Referral activation ignores `verified` (§5). | Unchanged in WP-4. | Owner: should a first-test activation require a verified test? |
| O-5 | Trend-chart split by `metricVersion` (Arch §6.2/§9.2). | Not implemented in WP-4. | WP-7 shared services (TEST-01): the chart must split/annotate when it moves onto the shared scoring service. |
| O-6 | Legacy Urdu controller (`js/pages/urdu-typing.js:412-414`) has the same `Math.max(1, …)` floor and gross formula as the live UR test had. | **Not changed in WP-4** (legacy surface; WP-9 owns its disposition). Live stack only. | WP-9 / owner: apply the same gate if the legacy page stays live, or retire the page. |
| O-7 | Lesson/passage `contentVersion` (§4). | **CLOSED (WP-5 TYPE-13, 9 Nov 2026):** every lesson/passage store now carries a per-item `version` (EN lessons v1, a-sym/b-zret v2; UR lessons v1; EN/UR test passages v1; practice v1) and results stamp `contentVersion` as `'<store>:<version>'`. Custom practice text omits the field. | — |
| O-8 | **Architecture §6.1 prose vs Segmenter (found by TYPE-02 testing, 9 Nov 2026):** §6.1 says a digraph output counts as one grapheme and ZWNJ counts as one grapheme — but `Intl.Segmenter` (UAX #29, the §6.3 formula's own primitive) segments `تھ`/`بھ` as **two** clusters and attaches ZWNJ to the preceding cluster (0 additional clusters). The two rules cannot both hold. | **Implemented: Segmenter literally** (both paths agree; the corpus test proves it). Digraphs count 2, ZWNJ contributes 0 after a character / 1 at cluster start. | Owner/coordinator: either accept Segmenter behaviour (close O-8, amend §6.1 prose) or define a language-specific cluster-merge rule on top of Segmenter (digraph/ZWNJ merging) with its own fixtures. Until then, no code merges clusters. |

## 9. Files that implement this paper

- `assets/js/dk-scoring.js` — the one scoring service (TYPE-02).
- `assets/js/typing.js`, `assets/js/lessons.js`,
  `assets/js/urdu-test.js`, `assets/js/urdu-lessons-viewer.js` — live
  engines, all scoring through `DKScoring` (TYPE-02/04).
- `assets/js/certificate.js` — verified-flag enforcement (TYPE-05).
- `assets/js/dk2.js` — `saveResult` dedup (TYPE-06).
- Evidence: `implementation/checks/WP4_*.json`
  (corpus, sub-second, verified, dedup, exit).
