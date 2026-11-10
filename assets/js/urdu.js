/* DoKit — Urdu typing (Phase 2b).
 * Three honest pieces, no backend: (1) a Roman-to-Urdu converter using
 * the shared canonical map (window.DKUrduMap — digraphs win over single
 * letters; map lives in assets/js/urdu-canonical-map.js, KEY-02),
 * (2) an on-screen Urdu keyboard that inserts letters into the
 * practice box, (3) Urdu practice passages with per-character feedback
 * via the shared DKType engine (lessons.js) — not a second copy. */
(function () {
  'use strict';
  // Canonical Roman→Urdu map (V3 WP-3, KEY-02, decision D-3): the map lives
  // in ONE place, assets/js/urdu-canonical-map.js (window.DKUrduMap). This
  // file keeps NO private copy of the map — it reads the shared table, so
  // the converter and the live keyboard (js/urdu-keyboard.js) can never
  // drift apart again (C3). The map script must load before this file
  // (see typing/urdu/index.html script order).
  var ROWS = ["ا ب پ ت ٹ ث ج چ ح خ د ڈ ذ ر ڑ ز ژ س ش ص ض", "ط ظ ع غ ف ق ک گ ل م ن و ہ ھ ی ے"];
  var PRACTICE = ["میرا نام علی ہے۔", "میں روزانہ اردو ٹائپنگ کی مشق کرتا ہوں۔", "محنت کامیابی کی کنجی ہے۔"];

  // Convert Roman text to Urdu through the shared canonical map (the
  // digraph-preferring scan lives in urdu-canonical-map.js, one copy).
  var mapWarned = false;
  function convertRoman(text) {
    if (window.DKUrduMap && typeof window.DKUrduMap.convertRoman === 'function') {
      return window.DKUrduMap.convertRoman(text);
    }
    // WHY fail visible, not silent: without the map there is no correct
    // conversion, and inventing one here would re-create the C3 conflict.
    // Return the input unchanged and warn once (per page load).
    if (!mapWarned) {
      mapWarned = true;
      if (typeof console !== 'undefined' && console.error) {
        console.error('DKUrduMap missing — load assets/js/urdu-canonical-map.js before assets/js/urdu.js');
      }
    }
    return text;
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
        // F25 fix (rec 25, live pass 9 Nov 2026): the old handler set
        // "Copied!" on the button unconditionally — even when the
        // clipboard write failed or the API was missing (false success,
        // same class as the F25 account.js fix). The label now changes
        // only after the write resolves; a failed write shows an honest
        // failure note instead. Failure text is English-only (no dict
        // key exists for a copy failure; dict-sync follow-up).
        var text = outEl.textContent;
        if (!text) { return; }
        function done() {
          if (window.dkToast) { window.dkToast(window.dkT ? window.dkT('rsv_0966', 'Copied!') : 'Copied!'); }
          copyBtn.textContent = (window.dkT ? window.dkT('rsv_0966', 'Copied!') : 'Copied!');
          setTimeout(function () { copyBtn.textContent = (window.dkT ? window.dkT('rsv_0189', 'Copy Urdu text') : 'Copy Urdu text'); }, 1500);
        }
        function fail() {
          if (window.dkToast) { window.dkToast('Copy failed — please select the text and copy it manually.'); }
        }
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(fail);
          } else { fail(); }
        } catch (e) { fail(); }
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
      // WP-4 TYPE-02: Urdu is the scoring language here (Segmenter
      // locale 'ur'); the engine scores grapheme-aware from v2.
      language: 'ur',
      onFinish: function (st) {
        // WP-4 TYPE-02: v2 tags (paper §4) on the saved result.
        if (window.DK2) {
          window.DK2.saveResult({ type: 'urdu', wpm: st.wpm, acc: st.acc,
            graphemes: st.typed, verified: st.verified,
            metricVersion: st.metricVersion, graphemeVersion: st.graphemeVersion,
            sessionId: st.sessionId, contentId: st.contentId,
            mode: 'practice', language: 'ur' });
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
        var ui = parseInt(urSelect.value, 10);
        urEngine.load(PRACTICE[ui], 'urdu-practice:' + (ui + 1));
      });
    }
    urEngine.load(PRACTICE[0], 'urdu-practice:1');
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
