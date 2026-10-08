/* DoKit i18n hotfix v5 - correct selectors */
(function() {
  var URDU = {
    news_subscribe: "سبسکرائب کریں",
    news_email_ph: "ای میل ایڈریس"
  };
  
  function fixNewsletter() {
    try {
      var lang = '';
      try {
        var m = location.search.match(/[?&]lang=([a-z]+)/);
        if (m) lang = m[1];
      } catch(e) {}
      if (lang !== 'ur') return;
      
      // Button: find by data-i18n attribute
      var btn = document.querySelector('[data-i18n="news_subscribe"]');
      if (btn && btn.textContent.trim() === 'Subscribe') {
        btn.textContent = URDU.news_subscribe;
      }
      
      // Input: find by class
      var input = document.querySelector('.dkf-news__input');
      if (input && input.placeholder === 'you@example.com') {
        input.placeholder = URDU.news_email_ph;
        input.setAttribute('aria-label', URDU.news_email_ph);
      }
    } catch(e) {}
  }
  
  [500, 1200, 2500, 5000, 8000, 12000].forEach(function(d) {
    setTimeout(fixNewsletter, d);
  });
  
  try {
    new MutationObserver(function() { fixNewsletter(); })
      .observe(document.body, {childList: true, subtree: true});
  } catch(e) {}
})();
