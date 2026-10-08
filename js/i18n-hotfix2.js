/* DoKit i18n hotfix v4 - DIRECT text replacement (bypass DKI18N) */
(function() {
  var URDU = {
    news_title: "📧 نئے ٹولز سب سے پہلے حاصل کریں",
    news_subscribe: "سبسکرائب کریں",
    news_email_ph: "ای میل ایڈریس"
  };
  
  function fixNewsletter() {
    try {
      // Only run for Urdu
      var lang = document.documentElement.lang || '';
      try {
        var m = location.search.match(/[?&]lang=([a-z]+)/);
        if (m) lang = m[1];
      } catch(e) {}
      if (lang !== 'ur') return;
      
      var label = document.querySelector('.dkf-news__label');
      if (label && label.textContent.indexOf('Get new tools') >= 0) {
        label.textContent = URDU.news_title;
      }
      
      var btn = document.querySelector('.dkf-news__btn');
      if (btn && btn.textContent.trim() === 'Subscribe') {
        btn.textContent = URDU.news_subscribe;
      }
      
      var input = document.querySelector('.dkf-news__input');
      if (input && input.placeholder === 'Email address') {
        input.placeholder = URDU.news_email_ph;
        input.setAttribute('aria-label', URDU.news_email_ph);
      }
    } catch(e) {}
  }
  
  // Run aggressively
  [500, 1200, 2500, 5000, 8000].forEach(function(d) {
    setTimeout(fixNewsletter, d);
  });
  
  // Watch for DOM changes
  try {
    new MutationObserver(function() { fixNewsletter(); })
      .observe(document.body, {childList: true, subtree: true});
  } catch(e) {}
})();
