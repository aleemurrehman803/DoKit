
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
    paused = !paused; pb.textContent = paused ? 'Resume motion' : 'Pause motion';
    if(!paused && !reduced){ draw(); }
  }); }
  if(reduced){ ctx.clearRect(0,0,W,H); parts.forEach(function(p){ ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle='rgba('+p.c+',.8)'; ctx.fill(); }); }
}
// typing headline rotator
var rot = document.getElementById('type-rotator');
if(rot){
  var words = ['Image Resizer','Image Compressor','Image Converter','Word Counter','Case Converter','Typing Test','Board Photo','Password Generator','Unit Converter','QR Generator'];
  if(reduced){ rot.textContent = words[0]; }
  else{
    var wi = 0, ci = 0, del = false;
    (function tick(){
      var w = words[wi];
      rot.textContent = w.slice(0, ci);
      if(!del){ ci++; if(ci > w.length){ del = true; setTimeout(tick, 1400); return; } setTimeout(tick, 90); }
      else{ ci--; if(ci === 0){ del = false; wi = (wi + 1) % words.length; } setTimeout(tick, del ? 40 : 90); }
    })();
  }
}
// chatbot shell — honest preview: navigation help only, no fake answers
var fab = document.getElementById('chat-fab'), panel = document.getElementById('chat-panel');
if(fab && panel){ fab.addEventListener('click', function(){ panel.classList.toggle('open'); }); }
var form = document.getElementById('chat-form');
if(form){
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var inp = document.getElementById('chat-input'); var q = (inp.value || '').trim(); if(!q) return;
    var log = document.getElementById('chat-log');
    var u = document.createElement('div'); u.className = 'msg'; u.textContent = q; log.appendChild(u);
    var b = document.createElement('div'); b.className = 'msg bot';
    var low = q.toLowerCase(), reply = 'The Doki chatbot in this preview only helps with navigation — live answers arrive with the backend in Phase 3. ';
    var links = [];
    if(/price|pricing|pro|team|rs |cost/.test(low)) links.push(['Pricing', form.getAttribute('data-pricing')]);
    if(/compress|100kb|50kb|size|shrink/.test(low)) links.push(['Image Compressor', form.getAttribute('data-compressor')]);
    if(/resiz|pixel|dimension/.test(low)) links.push(['Image Resizer', form.getAttribute('data-resizer')]);
    if(/convert|png|jpg|webp/.test(low)) links.push(['Image Converter', form.getAttribute('data-converter')]);
    if(/word|count|character/.test(low)) links.push(['Word Counter', form.getAttribute('data-counter')]);
    if(/case|upper|lower|camel|snake/.test(low)) links.push(['Case Converter', form.getAttribute('data-case')]);
    if(/typ|wpm|lesson|urdu/.test(low)) links.push(['Typing Test', form.getAttribute('data-typing')]);
    if(/lesson|curriculum/.test(low))links.push(['Lessons',f.getAttribute('data-lessons')]);
    if(/practice|drill/.test(low))links.push(['Practice',f.getAttribute('data-practice')]);
    if(/game/.test(low))links.push(['Games',f.getAttribute('data-games')]);
    if(/board|exam photo|admission photo/.test(low))links.push(['Board Photo',f.getAttribute('data-board')]);
    if(/password/.test(low))links.push(['Password Generator',f.getAttribute('data-password')]);
    if(/unit|kilometre|kilometer|pound|weight|convert units/.test(low))links.push(['Unit Converter',f.getAttribute('data-unit')]);
    if(/\bqr\b/.test(low))links.push(['QR Generator',f.getAttribute('data-qr')]);
    if(/battle|fight|coin/.test(low))links.push(['TypeFight Battle',f.getAttribute('data-battle')]);
    if(/wall|testimonial/.test(low))links.push(['Wall of Love',f.getAttribute('data-wall')]);
    if(/changelog|release|update/.test(low))links.push(['Changelog',f.getAttribute('data-changelog')]);
    if(/status|down|offline/.test(low))links.push(['System Status',f.getAttribute('data-status')]);
    if(/api|developer/.test(low))links.push(['API Docs',f.getAttribute('data-api')]);
    if(/design|system|brand|colour|color/.test(low))links.push(['Design System',f.getAttribute('data-design')]);
    if(/certificate/.test(low))links.push(['Certificate',f.getAttribute('data-certificate')]);
    if(/result|history/.test(low))links.push(['Results',f.getAttribute('data-results')]);
    if(/progress|stats/.test(low))links.push(['Progress',f.getAttribute('data-progress')]);
    if(/dashboard/.test(low))links.push(['Dashboard',f.getAttribute('data-dashboard')]);
    if(/contact|email|support|human/.test(low)) links.push(['Contact', form.getAttribute('data-contact')]);
    if(links.length === 0) links.push(['FAQ', form.getAttribute('data-faq')], ['All Tools', form.getAttribute('data-tools')]);
    b.textContent = reply + 'These pages may help:';
    links.forEach(function(lk){
      if(!lk[1]){ return; }
      var a = document.createElement('a'); a.className = 'chip'; a.href = lk[1]; a.textContent = lk[0]; b.appendChild(document.createElement('br')); b.appendChild(a);
    });
    log.appendChild(b); inp.value = ''; log.scrollTop = log.scrollHeight;
  });
}
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

})();
