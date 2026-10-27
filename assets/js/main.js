
(function(){
var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// mobile nav
var t = document.getElementById('nav-toggle'), l = document.getElementById('nav-links');
if(t && l){ t.addEventListener('click', function(){ var open = l.classList.toggle('open'); t.setAttribute('aria-expanded', open ? 'true' : 'false'); }); }
// active nav
try{
  var here = new URL(window.location.href).pathname.replace(/\/index\.html$/, '/');
  document.querySelectorAll('#nav-links a').forEach(function(a){
    var p = new URL(a.href, window.location.href).pathname.replace(/\/index\.html$/, '/');
    if(p === here){ a.classList.add('active'); }
  });
}catch(e){}
// reveal on scroll
if('IntersectionObserver' in window && !reduced){
  var io = new IntersectionObserver(function(es){ es.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } }); }, {threshold: .12});
  document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
} else { document.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('in'); }); }
// tool search filter
var s = document.getElementById('tool-search');
if(s){
  s.addEventListener('input', function(){
    var q = s.value.trim().toLowerCase();
    document.querySelectorAll('.tool-card').forEach(function(c){
      var name = (c.getAttribute('data-name') || '').toLowerCase();
      c.style.display = (!q || name.indexOf(q) !== -1) ? '' : 'none';
    });
  });
}
// hero particles
var cv = document.getElementById('hero-canvas');
var paused = false;
if(cv){
  var ctx = cv.getContext('2d'), W, H, parts = [];
  function size(){ var r = cv.parentElement.getBoundingClientRect(); W = cv.width = r.width; H = cv.height = r.height; }
  function mk(){ parts = []; var n = Math.min(70, Math.floor(W / 14));
    for(var i = 0; i < n; i++){ parts.push({x: Math.random()*W, y: Math.random()*H, r: 1 + Math.random()*2.2, vx: (Math.random()-.5)*.35, vy: (Math.random()-.5)*.35, c: Math.random() < .8 ? '108,76,241' : '255,197,49'}); } }
  function draw(){
    ctx.clearRect(0, 0, W, H);
    parts.forEach(function(p){
      p.x += p.vx; p.y += p.vy;
      if(p.x < 0 || p.x > W) p.vx *= -1; if(p.y < 0 || p.y > H) p.vy *= -1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fillStyle = 'rgba(' + p.c + ',.8)'; ctx.fill();
    });
    if(!paused && !reduced){ requestAnimationFrame(draw); }
  }
  size(); mk(); draw();
  window.addEventListener('resize', function(){ size(); mk(); if(paused || reduced){ ctx.clearRect(0,0,W,H); parts.forEach(function(p){ ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle='rgba('+p.c+',.8)'; ctx.fill(); }); } });
  var pb = document.getElementById('pause-motion');
  if(pb){ pb.addEventListener('click', function(){
    paused = !paused; pb.textContent = paused ? dkT('rsv_1003', 'Resume motion') : dkT('rsv_0433', 'Pause motion');
    if(!paused && !reduced){ draw(); }
  }); }
  if(reduced){ ctx.clearRect(0,0,W,H); parts.forEach(function(p){ ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle='rgba('+p.c+',.8)'; ctx.fill(); }); }
}
// WHY (i18n): JS-rendered strings (rotator words, chat link labels)
// must translate like tagged HTML. dkT() reads the deployed dict via
// the i18n engine when it has loaded; otherwise it returns the English
// fallback, so pages never break before i18n.js arrives. Exposed as
// window.dkT so tools.js can share the same helper (no copy-paste).
function dkT(key, fallback){
  try{
    var eng = window.DK_I18N || window.DKI18N;
    if(key && eng && typeof eng.t === 'function'){
      var v = eng.t(key);
      if(v) return v;
    }
  }catch(e){}
  return fallback;
}
window.dkT = dkT;
// typing headline rotator (words as [dict key, English fallback] so the
// headline translates; Board Photo falls back to English outside ur,
// exactly as the old site left it untranslated in 8 languages).
var rot = document.getElementById('type-rotator');
if(rot){
  var words = [['tool_resizer_name','Image Resizer'],['tool_compressor_name','Image Compressor'],['tool_converter_name','Image Converter'],['tool_counter_name','Word Counter'],['tool_case_name','Case Converter'],['test_title','Typing Test'],['bp.title','Board Photo'],['cs2_t','Password Generator'],['cs4_t','Unit Converter'],['cs1_t','QR Generator']];
  if(reduced){
    rot.textContent = dkT(words[0][0], words[0][1]);
    document.addEventListener('dokit:langchange', function(){ rot.textContent = dkT(words[0][0], words[0][1]); });
  }
  else{
    var wi = 0, ci = 0, del = false;
    (function tick(){
      var w = dkT(words[wi][0], words[wi][1]);
      rot.textContent = w.slice(0, ci);
      if(!del){ ci++; if(ci > w.length){ del = true; setTimeout(tick, 1400); return; } setTimeout(tick, 90); }
      else{ ci--; if(ci === 0){ del = false; wi = (wi + 1) % words.length; } setTimeout(tick, del ? 40 : 90); }
    })();
    // WHY: re-type from the start on language change so the headline
    // never shows a half-typed word in the old language.
    document.addEventListener('dokit:langchange', function(){ ci = 0; del = false; });
  }
}
// chatbot shell — honest preview: navigation help only, no fake answers
var fab = document.getElementById('chat-fab'), panel = document.getElementById('chat-panel');
// ---- Doki character states (item 119) ----
// WHY: the inlined character's state is one CSS class on its container
// (doki.css). This block only swaps state classes — it never touches
// answers, grounding, or the provider chain.
// State classes (doki.css): idle, working, greeting, thinking, success,
// sleep, error, mic. Variant classes (face/head) are never removed —
// only state classes are swapped.
// Error IS wired (redraw pass, Oct 25): dokiGemini sets the
// dokiProviderError flag ONLY on genuine API failures (fatal HTTP,
// exhausted retries/timeouts, empty replies) — never on no-overlap
// (no API call made) and never on a literal model DK_NOT_GROUNDED
// verdict. The handler shows the error face only when the flag is set,
// so ordinary ungrounded questions still keep idle.
// Working IS wired (redraw pass, Oct 25): while the provider is pending,
// the header shows thinking + working together (dots + typing arms).
// Sleep fires after ~60s of no panel interaction; any panel click or
// input wakes the character back to idle.
// PHOTO PASS (Oct 25): the visible avatar is a photo (doki-photo.png),
// not SVG groups. States still swap classes on the container, but:
// - sleep ALSO swaps the header img to doki-photo-sleep.png (the
//   video's own closed-eye blink frame, same transform, so the swap
//   is pixel-seamless); any other state restores the open-eye photo.
// - greeting/success/error are MOTION ONLY. HONEST LIMIT: a photo's
//   expression cannot change, so no overlay fakes a smile, worried
//   eyes, or a mouth — the old SVG smile/worry groups are gone.
// - idle blink (below) swaps to the sleep photo ~150ms every ~5s,
//   idle state only, never during thinking/sleep/mic/greeting/success.
var DOKI_STATES = ['doki--idle','doki--working','doki--greeting','doki--thinking','doki--success','doki--sleep','doki--error','doki--mic'];
function dokiSet(el, state){
  if(!el) return;
  DOKI_STATES.forEach(function(s){ el.classList.remove(s); });
  el.classList.add(state);
  // Photo pass: the header img follows the state. Sleep shows the
  // video's own closed-eye frame; every other state restores the
  // open-eye photo (this also ends a mid-blink swap cleanly).
  var img = el.querySelector('.doki-photo');
  if(img && img.src){
    if(state === 'doki--sleep'){
      if(/doki-photo\.png$/.test(img.src)) img.src = img.src.replace('doki-photo.png', 'doki-photo-sleep.png');
    } else {
      img.src = img.src.replace('doki-photo-sleep.png', 'doki-photo.png');
    }
  }
}
function dokiHead(){ return document.querySelector('#chat-panel .chead .doki'); }
var dokiHeadTimer = null;
function dokiHeadLater(from, to, ms){
  // Apply `to` only if the header is still in `from` — a newer state
  // (e.g. thinking set while greeting was pending) must never be
  // clobbered by a stale timer.
  if(dokiHeadTimer) clearTimeout(dokiHeadTimer);
  dokiHeadTimer = setTimeout(function(){
    var head = dokiHead();
    if(head && head.classList.contains(from)) dokiSet(head, to);
  }, ms);
}
function dokiHeadGreet(){ dokiSet(dokiHead(), 'doki--greeting'); dokiHeadLater('doki--greeting', 'doki--idle', 1800); }
function dokiHeadSuccess(){ dokiSet(dokiHead(), 'doki--success'); dokiHeadLater('doki--success', 'doki--idle', 1800); }
function dokiHeadError(){ dokiSet(dokiHead(), 'doki--error'); dokiHeadLater('doki--error', 'doki--idle', 1800); }
// Provider error flag (redraw pass): true only after a genuine API
// failure inside dokiGemini; reset at every new provider call.
var dokiProviderError = false;
var dokiSleepTimer = null;
function dokiSleepClear(){ if(dokiSleepTimer){ clearTimeout(dokiSleepTimer); dokiSleepTimer = null; } }
function dokiSleepArm(){
  dokiSleepClear();
  dokiSleepTimer = setTimeout(function(){
    var p = document.getElementById('chat-panel'), head = dokiHead();
    // Never sleep over a live thinking state (provider pending).
    if(p && p.classList.contains('open') && head && !head.classList.contains('doki--thinking')) dokiSet(head, 'doki--sleep');
  }, 60000);
}
function dokiWake(){
  var head = dokiHead();
  if(head && head.classList.contains('doki--sleep')) dokiSet(head, 'doki--idle');
  dokiSleepArm();
}
if(fab && panel){ fab.addEventListener('click', function(){
  var opened = panel.classList.toggle('open');
  dokiLoadFaq();
  // Panel open: greeting briefly, then idle. Panel closed: sleep off,
  // FAB instance stays idle (it is always idle).
  if(opened){ dokiHeadGreet(); dokiSleepArm(); } else { dokiSleepClear(); }
}); }
if(panel){ panel.addEventListener('click', dokiWake); panel.addEventListener('input', dokiWake); }
// ---- Doki idle blink (photo pass, Oct 25) ----
// WHY a JS swap, not CSS: a photo cannot blink by itself. The closed
// eye frame IS the video's own blink (0.75s frame), same transform as
// the open-eye photo, so the swap has no jump. Idle only: the header
// must still be idle at swap time AND at restore time, and the FAB
// (always idle) blinks with it so both instances stay in sync.
function dokiPhotoImgs(){
  var out = [];
  var f = document.querySelector('#chat-fab .doki-photo');
  var h = document.querySelector('#chat-panel .chead .doki-photo');
  if(f) out.push(f); if(h) out.push(h); return out;
}
(function dokiPreloadBlink(){
  var imgs = dokiPhotoImgs();
  if(imgs.length && imgs[0].src){
    var pre = new Image();
    pre.src = imgs[0].src.replace('doki-photo.png', 'doki-photo-sleep.png');
  }
})();
function dokiBlinkTick(){
  var head = dokiHead();
  if(!head || !head.classList.contains('doki--idle')) return;
  var imgs = dokiPhotoImgs();
  imgs.forEach(function(img){
    if(/doki-photo\.png$/.test(img.src)) img.src = img.src.replace('doki-photo.png', 'doki-photo-sleep.png');
  });
  setTimeout(function(){
    var h = dokiHead();
    if(h && h.classList.contains('doki--idle')){
      imgs.forEach(function(img){ img.src = img.src.replace('doki-photo-sleep.png', 'doki-photo.png'); });
    }
  }, 150);
}
setInterval(dokiBlinkTick, 5000);
// ---- Doki answers (KB-only, owner choice Oct 26: Option A) ----
// No AI provider and no API key: live AI was dropped because every key
// placed in public client code was disabled by Google within hours/days.
// Doki answers from the site's own knowledge base (assistant-kb.js) and
// falls back to navigation links. dokiGemini below is kept as a stub
// returning DK_NOT_GROUNDED so any old caller degrades gracefully.
function dokiLoadFaq(){
  // KB-only (Oct 26): no FAQ/AI provider is loaded. Doki answers from
  // assistant-kb.js, loaded site-wide by loadSharedScripts.
}
function dokiGemini(req){
  // KB-only stub (Oct 26): live AI removed by owner choice. Always
  // ungrounded so the handler falls back to KB/links, never an error.
  return Promise.resolve('DK_NOT_GROUNDED');
}
// ---- Doki session plumbing (item 93) ----
// DKChat is the client-side session layer for the Doki panel. `provider`
// stays null by design (KB-only, Oct 26): the handler answers from
// assistant-kb.js or falls back to navigation links. Its answer renders through the same bot element. History is
// IN-MEMORY ONLY (tab session): a reload starts fresh — nothing is
// persisted to Firestore or localStorage.
window.DKChat = window.DKChat || {
  history: [],
  provider: null,
  setProvider: function (fn) { this.provider = (typeof fn === 'function') ? fn : null; },
  buildRequest: function (q) {
    var lang = 'en';
    try { lang = localStorage.getItem('dokit_lang') || 'en'; } catch (e) {}
    return { messages: this.history.concat([{ role: 'user', text: q }]), personality: 'helpful', lang: lang };
  },
  clear: function () { this.history = []; }
};
var form = document.getElementById('chat-form');
if(form){
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var inp = document.getElementById('chat-input'); var q = (inp.value || '').trim(); if(!q) return;
    var log = document.getElementById('chat-log');
    var u = document.createElement('div'); u.className = 'msg'; u.textContent = q; log.appendChild(u);
    // Session record: user turn + the request a future provider would get.
    // No send happens while provider is null (KB path below answers).
    var req = window.DKChat.buildRequest(q);
    window.DKChat.history.push({ role: 'user', text: q });
    var b = document.createElement('div'); b.className = 'msg bot';
    var low = q.toLowerCase(), reply = dkT('rsv_1021', 'I answer from DoKit\'s own content. ');
    var links = [];
    if(/price|pricing|pro|team|rs |cost/.test(low)) links.push(['Pricing', form.getAttribute('data-pricing')]);
    if(/compress|100kb|50kb|size|shrink/.test(low)) links.push(['Image Compressor', form.getAttribute('data-compressor')]);
    if(/resiz|pixel|dimension/.test(low)) links.push(['Image Resizer', form.getAttribute('data-resizer')]);
    if(/convert|png|jpg|webp/.test(low)) links.push(['Image Converter', form.getAttribute('data-converter')]);
    if(/word|count|character/.test(low)) links.push(['Word Counter', form.getAttribute('data-counter')]);
    if(/case|upper|lower|camel|snake/.test(low)) links.push(['Case Converter', form.getAttribute('data-case')]);
    if(/typ|wpm|lesson|urdu/.test(low)) links.push(['Typing Test', form.getAttribute('data-typing')]);
    if(/lesson|curriculum/.test(low))links.push(['Lessons',form.getAttribute('data-lessons')]);
    if(/practice|drill/.test(low))links.push(['Practice',form.getAttribute('data-practice')]);
    if(/game/.test(low))links.push(['Games',form.getAttribute('data-games')]);
    if(/board|exam photo|admission photo/.test(low))links.push(['Board Photo',form.getAttribute('data-board')]);
    if(/password/.test(low))links.push(['Password Generator',form.getAttribute('data-password')]);
    if(/unit|kilometre|kilometer|pound|weight|convert units/.test(low))links.push(['Unit Converter',form.getAttribute('data-unit')]);
    if(/\bqr\b/.test(low))links.push(['QR Generator',form.getAttribute('data-qr')]);
    if(/battle|fight|coin/.test(low))links.push(['TypeFight Battle',form.getAttribute('data-battle')]);
    if(/wall|testimonial/.test(low))links.push(['Wall of Love',form.getAttribute('data-wall')]);
    if(/changelog|release|update/.test(low))links.push(['Changelog',form.getAttribute('data-changelog')]);
    if(/status|down|offline/.test(low))links.push(['System Status',form.getAttribute('data-status')]);
    if(/api|developer/.test(low))links.push(['API Docs',form.getAttribute('data-api')]);
    if(/design|system|brand|colour|color/.test(low))links.push(['Design System',form.getAttribute('data-design')]);
    if(/certificate/.test(low))links.push(['Certificate',form.getAttribute('data-certificate')]);
    if(/result|history/.test(low))links.push(['Results',form.getAttribute('data-results')]);
    if(/progress|stats/.test(low))links.push(['Progress',form.getAttribute('data-progress')]);
    if(/dashboard/.test(low))links.push(['Dashboard',form.getAttribute('data-dashboard')]);
    if(/contact|email|support|human/.test(low)) links.push(['Contact', form.getAttribute('data-contact')]);
    if(links.length === 0) links.push(['FAQ', form.getAttribute('data-faq')], ['All Tools', form.getAttribute('data-tools')]);
    // Restore: local knowledge-base answers (data ported verbatim from
    // the old assistant-kb.js). The old Firebase search is NOT used —
    // matching is local only, so answers come from site content and
    // are never invented. No match falls back to navigation links.
    var kbHit = null;
    try {
      var kb = window.DKASSIST_KB;
      if (kb) {
        var kbLang = 'en';
        try { kbLang = localStorage.getItem('dokit_lang') || 'en'; } catch (e) {}
        var entries = kb[kbLang] || kb.en || [];
        var words = low.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2; });
        var best = null, bestScore = 0;
        entries.forEach(function (en) {
          var score = 0;
          (en.kw || []).forEach(function (k) {
            var kk = String(k).toLowerCase();
            words.forEach(function (w) { if (kk.indexOf(w) !== -1 || w.indexOf(kk) !== -1) { score += 2; } });
            if (low.indexOf(kk) !== -1) { score += 1; }
          });
          if (score > bestScore) { bestScore = score; best = en; }
        });
        if (best && bestScore >= 2) { kbHit = best; }
      }
    } catch (e) {}
    // Shared fallback renderer: the sync links path and the AI path's
    // ungrounded/error fallback render exactly the same chips.
    function appendChatLinks(el){
      // WHY (i18n): chat link labels translate through the same dict
      // keys as the footer/cards. Only labels with a verified key are
      // mapped; the rest (Lessons, Practice, Games, TypeFight Battle,
      // Changelog, API Docs, Design System, Progress) have no old
      // translation and stay English, honestly, until one is supplied.
      var CHAT_LABEL_KEY = {'Pricing':'nav_pricing','Image Compressor':'tool_compressor_name','Image Resizer':'tool_resizer_name','Image Converter':'tool_converter_name','Word Counter':'tool_counter_name','Case Converter':'tool_case_name','Typing Test':'test_title','Board Photo':'bp.title','Password Generator':'cs2_t','Unit Converter':'cs4_t','QR Generator':'cs1_t','Wall of Love':'wol.title','System Status':'status.title','Certificate':'cert_word','Results':'resizer.results_title','Dashboard':'acct_dash_h1','Contact':'nav_contact','FAQ':'nav_faq','All Tools':'nav_all_tools'};
      links.forEach(function(lk){
        if(!lk[1]){ return; }
        var a = document.createElement('a'); a.className = 'chip'; a.href = lk[1];
        var lkKey = CHAT_LABEL_KEY[lk[0]];
        a.textContent = lkKey ? dkT(lkKey, lk[0]) : lk[0];
        el.appendChild(document.createElement('br')); el.appendChild(a);
      });
    }
    if (kbHit) {
      b.textContent = kbHit.what || '';
      (kbHit.how || []).slice(0, 2).forEach(function (step) {
        b.appendChild(document.createElement('br'));
        b.appendChild(document.createTextNode('• ' + step));
      });
      var kbPage = {'image-resizer':'data-resizer','image-compressor':'data-compressor','image-converter':'data-converter','word-counter':'data-counter','case-converter':'data-case','typing':'data-typing','typefight':'data-battle','hub':'data-tools'}[kbHit.id];
      if (kbPage && form.getAttribute(kbPage)) {
        var ka = document.createElement('a'); ka.className = 'chip'; ka.href = form.getAttribute(kbPage); ka.textContent = dkT('rsv_0989', 'Open it'); b.appendChild(document.createElement('br')); b.appendChild(ka);
      }
      // KB-hit answer: success briefly, then idle (mirrors the AI path).
      dokiHeadSuccess();
    } else if (window.DKChat.provider && window.DKFAQ) {
      // AI path (grounded): thinking dots until the provider answers.
      // Ungrounded/error falls back to the same links path — never an
      // invented answer, never an empty bubble. The shared tail below
      // is skipped for this turn (return): the bubble is already in the
      // log and history is pushed when the provider resolves.
      var dots = document.createElement('span'); dots.className = 'dk-thinking';
      for (var di = 0; di < 3; di++) { dots.appendChild(document.createElement('i')); }
      b.appendChild(dots);
      // Provider pending: Doki thinks AND works (dots + typing arms).
      dokiSet(dokiHead(), 'doki--thinking');
      var dokiPendingHead = dokiHead();
      if (dokiPendingHead) { dokiPendingHead.classList.add('doki--working'); }
      log.appendChild(b); inp.value = ''; log.scrollTop = log.scrollHeight;
      window.DKChat.provider(req).then(function (ans) {
        b.textContent = '';
        if (ans && ans !== 'DK_NOT_GROUNDED') {
          b.textContent = ans;
          // Real answer: success briefly, then idle.
          dokiHeadSuccess();
        } else {
          b.textContent = reply + dkT('rsv_1008', 'These pages may help:');
          appendChatLinks(b);
          // Genuine API failure: error face briefly. Plain ungrounded:
          // KEEP idle — never the error face for an ordinary question.
          if (dokiProviderError) { dokiHeadError(); } else { dokiSet(dokiHead(), 'doki--idle'); }
        }
        log.scrollTop = log.scrollHeight;
        window.DKChat.history.push({ role: 'bot', text: b.textContent });
      });
      return;
    } else {
      b.textContent = reply + dkT('rsv_1008', 'These pages may help:');
      appendChatLinks(b);
    }
    log.appendChild(b); inp.value = ''; log.scrollTop = log.scrollHeight;
    // Session record: bot turn (rendered answer text, chips included).
    window.DKChat.history.push({ role: 'bot', text: b.textContent });
  });
}
// ---- Doki voice input (photo pass, Oct 25): real Web Speech ----
// WHY real speech, not a fake: the owner ordered 'no excuse' — a mic
// button that only pretends to listen would be a fake feature. This
// uses the browser's SpeechRecognition (Chrome: webkit prefix).
// HONEST FALLBACKS (dict keys doki_mic_*): no API in this browser ->
// nosupport note; permission denied -> denied note; any other error
// -> generic error note. Nothing ever claims to listen when it is not.
// Interim results stream into #chat-input; a FINAL result auto-submits
// by dispatching the EXISTING form submit — the answer logic is never
// duplicated here. While listening, the header carries doki--mic
// (pulsing ring + glow) and the input placeholder shows Listening.
function dokiMicLang(){
  try { return localStorage.getItem('dokit_lang') || 'en'; } catch (e) { return 'en'; }
}
function dokiMicSpeechLang(){
  var m = { en: 'en-US', ur: 'ur-PK', ar: 'ar-SA', hi: 'hi-IN', es: 'es-ES', fr: 'fr-FR', pt: 'pt-PT', de: 'de-DE', tr: 'tr-TR', ru: 'ru-RU' };
  return m[dokiMicLang()] || 'en-US';
}
function dokiMicNote(key, fallback){
  var log = document.getElementById('chat-log');
  if(!log) return;
  var b = document.createElement('div'); b.className = 'msg bot'; b.textContent = dkT(key, fallback);
  log.appendChild(b); log.scrollTop = log.scrollHeight;
}
var dokiRec = null, dokiListening = false, dokiMicOldPh = null;
function dokiMicSet(on){
  var head = dokiHead();
  if(head){ if(on) head.classList.add('doki--mic'); else head.classList.remove('doki--mic'); }
}
function dokiMicStop(){
  dokiListening = false; dokiMicSet(false);
  var inp = document.getElementById('chat-input');
  if(inp && dokiMicOldPh !== null){ inp.placeholder = dokiMicOldPh; dokiMicOldPh = null; }
}
(function dokiMicBind(){
  var btn = document.getElementById('chat-mic');
  var form = document.getElementById('chat-form');
  if(!btn || !form) return;
  btn.addEventListener('click', function(){
    if(dokiListening && dokiRec){ try { dokiRec.stop(); } catch (e) {} return; }
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR){ dokiMicNote('doki_mic_nosupport', 'Voice input is not supported in this browser.'); return; }
    var inp = document.getElementById('chat-input');
    try {
      dokiRec = new SR();
      dokiRec.lang = dokiMicSpeechLang();
      dokiRec.interimResults = true;
      dokiRec.continuous = false;
      dokiRec.onresult = function(ev){
        var interim = '', final = '';
        for(var i = ev.resultIndex; i < ev.results.length; i++){
          if(ev.results[i].isFinal) final += ev.results[i][0].transcript;
          else interim += ev.results[i][0].transcript;
        }
        if(inp) inp.value = (final || interim);
        if(final && final.trim()){
          try { dokiRec.stop(); } catch (e) {}
          form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      };
      dokiRec.onerror = function(ev){
        var err = (ev && ev.error) || '';
        dokiMicStop();
        if(err === 'not-allowed' || err === 'service-not-allowed'){
          dokiMicNote('doki_mic_denied', 'Microphone permission was denied.');
        } else if(err && err !== 'aborted'){
          dokiMicNote('doki_mic_error', 'Voice input stopped. Please try again or type your question.');
        }
      };
      dokiRec.onend = function(){ dokiMicStop(); };
      dokiListening = true; dokiMicSet(true);
      if(inp){ dokiMicOldPh = inp.placeholder; inp.placeholder = dkT('doki_mic_listening', 'Listening\u2026'); }
      dokiRec.start();
    } catch (e) { dokiMicStop(); dokiMicNote('doki_mic_error', 'Voice input stopped. Please try again or type your question.'); }
  });
})();
// ---- Doki session UI (item 93): mode line + New chat button ----
// Built in JS (same precedent as the admin forms in account.js), so no
// new HTML keys are needed. The greeting is CLONED from the panel's own
// first message (never re-typed), so New chat restores it exactly.
(function dokiSessionUI(){
  try {
    var panel = document.getElementById('chat-panel');
    var chatForm = document.getElementById('chat-form');
    var log = document.getElementById('chat-log');
    if (!panel || !chatForm || !log) { return; }
    if (panel.querySelector('.chat-mode')) { return; } // already built
    var greet = log.querySelector('.msg');
    var greetClone = greet ? greet.cloneNode(true) : null;
    var bar = document.createElement('div');
    bar.className = 'chat-mode';
    var mode = document.createElement('span');
    mode.textContent = dkT('acct_chat_mode', 'Mode: site answers');
    var fresh = document.createElement('button');
    fresh.type = 'button';
    fresh.className = 'btn ghost';
    fresh.textContent = dkT('acct_chat_new', 'New chat');
    fresh.addEventListener('click', function () {
      window.DKChat.clear();
      while (log.firstChild) { log.removeChild(log.firstChild); }
      if (greetClone) { log.appendChild(greetClone.cloneNode(true)); }
    });
    bar.appendChild(mode);
    bar.appendChild(fresh);
    panel.insertBefore(bar, chatForm);
  } catch (e) {}
})();
  // Phase 2b: shell forms (login, signup, verify, wall) — submitting
  // only reveals the honest Phase 3 note. Nothing is sent anywhere.
  document.querySelectorAll('.phase3-form').forEach(function(f){
    f.addEventListener('submit', function(e){
      e.preventDefault();
      var note = f.querySelector('.phase3-note');
      if(note){ note.hidden = false; }
    });
  });
  // Phase 2b: system status page stamps the real check time (client-side).
  var stEl = document.getElementById('status-time');
  if(stEl){ stEl.textContent = new Date().toLocaleString(); }

  // ---- Restore additions (audit gap restore): shared site-wide
  // behaviour, one place, guarded by element presence so pages
  // without a feature simply skip it. All state is device-local.
  // Load chrome-level scripts (i18n + knowledge base) from main.js's
  // own directory, so every page gets them without per-page tags.
  (function loadSharedScripts(){
    try {
      var cur = document.currentScript;
      if (!cur || !cur.src) { return; }
      var base = cur.src.replace(/assets\/js\/main\.js.*$/, 'assets/js/');
      function load(f, next) {
        var s = document.createElement('script'); s.src = base + f;
        if (next) { s.onload = next; s.onerror = next; }
        document.head.appendChild(s);
      }
      load('assistant-kb.js');
      // Dictionary first, engine second: the engine reads the dict
      // on init, so order matters (chained, not parallel). Once the
      // engine arrives, re-sync the hero H1 (it loads async, after
      // main.js has already run).
      load('i18n-dict.js', function () {
        load('i18n.js', function () {
          if (typeof window.syncHeroH1 === 'function') { window.syncHeroH1(); }
          if (typeof window.syncKeyboards === 'function') { window.syncKeyboards(); }
          if (typeof window.syncDurations === 'function') { window.syncDurations(); }
          if (typeof window.syncTrend === 'function') { window.syncTrend(); }
          if (typeof window.syncGoal === 'function') { window.syncGoal(); }
          if (typeof window.syncStreak === 'function') { window.syncStreak(); }
          if (typeof window.syncTimeline === 'function') { window.syncTimeline(); }
          if (typeof window.syncContinue === 'function') { window.syncContinue(); }
          if (typeof window.syncLevel === 'function') { window.syncLevel(); }
          if (typeof window.syncProblemKeys === 'function') { window.syncProblemKeys(); }
          if (typeof window.syncShareMsg === 'function') { window.syncShareMsg(); }
          if (typeof window.syncRzBg === 'function') { window.syncRzBg(); }
        });
      });
    } catch (e) {}
  })();
  // Small dropdown helper (used by language + profile menus): toggle
  // on button click, close on outside click or Escape. returnFocus
  // (launcher only): on Escape, return focus to the button — never
  // on outside-click, which would yank focus mid-task.
  function bindMenu(btnId, menuId, onPick, returnFocus){
    var btn = document.getElementById(btnId), menu = document.getElementById(menuId);
    if (!btn || !menu) { return; }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = menu.hidden; menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function () {
      menu.hidden = true; btn.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) {
        menu.hidden = true; btn.setAttribute('aria-expanded', 'false');
        if (returnFocus) { btn.focus(); }
      }
    });
    if (onPick) { menu.addEventListener('click', onPick); }
  }
  // Language selector: owned entirely by i18n.js (it toggles the
  // menu and applies the choice). main.js must NOT also bind it —
  // two toggles on one click would open then immediately close it.
  // Profile avatar menu: links only, no balance shown (no real source).
  bindMenu('dkProfBtn', 'profMenu', null);
  // Header menus: guest/auth rows (items 99/103). Rows carry
  // data-menu="guest" (Login/Sign up) or "auth" (Dashboard/Settings/
  // Notifications/...). account.js owns the auth truth (Firebase) and
  // reports it; here we only mirror the last-known flag so menus are
  // right on pages where account.js never loads (home, tools index).
  // The flag is UI-only: pages still enforce access via Firebase,
  // never via this flag. The Logout row (data-menu="auth-action") is
  // deliberately NOT toggled here — only account.js shows it, because
  // only account.js can bind the sign-out click.
  function applyHeaderAuth(authed){
    document.querySelectorAll('#profMenu [data-menu], #appPanel [data-menu]').forEach(function (el) {
      var kind = el.getAttribute('data-menu');
      if (kind === 'guest') { el.hidden = authed; }
      else if (kind === 'auth') { el.hidden = !authed; }
    });
    // Oct 26: the waffle's Account section holds auth-only tiles now
    // (Login/Sign up live in the profile menu). For guests every tile
    // is hidden, so hide the Account heading too — never show an
    // empty section. Signed-in users see heading + tiles as before.
    try {
      var head = document.querySelector('#appPanel [data-app-section="account"]');
      if (head) {
        var grid = head.nextElementSibling, anyVisible = false;
        if (grid) {
          grid.querySelectorAll('a').forEach(function (a) { if (!a.hidden) { anyVisible = true; } });
        }
        head.hidden = !anyVisible;
      }
    } catch (e) {}
  }
  window.dkApplyHeaderAuth = applyHeaderAuth;
  try { applyHeaderAuth(localStorage.getItem('dokit_authed') === '1'); } catch (e) {}
  // App launcher (item 103): same dropdown behaviour as the profile
  // menu, plus focus return on Escape (keyboard users land back on
  // the launcher button instead of losing their place).
  bindMenu('appBtn', 'appPanel', null, true);
  // Nav dropdowns (items 117–118): same bindMenu PATTERN (click
  // toggle, outside-click/Esc close, focus return on Esc) plus
  // desktop hover-open. Hover uses matchMedia('(hover:hover)') so
  // touch devices never hover-open (tap the caret instead). A
  // click-pinned menu stays open across mouseleave until an
  // outside click, Esc, or another caret click closes it.
  function bindNavDrop(dropId, caretId, menuId){
    var drop = document.getElementById(dropId),
        caret = document.getElementById(caretId),
        menu = document.getElementById(menuId);
    if (!drop || !caret || !menu) { return; }
    var pinned = false;
    function open(){ menu.hidden = false; caret.setAttribute('aria-expanded', 'true'); }
    function close(){ menu.hidden = true; caret.setAttribute('aria-expanded', 'false'); pinned = false; }
    // WHY the three-way click: a real mouse click always hovers
    // first, so hover-open runs before the click handler. A plain
    // toggle would therefore shut the menu the hover just opened
    // (open-flash then shut — the caret would look broken). So:
    // hidden -> open + pin; hover-opened (unpinned) -> pin in place;
    // pinned -> close. Touch/keyboard users (no hover) get plain
    // open on first tap, close on second.
    caret.addEventListener('click', function (e) {
      e.stopPropagation();
      if (menu.hidden) { pinned = true; open(); }
      else if (pinned) { close(); }
      else { pinned = true; }
    });
    drop.addEventListener('mouseenter', function () {
      try {
        if (window.matchMedia('(hover:hover)').matches) { open(); }
      } catch (e) {}
    });
    drop.addEventListener('mouseleave', function () { if (!pinned) { close(); } });
    document.addEventListener('click', function (e) {
      if (!drop.contains(e.target)) { close(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { close(); caret.focus(); }
    });
  }
  bindNavDrop('pricingDrop', 'pricingCaret', 'pricingMenu');
  bindNavDrop('typingDrop', 'typingCaret', 'typingMenu');
  // Entrance animation (item 114, F10): non-home pages fade/slide
  // their <main> in once on load. Home is excluded (it has the hero
  // canvas + its own .reveal cards). Reduced-motion is handled by
  // the existing global rule (animation:none), not by JS.
  try {
    var mn = document.querySelector('main');
    if (mn && !document.getElementById('hero-canvas')) { mn.classList.add('dk-enter'); }
  } catch (e) {}
  // Dark/light theme: data-theme on <html>, saved as dokit_theme.
  // Default is dark (the approved design); the button shows the
  // opposite icon, i.e. what clicking will switch to.
  (function theme(){
    var btn = document.getElementById('themeTog'); if (!btn) { return; }
    function current() {
      try { return localStorage.getItem('dokit_theme') || 'dark'; } catch (e) { return 'dark'; }
    }
    function apply(t) {
      document.documentElement.setAttribute('data-theme', t);
      // Oct 26: the toggle now lives inside the profile menu as a row
      // (icon + translated label spans). Update the spans when they
      // exist; fall back to the old icon-only text on any page whose
      // header predates the row markup, so nothing ever breaks.
      var ic = btn.querySelector('.theme-ic'),
          lb = btn.querySelector('.theme-label'),
          label = dkT(t === 'dark' ? 'rsv_1019' : 'rsv_1020', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      if (ic) { ic.textContent = (t === 'dark') ? '☀️' : '🌙'; }
      else { btn.textContent = (t === 'dark') ? '☀️' : '🌙'; }
      if (lb) { lb.textContent = label; }
      btn.setAttribute('aria-label', label);
    }
    apply(current());
    btn.addEventListener('click', function (e) {
      // Stop here so the profile menu's document-click closer does
      // not shut the menu the moment the theme is switched.
      if (e) { e.stopPropagation(); }
      var next = (current() === 'dark') ? 'light' : 'dark';
      try { localStorage.setItem('dokit_theme', next); } catch (e) {}
      apply(next);
    });
  })();
  // PWA: register the service worker (path derived from main.js's own
  // URL, so it works under /DoKit/ and on any other host).
  (function sw(){
    try {
      if (!('serviceWorker' in navigator)) { return; }
      var cur = document.currentScript;
      if (!cur || !cur.src) { return; }
      var swUrl = cur.src.replace(/assets\/js\/main\.js.*$/, 'sw.js');
      navigator.serviceWorker.register(swUrl).catch(function () {});
    } catch (e) {}
  })();
  // PWA install banner: shown once per browser until dismissed.
  (function installBanner(){
    var dismissed = false;
    try { dismissed = localStorage.getItem('dokit_pwa_dismissed') === '1'; } catch (e) {}
    if (dismissed) { return; }
    var deferred = null;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); deferred = e;
      if (document.getElementById('install-banner')) { return; }
      var bar = document.createElement('div');
      bar.id = 'install-banner'; bar.className = 'install-banner';
      bar.innerHTML = '<span>' + dkT('rsv_1055', 'Install DoKit on your device for offline use.') + '</span>';
      var inst = document.createElement('button'); inst.className = 'btn'; inst.textContent = dkT('rsv_0980', 'Install');
      inst.addEventListener('click', function () {
        if (deferred) { deferred.prompt(); deferred = null; }
        bar.remove();
      });
      var dis = document.createElement('button'); dis.className = 'btn ghost'; dis.textContent = dkT('saas.dismiss', 'Dismiss');
      dis.addEventListener('click', function () {
        try { localStorage.setItem('dokit_pwa_dismissed', '1'); } catch (err) {}
        bar.remove();
      });
      bar.appendChild(inst); bar.appendChild(dis);
      var main = document.getElementById('main');
      if (main) { main.parentNode.insertBefore(bar, main); } else { document.body.appendChild(bar); }
    });
  })();
  // Site announcement banner: rendered ONLY when a message is set
  // (window.DOKIT_BANNER, set by the admin in Phase 3). Empty today,
  // so nothing shows — the mechanism, not a fake announcement.
  (function siteBanner(){
    try {
      var msg = window.DOKIT_BANNER || '';
      if (!msg || sessionStorage.getItem('dokit_banner_dismissed') === '1') { return; }
      var bar = document.createElement('div');
      bar.className = 'site-banner';
      bar.innerHTML = '<span></span>';
      bar.querySelector('span').textContent = msg;
      var dis = document.createElement('button'); dis.className = 'btn ghost'; dis.textContent = dkT('saas.dismiss', 'Dismiss');
      dis.addEventListener('click', function () {
        try { sessionStorage.setItem('dokit_banner_dismissed', '1'); } catch (e) {}
        bar.remove();
      });
      bar.appendChild(dis);
      var main = document.getElementById('main');
      if (main) { main.parentNode.insertBefore(bar, main); } else { document.body.appendChild(bar); }
    } catch (e) {}
  })();
  // Home: live word-counter demo (counts only, nothing is sent).
  (function demo(){
    var ta = document.getElementById('demoText'), out = document.getElementById('demoCounts');
    if (!ta || !out) { return; }
    function count() {
      var text = ta.value || '';
      var words = text.trim() ? text.trim().split(/\s+/).length : 0;
      var chars = text.length;
      out.textContent = words + dkT('rsv_0954', ' words · ') + chars + dkT('rsv_0947', ' characters');
    }
    ta.addEventListener('input', count); count();
  })();
  // Favorites: star buttons injected into every tool card (device-local
  // list; the panel on the home page renders stored favorites only).
  (function favs(){
    function get() {
      try { return JSON.parse(localStorage.getItem('dokit_favs') || '[]'); } catch (e) { return []; }
    }
    function set(list) {
      try { localStorage.setItem('dokit_favs', JSON.stringify(list)); } catch (e) {}
    }
    document.querySelectorAll('.tool-card').forEach(function (card) {
      var link = card.querySelector('a.cardlink'); if (!link) { return; }
      var star = document.createElement('button');
      star.className = 'fav-star'; star.type = 'button';
      star.setAttribute('data-fav', link.getAttribute('href'));
      star.setAttribute('aria-label', dkT('rsv_0976', 'Favorite this tool'));
      function paint() {
        var on = get().some(function (f) { return f.href === link.getAttribute('href'); });
        star.textContent = on ? '★' : '☆'; star.classList.toggle('on', on);
      }
      star.addEventListener('click', function () {
        var list = get(), href = link.getAttribute('href');
        var i = list.findIndex(function (f) { return f.href === href; });
        if (i >= 0) { list.splice(i, 1); } else { list.push({ name: link.textContent, href: href }); }
        set(list); paint(); renderPanel();
      });
      card.appendChild(star); paint();
    });
    function renderPanel() {
      var panel = document.getElementById('favs-panel'); if (!panel) { return; }
      var list = get();
      panel.innerHTML = '';
      if (!list.length) {
        panel.textContent = dkT('rsv_0985', 'No favorites yet — tap a star on any tool card.');
        return;
      }
      list.forEach(function (f) {
        var a = document.createElement('a'); a.className = 'chip'; a.href = f.href; a.textContent = '★ ' + f.name;
        panel.appendChild(a);
      });
    }
    renderPanel();
  })();
  // Guided tour: opened only by the Tour button, never automatically.
  (function tour(){
    var btn = document.getElementById('tour-btn'); if (!btn) { return; }
    var steps = [
      [dkT('rsv_1022', 'Welcome to DoKit'), dkT('rsv_1023', 'Every tool runs in your browser — no signup, no uploads, no watermark.')],
      [dkT('rsv_1026', 'Find a tool'), dkT('rsv_1027', 'Use the search box or browse the tool cards below.')],
      [dkT('rsv_1028', 'Typing school'), dkT('rsv_1029', 'Lessons, practice, games and Urdu typing live under Typing.')],
      [dkT('rsv_1024', 'Your data stays yours'), dkT('rsv_1025', 'Results and favorites save only on this device.')]
    ];
    var i = 0, back = null, card = null;
    function show() {
      if (!back) {
        back = document.createElement('div'); back.className = 'tour-backdrop';
        back.addEventListener('click', close);
        card = document.createElement('div'); card.className = 'tour-card';
        document.body.appendChild(back); document.body.appendChild(card);
      }
      back.classList.add('open');
      card.innerHTML = '';
      var h = document.createElement('h3'); h.textContent = steps[i][0]; card.appendChild(h);
      var p = document.createElement('p'); p.textContent = steps[i][1]; card.appendChild(p);
      var row = document.createElement('p');
      if (i > 0) {
        var prev = document.createElement('button'); prev.className = 'btn ghost'; prev.textContent = dkT('rsv_0849', 'Back');
        prev.addEventListener('click', function () { i -= 1; show(); }); row.appendChild(prev); row.appendChild(document.createTextNode(' '));
      }
      var next = document.createElement('button'); next.className = 'btn';
      next.textContent = (i === steps.length - 1) ? dkT('rsv_0970', 'Done') : dkT('rsv_0396', 'Next');
      next.addEventListener('click', function () { if (i < steps.length - 1) { i += 1; show(); } else { close(); } });
      row.appendChild(next); row.appendChild(document.createTextNode(' '));
      var done = document.createElement('button'); done.className = 'btn ghost'; done.textContent = dkT('rsv_0960', 'Close');
      done.addEventListener('click', close); row.appendChild(done);
      card.appendChild(row);
    }
    function close() { if (back) { back.classList.remove('open'); } if (card) { card.remove(); card = null; back.remove(); back = null; } i = 0; }
    btn.addEventListener('click', show);
  })();
  // Dismissible tip banner on the home page (dismissal remembered).
  (function tip(){
    var tip = document.getElementById('dk-hint'); if (!tip) { return; }
    try { if (localStorage.getItem('dokit_hint_dismissed') === '1') { tip.remove(); return; } } catch (e) {}
    var close = tip.querySelector('[data-hint-close]');
    if (close) {
      close.addEventListener('click', function () {
        try { localStorage.setItem('dokit_hint_dismissed', '1'); } catch (e) {}
        tip.remove();
      });
    }
  })();
  // "/" focuses the tool search (never while typing in a field).
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/') { return; }
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { return; }
    var s = document.getElementById('tool-search');
    if (s) { e.preventDefault(); s.focus(); }
  });
  // Tools index: category filter chips + tool-finder chips (both just
  // drive the existing card filter; no new search engine).
  (function chips(){
    var search = document.getElementById('tool-search');
    function applyFilter(cat) {
      document.querySelectorAll('.tool-card').forEach(function (card) {
        var cats = (card.getAttribute('data-cat') || '').split(' ');
        card.style.display = (!cat || cat === 'all' || cats.indexOf(cat) !== -1) ? '' : 'none';
      });
    }
    document.querySelectorAll('[data-filter]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('[data-filter]').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        applyFilter(chip.getAttribute('data-filter'));
      });
    });
    document.querySelectorAll('[data-finder]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var q = chip.getAttribute('data-finder') || '';
        if (search) { search.value = q; search.dispatchEvent(new Event('input', { bubbles: true })); }
      });
    });
  })();
  // Captcha on login/signup shells: client-side visual code only
  // (never a real security gate — the pages are Phase 3 shells).
  // A wrong code blocks the submit and refreshes; a right code lets
  // the shell's Phase 3 note show as usual.
  (function captcha(){
    var box = document.getElementById('cap-code'); if (!box) { return; }
    var input = document.getElementById('cap-input');
    var refresh = document.getElementById('cap-refresh');
    var audio = document.getElementById('cap-audio');
    var err = document.getElementById('cap-err');
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var code = '';
    function gen() {
      code = '';
      for (var i = 0; i < 5; i++) { code += chars[Math.floor(Math.random() * chars.length)]; }
      box.textContent = code;
    }
    gen();
    if (refresh) { refresh.addEventListener('click', function () { gen(); if (err) { err.textContent = ''; } }); }
    if (audio) {
      audio.addEventListener('click', function () {
        try {
          var u = new SpeechSynthesisUtterance(code.split('').join(' '));
          speechSynthesis.speak(u);
        } catch (e) {}
      });
    }
    var formEl = box.closest('form');
    if (formEl && input) {
      formEl.addEventListener('submit', function (e) {
        if ((input.value || '').trim().toUpperCase() !== code) {
          // Block the submit (and hide any Phase 3 note another
          // handler just showed) until the code matches.
          e.preventDefault();
          var note = formEl.querySelector('.phase3-note');
          if (note) { note.hidden = true; }
          if (err) { err.textContent = dkT('rsv_1007', 'That code does not match — try the new one.'); }
          gen();
        }
      });
    }
  })();
  // Rules copy helper (admin tool, restored from the old site):
  // fetch the legacy rules from the public repo and copy them.
  // If automatic copy is blocked, show the text for manual copy.
  (function copyRules(){
    var btn = document.getElementById('copyBtn'); if (!btn) { return; }
    var status = document.getElementById('copyStatus');
    var fallback = document.getElementById('copyFallback');
    btn.addEventListener('click', function () {
      fetch('https://raw.githubusercontent.com/aleemurrehman803/DoKit/main/firestore.rules')
        .then(function (r) {
          if (!r.ok) { throw new Error(dkT('rsv_1004', 'Rules file not found (HTTP ') + r.status + ')'); }
          return r.text();
        })
        .then(function (text) {
          function done() {
            if (status) { status.textContent = dkT('rsv_0967', 'Copied! ') + text.length + dkT('rsv_1045', ' chars. Now paste into the Firebase console.'); }
          }
          function showFallback() {
            if (fallback) { fallback.hidden = false; fallback.value = text; fallback.select(); }
            if (status) { status.textContent = dkT('rsv_1044', 'Automatic copy is blocked in this browser — the rules are selected below; copy them manually (') + text.length + dkT('rsv_1046', ' chars).'); }
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(showFallback);
          } else { showFallback(); }
        })
        .catch(function (e) {
          if (status) { status.textContent = dkT('rsv_0968', 'Could not fetch the rules file: ') + e.message + dkT('rsv_0955', ' — check the repo, or paste the rules manually.'); }
        });
    });
  })();
  // Hero H1 translation (restore): the home H1 holds a .grad span,
  // so it CANNOT carry data-i18n — the engine replaces textContent
  // and would wipe the approved partial gradient. Instead this
  // handler translates it from the dictionary on every language
  // change: other languages render the whole translated line inside
  // the gradient span (word splits don't map across languages), and
  // English restores the original partial-gradient markup exactly.
  (function heroH1(){
    var h1 = document.querySelector('.hero h1');
    if (!h1) { return; }
    var orig = h1.innerHTML;
    function esc(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function sync() {
      var lang = 'en';
      try { lang = localStorage.getItem('dokit_lang') || 'en'; } catch (e) {}
      if (lang === 'en') {
        if (h1.innerHTML !== orig) { h1.innerHTML = orig; }
        return;
      }
      var text = null;
      try {
        if (window.DK_I18N && typeof window.DK_I18N.t === 'function') {
          text = window.DK_I18N.t('tools.h1');
        }
      } catch (e) {}
      if (!text || text === 'tools.h1') {
        try {
          var dict = window.DK_I18N_DICT || {};
          text = (dict[lang] && dict[lang]['tools.h1']) || (dict.en && dict.en['tools.h1']);
        } catch (e2) {}
      }
      if (text) { h1.innerHTML = '<span class="grad">' + esc(text) + '</span>'; }
    }
    document.addEventListener('dokit:langchange', sync);
    // The loader above calls this once i18n.js arrives (async).
    window.syncHeroH1 = sync;
    sync();
  })();
  // Notify-me forms (coming-soon, TypeFight hub, API docs): the form
  // opens the visitor's own mail app with a prefilled message to the
  // site contact — honestly labeled, because no list is saved on
  // DoKit until the backend arrives in Phase 3.
  document.querySelectorAll('.notify-form').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = f.querySelector('input[type="email"]');
      var addr = email ? email.value.trim() : '';
      var topic = f.getAttribute('data-topic') || 'DoKit updates';
      var subject = encodeURIComponent(dkT('rsv_1030', 'Notify me: ') + topic);
      var body = encodeURIComponent(dkT('rsv_1031', 'Please notify me about ') + topic + dkT('rsv_1056', '.\nMy email: ') + addr);
      window.location.href = 'mailto:malikjalil014@gmail.com?subject=' + subject + '&body=' + body;
      var note = f.querySelector('.notify-sent');
      if (note) { note.hidden = false; }
    });
  });

})();

/* How-to steps panels (restored old ui.js 3-step checklist). One flag
 (dk_steps_seen) hides the panel site-wide once dismissed. Step 1
 completes on file add / text input, step 2 on a settings change,
 step 3 on a download action. */
(function saasSteps() {
  document.querySelectorAll('[data-saas-steps]').forEach(function (box) {
    var x = box.querySelector('.saas-steps-x');
    try { if (localStorage.getItem('dk_steps_seen')) { box.hidden = true; return; } } catch (e) {}
    if (x) { x.addEventListener('click', function () { box.hidden = true; try { localStorage.setItem('dk_steps_seen', '1'); } catch (e) {} }); }
    var steps = box.querySelectorAll('.saas-step');
    function done(n) { if (steps[n]) { steps[n].classList.add('done'); } }
    document.addEventListener('change', function (e) {
      var el = e.target;
      if (el.matches && el.matches('input[type="file"]') && el.files && el.files.length) { done(0); }
      else if (el.matches && el.matches('.tinput,.tselect,input[type="range"],input[type="number"],select')) { done(1); }
    });
    document.addEventListener('input', function (e) {
      var el = e.target;
      if (el.matches && el.matches('textarea#text') && el.value.trim()) { done(0); }
      else if (el.matches && el.matches('textarea,input[type="text"]:not(#chat-input)') && el.value.trim()) { done(0); }
    });
    document.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('button,a') : null;
      if (!el) { return; }
      if (el.closest && el.closest('a[download]')) { done(2); return; }
      if (el.id === 'zipBtn' || /download|process/i.test(el.id || '') || /download|process/i.test(el.textContent || '')) { done(2); }
    });
  });
})();

/* "Try with sample" buttons (restored old ui.js data-sample behaviour).
 * image: generates an 800x600 sample PNG into the page's file input;
 * text: fills the editable textarea with the translated sample text. */
(function sampleButtons() {
  function sampleImage() {
    var c = document.createElement('canvas'); c.width = 800; c.height = 600;
    var x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 800, 600);
    g.addColorStop(0, '#6C4CF1'); g.addColorStop(1, '#FF8A5C');
    x.fillStyle = g; x.fillRect(0, 0, 800, 600);
    x.fillStyle = 'rgba(255,255,255,.92)'; x.textAlign = 'center';
    x.font = 'bold 72px sans-serif'; x.fillText('Sample', 400, 290);
    x.font = '32px sans-serif'; x.fillText('DoKit', 400, 350);
    return new Promise(function (res) { c.toBlob(function (b) { res(new File([b], 'sample.png', { type: 'image/png' })); }, 'image/png'); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-sample]') : null;
    if (!b) { return; }
    var kind = b.getAttribute('data-sample');
    if (kind === 'image') {
      var input = document.querySelector('input[type="file"]');
      if (!input) { return; }
      b.disabled = true;
      sampleImage().then(function (f) {
        try {
          var dt = new DataTransfer(); dt.items.add(f); input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (err) { /* older browsers */ }
        b.disabled = false;
      });
    } else if (kind === 'text') {
      var ta = document.querySelector('textarea:not([readonly])');
      if (ta) {
        ta.value = (window.dkT ? window.dkT('saas.sample_text', 'DoKit is a free online toolkit. Paste any text here to count words, characters, and reading time — instantly, privately, in your browser.') : 'DoKit is a free online toolkit. Paste any text here to count words, characters, and reading time — instantly, privately, in your browser.');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.focus();
      }
    }
  });
})();

/* Sticky action bar (restored old features.js initStickyAction).
 * Mirrors the page's [data-sticky-action] button into a fixed
 * bottom bar on mobile (<=768px) once the real button has scrolled
 * above the viewport. Tapping the mirror clicks the real button. */
(function stickyAction() {
  if (!window.matchMedia || !('IntersectionObserver' in window)) { return; }
  var btn = document.querySelector('[data-sticky-action]');
  if (!btn) { return; }
  var bar = document.createElement('div');
  bar.className = 'dkf-sticky-action'; bar.hidden = true;
  var b = document.createElement('button');
  b.type = 'button'; b.className = 'btn';
  bar.appendChild(b); document.body.appendChild(bar);
  function syncLabel() { b.textContent = (btn.textContent || '').trim(); }
  syncLabel();
  b.addEventListener('click', function () { btn.click(); });
  var mq = window.matchMedia('(max-width: 768px)');
  function targetReady() {
    return btn.offsetParent !== null && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true';
  }
  function upd() {
    var r = btn.getBoundingClientRect();
    var scrolledPast = r.bottom < 0;
    var show = mq.matches && targetReady() && scrolledPast;
    bar.hidden = !show;
    document.body.classList.toggle('dkf-has-sticky', show);
  }
  new IntersectionObserver(function () { upd(); }, { threshold: 0 }).observe(btn);
  var tick = false;
  window.addEventListener('scroll', function () {
    if (tick) { return; } tick = true;
    requestAnimationFrame(function () { tick = false; upd(); });
  }, { passive: true });
  window.addEventListener('resize', upd);
  if (mq.addEventListener) { mq.addEventListener('change', upd); }
  try {
    new MutationObserver(function () { syncLabel(); upd(); })
      .observe(btn, { attributes: true, childList: true, subtree: true, characterData: true });
  } catch (e) {}
})();

  /* Phase 4: load the account backend module (account.js) on pages that
   * do not already include it — it bootstraps Firebase, syncs the header
   * (avatar + coin badge) and enforces maintenance mode. Guarded so a
   * page that lists account.js directly never loads it twice. */
  (function loadAccountModule(){
    try {
      if (window.__dkaLoaded) { return; }
      if (document.querySelector('script[src$="assets/js/account.js"]')) { window.__dkaLoaded = true; return; }
      var src = '';
      try { src = (document.currentScript && document.currentScript.src) || ''; } catch (e) {}
      var marker = 'assets/js/main.js';
      var at = src ? src.indexOf(marker) : -1;
      if (at < 0) { return; }
      window.__dkaLoaded = true;
      var s = document.createElement('script');
      s.src = src.slice(0, at) + 'assets/js/account.js';
      s.defer = true;
      document.head.appendChild(s);
    } catch (e) {}
  })();

/* Referral module loader: the wallet daily-claim button (wf-claim-btn)
 * prices its claim from DKREF.dailyClaimRate (streak wiring, owner order
 * 26 Oct 2026), but the wallet page does not list referrals.js — so load
 * it here when the button exists, exactly once. Click-time lookup means
 * load order vs account.js never matters; if the load fails, the claim
 * handler falls back to DAILY_CLAIM (flat 10). */
(function loadReferralModule(){
  try {
    if (window.DKREF) { return; }
    if (!document.getElementById('wf-claim-btn')) { return; }
    if (document.querySelector('script[src$="assets/js/referrals.js"]')) { return; }
    var src = '';
    try { src = (document.currentScript && document.currentScript.src) || ''; } catch (e) {}
    var marker = 'assets/js/main.js';
    var at = src ? src.indexOf(marker) : -1;
    if (at < 0) { return; }
    var s = document.createElement('script');
    s.src = src.slice(0, at) + 'assets/js/referrals.js';
    s.defer = true;
    document.head.appendChild(s);
  } catch (e) {}
})();

/* Homepage shoutout slot (item #55): the homepage does not list
 * referrals.js, so this loader (same pattern as the wallet loader
 * above) creates the slot right after the hero section — never
 * touching the hero itself — loads referrals.js exactly once, and
 * renders the slot when it arrives. Homepage only: site root with
 * nothing after it (live /DoKit/, local /). Any deeper path is a
 * tool/page index, not the home, and no slot is created there. */
(function loadHomepageShoutout(){
  try {
    var p = location.pathname || '';
    if (p.charAt(p.length - 1) !== '/') { return; }
    var root = p.replace(/\/+$/, '');
    if (root !== '' && root !== '/DoKit') { return; }
    if (window.DKREF && window.DKREF.renderHomepageShoutout) { window.DKREF.renderHomepageShoutout(); return; }
    if (document.querySelector('script[src$="assets/js/referrals.js"]')) { return; }
    var main = document.getElementById('main');
    if (!main) { return; }
    var hero = main.querySelector('section.hero');
    if (!hero || !hero.parentNode) { return; }
    var slot = document.getElementById('home-shoutout');
    if (!slot) {
      var section = document.createElement('section');
      section.className = 'block';
      slot = document.createElement('div');
      slot.id = 'home-shoutout';
      section.appendChild(slot);
      hero.parentNode.insertBefore(section, hero.nextSibling);
    }
    var src = '';
    try { src = (document.currentScript && document.currentScript.src) || ''; } catch (e) {}
    var marker = 'assets/js/main.js';
    var at = src ? src.indexOf(marker) : -1;
    if (at < 0) { return; }
    var s = document.createElement('script');
    s.src = src.slice(0, at) + 'assets/js/referrals.js';
    s.defer = true;
    s.onload = function () {
      try { if (window.DKREF && window.DKREF.renderHomepageShoutout) { window.DKREF.renderHomepageShoutout(); } } catch (e) {}
    };
    document.head.appendChild(s);
  } catch (e) {}
})();


/* Homepage featured slot (item #35): mirrors the #55 shoutout loader
 * EXACTLY (same homepage-only path check, same loads-referrals.js-once
 * guards, same render-on-load) — with one ordering rule: the featured
 * slot goes AFTER the shoutout section when it exists, else right
 * after the hero, so #55 is never displaced. No generator or
 * homepage-HTML edit, so the frozen hero is untouched. */
(function loadHomepageFeatured(){
  try {
    var p = location.pathname || '';
    if (p.charAt(p.length - 1) !== '/') { return; }
    var root = p.replace(/\/+$/, '');
    if (root !== '' && root !== '/DoKit') { return; }
    if (window.DKREF && window.DKREF.renderHomepageFeatured) { window.DKREF.renderHomepageFeatured(); return; }
    if (document.querySelector('script[src$="assets/js/referrals.js"]')) { return; }
    var main = document.getElementById('main');
    if (!main) { return; }
    var hero = main.querySelector('section.hero');
    if (!hero || !hero.parentNode) { return; }
    var slot = document.getElementById('home-featured');
    if (!slot) {
      var section = document.createElement('section');
      section.className = 'block';
      slot = document.createElement('div');
      slot.id = 'home-featured';
      section.appendChild(slot);
      var shout = document.getElementById('home-shoutout');
      if (shout && shout.parentNode && shout.parentNode.parentNode === hero.parentNode) {
        hero.parentNode.insertBefore(section, shout.parentNode.nextSibling);
      } else {
        hero.parentNode.insertBefore(section, hero.nextSibling);
      }
    }
    var src = '';
    try { src = (document.currentScript && document.currentScript.src) || ''; } catch (e) {}
    var marker = 'assets/js/main.js';
    var at = src ? src.indexOf(marker) : -1;
    if (at < 0) { return; }
    var s = document.createElement('script');
    s.src = src.slice(0, at) + 'assets/js/referrals.js';
    s.defer = true;
    s.onload = function () {
      try { if (window.DKREF && window.DKREF.renderHomepageFeatured) { window.DKREF.renderHomepageFeatured(); } } catch (e) {}
    };
    document.head.appendChild(s);
  } catch (e) {}
})();

/* Task 8 — privacy-first analytics writer (restored from old js/analytics.js).
 * EVENTS (only these two shapes, nothing else is ever collected):
 *   pageview  {type, page, lang, ts} and tool_used {type, page, tool, action, ts}.
 * NO PII BY CONTRACT: no cookies, no fingerprinting, no IP storage, no typed
 * text, no names, no emails, no uids, no tokens. Referrer is host-only, never
 * the full URL. Respects navigator.doNotTrack === "1" (module no-ops).
 * DESTINATION: Firestore collection "analytics", one doc per event, batched
 * with a WriteBatch every 5s (MAX_BATCH 40), plus a best-effort flush when
 * the tab hides. Field limits: page <= 200 chars, extra strings <= 120,
 * type <= 30, tool slug <= 60, lang <= 8, ref host <= 80, action <= 40.
 * FAILURE CONTRACT (historical, kept): every failure is silent — analytics
 * never breaks the page. No Firestore yet (account.js still loading its SDK)
 * means the queued events drop; later events flow once DKA.db() exists.
 * ADAPTATIONS vs the old file (only these two): the db accessor is phase2's
 * DKA.db() (account.js, the ported successor of the old DKF.db()); the
 * writer lives here in main.js (site-wide carrier, as the old site-wide.js
 * loader carried it) instead of a separate analytics.js file, because the
 * brief forbids new files. Admin-panel reads are NOT restored (out of scope).
 * RULES (already in firestore.rules, verified, not changed): analytics docs
 * allow create when page is a non-empty string <= 200 chars; read admin-only;
 * update/delete never. */
(function () {
  'use strict';
  if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') { return; }
  var QUEUE = [];
  var FLUSH_MS = 5000;
  var MAX_BATCH = 40;
  var flushing = false;
  function lang() {
    try { return (window.DKI18N && DKI18N.getLang && DKI18N.getLang()) || document.documentElement.lang || 'en'; }
    catch (e) { return 'en'; }
  }
  function page() {
    try {
      var p = window.location.pathname || '/';
      p = p.replace(/index\.html$/, '');
      return p.slice(0, 200) || '/';
    } catch (e) { return '/'; }
  }
  function toolSlug() {
    var m = page().match(/^\/DoKit\/tools\/([^\/]+)\/?$/) || window.location.pathname.match(/\/tools\/([^\/]+)\/?$/);
    return m ? m[1].slice(0, 60) : null;
  }
  function enqueue(type, extra) {
    try {
      var e = { type: type, page: page(), lang: String(lang()).slice(0, 8), ts: null };
      if (extra && typeof extra === 'object') {
        for (var k in extra) {
          if (Object.prototype.hasOwnProperty.call(extra, k) && typeof extra[k] === 'string') {
            e[k] = extra[k].slice(0, 120);
          }
        }
      }
      try {
        var r = document.referrer ? new URL(document.referrer).hostname : '';
        if (r && r !== window.location.hostname) { e.ref = r.slice(0, 80); }
      } catch (e2) {}
      QUEUE.push(e);
      if (QUEUE.length >= MAX_BATCH) { flush(); }
    } catch (e3) {}
  }
  function flush() {
    if (flushing || !QUEUE.length) { return; }
    var db = null;
    try { db = (window.DKA && window.DKA.db) ? window.DKA.db() : null; } catch (e) {}
    if (!db) { QUEUE.length = 0; return; }
    flushing = true;
    var batch = QUEUE.splice(0, MAX_BATCH);
    try {
      var wb = db.batch();
      var col = db.collection('analytics');
      batch.forEach(function (e) {
        e.ts = firebase.firestore.FieldValue.serverTimestamp();
        wb.set(col.doc(), e);
      });
      wb.commit().then(function () { flushing = false; if (QUEUE.length) { flush(); } },
        function () { flushing = false; });
    } catch (e) { flushing = false; }
  }
  function init() {
    try {
      enqueue('pageview', {});
      setInterval(flush, FLUSH_MS);
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') { flush(); }
      });
      var slug = toolSlug();
      if (slug) {
        document.addEventListener('click', function (ev) {
          try {
            var b = ev.target && ev.target.closest ? ev.target.closest('button, a.btn, input[type=submit]') : null;
            if (!b) { return; }
            var label = (b.textContent || b.value || '').trim().slice(0, 40);
            enqueue('tool_used', { tool: slug, action: label });
          } catch (e) {}
        }, { passive: true });
      }
    } catch (e) {}
  }
  window.DKAnalytics = {
    track: function (type, extra) { enqueue(String(type).slice(0, 30), extra || {}); },
    toolUsed: function (tool, action) { enqueue('tool_used', { tool: tool, action: action }); },
    flush: flush
  };
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
