/* DoKit — Urdu timed test (restore port).
 *
 * WHAT: Timed Urdu typing test for urdu-test-controls.html: duration picker
 *   (1/3/5 minutes), passage picker (3 old passages), Start, Quit, Restart,
 *   Back and Retry controls, live + final WPM/accuracy, countdown timer.
 *
 * WHY this file mirrors the old controller (js/pages/urdu-typing.js) instead
 *   of the new English viewer: the old test's rules are the spec — timer
 *   starts on the FIRST KEYSTROKE (not on Start), WPM = (typed chars / 5) /
 *   minutes and accuracy = correct / typed (both computed from the typed
 *   input only, exactly as the old code did), and word-level highlighting
 *   (never per-character spans, which break Nastaliq joining).
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
 * NOT PORTED (flagged in README): the old on-screen Urdu keyboard and
 *   next-key highlight depended on the UrduKeyboard module and the layout
 *   picker. This test works with the system/physical Urdu keyboard; the
 *   parent can re-attach a keyboard later without changing this file's IDs.
 *
 * IDs must match urdu-test-controls.html exactly (setup, active, done,
 *   durRow, passRow, startTestBtn, activeTitle, statWpm, statAcc, statTime,
 *   targetText, typeArea, quitBtn, restartBtn, resWpm, resAcc, resChars,
 *   resTime, resVerdict, backBtn, retryBtn).
 */
(function () {
  'use strict';

  // -- Timed-test passages: verbatim from old js/urdu-lessons.js (URDU_TESTS).
  var URDU_TEST_PASSAGES = [
    { id: 't1', title: 'روزمرہ', titleEn: 'Daily Life',
      text: 'صبح اٹھ کر میں وضو کرتا ہوں اور نماز پڑھتا ہوں۔ پھر ناشتہ کرتا ہوں اور سکول جاتا ہوں۔ سکول میں استاد ہمیں اردو، حساب اور انگریزی پڑھاتے ہیں۔ چھٹی کے بعد میں گھر آ کر کھانا کھاتا ہوں اور کھیلتا ہوں۔ شام کو میں سبق یاد کرتا ہوں۔ رات کو جلدی سو جاتا ہوں تاکہ صبح تازہ دم اٹھوں۔' },
    { id: 't2', title: 'پاکستان', titleEn: 'Pakistan',
      text: 'پاکستان جنوبی ایشیا کا ایک اہم ملک ہے۔ اس کا دارالحکومت اسلام آباد ہے۔ کراچی سب سے بڑا شہر اور معاشی مرکز ہے۔ لاہور ثقافتی دل کہلاتا ہے۔ یہاں اردو قومی زبان ہے۔ پاکستان کے شمال میں دنیا کے بلند ترین پہاڑ ہیں جن میں کے ٹو بھی شامل ہے۔ دریائے سندھ اس ملک کی شہ رگ ہے۔' },
    { id: 't3', title: 'علم کی اہمیت', titleEn: 'Knowledge',
      text: 'علم وہ روشنی ہے جو جہالت کے اندھیروں کو دور کرتی ہے۔ جو قومیں علم حاصل کرتی ہیں وہ ترقی کرتی ہیں۔ کتاب انسان کی بہترین دوست ہے۔ پڑھنے کی عادت انسان کو دانشمند بناتی ہے۔ ہمیں چاہیے کہ روز کچھ نہ کچھ پڑھیں۔ علم کبھی ضائع نہیں ہوتا۔ محنت اور لگن سے ہر مشکل آسان ہو جاتی ہے۔' }
  ];

  function $(id) { return document.getElementById(id); }
  var setupEl = $('setup'), activeEl = $('active'), doneEl = $('done');
  // No test fragment on this page; fail silently instead of throwing.
  if (!setupEl || !activeEl || !doneEl) { return; }

  var minutes = 1, passIndex = 0; // current choices (defaults match the old page)
  var target = '', words = [], typed = '', started = false, done = false,
      t0 = 0, timer = null;

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

  // -- Live stats: old formulas, typed input only ----------------------------
  // WPM = (typed chars / 5) / minutes; accuracy = correct / typed chars.
  // WHY typed (not correct) chars in WPM: that is what the old test computed,
  // and changing it would silently change every score versus the old site.
  function updateLive(elSecs) {
    var n = Math.min(typed.length, target.length), ok = 0, i;
    for (i = 0; i < n; i++) { if (typed[i] === target[i]) { ok++; } }
    var acc = typed.length ? Math.round(ok / typed.length * 100) : 100;
    var mins = elSecs / 60;
    var wpm = mins > 0.01 ? Math.round((typed.length / 5) / mins) : 0;
    $('statWpm').textContent = wpm;
    $('statAcc').textContent = acc + '%';
    return { wpm: wpm, acc: acc, ok: ok };
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

  // -- Input handling: timer starts on the FIRST keystroke -------------------
  function onInput() {
    if (done) { return; }
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
  }

  // -- Finish: show results; save on-device ONLY if DK2 exists ---------------
  function finish() {
    if (done) { return; }
    done = true;
    clearInterval(timer);
    var secs = started ? Math.max(1, (Date.now() - t0) / 1000) : minutes * 60;
    var n = Math.min(typed.length, target.length), ok = 0, i;
    for (i = 0; i < n; i++) { if (typed[i] === target[i]) { ok++; } }
    var acc = typed.length ? Math.round(ok / typed.length * 100) : 0;
    var wpm = Math.round((typed.length / 5) / (secs / 60));
    $('resWpm').textContent = wpm;
    $('resAcc').textContent = acc + '%';
    $('resChars').textContent = typed.length;
    $('resTime').textContent = fmt(secs);
    // Verdict wording verbatim from the old controller (threshold: 25 WPM).
    $('resVerdict').textContent = wpm >= 25 ? '🌟 شاندار رفتار!' : 'اچھی کوشش! مشق جاری رکھیں۔';
    // Device-local record only (new site's on-device store). No server call,
    // no account, no sync — and no write at all when DK2 is absent.
    if (window.DK2 && window.DK2.saveResult) {
      window.DK2.saveResult({ type: 'urdu-test', minutes: minutes, wpm: wpm, acc: acc });
    }
    show('done');
  }

  // -- Session control ---------------------------------------------------------
  function start() {
    var p = URDU_TEST_PASSAGES[passIndex];
    target = p.text;
    words = target.split(' ');
    typed = ''; started = false; done = false;
    clearInterval(timer);
    $('activeTitle').textContent = p.title + ' — ' + minutes + ' منٹ';
    $('statWpm').textContent = '0';
    $('statAcc').textContent = '100%';
    $('statTime').textContent = fmt(minutes * 60);
    $('typeArea').value = '';
    renderTarget();
    show('active');
    $('typeArea').focus();
  }
  // Quit discards the attempt: no result is shown and nothing is saved.
  function quit() { clearInterval(timer); done = true; show('setup'); }

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
  $('quitBtn').addEventListener('click', quit);
  $('restartBtn').addEventListener('click', start); // same passage + duration
  $('backBtn').addEventListener('click', function () { show('setup'); });
  $('retryBtn').addEventListener('click', start); // same passage + duration
})();
