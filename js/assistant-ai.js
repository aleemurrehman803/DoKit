/* DoKit — AI Assistant (Gemini via Firebase AI Logic).
   - FREE tier only.
   - STRICT scope: DoKit website/tools only. Refuses out-of-scope questions.
   - FALLBACK: if Gemini fails (quota, network, etc.), falls back to rule-based KB.
   - Never goes silent.
*/
(function () {
  "use strict";

  var SYSTEM_PROMPT = [
    "You are DoKit Assistant, a helpful guide for the DoKit website.",
    "",
    "DoKit has these FREE tools (all run in the browser, no upload):",
    "- Image Resizer: resize photos to any dimension (pixels/percent/presets)",
    "- Image Compressor: shrink JPG/PNG/WebP file size without visible quality loss",
    "- Image Converter: convert between PNG, JPEG, and WebP",
    "- Word Counter: live word/character count, reading time, keyword density",
    "- Case Converter: UPPER, lower, Title Case, Sentence case, aLtErNaTiNg, iNVERSE",
    "- Typing (TypeMaster): learn touch typing with lessons and tests",
    "- TypeFight: typing competitions (coming soon)",
    "",
    "STRICT RULES:",
    "1. ONLY answer questions about DoKit tools and the DoKit website.",
    "2. If asked about ANYTHING else (general knowledge, other sites, coding help, math, etc.),",
    '   reply EXACTLY: "I can only help with DoKit tools! Ask me about Image Resizer, Compressor, Converter, Word Counter, Case Converter, or Typing."',
    "3. Keep answers SHORT — 2-3 sentences max.",
    "4. Be friendly. If user speaks Urdu, reply in Urdu.",
    "5. Never mention you are Gemini or an AI model. You are DoKit Assistant."
  ].join("\n");

  var model = null;
  var aiReady = false;

  function init() {
    // Model is provided by assistant-ai-init.js (module script)
    // which loads the Firebase AI SDK and sets window.DKAI_MODEL
    try {
      if (window.DKAI_MODEL) {
        model = window.DKAI_MODEL;
        aiReady = true;
        return true;
      }
      // Wait for the module to load (async)
      document.addEventListener("dk-ai-ready", function () {
        if (window.DKAI_MODEL) {
          model = window.DKAI_MODEL;
          aiReady = true;
        }
      });
      return false;
    } catch (e) {
      aiReady = false;
      return false;
    }
  }

  // Called by the module script when model is ready
  function onModelReady(m) {
    model = m;
    aiReady = true;
  }

  // Ask Gemini. Returns Promise<string|null> (null = failed, use fallback)
  function ask(prompt) {
    if (!aiReady || !model) return Promise.resolve(null);
    try {
      return model.generateContent(prompt).then(function (result) {
        var text = result && result.response ? result.response.text() : "";
        text = (text || "").trim();
        // Safety: if empty or too long, treat as failure
        if (!text || text.length > 500) return null;
        return text;
      }).catch(function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  // Check if query is likely out-of-scope (quick heuristic before calling AI)
  // This saves tokens — obvious out-of-scope gets instant refusal without API call.
  function isOutOfScope(q) {
    var s = (q || "").toLowerCase();
    var outPatterns = [
      "weather", "news", "cricket", "football", "movie", "song",
      "recipe", "joke", "story", "poem", "code", "python", "javascript",
      "math", "calculate", "translate", "who is", "what is the capital",
      "president", "prime minister", "covid", "price of", "stock"
    ];
    for (var i = 0; i < outPatterns.length; i++) {
      if (s.indexOf(outPatterns[i]) !== -1) return true;
    }
    return false;
  }

  var OUT_OF_SCOPE_REPLY = "I can only help with DoKit tools! Ask me about Image Resizer, Compressor, Converter, Word Counter, Case Converter, or Typing.";

  window.DKAI = {
    init: init,
    onModelReady: onModelReady,
    ask: ask,
    isReady: function () { return aiReady; },
    isOutOfScope: isOutOfScope,
    outOfScopeReply: OUT_OF_SCOPE_REPLY,
    systemPrompt: SYSTEM_PROMPT
  };

  // Auto-init on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
