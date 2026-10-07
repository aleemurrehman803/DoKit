/**
 * DoKit — "Your Journey" Timeline Module
 * ======================================
 * WHAT: Tracks user's tool usage history and displays it as a visual timeline
 *       on the dashboard. Shows what tools were used, when, and what actions
 *       were performed.
 *
 * WHY: Users want to see their activity history ("Your Journey"). This creates
 *      engagement by showing progress and encourages return visits.
 *
 * HOW IT WORKS:
 *   1. Tools call Journey.log(toolName, action, details) after user actions
 *      (e.g., after resizing images, converting text, etc.)
 *   2. Entries saved to localStorage (key: "dokit_journey", max 100, newest first)
 *   3. Best-effort sync to Firestore: users/{uid}/tool_runs (when signed in)
 *   4. Dashboard reads via Journey.get() and renders timeline with icons + relative times
 *
 * DEPENDENCIES:
 *   - window.DKF (Firebase wrapper from js/firebase.js) — optional, for cloud sync
 *   - localStorage — required for local persistence
 *
 * FIRESTORE SCHEMA:
 *   users/{uid}/tool_runs/{autoId}:
 *     - tool: string (e.g., "Image Resizer")
 *     - action: string (e.g., "Resized 5 images")
 *     - details: string (optional extra info)
 *     - ts: Timestamp (server timestamp)
 *
 * SECURITY:
 *   - Never throws — all operations wrapped in try/catch
 *   - Works offline — localStorage is primary, Firestore is best-effort
 *   - No sensitive data stored (only tool names and action descriptions)
 *
 * @module Journey
 */
(function () {
  "use strict";

  /**
   * localStorage key for journey entries.
   * @constant {string}
   */
  var KEY = "dokit_journey";

  /**
   * Maximum entries to keep (prevents unbounded localStorage growth).
   * Oldest entries are discarded when limit exceeded.
   * @constant {number}
   */
  var MAX = 100;

  /**
   * Emoji icons for each tool, displayed in the timeline.
   * Maps tool display names to visual icons for quick recognition.
   * @constant {Object<string, string>}
   */
  var TOOL_ICONS = {
    "Image Resizer": "🖼️",      // Image editing
    "Image Compressor": "🗜️",   // Compression
    "Image Converter": "🔄",     // Format conversion
    "Word Counter": "🔢",        // Text statistics
    "Case Converter": "🔠",      // Text transformation
    "Typing": "⌨️",             // Typing practice
    "TypeFight": "⚔️"           // Typing battles
  };

  /**
   * Read journey entries from localStorage.
   * Returns empty array on any error (corrupt data, storage unavailable).
   *
   * @returns {Array<object>} Array of entry objects, newest first.
   *          Each entry: { tool, action, details, ts }
   */
  function read() {
    try {
      var v = localStorage.getItem(KEY);
      var a = v ? JSON.parse(v) : [];
      // Validate: must be an array, otherwise return empty
      return Array.isArray(a) ? a : [];
    } catch (e) {
      // localStorage unavailable or corrupt JSON — return empty, don't break
      return [];
    }
  }

  /**
   * Write journey entries to localStorage, enforcing MAX limit.
   * Silently fails if storage unavailable (e.g., private mode).
   *
   * @param {Array<object>} a - Entries to save (newest first).
   */
  function write(a) {
    try {
      // Slice to MAX to prevent unbounded growth
      localStorage.setItem(KEY, JSON.stringify(a.slice(0, MAX)));
    } catch (e) {
      // Storage full or unavailable — silently ignore, don't break the tool
    }
  }

  /**
   * Save a journey entry to Firestore (best-effort cloud backup).
   * Only works when user is signed in. Never throws — failures are silent
   * because localStorage already has the data.
   *
   * WHY best-effort: Tools must work offline. Cloud sync is a bonus, not a
   * requirement. The dashboard's cloud-sync.js handles merging on next load.
   *
   * @param {object} entry - The entry to save { tool, action, details, ts }.
   */
  function saveRemote(entry) {
    try {
      // Check Firebase is available
      if (!window.DKF || !DKF.db || !DKF.db()) return;

      // Check user is signed in
      var auth = (DKF.auth && DKF.auth()) || null;
      var user = auth && auth.currentUser;
      if (!user || !user.uid) return;  // Not signed in — local only is fine

      // Write to user's tool_runs subcollection
      DKF.db().collection("users").doc(user.uid).collection("tool_runs").add({
        tool: entry.tool,
        action: entry.action,
        details: entry.details || "",
        // Use server timestamp for consistency across devices
        ts: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function () {
        // Offline or permission error — local copy is enough, don't surface error
      });
    } catch (e) {
      // Never break the tool because cloud sync failed
    }
  }

  /**
   * Log a tool usage event to the journey timeline.
   * This is the main API that tools call after user actions.
   *
   * Example usage in a tool:
   *   if (window.Journey) Journey.log("Image Resizer", "Resized 5 images");
   *
   * @param {string} tool - Display name of the tool (e.g., "Image Resizer").
   *                        Should match a key in TOOL_ICONS for proper icon.
   * @param {string} action - Description of what user did (e.g., "Resized 5 images").
   * @param {string} [details] - Optional extra details.
   * @returns {object} The created entry { tool, action, details, ts }.
   */
  function log(tool, action, details) {
    // Sanitize inputs — ensure strings, prevent type errors
    var entry = {
      tool: String(tool || "Tool"),
      action: String(action || ""),
      details: details == null ? "" : String(details),
      ts: Date.now()  // Client timestamp (server ts used for Firestore)
    };

    // Add to front (newest first), persist locally, sync to cloud
    var a = read();
    a.unshift(entry);  // Prepend — newest at index 0
    write(a);
    saveRemote(entry);

    return entry;
  }

  /**
   * Get all journey entries, newest first.
   * Used by dashboard to render the timeline.
   *
   * @returns {Array<object>} Entries from localStorage.
   */
  function get() { return read(); }

  /**
   * Clear all journey history (local only).
   * Used for "Clear history" feature or testing.
   * Note: Does NOT delete Firestore copies (they're managed separately).
   */
  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  /**
   * Get the emoji icon for a tool name.
   * Falls back to generic toolbox icon for unknown tools.
   *
   * @param {string} tool - Tool display name.
   * @returns {string} Emoji icon character.
   */
  function iconFor(tool) { return TOOL_ICONS[tool] || "🧰"; }

  /**
   * Format a timestamp as human-readable relative time.
   * Examples: "Just now", "5 minutes ago", "2 hours ago", "Yesterday", "3 days ago"
   *
   * WHY relative time: More user-friendly than absolute dates for recent activity.
   * Falls back to locale date string for entries older than a week.
   *
   * @param {number} ts - Unix timestamp in milliseconds.
   * @returns {string} Human-readable relative time, or "" if invalid.
   */
  function relTime(ts) {
    var t = Number(ts) || 0;
    if (!t) return "";  // Invalid timestamp

    var diff = Date.now() - t;
    if (diff < 0) diff = 0;  // Future timestamps (clock skew) → treat as now

    var m = Math.floor(diff / 60000);  // Minutes
    if (m < 1) return "Just now";
    if (m < 60) return m + (m === 1 ? " minute ago" : " minutes ago");

    var h = Math.floor(m / 60);  // Hours
    if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");

    var d = Math.floor(h / 24);  // Days
    if (d === 1) return "Yesterday";
    if (d < 7) return d + " days ago";

    // Older than a week: show absolute date
    try { return new Date(t).toLocaleDateString(); } catch (e) { return ""; }
  }

  /**
   * Public API exported to window.Journey.
   * Tools and dashboard use these methods.
   */
  window.Journey = {
    log: log,           // Log a tool usage event
    get: get,           // Get all entries (newest first)
    clear: clear,       // Clear local history
    iconFor: iconFor,   // Get icon for tool name
    relTime: relTime     // Format timestamp as relative time
  };
})();
