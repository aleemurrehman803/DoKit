/* DoKit — lesson viewer + free practice (Phase 2b).
 * ONE typing engine serves both pages (DRY): it renders a passage with
 * per-character feedback and live WPM/accuracy, and calls onFinish when
 * the passage is fully typed. The viewer and practice only differ in
 * where the passage comes from (a lesson, or a chosen/custom text).
 * Practice passages below come from the old test-data.js standard set.
 * The engine is exposed as window.DKType.createEngine so the Urdu
 * practice page reuses it instead of duplicating the logic. */
(function () {
  'use strict';
  var PRACTICE_PASSAGES = [{"id": "easy", "name": "Easy Text", "text": "The cat sat on the warm rug by the door. A dog ran past the big red barn. We had hot soup for lunch and then went out to play in the soft green grass. Mom sang a sweet song while dad read the news in his old brown chair."}, {"id": "medium", "name": "Medium Text", "text": "Learning to type quickly takes patience and daily practice, but the reward is worth every minute you invest. When your fingers know where each key lives, your thoughts can flow straight onto the screen without interruption. Start slowly and focus on accuracy first; speed will follow naturally as your muscle memory grows stronger each week. Many students are surprised by how fast they improve once they stop looking down at their hands. Set a small daily goal, track your words per minute, and celebrate every new personal record you achieve."}, {"id": "hard", "name": "Hard Text", "text": "The expedition set out before dawn, crossing the misty valley toward mountains that rose like silent giants against the brightening sky. Every traveler carried provisions, instruments, and a quiet determination to document whatever wonders the uncharted territory might reveal. By midday the weather shifted unexpectedly; dark clouds gathered overhead and a cold wind swept through the narrow pass, forcing the group to seek shelter beneath an overhanging cliff. While they waited, the expedition leader reviewed their charts, recalculated distances, and encouraged everyone with stories of previous journeys that had survived far worse conditions. When the storm finally passed, sunlight broke through in brilliant shafts, transforming the wet landscape into a glittering panorama that made every hardship feel worthwhile. They pressed onward with renewed energy, reaching the summit just as evening painted the horizon in shades of amber and rose."}];

  // -- Shared engine -------------------------------------------------------
  // opts: passageEl, inputEl, wpmEl, accEl, resultEl, onFinish(result).
  // No timer here: lessons and practice finish when the text is done.
  function createEngine(opts) {
    var passage = '', typed = '', started = false, startTime = 0, done = false;
    // Render every character: correct (green), wrong (red underline),
    // current (highlighted). Rebuilt on each keystroke — simple and clear.
    function render() {
      opts.passageEl.innerHTML = '';
      for (var i = 0; i < passage.length; i++) {
        var s = document.createElement('span');
        s.textContent = passage[i];
        if (i < typed.length) {
          s.className = typed[i] === passage[i] ? 'ok' : 'bad';
        } else if (i === typed.length) {
          s.className = 'cur';
        }
        opts.passageEl.appendChild(s);
      }
    }
    // WPM = (correct characters / 5) per minute; accuracy = correct/typed.
    function stats() {
      var correct = 0;
      for (var i = 0; i < typed.length; i++) {
        if (typed[i] === passage[i]) { correct++; }
      }
      var mins = started ? (Date.now() - startTime) / 60000 : 0;
      var wpm = mins > 0 ? Math.round((correct / 5) / mins) : 0;
      var acc = typed.length ? Math.round(correct / typed.length * 100) : 100;
      opts.wpmEl.textContent = wpm;
      opts.accEl.textContent = acc + '%';
      return { wpm: wpm, acc: acc, correct: correct };
    }
    function finish() {
      if (done) { return; }
      done = true;
      var st = stats();
      opts.resultEl.textContent =
        'Result: ' + st.wpm + ' WPM, ' + st.acc + '% accuracy, ' +
        st.correct + ' correct characters out of ' + typed.length + ' typed.';
      if (opts.onFinish) { opts.onFinish(st); }
    }
    opts.inputEl.addEventListener('input', function () {
      if (done) { return; }
      typed = opts.inputEl.value;
      if (!started && typed.length > 0) { started = true; startTime = Date.now(); }
      if (typed.length >= passage.length) { finish(); opts.inputEl.disabled = true; }
      render();
    });
    return {
      // Load a new passage and reset all state (used by both pages).
      load: function (text) {
        passage = text; typed = ''; started = false; done = false;
        opts.inputEl.value = ''; opts.inputEl.disabled = false;
        opts.wpmEl.textContent = '0'; opts.accEl.textContent = '100%';
        opts.resultEl.textContent = ''; render(); opts.inputEl.focus();
      }
    };
  }
  window.DKType = { createEngine: createEngine };

  // -- Lesson viewer (typing/lesson/) --------------------------------------
  // Reads ?n= (1..N) and shows that lesson from LESSONS (lessons-data.js).
  // Prev/next links and the lesson dropdown are built from the same list,
  // so the viewer can never point at a lesson that does not exist.
  var lvPassage = document.getElementById('ls-passage');
  if (lvPassage && window.LESSONS) {
    var params = new URLSearchParams(window.location.search);
    var n = parseInt(params.get('n'), 10) || 1;
    if (n < 1) { n = 1; }
    if (n > window.LESSONS.length) { n = window.LESSONS.length; }
    var lesson = window.LESSONS[n - 1];
    var titleEl = document.getElementById('ls-title');
    var keysEl = document.getElementById('ls-keys');
    var doneEl = document.getElementById('ls-done');
    var selectEl = document.getElementById('ls-select');
    var prevEl = document.getElementById('ls-prev');
    var nextEl = document.getElementById('ls-next');
    var completeBtn = document.getElementById('ls-complete');
    if (titleEl) { titleEl.textContent = lesson.title; }
    if (keysEl) { keysEl.textContent = 'Keys: ' + lesson.keys; }
    if (prevEl) { prevEl.href = n > 1 ? '?n=' + (n - 1) : '?n=1'; }
    if (nextEl) {
      nextEl.href = n < window.LESSONS.length ? '?n=' + (n + 1)
        : '?n=' + window.LESSONS.length;
    }
    if (selectEl) {
      window.LESSONS.forEach(function (ls, i) {
        var o = document.createElement('option');
        o.value = i + 1; o.textContent = (i + 1) + '. ' + ls.title;
        if (i + 1 === n) { o.selected = true; }
        selectEl.appendChild(o);
      });
      selectEl.addEventListener('change', function () {
        window.location.search = '?n=' + selectEl.value;
      });
    }
    // Show completion state from on-device history (never faked).
    function refreshDone() {
      if (doneEl && window.DK2) {
        doneEl.textContent = window.DK2.isLessonDone(lesson.id)
          ? 'Completed \u2713 (saved on this device)'
          : 'Not completed yet';
      }
    }
    var engine = createEngine({
      passageEl: lvPassage,
      inputEl: document.getElementById('ls-input'),
      wpmEl: document.getElementById('ls-wpm'),
      accEl: document.getElementById('ls-acc'),
      resultEl: document.getElementById('ls-result'),
      onFinish: function (st) {
        // Finishing a lesson saves both the result and the completion.
        if (window.DK2) {
          window.DK2.saveResult({ type: 'lesson', lesson: lesson.id,
            wpm: st.wpm, acc: st.acc });
          window.DK2.markLesson(lesson.id);
        }
        refreshDone();
      }
    });
    if (completeBtn) {
      completeBtn.addEventListener('click', function () {
        if (window.DK2) { window.DK2.markLesson(lesson.id); }
        refreshDone();
      });
    }
    engine.load(lesson.lines.join(' '));
    refreshDone();
  }

  // -- Free practice (typing/practice/) ------------------------------------
  // Passage from a dropdown, or the user's own text. Same engine as above.
  var prPassage = document.getElementById('pr-passage');
  if (prPassage) {
    var prEngine = createEngine({
      passageEl: prPassage,
      inputEl: document.getElementById('pr-input'),
      wpmEl: document.getElementById('pr-wpm'),
      accEl: document.getElementById('pr-acc'),
      resultEl: document.getElementById('pr-result'),
      onFinish: function (st) {
        if (window.DK2) {
          window.DK2.saveResult({ type: 'practice',
            wpm: st.wpm, acc: st.acc });
        }
      }
    });
    var prSelect = document.getElementById('pr-select');
    var prCustom = document.getElementById('pr-custom');
    var prUse = document.getElementById('pr-use');
    // Fill the dropdown from the practice passages (single source).
    if (prSelect) {
      PRACTICE_PASSAGES.forEach(function (p, i) {
        var o = document.createElement('option');
        o.value = i; o.textContent = p.name;
        prSelect.appendChild(o);
      });
      var customOpt = document.createElement('option');
      customOpt.value = 'custom'; customOpt.textContent = 'My own text';
      prSelect.appendChild(customOpt);
      prSelect.addEventListener('change', function () {
        if (prSelect.value === 'custom') { return; }
        prEngine.load(PRACTICE_PASSAGES[parseInt(prSelect.value, 10)].text);
      });
    }
    if (prUse) {
      prUse.addEventListener('click', function () {
        var text = (prCustom.value || '').trim();
        if (text) { prEngine.load(text); }
      });
    }
    prEngine.load(PRACTICE_PASSAGES[0].text);
  }
})();
