/* DoKit i18n comprehensive hotfix - ALL remaining issues at once */
(function() {
  var UR = {
    news_subscribe: "سبسکرائب کریں",
    news_email_ph: "ای میل ایڈریس",
    kb_title: "کی بورڈ شارٹ کٹس",
    kb_search: "سائٹ کی تلاش پر توجہ دیں",
    kb_alltools: "تمام ٹولز پر جائیں",
    kb_help: "یہ شارٹ کٹ مدد دکھائیں",
    kb_close: "ڈائیلاگ بند کریں",
    kb_close_btn: "بند کریں",
    fb_title: "آراء",
    fb_cancel: "منسوخ کریں",
    fb_submit: "جمع کرائیں",
    back_top: "اوپر جائیں",
    send_fb: "آراء بھیجیں"
  };
  
  function isUrdu() {
    try {
      var m = location.search.match(/[?&]lang=([a-z]+)/);
      return m && m[1] === 'ur';
    } catch(e) { return false; }
  }
  
  function fixAll() {
    if (!isUrdu()) return;
    try {
      // Newsletter button
      var btn = document.querySelector('[data-i18n="news_subscribe"]');
      if (btn && btn.textContent.trim() === 'Subscribe') btn.textContent = UR.news_subscribe;
      
      // Newsletter input
      var input = document.querySelector('.dkf-news__input');
      if (input) {
        if (input.placeholder === 'you@example.com' || input.placeholder === 'Email address') {
          input.placeholder = UR.news_email_ph;
        }
        var al = input.getAttribute('aria-label');
        if (al === 'Email address') input.setAttribute('aria-label', UR.news_email_ph);
      }
      
      // Shortcuts modal (if open)
      var modal = document.querySelector('.dkf-modal');
      if (modal) {
        var title = modal.querySelector('.dkf-modal__title');
        if (title && title.textContent.indexOf('Keyboard shortcuts') >= 0) {
          title.textContent = title.textContent.replace('Keyboard shortcuts', UR.kb_title);
        }
        // Fix rows
        var rows = modal.querySelectorAll('.dkf-shortcut-row');
        rows.forEach(function(r) {
          var t = r.textContent;
          if (t.indexOf('Focus the site search') >= 0) r.innerHTML = r.innerHTML.replace('Focus the site search', UR.kb_search);
          else if (t.indexOf('Go to All Tools') >= 0) r.innerHTML = r.innerHTML.replace('Go to All Tools', UR.kb_alltools);
          else if (t.indexOf('Show this shortcuts help') >= 0) r.innerHTML = r.innerHTML.replace('Show this shortcuts help', UR.kb_help);
          else if (t.indexOf('Close dialogs') >= 0) r.innerHTML = r.innerHTML.replace('Close dialogs', UR.kb_close);
        });
        // Close button
        var closeBtns = modal.querySelectorAll('button');
        closeBtns.forEach(function(b) {
          if (b.textContent.trim() === 'Close') b.textContent = UR.kb_close_btn;
          if (b.textContent.trim() === 'Cancel') b.textContent = UR.fb_cancel;
          if (b.textContent.trim() === 'Submit') b.textContent = UR.fb_submit;
        });
      }
      
      // Back to top
      var btt = document.querySelector('[aria-label="Back to top"]');
      if (btt) btt.setAttribute('aria-label', UR.back_top);
      
      // Feedback buttons
      document.querySelectorAll('button').forEach(function(b) {
        var t = b.textContent.trim();
        var al = b.getAttribute('aria-label') || '';
        if (al.indexOf('Send feedback') >= 0) b.setAttribute('aria-label', UR.send_fb);
        if (al.indexOf('Keyboard shortcuts') >= 0 && al.indexOf('?') < 0) b.setAttribute('aria-label', UR.kb_title);
      });
    } catch(e) {}
  }
  
  [600, 1500, 3000, 6000, 10000].forEach(function(d) { setTimeout(fixAll, d); });
  try {
    new MutationObserver(function() { fixAll(); }).observe(document.body, {childList: true, subtree: true});
  } catch(e) {}
  document.addEventListener('dokit:langchange', function() { setTimeout(fixAll, 300); });
})();
