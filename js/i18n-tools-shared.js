/* DoKit — shared tool-page i18n keys (js/i18n-tools-shared.js)
 * Small supplemental dictionary for tool-page strings that live in no other
 * dict. Loaded by tool pages after i18n-v2.js. Same pattern as i18n-patch.js.
 * CSP: plain script, no inline handlers, no eval. */
(function () {
  function __dkAdd(l,d){if(window.DKI18N&&typeof window.DKI18N.add==="function"){window.DKI18N.add(l,d);}else{(window.__DKI18N_QUEUE__=window.__DKI18N_QUEUE__||[]).push([l,d]);if(window.console&&console.warn)console.warn("[i18n] DKI18N not ready - queued dict for "+l);}}
  __dkAdd("en", {
    "tshared.try_it": "Try it \u2192",
    "tshared.step_add_text": "Add your text",
    "tshared.step_live_stats": "See live stats",
    "tshared.step_choose_case": "Choose a case",
    "tshared.step_copy": "Copy results",
    "tshared.privacy_text": "\uD83D\uDD12 Text never leaves your device \u2014 100% private."
  });
  __dkAdd("ur", {
    "tshared.try_it": "\u2190 \u0622\u0632\u0645\u0627\u0626\u06cc\u06ba",
    "tshared.step_add_text": "\u0627\u067e\u0646\u0627 \u0645\u062a\u0646 \u0634\u0627\u0645\u0644 \u06a9\u0631\u06cc\u06ba",
    "tshared.step_live_stats": "\u0628\u0631\u0627\u06c1\u0650 \u0631\u0627\u0633\u062a \u0627\u0639\u062f\u0627\u062f \u062f\u06cc\u06a9\u06be\u06cc\u06ba",
    "tshared.step_choose_case": "\u0627\u0646\u062f\u0627\u0632 \u0645\u0646\u062a\u062e\u0628 \u06a9\u0631\u06cc\u06ba",
    "tshared.step_copy": "\u0646\u062a\u0627\u0626\u062c \u06a9\u0627\u067e\u06cc \u06a9\u0631\u06cc\u06ba",
    "tshared.privacy_text": "\uD83D\uDD12 \u0622\u067e \u06a9\u0627 \u0645\u062a\u0646 \u0688\u06cc\u0648\u0627\u0626\u0633 \u0633\u06d2 \u0628\u0627\u06c1\u0631 \u0646\u06c1\u06cc\u06ba \u062c\u0627\u062a\u0627 \u2014 100% \u0646\u062c\u06cc\u06d4"
  });
})();
