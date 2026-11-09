/* DoKit — Urdu timed test (restore port).
 *
 * WHAT: Timed Urdu typing test for urdu-test-controls.html: duration picker
 *   (1/3/5 minutes), passage picker (3 old passages), Start, Quit, Restart,
 *   Back and Retry controls, live + final WPM/accuracy, countdown timer.
 *
 * WHY this file mirrors the old controller (js/pages/urdu-typing.js) instead
 *   of the new English viewer: the old test's rules are the spec — timer
 *   starts on the FIRST KEYSTROKE (not on Start), and word-level highlighting
 *   (never per-character spans, which break Nastaliq joining).
 *   SCORING (WP-4, v2): WPM is NET — (correct graphemes / 5) / minutes —
 *   scored through the shared service (dk-scoring.js,
 *   docs/scoring-metrics-v2.md). The old gross formula (all typed chars)
 *   is history: old records keep the tag v1-gross-utf16 and are never
 *   rewritten. A sub-second finish is rejected, not floored (TYPE-04).
 *
 * DEVICE-LOCAL ONLY: nothing here talks to a server. The old test saved
 *   results to localStorage (dokit_urdu_progress) and optionally logged them
 *   to the old Journey timeline — both were already device-local, NOT
 *   Firebase/backend, so there is no backend behaviour to replace. The only
 *   persistence here is an optional window.DK2.saveResult() call (the new
 *   site's on-device store); if DK2 is absent, the result is simply shown
 *   on screen and nothing is written. A quit test is never saved: quitting
 *   is not a result, and saving it would fake a completed test.
 *
 * PORTED (WP-5 TYPE-11, C4; Architecture §5.5): the on-screen Urdu
 *   keyboard + next-key highlight from the old page now live in this
 *   test — window.UrduKB (js/urdu-keyboard.js, canonical map from WP-3)
 *   renders into #ur-test-kb, attaches to the typing area on Start,
 *   and detaches on quit/finish. Users without a physical Urdu keyboard
 *   type Roman letters and get Urdu (the page's stated model). If
 *   UrduKB failed to load, the test keeps working with the physical
 *   keyboard — the port is guarded, never a hard dependency.
 *
 * IDs must match urdu-test-controls.html exactly (setup, active, done,
 *   durRow, passRow, startTestBtn, activeTitle, statWpm, statAcc, statTime,
 *   targetText, typeArea, quitBtn, restartBtn, resWpm, resAcc, resChars,
 *   resTime, resVerdict, backBtn, retryBtn).
 */
(function () {
  'use strict';

  // -- Timed-test passages: verbatim from old js/urdu-lessons.js (URDU_TESTS).
  // WP-5 TYPE-13: test passages carry version: 1 each (store v1);
  // bump an item's version whenever its text changes. Results stamp
  // contentVersion 'ur-test:<version>' (paper §4).
  var URDU_TEST_PASSAGES = [
    { id: 't1', version: 1, title: 'روزمرہ', titleEn: 'Daily Life',
      text: 'صبح اٹھ کر میں وضو کرتا ہوں اور نماز پڑھتا ہوں۔ پھر ناشتہ کرتا ہوں اور سکول جاتا ہوں۔ سکول میں استاد ہمیں اردو، حساب اور انگریزی پڑھاتے ہیں۔ چھٹی کے بعد میں گھر آ کر کھانا کھاتا ہوں اور کھیلتا ہوں۔ شام کو میں سبق یاد کرتا ہوں۔ رات کو جلدی سو جاتا ہوں تاکہ صبح تازہ دم اٹھوں۔' },
    { id: 't2', version: 1, title: 'پاکستان', titleEn: 'Pakistan',
      text: 'پاکستان جنوبی ایشیا کا ایک اہم ملک ہے۔ اس کا دارالحکومت اسلام آباد ہے۔ کراچی سب سے بڑا شہر اور معاشی مرکز ہے۔ لاہور ثقافتی دل کہلاتا ہے۔ یہاں اردو قومی زبان ہے۔ پاکستان کے شمال میں دنیا کے بلند ترین پہاڑ ہیں جن میں کے ٹو بھی شامل ہے۔ دریائے سندھ اس ملک کی شہ رگ ہے۔' },
    { id: 't3', version: 1, title: 'علم کی اہمیت', titleEn: 'Knowledge',
      text: 'علم وہ روشنی ہے جو جہالت کے اندھیروں کو دور کرتی ہے۔ جو قومیں علم حاصل کرتی ہیں وہ ترقی کرتی ہیں۔ کتاب انسان کی بہترین دوست ہے۔ پڑھنے کی عادت انسان کو دانشمند بناتی ہے۔ ہمیں چاہیے کہ روز کچھ نہ کچھ پڑھیں۔ علم کبھی ضائع نہیں ہوتا۔ محنت اور لگن سے ہر مشکل آسان ہو جاتی ہے۔' }
  ];

  function $(id) { return document.getElementById(id); }
  var setupEl = $('setup'), activeEl = $('active'), doneEl = $('done');
  // No test fragment on this page; fail silently instead of throwing.
  if (!setupEl || !activeEl || !doneEl) { return; }

  var minutes = 1, passIndex = 0; // current choices (defaults match the old page)
  var target = '', words = [], typed = '', started = false, done = false,
      t0 = 0, timer = null;
  // WP-5 TYPE-11 (C4): the on-screen keyboard container. Looked up once
  // here (after the setup/active/done guard above, so the element is
  // known to exist on this page); kbAttach/kbDetach below guard on
  // window.UrduKB, so a failed keyboard load never breaks the test.
  var kbEl = $('ur-test-kb');
  // WP-4 TYPE-02: session id (dedup key, paper §7) + paste flag for
  // the verified stamp (paper §5). newSid() falls back to a
  // Date+random id when DKScoring failed to load; it never throws.
  var sessionId = null, pasted = false;
  function newSid(){
    return window.DKScoring ? window.DKScoring.newSessionId()
      : ('s-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 0xFFFFFF).toString(16));
  }

  // -- View switching: exactly one pane visible at a time --------------------
  // WHY native .hidden (not a CSS class): the new stylesheet defines no
  // .hidden rule, so the HTML hidden attribute is used instead.
  function show(id) {
    setupEl.hidden = (id !== 'setup');
    activeEl.hidden = (id !== 'active');
    doneEl.hidden = (id !== 'done');
    window.scrollTo(0, 0);
  }

  // Format seconds as M:SS (e.g. 65 -> "1:05"), as in the old controller.
  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
  }

  // -- Word-level rendering (Nastaliq-safe: whole words, never letters) -----
  function renderTarget() {
    var t = $('targetText');
    t.innerHTML = '';
    words.forEach(function (w, i) {
      var s = document.createElement('span');
      s.className = 'w';
      s.textContent = w;
      t.appendChild(s);
      if (i < words.length - 1) { t.appendChild(document.createTextNode(' ')); }
    });
    markWords(0, []);
  }
  // states[i] === true (correct) / false (incorrect) / undefined (not judged).
  // A word is judged only once it is finished (space typed after it).
  function markWords(curIdx, states) {
    var spans = $('targetText').querySelectorAll('.w');
    spans.forEach(function (s, i) {
      s.classList.toggle('cur', i === curIdx);
      s.classList.toggle('ok', states[i] === true);
      s.classList.toggle('bad', states[i] === false);
    });
  }

  // -- Live stats -----------------------------------------------------------
  // WP-4 TYPE-02 (D-2: net everywhere from v2): WPM = (correct
  // graphemes / 5) / minutes; accuracy = correct / typed graphemes —
  // scored through the ONE shared service (dk-scoring.js,
  // docs/scoring-metrics-v2.md §1-2). The old gross formula (typed
  // chars, not correct ones) is kept ONLY as the fallback when
  // DKScoring failed to load; its tag is then v1-gross-utf16, so a
  // fallback-scored result can never be mistaken for a v2 one.
  function updateLive(elSecs) {
    var st;
    if (window.DKScoring) {
      st = window.DKScoring.score(target, typed, elSecs * 1000, 'ur');
    } else {
      var n = Math.min(typed.length, target.length), ok = 0, i;
      for (i = 0; i < n; i++) { if (typed[i] === target[i]) { ok++; } }
      var acc0 = typed.length ? Math.round(ok / typed.length * 100) : 100;
      var mins0 = elSecs / 60;
      st = { wpm: mins0 > 0.01 ? Math.round((typed.length / 5) / mins0) : 0,
        acc: acc0, ok: ok, correct: ok, typed: typed.length,
        metricVersion: 'v1-gross-utf16', graphemeVersion: 'utf16' };
    }
    var wpm = st.wpm, acc = st.acc;
    // WHY the 0.6 s display clamp (kept from the old code): with
    // elapsed near 0 the division would flash an absurd live WPM.
    // Display only — finish() scores the real elapsed time, and the
    // sub-second gate (TYPE-04) rejects sub-second finishes outright.
    if (elSecs <= 0.6) { wpm = 0; }
    $('statWpm').textContent = wpm;
    $('statAcc').textContent = acc + '%';
    return { wpm: wpm, acc: acc, ok: st.correct };
  }

  // -- Timer tick (every 250ms, as in the old controller) --------------------
  function tick() {
    if (!started || done) { return; }
    var el = (Date.now() - t0) / 1000;
    var left = minutes * 60 - el;
    $('statTime').textContent = fmt(left);
    if (left <= 0) { finish(); return; }
    updateLive(el);
  }

  // -- Virtual keyboard (WP-5 TYPE-11, C4; Architecture §5.5) -------------
  // WHY the port, not a new keyboard: the old page already shipped this
  // keyboard + next-key highlight; the live test just never loaded it.
  // The port reuses window.UrduKB (canonical map, WP-3) — no second map,
  // no new keyboard code, no layout picker in this port (the keyboard
  // defaults to the saved layout, phonetic; a picker is a WP-7 UX item).
  // WHY attach/detach per attempt: UrduKB attaches to exactly one
  // element; attaching on start() and detaching on quit/finish returns
  // the textarea to normal typing and never leaks the listener.
  // WHY the highlight follows typed.length: the next expected character
  // is target[typed.length] — the same rule the old controller used
  // (js/pages/urdu-typing.js:384-391), so a digraph's second letter
  // highlights after its first is typed.
  function kbHighlight() {
    if (!window.UrduKB || !kbEl) { return; }
    var pos = typed.length, nextCh = pos < target.length ? target[pos] : null;
    if (nextCh === ' ') { window.UrduKB.highlightKey('Space', false); }
    else if (nextCh) {
      var f = window.UrduKB.findKeyFor(nextCh);
      window.UrduKB.highlightKey(f ? f.key : null, f ? f.shift : false);
    } else { window.UrduKB.highlightKey(null); }
  }
  function kbAttach() {
    if (!window.UrduKB || !kbEl) { return; }
    window.UrduKB.renderKeyboard(kbEl);
    window.UrduKB.attach($('typeArea'));
    kbHighlight();
  }
  function kbDetach() {
    if (!window.UrduKB) { return; }
    try { window.UrduKB.highlightKey(null); } catch (e) { /* highlight is cosmetic; never break finish/quit */ }
    window.UrduKB.detach();
  }

  // -- Input handling: timer starts on the FIRST keystroke -------------------
  // WHY paste is tracked: a pasted test is not a verified one (paper
  // §5) — the paste event and the insertFromPaste input type both set
  // the flag that finish() turns into verified: false.
  function onInput(ev) {
    if (done) { return; }
    if (ev && ev.inputType === 'insertFromPaste') { pasted = true; }
    if (!started) {
      started = true;
      t0 = Date.now();
      timer = setInterval(tick, 250);
    }
    typed = $('typeArea').value;
    var el = (Date.now() - t0) / 1000;
    updateLive(el);
    var yw = typed.split(' '), states = [], i;
    for (i = 0; i < words.length; i++) {
      if (i < yw.length - 1 || (i === yw.length - 1 && typed.length && typed[typed.length - 1] === ' ')) {
        states[i] = (yw[i] === words[i]);
      }
    }
    markWords(Math.min(yw.length - 1, words.length - 1), states);
    // WP-5 TYPE-11: the next-key highlight follows every keystroke
    // (physical or on-screen — both flow through this input handler).
    kbHighlight();
  }

  // -- Finish: show results; save on-device ONLY if DK2 exists ---------------
  function finish() {
    if (done) { return; }
    done = true;
    clearInterval(timer);
    // WP-5 TYPE-11: detach the keyboard on finish (both exits below) —
    // the attempt is over, so transliteration stops and the highlight
    // clears; a retry re-attaches in start().
    kbDetach();
    // WP-4 TYPE-04 (C2, Architecture §8.6; paper §6): the shared
    // sub-second rule — the English rejection gate, applied here.
    // A run finishing below 1000 ms is REJECTED, not scored: nothing
    // is saved, no result is shown as a score, no XP/referral/
    // lastTestAt/challenge side-effect runs. The old Math.max(1, …)
    // floor is gone as a scoring path — flooring would turn a paste
    // into a ~120 WPM score. Retry (restartBtn/retryBtn) starts a
    // fresh session; the rejection is not a lockout.
    var elapsedMs = started ? (Date.now() - t0) : 0;
    if (window.DKScoring ? window.DKScoring.isSubSecond(elapsedMs) : elapsedMs < 1000) {
      $('resWpm').textContent = '0';
      $('resAcc').textContent = '0%';
      $('resChars').textContent = '0';
      $('resTime').textContent = fmt(0);
      // WHY the dict key (not a literal): the same anti-cheat message
      // the English test shows, translated by the active display
      // language (EN + UR translations exist).
      $('resVerdict').textContent = (window.dkT ? window.dkT('typing_too_fast', 'Result not counted: the test finished too quickly to be a timed typing test. Please type the passage yourself and try again.') : 'Result not counted: the test finished too quickly to be a timed typing test. Please type the passage yourself and try again.');
      show('done');
      return;
    }
    var secs = elapsedMs / 1000;
    var st;
    if (window.DKScoring) {
      st = window.DKScoring.score(target, typed, secs * 1000, 'ur');
    } else {
      var n = Math.min(typed.length, target.length), ok = 0, i;
      for (i = 0; i < n; i++) { if (typed[i] === target[i]) { ok++; } }
      var acc0 = typed.length ? Math.round(ok / typed.length * 100) : 0;
      st = { wpm: Math.round((typed.length / 5) / (secs / 60)), acc: acc0,
        correct: ok, typed: typed.length, gross: Math.round((typed.length / 5) / (secs / 60)),
        metricVersion: 'v1-gross-utf16', graphemeVersion: 'utf16' };
    }
    var acc = st.acc;
    var wpm = st.wpm;
    $('resWpm').textContent = wpm;
    $('resAcc').textContent = acc + '%';
    // WHY st.typed (grapheme count): the v2 result counts the same
    // units the score counted (paper §2). For plain text it equals
    // typed.length; for digraph/ZWNJ-heavy text it is smaller — that
    // smaller number is the correct one.
    $('resChars').textContent = st.typed;
    $('resTime').textContent = fmt(secs);
    // Verdict wording verbatim from the old controller (threshold: 25 WPM).
    $('resVerdict').textContent = wpm >= 25 ? '🌟 شاندار رفتار!' : 'اچھی کوشش! مشق جاری رکھیں۔';
    // Device-local record only (new site's on-device store). No server call,
    // no account, no sync — and no write at all when DK2 is absent.
    // WP-4 TYPE-02: v2 tags (paper §4) — net WPM from v2, gross kept
    // for diagnostics only, never displayed as "WPM".
    if (window.DK2 && window.DK2.saveResult) {
      window.DK2.saveResult({ type: 'urdu-test', minutes: minutes, wpm: wpm, acc: acc,
        gross: st.gross, graphemes: st.typed, language: 'ur',
        verified: !pasted, metricVersion: st.metricVersion,
        graphemeVersion: st.graphemeVersion, sessionId: sessionId,
        contentId: 'urdu-test:' + URDU_TEST_PASSAGES[passIndex].id,
        contentVersion: 'ur-test:' + (URDU_TEST_PASSAGES[passIndex].version || 1), mode: 'timed' });
    }
    show('done');
  }

  // -- Session control ---------------------------------------------------------
  function start() {
    var p = URDU_TEST_PASSAGES[passIndex];
    target = p.text;
    words = target.split(' ');
    typed = ''; started = false; done = false;
    // WHY a fresh session id per start: a start is a new attempt —
    // reusing the old id would make dedup (paper §7) drop the new
    // attempt as a re-submission of the old one.
    sessionId = newSid(); pasted = false;
    clearInterval(timer);
    $('activeTitle').textContent = p.title + ' — ' + minutes + ' منٹ';
    $('statWpm').textContent = '0';
    $('statAcc').textContent = '100%';
    $('statTime').textContent = fmt(minutes * 60);
    $('typeArea').value = '';
    renderTarget();
    show('active');
    $('typeArea').focus();
    // WP-5 TYPE-11: render + attach the on-screen keyboard for this
    // attempt (guarded: without UrduKB the test is physical-only).
    kbAttach();
  }
  // Quit discards the attempt: no result is shown and nothing is saved.
  function quit() { clearInterval(timer); done = true; kbDetach(); show('setup'); }

  // -- Picker wiring -----------------------------------------------------------
  function renderPassagePicker() {
    var pr = $('passRow');
    pr.innerHTML = '';
    URDU_TEST_PASSAGES.forEach(function (t, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick' + (i === passIndex ? ' sel' : '');
      b.setAttribute('aria-pressed', i === passIndex ? 'true' : 'false');
      // Same shape as the old controller: Urdu title + English subtitle.
      var u = document.createElement('span'); u.lang = 'ur'; u.textContent = t.title;
      var e = document.createElement('small'); var _tk = {'Daily Life':'rsv_1048','Knowledge':'rsv_1049'}[t.titleEn]; e.textContent = (_tk && window.dkT) ? window.dkT(_tk, t.titleEn) : t.titleEn;
      b.appendChild(u); b.appendChild(document.createElement('br')); b.appendChild(e);
      b.addEventListener('click', function () { passIndex = i; renderPassagePicker(); });
      pr.appendChild(b);
    });
  }
  // Refresh only (no listeners here): listeners are bound ONCE below, so
  // re-rendering can never stack duplicate handlers on the same button.
  function refreshDurationPicker() {
    var row = $('durRow');
    if (!row) { return; }
    row.querySelectorAll('button').forEach(function (b) {
      var on = parseInt(b.getAttribute('data-min'), 10) === minutes;
      b.classList.toggle('sel', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  // -- Init ---------------------------------------------------------------------
  renderPassagePicker();
  (function bindDurationPicker() {
    var row = $('durRow');
    if (!row) { return; }
    row.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        minutes = parseInt(b.getAttribute('data-min'), 10);
        refreshDurationPicker();
      });
    });
    refreshDurationPicker();
  })();
  $('startTestBtn').addEventListener('click', start);
  $('typeArea').addEventListener('input', onInput);
  $('typeArea').addEventListener('paste', function(){ pasted = true; });
  $('quitBtn').addEventListener('click', quit);
  $('restartBtn').addEventListener('click', start); // same passage + duration
  $('backBtn').addEventListener('click', function () { show('setup'); });
  $('retryBtn').addEventListener('click', start); // same passage + duration
})();
