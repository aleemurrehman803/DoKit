/* INTEGRATION NOTE (item 56): copied whole — every block is guarded by
 * its element ids, so blocks for pages without their HTML simply skip.
 * Block B (drills) messages are dkT-wrapped; later blocks are wrapped
 * in their own items (57-66). This file is HAND-MAINTAINED: the
 * generator never writes it. */
/* DoKit — typing additions (restored old typing depth, Phase 2b style).
 * NEW file: phase2/assets/js/typing-additions.js. Load it AFTER dk2.js
 * (and after lessons.js/progress.js where those exist) on the pages
 * named in each block header. Classic script, var only, no modules,
 * no CDN, device-local only. Every block runs ONLY if its elements
 * exist, so loading the whole file on any typing page is safe.
 *
 * HONESTY RULE (whole file): streaks, goals, charts, levels and
 * timelines render ONLY from real device-local history (DK2 results
 * + the keystats store below). Empty history renders an honest empty
 * message, never a dressed-up zero. A streak of 0 is shown as
 * "No streak yet", not as an achievement.
 *
 * NOTE on DK2 shape: lessons.js saves results as {type, wpm, acc},
 * typing.js saves {kind, wpm, acc} (see README — parent one-line fix
 * to align them). getResults() below normalises type/kind, so both
 * shapes work either way. DK2 has NO per-key stats, so per-key
 * accuracy is recorded by Block A into a separate localStorage key
 * (dk2-keystats) — it is never mixed into the DK2 object. */
(function () {
  'use strict';

  /* ================= Shared helpers (used by every block) ============= */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function loadJSON(key, fallback) {
    try {
      var v = JSON.parse(window.localStorage.getItem(key) || 'null');
      return v === null || v === undefined ? fallback : v;
    } catch (e) { return fallback; }
  }
  function saveJSON(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { /* storage unavailable: feature degrades, page survives */ }
  }
  /* Results, normalised: newest first (DK2 order), with type, wpm, acc
   * and a parseable date. Rows missing wpm/acc are kept but treated
   * as 0 for aggregates — they are real rows, not invented ones. */
  function getResults() {
    if (!window.DK2) { return []; }
    return window.DK2.getResults().map(function (r) {
      return {
        date: r.date, type: r.type || r.kind || 'Session',
        lesson: r.lesson || '',
        wpm: typeof r.wpm === 'number' ? r.wpm : 0,
        acc: typeof r.acc === 'number' ? r.acc : 0
      };
    });
  }
  function fmtDate(d) {
    try { return new Date(d).toLocaleDateString(); } catch (e) { return ''; }
  }
  function dayKey(d) {
    var t = d instanceof Date ? d : new Date(d);
    return t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate();
  }
  /* Streak = consecutive days with at least one result, counting back
   * from today — or from yesterday if today has no session yet (a
   * streak is not broken by simply not having typed yet today).
   * Computed from result dates only; no stored streak counter exists
   * in DK2, so nothing can drift or be faked. */
  function streakDays(results) {
    var days = {};
    results.forEach(function (r) {
      if (r.date) { days[dayKey(r.date)] = true; }
    });
    var today = new Date(), cursor = new Date(today);
    if (!days[dayKey(cursor)]) { cursor.setDate(cursor.getDate() - 1); }
    var count = 0;
    while (days[dayKey(cursor)]) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }

  /* ============ Block A — per-key stats recorder (auto, all pages) ======
   * LOADS ON: lesson, practice, test pages (any page with an input +
   * passage pair). NEEDS: ls-input/ls-passage, pr-input/pr-passage or
   * ty-input/ty-passage. WHY: old DB.recordKeyStats tracked per-key
   * accuracy, but DK2 never records keys — without this recorder the
   * problem-keys drill (Block B) would have nothing real to read.
   * HOW: only newly appended characters are recorded (tracked via the
   * previous input length), so backspace/retype does not double-count
   * a correction as a fresh attempt. */
  var KEYSTAT_KEY = 'dk2-keystats';
  function getKeyStats() { return loadJSON(KEYSTAT_KEY, {}); }
  function recordKey(ch, ok) {
    if (!ch) { return; }
    var stats = getKeyStats();
    if (!stats[ch]) { stats[ch] = { ok: 0, n: 0 }; }
    stats[ch].n++;
    if (ok) { stats[ch].ok++; }
    saveJSON(KEYSTAT_KEY, stats);
  }
  [['ls-input', 'ls-passage'], ['pr-input', 'pr-passage'],
   ['ty-input', 'ty-passage']].forEach(function (pair) {
    var input = $(pair[0]), passage = $(pair[1]);
    if (!input || !passage) { return; }
    var prevLen = 0;
    input.addEventListener('input', function () {
      var typed = input.value || '';
      var text = passage.textContent || '';
      /* Only the characters appended since the last keystroke are new
       * attempts; anything else is an edit, not a new keystroke. */
      if (typed.length > prevLen) {
        for (var i = prevLen; i < typed.length; i++) {
          if (i < text.length) { recordKey(text.charAt(i), typed.charAt(i) === text.charAt(i)); }
        }
      }
      prevLen = typed.length;
    });
  });

  /* ============ Block B — practice drills ================================
   * LOADS ON: typing/practice/. NEEDS (fragment): ta-pk-btn,
   * ta-cw-btn, ta-drill-text (<pre>), ta-drill-msg, ta-drill-use.
   * WHY: old Practice.problemKeysDrill / commonWordsDrill. The drill
   * text is loaded into the existing practice engine via the existing
   * pr-custom + pr-use controls, so no second engine is created. */
  /* Old TOP_WORDS (verbatim, 200 words) — the drill vocabulary. */
  var TOP_WORDS = ['the', 'be', 'to', 'of', 'and', 'in', 'that', 'have', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'very', 'here', 'many', 'must', 'such', 'through', 'much', 'before', 'too', 'does', 'down', 'each', 'made', 'may', 'part', 'long', 'little', 'own', 'great', 'still', 'every', 'under', 'again', 'along', 'among', 'another', 'around', 'away', 'began', 'behind', 'below', 'best', 'better', 'black', 'blue', 'both', 'bring', 'came', 'carry', 'change', 'children', 'close', 'cold', 'color', 'country', 'course', 'door', 'during', 'early', 'earth', 'eight', 'enough', 'ever', 'fall', 'fast', 'few', 'field', 'five', 'floor', 'follow', 'food', 'form', 'four', 'free', 'friend', 'front', 'full', 'game', 'given', 'glass', 'green', 'ground', 'grow', 'hand', 'hard', 'head', 'heard', 'heavy', 'held', 'high', 'hold', 'horse', 'hot', 'hundred', 'idea', 'inside', 'instead', 'knew', 'large', 'last', 'later', 'laugh', 'leave', 'left', 'letter', 'life', 'light', 'list', 'listen', 'lived', 'living', 'lovely'];
  var VOWELS = ['a', 'e', 'i', 'o', 'u'];
  /* Worst keys first, only keys with enough attempts to mean anything
   * (old threshold: n >= 5). Returns [] when there is no real data. */
  function problemKeys(limit) {
    var stats = getKeyStats(), out = [];
    Object.keys(stats).forEach(function (ch) {
      var s = stats[ch];
      if (s.n >= 5) {
        out.push({ ch: ch, acc: s.n ? (s.ok / s.n) * 100 : 100, n: s.n });
      }
    });
    out.sort(function (a, b) { return a.acc - b.acc; });
    return out.slice(0, limit || 8);
  }
  /* Drill words for one key, as in the old tool: vowel-key-vowel
   * triples plus key+e / e+key, so the weak key is practised in
   * context. Space practises common words instead (no letter to drill). */
  function wordsForKey(ch) {
    if (ch === ' ') { return TOP_WORDS.slice(0, 8); }
    if (ch.length !== 1) { return []; }
    var words = VOWELS.map(function (v) { return v + ch + v; });
    words.push(ch + 'e', 'e' + ch);
    return words;
  }
  function problemKeysDrill() {
    var keys = problemKeys(8);
    if (!keys.length) { return null; }
    var words = [];
    keys.forEach(function (k) { words = words.concat(wordsForKey(k.ch)); });
    if (!words.length) { return null; }
    var lines = [];
    for (var i = 0; i < words.length; i += 10) {
      lines.push(words.slice(i, i + 10).join(' '));
    }
    return lines.join('\n');
  }
  function commonWordsDrill() {
    var words = [];
    for (var i = 0; i < 60; i++) {
      words.push(TOP_WORDS[Math.floor(Math.random() * TOP_WORDS.length)]);
    }
    return words.join(' ');
  }
  var pkBtn = $('ta-pk-btn'), cwBtn = $('ta-cw-btn');
  if (pkBtn || cwBtn) {
    var drillText = $('ta-drill-text'), drillMsg = $('ta-drill-msg'),
      drillUse = $('ta-drill-use');
    var currentDrill = '';
    function showDrill(text, msg) {
      currentDrill = text || '';
      if (drillText) { drillText.textContent = currentDrill; }
      if (drillMsg) { drillMsg.textContent = msg || ''; }
    }
    if (pkBtn) {
      pkBtn.addEventListener('click', function () {
        var drill = problemKeysDrill();
        if (drill) {
          showDrill(drill, (window.dkT ? window.dkT('rsv_1301', 'Problem-keys drill — your weakest keys, from your own typing on this device.') : 'Problem-keys drill — your weakest keys, from your own typing on this device.'));
        } else {
          /* Honest empty state: no invented "problem keys" before the
           * learner has typed enough for a real per-key record. */
          showDrill('', (window.dkT ? window.dkT('rsv_1302', 'No problem keys yet. Type at least 5 attempts per key in lessons or practice, and your weakest keys will appear here.') : 'No problem keys yet. Type at least 5 attempts per key in lessons or practice, and your weakest keys will appear here.'));
        }
      });
    }
    if (cwBtn) {
      cwBtn.addEventListener('click', function () {
        showDrill(commonWordsDrill(), (window.dkT ? window.dkT('rsv_1303', 'Common-words drill — 60 random words from the 200 most common words.') : 'Common-words drill — 60 random words from the 200 most common words.'));
      });
    }
    if (drillUse) {
      drillUse.addEventListener('click', function () {
        var custom = $('pr-custom'), use = $('pr-use');
        if (!currentDrill || !custom || !use) { return; }
        /* Reuse the existing practice wiring: paste + click "Use my
         * text" loads the drill into the shared engine. */
        custom.value = currentDrill;
        use.click();
      });
    }
  }

  /* ============ Block C — test categories + durations ====================
   * LOADS ON: typing/practice/ (categories) and typing/ (categories +
   * durations). NEEDS (fragment): buttons [data-ta-cat], buttons
   * [data-ta-min], #ta-cat-note. WHY: old test page categories
   * (Standard/Advanced/Professional/Custom) filtered passages, and
   * durations included 3/5/10 min. HOW (no engine edits): categories
   * pick an existing passage control (practice dropdown, or a test
   * lesson button) and click/change it; durations add options to the
   * existing ty-time-sel and dispatch its change event, which the
   * existing typing.js handler already honours (limit + reset). */
  var catBtns = document.querySelectorAll('[data-ta-cat]');
  if (catBtns.length) {
    var catNote = $('ta-cat-note');
    function setCatNote(text) { if (catNote) { catNote.textContent = text; } }
    /* Category display names reuse the button-label keys (a category
     * is a named thing, shown identically in buttons and notes). */
    var CAT_KEYS = { standard: 'rsv_1307', advanced: 'rsv_1308', professional: 'rsv_1309', custom: 'rsv_1310' };
    function catName(cat) {
      var k = CAT_KEYS[cat];
      return (window.dkT && k) ? window.dkT(k, cat) : cat;
    }
    function catPrefix(cat) {
      return (window.dkT ? window.dkT('rsv_1311', 'Category ') : 'Category ') + catName(cat);
    }
    function practiceCategory(cat) {
      var sel = $('pr-select');
      if (!sel) { return false; }
      var want = null;
      if (cat === 'custom') { want = 'custom'; }
      else {
        /* Match by option label (robust to ordering), fall back to
         * the known Easy/Medium/Hard order used by lessons.js. */
        var labels = { standard: 'Easy', advanced: 'Medium', professional: 'Hard' };
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].text.indexOf(labels[cat]) !== -1) { want = sel.options[i].value; break; }
        }
        if (want === null) {
          want = String({ standard: 0, advanced: 1, professional: 2 }[cat] || 0);
        }
      }
      sel.value = want;
      var ev;
      try { ev = new Event('change', { bubbles: true }); }
      catch (e) { ev = document.createEvent('Event'); ev.initEvent('change', true, false); }
      sel.dispatchEvent(ev);
      if (cat === 'custom') {
        var custom = $('pr-custom');
        if (custom) { custom.focus(); }
        setCatNote((window.dkT ? window.dkT('rsv_1313', 'Custom: paste your own text below, then press "Use my text".') : 'Custom: paste your own text below, then press "Use my text".'));
      } else {
        setCatNote(catPrefix(cat) + (window.dkT ? window.dkT('rsv_1312', ': passage loaded from the practice list.') : ': passage loaded from the practice list.'));
      }
      return true;
    }
    function testCategory(cat) {
      /* Test page passage set (typing.js buttons): Standard = everyday
       * rows, Advanced = top row, Professional = pangram (all keys).
       * Clicking the existing button loads the passage via typing.js. */
      var map = {
        standard: ['home', 'words'],
        advanced: ['top'],
        professional: ['pangram']
      };
      if (cat === 'custom') {
        setCatNote((window.dkT ? window.dkT('rsv_1314', 'Custom text lives on the Practice page — paste any text there and press "Use my text".') : 'Custom text lives on the Practice page — paste any text there and press "Use my text".'));
        return true;
      }
      var names = map[cat] || [];
      for (var i = 0; i < names.length; i++) {
        var btn = document.querySelector('[data-lesson="' + names[i] + '"]');
        if (btn) {
          btn.click();
          setCatNote(catPrefix(cat) + (window.dkT ? window.dkT('rsv_1315', ' includes: ') : ' includes: ') + names.join(', ')
            + (window.dkT ? window.dkT('rsv_1316', ' (first passage loaded — use its button for the next).') : ' (first passage loaded — use its button for the next).'));
          return true;
        }
      }
      return false;
    }
    for (var ci = 0; ci < catBtns.length; ci++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var cat = btn.getAttribute('data-ta-cat');
          for (var j = 0; j < catBtns.length; j++) {
            catBtns[j].setAttribute('aria-pressed',
              catBtns[j] === btn ? 'true' : 'false');
          }
          if (!practiceCategory(cat)) { testCategory(cat); }
        });
      })(catBtns[ci]);
    }
  }
  /* Durations: append 3/5/10 min to the existing duration select (the
   * select already offers 30/60/120 s) and let the fragment's duration
   * buttons pick them. Dispatching change is what typing.js listens
   * for — no change to typing.js itself is needed. */
  var timeSel = $('ty-time-sel');
  if (timeSel) {
    [['180', '3 minutes', 'rsv_1317'], ['300', '5 minutes', 'rsv_1318'], ['600', '10 minutes', 'rsv_1319']].forEach(function (opt) {
      var exists = false;
      for (var i = 0; i < timeSel.options.length; i++) {
        if (timeSel.options[i].value === opt[0]) { exists = true; }
      }
      if (!exists) {
        var o = document.createElement('option');
        o.value = opt[0]; o.textContent = (window.dkT ? window.dkT(opt[2], opt[1]) : opt[1]);
        timeSel.appendChild(o);
      }
    });
    /* Re-sync when the language changes or the async engine arrives
     * (same race as the keyboard labels: this file runs before the
     * dict + engine finish loading, so the first render is English).
     * Exposed for the main.js loader, same pattern as syncKeyboards. */
    var DUR_KEYS = { '180': ['rsv_1317', '3 minutes'], '300': ['rsv_1318', '5 minutes'], '600': ['rsv_1319', '10 minutes'] };
    function syncDurations() {
      for (var i = 0; i < timeSel.options.length; i++) {
        var k = DUR_KEYS[timeSel.options[i].value];
        if (k) { timeSel.options[i].textContent = (window.dkT ? window.dkT(k[0], k[1]) : k[1]); }
      }
    }
    document.addEventListener('dokit:langchange', syncDurations);
    window.syncDurations = syncDurations;
    var durBtns = document.querySelectorAll('[data-ta-min]');
    for (var di = 0; di < durBtns.length; di++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          timeSel.value = btn.getAttribute('data-ta-min');
          var ev;
          try { ev = new Event('change', { bubbles: true }); }
          catch (e) { ev = document.createEvent('Event'); ev.initEvent('change', true, false); }
          timeSel.dispatchEvent(ev);
          for (var j = 0; j < durBtns.length; j++) {
            durBtns[j].setAttribute('aria-pressed',
              durBtns[j] === btn ? 'true' : 'false');
          }
        });
      })(durBtns[di]);
    }
  }

  /* ============ Block D — progress chart + Set-Goal =======================
   * LOADS ON: typing/progress/. NEEDS (fragment): canvas #ta-trend,
   * #ta-trend-empty, #ta-goal-input, #ta-goal-btn, #ta-goal-cur.
   * WHY: old Charts.trend + DB.setGoal. The chart draws WPM and
   * accuracy from DK2 results (chronological); with fewer than 2
   * points there is no trend to draw, so the empty message shows
   * instead of a flat fake line. The goal is stored under its own key
   * (dk2-goal) and is shown as "Not set" until the user sets one —
   * the old default of 40 was a placeholder, not the user's goal. */
  /* Chart rendering is a function so it can re-run when the language
   * arrives late (async dict) or changes: otherwise the empty message
   * and canvas legend stay in the load-time language. */
  function renderTrend() {
  var trendCanvas = $('ta-trend');
  if (trendCanvas) {
    var results = getResults().slice().reverse(); /* chronological */
    var emptyEl = $('ta-trend-empty');
    if (results.length < 2) {
      trendCanvas.hidden = true;
      if (emptyEl) {
        emptyEl.textContent = (window.dkT ? window.dkT('rsv_1327', 'No trend yet — finish at least 2 sessions on this device and your WPM / accuracy trend will appear here.') : 'No trend yet — finish at least 2 sessions on this device and your WPM / accuracy trend will appear here.');
        emptyEl.hidden = false;
      }
    } else {
      if (emptyEl) { emptyEl.hidden = true; }
      trendCanvas.hidden = false;
      var dpr = window.devicePixelRatio || 1;
      var w = trendCanvas.clientWidth || 600;
      trendCanvas.width = w * dpr; trendCanvas.height = 260 * dpr;
      var ctx = trendCanvas.getContext('2d');
      ctx.scale(dpr, dpr);
      var wpms = results.map(function (r) { return r.wpm; });
      var accs = results.map(function (r) { return r.acc; });
      var maxW = 1.15 * Math.max.apply(null, [10].concat(wpms));
      var labels = results.map(function (r) { return fmtDate(r.date); });
      ctx.clearRect(0, 0, w, 260);
      ctx.font = '11px system-ui';
      ctx.fillStyle = '#64748b';
      for (var g = 0; g <= 4; g++) {
        var y = 18 + 208 * g / 4;
        ctx.strokeStyle = '#e2e8f0';
        ctx.beginPath(); ctx.moveTo(44, y); ctx.lineTo(w - 44, y); ctx.stroke();
        ctx.fillText(Math.round(maxW * (1 - g / 4)), 6, y + 4);
        ctx.fillText(Math.round(100 * (1 - g / 4)) + '%', w - 38, y + 4);
      }
      var n = results.length;
      function xPos(i) {
        return 44 + (n === 1 ? (w - 88) / 2 : (w - 88) * i / (n - 1));
      }
      function drawLine(values, mapY, colour) {
        ctx.strokeStyle = colour; ctx.lineWidth = 2.5;
        ctx.beginPath();
        values.forEach(function (v, i) {
          var x = xPos(i), y = mapY(v);
          if (i) { ctx.lineTo(x, y); } else { ctx.moveTo(x, y); }
        });
        ctx.stroke();
        ctx.fillStyle = colour;
        values.forEach(function (v, i) {
          ctx.beginPath(); ctx.arc(xPos(i), mapY(v), 3.5, 0, 7); ctx.fill();
        });
      }
      drawLine(wpms, function (v) { return 18 + 208 * (1 - v / maxW); }, '#1a56db');
      drawLine(accs, function (v) { return 18 + 208 * (1 - v / 100); }, '#7c3aed');
      ctx.fillStyle = '#64748b';
      var shown = n <= 6 ? results.map(function (_, i) { return i; })
        : [0, Math.floor(n / 2), n - 1];
      shown.forEach(function (i) { ctx.fillText(labels[i], xPos(i) - 14, 248); });
      ctx.fillStyle = '#1a56db'; ctx.fillRect(44, 4, 14, 4);
      ctx.fillStyle = '#64748b'; ctx.fillText((window.dkT ? window.dkT('rsv_1328', 'WPM') : 'WPM'), 62, 10);
      ctx.fillStyle = '#7c3aed'; ctx.fillRect(114, 4, 14, 4);
      ctx.fillStyle = '#64748b'; ctx.fillText((window.dkT ? window.dkT('rsv_1329', 'Accuracy %') : 'Accuracy %'), 132, 10);
    }
  }
  }
  renderTrend();
  document.addEventListener('dokit:langchange', renderTrend);
  window.syncTrend = renderTrend;

  var goalInput = $('ta-goal-input'), goalBtn = $('ta-goal-btn'),
    goalCur = $('ta-goal-cur');
  if (goalInput || goalBtn || goalCur) {
    var GOAL_KEY = 'dk2-goal';
    function showGoal() {
      var goal = loadJSON(GOAL_KEY, null);
      var best = 0;
      getResults().forEach(function (r) { if (r.wpm > best) { best = r.wpm; } });
      if (goalCur) {
        var T = function (k, f) { return window.dkT ? window.dkT(k, f) : f; };
        goalCur.textContent = goal === null
          ? T('rsv_1333', 'No goal set yet.')
          : T('rsv_1334', 'Goal: ') + goal + T('rsv_1335', ' WPM')
            + (getResults().length
              ? T('rsv_1336', ' — your best so far is ') + best + T('rsv_1337', ' WPM.')
              : T('rsv_1338', ' — no sessions yet on this device.'));
      }
      if (goalInput && goal !== null) { goalInput.value = goal; }
    }
    if (goalBtn) {
      goalBtn.addEventListener('click', function () {
        var v = parseInt(goalInput ? goalInput.value : '', 10);
        if (isNaN(v)) { return; }
        /* Clamp to the old range (10–200 WPM) rather than storing
         * nonsense; the stored value is always the user's own input. */
        v = Math.max(10, Math.min(200, v));
        saveJSON(GOAL_KEY, v);
        showGoal();
      });
    }
    showGoal();
    /* Re-render on language arrival/change (async-i18n race, same as chart). */
    document.addEventListener('dokit:langchange', showGoal);
    window.syncGoal = showGoal;
  }

  /* ============ Block E — dashboard: timeline, continue, streak, level ==
   * LOADS ON: typing/dashboard/. NEEDS (fragment): #ta-timeline,
   * #ta-continue, #ta-continue-name, #ta-streak, #ta-level,
   * #ta-problem-keys. WHY: old dashboard.js continue-lesson,
   * problem-keys, streak and level — all recomputed here from DK2
   * history instead of the old account store. Level is a LABEL from
   * real best WPM (thresholds stated below), not XP — DK2 has no XP,
   * and inventing XP would be fake progress. */
  /* Timeline is a function so it re-renders on language arrival/change
   * (async-i18n race, same as chart/goal/streak). ': ' and ' WPM, ' are
   * punctuation + unit, not words, so they stay literal; r.type and
   * r.lesson are stored data identifiers, shown as stored (same as the
   * Phase 2b results page, which also shows raw types). */
  function renderTimeline() {
    var timeline = $('ta-timeline');
    if (timeline) {
      var all = getResults();
      var T = function (k, f) { return window.dkT ? window.dkT(k, f) : f; };
      if (!all.length) {
        timeline.innerHTML = '';
        var li0 = document.createElement('li');
        li0.textContent = T('rsv_1344', 'No activity yet on this device. Finish a lesson, practice session or test and it will appear here.');
        timeline.appendChild(li0);
      } else {
        timeline.innerHTML = '';
        all.slice(0, 5).forEach(function (r) {
          var li = document.createElement('li');
          li.textContent = fmtDate(r.date) + ' — ' + r.type
            + (r.lesson ? ' (' + r.lesson + ')' : '')
            + ': ' + r.wpm + ' WPM, ' + r.acc + T('rsv_1345', '% accuracy');
          timeline.appendChild(li);
        });
      }
    }
  }
  renderTimeline();
  document.addEventListener('dokit:langchange', renderTimeline);
  window.syncTimeline = renderTimeline;
  /* Continue/level/problem-keys are functions so they re-render on
   * language arrival/change (async-i18n race, same as timeline).
   * Lesson titles (next.title) are curriculum data, shown as stored. */
  function renderContinue() {
  var contLink = $('ta-continue'), contName = $('ta-continue-name');
  if (contLink) {
    /* Next uncompleted lesson: first LESSONS entry whose id is not in
     * DK2's completed list. Lessons live at ../lesson/?n=<index>. */
    var done = window.DK2 ? window.DK2.getLessons() : [];
    var next = null, nextIdx = -1;
    if (window.LESSONS) {
      for (var li = 0; li < window.LESSONS.length; li++) {
        if (done.indexOf(window.LESSONS[li].id) === -1) {
          next = window.LESSONS[li]; nextIdx = li + 1; break;
        }
      }
    }
    if (next) {
      contLink.href = '../lesson/?n=' + nextIdx;
      if (contName) { contName.textContent = next.title; }
    } else if (window.LESSONS && done.length) {
      contLink.href = '../lessons/';
      if (contName) { contName.textContent = (window.dkT ? window.dkT('rsv_1355', 'All lessons complete — revisit any lesson.') : 'All lessons complete — revisit any lesson.'); }
    } else {
      contLink.href = '../lessons/';
      if (contName) { contName.textContent = (window.dkT ? window.dkT('rsv_1356', 'Start your first lesson.') : 'Start your first lesson.'); }
    }
  }
  }
  renderContinue();
  document.addEventListener('dokit:langchange', renderContinue);
  window.syncContinue = renderContinue;
  /* Streak is a function so it re-renders on language arrival/change
   * (async-i18n race, same as chart/goal). */
  function renderStreak() {
    var streakEl = $('ta-streak');
    if (streakEl) {
      var streak = streakDays(getResults());
      var T = function (k, f) { return window.dkT ? window.dkT(k, f) : f; };
      streakEl.textContent = streak > 0
        ? streak + (streak === 1 ? T('rsv_1340', ' day') : T('rsv_1341', ' days'))
        : T('rsv_1342', 'No streak yet — finish a session today to start one.');
    }
  }
  renderStreak();
  document.addEventListener('dokit:langchange', renderStreak);
  window.syncStreak = renderStreak;
  function renderLevel() {
  var levelEl = $('ta-level');
  if (levelEl) {
    /* Level label from real best WPM (old levels came from account XP,
     * which DK2 does not have — this replaces XP with a stated,
     * checkable rule instead of inventing points). */
    var best = 0;
    getResults().forEach(function (r) { if (r.wpm > best) { best = r.wpm; } });
    var T = function (k, f) { return window.dkT ? window.dkT(k, f) : f; };
    var label = !getResults().length ? T('rsv_1349', 'Not started yet')
      : best < 20 ? T('rsv_0123', 'Beginner')
      : best < 40 ? T('rsv_1350', 'Learner')
      : best < 60 ? T('rsv_0316', 'Intermediate')
      : best < 80 ? T('rsv_1308', 'Advanced') : T('rsv_1351', 'Expert');
    levelEl.textContent = getResults().length
      ? label + T('rsv_1352', ' (best ') + best + T('rsv_1353', ' WPM)')
      : label + T('rsv_1354', ' — no sessions yet on this device.');
  }
  }
  renderLevel();
  document.addEventListener('dokit:langchange', renderLevel);
  window.syncLevel = renderLevel;
  function renderProblemKeys() {
  var dashPk = $('ta-problem-keys');
  if (dashPk) {
    var keys = problemKeys(8);
    if (!keys.length) {
      dashPk.textContent = (window.dkT ? window.dkT('rsv_1357', 'No problem keys yet — keep typing and your weakest keys will show here.') : 'No problem keys yet — keep typing and your weakest keys will show here.');
    } else {
      dashPk.innerHTML = '';
      keys.forEach(function (k) {
        var s = document.createElement('span');
        s.textContent = (k.ch === ' ' ? (window.dkT ? window.dkT('rsv_1286', 'Space') : 'Space') : k.ch)
          + ' (' + Math.round(k.acc) + '%)';
        dashPk.appendChild(s);
        dashPk.appendChild(document.createTextNode(' '));
      });
    }
  }
  }
  renderProblemKeys();
  document.addEventListener('dokit:langchange', renderProblemKeys);
  window.syncProblemKeys = renderProblemKeys;

  /* ============ Block F — results: Share + Retake ========================
   * LOADS ON: typing/results/. NEEDS (fragment): #ta-share-btn,
   * #ta-share-msg. #ta-retake is a plain link in the fragment (to
   * ../, the test page) and needs no script. WHY: old results.js
   * share button, upgraded from clipboard-only to the real Web Share
   * API with clipboard fallback. The shared text is built from the
   * LATEST real result — with no results the button is disabled and
   * says so, instead of sharing an invented score. */
  /* Share messages: the no-results message is set at load (async-i18n
   * race), so it re-renders on language arrival/change; the click-time
   * messages use fresh dkT on every click. The shared payload sentence
   * stays English, same as the old clipboard-only share. */
  function renderShareMsg() {
    var shareMsg = $('ta-share-msg');
    var shareBtn = $('ta-share-btn');
    if (shareMsg && shareBtn && !getResults()[0]) {
      shareMsg.textContent = (window.dkT ? window.dkT('rsv_1360', 'No results yet on this device — finish a test first, then share it.') : 'No results yet on this device — finish a test first, then share it.');
    }
  }
  var shareBtn = $('ta-share-btn');
  if (shareBtn) {
    var shareMsg = $('ta-share-msg');
    var latest = getResults()[0];
    if (!latest) {
      shareBtn.disabled = true;
      renderShareMsg();
      document.addEventListener('dokit:langchange', renderShareMsg);
      window.syncShareMsg = renderShareMsg;
    } else {
      var shareText = 'I scored ' + latest.wpm + ' WPM with ' + latest.acc
        + '% accuracy on DoKit Typing!';
      shareBtn.addEventListener('click', function () {
        function done(ok) {
          if (shareMsg) {
            shareMsg.textContent = ok
              ? (window.dkT ? window.dkT('rsv_1361', 'Result copied — paste it anywhere to share.') : 'Result copied — paste it anywhere to share.')
              : (window.dkT ? window.dkT('rsv_1362', 'Sharing is not available on this device.') : 'Sharing is not available on this device.');
          }
        }
        /* Web Share first (real share sheet); clipboard fallback;
         * textarea + execCommand last, for old browsers. */
        if (navigator.share) {
          navigator.share({ text: shareText }).then(function () { done(true); })
            .catch(function () { /* user dismissed: not an error */ });
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(shareText).then(function () { done(true); })
            .catch(function () { done(false); });
        } else {
          var ta = document.createElement('textarea');
          ta.value = shareText;
          document.body.appendChild(ta);
          ta.select();
          var ok = false;
          try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
          ta.remove();
          done(ok);
        }
      });
    }
  }

  /* ============ Block G — profile: Download my data ======================
   * LOADS ON: typing/profile/. NEEDS (fragment): #ta-download-btn,
   * #ta-download-msg. WHY: old profile dlBtn (DB.exportData). This
   * exports the REAL device-local data only: DK2 results + completed
   * lessons, the keystats store and the goal — as a JSON download.
   * Nothing is uploaded; the file is built in the browser. */
  var dlBtn = $('ta-download-btn');
  if (dlBtn) {
    dlBtn.addEventListener('click', function () {
      var data = {
        exportedAt: new Date().toISOString(),
        results: getResults(),
        lessonsCompleted: window.DK2 ? window.DK2.getLessons() : [],
        keyStats: getKeyStats(),
        goalWpm: loadJSON('dk2-goal', null)
      };
      var blob = new Blob([JSON.stringify(data, null, 2)],
        { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'dokit-typing-data.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      var msg = $('ta-download-msg');
      if (msg) {
        var T = function (k, f) { return window.dkT ? window.dkT(k, f) : f; };
        msg.textContent = T('rsv_1365', 'Downloaded ') + data.results.length
          + T('rsv_1366', ' result(s) and ') + data.lessonsCompleted.length
          + T('rsv_1367', ' completed lesson(s) from this device.');
      }
    });
  }

  /* Public read helpers for the parent (no writes through this API). */
  window.DKAdd = {
    getResults: getResults, getKeyStats: getKeyStats,
    problemKeys: problemKeys, streakDays: streakDays
  };
})();
