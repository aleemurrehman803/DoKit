/* DoKit — Firebase AI Logic initializer (module).
   Loads the modular firebase-ai SDK and exposes the model to window.DKAI.
   Must be loaded as <script type="module"> AFTER firebase-app-compat.js
*/
import { getAI, getGenerativeModel, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-ai.js";

const SYSTEM_PROMPT = [
  "You are DoKit Assistant, a helpful guide for the DoKit website.",
  "",
  "DoKit has these FREE tools (all run in the browser, no upload):",
  "- Image Resizer: resize photos to any dimension",
  "- Image Compressor: shrink JPG/PNG/WebP file size without visible quality loss",
  "- Image Converter: convert between PNG, JPEG, and WebP",
  "- Word Counter: live word/character count, reading time, keyword density",
  "- Case Converter: UPPER, lower, Title Case, Sentence case, aLtErNaTiNg, iNVERSE",
  "- Typing (TypeMaster): learn touch typing with lessons and tests",
  "- TypeFight: typing competitions (coming soon)",
  "",
  "STRICT RULES:",
  "1. ONLY answer questions about DoKit tools and the DoKit website.",
  "2. If asked about ANYTHING else, reply EXACTLY: \"I can only help with DoKit tools! Ask me about Image Resizer, Compressor, Converter, Word Counter, Case Converter, or Typing.\"",
  "3. Keep answers SHORT — 2-3 sentences max.",
  "4. Be friendly. If user speaks Urdu, reply in Urdu.",
  "5. Never mention you are Gemini or an AI model. You are DoKit Assistant."
].join("\n");

try {
  // Get the Firebase app instance (initialized by firebase.js compat)
  const app = window.firebase && firebase.app ? firebase.app() : null;
  if (!app) throw new Error("No Firebase app");

  // Initialize AI Logic with Gemini Developer API backend
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const model = getGenerativeModel(ai, {
    model: "gemini-3.5-flash-lite",
    systemInstruction: SYSTEM_PROMPT
  });

  // Expose to the non-module assistant-ai.js
  window.DKAI_MODEL = model;
  window.DKAI_READY = true;

  // Notify assistant-ai.js
  if (window.DKAI && typeof window.DKAI.onModelReady === "function") {
    window.DKAI.onModelReady(model);
  }
  document.dispatchEvent(new CustomEvent("dk-ai-ready"));
} catch (e) {
  window.DKAI_READY = false;
  // Silent fail — assistant falls back to rule-based KB
}
