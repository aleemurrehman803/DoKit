/**
 * DoKit — AI Assistant Module (Multi-Provider with Auto-Fallback)
 * ================================================================
 * WHAT: Connects Doki assistant to real AI models (Gemini, OpenAI) with
 *       automatic fallback chain. If AI fails, falls back to rule-based KB.
 *
 * WHY: Rule-based KB (assistant.js) is fast and offline but limited.
 *      Real AI handles complex/unexpected questions naturally.
 *      Multi-provider ensures reliability (if one fails, try the next).
 *
 * FALLBACK CHAIN (in order):
 *   1. Gemini 3.5-flash-lite (FREE via Firebase AI Logic) — primary
 *      - Initialized by assistant-ai-init.js (module script)
 *      - Model exposed as window.DKAI_MODEL
 *   2. OpenAI GPT-3.5-turbo (requires user API key) — secondary
 *      - Key stored in localStorage ("dokit_openai_key")
 *      - Set via DKAI.setOpenAIKey(key)
 *   3. Rule-based KB (assistant.js) — final fallback, never silent
 *
 * SCOPE ENFORCEMENT (DoKit-only):
 *   - SYSTEM_PROMPT hard-codes: "ONLY answer about DoKit tools"
 *   - isOutOfScope() heuristic blocks obvious non-DoKit queries WITHOUT API call
 *     (saves tokens: weather, news, cricket, etc. get instant refusal)
 *   - AI instructed to refuse with exact message for out-of-scope
 *
 * CHAT MEMORY:
 *   - Includes last 3 exchanges from DKMemory in prompt for context
 *   - Responses logged back to DKMemory for future context
 *
 * SECURITY:
 *   - API keys never logged, never in URLs
 *   - Responses capped at 500 chars (prevents prompt injection bloat)
 *   - Empty/invalid responses treated as failure → fallback to KB
 *
 * @module DKAI
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

  var geminiModel = null;
  var geminiReady = false;
  var openaiKey = null; // Set via DKAI.setOpenAIKey(key)
  var openaiReady = false;

  /**
   * Initialize the AI module. Called automatically on DOMContentLoaded.
   * WHY two-phase init: The Gemini model is created by assistant-ai-init.js
   * (an ES module that loads async). This function checks if it's already ready;
   * if not, it listens for the "dk-ai-ready" event. OpenAI key is restored from
   * localStorage if the user previously saved one.
   * @returns {boolean} True if at least one provider is ready.
   */
  function init() {
    // Gemini: model provided by assistant-ai-init.js (module script)
    try {
      if (window.DKAI_MODEL) {
        geminiModel = window.DKAI_MODEL;
        geminiReady = true;
      } else {
        document.addEventListener("dk-ai-ready", function () {
          if (window.DKAI_MODEL) {
            geminiModel = window.DKAI_MODEL;
            geminiReady = true;
          }
        });
      }
    } catch (e) {}
    
    // OpenAI: check for saved key
    try {
      var k = localStorage.getItem("dokit_openai_key");
      if (k) { openaiKey = k; openaiReady = true; }
    } catch (e) {}
    
    return geminiReady || openaiReady;
  }

  /**
   * Callback invoked by assistant-ai-init.js when the Gemini model is ready.
   * WHY a callback (not polling): The module script fires "dk-ai-ready" event;
   * this is the direct handler. Sets the module-scoped model reference.
   * @param {object} m - Initialized Gemini generative model instance.
   */
  function onModelReady(m) {
    geminiModel = m;
    geminiReady = true;
  }

  /**
   * Save the user's OpenAI API key for fallback use.
   * WHY user-provided: DoKit cannot ship an OpenAI key (would be abused/exposed).
   * Users who want OpenAI fallback paste their own key (from platform.openai.com).
   * Stored in localStorage (never sent anywhere except api.openai.com).
   * SECURITY NOTE: Any XSS on the page could read this key. Users should use
   * keys with spending limits. This is documented, not hidden.
   * @param {string} key - OpenAI API key (sk-...).
   * @returns {boolean} True if key was saved.
   */
  function setOpenAIKey(key) {
    try {
      if (key && key.trim()) {
        openaiKey = key.trim();
        localStorage.setItem("dokit_openai_key", openaiKey);
        openaiReady = true;
        return true;
      }
    } catch (e) {}
    return false;
  }

  /**
   * Ask Gemini (primary provider, FREE via Firebase AI Logic).
   * WHY 500-char cap: Prevents runaway responses from eating tokens and keeps
   * answers concise for the chat UI. Also mitigates prompt-injection exfiltration.
   * WHY include memory: Last 3 exchanges give conversational context so follow-up
   * questions ("what about PNG?") make sense.
   * @param {string} prompt - User's question (already scope-checked by caller).
   * @returns {Promise<string|null>} AI response text, or null on any failure
   *          (not ready, network error, quota exceeded, empty/too-long response).
   *          Null signals the caller to try the next provider.
   */
  function askGemini(prompt) {
    if (!geminiReady || !geminiModel) return Promise.resolve(null);
    try {
      // Include chat memory context
      var ctx = "";
      try { if (window.DKMemory) ctx = DKMemory.getContext(3); } catch (e) {}
      var fullPrompt = ctx ? ("Recent conversation:\n" + ctx + "\n\nCurrent question: " + prompt) : prompt;
      
      try { if (window.DokiActivity && DokiActivity.setStatus) DokiActivity.setStatus("searching"); } catch (e) {}
      return geminiModel.generateContent(fullPrompt).then(function (result) {
        var text = result && result.response ? result.response.text() : "";
        text = (text || "").trim();
        if (!text || text.length > 500) return null;
        return text;
      }).catch(function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  /**
   * Ask OpenAI GPT-3.5-turbo (secondary fallback, requires user API key).
   * WHY gpt-3.5-turbo: Cheapest capable model. max_tokens=150 keeps costs tiny.
   * WHY system prompt: Enforces DoKit-only scope even if our pre-check missed
   * something. Defense in depth — the model itself refuses off-topic questions.
   * @param {string} prompt - User's question.
   * @returns {Promise<string|null>} Response text, or null on failure
   *          (no key, 401/429/500, network error, bad response shape).
   */
  function askOpenAI(prompt) {
    if (!openaiReady || !openaiKey) return Promise.resolve(null);
    try {
      var ctx = "";
      try { if (window.DKMemory) ctx = DKMemory.getContext(3); } catch (e) {}
      
      try { if (window.DokiActivity && DokiActivity.setStatus) DokiActivity.setStatus("searching"); } catch (e) {}
      return fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + openaiKey
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          max_tokens: 150,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...(ctx ? [{ role: "user", content: "Context:\n" + ctx }] : []),
            { role: "user", content: prompt }
          ]
        })
      }).then(function (r) {
        if (!r.ok) return null; // quota exceeded, invalid key, etc.
        return r.json();
      }).then(function (d) {
        var text = d && d.choices && d.choices[0] && d.choices[0].message ? d.choices[0].message.content : "";
        text = (text || "").trim();
        if (!text || text.length > 500) return null;
        return text;
      }).catch(function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  /**
   * Main entry point: tries providers in order, returns first success.
   * FALLBACK CHAIN: Gemini → OpenAI → null.
   * WHY this order: Gemini is free (no user key needed), so it's primary.
   * OpenAI is paid (user's key), so it's backup. Null means "use rule-based KB"
   * — the assistant NEVER goes silent.
   * WHY log to memory: Both success paths log the exchange so future prompts
   * include this conversation as context.
   * WHY DokiActivity: while the AI call is in flight, the panda keeps typing
   * in the circular FAB and a status pill cycles thinking → searching →
   * writing — no separate panel. start("thinking") fires before the first
   * provider; setStatus("searching") fires before each API call;
   * setStatus("writing") shows briefly on an answer; stop() runs in the final
   * .then(), which always executes because neither provider ever rejects
   * (all errors → null).
   * @param {string} prompt - User's question (scope already checked by assistant.js).
   * @returns {Promise<string|null>} AI answer, or null if all providers failed.
   */
  function ask(prompt) {
    try { if (window.DokiActivity && DokiActivity.start) DokiActivity.start("thinking"); } catch (e) {}
    return askGemini(prompt).then(function (result) {
      if (result) {
        // Log to memory
        try { if (window.DKMemory) DKMemory.log(prompt, result, null); } catch (e) {}
        return result;
      }
      // Gemini failed, try OpenAI
      return askOpenAI(prompt);
    }).then(function (result) {
      if (result) {
        try { if (window.DKMemory) DKMemory.log(prompt, result, null); } catch (e) {}
      }
      // AI work finished — show "writing" briefly on an answer so the
      // status pill reads naturally, then stop the circle activity.
      try {
        if (window.DokiActivity) {
          if (result && DokiActivity.setStatus && DokiActivity.stop) {
            DokiActivity.setStatus("writing");
            setTimeout(function () { try { DokiActivity.stop(); } catch (e3) {} }, 900);
          } else if (DokiActivity.stop) {
            DokiActivity.stop();
          }
        }
      } catch (e2) {}
      return result; // null = use KB fallback
    });
  }

  /**
   * Heuristic pre-check: is this question obviously NOT about DoKit?
   * WHY pre-check (not just relying on system prompt): Every AI API call costs
   * tokens/money. If someone asks "what's the weather?", we can refuse instantly
   * without spending a single token. The system prompt is the backstop for
   * edge cases this list misses.
   * WHY these patterns: Common off-topic categories observed in chatbots —
   * general knowledge, entertainment, coding help, math, etc.
   * NOTE: This is intentionally conservative. If unsure, we let the AI decide
   * (the system prompt will refuse if truly off-topic).
   * @param {string} q - User's raw question.
   * @returns {boolean} True if obviously out-of-scope (refuse without API call).
   */
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
    setOpenAIKey: setOpenAIKey,
    ask: ask,
    isReady: function () { return geminiReady || openaiReady; },
    isGeminiReady: function () { return geminiReady; },
    isOpenAIReady: function () { return openaiReady; },
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
