// DoKit i18n patches - small fixes that don't need full i18n-v2.js push
;(function(){
  if (!window.DKI18N || !window.DKI18N.add) return;
  // Fix duplicate "coming soon" (badge already says it)
  window.DKI18N.add("en", {
    tool_typefight_desc:"Typing battles"
  });
  window.DKI18N.add("ur", {
    tool_typefight_desc:"ٹائپنگ مقابلے"
  });
  // More professional footer label
  window.DKI18N.add("en", {
    nav_coming_soon:"Roadmap"
  });
  window.DKI18N.add("ur", {
    nav_coming_soon:"روڈ میپ"
  });
})();
