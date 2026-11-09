/**
 * DoKit — Urdu Keyboard Engine
 * ==============================
 * WHAT: Phonetic Urdu keyboard for typing Urdu using Roman (English) keys.
 *       Maps QWERTY keystrokes to Urdu characters in real-time.
 *
 * WHY: Most Pakistanis don't have Urdu keyboards. Phonetic typing lets them
 *      type Urdu naturally: press "a" → get "ا", "b" → "ب", etc.
 *
 * LAYOUTS (2 supported, user-selectable):
 *   1. "phonetic" (default): InPage-style Roman→Urdu mapping
 *      - a→ا, b→ب, p→پ, t→ت, v→ٹ (retroflex), h→ھ (do-chashmi he)
 *      - Digraphs collapse: "th"→تھ, "bh"→بھ, "kh"→خ, "aa"→آ, etc.
 *      - Shift+h→ح, Shift+t→ط (letters the canonical map cannot spell)
 *      - Shift+Space→ZWNJ (zero-width non-joiner for نہیں, etc.)
 *      Mapping source: the shared canonical map (window.DKUrduMap) —
 *      this file keeps no private Roman→Urdu map (V3 WP-3, KEY-02).
 *   2. "standard": Pakistan XKB "pk" layout (physical Urdu keyboard)
 *      - Letter core verified against OLPC XKB symbol table
 *
 * FEATURES:
 *   - keydown transliteration: intercepts keystrokes in inputs, inserts Urdu
 *   - Visual on-screen keyboard: click keys to type, Shift toggle
 *   - Physical key highlight: flashes the on-screen key when pressed
 *   - Next-key highlight: during lessons, highlights the expected key
 *   - Urdu digits ۰-۹ on number row, punctuation ، ۔ ؛ ؟
 *
 * RTL & SHAPING:
 *   - Inserts plain Unicode characters; browser handles Nastaliq shaping
 *   - Typing UI must use word-level (not char-level) highlighting to preserve
 *     letter joining across browsers
 *
 * @module UrduKeyboard
 */
(function () {
  "use strict";

  var LS_LAYOUT = "dokit_urdu_layout";

  /* ---- Canonical Roman→Urdu map (V3 WP-3, KEY-02, decision D-3) ----
   * WHY no private map here: the converter (assets/js/urdu.js) and this
   * keyboard used to carry two conflicting Roman→Urdu maps (C3: h→ھ vs ح,
   * v→ٹ vs ط, and no digraphs here at all). The map now lives in ONE place,
   * assets/js/urdu-canonical-map.js (window.DKUrduMap), and both surfaces
   * read it. A second map definition anywhere is a defect.
   * Base layer = the canonical SINGLES exactly (h→ھ, v→ٹ, …).
   * Shift layer = SHIFT_SUPPLEMENT below: ONLY characters with no Roman
   * transliteration in the canonical map (diacritics and letters the
   * converter cannot express), plus the two letters displaced from the base
   * layer (Shift+h→ح, Shift+t→ط — the old Shift+h ھ and Shift+t ٹ moved to
   * the base layer as h and v). Four shift entries duplicate a canonical
   * output (Shift+a→آ, Shift+g→غ, Shift+k→خ, Shift+x→ژ) as alternates, so
   * next-key highlight (findKeyFor) keeps working; they are the same
   * character, not a conflicting mapping.
   * The old comment's "verified against XKB" claim is NOT repeated here —
   * it is UNVERIFIED (no XKB reference table in the repo). */
  var CANON = window.DKUrduMap || null;
  if (!CANON) {
    // WHY fail visible, not silent: without the map there is no correct
    // mapping, and inventing one here would re-create the C3 conflict.
    // The map script must load before this file (typing/urdu.html order).
    if (typeof console !== 'undefined' && console.error) {
      console.error('DKUrduMap missing — load assets/js/urdu-canonical-map.js before js/urdu-keyboard.js');
    }
    CANON = { version: 0, digraphs: {}, singles: {} };
  }
  /* Shift-only characters (see block comment above). Unicode escapes match
   * the file's existing style. f and b have no shift entry, as before. */
  var SHIFT_SUPPLEMENT = {
    q: "\u0652", // sukun
    w: "\u0651", // shadda
    e: "\u0670", // superscript alef
    r: "\u0691", // ڑ
    t: "\u0637", // ط (displaced from the v base key by the canonical v→ٹ)
    y: "\u064E", // fatha
    u: "\u0626", // ئ
    i: "\u0650", // kasra
    o: "\u0624", // ؤ — tutor adaptation (was XKB's rare ۃ; ؤ is common, e.g. گاؤں)
    p: "\u064F", // damma
    a: "\u0622", // آ (also the canonical "aa" digraph)
    s: "\u0635", // ص
    d: "\u0688", // ڈ
    g: "\u063A", // غ (also the canonical "gh" digraph)
    h: "\u062D", // ح (displaced from the h base key by the canonical h→ھ)
    j: "\u0636", // ض
    k: "\u062E", // خ (also the canonical "kh" digraph)
    l: "\u0656", // subscript alef
    z: "\u0630", // ذ
    x: "\u0698", // ژ (also the canonical "zh" digraph)
    c: "\u062B", // ث
    v: "\u0638", // ظ
    n: "\u06BA", // ں (noon ghunna)
    m: "\u0658"  // noon-ghunna mark
  };

  var URDU_DIGITS = ["\u06F0", "\u06F1", "\u06F2", "\u06F3", "\u06F4",
                     "\u06F5", "\u06F6", "\u06F7", "\u06F8", "\u06F9"]; // ۰۱۲۳۴۵۶۷۸۹
  // US symbols for Shift+number (index = digit 0..9)
  var PHON_SHIFT_SYM = [")", "!", "@", "#", "$", "%", "^", "&", "*", "("];

  /**
   * Build the key mapping table for a layout mode.
   * WHY one table from one map: the base layer is the canonical singles
   * (window.DKUrduMap — D-3), the shift layer is SHIFT_SUPPLEMENT
   * (characters with no Roman transliteration). No private map is kept.
   * WHY tutor adaptations: two deviations from strict XKB for learnability:
   *   1. Shift+o → ؤ (not XKB's rare ۃ) — ؤ appears in common words (گاؤں).
   *   2. Shift+digit → symbols (!@#) not Quranic marks — lessons need ! ؟.
   * Each key maps to { n: normal char, s: shift char }.
   * @param {string} mode - "phonetic" or "standard" (affects -/= keys).
   * @returns {Object<string, {n: string, s: string}>} Key ID → char mapping.
   */
  function buildKeys(mode) {
    var k = {}, l;
    // Base layer = canonical singles; shift layer = SHIFT_SUPPLEMENT.
    // (The Shift+o → ؤ tutor adaptation lives in SHIFT_SUPPLEMENT itself.)
    for (l in CANON.singles) {
      k[l] = { n: CANON.singles[l] };
      if (SHIFT_SUPPLEMENT[l]) k[l].s = SHIFT_SUPPLEMENT[l];
    }
    var d;
    for (d = 0; d <= 9; d++) {
      var key = String(d);
      // Tutor adaptation: Shift+digit = symbol (!@#...) in both layouts so that
      // lesson punctuation (! ؟) is always typeable. XKB honorifics (؃؂؁…)
      // are omitted as they are Quranic annotation signs, not typing targets.
      k[key] = { n: URDU_DIGITS[d], s: PHON_SHIFT_SYM[d] };
    }
    // Punctuation (shared)
    k[","] = { n: "\u060C", s: "\u0657" }; // ، / inverted damma
    k["."] = { n: "\u06D4", s: "\u066B" }; // ۔ / decimal separator
    k["/"] = { n: "/", s: "\u061F" };      // / / ؟
    k[";"] = { n: "\u061B", s: ":" };      // ؛
    k["'"] = { n: "'", s: '"' };
    k["-"] = { n: "-", s: mode === "standard" ? "\u0610" : "_" };
    k["="] = { n: "=", s: "+" };
    if (mode === "standard") {
      k["`"] = { n: "\u0654", s: "\u064B" }; // hamza above / fathatan
      k["["] = { n: "\uFDFD", s: "\uFDFA" }; // ﷽ / ﷺ
      k["]"] = { n: "\uFDF2", s: "\uFDFB" }; // ﷲ / ﷻ
    }
    return k;
  }

  var LAYOUTS = {
    phonetic: {
      id: "phonetic",
      name: "Phonetic",
      nameUr: "فونٹک",
      desc: "Roman Urdu style — type 'a' for ا, 'b' for ب. InPage-style, best for beginners.",
      descUr: "رومن اردو — ا کے لیے a دبائیں۔",
      keys: buildKeys("phonetic")
    },
    standard: {
      id: "standard",
      name: "Standard Urdu",
      nameUr: "معیاری اردو",
      desc: "Pakistan standard letter layout (XKB 'pk' core) + diacritics on Shift, extra symbols.",
      descUr: "پاکستان معیاری حروف + شفٹ پر اعراب۔",
      keys: buildKeys("standard")
    }
  };

  /* Physical rows: [keyId, ...] — keyId is base letter/digit/punct or special */
  var ROWS = [
    ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "Backspace"],
    ["Tab", "q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]"],
    ["CapsLock", "a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'", "Enter"],
    ["ShiftLeft", "z", "x", "c", "v", "b", "n", "m", ",", ".", "/", "ShiftRight"],
    ["Space"]
  ];
  var SPECIAL_LABEL = {
    Backspace: "⌫", Tab: "Tab", CapsLock: "Caps", Enter: "⏎",
    ShiftLeft: "⇧", ShiftRight: "⇧", Space: "Space"
  };

  var current = "phonetic";
  try {
    var saved = localStorage.getItem(LS_LAYOUT);
    if (saved && LAYOUTS[saved]) current = saved;
  } catch (e) {}

  var attachedEl = null;
  var attachedHandler = null;
  var osShift = false; // on-screen keyboard shift toggle

  /**
   * Switch the active keyboard layout and persist the choice.
   * WHY persist: Users shouldn't re-select their layout on every visit.
   * Invalid IDs are rejected (returns false, keeps current).
   * @param {string} id - "phonetic" or "standard".
   * @returns {boolean} True if switched, false if invalid ID.
   */
  function setLayout(id) {
    if (!LAYOUTS[id]) return false;
    current = id;
    try { localStorage.setItem(LS_LAYOUT, id); } catch (e) {}
    return true;
  }
  /**
   * Get the currently active keyboard layout.
   * @returns {string} "phonetic" or "standard" - read from localStorage, defaults to "phonetic"
   */
  function getLayout() { return current; }
  /**
   * Map a physical key to its Urdu character for the current layout.
   * @param {string} base - Key ID (e.g., "a", "1", ",").
   * @param {boolean} shift - Whether Shift is held.
   * @returns {string|null} Urdu character, or null if key not mapped.
   */
  function mapKey(base, shift) {
    var def = LAYOUTS[current].keys[base];
    if (!def) return null;
    return (shift && def.s) ? def.s : def.n;
  }
  /**
   * Reverse lookup: find which physical key produces a given Urdu character.
   * WHY needed: Lesson "next-key highlight" — we show the user which physical
   * key to press for the next expected character. Searches normal chars first,
   * then shift chars.
   * @param {string} ch - Urdu character to find.
   * @returns {{key: string, shift: boolean}|null} Key info, or null if not typeable.
   */
  function findKeyFor(ch) {
    var keys = LAYOUTS[current].keys, b;
    for (b in keys) {
      if (keys[b].n === ch) return { key: b, shift: false };
    }
    for (b in keys) {
      if (keys[b].s === ch) return { key: b, shift: true };
    }
    return null;
  }

  /**
   * Insert text at the cursor position in an input/textarea.
   * WHY setRangeText: Preserves cursor position and undo history (vs. naive
   * value concatenation which jumps cursor to end). Falls back gracefully.
   * WHY dispatch input event: Other listeners (WPM counter, validation) need
   * to know the value changed programmatically.
   * @param {HTMLElement} el - Input or textarea element.
   * @param {string} text - Text to insert (usually one Urdu character).
   */
  function insertAtCursor(el, text) {
    if (!el) return;
    try {
      if (typeof el.setRangeText === "function") {
        var s = el.selectionStart == null ? el.value.length : el.selectionStart;
        var e = el.selectionEnd == null ? el.value.length : el.selectionEnd;
        el.setRangeText(text, s, e, "end");
      } else {
        el.value = (el.value || "") + text;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (err) {
      try { el.value = (el.value || "") + text; } catch (e2) {}
    }
  }

  /* ---- Canonical digraph handling (V3 WP-3, KEY-02) ----
   * WHY a pending letter: the canonical map has 14 digraphs (kh, th, bh,
   * …) that a 1:1 physical-key map cannot represent. The keyboard therefore
   * buffers the last Roman letter it inserted: when the next letter
   * completes a canonical digraph, the just-inserted single is replaced in
   * place by the digraph output ("t" then "h" → "تھ").
   * WHY replace-in-place (not delayed insert): every keystroke must still
   * produce an input event immediately, because the lesson/test loop judges
   * from the input value (js/pages/urdu-typing.js reads typeArea.value on
   * "input"). The replacement is guarded: it only fires when the character
   * before the cursor is exactly the pending single, so a moved cursor or
   * an intervening edit can never corrupt text. Shifted keys, digits,
   * punctuation, Space and Backspace clear the pending letter. */
  var pendingRoman = null; // Roman letter of the last inserted single, or null

  function resetPending() { pendingRoman = null; }

  /* Replace the pending single (one char before the cursor) with text.
   * Returns true on success, false when the cursor moved or the text
   * changed since the pending insert (caller then inserts the single). */
  function replaceLastChar(el, text) {
    try {
      var s = el.selectionStart, e = el.selectionEnd;
      if (s == null || s === 0 || s !== e) return false;
      if (el.value.slice(s - 1, s) !== CANON.singles[pendingRoman]) return false;
      if (typeof el.setRangeText === "function") {
        el.setRangeText(text, s - 1, s, "end");
      } else {
        el.value = el.value.slice(0, s - 1) + text + el.value.slice(s);
        try { el.selectionStart = el.selectionEnd = s - 1 + text.length; } catch (e2) {}
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    } catch (err) { return false; }
  }

  /* Insert one unshifted Roman letter through the canonical map, collapsing
   * a canonical digraph when the previous letter completes one. */
  function insertRoman(el, roman) {
    var pair = pendingRoman ? pendingRoman + roman : null;
    if (pair && CANON.digraphs.hasOwnProperty(pair)) {
      if (replaceLastChar(el, CANON.digraphs[pair])) { pendingRoman = null; return; }
      // Cursor moved since the pending insert — fall through, insert single.
    }
    insertAtCursor(el, CANON.singles[roman]);
    pendingRoman = roman;
  }

  /**
   * Convert a KeyboardEvent.code to our key ID format.
   * WHY use .code (not .key): .code is layout-independent ("KeyA" is the same
   * physical key on QWERTY and AZERTY). This ensures consistent mapping.
   * @param {string} code - e.g., "KeyA", "Digit1", "Comma", "Space".
   * @returns {string|null} Key ID ("a", "1", ",") or null if unmapped.
   */
  function codeToBase(code) {
    // "KeyA" -> "a", "Digit1" -> "1", "Comma" -> ",", ...
    if (code.indexOf("Key") === 0) return code.slice(3).toLowerCase();
    if (code.indexOf("Digit") === 0) return code.slice(5);
    var m = { Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[",
              BracketRight: "]", Semicolon: ";", Quote: "'", Comma: ",",
              Period: ".", Slash: "/", Space: " " };
    return m[code] || null;
  }

  /**
   * Keydown handler: transliterate Roman keystrokes to Urdu in real-time.
   * WHY intercept keydown (not keypress): keypress is deprecated. keydown lets
   * us preventDefault() before the character is inserted.
   * WHY skip with modifiers: Ctrl+C, Alt+Tab etc. must work normally.
   * WHY special-case Backspace/Enter/Tab: These are editing/navigation keys,
   * not character keys — let the browser handle them natively.
   * Flow: code→base→(unshifted letter: insertRoman/digraph collapse;
   *   shifted/digit/punct: mapKey)→preventDefault→insertAtCursor→flashKey.
   * @param {KeyboardEvent} e - The keydown event.
   */
  function onKeyDown(e) {
    if (!attachedEl || e.target !== attachedEl) return;
    // WHY skip with modifiers: Ctrl+C, Alt+Tab etc. must work normally.
    // AltGr on Windows arrives as Ctrl+Alt, so it also passes through to
    // the OS layout here (see KEY-09 evaluation for the modifier record).
    if (e.ctrlKey || e.metaKey || e.altKey) { resetPending(); return; }
    var code = e.code || "";
    if (code === "Backspace" || code === "Delete" || code === "Tab" ||
        code === "Enter" || code === "CapsLock" ||
        code.indexOf("Arrow") === 0 || code === "Home" || code === "End" ||
        code === "ShiftLeft" || code === "ShiftRight" || code === "ControlLeft" ||
        code === "ControlRight" || code === "AltLeft" || code === "AltRight" ||
        code === "Escape") {
      resetPending(); // editing/navigation keys invalidate the pending letter
      return; // default behavior
    }
    var base = codeToBase(code);
    if (base === " ") {
      e.preventDefault();
      // Shift+Space = ZWNJ (نیم فاصلہ), used in Urdu e.g. "نہیں"
      resetPending();
      insertAtCursor(attachedEl, e.shiftKey ? "\u200C" : " ");
      flashKey("Space");
      return;
    }
    if (base) {
      if (!e.shiftKey && CANON.singles.hasOwnProperty(base)) {
        // WHY insertRoman, not mapKey: a 1:1 lookup cannot produce the
        // canonical digraphs ("th"→تھ, "kh"→خ). The pending-letter collapse
        // above is the keyboard's digraph path (KEY-02).
        e.preventDefault();
        insertRoman(attachedEl, base);
        flashKey(base);
      } else {
        // Shifted letters, digits and punctuation go through the keys
        // table (shift layer = SHIFT_SUPPLEMENT, digits/punctuation as before).
        var ch = mapKey(base, e.shiftKey);
        if (ch) {
          e.preventDefault();
          resetPending();
          insertAtCursor(attachedEl, ch);
          flashKey(base);
        } else {
          resetPending(); // unmapped key (e.g. "`" in phonetic) -> default behavior
        }
      }
    }
  }

  /**
   * Visually flash the on-screen keyboard key for a pressed physical key.
   * WHY feedback: Confirms to the user which key registered, especially helpful
   * for beginners learning key positions. 150ms flash is noticeable but not distracting.
   * @param {string} base - Key ID to flash.
   */
  function flashKey(base) {
    try {
      var btn = document.querySelector('.ukb-key[data-k="' + base + '"]');
      if (btn) {
        btn.classList.add("hit");
        setTimeout(function () { btn.classList.remove("hit"); }, 140);
      }
    } catch (e) {}
  }

  /**
   * Attach transliteration to an input/textarea element.
   * WHY single attachment: Only one element is "active" at a time. Attaching to
   * a new element automatically detaches from the previous one.
   * @param {HTMLElement} el - Input or textarea to enable Urdu typing on.
   */
  function attach(el) {
    detach();
    if (!el) return;
    attachedEl = el;
    attachedHandler = onKeyDown;
    el.addEventListener("keydown", attachedHandler);
  }
  /**
   * Detach transliteration (remove keydown listener).
   * WHY cleanup: Prevents memory leaks and ensures typing returns to normal
   * when leaving the Urdu typing page.
   */
  function detach() {
    resetPending();
    if (attachedEl && attachedHandler) {
      try { attachedEl.removeEventListener("keydown", attachedHandler); } catch (e) {}
    }
    attachedEl = null;
    attachedHandler = null;
  }

  /* ---------- Visual on-screen keyboard ---------- */
  /**
   * Render the visual on-screen keyboard into a container element.
   * WHY on-screen keyboard: (1) Discoverability — users see the layout without
   * memorizing. (2) Mouse/touch input for those who prefer clicking. (3) Visual
   * reference during lessons.
   * Each key shows: Urdu char (large) + Shift char (small) + English label (tiny).
   * Special keys (Backspace, Shift, etc.) get icon labels.
   * @param {HTMLElement} container - Element to render into (cleared first).
   * @param {object} [opts] - Options: { showLabels: bool, compact: bool }.
   */
  function renderKeyboard(container, opts) {
    opts = opts || {};
    if (!container) return;
    osShift = false;
    var keys = LAYOUTS[current].keys;
    container.innerHTML = "";
    container.className = (container.className || "") + " ukb";
    container.setAttribute("dir", "ltr");

    ROWS.forEach(function (row) {
      var r = document.createElement("div");
      r.className = "ukb-row";
      row.forEach(function (kid) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "ukb-key";
        b.dataset.k = kid;
        var def = keys[kid];
        if (def) {
          var main = document.createElement("span");
          main.className = "ukb-main";
          main.textContent = osShift && def.s ? def.s : def.n;
          b.appendChild(main);
          if (def.s) {
            var sh = document.createElement("span");
            sh.className = "ukb-shift";
            sh.textContent = osShift ? def.n : def.s;
            b.appendChild(sh);
          }
          var en = document.createElement("span");
          en.className = "ukb-en";
          en.textContent = kid.length === 1 ? kid.toUpperCase() : "";
          b.appendChild(en);
          if (kid === " ") b.classList.add("wide-space");
        } else {
          b.classList.add("ukb-fn");
          var lb = document.createElement("span");
          lb.className = "ukb-main ukb-fnlabel";
          lb.textContent = SPECIAL_LABEL[kid] || kid;
          b.appendChild(lb);
          if (kid === "ShiftLeft" || kid === "ShiftRight") b.classList.add("ukb-shiftkey");
          if (kid === "Space") b.classList.add("wide-space");
          if (kid === "Backspace" || kid === "Enter" || kid === "Tab" || kid === "CapsLock")
            b.classList.add("wide");
        }
        b.addEventListener("click", function () {
          handleOsClick(kid, b, opts);
        });
        r.appendChild(b);
      });
      container.appendChild(r);
    });
    if (opts.highlight) highlightKey(opts.highlight.key, opts.highlight.shift);
  }

  /**
   * Handle a click on an on-screen keyboard key.
   * WHY separate from physical: Clicks don't go through keydown transliteration.
   * Handles: character keys (insert mapped char), Shift (toggle osShift state),
   * Backspace (delete char before cursor), Space (insert space or ZWNJ with shift).
   * @param {string} kid - Key ID that was clicked.
   * @param {HTMLElement} btn - The button element (for visual feedback).
   * @param {object} opts - Render options (passed through).
   */
  function handleOsClick(kid, btn, opts) {
    if (kid === "ShiftLeft" || kid === "ShiftRight") {
      osShift = !osShift;
      // re-render labels
      var c = btn.closest(".ukb");
      if (c) renderKeyboard(c, opts);
      return;
    }
    if (kid === "Backspace") {
      resetPending();
      var el = attachedEl;
      if (el) {
        try {
          var s = el.selectionStart, epos = el.selectionEnd;
          if (s === epos && s > 0) el.setRangeText("", s - 1, epos, "end");
          else el.setRangeText("", s, epos, "end");
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.focus();
        } catch (err) {}
      }
      return;
    }
    if (kid === "Tab" || kid === "CapsLock" || kid === "Enter") return;
    if (kid === "Space") {
      resetPending();
      var sp = osShift ? "\u200C" : " ";
      if (opts && typeof opts.onKey === "function") opts.onKey(sp, kid);
      else if (attachedEl) { insertAtCursor(attachedEl, sp); try { attachedEl.focus(); } catch (e) {} }
      flashKey(kid);
      return;
    }
    // WHY digraphs on click too: tapping "t" then "h" must give تھ, the same
    // as typing it (KEY-03 tests both paths). The onKey-callback path has no
    // element to replace in, so it keeps single-character delivery; no
    // in-repo caller uses onKey.
    if (!osShift && CANON.singles.hasOwnProperty(kid) &&
        !(opts && typeof opts.onKey === "function")) {
      if (attachedEl) { insertRoman(attachedEl, kid); try { attachedEl.focus(); } catch (e) {} }
      flashKey(kid);
      return;
    }
    var def = LAYOUTS[current].keys[kid];
    if (!def) return;
    var ch = (osShift && def.s) ? def.s : def.n;
    resetPending();
    if (opts && typeof opts.onKey === "function") opts.onKey(ch, kid);
    else if (attachedEl) { insertAtCursor(attachedEl, ch); try { attachedEl.focus(); } catch (e) {} }
    flashKey(kid);
  }

  /**
   * Highlight the next expected key on the on-screen keyboard (lesson mode).
   * WHY: Guides beginners — they see exactly which physical key to press next.
   * Removes previous highlight first (only one key highlighted at a time).
   * @param {string} key - Key ID to highlight.
   * @param {boolean} shift - Whether Shift is also needed (adds shift indicator).
   */
  function highlightKey(key, shift) {
    try {
      document.querySelectorAll(".ukb-key.next").forEach(function (x) {
        x.classList.remove("next");
      });
      if (!key) return;
      var btn = document.querySelector('.ukb-key[data-k="' + key + '"]');
      if (btn) btn.classList.add("next");
    } catch (e) {}
  }

  window.UrduKB = {
    layouts: LAYOUTS,
    layoutIds: Object.keys(LAYOUTS),
    setLayout: setLayout,
    getLayout: getLayout,
    mapKey: mapKey,
    findKeyFor: findKeyFor,
    attach: attach,
    detach: detach,
    insertAtCursor: insertAtCursor,
    renderKeyboard: renderKeyboard,
    highlightKey: highlightKey,
    ZWNJ: "\u200C"
  };
})();
