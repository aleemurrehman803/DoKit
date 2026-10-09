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

/* Back-to-top button - added per user request */
(function() {
  function isUrdu() {
    try {
      var m = location.search.match(/[?&]lang=([a-z]+)/);
      return m && m[1] === 'ur';
    } catch(e) { return false; }
  }
  
  function createBackToTop() {
    if (document.getElementById('dk-backtop')) return;
    
    var btn = document.createElement('button');
    btn.id = 'dk-backtop';
    btn.innerHTML = '↑';
    btn.style.cssText = 'position:fixed;bottom:80px;right:20px;width:44px;height:44px;border-radius:50%;background:#2563eb;color:#fff;border:none;font-size:20px;cursor:pointer;display:none;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
    
    function updateLabel() {
      btn.setAttribute('aria-label', isUrdu() ? 'اوپر جائیں' : 'Back to top');
      btn.title = isUrdu() ? 'اوپر جائیں' : 'Back to top';
    }
    updateLabel();
    
    btn.addEventListener('click', function() {
      window.scrollTo({top: 0, behavior: 'smooth'});
    });
    
    window.addEventListener('scroll', function() {
      btn.style.display = window.scrollY > 300 ? 'block' : 'none';
    }, {passive: true});
    
    document.addEventListener('dokit:langchange', updateLabel);
    
    document.body.appendChild(btn);
  }
  
  if (document.readyState === 'complete') {
    setTimeout(createBackToTop, 1000);
  } else {
    window.addEventListener('load', function() { setTimeout(createBackToTop, 1000); });
  }
})();

/* Demo textarea fix */
(function() {
  function fixDemo() {
    try {
      var m = location.search.match(/[?&]lang=([a-z]+)/);
      if (!m || m[1] !== 'ur') return;
      var ta = document.getElementById('demoText');
      if (ta && ta.value.indexOf('DoKit makes everyday tasks') === 0) {
        ta.value = 'ڈوکٹ روزمرہ کے کام تیز، مفت اور نجی بناتا ہے۔';
      }
    } catch(e) {}
  }
  [800, 2000, 4000].forEach(function(d) { setTimeout(fixDemo, d); });
})();

/* Direct DOM fix for Board Photo card and Design System link - bypasses timing issues */
(function() {
  function isUrdu() {
    try {
      var m = location.search.match(/[?&]lang=([a-z]+)/);
      if (m) return m[1] === 'ur';
      try { return localStorage.getItem('dokit_lang') === 'ur'; } catch(e) {}
    } catch(e) {}
    return document.documentElement.lang === 'ur';
  }
  
  function fixBoardPhotoAndDesignSystem() {
    if (!isUrdu()) return;
    try {
      // Fix Board Photo tool card - find by raw key text
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      var node;
      var toFix = [];
      while (node = walker.nextNode()) {
        var t = node.nodeValue;
        if (t && (t.indexOf('Tool boardphoto name') >= 0 || t.indexOf('Tool boardphoto desc') >= 0)) {
          toFix.push(node);
        }
      }
      toFix.forEach(function(n) {
        if (n.nodeValue.indexOf('Tool boardphoto name') >= 0) {
          n.nodeValue = n.nodeValue.replace(/Tool boardphoto name/g, '🎓 بورڈ فوٹو');
        }
        if (n.nodeValue.indexOf('Tool boardphoto desc') >= 0) {
          n.nodeValue = n.nodeValue.replace(/Tool boardphoto desc/g, 'بورڈ کی تصویر سے صاف ڈاکومنٹ بنائیں');
        }
      });
      
      // Fix Design System link - find by text or href
      var links = document.querySelectorAll('a');
      links.forEach(function(a) {
        var txt = (a.textContent || '').trim();
        if (txt === '🎨 Design System' || txt === 'Design System') {
          // Preserve emoji, replace text
          a.innerHTML = a.innerHTML.replace(/Design System/g, 'ڈیزائن سسٹم');
        }
      });
    } catch(e) {}
  }
  
  // Run multiple times + observe DOM changes
  [1000, 2500, 5000, 8000, 12000].forEach(function(d) {
    setTimeout(fixBoardPhotoAndDesignSystem, d);
  });
  
  try {
    new MutationObserver(function() { fixBoardPhotoAndDesignSystem(); })
      .observe(document.body, {childList: true, subtree: true, characterData: true});
  } catch(e) {}
})();
