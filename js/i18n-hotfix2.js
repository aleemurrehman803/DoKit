/* DoKit i18n hotfix - permanent architectural fixes for hardcoded strings */
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
  
  // Re-apply translations to dynamically created elements on language change
  function reapply() {
    // Recently used section
    var recent = document.getElementById('home-recent');
    if (recent) {
      recent.setAttribute('aria-label', T('recent_tools_label', 'Recently used tools'));
      var h = recent.querySelector('.dkf-recent__title');
      if (h) h.textContent = T('recent_title', '🕘 Recently used');
    }
  }
  
  document.addEventListener('dokit:langchange', function() {
    setTimeout(reapply, 100);
  });
  
  // Also run on load
  if (document.readyState === 'complete') {
    setTimeout(reapply, 500);
  } else {
    window.addEventListener('load', function() { setTimeout(reapply, 500); });
  }
})();
