/* DoKit — Canonical Roman→Urdu map (V3 WP-3, KEY-01/KEY-02, decision D-3).
 *
 * WHY one file: the converter (assets/js/urdu.js) and the live keyboard
 * (js/urdu-keyboard.js) used to carry two conflicting Roman→Urdu maps
 * (audit W2 C3): h→ھ vs ح, v→ٹ vs ط, and the keyboard had no digraphs at
 * all, so typing "th" gave تھ from the converter but تح from the keyboard.
 * This file is now the SINGLE authority for Roman→Urdu transliteration.
 * Both surfaces read it; no other file may define a Roman→Urdu map.
 * A second map definition anywhere is a defect (grep for DIGRAPHS/SINGLES
 * must find only this file).
 *
 * WHAT (data, not behaviour): DIGRAPHS (14) + SINGLES (26), verbatim the
 * verified converter set (assets/js/urdu.js:9-10 at 26f380b, re-verified by
 * implementation/scripts/wp3_key01_verify.js at phase-v3-impl @ 324f0e5).
 * The scan rule is digraph-preferring, left-to-right; unknown characters
 * pass through unchanged. convertRoman() is the one implementation of that
 * rule; the keyboard's incremental path consults the same tables.
 *
 * WHO reads it: assets/js/urdu.js (converter) and js/urdu-keyboard.js
 * (UrduKB). LOAD ORDER: this file must load BEFORE both consumers —
 * typing/urdu/index.html loads it before assets/js/urdu.js, and
 * typing/urdu.html loads it before js/urdu-keyboard.js. If it is missing,
 * both consumers fail visible (console error, input unchanged / inert
 * keyboard) rather than silently inventing a map.
 *
 * No i18n keys, no Firebase, no network. Version 1.
 */
(function () {
  'use strict';
  var DIGRAPHS = {"kh": "خ", "gh": "غ", "ch": "چ", "sh": "ش", "zh": "ژ", "aa": "آ", "ee": "ی", "oo": "و", "dh": "دھ", "bh": "بھ", "ph": "پھ", "jh": "جھ", "th": "تھ", "rh": "ڑھ"};
  var SINGLES = {"a": "ا", "b": "ب", "c": "چ", "d": "د", "e": "ع", "f": "ف", "g": "گ", "h": "ھ", "i": "ی", "j": "ج", "k": "ک", "l": "ل", "m": "م", "n": "ن", "o": "ہ", "p": "پ", "q": "ق", "r": "ر", "s": "س", "t": "ت", "u": "ء", "v": "ٹ", "w": "و", "x": "ش", "y": "ے", "z": "ز"};

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

  window.DKUrduMap = {
    version: 1,
    digraphs: DIGRAPHS,
    singles: SINGLES,
    convertRoman: convertRoman
  };
})();
