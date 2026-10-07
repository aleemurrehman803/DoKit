/* DoKit — "Your Journey" timeline.
   Logs tool usage to localStorage (key: dokit_journey, max 100 entries, newest first)
   and best-effort to Firestore users/{uid}/tool_runs when signed in.
   Safe offline / signed-out: never throws. */
(function () {
  "use strict";

  var KEY = "dokit_journey";
  var MAX = 100;

  var TOOL_ICONS = {
    "Image Resizer": "🖼️",
    "Image Compressor": "🗜️",
    "Image Converter": "🔄",
    "Word Counter": "🔢",
    "Case Converter": "🔠",
    "Typing": "⌨️",
    "TypeFight": "⚔️"
  };

  function read() {
    try {
      var v = localStorage.getItem(KEY);
      var a = v ? JSON.parse(v) : [];
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }

  function write(a) {
    try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, MAX))); } catch (e) {}
  }

  function saveRemote(entry) {
    try {
      if (!window.DKF || !DKF.db || !DKF.db()) return;
      var auth = (DKF.auth && DKF.auth()) || null;
      var user = auth && auth.currentUser;
      if (!user || !user.uid) return;
      DKF.db().collection("users").doc(user.uid).collection("tool_runs").add({
        tool: entry.tool,
        action: entry.action,
        details: entry.details || "",
        ts: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function () { /* offline: local copy is enough */ });
    } catch (e) { /* never break the tool */ }
  }

  function log(tool, action, details) {
    var entry = {
      tool: String(tool || "Tool"),
      action: String(action || ""),
      details: details == null ? "" : String(details),
      ts: Date.now()
    };
    var a = read();
    a.unshift(entry);
    write(a);
    saveRemote(entry);
    return entry;
  }

  function get() { return read(); }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  function iconFor(tool) { return TOOL_ICONS[tool] || "🧰"; }

  function relTime(ts) {
    var t = Number(ts) || 0;
    if (!t) return "";
    var diff = Date.now() - t;
    if (diff < 0) diff = 0;
    var m = Math.floor(diff / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return m + (m === 1 ? " minute ago" : " minutes ago");
    var h = Math.floor(m / 60);
    if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
    var d = Math.floor(h / 24);
    if (d === 1) return "Yesterday";
    if (d < 7) return d + " days ago";
    try { return new Date(t).toLocaleDateString(); } catch (e) { return ""; }
  }

  window.Journey = {
    log: log,
    get: get,
    clear: clear,
    iconFor: iconFor,
    relTime: relTime
  };
})();
