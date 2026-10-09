/**
 * DoKit — Doki Personality & Animation Module
 * =============================================
 * WHAT: Gives the assistant its "Doki" identity with a cute panda mascot
 *       (assets/doki-panda.png) working at a laptop inside the circular FAB,
 *       plus a status pill and activity indicators.
 *
 * WHY: A named, animated mascot feels more friendly and alive than a generic
 *      "DoKit Assistant". The panda typing at its laptop while Doki works
 *      creates delight. Activity indicators ("Doki is thinking...") set
 *      expectations during AI delays.
 *
 * HOW IT WORKS:
 *   1. MutationObserver watches #dk-assistant-root for FAB and panel title
 *   2. FAB: Replaces 💬 with the panda SVG (fetched + inlined so CSS can
 *      animate its parts: blinking eyes, typing paws, headphone pulse)
 *   3. Title: Changes "DoKit Assistant" → "🎧 Doki"
 *   4. Circle activity API: window.DokiActivity.start(status) puts the panda
 *      in working mode + shows a status pill (thinking → searching → writing);
 *      setStatus(status) updates the pill; stop() hides everything.
 *   5. Chat activity API: Doki.showActivity(type) displays animated status:
 *      - thinking 🤔, searching 🔍, typing ⌨️, working ⚙️, listening 🎤
 *      - Each with bouncing icon + animated dots (also drives the circle)
 *   6. Injects CSS animations via <style> tag (doki-styles); panda keyframes
 *      (doki-panda-*) live in css/polish.css
 *
 * ANIMATIONS (CSS keyframes):
 *   - doki-float: Gentle up/down + rotate on FAB icon (3s loop)
 *   - doki-pulse: Expanding ring around FAB (2s loop)
 *   - doki-bounce: Activity icon bounce (1s loop)
 *   - doki-dot: Typing dots wave (1.4s staggered)
 *   - doki-panda-float / doki-panda-blink: idle panda life
 *   - doki-panda-bob / doki-panda-paw / doki-panda-phones / doki-panda-think:
 *     working panda (in css/polish.css)
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
    // WHY retry: assistant.js builds #dk-assistant-root asynchronously;
    // if it's not here yet, wait for it instead of giving up.
    var root = document.getElementById("dk-assistant-root");
    if (!root) {
      var tries = 0;
      var waiter = setInterval(function () {
        tries++;
        var r = document.getElementById("dk-assistant-root");
        if (r) { clearInterval(waiter); initWithRoot(r); }
        else if (tries > 100) { clearInterval(waiter); } /* ~10s max */
      }, 100);
      return;
    }
    initWithRoot(root);
  }

  function initWithRoot(root) {

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

    // Also check immediately in case FAB already exists
    var fabNow = root.querySelector(".dk-fab");
    if (fabNow && !fabNow.dataset.doki) {
      fabNow.dataset.doki = "1";
      enhanceFab(fabNow);
    }

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
    // Replace 💬 with Doki the panda working at a laptop
    var src = (typeof window.DKU === "function") ? window.DKU("/assets/doki-panda.png") : "/assets/doki-panda.png";
    var svgSrc = (typeof window.DKU === "function") ? window.DKU("/assets/doki-panda.svg") : "/assets/doki-panda.svg";
    fab.innerHTML = '<span class="doki-fab-icon doki-panda"><img class="doki-panda-img" src="' + src + '" alt="Doki" draggable="false"></span>';
    var dokiChatLabel = "Chat with " + DOKI_NAME;
    try { if (window.DKI18N && window.DKI18N.t) { var dv = window.DKI18N.t("doki_chat"); if (dv && dv !== "doki_chat") dokiChatLabel = dv; } } catch (e2) {}
    fab.setAttribute("aria-label", dokiChatLabel);
    fab.classList.add("doki-fab");
    inlinePanda(fab, svgSrc);
    addUsemeLabel(fab);
  }

  /**
   * "Use me" callout label above the FAB (suggestions #2, #27, #28).
   * WHY: New visitors don't know the panda is clickable. A small pill above
   * the button, translated into all 10 languages via the i18n dictionary,
   * teaches the affordance once — then gets out of the way.
   * BEHAVIOR: shows until (a) user clicks ×, (b) user opens the chat panel
   * once, or (c) 25s pass. Choice remembered in localStorage (doki_useme_off).
   * @param {HTMLElement} fab - The .dk-fab button element.
   */
  function addUsemeLabel(fab) {
   try {
    try {
      if (window.localStorage.getItem("doki_useme_off") === "1") return;
    } catch (e) {}
    var root = document.getElementById("dk-assistant-root");
    if (!root || root.querySelector(".doki-useme")) return;
    // Insert relative to the FAB's actual parent (FAB may be nested, not a
    // direct child of root — root.insertBefore would throw NotFoundError).
    var parent = fab.parentNode || root;

    function labelText() {
      try {
        if (window.DKI18N && typeof window.DKI18N.t === "function") {
          var v = window.DKI18N.t("doki_useme");
          // Accept only a real translation: reject the raw key AND the
          // humanized fallback ("Doki useme") that t() returns for missing keys.
          if (typeof v === "string" && v !== "doki_useme" &&
              v.toLowerCase().replace(/[\s_]+/g, "_") !== "doki_useme") return v;
        }
      } catch (e2) {}
      return "Use me";
    }

    var label = document.createElement("span");
    label.className = "doki-useme";
    label.setAttribute("role", "note");
    var txt = document.createElement("span");
    txt.className = "doki-useme-text";
    txt.textContent = labelText();
    var x = document.createElement("button");
    x.type = "button";
    x.className = "doki-useme-x";
    x.setAttribute("aria-label", "Dismiss");
    x.textContent = "×";
    label.appendChild(txt);
    label.appendChild(x);
    parent.insertBefore(label, fab);

    function dismiss(permanent) {
      if (!label.isConnected) return;
      label.classList.add("doki-useme--hide");
      setTimeout(function () { if (label.parentNode) label.parentNode.removeChild(label); }, 300);
      if (permanent) { try { window.localStorage.setItem("doki_useme_off", "1"); } catch (e3) {} }
      // First interaction: stop the attention pulse too (suggestion #4)
      try { fab.classList.add("doki-seen"); } catch (e4) {}
    }

    x.addEventListener("click", function (ev) { ev.stopPropagation(); dismiss(true); });
    // Clicking the label opens the chat (it's an invitation, after all)
    label.addEventListener("click", function (ev) {
      if (ev.target === x) return;
      dismiss(true);
      try { fab.click(); } catch (e5) {}
    });
    // Auto-hide permanently after first chat open (FAB click toggles the panel)
    fab.addEventListener("click", function () { dismiss(true); }, { once: true });
    // Gentle auto-hide after 25s so it never nags
    setTimeout(function () { dismiss(false); }, 25000);
    // Keep label in sync when the user switches language
    document.addEventListener("dokit:langchange", function () {
      if (label.isConnected) txt.textContent = labelText();
    });
    // One delayed refresh: i18n dictionaries may settle after the label is
    // created (deferred scripts), so re-resolve the text once.
    setTimeout(function () {
      if (label.isConnected) txt.textContent = labelText();
    }, 2000);
   } catch (err) { /* label is decorative — never break the FAB */ }
  }

  /**
   * Upgrade the panda <img> to inline SVG so page CSS can animate its parts
   * (blinking eyes, typing paws, headphone pulse).
   * WHY fetch+inline: CSS cannot reach inside an <img> SVG. Inlining keeps the
   * asset file (reusable anywhere) while enabling per-part animation.
   * Fallback: if fetch fails, the <img> stays and still shows the panda.
   * @param {HTMLElement} fab - The .dk-fab button element.
   * @param {string} src - Resolved URL of assets/doki-panda.svg.
   */
  function inlinePanda(fab, src) {
    if (!window.fetch) return;
    fetch(src).then(function (r) {
      if (!r.ok) throw new Error("panda svg " + r.status);
      return r.text();
    }).then(function (svg) {
      if (!fab.isConnected || svg.indexOf("<svg") === -1) return;
      var img = fab.querySelector(".doki-panda-img");
      if (!img || !img.isConnected) return; // FAB re-rendered meanwhile
      var wrap = document.createElement("span");
      wrap.className = "doki-panda-inline";
      wrap.innerHTML = svg;
      var node = wrap.firstChild;
      if (node && node.setAttribute) {
        node.setAttribute("aria-hidden", "true");
        node.setAttribute("focusable", "false");
      }
      img.parentNode.replaceChild(wrap, img);
    }).catch(function () { /* keep the <img> fallback */ });
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
      /* "Use me" callout label above the FAB (suggestions #2, #27, #28) */
      ".doki-useme {",
      "  position: fixed;",
      "  z-index: 219;",
      "  inset-block-end: calc(var(--sp-5, 1.25rem) + 4.6rem);",
      "  inset-inline-start: calc(var(--sp-5, 1.25rem) + 2rem);",
      "  transform: translateX(-50%);",
      "  display: inline-flex;",
      "  align-items: center;",
      "  gap: 0.4rem;",
      "  padding: 0.35rem 0.35rem 0.35rem 0.8rem;",
      "  background: var(--brand, #4F46E5);",
      "  color: #fff;",
      "  font-size: 0.8rem;",
      "  font-weight: 600;",
      "  border-radius: 999px;",
      "  box-shadow: var(--shadow-lg, 0 8px 24px rgba(0,0,0,.18));",
      "  cursor: pointer;",
      "  white-space: nowrap;",
      "  animation: doki-useme-in 0.4s ease-out;",
      "  transition: opacity 0.3s ease, transform 0.3s ease;",
      "}",
      "[dir=\"rtl\"] .doki-useme {",
      "  transform: translateX(50%);",
      "  padding: 0.35rem 0.8rem 0.35rem 0.35rem;",
      "}",
      ".doki-useme--hide { opacity: 0; pointer-events: none; }",
      ".doki-useme-x {",
      "  display: inline-flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  inline-size: 1.25rem;",
      "  block-size: 1.25rem;",
      "  border: none;",
      "  border-radius: 50%;",
      "  background: rgba(255,255,255,.22);",
      "  color: #fff;",
      "  font-size: 0.9rem;",
      "  line-height: 1;",
      "  cursor: pointer;",
      "}",
      ".doki-useme-x:hover { background: rgba(255,255,255,.38); }",
      "@keyframes doki-useme-in {",
      "  from { opacity: 0; transform: translateX(-50%) translateY(8px); }",
      "  to { opacity: 1; transform: translateX(-50%) translateY(0); }",
      "}",
      "[dir=\"rtl\"] .doki-useme { animation-name: doki-useme-in-rtl; }",
      "@keyframes doki-useme-in-rtl {",
      "  from { opacity: 0; transform: translateX(50%) translateY(8px); }",
      "  to { opacity: 1; transform: translateX(50%) translateY(0); }",
      "}",
      "body.has-sticky-cta .doki-useme {",
      "  inset-block-end: calc(4.5rem + env(safe-area-inset-bottom, 0px) + 4.6rem);",
      "}",
      /* First-visit pulse: stop the attention ring after first interaction (#4) */
      ".doki-fab.doki-seen::after { animation: none; opacity: 0; }",
      /* Respect reduced motion: calm the FAB for sensitive users (#1) */
      "@media (prefers-reduced-motion: reduce) {",
      "  .doki-fab-icon { animation: none; }",
      "  .doki-fab::after { animation: none; opacity: 0; }",
      "  .doki-useme { animation: none; }",
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
   * NOTE: also starts the "live activity in circle" on the FAB (stopped by
   * hideActivity), so thinking/searching/typing states animate the circle.
   */
  function showActivity(type) {
    circleStart(type);
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
   * Also stops the circle activity (wired below).
   * @param {HTMLElement|null} el - Element returned by showActivity().
   */
  function hideActivity(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    circleStop();
  }

  /* ============ Doki live activity: panda works inside the circle ============
     WHAT: While Doki works (AI call in flight), the circular FAB itself shows
     live activity -- the panda keeps typing at its laptop (paws animate, body
     bobs, headphone pulse via CSS on .doki-working) and a small status pill
     next to the circle cycles: "Doki is thinking..." -> "Doki is searching..."
     -> "Doki is writing...". No separate panel opens; everything happens at
     the circle. The panda is never swapped out.
     WHY keep the panda: the mascot is Doki's identity -- swapping it for emoji
     would break the brand moment. States now live in the status label text.
     WHY a separate module surface: assistant-ai.js drives it around the
     Gemini/OpenAI call via window.DokiActivity. showActivity()/hideActivity()
     also drive it so the thinking/searching/typing states animate the circle.
     Exposed as window.DokiActivity = { start, stop, setStatus }. */

  var CIRCLE_STATUS = {
    thinking: { en: "is thinking...", ur: "\u0633\u0648\u0686 \u0631\u06c1\u0627 \u06c1\u06d2..." },
    searching: { en: "is searching...", ur: "\u062a\u0644\u0627\u0634 \u06a9\u0631 \u0631\u06c1\u0627 \u06c1\u06d2..." },
    writing: { en: "is writing...", ur: "\u0644\u06a9\u06be \u0631\u06c1\u0627 \u06c1\u06d2..." },
    working: { en: "is working", ur: "\u06a9\u0627\u0645 \u06a9\u0631 \u0631\u06c1\u0627 \u06c1\u06d2" },
    running: { en: "Running command", ur: "\u06a9\u0645\u0627\u0646\u0688 \u0686\u0644 \u0631\u06c1\u0627 \u06c1\u06d2" }
  };
  /* showActivity types -> circle status keys (typing shows as "writing") */
  var ACTIVITY_TO_STATUS = { thinking: "thinking", searching: "searching", typing: "writing", working: "working", running: "running", listening: "thinking" };
  var statusPill = null;
  var circleReduceMotion = false;
  try {
    circleReduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch (e) {}

  function findFab() {
    var root = document.getElementById("dk-assistant-root");
    return root ? root.querySelector(".dk-fab") : null;
  }

  function circleStatusText(key) {
    var mapped = ACTIVITY_TO_STATUS[key] || key;
    var e = CIRCLE_STATUS[mapped] || CIRCLE_STATUS.thinking;
    try {
      if (window.DKI18N && typeof window.DKI18N.getLang === "function" && window.DKI18N.getLang() === "ur") return e.ur;
    } catch (err) {}
    return e.en;
  }

  /**
   * Create (once) the status pill that floats next to the circle.
   * WHY fixed positioning: the FAB is position:fixed at the viewport corner,
   * so the pill anchors to the same corner and survives panel toggles.
   */
  function ensureStatusPill() {
    if (statusPill && statusPill.isConnected) return statusPill;
    statusPill = document.createElement("div");
    statusPill.className = "doki-status";
    statusPill.setAttribute("role", "status");
    statusPill.setAttribute("aria-live", "polite");
    document.body.appendChild(statusPill);
    return statusPill;
  }

  /**
   * Put the circular FAB into "working" mode: the panda typing animation runs
   * (CSS on .doki-working) and the status pill appears with the state text.
   * WHY no innerHTML swap: the panda stays in the circle the whole time.
   * Safe to call repeatedly -- any previous run is cleaned up first.
   * @param {string} [status] - thinking, searching, writing (or an
   *   activity type like typing -- mapped automatically).
   */
  function escHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function circleStart(status) {
    circleStop(); // clear any previous run
    var fab = findFab();
    if (fab) {
      fab.classList.add("doki-working");
      try { fab.setAttribute("aria-busy", "true"); } catch (e2) {}
    }
    var pill = ensureStatusPill();
    pill.innerHTML = '<span class="doki-status-name">' + escHtml(DOKI_NAME) + '</span>' +
      '<span class="doki-status-text">✨ ' + escHtml(circleStatusText(status)) + '</span>';
    void pill.offsetWidth; // restart the fade transition
    pill.classList.add("show");
  }

  /**
   * Update the status pill text with a smooth fade.
   * @param {string} status - thinking, searching, writing (or activity type).
   */
  function circleSetStatus(status) {
    var pill = ensureStatusPill();
    var txt = circleStatusText(status);
    if (pill.textContent === txt && pill.classList.contains("show")) return;
    pill.classList.remove("show");
    setTimeout(function () {
      if (!pill.isConnected) return;
      pill.innerHTML = '<span class="doki-status-name">' + escHtml(DOKI_NAME) + '</span>' +
        '<span class="doki-status-text">✨ ' + escHtml(txt) + '</span>';
      void pill.offsetWidth;
      pill.classList.add("show");
    }, circleReduceMotion ? 0 : 160);
  }

  /**
   * Take the FAB out of "working" mode and hide the status pill.
   * Null-safe and idempotent: safe to call unconditionally.
   */
  function circleStop() {
    var fab = findFab();
    if (fab) {
      fab.classList.remove("doki-working");
      try { fab.removeAttribute("aria-busy"); } catch (e) {}
    }
    if (statusPill && statusPill.isConnected) statusPill.classList.remove("show");
  }

  window.DokiActivity = {
    start: circleStart,
    stop: circleStop,
    setStatus: circleSetStatus
  };

  window.DokiRefreshFab = function (fab) {
    if (fab && !fab.querySelector(".doki-panda")) enhanceFab(fab);
  };

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
