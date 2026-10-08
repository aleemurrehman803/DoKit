/* DoKit i18n hotfix v3 - aggressive re-translation */
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
  
  function fixAll() {
    try {
      // 1. Force DKI18N re-apply
      if (window.DKI18N && window.DKI18N.apply) {
        window.DKI18N.apply();
      }
      
      // 2. Newsletter - direct targeting
      var nlLabel = document.querySelector('.dkf-news__label');
      if (nlLabel) {
        var urduText = T('news_title', null);
        if (urduText && urduText !== 'news_title') {
          nlLabel.textContent = urduText;
        }
      }
      
      // 3. Newsletter button
      var nlBtn = document.querySelector('.dkf-news__btn');
      if (nlBtn) {
        var btnText = T('news_subscribe', null);
        if (btnText && btnText !== 'news_subscribe') {
          nlBtn.textContent = btnText;
        }
      }
      
      // 4. Newsletter input placeholder
      var nlInput = document.querySelector('.dkf-news__input');
      if (nlInput) {
        var ph = T('news_email_ph', null);
        if (ph && ph !== 'news_email_ph') {
          nlInput.placeholder = ph;
          nlInput.setAttribute('aria-label', ph);
        }
      }
      
      // 5. Recently used
      var recent = document.getElementById('home-recent');
      if (recent) {
        var rt = T('recent_tools_label', null);
        if (rt && rt !== 'recent_tools_label') recent.setAttribute('aria-label', rt);
        var h = recent.querySelector('.dkf-recent__title');
        if (h) {
          var ht = T('recent_title', null);
          if (ht && ht !== 'recent_title') h.textContent = ht;
        }
      }
    } catch(e) {}
  }
  
  // Run aggressively
  [800, 2000, 4000, 7000, 10000].forEach(function(d) {
    setTimeout(fixAll, d);
  });
  
  document.addEventListener('dokit:langchange', function() {
    setTimeout(fixAll, 300);
  });
})();
