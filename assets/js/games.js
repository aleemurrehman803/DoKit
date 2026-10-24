/* DoKit — typing games (Phase 2b).
 * Word Fall: type falling words before they reach the bottom (3 lives).
 * Word Sprint: how many words can you type in 60 seconds?
 * Best scores are saved on this device only. Words come from the old
 * games.js word list (single source, embedded below). */
(function () {
  'use strict';
  var WORDS = ["time", "people", "way", "day", "make", "know", "water", "than", "call", "first", "work", "now", "under", "never", "small", "found", "study", "still", "learn", "plant", "cover", "young", "less", "morning", "half", "together", "often", "always", "world", "light", "house", "great", "think", "help", "line", "turn", "cause", "much", "mean", "before", "move", "right", "boy", "old", "too", "same", "tell", "does", "set", "want", "air", "well", "also", "play", "night", "door", "river", "mountain", "happy", "quick", "brown", "lazy", "bright", "soft", "strong", "brave", "calm", "eager", "kind", "gentle", "swift", "clever", "merry", "proud", "quiet", "round", "sharp", "smooth", "sweet", "warm", "apple", "bread", "cloud", "dance", "eagle", "flower", "garden", "honey", "island", "jungle", "kite", "lemon", "moon", "nest", "ocean", "piano", "queen", "rainbow", "star", "tiger", "umbrella", "violin", "whale", "yard", "zebra", "anchor", "bridge", "castle", "drum", "engine", "forest", "globe", "harbor", "ivory", "jacket", "kettle", "lantern", "meadow", "needle", "orchard"];

  // Best-score helpers (one key per game, plain numbers only).
  function bestGet(key) {
    try { return parseInt(window.localStorage.getItem(key), 10) || 0; }
    catch (e) { return 0; }
  }
  function bestSet(key, value) {
    try { window.localStorage.setItem(key, String(value)); }
    catch (e) { /* ignore — game still plays */ }
  }
  function pickWord() { return WORDS[Math.floor(Math.random() * WORDS.length)]; }

  // -- Word Fall ------------------------------------------------------------
  // One word falls at a time; typing it exactly scores its letters
  // (long words earn a bonus point). A word hitting the bottom costs
  // one life; 3 lives lost ends the game.
  var wfArea = document.getElementById('wf-area');
  if (wfArea) {
    var wfWord = document.getElementById('wf-word');
    var wfInput = document.getElementById('wf-input');
    var wfScore = document.getElementById('wf-score');
    var wfLives = document.getElementById('wf-lives');
    var wfBest = document.getElementById('wf-best');
    var wfStart = document.getElementById('wf-start');
    var wfMsg = document.getElementById('wf-msg');
    var score = 0, lives = 3, top = 0, current = '', timer = null, playing = false;
    if (wfBest) { wfBest.textContent = bestGet('dk2_game_best_fall'); }
    function nextWord() {
      current = pickWord(); top = 0;
      wfWord.textContent = current;
      wfWord.style.top = '0px';
    }
    function endGame() {
      playing = false; clearInterval(timer);
      var best = bestGet('dk2_game_best_fall');
      if (score > best) { bestSet('dk2_game_best_fall', score); best = score; }
      if (wfBest) { wfBest.textContent = best; }
      wfMsg.textContent = 'Game over! Score: ' + score
        + (score >= best && score > 0 ? ' \u2014 new best!' : '');
      wfInput.disabled = true;
    }
    wfStart.addEventListener('click', function () {
      score = 0; lives = 3; playing = true;
      wfScore.textContent = '0'; wfLives.textContent = '3';
      wfMsg.textContent = ''; wfInput.disabled = false; wfInput.value = '';
      wfInput.focus(); nextWord();
      clearInterval(timer);
      // The word falls ~4px every 50ms; speed is fixed so the game is fair.
      timer = setInterval(function () {
        if (!playing) { return; }
        top += 4;
        wfWord.style.top = top + 'px';
        if (top >= 220) { // reached the bottom: lose a life, next word
          lives -= 1; wfLives.textContent = lives;
          if (lives <= 0) { endGame(); } else { nextWord(); }
        }
      }, 50);
    });
    wfInput.addEventListener('input', function () {
      if (!playing) { return; }
      if (wfInput.value.trim() === current) {
        // Points = letters, +2 bonus for words of 7+ letters.
        score += current.length + (current.length >= 7 ? 2 : 0);
        wfScore.textContent = score;
        wfInput.value = '';
        nextWord();
      }
    });
  }

  // -- Word Sprint ----------------------------------------------------------
  // 60 seconds, one word at a time. Type it and press space to advance.
  // Score = words typed = WPM over the minute.
  var wsWord = document.getElementById('ws-word');
  if (wsWord) {
    var wsInput = document.getElementById('ws-input');
    var wsTime = document.getElementById('ws-time');
    var wsScore = document.getElementById('ws-score');
    var wsBest = document.getElementById('ws-best');
    var wsStart = document.getElementById('ws-start');
    var wsMsg = document.getElementById('ws-msg');
    var sScore = 0, sLeft = 60, sTimer = null, sPlaying = false, sWord = '';
    if (wsBest) { wsBest.textContent = bestGet('dk2_game_best_sprint'); }
    function sNext() {
      sWord = pickWord(); wsWord.textContent = sWord; wsInput.value = '';
    }
    wsStart.addEventListener('click', function () {
      sScore = 0; sLeft = 60; sPlaying = true;
      wsScore.textContent = '0'; wsTime.textContent = '60s'; wsMsg.textContent = '';
      wsInput.disabled = false; wsInput.value = ''; wsInput.focus(); sNext();
      clearInterval(sTimer);
      sTimer = setInterval(function () {
        sLeft -= 1; wsTime.textContent = sLeft + 's';
        if (sLeft <= 0) {
          clearInterval(sTimer); sPlaying = false; wsInput.disabled = true;
          var best = bestGet('dk2_game_best_sprint');
          if (sScore > best) {
            bestSet('dk2_game_best_sprint', sScore); best = sScore;
          }
          if (wsBest) { wsBest.textContent = best; }
          wsMsg.textContent = 'Time! You typed ' + sScore + ' words ('
            + sScore + ' WPM)' + (sScore >= best && sScore > 0
              ? ' \u2014 new best!' : '');
        }
      }, 1000);
    });
    wsInput.addEventListener('input', function () {
      if (!sPlaying) { return; }
      // Space (or Enter) after a correct word advances to the next one.
      var val = wsInput.value;
      if (val === sWord + ' ' || val === sWord + '\n') {
        sScore += 1; wsScore.textContent = sScore; sNext();
      }
    });
  }
})();
