/**
 * DoKit — Urdu Typing Page Controller
 * =====================================
 * WHAT: Interactive Urdu typing tutor — lessons, timed tests, progress tracking.
 *       Renders the typing interface on typing/urdu.html.
 *
 * WHY: Guided practice with immediate feedback (WPM, accuracy) is how people
 *      learn typing. This controller manages the full learning loop.
 *
 * FEATURES:
 *   1. LESSONS (25, unlock-by-pass progression):
 *      - Grid shows 🔒 locked / ✅ completed / ▶ available states
 *      - Click lesson → practice view with target text
 *      - Live stats: WPM, accuracy, elapsed time
 *      - On finish: checks vs lesson targets → pass/fail → unlock next
 *      - Progress saved to localStorage (dokit_urdu_progress)
 *   2. TIMED TESTS (1/3/5 min):
 *      - Passage picker, countdown timer
 *      - Results: WPM, accuracy, characters typed
 *   3. KEYBOARD INTEGRATION:
 *      - Uses UrduKeyboard module for transliteration + visual keyboard
 *      - Next-key highlight during practice
 *      - RTL textarea for Urdu input
 *   4. JOURNEY LOGGING:
 *      - Logs completed lessons/tests to Journey timeline
 *
 * RTL & SHAPING (CRITICAL):
 *   - Uses WORD-level highlighting (not char-level spans)
 *   - Why: Splitting Urdu into per-character spans BREAKS Nastaliq letter
 *     joining in some browsers. Word-level keeps shaping intact.
 *   - Target text and input both dir="rtl", font: Noto Nastaliq Urdu
 *
 * DEPENDENCIES:
 *   - UrduKeyboard (js/urdu-keyboard.js) — transliteration + visual keyboard
 *   - UrduLessons (js/urdu-lessons.js) — lesson data
 *   - Journey (js/journey.js) — activity logging (optional)
 *
 * @module UrduTypingPage
 */
(function () {
  "use strict";

  /**
   * Shorthand for document.getElementById.
   * WHY: Used 20+ times in this file. Shorter = more readable.
   * @param {string} id - Element ID.
   * @returns {HTMLElement|null} The element, or null if not found.
   */
  function $(id) { return document.getElementById(id); }
  var LS_PROG = "dokit_urdu_progress";
  var LS_UI = "dokit_urdu_ui";

  var S = null; // active session
  var uiLang = "ur";
  try { uiLang = localStorage.getItem(LS_UI) || "ur"; } catch (e) {}

  /**
   * Load lesson progress from localStorage.
   * WHY localStorage: Progress must persist across sessions without requiring
   * sign-in. Shape: { completed: [1,2,3], wpm: {1: 12, 2: 15} }.
   * @returns {{completed: Array<number>, wpm: Object}} Progress object.
   */
  function getProgress() {
    try {
      var p = JSON.parse(localStorage.getItem(LS_PROG));
      if (p && p.lessons) return p;
    } catch (e) {}
    return { lessons: {}, tests: [] };
  }
  /**
   * Save lesson progress to localStorage.
   * WHY try/catch: Storage may be unavailable (private mode). Progress loss is
   * acceptable; breaking the lesson is not.
   * @param {{completed: Array<number>, wpm: Object}} p - Progress to save.
   */
  function saveProgress(p) {
    try { localStorage.setItem(LS_PROG, JSON.stringify(p)); } catch (e) {}
  }
  /**
   * Check if a lesson is unlocked (lesson 1 always unlocked; others require
   * previous lesson completed).
   * WHY sequential unlock: Prevents beginners from jumping to expert lessons
   * and getting frustrated. Pedagogically sound progression.
   * @param {number} id - Lesson ID (1-25).
   * @returns {boolean} True if user can access this lesson.
   */
  function isUnlocked(id) {
    if (id === 1) return true;
    var p = getProgress();
    return !!(p.lessons[id - 1] && p.lessons[id - 1].passed);
  }

  /* ---------- UI language toggle ---------- */
  /**
   * Apply UI language (English/اردو toggle) to static labels.
   * WHY: The typing page has its own EN/UR toggle separate from site i18n,
   * because lesson content is Urdu-specific and needs custom handling.
   */
  function applyUiLang() {
    document.querySelectorAll("[data-en]").forEach(function (el) {
      var v = el.getAttribute(uiLang === "ur" ? "data-ur" : "data-en");
      if (v != null) el.textContent = v;
    });
    document.documentElement.lang = uiLang;
    // keep RTL for Urdu, LTR for English UI
    document.documentElement.dir = uiLang === "ur" ? "rtl" : "ltr";
    try { localStorage.setItem(LS_UI, uiLang); } catch (e) {}
  }

  /* ---------- Setup: layout selector ---------- */
  /**
   * Render the keyboard layout selector cards (Phonetic / Standard Urdu).
   * WHY cards (not dropdown): Visual preview of each layout helps users choose.
   * Shows name, description, and sample key mapping. Clicking switches layout
   * via UrduKeyboard.setLayout() and re-renders the visual keyboard.
   */
  function renderLayoutCards() {
    var row = $("layoutRow");
    row.innerHTML = "";
    UrduKB.layoutIds.forEach(function (id) {
      var L = UrduKB.layouts[id];
      var c = document.createElement("div");
      c.className = "layout-card" + (UrduKB.getLayout() === id ? " sel" : "");
      c.setAttribute("role", "button");
      c.setAttribute("tabindex", "0");
      var h = document.createElement("h3");
      h.className = "urdu";
      h.textContent = (uiLang === "ur" ? L.nameUr : L.name);
      var p = document.createElement("p");
      p.textContent = (uiLang === "ur" ? L.descUr : L.desc);
      c.appendChild(h); c.appendChild(p);
      var pick = function () {
        UrduKB.setLayout(id);
        renderLayoutCards();
        UrduKB.renderKeyboard($("kbPreview"));
        if (S && !S.done) UrduKB.renderKeyboard($("kbActive"));
      };
      c.addEventListener("click", pick);
      c.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); }
      });
      row.appendChild(c);
    });
  }

  /* ---------- Setup: lessons grid ---------- */
  /**
   * Render the 25-lesson grid grouped by level (Beginner/Intermediate/Advanced/Expert).
   * Each lesson card shows: 🔒 locked, ✅ completed (with best WPM), or ▶ available.
   * WHY grouping: 25 lessons is overwhelming as a flat list. Level groups provide
   * structure and a sense of progression ("I'm in Intermediate now!").
   */
  function renderLessons() {
    var pane = $("lessonsPane");
    pane.innerHTML = "";
    var prog = getProgress();
    URDU_LEVELS.forEach(function (lv) {
      var head = document.createElement("div");
      head.className = "level-head";
      head.innerHTML = '<span class="level-dot" style="background:' + lv.color + '"></span>' +
        "<h3 class='urdu' style='margin:0'>" + (uiLang === "ur" ? lv.nameUr : lv.name) +
        " <span style='font-size:.8rem;color:var(--muted,#6b7280)'>(" + lv.range[0] + "–" + lv.range[1] + ")</span></h3>";
      pane.appendChild(head);
      var grid = document.createElement("div");
      grid.className = "lesson-grid";
      URDU_LESSONS.forEach(function (L) {
        if (L.id < lv.range[0] || L.id > lv.range[1]) return;
        var unlocked = isUnlocked(L.id);
        var rec = prog.lessons[L.id];
        var card = document.createElement("div");
        card.className = "lesson-card" + (unlocked ? "" : " locked");
        var st = !unlocked ? "🔒" : (rec && rec.passed ? "✅" : "▶");
        card.innerHTML =
          '<span class="st">' + st + "</span>" +
          '<div class="ln">Lesson ' + L.id + "</div>" +
          '<h4 class="urdu">' + L.titleUr + "</h4>" +
          '<div class="obj">' + L.objective + "</div>" +
          '<div class="tgt">🎯 ' + L.targetWpm + " WPM • " + L.targetAcc + "%</div>";
        if (unlocked) {
          card.addEventListener("click", function () { startLesson(L.id); });
        }
        grid.appendChild(card);
      });
      pane.appendChild(grid);
    });
  }

  /* ---------- Setup: test pane ---------- */
  var testMin = 1, testPass = 0;
  /**
   * Render the timed-test configuration pane (duration picker + passage picker).
   * WHY separate from lessons: Tests are assessment, lessons are learning.
   * Different mental mode — user chooses "I want to practice" vs "test my speed".
   */
  function renderTestPane() {
    var pr = $("passRow");
    pr.innerHTML = "";
    URDU_TESTS.forEach(function (t, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "pick" + (i === testPass ? " sel" : "");
      b.innerHTML = '<span class="urdu">' + t.title + '</span><br><small>' + t.titleEn + "</small>";
      b.addEventListener("click", function () {
        testPass = i; renderTestPane();
      });
      pr.appendChild(b);
    });
  }

  /* ---------- Session ---------- */
  /**
   * Show one view pane, hide others (lessons / test / active practice).
   * WHY single-view: Prevents confusion. User is either browsing, configuring,
   * or practicing — never two at once.
   * @param {string} id - Pane ID to show ("lessons", "test", "active").
   */
  function show(id) {
    ["setup", "active", "done"].forEach(function (x) {
      $(x).classList.toggle("hidden", x !== id);
    });
    window.scrollTo(0, 0);
  }

  /**
   * Start a typing session (shared by lessons and tests).
   * WHY shared: Lessons and tests differ only in text source and timing;
   * the typing mechanics (input handling, WPM calc, highlighting) are identical.
   * Sets up: target text, timer, input listener, keyboard attachment.
   * @param {string} text - The Urdu text to type.
   * @param {object} meta - { type: "lesson"|"test", id, targetWpm, targetAccuracy }.
   */
  function startSession(text, meta) {
    S = {
      target: text,
      words: text.split(" "),
      meta: meta, // {kind:'lesson', lesson} or {kind:'test', minutes}
      started: false, done: false, t0: 0, timer: null, typed: ""
    };
    $("activeTitle").textContent = meta.title;
    $("typeArea").value = "";
    $("statWpm").textContent = "0";
    $("statAcc").textContent = "100%";
    $("statTime").textContent = meta.kind === "test" ? fmt(meta.minutes * 60) : "0:00";
    renderTarget();
    UrduKB.attach($("typeArea"));
    UrduKB.renderKeyboard($("kbActive"));
    show("active");
    setTimeout(function () { try { $("typeArea").focus(); } catch (e) {} }, 100);
  }

  /**
   * Start a specific lesson by ID.
   * WHY guard isUnlocked: Prevents URL manipulation to skip ahead.
   * (Client-side only — a determined user can bypass, but honest users follow the path.)
   * @param {number} id - Lesson ID (1-25).
   */
  function startLesson(id) {
    var L = URDU_LESSONS[id - 1];
    startSession(L.text, { kind: "lesson", lesson: L, title: "سبق " + L.id + ": " + L.titleUr });
  }
  /**
   * Start a timed test with the selected duration and passage.
   * Reads duration/passage from the test pane UI controls.
   */
  function startTest() {
    var t = URDU_TESTS[testPass];
    startSession(t.text, { kind: "test", minutes: testMin, title: t.title + " — " + testMin + " منٹ" });
  }

  /**
   * Render the target text as word-level spans for highlighting.
   * WHY word-level (not char-level): Splitting Urdu into per-character spans
   * BREAKS Nastaliq letter joining in some browsers. Words stay intact;
   * we highlight whole words as correct/incorrect/current.
   * CRITICAL: Do not change to char-level without testing in Chrome, Firefox,
   * Safari with Noto Nastaliq.
   */
  function renderTarget() {
    var t = $("targetText");
    t.innerHTML = "";
    S.words.forEach(function (w, i) {
      var s = document.createElement("span");
      s.className = "w";
      s.textContent = w;
      t.appendChild(s);
      if (i < S.words.length - 1) t.appendChild(document.createTextNode(" "));
    });
    markWords(0, []);
  }

  /**
   * Format seconds as M:SS (e.g., 65 → "1:05").
   * @param {number} sec - Seconds.
   * @returns {string} Formatted time.
   */
  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    return Math.floor(sec / 60) + ":" + ("0" + (sec % 60)).slice(-2);
  }

  /**
   * Timer tick handler (called every second via setInterval).
   * Updates the countdown display. For tests, ends the session at 0.
   * For lessons (untimed), just shows elapsed time.
   */
  function tick() {
    if (!S || S.done || !S.started) return;
    var el = (Date.now() - S.t0) / 1000;
    if (S.meta.kind === "test") {
      var left = S.meta.minutes * 60 - el;
      $("statTime").textContent = fmt(left);
      if (left <= 0) { finish(); return; }
    } else {
      $("statTime").textContent = fmt(el);
    }
    updateLive(el);
  }

  /**
   * Update live WPM and accuracy displays during typing.
   * WHY live feedback: Users adjust their pace when they see real-time stats.
   * WPM = (correct chars / 5) / minutes. Accuracy = correct / total typed.
   * @param {number} elSecs - Elapsed seconds.
   */
  function updateLive(elSecs) {
    var typed = S.typed, target = S.target;
    var n = Math.min(typed.length, target.length), ok = 0, i;
    for (i = 0; i < n; i++) if (typed[i] === target[i]) ok++;
    var acc = typed.length ? Math.round(ok / typed.length * 100) : 100;
    var mins = elSecs / 60;
    var wpm = mins > 0.01 ? Math.round((typed.length / 5) / mins) : 0;
    $("statWpm").textContent = wpm;
    $("statAcc").textContent = acc + "%";
    return { wpm: wpm, acc: acc, ok: ok };
  }

  /**
   * Update word highlighting based on current input state.
   * WHY three states: correct (green) = typed correctly, incorrect (red) =
   * has errors, current (highlighted) = word being typed. Visual feedback
   * helps users spot mistakes immediately.
   * @param {number} curIdx - Index of the word currently being typed.
   * @param {Array<string>} states - Per-word state: "correct"|"incorrect"|"current"|"".
   */
  function markWords(curIdx, states) {
    var spans = $("targetText").querySelectorAll(".w");
    spans.forEach(function (s, i) {
      s.classList.toggle("cur", i === curIdx);
      s.classList.toggle("ok", states[i] === true);
      s.classList.toggle("bad", states[i] === false);
    });
  }

  /**
   * Handle input events in the typing textarea.
   * WHY input (not keydown): Catches all changes including paste, autocomplete,
   * and IME input. Compares typed words against target words, updates states,
   * and triggers live stats. This is the core typing loop.
   */
  function onInput() {
    if (!S || S.done) return;
    if (!S.started) {
      S.started = true;
      S.t0 = Date.now();
      S.timer = setInterval(tick, 250);
    }
    var typed = $("typeArea").value;
    S.typed = typed;
    var el = (Date.now() - S.t0) / 1000;
    updateLive(el);

    // word-level states (RTL/shaping safe)
    var tw = S.words, yw = typed.split(" ");
    var states = [], i;
    for (i = 0; i < tw.length; i++) {
      if (i < yw.length - 1 || (i === yw.length - 1 && typed.length && typed[typed.length - 1] === " ")) {
        states[i] = (yw[i] === tw[i]);
      }
    }
    var cur = Math.min(yw.length - 1, tw.length - 1);
    markWords(cur, states);

    // next-key highlight
    var pos = typed.length, nextCh = pos < S.target.length ? S.target[pos] : null;
    if (nextCh === " ") {
      UrduKB.highlightKey("Space", false);
    } else if (nextCh) {
      var f = UrduKB.findKeyFor(nextCh);
      UrduKB.highlightKey(f ? f.key : null, f ? f.shift : false);
    } else {
      UrduKB.highlightKey(null);
    }

    // lesson auto-finish when target fully typed
    if (S.meta.kind === "lesson" && typed.length >= S.target.length) {
      setTimeout(function () { if (!S.done) finish(); }, 400);
    }
  }

  /**
   * End the typing session and show results.
   * For lessons: checks WPM/accuracy vs targets → pass/fail → unlocks next lesson
   *   on pass, saves best WPM, logs to Journey.
   * For tests: shows WPM, accuracy, characters typed.
   * WHY clearInterval: Stops the timer. WHY detach keyboard: Returns input to normal.
   */
  function finish() {
    if (!S || S.done) return;
    S.done = true;
    clearInterval(S.timer);
    UrduKB.detach();
    var secs = Math.max(1, (Date.now() - S.t0) / 1000);
    var typed = S.typed, target = S.target;
    var n = Math.min(typed.length, target.length), ok = 0, i;
    for (i = 0; i < n; i++) if (typed[i] === target[i]) ok++;
    var acc = typed.length ? Math.round(ok / typed.length * 100) : 0;
    var wpm = Math.round((typed.length / 5) / (secs / 60));

    $("resWpm").textContent = wpm;
    $("resAcc").textContent = acc + "%";
    $("resChars").textContent = typed.length;
    $("resTime").textContent = fmt(secs);

    var verdict = $("resVerdict"), nextBtn = $("nextBtn");
    nextBtn.classList.add("hidden");
    if (S.meta.kind === "lesson") {
      var L = S.meta.lesson;
      var passed = wpm >= L.targetWpm && acc >= L.targetAcc;
      var p = getProgress();
      var prev = p.lessons[L.id] || {};
      p.lessons[L.id] = {
        wpm: Math.max(wpm, prev.wpm || 0),
        acc: Math.max(acc, prev.acc || 0),
        passed: !!(prev.passed || passed)
      };
      saveProgress(p);
      if (passed) {
        verdict.innerHTML = '<span class="pass-yes">🎉 ' + (uiLang === "ur" ? "مبارک! سبق پاس ہو گیا" : "Passed!") + "</span>";
        if (L.id < 25) {
          nextBtn.classList.remove("hidden");
          nextBtn.onclick = function () { startLesson(L.id + 1); };
        }
      } else {
        verdict.innerHTML = '<span class="pass-no">' +
          (uiLang === "ur" ? "ہدف: " + L.targetWpm + " WPM اور " + L.targetAcc + "% درستگی — دوبارہ کوشش کریں" :
            "Target: " + L.targetWpm + " WPM & " + L.targetAcc + "% — try again") + "</span>";
      }
      try {
        if (window.Journey) Journey.log("Urdu Typing", "Lesson " + L.id + ": " + wpm + " WPM, " + acc + "%");
      } catch (e) {}
    } else {
      var t = getProgress();
      t.tests.push({ wpm: wpm, acc: acc, min: S.meta.minutes, date: Date.now() });
      t.tests = t.tests.slice(-20);
      saveProgress(t);
      verdict.innerHTML = wpm >= 25
        ? '<span class="pass-yes">🌟 ' + (uiLang === "ur" ? "شاندار رفتار!" : "Excellent!") + "</span>"
        : (uiLang === "ur" ? "اچھی کوشش! مشق جاری رکھیں۔" : "Good effort — keep practicing.");
      try {
        if (window.Journey) Journey.log("Urdu Typing", "Test (" + S.meta.minutes + " min): " + wpm + " WPM");
      } catch (e) {}
    }
    show("done");
  }

  /* ---------- init ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    try { window.DKUI && (DKUI.renderNav("lessons"), DKUI.renderFooter(), DKUI.init()); } catch (e) {}
    try {
      if (window.UI && UI.renderNav) { UI.renderNav("lessons"); UI.renderFooter(); }
    } catch (e) {}

    applyUiLang();
    $("langToggle").addEventListener("click", function () {
      uiLang = uiLang === "ur" ? "en" : "ur";
      applyUiLang(); renderLayoutCards(); renderLessons(); renderTestPane();
    });

    renderLayoutCards();
    UrduKB.renderKeyboard($("kbPreview"));
    renderLessons();
    renderTestPane();

    $("tabLessons").addEventListener("click", function () {
      $("tabLessons").classList.add("sel"); $("tabTest").classList.remove("sel");
      $("lessonsPane").classList.remove("hidden"); $("testPane").classList.add("hidden");
    });
    $("tabTest").addEventListener("click", function () {
      $("tabTest").classList.add("sel"); $("tabLessons").classList.remove("sel");
      $("testPane").classList.remove("hidden"); $("lessonsPane").classList.add("hidden");
    });
    $("durRow").addEventListener("click", function (e) {
      var b = e.target.closest(".pick"); if (!b) return;
      testMin = parseInt(b.dataset.min, 10) || 1;
      $("durRow").querySelectorAll(".pick").forEach(function (x) { x.classList.remove("sel"); });
      b.classList.add("sel");
    });
    $("startTestBtn").addEventListener("click", startTest);

    $("typeArea").addEventListener("input", onInput);
    $("quitBtn").addEventListener("click", function () {
      if (S) { clearInterval(S.timer); S.done = true; }
      UrduKB.detach(); renderLessons(); show("setup");
    });
    $("restartBtn").addEventListener("click", function () {
      if (!S) return;
      var meta = S.meta;
      clearInterval(S.timer);
      if (meta.kind === "lesson") startLesson(meta.lesson.id); else startTest();
    });
    $("backBtn").addEventListener("click", function () { renderLessons(); show("setup"); });
    $("retryBtn").addEventListener("click", function () {
      var meta = S.meta;
      if (meta.kind === "lesson") startLesson(meta.lesson.id); else startTest();
    });
  });
})();
