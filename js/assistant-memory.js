/* DoKit — Chat Memory.
   Remembers conversation history per user (localStorage).
   Tracks: what they asked, what tools they use, common mistakes.
   Used to personalize AI responses.
*/
(function () {
  "use strict";

  var KEY = "dokit_chat_memory";
  var MAX_HISTORY = 20; // last 20 exchanges

  function read() {
    try {
      var v = localStorage.getItem(KEY);
      var d = v ? JSON.parse(v) : null;
      return d && typeof d === "object" ? d : { history: [], patterns: {} };
    } catch (e) {
      return { history: [], patterns: {} };
    }
  }

  function write(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
  }

  // Log a conversation exchange
  function logExchange(userMsg, aiReply, toolMentioned) {
    var d = read();
    d.history.push({
      user: (userMsg || "").substring(0, 200),
      ai: (aiReply || "").substring(0, 200),
      tool: toolMentioned || null,
      ts: Date.now()
    });
    // Keep only last MAX_HISTORY
    if (d.history.length > MAX_HISTORY) {
      d.history = d.history.slice(-MAX_HISTORY);
    }
    // Track patterns
    if (toolMentioned) {
      d.patterns[toolMentioned] = (d.patterns[toolMentioned] || 0) + 1;
    }
    write(d);
  }

  // Get recent history as context string for AI prompt
  function getContext(maxExchanges) {
    var d = read();
    var n = maxExchanges || 5;
    var recent = d.history.slice(-n);
    if (!recent.length) return "";
    return recent.map(function (h) {
      return "User: " + h.user + "\nAssistant: " + h.ai;
    }).join("\n");
  }

  // Get user's most-used tools
  function getTopTools(limit) {
    var d = read();
    var tools = Object.keys(d.patterns).map(function (k) {
      return { tool: k, count: d.patterns[k] };
    });
    tools.sort(function (a, b) { return b.count - a.count; });
    return tools.slice(0, limit || 3);
  }

  // Clear memory
  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  window.DKMemory = {
    log: logExchange,
    getContext: getContext,
    getTopTools: getTopTools,
    clear: clear
  };
})();
