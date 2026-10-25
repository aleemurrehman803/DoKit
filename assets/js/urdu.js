/* DoKit — Urdu typing (Phase 2b).
 * Three honest pieces, no backend: (1) a Roman-to-Urdu converter using
 * the standard phonetic layout (digraphs win over single letters),
 * (2) an on-screen Urdu keyboard that inserts letters into the
 * practice box, (3) Urdu practice passages with per-character feedback
 * via the shared DKType engine (lessons.js) — not a second copy. */
(function () {
  'use strict';
  var DIGRAPHS = {"kh": "خ", "gh": "غ", "ch": "چ", "sh": "ش", "zh": "ژ", "aa": "آ", "ee": "ی", "oo": "و", "dh": "دھ", "bh": "بھ", "ph": "پھ", "jh": "جھ", "th": "تھ", "rh": "ڑھ"};
  var SINGLES = {"a": "ا", "b": "ب", "c": "چ", "d": "د", "e": "ع", "f": "ف", "g": "گ", "h": "ھ", "i": "ی", "j": "ج", "k": "ک", "l": "ل", "m": "م", "n": "ن", "o": "ہ", "p": "پ", "q": "ق", "r": "ر", "s": "س", "t": "ت", "u": "ء", "v": "ٹ", "w": "و", "x": "ش", "y": "ے", "z": "ز"};
  var ROWS = ["ا ب پ ت ٹ ث ج چ ح خ د ڈ ذ ر ڑ ز ژ س ش ص ض", "ط ظ ع غ ف ق ک گ ل م ن و ہ ھ ی ے"];
  var PRACTICE = ["میرا نام علی ہے۔", "میں روزانہ اردو ٹائپنگ کی مشق کرتا ہوں۔", "محنت کامیابی کی کنجی ہے۔"];

  // Convert Roman text to Urdu: scan left to right, preferring the
  // 2-letter digraph at each position, else the single-letter map.
  // Unknown characters (digits, punctuation, spaces) pass through.
  function convertRoman(text) {
    var out = '', i = 0;
    while (i < text.length) {
      var two = text.slice(i, i + 2).toLowerCase();
      if (DIGRAPHS.hasOwnProperty(two)) { out += DIGRAPHS[two]; i += 2; }
      else {
        var one = text[i].toLowerCase();
        out += SINGLES.hasOwnProperty(one) ? SINGLES[one] : text[i];
        i += 1;
      }
    }
    return out;
  }

  // -- Converter -------------------------------------------------------------
  var romanEl = document.getElementById('ur-roman');
  if (romanEl) {
    var outEl = document.getElementById('ur-output');
    var copyBtn = document.getElementById('ur-copy');
    romanEl.addEventListener('input', function () {
      outEl.textContent = convertRoman(romanEl.value);
    });
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var text = outEl.textContent;
        if (!text) { return; }
        if (navigator.clipboard) { navigator.clipboard.writeText(text); }
        copyBtn.textContent = (window.dkT ? window.dkT('rsv_0966', 'Copied!') : 'Copied!');
        setTimeout(function () { copyBtn.textContent = (window.dkT ? window.dkT('rsv_0189', 'Copy Urdu text') : 'Copy Urdu text'); }, 1500);
      });
    }
  }

  // -- On-screen keyboard + practice -----------------------------------------
  // Keyboard buttons insert into the practice input and fire an input
  // event, so the shared engine sees exactly what a real keypress would.
  var kbEl = document.getElementById('ur-kb');
  var prInput = document.getElementById('ur-input');
  if (kbEl && prInput) {
    ROWS.forEach(function (row) {
      var rowEl = document.createElement('div');
      rowEl.className = 'kb-row';
      row.split(' ').forEach(function (ch) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'key'; b.textContent = ch;
        b.addEventListener('click', function () {
          prInput.value += ch;
          prInput.dispatchEvent(new Event('input', { bubbles: true }));
          prInput.focus();
        });
        rowEl.appendChild(b);
      });
      kbEl.appendChild(rowEl);
    });
    var backBtn = document.getElementById('ur-back');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        prInput.value = prInput.value.slice(0, -1);
        prInput.dispatchEvent(new Event('input', { bubbles: true }));
        prInput.focus();
      });
    }
  }
  // Practice passages use the shared engine (DKType from lessons.js).
  var urPassage = document.getElementById('ur-passage');
  if (urPassage && window.DKType) {
    var urEngine = window.DKType.createEngine({
      passageEl: urPassage,
      inputEl: document.getElementById('ur-input'),
      wpmEl: document.getElementById('ur-wpm'),
      accEl: document.getElementById('ur-acc'),
      resultEl: document.getElementById('ur-result'),
      onFinish: function (st) {
        if (window.DK2) {
          window.DK2.saveResult({ type: 'urdu', wpm: st.wpm, acc: st.acc });
        }
      }
    });
    var urSelect = document.getElementById('ur-select');
    if (urSelect) {
      PRACTICE.forEach(function (p, i) {
        var o = document.createElement('option');
        o.value = i; o.textContent = (window.dkT ? window.dkT('rsv_0991', 'Passage ') : 'Passage ') + (i + 1);
        urSelect.appendChild(o);
      });
      urSelect.addEventListener('change', function () {
        urEngine.load(PRACTICE[parseInt(urSelect.value, 10)]);
      });
    }
    urEngine.load(PRACTICE[0]);
  }
  // Restore: Urdu page tabs (Converter / Lessons / Test) — plain
  // visibility switching, no data. The EN/UR toggle beside the tabs
  // switches between the English typing hub and this Urdu page.
  (function urTabs(){
    var bar = document.getElementById('ur-tabs'); if (!bar) { return; }
    var btns = bar.querySelectorAll('[data-urtab]');
    function show(id) {
      document.querySelectorAll('[data-urpanel]').forEach(function (el) {
        el.hidden = (el.getAttribute('data-urpanel') !== id);
      });
      btns.forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-urtab') === id);
      });
    }
    btns.forEach(function (b) {
      b.addEventListener('click', function () { show(b.getAttribute('data-urtab')); });
    });
    show('converter');
  })();
})();
