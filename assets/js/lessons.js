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
  // WP-5 TYPE-13: practice passages carry version: 1 each (store v1);
  // bump an item's version whenever its text changes. Results stamp
  // contentVersion 'en-practice:<version>' (paper §4); custom text
  // carries no version, so its result omits the field.
  var PRACTICE_PASSAGES = [{"id": "easy", "version": 1, "name": "Easy Text", "text": "The cat sat on the warm rug by the door. A dog ran past the big red barn. We had hot soup for lunch and then went out to play in the soft green grass. Mom sang a sweet song while dad read the news in his old brown chair."}, {"id": "medium", "version": 1, "name": "Medium Text", "text": "Learning to type quickly takes patience and daily practice, but the reward is worth every minute you invest. When your fingers know where each key lives, your thoughts can flow straight onto the screen without interruption. Start slowly and focus on accuracy first; speed will follow naturally as your muscle memory grows stronger each week. Many students are surprised by how fast they improve once they stop looking down at their hands. Set a small daily goal, track your words per minute, and celebrate every new personal record you achieve."}, {"id": "hard", "version": 1, "name": "Hard Text", "text": "The expedition set out before dawn, crossing the misty valley toward mountains that rose like silent giants against the brightening sky. Every traveler carried provisions, instruments, and a quiet determination to document whatever wonders the uncharted territory might reveal. By midday the weather shifted unexpectedly; dark clouds gathered overhead and a cold wind swept through the narrow pass, forcing the group to seek shelter beneath an overhanging cliff. While they waited, the expedition leader reviewed their charts, recalculated distances, and encouraged everyone with stories of previous journeys that had survived far worse conditions. When the storm finally passed, sunlight broke through in brilliant shafts, transforming the wet landscape into a glittering panorama that made every hardship feel worthwhile. They pressed onward with renewed energy, reaching the summit just as evening painted the horizon in shades of amber and rose."}];

  // -- Shared engine -------------------------------------------------------
  // opts: passageEl, inputEl, wpmEl, accEl, resultEl, onFinish(result).
  // opts.language: typing language for the Segmenter ('en' default).
  // No timer here: lessons and practice finish when the text is done.
  function createEngine(opts) {
    var passage = '', typed = '', started = false, startTime = 0, done = false;
    // WP-4 TYPE-02: session id (dedup key, paper §7) + content id, one
    // per load(); paste flag for the verified stamp (paper §5). A load
    // is a new attempt, so it gets a fresh session id.
    var sessionId = null, contentId = null, pasted = false;
    function newSid(){
      return window.DKScoring ? window.DKScoring.newSessionId()
        : ('s-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 0xFFFFFF).toString(16));
    }
    // WHY paste is tracked here, not just in the timed test: lesson and
    // practice results carry the same verified flag (paper §5), so a
    // pasted lesson can never be mistaken for a typed one.
    opts.inputEl.addEventListener('paste', function(){ pasted = true; });
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
    // WP-4 TYPE-02: WPM = (correct graphemes / 5) per minute; accuracy =
    // correct/typed graphemes — scored through the ONE shared service
    // (dk-scoring.js, docs/scoring-metrics-v2.md §1-2). The pre-v2
    // UTF-16 computation is kept ONLY as the fallback when DKScoring
    // failed to load, so a failed script load never breaks lessons.
    function stats() {
      var elapsedMs = started ? (Date.now() - startTime) : 0;
      var st = null;
      if (window.DKScoring) { st = window.DKScoring.score(passage, typed, elapsedMs, opts.language || 'en'); }
      else {
        var correct = 0;
        for (var i = 0; i < typed.length; i++) {
          if (typed[i] === passage[i]) { correct++; }
        }
        var mins = elapsedMs / 60000;
        st = {correct: correct, typed: typed.length,
          wpm: mins > 0 ? Math.round((correct / 5) / mins) : 0,
          acc: typed.length ? Math.round(correct / typed.length * 100) : 100,
          metricVersion: 'v1-net-utf16', graphemeVersion: 'utf16', language: opts.language || 'en'};
      }
      opts.wpmEl.textContent = st.wpm;
      opts.accEl.textContent = st.acc + '%';
      return { wpm: st.wpm, acc: st.acc, correct: st.correct, typed: st.typed,
        gross: st.gross, metricVersion: st.metricVersion, graphemeVersion: st.graphemeVersion,
        sessionId: sessionId, contentId: contentId, verified: !pasted };
    }
    function finish() {
      if (done) { return false; }
      // WP-4 TYPE-04 (C2, Architecture §8.6; paper §6): the shared
      // sub-second rule — a finish below 1000 ms is REJECTED, not
      // scored. Nothing is saved, no lesson is marked done, no XP is
      // awarded. WHY reset instead of locking: the rejection means
      // "that finish does not count" — the user retypes the same
      // passage immediately. The paste flag is reset too, so a
      // genuine retype after a paste gets a fair verified stamp.
      var elapsedMs = started ? (Date.now() - startTime) : 0;
      if (window.DKScoring ? window.DKScoring.isSubSecond(elapsedMs) : elapsedMs < 1000) {
        opts.resultEl.textContent = (window.dkT ? window.dkT('typing_too_fast', 'Result not counted: the test finished too quickly to be a timed typing test. Please type the passage yourself and try again.') : 'Result not counted: the test finished too quickly to be a timed typing test. Please type the passage yourself and try again.');
        typed = ''; started = false; pasted = false;
        opts.inputEl.value = ''; opts.inputEl.disabled = false;
        render(); opts.inputEl.focus();
        return false;
      }
      done = true;
      var st = stats();
      // WHY st.typed for "out of N typed": the v2 result text counts
      // the same units the score counted (paper §2). For plain ASCII
      // it equals typed.length exactly.
      var typedCount = (typeof st.typed === 'number') ? st.typed : typed.length;
      opts.resultEl.textContent =
        (window.dkT ? window.dkT('rsv_1002', 'Result: ') : 'Result: ') + st.wpm + ' WPM, ' + st.acc + (window.dkT ? window.dkT('rsv_0956', '% accuracy, ') : '% accuracy, ') +
        st.correct + (window.dkT ? window.dkT('rsv_0949', ' correct characters out of ') : ' correct characters out of ') + typedCount + (window.dkT ? window.dkT('rsv_0952', ' typed.') : ' typed.');
      if (opts.onFinish) { opts.onFinish(st); }
      return true;
    }
    opts.inputEl.addEventListener('input', function (ev) {
      if (done) { return; }
      if (ev && ev.inputType === 'insertFromPaste') { pasted = true; }
      typed = opts.inputEl.value;
      if (!started && typed.length > 0) { started = true; startTime = Date.now(); }
      // WHY finish() returns a boolean: on a sub-second rejection the
      // engine has already reset for a retry — disabling the input
      // here would lock the user out of that retry.
      if (typed.length >= passage.length) { if (finish()) { opts.inputEl.disabled = true; } }
      render();
    });
    return {
      // Load a new passage and reset all state (used by both pages).
      load: function (text, cid) {
        passage = text; typed = ''; started = false; done = false;
        contentId = cid || null; sessionId = newSid(); pasted = false;
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
    if (keysEl) { keysEl.textContent = (window.dkT ? window.dkT('rsv_0981', 'Keys: ') : 'Keys: ') + lesson.keys; }
    if (prevEl) {
      /* T078 (P5-UX-18): at the first lesson Prev is disabled, not a self-link. */
      if (n > 1) { prevEl.href = '?n=' + (n - 1); prevEl.removeAttribute('aria-disabled'); }
      else { prevEl.removeAttribute('href'); prevEl.setAttribute('aria-disabled', 'true'); }
    }
    if (nextEl) {
      /* T078 (P5-UX-18): at the last lesson Next is disabled, not a self-link. */
      if (n < window.LESSONS.length) { nextEl.href = '?n=' + (n + 1); nextEl.removeAttribute('aria-disabled'); }
      else { nextEl.removeAttribute('href'); nextEl.setAttribute('aria-disabled', 'true'); }
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
          ? (window.dkT ? window.dkT('rsv_0962', 'Completed \u2713 (saved on this device)') : 'Completed \u2713 (saved on this device)')
          : (window.dkT ? window.dkT('rsv_0986', 'Not completed yet') : 'Not completed yet');
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
        // WP-4 TYPE-02: v2 tags (paper §4) on the saved result.
        if (window.DK2) {
          window.DK2.saveResult({ type: 'lesson', lesson: lesson.id,
            wpm: st.wpm, acc: st.acc, graphemes: st.typed,
            verified: st.verified, metricVersion: st.metricVersion,
            graphemeVersion: st.graphemeVersion, sessionId: st.sessionId,
            contentId: 'lesson:' + lesson.id,
            contentVersion: 'en-lesson:' + (lesson.version || 1), mode: 'lesson', language: 'en' });
          window.DK2.markLesson(lesson.id);
          // Gamification (Task 5): lesson XP + badges, once per lesson
          // (perfect bonus once, on the first 100% finish). Scholar needs
          // the beginner ids; without LESSONS it is skipped, never faked.
          if (window.DK2.afterActivity) {
            var beginnerIds = [];
            if (window.LESSONS) {
              window.LESSONS.forEach(function (ls) {
                if (ls.level === 'beginner') { beginnerIds.push(ls.id); }
              });
            }
            window.DK2.afterActivity('lesson', st, { lessonId: lesson.id, beginnerIds: beginnerIds });
          }
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
    engine.load(lesson.lines.join(' '), 'lesson:' + lesson.id);
    refreshDone();
  }

  // -- Free practice (typing/practice/) ------------------------------------
  // Passage from a dropdown, or the user's own text. Same engine as above.
  var prPassage = document.getElementById('pr-passage');
  if (prPassage) {
    // WP-5 TYPE-13: the store passage behind the current practice
    // run (null for custom text, which carries no version).
    var prCurrent = PRACTICE_PASSAGES[0];
    var prEngine = createEngine({
      passageEl: prPassage,
      inputEl: document.getElementById('pr-input'),
      wpmEl: document.getElementById('pr-wpm'),
      accEl: document.getElementById('pr-acc'),
      resultEl: document.getElementById('pr-result'),
      onFinish: function (st) {
        // WP-4 TYPE-02: v2 tags (paper §4) on the saved result.
        if (window.DK2) {
          var prRow = { type: 'practice',
            wpm: st.wpm, acc: st.acc, graphemes: st.typed,
            verified: st.verified, metricVersion: st.metricVersion,
            graphemeVersion: st.graphemeVersion, sessionId: st.sessionId,
            contentId: st.contentId, mode: 'practice', language: 'en' };
          // WP-5 TYPE-13: stamp the store version only for store text.
          if (prCurrent) { prRow.contentVersion = 'en-practice:' + (prCurrent.version || 1); }
          window.DK2.saveResult(prRow);
          // Gamification (Task 5, historical else-branch): practice
          // touches the streak only — no XP, no badges.
          if (window.DK2.afterActivity) { window.DK2.afterActivity('practice', st, {}); }
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
        o.value = i; var _nk = {'Easy Text':'rsv_1016','Medium Text':'rsv_1018','Hard Text':'rsv_1017'}[p.name]; o.textContent = (_nk && window.dkT) ? window.dkT(_nk, p.name) : p.name;
        prSelect.appendChild(o);
      });
      var customOpt = document.createElement('option');
      customOpt.value = 'custom'; customOpt.textContent = (window.dkT ? window.dkT('rsv_0983', 'My own text') : 'My own text');
      prSelect.appendChild(customOpt);
      prSelect.addEventListener('change', function () {
        if (prSelect.value === 'custom') { return; }
        var pi = parseInt(prSelect.value, 10);
        prCurrent = PRACTICE_PASSAGES[pi];
        prEngine.load(PRACTICE_PASSAGES[pi].text, 'practice:' + PRACTICE_PASSAGES[pi].id);
      });
    }
    if (prUse) {
      prUse.addEventListener('click', function () {
        var text = (prCustom.value || '').replace(/\n/g, ' ').trim();
        if (text) { prCurrent = null; prEngine.load(text, 'practice:custom'); }
      });
    }
    prEngine.load(PRACTICE_PASSAGES[0].text, 'practice:' + PRACTICE_PASSAGES[0].id);
  }
})();
