// DoKit i18n patches - small fixes that don't need full i18n-v2.js push
;(function(){
  function __dkAdd(l,d){if(window.DKI18N&&typeof window.DKI18N.add==="function"){window.DKI18N.add(l,d);}else{(window.__DKI18N_QUEUE__=window.__DKI18N_QUEUE__||[]).push([l,d]);if(window.console&&console.warn)console.warn("[i18n] DKI18N not ready - queued dict for "+l);}}
  // Fix duplicate "coming soon" (badge already says it)
  __dkAdd("en", {
    tool_typefight_desc:"Typing battles"
  });
  __dkAdd("ur", {
    tool_typefight_desc:"ٹائپنگ مقابلے"
  });
  // More professional footer label
  __dkAdd("en", {
    nav_coming_soon:"Roadmap"
  });
  __dkAdd("ur", {
    nav_coming_soon:"روڈ میپ"
  });
})();
