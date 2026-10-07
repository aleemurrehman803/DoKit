/**
 * DoKit — Assistant Chat Memory Module
 * =====================================
 * WHAT: Remembers conversation history between user and Doki assistant.
 *       Stores recent exchanges in localStorage for context-aware responses.
 *
 * WHY: Without memory, each question is isolated. With memory, Doki can:
 *      - Reference previous questions ("as I mentioned about resizing...")
 *      - Track user interests (which tools they ask about most)
 *      - Provide personalized suggestions based on history
 *
 * HOW IT WORKS:
 *   1. After each AI response, DKMemory.log(userMsg, aiReply, toolMentioned)
 *   2. History kept in localStorage (key: "dokit_chat_memory", max 20 exchanges)
 *   3. Patterns tracked: { toolName: count } for most-asked tools
 *   4. AI prompt includes recent context via DKMemory.getContext(n)
 *
 * PRIVACY:
 *   - All data stays in user's browser (localStorage only, never sent to server)
 *   - User can clear via DKMemory.clear()
 *   - Messages truncated to 200 chars (prevents storage bloat)
 *
 * @module DKMemory
 */
(function () {
  "use strict";

  var KEY = "dokit_chat_memory";
  var MAX_HISTORY = 20; // last 20 exchanges

  /**
   * Read the full memory object from localStorage.
   * WHY this shape: { history: [...], patterns: {...} } keeps conversation log
   * separate from aggregated stats. Corrupt/missing data returns a clean default
   * so the assistant never breaks.
   * @returns {{history: Array, patterns: Object}} Memory object (never null).
   */
  function read() {
    try {
      var v = localStorage.getItem(KEY);
      var d = v ? JSON.parse(v) : null;
      return d && typeof d === "object" ? d : { history: [], patterns: {} };
    } catch (e) {
      return { history: [], patterns: {} };
    }
  }

  /**
   * Persist the memory object to localStorage.
   * WHY silent fail: Memory is a nice-to-have. If storage is unavailable
   * (private mode, quota), the assistant still works — just without memory.
   * @param {{history: Array, patterns: Object}} d - Memory object to save.
   */
  function write(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
  }

  /**
   * Log one user↔assistant exchange to memory.
   * WHY truncate to 200 chars: Prevents a single long message from bloating
   * storage. 200 chars is enough for context; full text isn't needed.
   * WHY track patterns: Knowing which tools the user asks about most lets Doki
   * personalize suggestions ("You often ask about resizing...").
   * Called by assistant-ai.js after every AI response.
   * @param {string} userMsg - What the user asked.
   * @param {string} aiReply - What the assistant answered.
   * @param {string|null} [toolMentioned] - Tool name if the exchange was about a specific tool.
   */
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

  /**
   * Build a prompt-ready context string from recent exchanges.
   * WHY this format: "User: ...\nAssistant: ..." mirrors chat transcript format
   * that LLMs are trained on, so the model naturally continues the conversation.
   * WHY default 5: Balances context usefulness vs token cost. More history =
   * more tokens per API call. 5 exchanges is the sweet spot.
   * @param {number} [maxExchanges=5] - How many recent exchanges to include.
   * @returns {string} Formatted transcript, or "" if no history.
   * @example
   *   DKMemory.getContext(2);
   *   // "User: how do I resize?\nAssistant: Use Image Resizer...\nUser: what sizes?\nAssistant: ..."
   */
  function getContext(maxExchanges) {
    var d = read();
    var n = maxExchanges || 5;
    var recent = d.history.slice(-n);
    if (!recent.length) return "";
    return recent.map(function (h) {
      return "User: " + h.user + "\nAssistant: " + h.ai;
    }).join("\n");
  }

  /**
   * Get the user's most-discussed tools, ranked by frequency.
   * WHY: Powers personalized UI — e.g., dashboard can highlight "Your favorite
   * tools" or Doki can suggest "Want tips for Image Resizer? You ask about it a lot."
   * @param {number} [limit=3] - Max tools to return.
   * @returns {Array<{tool: string, count: number}>} Sorted descending by count.
   */
  function getTopTools(limit) {
    var d = read();
    var tools = Object.keys(d.patterns).map(function (k) {
      return { tool: k, count: d.patterns[k] };
    });
    tools.sort(function (a, b) { return b.count - a.count; });
    return tools.slice(0, limit || 3);
  }

  /**
   * Wipe all chat memory (history + patterns).
   * WHY expose this: Privacy. Users should be able to erase what Doki remembers.
   * Could be wired to a "Forget our conversation" button in settings.
   */
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
