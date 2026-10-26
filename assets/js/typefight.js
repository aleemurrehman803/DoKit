/* DoKit — TypeFight battle (Phase 2b).
 * A 60-second race against bots whose speeds are shown openly
 * (Easy ~25, Medium ~45, Hard ~65 WPM). Bots are game opponents, not
 * fake users: they are labelled 'Bot' on the leaderboard.
 * No sign-in and no coins in this build: winnings, wallets and
 * certificates connect with the Phase 3 backend.
 * Anti-cheat (Task 6, restored historical client-side heuristics from
 * typefight-battle.js — indicators, NOT proof; a determined cheater
 * with devtools can bypass anything client-side):
 *   1. Paste/drop: inputType insertFromPaste/insertFromDrop is
 *      rejected (input rolled back) and flagged as paste_detected.
 *      (The paste-event block below already stops Ctrl+V pastes.)
 *   2. Keystroke timing: median keydown interval < 20ms over 20+
 *      samples is flagged as inhuman_timing.
 *   3. Sanity cap: WPM > 150 is flagged as impossible_wpm.
 *   4. Automation: > 50 chars with fewer than half as many keydowns
 *      is flagged as automation.
 * A flagged race shows "Under review" with its reason and is NOT
 * saved, so no battle certificate can be issued from it. Nothing is
 * banned, no account action is taken, and referral/XP are untouched
 * (this module never feeds them); the player can race again at once.
 * NOT restored: the historical coin award (no coins exist in this
 * build) and any typing-test anti-cheat (the historical typing test
 * had none — pasting there stays allowed). */
(function () {
  'use strict';
  var PASSAGE = {"id": "medium", "name": "Medium Text", "text": "Learning to type quickly takes patience and daily practice, but the reward is worth every minute you invest. When your fingers know where each key lives, your thoughts can flow straight onto the screen without interruption. Start slowly and focus on accuracy first; speed will follow naturally as your muscle memory grows stronger each week. Many students are surprised by how fast they improve once they stop looking down at their hands. Set a small daily goal, track your words per minute, and celebrate every new personal record you achieve."};
  var DIFFS = { easy: 25, medium: 45, hard: 65 }; // bot WPM by difficulty
  var TEXT = PASSAGE.text; // the race text (PASSAGE is the record object)
  var BOT_NAMES = ['Bot A', 'Bot B', 'Bot C'];

  var startBtn = document.getElementById('tf-start');
  if (!startBtn) { return; }
  var passageEl = document.getElementById('tf-passage');
  var inputEl = document.getElementById('tf-input');
  var timeEl = document.getElementById('tf-time');
  var wpmEl = document.getElementById('tf-wpm');
  var accEl = document.getElementById('tf-acc');
  var boardEl = document.getElementById('tf-board');
  var emptyEl = document.getElementById('tf-board-empty');
  var resultEl = document.getElementById('tf-result');
  var diffEl = document.getElementById('tf-diff');

  var typed = '', started = false, startTime = 0, left = 60;
  var timer = null, done = false, bots = [];
  // HOOKS (referral-complete §7): difficulty of the race in progress,
  // captured at start (the select may change mid-race, so finish()
  // must not re-read it). Falls back to the page's default, medium.
  var raceDiff = 'medium';

  // Render the passage with per-character feedback (same pattern as
  // the lesson engine, kept local because the battle also runs a
  // timer and a live leaderboard — different job, own small engine).
  function render() {
    passageEl.innerHTML = '';
    for (var i = 0; i < TEXT.length; i++) {
      var s = document.createElement('span');
      s.textContent = TEXT[i];
      if (i < typed.length) {
        s.className = typed[i] === TEXT[i] ? 'ok' : 'bad';
      } else if (i === typed.length) {
        s.className = 'cur';
      }
      passageEl.appendChild(s);
    }
  }
  // Live leaderboard: player + bots, ranked by characters typed.
  function renderBoard() {
    var rows = bots.map(function (b) {
      return { name: b.name, chars: b.chars, bot: true };
    });
    rows.push({ name: 'You', chars: typed.length, bot: false });
    rows.sort(function (a, b) { return b.chars - a.chars; });
    // First race fills the board: hide the honest empty-state message.
    if (emptyEl) { emptyEl.style.display = 'none'; }
    boardEl.innerHTML = '';
    rows.forEach(function (r, i) {
      var li = document.createElement('li');
      li.textContent = (i + 1) + '. ' + (r.name === 'You' ? (window.dkT ? window.dkT('rsv_1057', 'You') : 'You') : r.name) + ' \u2014 '
        + r.chars + (window.dkT ? window.dkT('rsv_0948', ' chars') : ' chars') + (r.bot ? ' (bot)' : '');
      boardEl.appendChild(li);
    });
  }
  function stats() {
    var correct = 0;
    for (var i = 0; i < typed.length; i++) {
      if (typed[i] === TEXT[i]) { correct++; }
    }
    var mins = started ? (Date.now() - startTime) / 60000 : 0;
    var wpm = mins > 0 ? Math.round((correct / 5) / mins) : 0;
    var acc = typed.length ? Math.round(correct / typed.length * 100) : 100;
    wpmEl.textContent = wpm;
    accEl.textContent = acc + '%';
    return { wpm: wpm, acc: acc };
  }
  // Historical anti-cheat: first flag wins; flags are indicators,
  // not proof, and live only for the current race.
  var keyTimes = [];
  var flagged = false;
  var flagReason = '';
  function flag(reason) {
    if (!flagged) { flagged = true; flagReason = reason; }
  }
  function runCheatChecks() {
    // 1. Keystroke timing: median interval < 20ms over 20+ samples.
    if (keyTimes.length > 20) {
      var intervals = [];
      for (var i = 1; i < keyTimes.length; i++) { intervals.push(keyTimes[i] - keyTimes[i - 1]); }
      intervals.sort(function (a, b) { return a - b; });
      var median = intervals[Math.floor(intervals.length / 2)];
      if (median < 20) { flag('inhuman_timing'); }
    }
    // 2. Sanity cap on WPM.
    var s = stats();
    if (s.wpm > 150) { flag('impossible_wpm'); }
    // 3. Very few keystrokes but lots of chars (automation).
    if (typed.length > 50 && keyTimes.length < typed.length * 0.5) { flag('automation'); }
  }
  // HOOKS (referral-complete §7): same lastTestAt stamp as typing.js
  // (separate page script, so its own small copy — the two pages do
  // not share a module). Signed-in only, best-effort silent; no
  // privileged field is touched. No coinsFrozen clear here: the
  // contract orders the unfreeze on a typing test only.
  function stampLastTest() {
    try {
      var db = null, auth = null;
      try { if (window.DKA && window.DKA.db) { db = window.DKA.db(); } } catch (e) {}
      if (!db) { try { if (window.firebase && window.firebase.firestore) { db = window.firebase.firestore(); } } catch (e) {} }
      try {
        if (window.DKA && window.DKA.auth) { auth = window.DKA.auth(); }
        else if (window.firebase && window.firebase.auth) { auth = window.firebase.auth(); }
      } catch (e) {}
      var user = auth ? auth.currentUser : null;
      if (!db || !user || !user.uid) { return; }
      var ref = db.collection('users').doc(user.uid);
      var upd = {};
      try { upd.lastTestAt = window.firebase.firestore.FieldValue.serverTimestamp(); }
      catch (e) { upd.lastTestAt = Date.now(); }
      ref.update(upd).catch(function () {});
    } catch (e) {}
  }
  function finish() {
    if (done) { return; }
    done = true; clearInterval(timer); inputEl.disabled = true;
    var st = stats();
    renderBoard();
    runCheatChecks();
    if (flagged) {
      // Historical consequence: under review, no reward, no
      // certificate — the race is not saved, so the certificate page
      // cannot issue from it. Stats stay visible; no ban, no
      // accusation; the player can race again immediately.
      var flagMsg = 'Under review: unusual input pattern detected (' + flagReason + '). '
        + st.wpm + ' WPM, ' + st.acc
        + '% accuracy \u2014 this race was not saved, so no certificate can be issued from it. You can start a new race.';
      resultEl.textContent = flagMsg;
      return;
    }
    resultEl.textContent = (window.dkT ? window.dkT('rsv_0978', 'Finished! ') : 'Finished! ') + st.wpm + ' WPM, ' + st.acc
      + (window.dkT ? window.dkT('rsv_0957', '% accuracy.') : '% accuracy.');
    if (window.DK2) {
      window.DK2.saveResult({ type: 'battle', wpm: st.wpm, acc: st.acc });
    }
    // HOOKS (referral-complete §7): win log for the TypeFight claim.
    // This point is only reached when the race is NOT flagged (the
    // flagged path returns early above), and rank #1 means the
    // player's chars strictly beat every bot's — a tie leaves the
    // bot ahead, exactly as the live leaderboard sorts it. Bots must
    // exist (a race was actually started). Log capped at 200 entries,
    // oldest dropped; storage failure never breaks the result.
    try {
      var top = bots.length > 0;
      bots.forEach(function (b) { if (b.chars >= typed.length) { top = false; } });
      if (top) {
        var wins = [];
        try {
          var raw = localStorage.getItem('dk_tf_wins');
          wins = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(wins)) { wins = []; }
        } catch (e) { wins = []; }
        wins.push({ date: new Date().toISOString().slice(0, 10), difficulty: raceDiff, won: true });
        if (wins.length > 200) { wins = wins.slice(wins.length - 200); }
        try { localStorage.setItem('dk_tf_wins', JSON.stringify(wins)); } catch (e) {}
      }
    } catch (e) {}
    // HOOKS (referral-complete §7): lastTestAt stamp, same pattern as
    // typing.js; silent, never breaks the result display.
    try { stampLastTest(); } catch (e) {}
  }
  // Pasting is blocked during races (anti-cheat, stated on the page).
  inputEl.addEventListener('paste', function (e) {
    e.preventDefault();
    resultEl.textContent = (window.dkT ? window.dkT('rsv_0992', 'Pasting is disabled during a race.') : 'Pasting is disabled during a race.');
  });
  inputEl.addEventListener('keydown', function () {
    keyTimes.push(Date.now());
  });
  inputEl.addEventListener('input', function (ev) {
    if (done) { return; }
    // Historical paste/drop detection: reject the insertion, roll
    // the input back to the last good value, and flag the race.
    if (ev.inputType && (ev.inputType === 'insertFromPaste' || ev.inputType === 'insertFromDrop')) {
      flag('paste_detected');
      inputEl.value = typed;
      render();
      return;
    }
    typed = inputEl.value;
    if (!started && typed.length > 0) { started = true; startTime = Date.now(); }
    if (typed.length >= TEXT.length) { finish(); }
    render();
  });
  startBtn.addEventListener('click', function () {
    // Fresh race: bots get the chosen difficulty speed, each with a
    // small random variance so no two races play identically.
    var base = DIFFS[diffEl ? diffEl.value : 'medium'] || 45;
    raceDiff = diffEl ? diffEl.value : 'medium';
    bots = BOT_NAMES.map(function (name) {
      return { name: name, wpm: base * (0.9 + Math.random() * 0.2), chars: 0 };
    });
    typed = ''; started = false; done = false; left = 60;
    keyTimes = []; flagged = false; flagReason = '';
    inputEl.value = ''; inputEl.disabled = false;
    timeEl.textContent = '60s'; wpmEl.textContent = '0';
    accEl.textContent = '100%'; resultEl.textContent = '';
    render(); renderBoard(); inputEl.focus();
    clearInterval(timer);
    timer = setInterval(function () {
      left -= 1; timeEl.textContent = left + 's';
      if (started) { stats(); }
      // Advance each bot: WPM -> chars per second = WPM * 5 / 60.
      bots.forEach(function (b) {
        b.chars = Math.min(TEXT.length,
          Math.floor(b.wpm * 5 * (60 - left) / 60));
      });
      renderBoard();
      if (left <= 0) { finish(); }
    }, 1000);
  });
  render();
})();
