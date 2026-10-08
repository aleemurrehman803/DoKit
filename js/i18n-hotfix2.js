/* DoKit i18n hotfix v2 - force re-translation of dynamic elements */
(function() {
  function T(k, fb) {
    try {
      if (window.DKI18N && window.DKI18N.t) {
        var v = window.DKI18N.t(k);
        if (v && v !== k) return v;
      }
    } catch(e) {}
    return fb;
  }
  
  function forceRetranslate() {
    try {
      // Force DKI18N to re-apply all translations
      if (window.DKI18N && window.DKI18N.apply) {
        window.DKI18N.apply();
      }
      
      // Specifically fix newsletter
      var nlTitle = document.querySelector('[data-i18n="news_title"]');
      if (nlTitle) nlTitle.textContent = T('news_title', '📧 Get new tools first');
      
      // Fix recently used
      var recent = document.getElementById('home-recent');
      if (recent) {
        recent.setAttribute('aria-label', T('recent_tools_label', 'Recently used tools'));
        var h = recent.querySelector('.dkf-recent__title');
        if (h) h.textContent = T('recent_title', '🕘 Recently used');
      }
      
      // Dispatch langchange to trigger other handlers
      try {
        document.dispatchEvent(new CustomEvent('dokit:langchange'));
      } catch(e) {}
    } catch(e) {}
  }
  
  // Run multiple times to catch late-loading elements
  [500, 1500, 3000, 5000].forEach(function(delay) {
    setTimeout(forceRetranslate, delay);
  });
  
  // Also on language change
  document.addEventListener('dokit:langchange', function() {
    setTimeout(forceRetranslate, 200);
  });
})();
