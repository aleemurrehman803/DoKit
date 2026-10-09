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

    // Batch 2: enhance chat panel (copy buttons + privacy note)
    enhancePanel(root);

    // Add Doki CSS animations
    addDokiStyles();
  }

  /**
   * Batch 2: Add copy buttons to bot messages and a privacy note.
   * WHY: users want to save Doki's answers; privacy note builds trust.
   */
  function enhancePanel(root) {
    // Watch for new bot messages
    var msgObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          // Check if it's a bot message or contains one
          var msgs = [];
          if (node.classList && node.classList.contains("dk-msg--bot")) msgs.push(node);
          if (node.querySelectorAll) {
            node.querySelectorAll(".dk-msg--bot").forEach(function (el) { msgs.push(el); });
          }
          msgs.forEach(addCopyButton);
        });
      });
      // Ensure privacy note exists
      addPrivacyNote(root);
    });

    var body = root.querySelector(".dk-panel__body");
    if (body) {
      msgObserver.observe(body, { childList: true, subtree: true });
      // Add copy buttons to existing messages
      body.querySelectorAll(".dk-msg--bot").forEach(addCopyButton);
    } else {
      // Body not yet created, observe root
      msgObserver.observe(root, { childList: true, subtree: true });
    }

    // Add privacy note (retry if panel not ready)
    addPrivacyNote(root);
    // Batch 3: Add voice input button
    addVoiceButton(root);
    // Batch 3: Restore chat history
    restoreChatHistory(root);
    // Batch 4: Clear button + "/" shortcut
    addClearButton(root);
    initSlashShortcut(root);
    // Batch 5: Offline, sleep mode
    initOfflineMessage(root);
    initSleepMode(root);
    // Batch 5: Draggable FAB
    initDraggable(root);
    // Batch 5: Feedback request button
    addFeedbackRequestBtn(root);
    // User request Oct 9: panda avatar in header + side tabs
    addPandaToHeader(root);
    addSideTabs(root);
    // Listen for language changes to update privacy note
    document.addEventListener("dokit:langchange", function () {
      var note = root.querySelector(".doki-privacy-note span");
      if (note) note.textContent = privacyText();
    });
    // Batch 3: Save chat history on new messages
    watchChatHistory(root);
  }

  /**
   * Batch 3: Save/restore chat history in localStorage.
   * WHY: users can continue where they left off.
   */
  var DOKI_HIST_KEY = "doki_chat_history";
  var DOKI_HIST_MAX = 50; // max messages to keep

  function getChatHistory() {
    try {
      var raw = window.localStorage.getItem(DOKI_HIST_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(-DOKI_HIST_MAX) : [];
    } catch (e) { return []; }
  }

  function saveChatHistory(root) {
    try {
      var body = root.querySelector(".dk-panel__body");
      if (!body) return;
      var msgs = [];
      body.querySelectorAll(".dk-msg").forEach(function (el) {
        // Skip typing indicators and chips-only containers
        if (el.querySelector(".dk-typing")) return;
        var isUser = el.classList.contains("dk-msg--user");
        var text = el.innerText || el.textContent || "";
        text = text.trim();
        // Skip empty and chip containers (chips have buttons)
        if (!text || el.classList.contains("dk-chips")) return;
        // Remove copy button text (📋/✅)
        text = text.replace(/[📋✅]/g, "").trim();
        if (text) msgs.push({ user: isUser, text: text.slice(0, 2000) });
      });
      window.localStorage.setItem(DOKI_HIST_KEY, JSON.stringify(msgs.slice(-DOKI_HIST_MAX)));
    } catch (e) {}
  }

  function restoreChatHistory(root) {
    var hist = getChatHistory();
    if (!hist.length) return;
    var body = root.querySelector(".dk-panel__body");
    if (!body || body.children.length) return; // only restore to empty panel
    hist.forEach(function (m) {
      var div = document.createElement("div");
      div.className = "dk-msg " + (m.user ? "dk-msg--user" : "dk-msg--bot");
      var p = document.createElement("p");
      p.textContent = m.text;
      div.appendChild(p);
      body.appendChild(div);
      if (!m.user) addCopyButton(div);
    });
    body.scrollTop = body.scrollHeight;
  }

  function watchChatHistory(root) {
    var body = root.querySelector(".dk-panel__body");
    if (!body) return;
    var saveTimer = null;
    var observer = new MutationObserver(function () {
      // Debounce saves
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(function () { saveChatHistory(root); }, 1000);
    });
    observer.observe(body, { childList: true, subtree: true });
    // Also save when panel closes
    var panel = root.querySelector(".dk-panel");
    if (panel) {
      new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          if (m.attributeName === "class") {
            var isOpen = panel.classList.contains("open");
            if (!isOpen) saveChatHistory(root);
          }
        });
      }).observe(panel, { attributes: true });
    }
  }

  /**
   * Batch 3: Voice input via Web Speech API.
   * WHY: hands-free input, accessibility, mobile-friendly.
   */
  function addVoiceButton(root) {
    var foot = root.querySelector(".dk-panel__foot");
    if (!foot || foot.querySelector(".doki-voice-btn")) return;
    // Check browser support
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return; // Not supported, skip silently

    var input = foot.querySelector("input");
    var sendBtn = foot.querySelector("button");
    if (!input) return;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "doki-voice-btn";
    btn.innerHTML = "🎤";
    btn.setAttribute("aria-label", "Voice input");
    btn.title = "Voice input";

    var recog = null;
    var listening = false;

    btn.addEventListener("click", function () {
      if (listening && recog) {
        recog.stop();
        return;
      }
      try {
        recog = new SR();
        var lang = "en-US";
        try { lang = (window.DKI18N.getLang() || "en") + ""; } catch (e) {}
        var langMap = { en: "en-US", ur: "ur-PK", ar: "ar-SA", hi: "hi-IN", es: "es-ES", fr: "fr-FR", pt: "pt-BR", de: "de-DE", tr: "tr-TR", ru: "ru-RU" };
        recog.lang = langMap[lang] || "en-US";
        recog.interimResults = false;
        recog.maxAlternatives = 1;

        recog.onstart = function () {
          listening = true;
          btn.classList.add("doki-voice-active");
          btn.innerHTML = "🔴";
        };
        recog.onend = function () {
          listening = false;
          btn.classList.remove("doki-voice-active");
          btn.innerHTML = "🎤";
        };
        recog.onresult = function (e) {
          var text = e.results[0][0].transcript;
          if (text) {
            input.value = text;
            input.focus();
          }
        };
        recog.onerror = function () {
          listening = false;
          btn.classList.remove("doki-voice-active");
          btn.innerHTML = "🎤";
        };
        recog.start();
      } catch (e) {}
    });

    // Insert before send button
    if (sendBtn && sendBtn.parentNode === foot) {
      foot.insertBefore(btn, sendBtn);
    } else {
      foot.appendChild(btn);
    }
  }

  function privacyText() {
    try {
      if (window.DKI18N && window.DKI18N.t) {
        var t = window.DKI18N.t("doki_privacy");
        if (t && t !== "doki_privacy") return t;
      }
    } catch (e) {}
    // Fallback by language
    var lang = "en";
    try { lang = window.DKI18N.getLang() || "en"; } catch (e) {}
    var texts = {
      en: "Your chats stay in your browser — nothing is sent anywhere.",
      ur: "آپ کی چیٹ آپ کے براؤزر میں رہتی ہے — کہیں نہیں بھیجی جاتی۔",
      ar: "تبقى محادثاتك في متصفحك — لا يُرسل شيء إلى أي مكان.",
      hi: "आपकी चैट आपके ब्राउज़र में रहती है — कहीं नहीं भेजी जाती।",
      es: "Tus chats permanecen en tu navegador — nada se envía a ningún lado.",
      fr: "Vos discussions restent dans votre navigateur — rien n'est envoyé.",
      pt: "Suas conversas ficam no seu navegador — nada é enviado.",
      de: "Deine Chats bleiben in deinem Browser — nichts wird gesendet.",
      tr: "Sohbetleriniz tarayıcınızda kalır — hiçbir yere gönderilmez.",
      ru: "Ваши чаты остаются в вашем браузере — ничего никуда не отправляется."
    };
    return texts[lang] || texts.en;
  }

  function addPrivacyNote(root) {
    var panel = root.querySelector(".dk-panel");
    if (!panel || panel.querySelector(".doki-privacy-note")) return;
    var foot = root.querySelector(".dk-panel__foot");
    if (!foot) return;
    var note = document.createElement("div");
    note.className = "doki-privacy-note";
    note.innerHTML = '🔒 <span></span>';
    note.querySelector("span").textContent = privacyText();
    foot.parentNode.insertBefore(note, foot);
  }

  function addCopyButton(msg) {
    if (!msg || msg.querySelector(".doki-copy-btn")) return;
    // Don't add to typing indicator or empty messages
    if (msg.querySelector(".dk-typing")) return;
    var text = msg.innerText || msg.textContent;
    if (!text || !text.trim()) return;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "doki-copy-btn";
    btn.innerHTML = "📋";
    btn.setAttribute("aria-label", "Copy");
    btn.title = "Copy";
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var t = msg.innerText || msg.textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(function () {
          btn.innerHTML = "✅";
          setTimeout(function () { btn.innerHTML = "📋"; }, 1500);
        }).catch(function () { fallbackCopy(t, btn); });
      } else {
        fallbackCopy(t, btn);
      }
    });
    msg.appendChild(btn);
    // Batch 4: Add timestamp + feedback buttons
    addTimestamp(msg);
    if (msg.classList.contains("dk-msg--bot")) addFeedbackButtons(msg);
  }

  /**
   * Batch 4 #18: Timestamp on each message.
   */
  function addTimestamp(msg) {
    if (!msg || msg.querySelector(".doki-timestamp")) return;
    var ts = document.createElement("span");
    ts.className = "doki-timestamp";
    try {
      var now = new Date();
      var h = now.getHours(), m = now.getMinutes();
      var ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      ts.textContent = h + ":" + (m < 10 ? "0" : "") + m + " " + ampm;
    } catch (e) { ts.textContent = ""; }
    msg.appendChild(ts);
  }

  /**
   * Batch 4 #20: 👍👎 feedback on bot answers.
   */
  function addFeedbackButtons(msg) {
    if (!msg || msg.querySelector(".doki-feedback")) return;
    var wrap = document.createElement("span");
    wrap.className = "doki-feedback";
    var up = document.createElement("button");
    up.type = "button"; up.className = "doki-fb-btn"; up.innerHTML = "👍";
    up.setAttribute("aria-label", "Good answer"); up.title = "Good answer";
    var down = document.createElement("button");
    down.type = "button"; down.className = "doki-fb-btn"; down.innerHTML = "👎";
    down.setAttribute("aria-label", "Bad answer"); down.title = "Bad answer";
    function mark(chosen, other) {
      chosen.classList.add("doki-fb-active");
      other.classList.remove("doki-fb-active");
      try {
        var key = "doki_feedback_" + Date.now();
        window.localStorage.setItem(key, chosen === up ? "up" : "down");
      } catch (e) {}
    }
    up.addEventListener("click", function (e) { e.stopPropagation(); mark(up, down); });
    down.addEventListener("click", function (e) { e.stopPropagation(); mark(down, up); });
    wrap.appendChild(up); wrap.appendChild(down);
    msg.appendChild(wrap);
  }

  /**
   * Batch 4 #22: Clear chat button in panel header.
   */
  function addClearButton(root) {
    var head = root.querySelector(".dk-panel__head");
    if (!head || head.querySelector(".doki-clear-btn")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "doki-clear-btn";
    btn.innerHTML = "🗑️";
    btn.setAttribute("aria-label", "Clear chat");
    btn.title = "Clear chat";
    btn.addEventListener("click", function () {
      var body = root.querySelector(".dk-panel__body");
      if (body) {
        body.innerHTML = "";
        try { window.localStorage.removeItem(DOKI_HIST_KEY); } catch (e) {}
      }
    });
    // Insert before close button
    var close = head.querySelector(".dk-panel__close");
    if (close) head.insertBefore(btn, close);
    else head.appendChild(btn);
  }

  /**
   * Batch 4 #15: Press "/" to open Doki.
   */
  function initSlashShortcut(root) {
    if (initSlashShortcut.done) return;
    initSlashShortcut.done = true;
    document.addEventListener("keydown", function (e) {
      // Only when not typing in an input
      var tag = (e.target && e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        var panel = root.querySelector(".dk-panel");
        var fab = root.querySelector(".dk-fab");
        if (panel && !panel.classList.contains("open") && fab) {
          e.preventDefault();
          fab.click();
        }
      }
    });
  }

  /**
   * Batch 5 #8: Draggable FAB - user can position it anywhere.
   */
  function initDraggable(root) {
    if (initDraggable.done) return;
    initDraggable.done = true;
    var fab = root.querySelector(".dk-fab");
    if (!fab) return;
    // Restore saved position
    try {
      var pos = JSON.parse(window.localStorage.getItem("doki_fab_pos") || "null");
      if (pos && typeof pos.x === "number" && typeof pos.y === "number") {
        fab.style.left = pos.x + "px";
        fab.style.top = pos.y + "px";
        fab.style.right = "auto";
        fab.style.bottom = "auto";
      }
    } catch (e) {}

    var dragging = false, startX, startY, origX, origY;
    fab.addEventListener("mousedown", startDrag);
    fab.addEventListener("touchstart", startDrag, { passive: false });

    function startDrag(e) {
      // Only start drag on long-press (300ms) to avoid conflict with click
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var clientY = e.touches ? e.touches[0].clientY : e.clientY;
      var timer = setTimeout(function () {
        dragging = true;
        fab.classList.add("doki-dragging");
        var rect = fab.getBoundingClientRect();
        startX = clientX; startY = clientY;
        origX = rect.left; origY = rect.top;
        e.preventDefault();
      }, 300);
      function cancel() { clearTimeout(timer); }
      fab.addEventListener("mouseup", cancel, { once: true });
      fab.addEventListener("touchend", cancel, { once: true });
    }

    document.addEventListener("mousemove", doDrag);
    document.addEventListener("touchmove", doDrag, { passive: false });
    document.addEventListener("mouseup", endDrag);
    document.addEventListener("touchend", endDrag);

    function doDrag(e) {
      if (!dragging) return;
      e.preventDefault();
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var clientY = e.touches ? e.touches[0].clientY : e.clientY;
      var newX = Math.max(0, Math.min(window.innerWidth - 64, origX + clientX - startX));
      var newY = Math.max(0, Math.min(window.innerHeight - 64, origY + clientY - startY));
      fab.style.left = newX + "px";
      fab.style.top = newY + "px";
      fab.style.right = "auto";
      fab.style.bottom = "auto";
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      fab.classList.remove("doki-dragging");
      try {
        var rect = fab.getBoundingClientRect();
        window.localStorage.setItem("doki_fab_pos", JSON.stringify({ x: rect.left, y: rect.top }));
      } catch (e) {}
    }
  }

  /**
   * Batch 5 #30: "How to improve Doki?" feedback button in panel.
   */
  function addFeedbackRequestBtn(root) {
    var foot = root.querySelector(".dk-panel__foot");
    if (!foot || foot.querySelector(".doki-improve-btn")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "doki-improve-btn";
    var lang = "en";
    try { lang = window.DKI18N.getLang() || "en"; } catch (e) {}
    btn.textContent = lang === "ur" ? "💬 Doki کو کیسا بنائیں؟" : "💬 Improve Doki?";
    btn.addEventListener("click", function () {
      // Open the existing feedback modal if available
      var fbBtn = document.querySelector("[data-dkf-feedback-link]");
      if (fbBtn) fbBtn.click();
    });
    // Add above the footer
    var privacy = root.querySelector(".doki-privacy-note");
    if (privacy) privacy.parentNode.insertBefore(btn, privacy);
    else foot.parentNode.insertBefore(btn, foot);
    // Update on language change
    document.addEventListener("dokit:langchange", function () {
      var l = "en";
      try { l = window.DKI18N.getLang() || "en"; } catch (e) {}
      btn.textContent = l === "ur" ? "💬 Doki کو کیسا بنائیں؟" : "💬 Improve Doki?";
    });
  }

  /**
   * Batch 5 #3: Panda expressions - change based on state.
   * Adds classes that can swap the panda SVG or add emotion indicators.
   */
  function setPandaMood(root, mood) {
    var fab = root.querySelector(".dk-fab");
    if (!fab) return;
    fab.classList.remove("doki-mood-thinking", "doki-mood-happy", "doki-mood-sleeping");
    if (mood) fab.classList.add("doki-mood-" + mood);
  }
  // Expose for external use
  window.DokiSetMood = function (mood) {
    var root = document.getElementById("dk-assistant-root");
    if (root) setPandaMood(root, mood);
  };

  /**
   * Panel header panda avatar (user request Oct 9, 2026).
   * WHY: The header showed only "🎧 Doki" text; the panda brand was missing.
   * Inserts the same doki-panda.png used on the FAB at the start of the header.
   */
  function addPandaToHeader(root) {
    var head = root.querySelector(".dk-panel__head");
    if (!head || head.querySelector(".doki-head-panda")) return;
    var src = (typeof window.DKU === "function") ? window.DKU("/assets/doki-panda.png") : "/assets/doki-panda.png";
    var img = document.createElement("img");
    img.className = "doki-head-panda";
    img.src = src;
    img.alt = "Doki";
    img.draggable = false;
    head.insertBefore(img, head.firstChild);
  }

  /**
   * Side tabs for Improve + Privacy (user request Oct 9, 2026).
   * WHY: User wants "Doki کو کیسا بنائیں؟" and the privacy note as slim
   * tabs stuck to the panel's side edge. Hover → tab slides out smoothly
   * to reveal full content; mouse leaves → slides back and sticks.
   * The old inline .doki-improve-btn and .doki-privacy-note are removed
   * to avoid duplication.
   */
  function addSideTabs(root) {
    var panel = root.querySelector(".dk-panel");
    if (!panel || panel.querySelector(".doki-side-tabs")) return;

    // Remove old inline versions (avoid duplicates)
    var oldImprove = root.querySelector(".doki-improve-btn");
    if (oldImprove) oldImprove.remove();
    var oldPrivacy = root.querySelector(".doki-privacy-note");
    if (oldPrivacy) oldPrivacy.remove();

    var wrap = document.createElement("div");
    wrap.className = "doki-side-tabs";

    var lang = "en";
    try { lang = (window.DKI18N && window.DKI18N.getLang && window.DKI18N.getLang()) || "en"; } catch (e) {}
    var improveLabel = lang === "ur" ? "Doki کو کیسا بنائیں؟" : "Improve Doki?";

    // Tab 1: Improve Doki
    var tab1 = document.createElement("div");
    tab1.className = "doki-side-tab";
    tab1.innerHTML = '<span class="doki-side-tab-icon">💬</span><span class="doki-side-tab-text"></span>';
    tab1.querySelector(".doki-side-tab-text").textContent = improveLabel;
    tab1.setAttribute("role", "button");
    tab1.setAttribute("tabindex", "0");
    tab1.setAttribute("aria-label", improveLabel);
    function openFeedback() {
      var fbBtn = document.querySelector("[data-dkf-feedback-link]");
      if (fbBtn) fbBtn.click();
    }
    tab1.addEventListener("click", openFeedback);
    tab1.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFeedback(); } });

    // Tab 2: Privacy
    var tab2 = document.createElement("div");
    tab2.className = "doki-side-tab";
    tab2.innerHTML = '<span class="doki-side-tab-icon">🔒</span><span class="doki-side-tab-text"></span>';
    tab2.querySelector(".doki-side-tab-text").textContent = privacyText();
    tab2.setAttribute("aria-label", "Doki privacy");

    wrap.appendChild(tab1);
    wrap.appendChild(tab2);
    panel.appendChild(wrap);

    // Update labels on language change
    document.addEventListener("dokit:langchange", function () {
      var l = "en";
      try { l = (window.DKI18N && window.DKI18N.getLang && window.DKI18N.getLang()) || "en"; } catch (e) {}
      var texts = wrap.querySelectorAll(".doki-side-tab-text");
      if (texts[0]) texts[0].textContent = l === "ur" ? "Doki کو کیسا بنائیں؟" : "Improve Doki?";
      if (texts[1]) texts[1].textContent = privacyText();
    });
  }

  function initOfflineMessage(root) {
    if (initOfflineMessage.done) return;
    initOfflineMessage.done = true;
    function showOfflineNote() {
      var body = root.querySelector(".dk-panel__body");
      if (!body || body.querySelector(".doki-offline-note")) return;
      var panel = root.querySelector(".dk-panel");
      if (!panel || !panel.classList.contains("open")) return;
      var note = document.createElement("div");
      note.className = "dk-msg dk-msg--bot doki-offline-note";
      var lang = "en";
      try { lang = window.DKI18N.getLang() || "en"; } catch (e) {}
      var texts = {
        en: "📶 You're offline — Doki can still help with basic tools, but AI answers need internet.",
        ur: "📶 آپ آف لائن ہیں — ڈوکی بنیادی ٹولز میں مدد کر سکتا ہے، لیکن AI جوابات کے لیے انٹرنیٹ چاہیے۔"
      };
      note.innerHTML = "<p>" + (texts[lang] || texts.en) + "</p>";
      body.appendChild(note);
      body.scrollTop = body.scrollHeight;
    }
    window.addEventListener("offline", showOfflineNote);
    // Check on panel open
    var panel = root.querySelector(".dk-panel");
    if (panel) {
      new MutationObserver(function () {
        if (!window.navigator.onLine) showOfflineNote();
      }).observe(panel, { attributes: true, attributeFilter: ["class"] });
    }
  }

  /**
   * Batch 5 #4: Sleep mode when idle.
   */
  function initSleepMode(root) {
    if (initSleepMode.done) return;
    initSleepMode.done = true;
    var fab = root.querySelector(".dk-fab");
    if (!fab) return;
    var idleTimer = null;
    var IDLE_MS = 5 * 60 * 1000; // 5 minutes
    function goSleep() {
      fab.classList.add("doki-sleeping");
    }
    function wakeUp() {
      fab.classList.remove("doki-sleeping");
      resetTimer();
    }
    function resetTimer() {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(goSleep, IDLE_MS);
    }
    ["click", "mousemove", "keydown", "scroll", "touchstart"].forEach(function (ev) {
      document.addEventListener(ev, wakeUp, { passive: true });
    });
    fab.addEventListener("click", wakeUp);
    resetTimer();
  }

  function fallbackCopy(text, btn) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      btn.innerHTML = "✅";
      setTimeout(function () { btn.innerHTML = "📋"; }, 1500);
    } catch (e) {}
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
      "}",
      /* Batch 2: Copy button on bot messages */
      ".dk-msg--bot { position: relative; }",
      ".doki-copy-btn {",
      "  position: absolute;",
      "  top: 0.4rem;",
      "  inset-inline-end: 0.4rem;",
      "  inline-size: 1.75rem;",
      "  block-size: 1.75rem;",
      "  border: 1px solid var(--border, rgba(0,0,0,.12));",
      "  border-radius: 0.5rem;",
      "  background: var(--surface, #fff);",
      "  cursor: pointer;",
      "  font-size: 0.9rem;",
      "  line-height: 1;",
      "  opacity: 0;",
      "  transition: opacity 0.2s ease, transform 0.15s ease;",
      "}",
      ".dk-msg--bot:hover .doki-copy-btn,",
      ".dk-msg--bot:focus-within .doki-copy-btn { opacity: 1; }",
      ".doki-copy-btn:hover { transform: scale(1.1); }",
      ".doki-copy-btn:active { transform: scale(0.95); }",
      /* Batch 2: Privacy note */
      ".doki-privacy-note {",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  gap: 0.35rem;",
      "  padding: 0.5rem 1rem;",
      "  font-size: 0.75rem;",
      "  color: var(--text-muted, #888);",
      "  text-align: center;",
      "  border-top: 1px solid var(--border, rgba(0,0,0,.06));",
      "}",
      /* Batch 3: Voice input button */
      ".doki-voice-btn {",
      "  inline-size: 2.25rem;",
      "  block-size: 2.25rem;",
      "  border: 1px solid var(--border, rgba(0,0,0,.12));",
      "  border-radius: 50%;",
      "  background: var(--surface, #fff);",
      "  cursor: pointer;",
      "  font-size: 1.1rem;",
      "  line-height: 1;",
      "  flex-shrink: 0;",
      "  transition: transform 0.15s ease, background-color 0.15s ease;",
      "}",
      ".doki-voice-btn:hover { transform: scale(1.08); }",
      ".doki-voice-btn:active { transform: scale(0.95); }",
      ".doki-voice-btn.doki-voice-active {",
      "  background: #ef4444;",
      "  border-color: #ef4444;",
      "  animation: doki-voice-pulse 1s ease-in-out infinite;",
      "}",
      "@keyframes doki-voice-pulse {",
      "  0%, 100% { transform: scale(1); }",
      "  50% { transform: scale(1.12); }",
      "}",
      /* Batch 3: Message entrance animations */
      ".dk-msg {",
      "  animation: doki-msg-in 0.3s ease-out;",
      "}",
      "@keyframes doki-msg-in {",
      "  from { opacity: 0; transform: translateY(10px) scale(0.98); }",
      "  to { opacity: 1; transform: translateY(0) scale(1); }",
      "}",
      ".dk-msg--user { animation-name: doki-msg-in-user; }",
      "@keyframes doki-msg-in-user {",
      "  from { opacity: 0; transform: translateY(10px) translateX(10px); }",
      "  to { opacity: 1; transform: translateY(0) translateX(0); }",
      "}",
      ".dk-msg--bot { animation-name: doki-msg-in-bot; }",
      "@keyframes doki-msg-in-bot {",
      "  from { opacity: 0; transform: translateY(10px) translateX(-10px); }",
      "  to { opacity: 1; transform: translateY(0) translateX(0); }",
      "}",
      /* Batch 3: Chip hover bounce */
      ".dk-chips .chip {",
      "  transition: transform 0.15s ease, background-color 0.15s ease;",
      "}",
      ".dk-chips .chip:hover { transform: translateY(-2px) scale(1.03); }",
      ".dk-chips .chip:active { transform: translateY(0) scale(0.97); }",
      "@media (prefers-reduced-motion: reduce) {",
      "  .dk-msg { animation: none; }",
      "  .dk-chips .chip:hover { transform: none; }",
      "  .doki-voice-btn.doki-voice-active { animation: none; }",
      "}",
      /* Batch 4 #18: Timestamps */
      ".doki-timestamp {",
      "  display: block;",
      "  font-size: 0.65rem;",
      "  color: var(--text-muted, #aaa);",
      "  margin-top: 0.25rem;",
      "  text-align: end;",
      "}",
      /* Batch 4 #20: Feedback buttons */
      ".doki-feedback {",
      "  display: inline-flex;",
      "  gap: 0.25rem;",
      "  margin-inline-start: 0.5rem;",
      "  vertical-align: middle;",
      "}",
      ".doki-fb-btn {",
      "  border: 1px solid var(--border, rgba(0,0,0,.1));",
      "  border-radius: 0.4rem;",
      "  background: transparent;",
      "  cursor: pointer;",
      "  font-size: 0.8rem;",
      "  padding: 0.15rem 0.35rem;",
      "  line-height: 1;",
      "  opacity: 0.5;",
      "  transition: opacity 0.15s ease, transform 0.15s ease;",
      "}",
      ".doki-fb-btn:hover { opacity: 1; transform: scale(1.1); }",
      ".doki-fb-btn.doki-fb-active { opacity: 1; background: var(--surface-2, #f0edff); }",
      /* Batch 4 #22: Clear button */
      ".doki-clear-btn {",
      "  border: none;",
      "  background: transparent;",
      "  cursor: pointer;",
      "  font-size: 1.1rem;",
      "  padding: 0.25rem;",
      "  border-radius: 0.4rem;",
      "  opacity: 0.6;",
      "  transition: opacity 0.15s ease, transform 0.15s ease;",
      "}",
      ".doki-clear-btn:hover { opacity: 1; transform: scale(1.1); }",
      /* Batch 5: Sleep mode, dragging, moods */
      ".doki-fab.doki-sleeping .doki-fab-icon {",
      "  animation: doki-sleep 3s ease-in-out infinite;",
      "  filter: grayscale(0.4) brightness(0.9);",
      "}",
      "@keyframes doki-sleep {",
      "  0%, 100% { transform: translateY(0); }",
      "  50% { transform: translateY(2px); }",
      "}",
      ".doki-fab.doki-dragging {",
      "  cursor: grabbing !important;",
      "  z-index: 9999 !important;",
      "  transition: none !important;",
      "}",
      ".doki-fab.doki-mood-thinking .doki-fab-icon {",
      "  animation: doki-think 1s ease-in-out infinite;",
      "}",
      "@keyframes doki-think {",
      "  0%, 100% { transform: rotate(-8deg); }",
      "  50% { transform: rotate(8deg); }",
      "}",
      ".doki-fab.doki-mood-happy .doki-fab-icon {",
      "  animation: doki-happy 0.6s ease-in-out 3;",
      "}",
      "@keyframes doki-happy {",
      "  0%, 100% { transform: scale(1); }",
      "  50% { transform: scale(1.15); }",
      "}",
      /* Batch 5: Offline note */
      ".doki-offline-note {",
      "  background: #fef3c7 !important;",
      "  border: 1px solid #f59e0b !important;",
      "}",
      /* Batch 5: Improve button */
      ".doki-improve-btn {",
      "  display: block;",
      "  width: calc(100% - 2rem);",
      "  margin: 0.5rem 1rem;",
      "  padding: 0.5rem;",
      "  border: 1px dashed var(--border, rgba(0,0,0,.15));",
      "  border-radius: 0.6rem;",
      "  background: transparent;",
      "  color: var(--text-muted, #888);",
      "  font-size: 0.8rem;",
      "  cursor: pointer;",
      "  transition: background-color 0.15s ease;",
      "}",
      ".doki-improve-btn:hover {",
      "  background: var(--surface-2, #f5f3ff);",
      "  color: var(--text, inherit);",
      "}",
      /* Batch 5 #6: Mobile size optimization */
      "@media (max-width: 480px) {",
      "  .dk-fab.doki-fab {",
      "    inline-size: 3.25rem !important;",
      "    block-size: 3.25rem !important;",
      "  }",
      "  .doki-useme { font-size: 0.72rem; }",
      "}",
      /* User request Oct 9, 2026: panda avatar in panel header */
      ".doki-head-panda {",
      "  width: 2rem;",
      "  height: 2rem;",
      "  border-radius: 50%;",
      "  object-fit: cover;",
      "  background: #fff;",
      "  flex: none;",
      "  margin-inline-end: 0.5rem;",
      "}",
      /* User request Oct 9, 2026: side tabs (Improve + Privacy) */
      /* Slim tabs stuck to the panel's outer edge; hover slides them out */
      ".doki-side-tabs {",
      "  position: absolute;",
      "  inset-inline-end: 100%;",  /* stick to outer side of panel */
      "  top: 30%;",
      "  display: flex;",
      "  flex-direction: column;",
      "  gap: 0.5rem;",
      "  z-index: 5;",
      "}",
      ".doki-side-tab {",
      "  display: flex;",
      "  align-items: center;",
      "  gap: 0.5rem;",
      "  max-width: 2.5rem;",  /* collapsed: icon only */
      "  overflow: hidden;",
      "  white-space: nowrap;",
      "  background: var(--surface, #fff);",
      "  border: 1px solid var(--border, rgba(0,0,0,.12));",
      "  border-inline-end: none;",
      "  border-radius: 0.75rem 0 0 0.75rem;",
      "  padding: 0.6rem 0.55rem;",
      "  cursor: pointer;",
      "  box-shadow: -2px 2px 8px rgba(0,0,0,.08);",
      "  transition: max-width 0.35s cubic-bezier(0.4, 0, 0.2, 1),",
      "              background-color 0.2s ease, box-shadow 0.2s ease;",
      "}",
      "[dir='rtl'] .doki-side-tab {",
      "  border-radius: 0 0.75rem 0.75rem 0;",
      "  border-inline-end: 1px solid var(--border, rgba(0,0,0,.12));",
      "  border-inline-start: none;",
      "  box-shadow: 2px 2px 8px rgba(0,0,0,.08);",
      "}",
      ".doki-side-tab:hover,",
      ".doki-side-tab:focus-visible {",
      "  max-width: 16rem;",  /* expanded: full text */
      "  background: var(--surface-2, #f5f3ff);",
      "  box-shadow: -3px 3px 14px rgba(0,0,0,.12);",
      "}",
      ".doki-side-tab-icon {",
      "  font-size: 1.1rem;",
      "  flex: none;",
      "}",
      ".doki-side-tab-text {",
      "  font-size: 0.8rem;",
      "  color: var(--text, inherit);",
      "  opacity: 0;",
      "  transition: opacity 0.25s ease 0.1s;",
      "}",
      ".doki-side-tab:hover .doki-side-tab-text,",
      ".doki-side-tab:focus-visible .doki-side-tab-text {",
      "  opacity: 1;",
      "}",
      "@media (prefers-reduced-motion: reduce) {",
      "  .doki-side-tab { transition: none; }",
      "  .doki-side-tab-text { transition: none; opacity: 1; }",
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
