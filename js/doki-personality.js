/* DoKit — "Doki" Assistant personality + activity animations.
   - Beautiful name: Doki 🌟
   - Rich activity states: thinking, searching, typing, working
   - Animated FAB icon with pulse
*/
(function () {
  "use strict";

  var DOKI_NAME = "Doki";
  var DOKI_EMOJI = "✨";

  // Activity states with animations
  var ACTIVITIES = {
    thinking: { text: "Doki is thinking", icon: "🤔" },
    searching: { text: "Doki is searching", icon: "🔍" },
    typing: { text: "Doki is typing", icon: "⌨️" },
    working: { text: "Doki is working", icon: "⚙️" },
    listening: { text: "Doki is listening", icon: "🎤" }
  };

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

  function enhanceFab(fab) {
    // Replace 💬 with animated Doki icon
    fab.innerHTML = '<span class="doki-fab-icon">✨</span>';
    fab.setAttribute("aria-label", "Chat with " + DOKI_NAME);
    fab.classList.add("doki-fab");
  }

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
