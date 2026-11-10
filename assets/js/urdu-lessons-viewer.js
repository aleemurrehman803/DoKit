/* DoKit — Urdu lesson viewer (restore port).
 *
 * WHAT: Renders one Urdu lesson from urdu-lessons-data.json in the new site's
 *   lesson-viewer body (same element IDs as typing/lesson/: ls-title, ls-keys,
 *   ls-select, ls-passage, ls-input, ls-wpm, ls-acc, ls-complete, ls-prev,
 *   ls-next, ls-result, ls-done). Title, keys, passage text, prev/next
 *   navigation, and a Mark-complete button.
 *
 * WHY word-level feedback (not per-character spans): splitting Urdu text into
 *   per-character spans BREAKS Nastaliq letter joining in some browsers. The
 *   old controller (js/pages/urdu-typing.js) documented this as CRITICAL, and
 *   this viewer keeps it: whole words get ok/bad/cur classes, never letters.
 *
 * WHY a pass/fail gate (WP-5 TYPE-10, C5; Architecture §7.3): the old
 *   controller (js/pages/urdu-typing.js) enforced pass + sequential
 *   unlock, and the live viewer dropped it — targets sat unused in the
 *   data file and Mark-complete marked done without typing. The gate is
 *   restored here: a lesson counts as complete only when a typed
 *   finish meets BOTH of its targets (targetWpm/targetAcc, 8–35 WPM /
 *   90–96%), scored through DKScoring (v2 net WPM, D-2); the next
 *   lesson unlocks only then. Pre-gate completions are grandfathered
 *   (TYPE-15): ids already marked done stay done and keep unlocking.
 *   Mark-complete only works after a typed pass in this session (or
 *   when the lesson is already done). The gate messages live in the
 *   dicts (ur_gate_*), EN + UR translated, other locales English
 *   fallback. Nothing is sent anywhere; there is no backend call.
 *
 * DATA: prefers window.URDU_LESSONS (parent may inline the JSON as a script);
 *   otherwise fetches "urdu-lessons-data.json" from the same directory.
 *   If neither is available it says so in ls-result — it never fakes a lesson.
 */
(function () {
  'use strict';

  // -- Element lookup (all optional: the viewer degrades, never throws) -----
  function $(id) { return document.getElementById(id); }
  var passageEl = $('ls-passage');
  if (!passageEl) { return; } // No viewer body on this page; nothing to do.
  var titleEl = $('ls-title'), keysEl = $('ls-keys'), objectiveEl = $('ls-objective'),
      selectEl = $('ls-select'), inputEl = $('ls-input'), wpmEl = $('ls-wpm'),
      accEl = $('ls-acc'), resultEl = $('ls-result'), doneEl = $('ls-done'),
      prevEl = $('ls-prev'), nextEl = $('ls-next'), completeBtn = $('ls-complete');

  // -- Completion storage (device-local only) -------------------------------
  // WHY the "ur-" prefix: the new site's DK2 store also holds English lesson
  // ids, so Urdu ids are namespaced to avoid ever colliding with them.
  // WHY the fallback: if DK2 is absent, progress still works in this page's
  // own key instead of failing or pretending to save.
  function isDone(id) {
    if (window.DK2 && window.DK2.isLessonDone) { return window.DK2.isLessonDone('ur-' + id); }
    try {
      var done = JSON.parse(window.localStorage.getItem('dokit_urdu_lessons_done') || '[]');
      return done.indexOf(id) !== -1;
    } catch (e) { return false; }
  }
  function markDone(id) {
    if (window.DK2 && window.DK2.markLesson) { window.DK2.markLesson('ur-' + id); return; }
    try {
      var done = JSON.parse(window.localStorage.getItem('dokit_urdu_lessons_done') || '[]');
      if (done.indexOf(id) === -1) { done.push(id); }
      window.localStorage.setItem('dokit_urdu_lessons_done', JSON.stringify(done));
    } catch (e) { /* storage unavailable: page keeps working, nothing faked */ window.dkSwallow && window.dkSwallow(e, 'urdu-lessons-viewer.js'); }
  }

  // -- Grandfathering (WP-5 TYPE-15; coordinator decision, owner may veto)
  // WHY a snapshot, not a flag: pre-gate completions were earned under
  // no gate, so the first gated load records exactly which ur-<id> ids
  // were already done — the audit record of what the gate inherited.
  // The unlock chain already treats any done id as passed (TYPE-10),
  // so the snapshot itself changes no behaviour; it only proves what
  // the gate inherited.
  // WHY per-store: DK2 stores are per-account ('dk2:<uid>' signed in,
  // 'dk2' guest) — a snapshot keyed to the active store covers the
  // store the user actually used before the gate, and a later sign-in
  // gets its own first-gated-load snapshot. The fallback key (no DK2)
  // is used when progress lives in this page's own localStorage key.
  // WHY isDone (not getLessons): isDone is the one completion read the
  // viewer already depends on, so the snapshot works with any DK2
  // shape and with the no-DK2 fallback alike.
  // WHY once: the key is written only when absent — later completions
  // are gated passes, not grandfathered ones, and must never be added.
  var GF_KEY = 'dokit_urdu_grandfathered_v1';
  function snapshotGrandfathered() {
    try {
      var store = (window.DK2 && window.DK2.storeKey) ? window.DK2.storeKey() : 'dokit_urdu_lessons_done';
      var key = GF_KEY + ':' + store;
      if (window.localStorage.getItem(key)) { return; }
      var ids = [];
      lessons.forEach(function (ls) { if (isDone(ls.id)) { ids.push('ur-' + ls.id); } });
      window.localStorage.setItem(key, JSON.stringify({ version: 1, at: Date.now(), store: store, ids: ids }));
    } catch (e) { /* storage unavailable: the gate still works, only the audit record is missing */ window.dkSwallow && window.dkSwallow(e, 'urdu-lessons-viewer.js'); }
  }

  // -- Typing state ----------------------------------------------------------
  var lessons = [], n = 1, passage = '', typed = '', started = false,
      startTime = 0, finished = false, passedThisSession = false,
      locked = false;

  // -- Gate + unlock (WP-5 TYPE-10, C5; Architecture §7.3) -----------------
  // WHY index-based: lesson ids are the sequential numbers 1..25 and the
  // viewer addresses lessons by position (?n=), so lesson n is unlocked
  // when lesson n-1 is done; lesson 1 is always unlocked.
  // WHY isDone (not a separate passed flag): DK2 stores only the id, and
  // a done id means the lesson was passed (post-gate) or grandfathered
  // (pre-gate, TYPE-15) — both unlock the next lesson.
  function isUnlocked(index) {
    if (index <= 1) { return true; }
    return isDone(lessons[index - 2].id);
  }
  /* UI-04: re-evaluate the dropdown's disabled flags from the CURRENT
   * stored completions. The options are built once in init(); without
   * this, a pass in this session never reaches the dropdown until a
   * reload rebuilds it. Sequential unlocking is unchanged — an option
   * is enabled exactly when isUnlocked() says so. */
  function refreshDropdown() {
    if (!selectEl) { return; }
    Array.prototype.forEach.call(selectEl.options, function (o, i) {
      o.disabled = !isUnlocked(i + 1);
    });
  }
  // WHY the dkT key (not a literal): the target line is UI text — it
  // reads the existing target_wpm dict key (all 10 locales), so the
  // gate never renders a raw literal (js-gate.py).
  function targetText(lesson) {
    return (window.dkT ? window.dkT('target_wpm', 'Target WPM') : 'Target WPM') + ': ' + lesson.targetWpm + ' / ' + lesson.targetAcc + '%';
  }

  // Render the passage as whole-word spans (Nastaliq-safe, see header).
  function renderPassage() {
    passageEl.innerHTML = '';
    var words = passage.split(' ');
    var typedWords = typed.split(' ');
    words.forEach(function (w, i) {
      var s = document.createElement('span');
      s.textContent = w;
      // A word counts as judged only once it is finished (space typed after
      // it); the word being typed is only highlighted, never scored early.
      if (i < typedWords.length - 1 || (i === typedWords.length - 1 && typed.length && typed[typed.length - 1] === ' ')) {
        s.className = (typedWords[i] === w) ? 'ok' : 'bad';
      } else if (i === typedWords.length - 1) {
        s.className = 'cur';
      }
      passageEl.appendChild(s);
      if (i < words.length - 1) { passageEl.appendChild(document.createTextNode(' ')); }
    });
  }

  // Live stats use CORRECT graphemes (new-site viewer formula), not the old
  // timed-test formula: a lesson is practice, so only correct typing counts.
  // WP-4 TYPE-02: scored through the ONE shared service (dk-scoring.js,
  // docs/scoring-metrics-v2.md §1-2). The pre-v2 UTF-16 computation is
  // kept ONLY as the fallback when DKScoring failed to load.
  function stats() {
    var elapsedMs = started ? (Date.now() - startTime) : 0;
    var st;
    if (window.DKScoring) {
      st = window.DKScoring.score(passage, typed, elapsedMs, 'ur');
    } else {
      var correct = 0, i;
      for (i = 0; i < typed.length; i++) {
        if (typed[i] === passage[i]) { correct++; }
      }
      var mins = elapsedMs / 60000;
      st = { wpm: mins > 0 ? Math.round((correct / 5) / mins) : 0,
        acc: typed.length ? Math.round(correct / typed.length * 100) : 100,
        correct: correct, typed: typed.length,
        // WP-5 scoring-wiring: the fallback tags itself v1, like the
        // other three lesson/test paths, so a v1 row is recognisable.
        metricVersion: 'v1-net-utf16', graphemeVersion: 'utf16' };
    }
    var wpm = st.wpm, acc = st.acc;
    if (wpmEl) { wpmEl.textContent = wpm; }
    if (accEl) { accEl.textContent = acc + '%'; }
    return { wpm: wpm, acc: acc, correct: st.correct, typed: st.typed,
      metricVersion: st.metricVersion, graphemeVersion: st.graphemeVersion };
  }

  function refreshDone(lesson) {
    if (doneEl) {
      doneEl.textContent = isDone(lesson.id)
        ? (window.dkT ? window.dkT('rsv_0962', 'Completed \u2713 (saved on this device)') : 'Completed \u2713 (saved on this device)')
        : (window.dkT ? window.dkT('rsv_0986', 'Not completed yet') : 'Not completed yet');
    }
  }

  function finish(lesson) {
    if (finished) { return false; }
    // WP-4 TYPE-04 (C2, Architecture §8.6; paper §6): the shared
    // sub-second rule — a finish below 1000 ms is REJECTED, not
    // scored. Nothing is marked done and no XP is awarded. WHY reset
    // instead of locking: the rejection means "that finish does not
    // count" — the user retypes the same lesson immediately.
    var elapsedMs = started ? (Date.now() - startTime) : 0;
    if (window.DKScoring ? window.DKScoring.isSubSecond(elapsedMs) : elapsedMs < 1000) {
      if (resultEl) {
        resultEl.textContent = (window.dkT ? window.dkT('typing_too_fast', 'Result not counted: the test finished too quickly to be a timed typing test. Please type the passage yourself and try again.') : 'Result not counted: the test finished too quickly to be a timed typing test. Please type the passage yourself and try again.');
      }
      typed = ''; started = false;
      if (inputEl) { inputEl.value = ''; inputEl.disabled = false; inputEl.focus(); }
      renderPassage();
      return false;
    }
    var st = stats();
    // WP-5 TYPE-10 (C5): the pass/fail gate. A typed finish counts only
    // when it meets BOTH targets (v2 net WPM + accuracy, D-2). A failed
    // finish marks nothing, awards no XP, and resets for an immediate
    // retry — the same reset shape as the sub-second rejection above.
    // A lesson without targets (defensive; all 25 carry them) passes on
    // any typed finish, preserving the old behaviour.
    var hasTargets = (typeof lesson.targetWpm === 'number' && typeof lesson.targetAcc === 'number');
    var passed = !hasTargets || (st.wpm >= lesson.targetWpm && st.acc >= lesson.targetAcc);
    if (!passed) {
      if (resultEl) {
        resultEl.textContent = (window.dkT ? window.dkT('ur_gate_failed', 'Not yet — target not met. Try again.') : 'Not yet — target not met. Try again.') + ' ' + targetText(lesson);
      }
      typed = ''; started = false;
      if (inputEl) { inputEl.value = ''; inputEl.disabled = false; inputEl.focus(); }
      renderPassage();
      return false;
    }
    finished = true;
    passedThisSession = true;
    if (resultEl) {
      // WHY st.typed for "out of N typed": the v2 result text counts
      // the same units the score counted (paper §2).
      var typedCount = (typeof st.typed === 'number') ? st.typed : typed.length;
      resultEl.textContent = (window.dkT ? window.dkT('rsv_1002', 'Result: ') : 'Result: ') + st.wpm + ' WPM, ' + st.acc +
        (window.dkT ? window.dkT('rsv_0956', '% accuracy, ') : '% accuracy, ') + st.correct + (window.dkT ? window.dkT('rsv_0949', ' correct characters out of ') : ' correct characters out of ') +
        typedCount + (window.dkT ? window.dkT('rsv_0952', ' typed.') : ' typed.') + ' ' +
        (window.dkT ? window.dkT('ur_gate_passed', 'Passed! Lesson complete.') : 'Passed! Lesson complete.');
    }
    markDone(lesson.id);
    refreshDropdown();
    // Gamification (Task 5): lesson XP + badges, once per lesson.
    // Urdu lessons use their own 'ur-' keys (as DK2 does); scholar is
    // the English curriculum only, so no beginner ids are passed.
    if (window.DK2 && window.DK2.afterActivity) {
      window.DK2.afterActivity('lesson', st, { lessonId: 'ur-' + lesson.id, beginnerIds: [] });
    }
    refreshDone(lesson);
    return true;
  }

  function loadLesson(index) {
    var lesson = lessons[index - 1];
    if (!lesson) { return; }
    n = index;
    passage = lesson.lines ? lesson.lines.join(' ') : lesson.text;
    typed = ''; started = false; finished = false; passedThisSession = false;
    // WP-5 TYPE-10: a locked lesson renders read-only (passage visible,
    // input + Mark-complete disabled) with the lock message + target, so
    // the user can see what is ahead but cannot type or complete it.
    locked = !isUnlocked(index);
    if (titleEl) { titleEl.textContent = lesson.title; }
    if (keysEl) { keysEl.textContent = (window.dkT ? window.dkT('rsv_0981', 'Keys: ') : 'Keys: ') + lesson.keys; }
    // Objective is shown only if the body provides an ls-objective element;
    // it is Roman-Urdu text from the old data, never translated here.
    if (objectiveEl) { objectiveEl.textContent = lesson.objective || ''; }
    if (prevEl) {
      // T078 (same rule as the English viewer): at the ends the link is
      // disabled, not a self-link.
      if (n > 1) { prevEl.href = '?n=' + (n - 1); prevEl.removeAttribute('aria-disabled'); }
      else { prevEl.removeAttribute('href'); prevEl.setAttribute('aria-disabled', 'true'); }
    }
    if (nextEl) {
      if (n < lessons.length) { nextEl.href = '?n=' + (n + 1); nextEl.removeAttribute('aria-disabled'); }
      else { nextEl.removeAttribute('href'); nextEl.setAttribute('aria-disabled', 'true'); }
    }
    if (selectEl) { selectEl.value = String(n); }
    if (inputEl) {
      inputEl.value = '';
      inputEl.disabled = locked;
      if (!locked) { inputEl.focus(); }
    }
    if (completeBtn) { completeBtn.disabled = locked; }
    if (wpmEl) { wpmEl.textContent = '0'; }
    if (accEl) { accEl.textContent = '100%'; }
    if (resultEl) {
      // WHY the target line on load: the old controller showed the
      // target per lesson (🎯 WPM • %), so the user always knows what
      // a pass needs before typing; a locked lesson shows the lock
      // message in front of the same target.
      resultEl.textContent = locked
        ? (window.dkT ? window.dkT('ur_gate_locked', 'Locked — pass the previous lesson first.') : 'Locked — pass the previous lesson first.') + ' ' + targetText(lesson)
        : targetText(lesson);
    }
    renderPassage();
    refreshDone(lesson);
  }

  function init(data) {
    lessons = data;
    // WP-5 TYPE-15: snapshot pre-gate completions on the first gated
    // load (once per store; later loads never overwrite it).
    snapshotGrandfathered();
    var params = new URLSearchParams(window.location.search);
    n = parseInt(params.get('n'), 10) || 1;
    if (n < 1) { n = 1; }
    if (n > lessons.length) { n = lessons.length; }
    // Dropdown built from the same list, so it can never point at a lesson
    // that does not exist (same DRY rule as the new English viewer).
    // WP-5 TYPE-10: locked lessons are disabled options — the dropdown
    // can never jump ahead of the unlock chain (Next still navigates to
    // a locked lesson's read-only view).
    if (selectEl) {
      lessons.forEach(function (ls, i) {
        var o = document.createElement('option');
        o.value = i + 1;
        o.textContent = (i + 1) + '. ' + ls.title + ' (' + ls.keys + ')';
        if (!isUnlocked(i + 1)) { o.disabled = true; }
        if (i + 1 === n) { o.selected = true; }
        selectEl.appendChild(o);
      });
      selectEl.addEventListener('change', function () {
        window.location.search = '?n=' + selectEl.value;
      });
    }
    if (completeBtn) {
      completeBtn.addEventListener('click', function () {
        // WP-5 TYPE-10: Mark-complete requires a typed pass. A lesson
        // already done (passed earlier or grandfathered) refreshes as
        // complete; a lesson passed in this session marks now; anything
        // else is refused with the target reminder — the button never
        // marks a lesson done without typing.
        var lesson = lessons[n - 1];
        if (isDone(lesson.id)) { refreshDone(lesson); refreshDropdown(); return; }
        if (passedThisSession) { markDone(lesson.id); refreshDone(lesson); refreshDropdown(); return; }
        if (resultEl) {
          resultEl.textContent = (window.dkT ? window.dkT('ur_gate_pass_first', 'Type the lesson and meet the target first.') : 'Type the lesson and meet the target first.') + ' ' + targetText(lesson);
        }
      });
    }
    if (inputEl) {
      inputEl.addEventListener('input', function () {
        if (finished) { return; }
        typed = inputEl.value;
        if (!started && typed.length > 0) { started = true; startTime = Date.now(); }
        renderPassage();
        stats();
        // WHY finish() returns a boolean: on a sub-second rejection
        // the viewer has already reset for a retry — disabling the
        // input here would lock the user out of that retry.
        if (typed.length >= passage.length) { if (finish(lessons[n - 1])) { inputEl.disabled = true; } }
      });
    }
    loadLesson(n);
  }

  // -- Data bootstrap ---------------------------------------------------------
  if (window.URDU_LESSONS && window.URDU_LESSONS.length) {
    init(window.URDU_LESSONS);
  } else if (window.fetch) {
    window.fetch('urdu-lessons-data.json').then(function (r) { return r.json(); }).then(function (data) {
      if (data && data.length) { init(data); }
      else if (resultEl) { resultEl.textContent = (window.dkT ? window.dkT('rsv_0984', 'No Urdu lessons found.') : 'No Urdu lessons found.'); }
    }).catch(function () {
      if (resultEl) { resultEl.textContent = (window.dkT ? window.dkT('rsv_1012', 'Urdu lessons could not be loaded on this device.') : 'Urdu lessons could not be loaded on this device.'); }
    });
  } else if (resultEl) {
    resultEl.textContent = (window.dkT ? window.dkT('rsv_1012', 'Urdu lessons could not be loaded on this device.') : 'Urdu lessons could not be loaded on this device.');
  }
})();
