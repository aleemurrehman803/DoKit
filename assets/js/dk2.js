/* DoKit — on-device progress storage (Phase 2b).
 * One namespace (dk2) for typing results and lesson completions.
 * This is device-local only: no account, no upload, no sync.
 * Results saved here are what the Results / Progress / Dashboard
 * pages display. Nothing is ever invented — empty means empty. */
(function () {
  'use strict';
  var KEY = 'dk2'; // single storage key for the whole Phase 2b build
  // Read the stored object; return a clean empty shape on any failure.
  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      var data = raw ? JSON.parse(raw) : null;
      if (data && Array.isArray(data.results) && Array.isArray(data.lessons)) {
        return data;
      }
    } catch (e) { /* storage unavailable — fall through to empty */ }
    return { results: [], lessons: [] };
  }
  // Persist the object; failures are swallowed (page must keep working).
  function save(data) {
    try { window.localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { /* ignore — progress just won't persist */ }
  }
  window.DK2 = {
    // Add one result (newest first, capped so storage never grows wild).
    saveResult: function (r) {
      var data = load();
      r.date = new Date().toISOString();
      data.results.unshift(r);
      if (data.results.length > 200) { data.results.length = 200; }
      save(data);
    },
    getResults: function () { return load().results; },
    // Mark a lesson id complete (no duplicates).
    markLesson: function (id) {
      var data = load();
      if (data.lessons.indexOf(id) === -1) { data.lessons.push(id); save(data); }
    },
    isLessonDone: function (id) { return load().lessons.indexOf(id) !== -1; },
    getLessons: function () { return load().lessons; },
    // Wipe local history (used by the Results page "clear" button).
    clearAll: function () { save({ results: [], lessons: [] }); }
  };
})();
