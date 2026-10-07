/* DoKit — Shared utilities (DKUtils).
 *
 * PURPOSE:
 *   Single source of truth for small helpers that were copy-pasted across
 *   many page scripts (esc, relTime, fmtDate, ...). New code should use
 *   DKUtils.* instead of redefining these locally.
 *
 * USAGE:
 *   <script src="js/dk-utils.js" defer></script>  (before page scripts)
 *   DKUtils.esc(userInput)
 *
 * BACKWARD COMPATIBILITY:
 *   Older files keep their local copies as fallback:
 *     var esc = (window.DKUtils && DKUtils.esc) || function (s) { ... };
 *   so pages work even if this file fails to load.
 *
 * DEPENDENCIES: none (vanilla JS, no Firebase).
 */
(function () {
  "use strict";

  /**
   * Escape a value for safe insertion into HTML.
   * Prevents XSS when rendering user-controlled strings via innerHTML.
   * @param {*} s - Any value (null/undefined become "").
   * @returns {string} HTML-escaped string.
   */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /**
   * Human-readable relative time ("2 hours ago", "Yesterday").
   * @param {number} ts - Millisecond timestamp.
   * @returns {string} Relative time string.
   */
  function relTime(ts) {
    try {
      var diff = Date.now() - (Number(ts) || 0);
      if (diff < 0) diff = 0;
      var m = Math.floor(diff / 60000);
      if (m < 1) return "Just now";
      if (m < 60) return m + " minute" + (m === 1 ? "" : "s") + " ago";
      var h = Math.floor(m / 60);
      if (h < 24) return h + " hour" + (h === 1 ? "" : "s") + " ago";
      var d = Math.floor(h / 24);
      if (d === 1) return "Yesterday";
      if (d < 30) return d + " days ago";
      return fmtDate(ts);
    } catch (e) {
      return "";
    }
  }

  /**
   * Format a timestamp as a locale date-time string.
   * @param {number} ts - Millisecond timestamp.
   * @returns {string} Localized date-time, or "—" on failure.
   */
  function fmtDate(ts) {
    try {
      return new Date(Number(ts)).toLocaleString();
    } catch (e) {
      return "—";
    }
  }

  /**
   * Format a date only (no time).
   * @param {number} ts - Millisecond timestamp.
   * @returns {string} Localized date, or "—" on failure.
   */
  function fmtDateOnly(ts) {
    try {
      return new Date(Number(ts)).toLocaleDateString();
    } catch (e) {
      return "—";
    }
  }

  /**
   * Clamp a number into [min, max].
   * @param {number} n - Value.
   * @param {number} min - Lower bound.
   * @param {number} max - Upper bound.
   * @returns {number} Clamped value.
   */
  function clamp(n, min, max) {
    n = Number(n);
    if (isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  /**
   * Debounce a function (run at most once per wait ms).
   * @param {Function} fn - Function to debounce.
   * @param {number} wait - Milliseconds to wait.
   * @returns {Function} Debounced function.
   */
  function debounce(fn, wait) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, wait || 300);
    };
  }

  window.DKUtils = {
    esc: esc,
    relTime: relTime,
    fmtDate: fmtDate,
    fmtDateOnly: fmtDateOnly,
    clamp: clamp,
    debounce: debounce
  };
})();
