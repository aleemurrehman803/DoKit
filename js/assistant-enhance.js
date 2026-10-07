/**
 * DoKit — Assistant Enhancement Module (Voice + File Upload)
 * ============================================================
 * WHAT: Adds voice input (🎤) and file upload (📎) buttons to Doki assistant.
 *       Works alongside assistant.js without modifying it (progressive enhancement).
 *
 * WHY: Modern assistants (ChatGPT, etc.) support voice and files. Users expect
 *      these features. Voice helps mobile users; file upload helps with images.
 *
 * HOW IT WORKS:
 *   1. MutationObserver watches for .dk-panel__foot (assistant footer)
 *   2. When found, injects 🎤 voice button and 📎 file button
 *   3. VOICE: Uses Web Speech API (SpeechRecognition) → transcribes to text input
 *      - Auto-detects language (ur-PK for Urdu, en-US otherwise)
 *      - Visual feedback: 🎤 → 🔴 while recording
 *   4. FILE: Hidden <input type="file"> → on select:
 *      - Images: shown as preview in chat + contextual tool suggestions
 *      - Other files: shown as attachment + generic help message
 *
 * BROWSER SUPPORT:
 *   - Voice: Chrome/Edge (webkitSpeechRecognition). Others show alert.
 *   - File: All modern browsers (FileReader API)
 *
 * SECURITY:
 *   - Files never uploaded to server (preview via data URL only)
 *   - Image preview uses FileReader (no server round-trip)
 *
 * @module AssistantEnhance
 */
(function () {
  "use strict";

  /**
   * Initialize enhancements. Called on DOMContentLoaded (or immediately).
   * WHY MutationObserver: assistant.js builds the panel footer asynchronously.
   * We observe #dk-assistant-root and enhance the footer the moment it appears.
   * The dataset.enhanced flag prevents double-enhancement if the observer fires twice.
   * If #dk-assistant-root doesn't exist (page without assistant), we exit silently.
   */
  function init() {
    var root = document.getElementById("dk-assistant-root");
    if (!root) return;

    // Watch for the panel footer to be built
    var observer = new MutationObserver(function () {
      var foot = root.querySelector(".dk-panel__foot");
      if (foot && !foot.dataset.enhanced) {
        foot.dataset.enhanced = "1";
        enhanceFooter(foot);
      }
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  /**
   * Inject voice (🎤) and file (📎) buttons into the assistant's input footer.
   * WHY separate module (not editing assistant.js): assistant.js is shared and
   * minified in places. This progressive-enhancement approach adds features
   * without touching the core — if this script fails, the assistant still works.
   * Buttons are inserted BEFORE the send button for natural left-to-right order.
   * @param {HTMLElement} foot - The .dk-panel__foot element containing input + send btn.
   */
  function enhanceFooter(foot) {
    var input = foot.querySelector("input");
    var sendBtn = foot.querySelector("button.btn-primary");
    if (!input) return;

    // --- Voice button ---
    var voiceBtn = document.createElement("button");
    voiceBtn.type = "button";
    voiceBtn.className = "btn btn-sm";
    voiceBtn.textContent = "🎤";
    voiceBtn.setAttribute("aria-label", "Voice input");
    voiceBtn.title = "Speak your question";
    voiceBtn.style.marginRight = "0.25rem";

    var recognizing = false;
    var recognition = null;

    voiceBtn.addEventListener("click", function () {
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        alert("Voice input not supported in this browser. Try Chrome.");
        return;
      }
      if (recognizing && recognition) {
        recognition.stop();
        return;
      }
      try {
        recognition = new SR();
        recognition.lang = "en-US"; // Could detect from DKI18N.getLang()
        try {
          var lang = window.DKI18N && DKI18N.getLang ? DKI18N.getLang() : "en";
          if (lang === "ur") recognition.lang = "ur-PK";
        } catch (e) {}
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = function () {
          recognizing = true;
          voiceBtn.textContent = "🔴";
          voiceBtn.setAttribute("aria-label", "Stop recording");
        };
        recognition.onend = function () {
          recognizing = false;
          voiceBtn.textContent = "🎤";
          voiceBtn.setAttribute("aria-label", "Voice input");
        };
        recognition.onresult = function (ev) {
          var text = ev.results[0][0].transcript || "";
          if (text.trim()) {
            input.value = text.trim();
            input.focus();
          }
        };
        recognition.onerror = function () {
          recognizing = false;
          voiceBtn.textContent = "🎤";
        };
        recognition.start();
      } catch (e) {}
    });

    // --- File button ---
    var fileBtn = document.createElement("button");
    fileBtn.type = "button";
    fileBtn.className = "btn btn-sm";
    fileBtn.textContent = "📎";
    fileBtn.setAttribute("aria-label", "Attach a file");
    fileBtn.title = "Attach an image or file";
    fileBtn.style.marginRight = "0.25rem";

    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*,.pdf,.txt,.doc,.docx";
    fileInput.style.display = "none";
    fileInput.setAttribute("aria-hidden", "true");

    fileBtn.addEventListener("click", function () { fileInput.click(); });

    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;

      // Show file in chat as user message
      var body = root.querySelector(".dk-panel__body");
      if (body) {
        var msgDiv = document.createElement("div");
        msgDiv.className = "dk-msg dk-msg--user";
        
        if (file.type.startsWith("image/")) {
          // Show image preview
          var reader = new FileReader();
          reader.onload = function (e) {
            var img = document.createElement("img");
            img.src = e.target.result;
            img.style.maxWidth = "200px";
            img.style.borderRadius = "8px";
            img.alt = file.name;
            msgDiv.appendChild(img);
            var cap = document.createElement("p");
            cap.textContent = "📎 " + file.name;
            cap.style.margin = "0.25rem 0 0";
            cap.style.fontSize = "0.85em";
            msgDiv.appendChild(cap);
            body.appendChild(msgDiv);
            body.scrollTop = body.scrollHeight;
            // Bot responds with contextual help
            respondToFile(file, body);
          };
          reader.readAsDataURL(file);
        } else {
          var p = document.createElement("p");
          p.textContent = "📎 " + file.name + " (" + Math.round(file.size / 1024) + " KB)";
          msgDiv.appendChild(p);
          body.appendChild(msgDiv);
          body.scrollTop = body.scrollHeight;
          respondToFile(file, body);
        }
      }
      fileInput.value = ""; // reset
    });

    /**
     * Generate Doki's response after a user uploads a file.
     * WHY contextual (not generic): If it's an image, we link the 3 image tools
     * directly — that's almost certainly what they want. For other files, we
     * suggest text tools. The 600ms delay feels natural (like Doki "read" the file).
     * WHY FileReader (not upload): Files never leave the device. Preview is via
     * data URL. Privacy-preserving by design — matches DoKit's "files never leave
     * your browser" promise.
     * @param {File} file - The uploaded file object.
     * @param {HTMLElement} body - Chat body element to append messages to.
     */
    function respondToFile(file, body) {
      // Bot response with helpful suggestions
      var botDiv = document.createElement("div");
      botDiv.className = "dk-msg dk-msg--bot";
      var p = document.createElement("p");
      
      if (file.type.startsWith("image/")) {
        p.innerHTML = "I see you uploaded an image! You can:<br>" +
          "• <strong>Resize</strong> it with <a href='" + (window.DKU ? DKU("/tools/image-resizer/") : "/tools/image-resizer/") + "'>Image Resizer</a><br>" +
          "• <strong>Compress</strong> it with <a href='" + (window.DKU ? DKU("/tools/image-compressor/") : "/tools/image-compressor/") + "'>Image Compressor</a><br>" +
          "• <strong>Convert</strong> format with <a href='" + (window.DKU ? DKU("/tools/image-converter/") : "/tools/image-converter/") + "'>Image Converter</a>";
      } else {
        p.textContent = "File received! If it's text, try our Word Counter or Case Converter tools.";
      }
      botDiv.appendChild(p);
      // Small delay for natural feel
      setTimeout(function () {
        body.appendChild(botDiv);
        body.scrollTop = body.scrollHeight;
      }, 600);
    }

    // Insert buttons before the send button
    if (sendBtn) {
      foot.insertBefore(voiceBtn, sendBtn);
      foot.insertBefore(fileBtn, sendBtn);
    } else {
      foot.appendChild(voiceBtn);
      foot.appendChild(fileBtn);
    }
    foot.appendChild(fileInput);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
