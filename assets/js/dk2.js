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

  // Ensure the XP section exists on a stored object. Objects saved before
  // gamification predate it — they migrate lazily, results/lessons untouched.
  function xpOf(data) {
    if (!data.xp || typeof data.xp.total !== 'number' || !Array.isArray(data.xp.badges)
        || !data.xp.streak || typeof data.xp.streak.count !== 'number' || !data.xp.awarded) {
      data.xp = { total: 0, badges: [], streak: { count: 0, last: '' }, awarded: {} };
    }
    return data.xp;
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
    // The XP section goes too: the historical reset wiped everything.
    clearAll: function () { save({ results: [], lessons: [], xp: { total: 0, badges: [], streak: { count: 0, last: '' }, awarded: {} } }); },
    // -- Gamification (Task 5, historical gamification.js) ----------------
    // XP, badges and streak live in this SAME dk2 object — no second
    // store, no second source of truth. XP_LESSON 50, XP_TEST 30,
    // XP_PERFECT 25; level = floor(total / 200) + 1. XP is awarded once
    // per key (lesson base, lesson perfect, one test result per day);
    // badges are idempotent. Badge ids, icons, names and descriptions,
    // English + Urdu, verbatim from gamification.js.
    BADGES: [
      { id: 'first-steps', icon: '👣', en: 'First Steps', ur: 'پہلا قدم', desc_en: 'Complete your first lesson', desc_ur: 'پہلا سبق مکمل کریں' },
      { id: 'tester', icon: '⏱️', en: 'Time Trialist', ur: 'ٹیسٹ دینے والا', desc_en: 'Finish your first timed test', desc_ur: 'پہلا وقت والا ٹیسٹ مکمل کریں' },
      { id: 'sharpshooter', icon: '🎯', en: 'Sharpshooter', ur: 'نشانہ باز', desc_en: 'Score 100% accuracy in a lesson', desc_ur: 'کسی سبق میں 100 فیصد درستگی' },
      { id: 'streak3', icon: '🔥', en: 'Warming Up', ur: 'گرم ہو رہے ہیں', desc_en: 'Practice 3 days in a row', desc_ur: 'لگاتار 3 دن مشق' },
      { id: 'streak7', icon: '🔥', en: 'On Fire', ur: 'آگ لگی ہے', desc_en: 'Practice 7 days in a row', desc_ur: 'لگاتار 7 دن مشق' },
      { id: 'speed40', icon: '💨', en: 'Speedster', ur: 'تیز رفتار', desc_en: 'Reach 40 net WPM', desc_ur: '40 خالص WPM حاصل کریں' },
      { id: 'speed60', icon: '🚀', en: 'Rocket Fingers', ur: 'راکٹ انگلیاں', desc_en: 'Reach 60 net WPM', desc_ur: '60 خالص WPM حاصل کریں' },
      { id: 'speed80', icon: '⚡', en: 'Lightning', ur: 'بجلی', desc_en: 'Reach 80 net WPM', desc_ur: '80 خالص WPM حاصل کریں' },
      { id: 'scholar', icon: '🎓', en: 'Graduate', ur: 'گریجویٹ', desc_en: 'Finish all beginner lessons', desc_ur: 'تمام ابتدائی اسباق مکمل کریں' },
      { id: 'marathon', icon: '🏁', en: 'Marathoner', ur: 'لمبی دوڑ', desc_en: 'Complete a 10-minute test', desc_ur: '10 منٹ کا ٹیسٹ مکمل کریں' }
    ],
    // Badge display info in the given language ('ur' = Urdu, else English).
    badgeInfo: function (id, lang) {
      var found = null;
      for (var i = 0; i < window.DK2.BADGES.length; i++) {
        if (window.DK2.BADGES[i].id === id) { found = window.DK2.BADGES[i]; break; }
      }
      if (!found) { return null; }
      var ur = (lang === 'ur');
      return { icon: found.icon, name: ur ? found.ur : found.en, desc: ur ? found.desc_ur : found.desc_en };
    },
    // Current XP totals: level, progress inside the level, badges, streak.
    getXP: function () {
      var xp = xpOf(load());
      return { total: xp.total, level: Math.floor(xp.total / 200) + 1,
        intoLevel: xp.total % 200, badges: xp.badges.slice(), streak: xp.streak.count };
    },
    // Award XP once per key; a repeat key earns 0 (revisit/refresh-proof).
    awardXP: function (amount, key) {
      var data = load();
      var xp = xpOf(data);
      if (key && xp.awarded[key]) { return 0; }
      if (key) { xp.awarded[key] = true; }
      xp.total += amount;
      save(data);
      return amount;
    },
    // Award a badge once; returns true only when newly awarded.
    awardBadge: function (id) {
      var data = load();
      var xp = xpOf(data);
      if (xp.badges.indexOf(id) !== -1) { return false; }
      xp.badges.push(id);
      save(data);
      return true;
    },
    // Historical streak rule: same day = unchanged, yesterday = +1,
    // otherwise restarts at 1 (toDateString comparison, as the old code).
    touchStreak: function () {
      var data = load();
      var xp = xpOf(data);
      var today = new Date().toDateString();
      if (xp.streak.last === today) { return xp.streak.count; }
      var yesterday = new Date(Date.now() - 86400000).toDateString();
      xp.streak = { count: (xp.streak.last === yesterday) ? xp.streak.count + 1 : 1, last: today };
      save(data);
      return xp.streak.count;
    },
    // Historical Game.afterActivity, adapted for DK2. type: 'lesson' |
    // 'test' | anything else (practice = streak only). st: { acc, nwpm,
    // dur }. opts: { lessonId, beginnerIds, testKey }. Returns
    // { xpAdded, total, newBadges }. Lesson XP is split into two keys
    // (base + perfect) so a later first-time perfect still earns its
    // +25; totals match the historical single addXP in every case.
    afterActivity: function (type, st, opts) {
      opts = opts || {};
      var xpAdded = 0, newBadges = [];
      function give(id) { if (window.DK2.awardBadge(id)) { newBadges.push(id); } }
      if (type === 'lesson') {
        xpAdded += window.DK2.awardXP(50, 'lesson:' + opts.lessonId);
        if (st.acc >= 100) { xpAdded += window.DK2.awardXP(25, 'lesson-perfect:' + opts.lessonId); }
        give('first-steps');
        if (st.acc >= 100) { give('sharpshooter'); }
        if (opts.beginnerIds && opts.beginnerIds.length) {
          var done = window.DK2.getLessons();
          var all = true;
          for (var i = 0; i < opts.beginnerIds.length; i++) {
            if (done.indexOf(opts.beginnerIds[i]) === -1) { all = false; break; }
          }
          if (all) { give('scholar'); }
        }
      } else if (type === 'test') {
        xpAdded += window.DK2.awardXP(30, opts.testKey);
        give('tester');
        if (st.nwpm >= 40) { give('speed40'); }
        if (st.nwpm >= 60) { give('speed60'); }
        if (st.nwpm >= 80) { give('speed80'); }
        if (st.dur >= 600) { give('marathon'); }
        var streak = window.DK2.touchStreak();
        if (streak >= 3) { give('streak3'); }
        if (streak >= 7) { give('streak7'); }
      } else {
        window.DK2.touchStreak();
      }
      return { xpAdded: xpAdded, total: window.DK2.getXP().total, newBadges: newBadges };
    }
  };
})();
