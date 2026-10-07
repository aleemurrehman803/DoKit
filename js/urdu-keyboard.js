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
 *      - a→ا, b→ب, p→پ, t→ت, Shift+t→ٹ (retroflex)
 *      - Shift+h→ھ (do-chashmi for بھ پھ تھ etc.)
 *      - Shift+Space→ZWNJ (zero-width non-joiner for نہیں, etc.)
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

  /* ---- Shared letter core (verified: matches XKB pk unshifted letters) ---- */
  var LETTERS = {
    q: { n: "\u0642", s: "\u0652" }, // ق / sukun
    w: { n: "\u0648", s: "\u0651" }, // و / shadda
    e: { n: "\u0639", s: "\u0670" }, // ع / superscript alef
    r: { n: "\u0631", s: "\u0691" }, // ر / ڑ
    t: { n: "\u062A", s: "\u0679" }, // ت / ٹ
    y: { n: "\u06D2", s: "\u064E" }, // ے / fatha
    u: { n: "\u0621", s: "\u0626" }, // ء / ئ
    i: { n: "\u06CC", s: "\u0650" }, // ی / kasra
    o: { n: "\u06C1", s: "\u06C3" }, // ہ / ۃ
    p: { n: "\u067E", s: "\u064F" }, // پ / damma
    a: { n: "\u0627", s: "\u0622" }, // ا / آ
    s: { n: "\u0633", s: "\u0635" }, // س / ص
    d: { n: "\u062F", s: "\u0688" }, // د / ڈ
    f: { n: "\u0641" },              // ف
    g: { n: "\u06AF", s: "\u063A" }, // گ / غ
    h: { n: "\u062D", s: "\u06BE" }, // ح / ھ (do-chashmi he: for بھ پھ تھ...)
    j: { n: "\u062C", s: "\u0636" }, // ج / ض
    k: { n: "\u06A9", s: "\u062E" }, // ک / خ
    l: { n: "\u0644", s: "\u0656" }, // ل / subscript alef
    z: { n: "\u0632", s: "\u0630" }, // ز / ذ
    x: { n: "\u0634", s: "\u0698" }, // ش / ژ
    c: { n: "\u0686", s: "\u062B" }, // چ / ث
    v: { n: "\u0637", s: "\u0638" }, // ط / ظ
    b: { n: "\u0628" },              // ب
    n: { n: "\u0646", s: "\u06BA" }, // ن / ں (noon ghunna)
    m: { n: "\u0645", s: "\u0658" }  // م / noon-ghunna mark
  };

  var URDU_DIGITS = ["\u06F0", "\u06F1", "\u06F2", "\u06F3", "\u06F4",
                     "\u06F5", "\u06F6", "\u06F7", "\u06F8", "\u06F9"]; // ۰۱۲۳۴۵۶۷۸۹
  // US symbols for Shift+number (index = digit 0..9)
  var PHON_SHIFT_SYM = [")", "!", "@", "#", "$", "%", "^", "&", "*", "("];

  /**
   * Build the key mapping table for a layout mode.
   * WHY tutor adaptations: Two deviations from strict XKB for learnability:
   *   1. Shift+o → ؤ (not XKB's rare ۃ) — ؤ appears in common words (گاؤں).
   *   2. Shift+digit → symbols (!@#) not Quranic marks — lessons need ! ؟.
   * Each key maps to { n: normal char, s: shift char }.
   * @param {string} mode - "phonetic" or "standard" (affects -/= keys).
   * @returns {Object<string, {n: string, s: string}>} Key ID → char mapping.
   */
  function buildKeys(mode) {
    var k = {}, l;
    for (l in LETTERS) k[l] = { n: LETTERS[l].n, s: LETTERS[l].s };
    // Tutor adaptation (both layouts): Shift+o = ؤ (hamza on waw — گاؤں، بڑھاؤ).
    // Far more common in Urdu than XKB's ۃ (teh marbuta goal).
    k["o"] = { n: "\u06C1", s: "\u0624" };
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
   * Flow: code→base→mapKey→preventDefault→insertAtCursor→flashKey.
   * @param {KeyboardEvent} e - The keydown event.
   */
  function onKeyDown(e) {
    if (!attachedEl || e.target !== attachedEl) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // allow shortcuts
    var code = e.code || "";
    if (code === "Backspace" || code === "Delete" || code === "Tab" ||
        code === "Enter" || code === "CapsLock" ||
        code.indexOf("Arrow") === 0 || code === "Home" || code === "End" ||
        code === "ShiftLeft" || code === "ShiftRight" || code === "ControlLeft" ||
        code === "ControlRight" || code === "AltLeft" || code === "AltRight" ||
        code === "Escape") {
      return; // default behavior
    }
    var base = codeToBase(code);
    if (base === " ") {
      e.preventDefault();
      // Shift+Space = ZWNJ (نیم فاصلہ), used in Urdu e.g. "نہیں"
      insertAtCursor(attachedEl, e.shiftKey ? "\u200C" : " ");
      flashKey("Space");
      return;
    }
    if (base) {
      var ch = mapKey(base, e.shiftKey);
      if (ch) {
        e.preventDefault();
        insertAtCursor(attachedEl, ch);
        flashKey(base);
      }
      // else: unmapped key (e.g. "`" in phonetic) -> default behavior
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
    var ch;
    if (kid === "Space") ch = osShift ? "\u200C" : " ";
    else {
      var def = LAYOUTS[current].keys[kid];
      if (!def) return;
      ch = (osShift && def.s) ? def.s : def.n;
    }
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
