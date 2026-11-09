/* DoKit — shared scoring service (V3 WP-4, TYPE-02; Architecture §6/§8.2).
 *
 * WHY one file: the live stacks counted characters four different ways
 * (audit W2 C1/C8) — English net WPM in UTF-16 units, Urdu timed-test
 * gross WPM in UTF-16 units, lessons net in UTF-16 units — and
 * Intl.Segmenter appeared nowhere in the repo (0 hits). Every live
 * engine (typing.js, lessons.js, urdu-test.js, urdu-lessons-viewer.js)
 * now scores through DKScoring.score() and nothing else computes a WPM.
 * The legacy engine's gwpm/nwpm is a retired scoring path; its
 * historical records keep their tags (docs/scoring-metrics-v2.md §3).
 *
 * WHAT: grapheme-aware counting (Intl.Segmenter with a documented
 * fallback), NFC normalisation, the canonical v2 formulas
 * (net WPM = correct graphemes / 5 / minutes; gross is diagnostics
 * only, never displayed as "WPM"), the shared 1000 ms sub-second gate,
 * session ids (the dedup key), and the verified-eligibility predicate.
 * The single reference for all of this is docs/scoring-metrics-v2.md;
 * this file implements it and cites it. If they disagree, the paper
 * wins and this file is a bug.
 *
 * LOAD ORDER: this file must load BEFORE typing.js, lessons.js,
 * urdu-test.js and urdu-lessons-viewer.js (see the typing pages'
 * script tags). Consumers degrade gracefully when it is absent (they
 * keep their pre-v2 formulas) so a failed load never breaks typing —
 * but a missing file on a typing page is a defect, not a supported
 * configuration.
 *
 * No i18n keys, no Firebase, no network, no storage writes.
 * Version: v2-net-grapheme (metric version constant below).
 */
(function () {
  'use strict';

  // Canonical metric version stamped on every v2 result (paper §4).
  var METRIC_VERSION = 'v2-net-grapheme';
  // Shared sub-second gate (paper §6; Architecture §8.6): a run
  // finishing below this elapsed time is REJECTED, never floored.
  var MIN_ELAPSED_MS = 1000;

  // -- Normalisation ------------------------------------------------------
  // WHY NFC, once, at this boundary: Urdu/Persian/Arabic text can arrive
  // in composed or decomposed form (e + combining acute vs precomposed
  // é); comparing without normalising would mark identical-looking text
  // wrong. Stored passage text is never rewritten — only the scored
  // copies are normalised.
  function normalize(text) {
    text = (text == null) ? '' : String(text);
    return (typeof text.normalize === 'function') ? text.normalize('NFC') : text;
  }

  // -- Grapheme segmentation ----------------------------------------------
  // WHY Segmenter first: it is the Unicode-correct primitive (UAX #29).
  // The fallback exists for engines without it; it is an approximation
  // with a documented scope (Latin + Arabic-script combining marks,
  // ZWJ emoji sequences, variation selectors, emoji modifiers,
  // regional-indicator pairs, Hangul jamo) and is fixture-tested
  // against the same corpus as the Segmenter path. Any divergence is
  // recorded in the check JSON, never assumed away.
  var segmenterCache = {};
  function hasSegmenter() {
    return (typeof Intl !== 'undefined') && (typeof Intl.Segmenter === 'function');
  }
  function getSegmenter(locale) {
    var key = locale || 'en';
    if (segmenterCache.hasOwnProperty(key)) { return segmenterCache[key]; }
    var seg = null;
    try {
      if (hasSegmenter()) { seg = new Intl.Segmenter(key, { granularity: 'grapheme' }); }
    } catch (e) { seg = null; }
    segmenterCache[key] = seg;
    return seg;
  }
  function graphemeVersion() {
    return hasSegmenter() ? 'segmenter' : 'fallback';
  }

  // Combining-mark test. WHY new RegExp (not a literal): a /\p{M}/u
  // literal throws a SyntaxError at PARSE time on engines without
  // Unicode property escapes, which would break this whole file. The
  // constructor throws at RUNTIME instead, so we can fall back to the
  // range table below (Latin + Arabic-script blocks; the \p{M} path is
  // the accurate one wherever it exists, which is every engine that
  // ships Intl.Segmenter).
  var markRe = null, markReTried = false;
  function markRegex() {
    if (markReTried) { return markRe; }
    markReTried = true;
    try { markRe = new RegExp('\\p{M}', 'u'); } catch (e) { markRe = null; }
    return markRe;
  }
  // ASCII fast path + the combining ranges the fallback needs. This
  // table is a deliberate subset (not all of Unicode Mark): it covers
  // the scripts DoKit types today. Anything outside it falls back to
  // "own cluster", which over-counts rather than silently merging.
  var MARK_RANGES = [
    [0x0300, 0x036F], [0x0483, 0x0489], [0x0591, 0x05BD], [0x05BF, 0x05BF],
    [0x05C1, 0x05C2], [0x05C4, 0x05C7], [0x0610, 0x061A], [0x064B, 0x065F],
    [0x0670, 0x0670], [0x06D6, 0x06DC], [0x06DF, 0x06E4], [0x06E7, 0x06E8],
    [0x06EA, 0x06ED], [0x0711, 0x0711], [0x0730, 0x074A], [0x07A6, 0x07B0],
    [0x0816, 0x0819], [0x081B, 0x0823], [0x0825, 0x0827], [0x0829, 0x082D],
    [0x0859, 0x085B], [0x08D3, 0x08E1], [0x08E3, 0x0902], [0x093A, 0x093A],
    [0x093C, 0x093C], [0x0941, 0x0948], [0x094D, 0x094D], [0x0951, 0x0957],
    [0x0962, 0x0963], [0x0981, 0x0981], [0x09BC, 0x09BC], [0x09C1, 0x09C4],
    [0x09CD, 0x09CD], [0x09E2, 0x09E3], [0x0A01, 0x0A02], [0x0A3C, 0x0A3C],
    [0x0A41, 0x0A42], [0x0A47, 0x0A48], [0x0A4B, 0x0A4D], [0x0A51, 0x0A51],
    [0x0A70, 0x0A71], [0x0A75, 0x0A75], [0x0A81, 0x0A82], [0x0ABC, 0x0ABC],
    [0x0AC1, 0x0AC5], [0x0AC7, 0x0AC8], [0x0ACD, 0x0ACD], [0x0AE2, 0x0AE3],
    [0x0B01, 0x0B01], [0x0B3C, 0x0B3C], [0x0B3F, 0x0B3F], [0x0B41, 0x0B44],
    [0x0B4D, 0x0B4D], [0x0B56, 0x0B56], [0x0B62, 0x0B63], [0x0B82, 0x0B82],
    [0x0BC0, 0x0BC0], [0x0BCD, 0x0BCD], [0x0C00, 0x0C00], [0x0C3E, 0x0C40],
    [0x0C46, 0x0C48], [0x0C4A, 0x0C4D], [0x0C55, 0x0C56], [0x0C62, 0x0C63],
    [0x0C81, 0x0C81], [0x0CBC, 0x0CBC], [0x0CBF, 0x0CBF], [0x0CC6, 0x0CC6],
    [0x0CCC, 0x0CCD], [0x0CE2, 0x0CE3], [0x0D00, 0x0D01], [0x0D3B, 0x0D3C],
    [0x0D41, 0x0D44], [0x0D4D, 0x0D4D], [0x0D62, 0x0D63], [0x0DCA, 0x0DCA],
    [0x0DD2, 0x0DD4], [0x0DD6, 0x0DD6], [0x0E31, 0x0E31], [0x0E34, 0x0E3A],
    [0x0E47, 0x0E4E], [0x0EB1, 0x0EB1], [0x0EB4, 0x0EB9], [0x0EBB, 0x0EBC],
    [0x0EC8, 0x0ECD], [0x0F18, 0x0F19], [0x0F35, 0x0F35], [0x0F37, 0x0F37],
    [0x0F39, 0x0F39], [0x0F71, 0x0F7E], [0x0F80, 0x0F84], [0x0F86, 0x0F87],
    [0x0F8D, 0x0F97], [0x0F99, 0x0FBC], [0x0FC6, 0x0FC6], [0x102D, 0x1030],
    [0x1032, 0x1037], [0x1039, 0x103A], [0x103D, 0x103E], [0x1058, 0x1059],
    [0x105E, 0x1060], [0x1071, 0x1074], [0x1082, 0x1082], [0x1085, 0x1086],
    [0x108D, 0x108D], [0x109D, 0x109D], [0x1AB0, 0x1AFF], [0x1DC0, 0x1DFF],
    [0x20D0, 0x20FF], [0xFE20, 0xFE2F]
  ];
  function isCombiningMark(cpNum, cpStr) {
    var re = markRegex();
    if (re) { return re.test(cpStr); }
    for (var i = 0; i < MARK_RANGES.length; i++) {
      if (cpNum >= MARK_RANGES[i][0] && cpNum <= MARK_RANGES[i][1]) { return true; }
    }
    return false;
  }
  function isRegionalIndicator(cpNum) { return cpNum >= 0x1F1E6 && cpNum <= 0x1F1FF; }
  function isVariationSelector(cpNum) {
    return (cpNum >= 0xFE00 && cpNum <= 0xFE0F) || (cpNum >= 0xE0100 && cpNum <= 0xE01EF);
  }
  function isEmojiModifier(cpNum) { return cpNum >= 0x1F3FB && cpNum <= 0x1F3FF; }
  function isHangulJamo(cpNum) {
    return (cpNum >= 0x1100 && cpNum <= 0x11FF) || (cpNum >= 0xA960 && cpNum <= 0xA97C) ||
      (cpNum >= 0xD7B0 && cpNum <= 0xD7FB);
  }
  // Extended_Pictographic approximation (UTS #51) — used ONLY to
  // decide whether the code point after a ZWJ joins the cluster.
  // Deliberately a subset: the emoji blocks plus the pictographic
  // symbols that appear in ZWJ sequences. Anything outside it is
  // treated as non-pictographic, so a ZWJ sequence over-counts
  // (splits) rather than silently merging unlike characters.
  var PICTO_RANGES = [
    [0x1F000, 0x1FAFF], [0x2600, 0x27BF], [0x2300, 0x23FF], [0x2B00, 0x2BFF],
    [0x00A9, 0x00A9], [0x00AE, 0x00AE], [0x203C, 0x203C], [0x2049, 0x2049],
    [0x2122, 0x2122], [0x2139, 0x2139], [0x2194, 0x2199], [0x21A9, 0x21AA],
    [0x231A, 0x231B], [0x2328, 0x2328], [0x2388, 0x2388], [0x23CF, 0x23CF],
    [0x23E9, 0x23F3], [0x23F8, 0x23FA], [0x24C2, 0x24C2], [0x25AA, 0x25AB],
    [0x25B6, 0x25B6], [0x25C0, 0x25C0], [0x25FB, 0x25FE]
  ];
  function isPictographic(cpNum) {
    for (var i = 0; i < PICTO_RANGES.length; i++) {
      if (cpNum >= PICTO_RANGES[i][0] && cpNum <= PICTO_RANGES[i][1]) { return true; }
    }
    return false;
  }

  // Fallback segmentation (no Intl.Segmenter). Walks UTF-16 units by
  // hand (pure ES5 — no for..of, no codePointAt) so it works on the
  // same old engines that lack Segmenter. Rules, in order (each
  // verified against Intl.Segmenter on the corpus — the two paths
  // must agree; see implementation/scripts/wp4_type02_corpus.js):
  //  - ZWNJ (U+200C) attaches to the PRECEDING cluster (Segmenter:
  //    'ی‌' is one cluster; a ZWNJ with no preceding character is
  //    its own cluster). It is never stripped, never inserted, and
  //    it does NOT pull the following character in (it breaks the
  //    join — that is its purpose).
  //  - A combining mark, variation selector or emoji modifier joins
  //    the preceding cluster.
  //  - ZWJ (U+200D) always joins the preceding cluster, but the code
  //    point AFTER it joins only in an emoji sequence (both sides
  //    pictographic) — Segmenter: 'a‍b' is 2 clusters, '👨‍👩' is 1.
  //  - A regional indicator joins a preceding lone RI (flag pairs);
  //    a third RI starts a new cluster.
  //  - Hangul jamo joins a preceding jamo cluster (UAX #29).
  //  - Everything else starts a new cluster.
  //  - NOTE on digraphs: 'تھ'/'بھ' segment as TWO clusters under
  //    UAX #29 (both letters are ordinary letters, not marks).
  //    Architecture §6.1 prose says "one visible grapheme" — that
  //    does not match Segmenter behaviour; it is recorded as open
  //    decision O-8 in docs/scoring-metrics-v2.md. The formula
  //    (§6.3, Segmenter-segmented) is normative here, so digraphs
  //    count 2, exactly as UTF-16 did — the v2 fix for Urdu is the
  //    diacritic/ZWNJ/astral counting, not the digraph count.
  function segmentFallback(text) {
    var clusters = [], cur = '', curLastCp = -1, curRiCount = 0,
      zwjPending = false, curHasPicto = false;
    var i = 0, len = text.length;
    while (i < len) {
      var unit = text.charCodeAt(i), cpNum, cpStr;
      if (unit >= 0xD800 && unit <= 0xDBFF && i + 1 < len) {
        var low = text.charCodeAt(i + 1);
        if (low >= 0xDC00 && low <= 0xDFFF) {
          cpNum = ((unit - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000;
          cpStr = text.slice(i, i + 2);
          i += 2;
        } else { cpNum = unit; cpStr = text.charAt(i); i += 1; }
      } else { cpNum = unit; cpStr = text.charAt(i); i += 1; }
      var join = false;
      if (cur !== '') {
        // ZWJ follow-on: the code point after a ZWJ joins ONLY in an
        // emoji sequence (cluster already pictographic AND this code
        // point pictographic) — or when it is another ZWJ.
        if (zwjPending) { join = (cpNum === 0x200D) || (curHasPicto && isPictographic(cpNum)); }
        else if (cpNum === 0x200D) { join = true; } // ZWJ joins the preceding cluster
        else if (cpNum === 0x200C) { join = true; } // ZWNJ attaches to the preceding cluster (Segmenter: 'ی‌' is one cluster)
        else if (isCombiningMark(cpNum, cpStr)) { join = true; }
        else if (isVariationSelector(cpNum)) { join = true; }
        else if (isEmojiModifier(cpNum)) { join = true; }
        else if (isRegionalIndicator(cpNum) && curRiCount === 1) { join = true; }
        else if (isHangulJamo(cpNum) && isHangulJamo(curLastCp)) { join = true; }
        // NOTE: a ZWNJ never pulls the FOLLOWING character in — after
        // it joins, zwjPending stays false (that is what ZWNJ is for).
      }
      if (join) {
        cur += cpStr;
        if (isPictographic(cpNum)) { curHasPicto = true; }
        zwjPending = (cpNum === 0x200D);
        if (isRegionalIndicator(cpNum)) { curRiCount += 1; }
      } else {
        if (cur !== '') { clusters.push(cur); }
        cur = cpStr;
        curRiCount = isRegionalIndicator(cpNum) ? 1 : 0;
        curHasPicto = isPictographic(cpNum);
        zwjPending = (cpNum === 0x200D);
      }
      curLastCp = cpNum;
    }
    if (cur !== '') { clusters.push(cur); }
    return clusters;
  }

  function segmentGraphemes(text, locale) {
    var norm = normalize(text);
    var seg = getSegmenter(locale);
    if (seg) {
      var out = [], it = seg.segment(norm);
      // Segmenter returns an iterable of {segment, ...}; consume it
      // without for..of so this file stays ES5-shaped. Guard Symbol
      // (an engine with a Segmenter shim but no Symbol falls through
      // to the hand-rolled segmentation below).
      var iter = (typeof Symbol !== 'undefined' && it && it[Symbol.iterator])
        ? it[Symbol.iterator]() : null;
      if (iter) {
        var step = iter.next();
        while (!step.done) { out.push(step.value.segment); step = iter.next(); }
        return out;
      }
      // No Symbol.iterator (very old engine with a Segmenter shim):
      // fall through to the hand-rolled segmentation below.
    }
    return segmentFallback(norm);
  }
  function countGraphemes(text, locale) {
    return segmentGraphemes(text, locale).length;
  }

  // -- Canonical scoring (paper §1) ----------------------------------------
  // WHY position-wise cluster comparison: the passage and the typed text
  // are compared cluster by cluster, in order. A correct cluster at a
  // position counts once; extra typed clusters count as errors (they
  // raise the typed total, not the correct count) — the same semantics
  // v1 had per UTF-16 unit, now per grapheme.
  function score(passage, typed, elapsedMs, language) {
    var lang = language || 'en';
    var p = segmentGraphemes(passage, lang);
    var t = segmentGraphemes(typed, lang);
    var n = Math.min(p.length, t.length), correct = 0, i;
    for (i = 0; i < n; i++) { if (p[i] === t[i]) { correct++; } }
    var mins = (typeof elapsedMs === 'number' ? elapsedMs : 0) / 60000;
    var wpm = mins > 0 ? Math.round((correct / 5) / mins) : 0;
    var gross = mins > 0 ? Math.round((t.length / 5) / mins) : 0;
    var acc = t.length ? Math.round(correct / t.length * 100) : 100;
    return {
      correct: correct, typed: t.length, wpm: wpm, gross: gross, acc: acc,
      metricVersion: METRIC_VERSION, graphemeVersion: graphemeVersion(),
      language: lang
    };
  }

  // -- Session integrity helpers (paper §5–§7) ------------------------------
  function isSubSecond(elapsedMs) {
    return (typeof elapsedMs !== 'number' || elapsedMs < MIN_ELAPSED_MS);
  }
  // WHY crypto.randomUUID first: a session id must be unique per
  // session start (it is the dedup key). The Date+random fallback is
  // for engines without crypto.randomUUID. It is an opaque id, not a
  // secret, and is stored on the result it identifies.
  function newSessionId() {
    try {
      if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
    } catch (e) { /* fall through to the Math.random form */ }
    return 's-' + Date.now().toString(36) + '-' +
      Math.floor(Math.random() * 0xFFFFFF).toString(16);
  }
  // WHY verified !== false (not === true): v1 records predate the flag
  // and carry no verified field — they stay eligible. Only an explicit
  // verified:false (a pasted session) is excluded.
  function isVerifiedEligible(r) {
    return !!r && r.verified !== false;
  }
  // Dedup predicate (paper §7; Test Center spec §1.5): the SAME session
  // re-submitted — same sessionId + same contentId + same
  // metricVersion. Records without a sessionId (v1) are never deduped,
  // and two different sessions with identical scores are two results.
  function isDuplicateOf(prev, next) {
    if (!prev || !next) { return false; }
    if (typeof prev.sessionId !== 'string' || !prev.sessionId) { return false; }
    if (prev.sessionId !== next.sessionId) { return false; }
    if (typeof prev.contentId !== 'string' || !prev.contentId) { return false; }
    if (prev.contentId !== next.contentId) { return false; }
    if (typeof prev.metricVersion !== 'string' || !prev.metricVersion) { return false; }
    return prev.metricVersion === next.metricVersion;
  }

  window.DKScoring = {
    METRIC_VERSION: METRIC_VERSION,
    MIN_ELAPSED_MS: MIN_ELAPSED_MS,
    normalize: normalize,
    segmentGraphemes: segmentGraphemes,
    countGraphemes: countGraphemes,
    score: score,
    isSubSecond: isSubSecond,
    newSessionId: newSessionId,
    isVerifiedEligible: isVerifiedEligible,
    isDuplicateOf: isDuplicateOf,
    graphemeVersion: graphemeVersion
  };
})();
