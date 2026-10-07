/* DoKit — AI Assistant (Multi-provider with auto-fallback).
   Priority:
   1. Gemini (FREE via Firebase AI Logic) — primary
   2. OpenAI (needs API key, user-provided) — secondary fallback
   3. Rule-based KB — final fallback (never silent)
   
   - STRICT scope: DoKit website/tools only.
   - Chat memory: remembers history via DKMemory.
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

  function onModelReady(m) {
    geminiModel = m;
    geminiReady = true;
  }

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

  // Ask Gemini
  function askGemini(prompt) {
    if (!geminiReady || !geminiModel) return Promise.resolve(null);
    try {
      // Include chat memory context
      var ctx = "";
      try { if (window.DKMemory) ctx = DKMemory.getContext(3); } catch (e) {}
      var fullPrompt = ctx ? ("Recent conversation:\n" + ctx + "\n\nCurrent question: " + prompt) : prompt;
      
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

  // Ask OpenAI (fallback)
  function askOpenAI(prompt) {
    if (!openaiReady || !openaiKey) return Promise.resolve(null);
    try {
      var ctx = "";
      try { if (window.DKMemory) ctx = DKMemory.getContext(3); } catch (e) {}
      
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

  // Main ask: tries Gemini → OpenAI → null (caller falls back to KB)
  function ask(prompt) {
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
      return result; // null = use KB fallback
    });
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
