/**
 * DoKit — Doki Personality & Animation Module
 * =============================================
 * WHAT: Gives the assistant its "Doki ✨" identity with animated UI elements.
 *       Includes floating FAB icon, activity indicators, and personality constants.
 *
 * WHY: A named, animated assistant feels more friendly and alive than a generic
 *      "DoKit Assistant". The ✨ sparkle and animations create delight.
 *      Activity indicators ("Doki is thinking...") set expectations during AI delays.
 *
 * HOW IT WORKS:
 *   1. MutationObserver watches #dk-assistant-root for FAB and panel title
 *   2. FAB: Replaces 💬 with animated ✨ (CSS float + pulse ring animations)
 *   3. Title: Changes "DoKit Assistant" → "Doki ✨"
 *   4. Activity API: Doki.showActivity(type) displays animated status:
 *      - thinking 🤔, searching 🔍, typing ⌨️, working ⚙️, listening 🎤
 *      - Each with bouncing icon + animated dots
 *   5. Injects CSS animations via <style> tag (doki-styles)
 *
 * ANIMATIONS (CSS keyframes):
 *   - doki-float: Gentle up/down + rotate on FAB icon (3s loop)
 *   - doki-pulse: Expanding ring around FAB (2s loop)
 *   - doki-bounce: Activity icon bounce (1s loop)
 *   - doki-dot: Typing dots wave (1.4s staggered)
 *
 * @module Doki
 */
(function () {
  "use strict";

  var DOKI_NAME = "Doki";
  var DOKI_EMOJI = "🎧";

  // Activity states with animations
  var ACTIVITIES = {
    thinking: { text: "Doki is thinking", icon: "🤔" },
    searching: { text: "Doki is searching", icon: "🔍" },
    typing: { text: "Doki is typing", icon: "⌨️" },
    working: { text: "Doki is working", icon: "⚙️" },
    listening: { text: "Doki is listening", icon: "🎤" }
  };

  /**
   * Initialize Doki personality. Called on DOMContentLoaded (or immediately if
   * DOM already ready).
   * WHY MutationObserver (not direct DOM access): The assistant panel
   * (#dk-assistant-root content) is built asynchronously by assistant.js.
   * We can't know when it's ready, so we observe for the FAB and title elements
   * and enhance them as they appear. Also injects the CSS animations once.
   */
  function init() {
    // Update FAB button to show Doki branding
    var root = document.getElementById("dk-assistant-root");
    if (!root) return;

    var observer = new MutationObserver(function () {
      var fab = root.querySelector(".dk-fab");
      if (fab && !fab.dataset.doki) {
        fab.dataset.doki = "1";
        enhanceFab(fab);
      }
      // Update panel title to Doki
      var title = root.querySelector(".dk-panel__head strong");
      if (title && !title.dataset.doki) {
        title.dataset.doki = "1";
        title.textContent = DOKI_EMOJI + " " + DOKI_NAME;
      }
    });
    observer.observe(root, { childList: true, subtree: true });

    // Add Doki CSS animations
    addDokiStyles();
  }

  /**
   * Transform the generic 💬 chat button into Doki's animated ✨ identity.
   * WHY replace content: The ✨ sparkle is Doki's brand mark. The CSS animations
   * (doki-float + doki-pulse, injected by addDokiStyles) make it feel alive —
   * floating gently and emitting a pulse ring every 2s to draw attention.
   * @param {HTMLElement} fab - The .dk-fab button element.
   */
  function enhanceFab(fab) {
    // Replace 💬 with animated Doki icon
    fab.innerHTML = '<span class="doki-fab-icon">🎧</span>';
    fab.setAttribute("aria-label", "Chat with " + DOKI_NAME);
    fab.classList.add("doki-fab");
  }

  /**
   * Inject Doki's CSS animations into <head> (once, guarded by #doki-styles id).
   * WHY inject (not a .css file): Keeps personality self-contained in one JS
   * module — no extra HTTP request, no build step. Animations use CSS custom
   * properties (var(--brand)) so they adapt to light/dark theme automatically.
   * Keyframes: doki-float, doki-pulse, doki-bounce, doki-dot, doki-work.
   */
  function addDokiStyles() {
    if (document.getElementById("doki-styles")) return;
    var s = document.createElement("style");
    s.id = "doki-styles";
    s.textContent = [
      /* Animated FAB */
      ".doki-fab {",
      "  position: relative;",
      "  overflow: visible !important;",
      "}",
      ".doki-fab-icon {",
      "  display: inline-block;",
      "  font-size: 1.5rem;",
      "  animation: doki-float 3s ease-in-out infinite;",
      "}",
      "@keyframes doki-float {",
      "  0%, 100% { transform: translateY(0) rotate(0deg); }",
      "  50% { transform: translateY(-3px) rotate(10deg); }",
      "}",
      /* Pulse ring on FAB */
      ".doki-fab::after {",
      "  content: '';",
      "  position: absolute;",
      "  inset: -4px;",
      "  border-radius: 50%;",
      "  border: 2px solid var(--brand, #4F46E5);",
      "  opacity: 0;",
      "  animation: doki-pulse 2s ease-out infinite;",
      "  pointer-events: none;",
      "}",
      "@keyframes doki-pulse {",
      "  0% { transform: scale(0.8); opacity: 0.6; }",
      "  100% { transform: scale(1.3); opacity: 0; }",
      "}",
      /* Activity indicator */
      ".doki-activity {",
      "  display: flex;",
      "  align-items: center;",
      "  gap: 0.5rem;",
      "  padding: 0.75rem 1rem;",
      "  color: var(--text-muted, #666);",
      "  font-size: 0.9rem;",
      "  font-style: italic;",
      "}",
      ".doki-activity-icon {",
      "  font-size: 1.2rem;",
      "  animation: doki-bounce 1s ease-in-out infinite;",
      "}",
      "@keyframes doki-bounce {",
      "  0%, 100% { transform: translateY(0); }",
      "  50% { transform: translateY(-4px); }",
      "}",
      ".doki-activity-dots span {",
      "  display: inline-block;",
      "  width: 6px; height: 6px;",
      "  margin: 0 1px;",
      "  background: var(--brand, #4F46E5);",
      "  border-radius: 50%;",
      "  animation: doki-dot 1.4s ease-in-out infinite;",
      "}",
      ".doki-activity-dots span:nth-child(2) { animation-delay: 0.2s; }",
      ".doki-activity-dots span:nth-child(3) { animation-delay: 0.4s; }",
      "@keyframes doki-dot {",
      "  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }",
      "  30% { transform: translateY(-6px); opacity: 1; }",
      "}",
      /* Working laptop animation */
      ".doki-working {",
      "  display: inline-block;",
      "  animation: doki-work 2s ease-in-out infinite;",
      "}",
      "@keyframes doki-work {",
      "  0%, 100% { transform: rotate(-5deg); }",
      "  50% { transform: rotate(5deg); }",
      "}"
    ].join("\n");
    document.head.appendChild(s);
  }

  // Show activity indicator in chat
  /**
   * Display an animated "Doki is ..." activity indicator in the chat.
   * WHY activity indicators: AI responses take 1-3 seconds. Without feedback,
   * users think the app froze. "Doki is thinking..." with bouncing dots sets
   * expectations and feels responsive. Caller must call hideActivity(el) when done.
   * @param {string} type - One of: thinking, searching, typing, working, listening.
   *                       Unknown types fall back to "thinking".
   * @returns {HTMLElement|null} The indicator element (pass to hideActivity),
   *                             or null if chat body not found.
   * @example
   *   var el = Doki.showActivity("thinking");
   *   doAsyncWork().then(function () { Doki.hideActivity(el); });
   */
  function showActivity(type) {
    var root = document.getElementById("dk-assistant-root");
    if (!root) return null;
    var body = root.querySelector(".dk-panel__body");
    if (!body) return null;

    var act = ACTIVITIES[type] || ACTIVITIES.thinking;
    
    var div = document.createElement("div");
    div.className = "dk-msg dk-msg--bot doki-activity-msg";
    div.innerHTML = '<div class="doki-activity">' +
      '<span class="doki-activity-icon">' + act.icon + '</span>' +
      '<span>' + act.text + '</span>' +
      '<span class="doki-activity-dots"><span></span><span></span><span></span></span>' +
      '</div>';
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  }

  /**
   * Remove an activity indicator from the chat.
   * WHY null-safe: The element may already be gone (e.g., chat cleared).
   * Never throws — safe to call unconditionally in .finally() blocks.
   * @param {HTMLElement|null} el - Element returned by showActivity().
   */
  function hideActivity(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  window.Doki = {
    name: DOKI_NAME,
    emoji: DOKI_EMOJI,
    showActivity: showActivity,
    hideActivity: hideActivity,
    activities: ACTIVITIES
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
