/* DoKit — TypeFight battle (Phase 2b).
 * A 60-second race against bots whose speeds are shown openly
 * (Easy ~25, Medium ~45, Hard ~65 WPM). Bots are game opponents, not
 * fake users: they are labelled 'Bot' on the leaderboard.
 * No sign-in and no coins in this build: winnings, wallets and
 * certificates connect with the Phase 3 backend. Pasting is blocked
 * during a race (the old anti-cheat rule, kept honestly). */
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
      li.textContent = (i + 1) + '. ' + r.name + ' \u2014 '
        + r.chars + ' chars' + (r.bot ? ' (bot)' : '');
      boardEl.appendChild(li);
    });
  }
  function stats() {
    var correct = 0;
    for (var i = 0; i < typed.length; i++) {
      if (typed[i] === PASSAGE[i]) { correct++; }
    }
    var mins = started ? (Date.now() - startTime) / 60000 : 0;
    var wpm = mins > 0 ? Math.round((correct / 5) / mins) : 0;
    var acc = typed.length ? Math.round(correct / typed.length * 100) : 100;
    wpmEl.textContent = wpm;
    accEl.textContent = acc + '%';
    return { wpm: wpm, acc: acc };
  }
  function finish() {
    if (done) { return; }
    done = true; clearInterval(timer); inputEl.disabled = true;
    var st = stats();
    renderBoard();
    resultEl.textContent = 'Finished! ' + st.wpm + ' WPM, ' + st.acc
      + '% accuracy. Coins and certificates arrive with Phase 3.';
    if (window.DK2) {
      window.DK2.saveResult({ type: 'battle', wpm: st.wpm, acc: st.acc });
    }
  }
  // Pasting is blocked during races (anti-cheat, stated on the page).
  inputEl.addEventListener('paste', function (e) {
    e.preventDefault();
    resultEl.textContent = 'Pasting is disabled during a race.';
  });
  inputEl.addEventListener('input', function () {
    if (done) { return; }
    typed = inputEl.value;
    if (!started && typed.length > 0) { started = true; startTime = Date.now(); }
    if (typed.length >= TEXT.length) { finish(); }
    render();
  });
  startBtn.addEventListener('click', function () {
    // Fresh race: bots get the chosen difficulty speed, each with a
    // small random variance so no two races play identically.
    var base = DIFFS[diffEl ? diffEl.value : 'medium'] || 45;
    bots = BOT_NAMES.map(function (name) {
      return { name: name, wpm: base * (0.9 + Math.random() * 0.2), chars: 0 };
    });
    typed = ''; started = false; done = false; left = 60;
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
