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
 * WHY completion is a plain localStorage flag: the task requires mark-complete
 *   saved to localStorage only. There is deliberately NO pass/fail gate here:
 *   the old unlock-by-pass system (WPM/accuracy targets, locked lessons) is
 *   NOT ported — targets are preserved in the data file for the parent to
 *   re-add if wanted, but this viewer never invents a score and never locks
 *   a lesson. Finishing the passage also marks complete, mirroring the new
 *   English viewer's onFinish behaviour; the button lets the user mark it
 *   without finishing. Nothing is sent anywhere; there is no backend call.
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
    } catch (e) { /* storage unavailable: page keeps working, nothing faked */ }
  }

  // -- Typing state ----------------------------------------------------------
  var lessons = [], n = 1, passage = '', typed = '', started = false,
      startTime = 0, finished = false;

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

  // Live stats use CORRECT characters (new-site viewer formula), not the old
  // timed-test formula: a lesson is practice, so only correct typing counts.
  function stats() {
    var correct = 0, i;
    for (i = 0; i < typed.length; i++) {
      if (typed[i] === passage[i]) { correct++; }
    }
    var mins = started ? (Date.now() - startTime) / 60000 : 0;
    var wpm = mins > 0 ? Math.round((correct / 5) / mins) : 0;
    var acc = typed.length ? Math.round(correct / typed.length * 100) : 100;
    if (wpmEl) { wpmEl.textContent = wpm; }
    if (accEl) { accEl.textContent = acc + '%'; }
    return { wpm: wpm, acc: acc, correct: correct };
  }

  function refreshDone(lesson) {
    if (doneEl) {
      doneEl.textContent = isDone(lesson.id)
        ? (window.dkT ? window.dkT('rsv_0962', 'Completed \u2713 (saved on this device)') : 'Completed \u2713 (saved on this device)')
        : (window.dkT ? window.dkT('rsv_0986', 'Not completed yet') : 'Not completed yet');
    }
  }

  function finish(lesson) {
    if (finished) { return; }
    finished = true;
    var st = stats();
    if (resultEl) {
      resultEl.textContent = (window.dkT ? window.dkT('rsv_1002', 'Result: ') : 'Result: ') + st.wpm + ' WPM, ' + st.acc +
        (window.dkT ? window.dkT('rsv_0956', '% accuracy, ') : '% accuracy, ') + st.correct + (window.dkT ? window.dkT('rsv_0949', ' correct characters out of ') : ' correct characters out of ') +
        typed.length + (window.dkT ? window.dkT('rsv_0952', ' typed.') : ' typed.');
    }
    markDone(lesson.id);
    refreshDone(lesson);
  }

  function loadLesson(index) {
    var lesson = lessons[index - 1];
    if (!lesson) { return; }
    n = index;
    passage = lesson.lines ? lesson.lines.join(' ') : lesson.text;
    typed = ''; started = false; finished = false;
    if (titleEl) { titleEl.textContent = lesson.title; }
    if (keysEl) { keysEl.textContent = (window.dkT ? window.dkT('rsv_0981', 'Keys: ') : 'Keys: ') + lesson.keys; }
    // Objective is shown only if the body provides an ls-objective element;
    // it is Roman-Urdu text from the old data, never translated here.
    if (objectiveEl) { objectiveEl.textContent = lesson.objective || ''; }
    if (prevEl) { prevEl.href = n > 1 ? '?n=' + (n - 1) : '?n=1'; }
    if (nextEl) { nextEl.href = n < lessons.length ? '?n=' + (n + 1) : '?n=' + lessons.length; }
    if (selectEl) { selectEl.value = String(n); }
    if (inputEl) { inputEl.value = ''; inputEl.disabled = false; inputEl.focus(); }
    if (wpmEl) { wpmEl.textContent = '0'; }
    if (accEl) { accEl.textContent = '100%'; }
    if (resultEl) { resultEl.textContent = ''; }
    renderPassage();
    refreshDone(lesson);
  }

  function init(data) {
    lessons = data;
    var params = new URLSearchParams(window.location.search);
    n = parseInt(params.get('n'), 10) || 1;
    if (n < 1) { n = 1; }
    if (n > lessons.length) { n = lessons.length; }
    // Dropdown built from the same list, so it can never point at a lesson
    // that does not exist (same DRY rule as the new English viewer).
    if (selectEl) {
      lessons.forEach(function (ls, i) {
        var o = document.createElement('option');
        o.value = i + 1;
        o.textContent = (i + 1) + '. ' + ls.title + ' (' + ls.keys + ')';
        if (i + 1 === n) { o.selected = true; }
        selectEl.appendChild(o);
      });
      selectEl.addEventListener('change', function () {
        window.location.search = '?n=' + selectEl.value;
      });
    }
    if (completeBtn) {
      completeBtn.addEventListener('click', function () {
        markDone(lessons[n - 1].id);
        refreshDone(lessons[n - 1]);
      });
    }
    if (inputEl) {
      inputEl.addEventListener('input', function () {
        if (finished) { return; }
        typed = inputEl.value;
        if (!started && typed.length > 0) { started = true; startTime = Date.now(); }
        renderPassage();
        stats();
        if (typed.length >= passage.length) { finish(lessons[n - 1]); inputEl.disabled = true; }
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
