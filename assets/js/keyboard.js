/* DoKit — on-screen finger keyboard (restored from the old typing tool).
 * NEW file: phase2/assets/js/keyboard.js — load it on lesson, practice
 * and test pages (see README for the <script> tags). Classic script,
 * var only, no modules, no CDN. Styling lives in keyboard.css (merged
 * into assets/css/style.css); this file only builds DOM.
 * INTEGRATION NOTE (item 55): the deliverable used plain-English key
 * labels and finger names with no i18n dependency. This integrated copy
 * translates them through window.dkT (guarded ternary, same pattern as
 * the other tools) because the site gate requires zero untranslated
 * visible words; English is the fallback when dkT is absent. Key
 * VALUES (for matching) never change — only displayed labels. The
 * keyboard re-renders on 'dokit:langchange' (same pattern as main.js
 * widgets) so switching language updates labels without a reload.
 * This file is HAND-MAINTAINED: the generator never writes it.
 *
 * Port of old typing/js/keyboard.js, with two changes:
 *  - Old code depended on a global UI.strings for finger names; this
 *    version uses plain English finger names (no i18n dependency).
 *  - Old code exposed a global `Keyboard`; this version exposes
 *    window.DKKeyboard so it cannot collide with any other script.
 * Behaviour kept: full QWERTY rows, finger-zone classes
 * (f-lpinky … f-rpinky, f-thumb), key highlight following the current
 * character, and a short press flash for the key just typed. */
(function () {
  'use strict';

  /* Rows: [label, value, finger zone, wide?]. Wide keys span extra
   * columns in CSS (Backspace/Tab/Caps/Enter/Shift); Space spans most. */
  var ROWS = [
    [['`', '`', 'lpinky'], ['1', '1', 'lpinky'], ['2', '2', 'lring'],
     ['3', '3', 'lmiddle'], ['4', '4', 'lindex'], ['5', '5', 'lindex'],
     ['6', '6', 'rindex'], ['7', '7', 'rindex'], ['8', '8', 'rmiddle'],
     ['9', '9', 'rring'], ['0', '0', 'rpinky'], ['-', '-', 'rpinky'],
     ['=', '=', 'rpinky'], ['Backspace', 'Backspace', 'rpinky', 1]],
    [['Tab', 'Tab', 'lpinky', 1], ['q', 'q', 'lpinky'], ['w', 'w', 'lring'],
     ['e', 'e', 'lmiddle'], ['r', 'r', 'lindex'], ['t', 't', 'lindex'],
     ['y', 'y', 'rindex'], ['u', 'u', 'rindex'], ['i', 'i', 'rmiddle'],
     ['o', 'o', 'rring'], ['p', 'p', 'rpinky'], ['[', '[', 'rpinky'],
     [']', ']', 'rpinky']],
    [['Caps', 'CapsLock', 'lpinky', 1], ['a', 'a', 'lpinky'],
     ['s', 's', 'lring'], ['d', 'd', 'lmiddle'], ['f', 'f', 'lindex'],
     ['g', 'g', 'lindex'], ['h', 'h', 'rindex'], ['j', 'j', 'rindex'],
     ['k', 'k', 'rmiddle'], ['l', 'l', 'rring'], [';', ';', 'rpinky'],
     ["'", "'", 'rpinky'], ['Enter', 'Enter', 'rpinky', 1]],
    [['Shift', 'Shift', 'lpinky', 1], ['z', 'z', 'lpinky'],
     ['x', 'x', 'lring'], ['c', 'c', 'lmiddle'], ['v', 'v', 'lindex'],
     ['b', 'b', 'lindex'], ['n', 'n', 'rindex'], ['m', 'm', 'rindex'],
     [',', ',', 'rmiddle'], ['.', '.', 'rring'], ['/', '/', 'rpinky'],
     ['Shift', 'Shift', 'rpinky', 1]],
    [['Space', ' ', 'thumb', 2]]
  ];
  /* Plain-English finger names for the hint line (old code read these
   * from UI.strings; the names themselves are unchanged). */
  var FINGER_NAMES = {
    lpinky: 'left pinky', lring: 'left ring', lmiddle: 'left middle',
    lindex: 'left index', rindex: 'right index', rmiddle: 'right middle',
    rring: 'right ring', rpinky: 'right pinky', thumb: 'thumb'
  };
  /* i18n keys for displayed key labels (values stay English for matching)
   * and for finger phrases used in the hint line. */
  var LABEL_KEYS = {
    'Backspace': 'rsv_1281', 'Tab': 'rsv_1282', 'Caps': 'rsv_1283',
    'Enter': 'rsv_1284', 'Shift': 'rsv_1285', 'Space': 'rsv_1286'
  };
  var FINGER_KEYS = {
    lpinky: 'rsv_1288', lring: 'rsv_1289', lmiddle: 'rsv_1290',
    lindex: 'rsv_1291', rindex: 'rsv_1292', rmiddle: 'rsv_1293',
    rring: 'rsv_1294', rpinky: 'rsv_1295', thumb: 'rsv_1296'
  };

  var keyEls = {}; /* lowercased value -> key element (first wins) */
  var hintEl = null;

  /* Build the keyboard into container; hint (optional) shows which
   * finger presses the highlighted key. Re-rendering clears old keys. */
  function render(container, hint) {
    if (!container) { return; }
    container.innerHTML = '';
    container.className = 'kb';
    keyEls = {};
    hintEl = hint || null;
    ROWS.forEach(function (row) {
      var rowEl = document.createElement('div');
      rowEl.className = 'kb-row';
      row.forEach(function (key) {
        var el = document.createElement('div');
        el.className = 'key f-' + key[2] + (key[3] ? ' wide' : '')
          + (key[1] === ' ' ? ' space' : '');
        el.textContent = LABEL_KEYS[key[0]]
          ? (window.dkT ? window.dkT(LABEL_KEYS[key[0]], key[0]) : key[0])
          : key[0];
        el.dataset.val = key[1].toLowerCase();
        rowEl.appendChild(el);
        if (!keyEls[el.dataset.val]) { keyEls[el.dataset.val] = el; }
      });
      container.appendChild(rowEl);
    });
  }
  /* Normalise a character to a key value: newline -> Enter, everything
   * else lowercased (the old tool used the same mapping). */
  function keyFor(ch) {
    if (ch === '\n') { return 'enter'; }
    return (ch || '').toLowerCase();
  }
  /* Highlight the key for the CURRENT character (the one the learner
   * must type next). Pass null/'' to clear. Also updates the hint. */
  function highlight(ch) {
    Object.keys(keyEls).forEach(function (k) {
      keyEls[k].classList.remove('next');
    });
    if (!ch) { if (hintEl) { hintEl.textContent = ''; } return; }
    var el = keyEls[keyFor(ch)];
    if (el) {
      el.classList.add('next');
      if (hintEl) {
        var zone = (el.className.match(/f-(\w+)/) || [])[1];
        var shown = ch === ' ' ? (window.dkT ? window.dkT('rsv_1286', 'Space') : 'Space')
          : ch === '\n' ? (window.dkT ? window.dkT('rsv_1284', 'Enter') : 'Enter') : ch;
        var finger = (window.dkT && FINGER_KEYS[zone])
          ? window.dkT(FINGER_KEYS[zone], FINGER_NAMES[zone] || zone)
          : (FINGER_NAMES[zone] || zone);
        var tmpl = window.dkT ? window.dkT('rsv_1287', 'Press "{k}" with your {f}.')
          : 'Press "{k}" with your {f}.';
        hintEl.textContent = tmpl.replace('{k}', shown).replace('{f}', finger);
      }
    } else if (hintEl) {
      hintEl.textContent = '';
    }
  }
  /* Brief flash on the key just pressed (120 ms, as in the old tool). */
  function pressFlash(ch) {
    var el = keyEls[keyFor(ch)];
    if (!el) { return; }
    el.classList.add('pressed');
    setTimeout(function () { el.classList.remove('pressed'); }, 120);
  }
  /* Wire an input + passage pair: as the learner types, flash the key
   * pressed and highlight the next character. The passage element's
   * text is the reference text (lessons.js renders it as spans, so
   * textContent is exactly the passage). Backspace/edits are ignored
   * for highlighting — only the next untyped character is highlighted.
   * Safe to call on pages where the engine already listens to the same
   * input: this adds a second, read-only listener and never writes. */
  function bindInput(inputEl, passageEl) {
    if (!inputEl || !passageEl) { return; }
    function sync() {
      var typed = inputEl.value || '';
      var passage = passageEl.textContent || '';
      highlight(passage.charAt(typed.length) || null);
      if (typed.length) { pressFlash(typed.charAt(typed.length - 1)); }
    }
    inputEl.addEventListener('input', sync);
    sync(); /* highlight the first character immediately */
  }

  window.DKKeyboard = {
    render: render, highlight: highlight, pressFlash: pressFlash,
    bindInput: bindInput
  };

  /* Auto-wire the pages this file is loaded on. Each page uses its own
   * container ids (see typing-additions-controls.html); pages without
   * those elements are simply skipped. */
  var pairs = [
    ['ls-kb', 'ls-hint', 'ls-input', 'ls-passage'],
    ['pr-kb', 'pr-hint', 'pr-input', 'pr-passage'],
    ['ty-kb', 'ty-hint', 'ty-input', 'ty-passage']
  ];
  var wired = [];
  pairs.forEach(function (p) {
    var box = document.getElementById(p[0]);
    if (box) {
      var hint = document.getElementById(p[1]);
      var input = document.getElementById(p[2]);
      var passage = document.getElementById(p[3]);
      render(box, hint);
      bindInput(input, passage);
      wired.push({ box: box, hint: hint, input: input, passage: passage });
    }
  });
  /* Language switch re-renders labels + hint without a reload (the i18n
   * engine only re-applies static [data-i18n] nodes itself). Re-render
   * rebuilds keyEls, so re-apply the current highlight afterwards.
   * ALSO called once when the async i18n engine arrives (main.js loader
   * calls window.syncKeyboards): keyboard.js runs before the dict +
   * engine finish loading, so the first render falls back to English
   * and must be re-synced — same pattern as the hero H1 sync. */
  function resync() {
    wired.forEach(function (w) {
      render(w.box, w.hint);
      if (w.input && w.passage) {
        var typed = w.input.value || '';
        var passage = w.passage.textContent || '';
        highlight(passage.charAt(typed.length) || null);
      }
    });
  }
  document.addEventListener('dokit:langchange', resync);
  window.syncKeyboards = resync;
})();
