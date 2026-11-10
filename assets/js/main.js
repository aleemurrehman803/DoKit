
(function(){
/* P5-UX-23 (T023): one silent-error counter for the codebase's empty catch
 * sites. Every empty catch calls window.dkSwallow(err, where): it always
 * counts in memory (invisible to users) and console.warns only when the
 * debug flag is on (?dkdebug=1, or window.DK_DEBUG = true in the console).
 * Behaviour is untouched — this only observes, and the observer itself can
 * never throw. Inspect with window.DKDiag.count / .last (last 50 entries). */
window.DKDiag = { count: 0, last: [] };
window.dkSwallow = function (err, where) {
  try {
    window.DKDiag.count++;
    var entry = { where: where || '?', message: (err && err.message) ? String(err.message) : String(err), at: Date.now() };
    window.DKDiag.last.push(entry);
    if (window.DKDiag.last.length > 50) window.DKDiag.last.shift();
    if (window.DK_DEBUG) { console.warn('[DoKit] swallowed error:', entry.where, entry.message); }
  } catch (e) { /* the observer must never throw, even if diagnostics break */ }
};
try {
  if (new URLSearchParams(window.location.search).get('dkdebug') === '1') { window.DK_DEBUG = true; }
} catch (e) { /* URL parsing must never break boot */ }
var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// B58: ONE pause state for all decorative motion. `paused` = the visitor
// pressed Pause (persisted in localStorage); `tabHidden` = the T046
// tab-hidden auto-pause. dkSyncPaused() applies html.dk-paused from
// either source, so the tab-hidden listener can never wipe a manual
// pause (and resuming the tab can never resume a manual pause).
// The CSS rule html.dk-paused *{animation-play-state:paused} freezes
// every CSS animation in place (float cards, marquee, …); the canvas
// loop and the rotator check `paused` directly. Under reduced motion
// everything is already static, so no persisted pause is restored.
var paused = false;
var tabHidden = document.visibilityState === 'hidden';
try{ if(!reduced && localStorage.getItem('dokit_motion_paused') === '1'){ paused = true; } }catch(e){ window.dkSwallow && window.dkSwallow(e, 'main.js'); }
function dkSyncPaused(){ document.documentElement.classList.toggle('dk-paused', paused || tabHidden); }
/* Phase F F01 (rec 01) + shared pointer-effects handler (recs 07/09, 45):
 * ONE delegated pointermove for all cursor-responsive effects (button
 * glow + magnetic nudge now; card tilt + spotlight hook in here later),
 * rAF-throttled, so N buttons never mean N listeners. WHY the gates:
 * fine-pointer only (touch gets native :active feedback, no hover glow),
 * reduced-motion off (the global CSS rule cannot stop JS-set custom
 * properties), and paused off (consistent with the canvas + rotator,
 * which also stop while html.dk-paused). The magnetic nudge writes the
 * standalone `translate` property (--tx/--ty), never `transform`, so it
 * composes with the existing :hover lift instead of overwriting it.
 * Without JS (or without a fine pointer) every button is exactly the
 * old .btn — the glow/magnetism are progressive enhancement only. */
(function dkPointerFX(){
  if (reduced) { return; }
  var fine = false;
  try { fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) { /* assume coarse */ }
  if (!fine) { return; }
  var lastBtn = null, lastCard = null, rafId = 0, pendingEvt = null;
  function resetBtn(btn){
    if (!btn) { return; }
    btn.style.setProperty('--tx', '0px');
    btn.style.setProperty('--ty', '0px');
  }
  function resetCard(card){
    if (!card) { return; }
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  }
  function apply(evt){
    rafId = 0;
    if (document.documentElement.classList.contains('dk-paused')) { return; }
    var t = (evt.target && evt.target.closest) ? evt.target : null;
    var btn = t ? t.closest('.btn') : null;
    if (lastBtn && lastBtn !== btn) { resetBtn(lastBtn); }
    lastBtn = btn;
    if (btn) {
      var r = btn.getBoundingClientRect();
      if (r.width && r.height) {
        var x = evt.clientX - r.left, y = evt.clientY - r.top;
        btn.style.setProperty('--mx', x + 'px');
        btn.style.setProperty('--my', y + 'px');
        /* Magnetic nudge: at most 4px toward the cursor, proportional to how
         * far the pointer is from the button centre. */
        var tx = Math.max(-4, Math.min(4, ((x / r.width) - 0.5) * 8));
        var ty = Math.max(-4, Math.min(4, ((y / r.height) - 0.5) * 8));
        btn.style.setProperty('--tx', tx.toFixed(1) + 'px');
        btn.style.setProperty('--ty', ty.toFixed(1) + 'px');
      }
    }
    /* Phase F F07/F09 (recs 07, 09): the same pointer position drives the
     * card spotlight (--mx/--my, every .card/.ref-stat) and the tool-card
     * tilt (--rx/--ry, .tool-card only, max 3deg). One handler, no
     * per-card listeners (rec 45). */
    var card = t ? t.closest('.card, .ref-stat') : null;
    if (lastCard && lastCard !== card) { resetCard(lastCard); }
    lastCard = card;
    if (card) {
      var cr = card.getBoundingClientRect();
      if (cr.width && cr.height) {
        var cx = evt.clientX - cr.left, cy = evt.clientY - cr.top;
        card.style.setProperty('--mx', cx + 'px');
        card.style.setProperty('--my', cy + 'px');
        if (card.classList.contains('tool-card')) {
          var rx = Math.max(-3, Math.min(3, ((cy / cr.height) - 0.5) * -6));
          var ry = Math.max(-3, Math.min(3, ((cx / cr.width) - 0.5) * 6));
          card.style.setProperty('--rx', rx.toFixed(1) + 'deg');
          card.style.setProperty('--ry', ry.toFixed(1) + 'deg');
        }
      }
    }
  }
  document.addEventListener('pointermove', function (evt){
    pendingEvt = evt;
    if (!rafId) { rafId = requestAnimationFrame(function(){ apply(pendingEvt); }); }
  }, { passive: true });
})();
/* Phase F F12 (rec 12): flash a number element once when its genuine
 * value changes. The .num-flash animation (style.css) is a short amber
 * + scale pulse; reduced-motion kills it via the global rule. Callers
 * must only call this AFTER writing the real value, and only when the
 * value actually changed — never on initial render, never with a
 * fabricated value. */
window.dkFlashNum = function (el) {
  if (!el || !el.classList) { return; }
  el.classList.remove('num-flash');
  void el.offsetWidth; /* restart the animation */
  el.classList.add('num-flash');
};
/* Phase F F26 (rec 26): window.dkToast — the toast system the
 * certificate page's DKUI.toast call sites were reaching for (DKUI was
 * never defined, so those PDF-failure notices were dead no-ops). One
 * toast at a time: a new call replaces the old one; role="status" so
 * screen readers announce it; auto-dismiss after 3.5s with a fade-out
 * (.dk-toast-out, style.css). The message is set via textContent, so
 * no caller can inject HTML through it. DKUI.toast points at the same
 * function, so the existing guarded certificate.js call sites come
 * alive with no edits there. */
var dkToastEl = null, dkToastTimer = null;
window.dkToast = function (msg) {
  if (!msg) { return; }
  if (dkToastTimer) { clearTimeout(dkToastTimer); dkToastTimer = null; }
  if (dkToastEl) { dkToastEl.remove(); dkToastEl = null; }
  var t = document.createElement('div');
  t.className = 'dk-toast'; t.setAttribute('role', 'status');
  t.textContent = String(msg);
  document.body.appendChild(t);
  dkToastEl = t;
  dkToastTimer = setTimeout(function () {
    if (dkToastEl === t) { t.classList.add('dk-toast-out'); }
    setTimeout(function () { if (dkToastEl === t) { t.remove(); dkToastEl = null; } }, 250);
  }, 3500);
};
window.DKUI = window.DKUI || {}; window.DKUI.toast = window.dkToast;
// T030 (P5-VIS-07): one header menu open at a time. Each menu binder
// registers its OWN existing close function here; closeAllMenus(except)
// runs every other registered closer, so opening any menu closes all the
// rest — no second close mechanism, and Esc / outside-click / focus-return
// keep calling the same closers as before. The mobile nav panel
// (#nav-links, a class toggle rather than a hidden menu) is closed the
// same way. An ancestor of the menu being opened is never closed: the
// profile-menu language menu (#langMenu) lives inside #profMenu, so
// opening it must leave the profile menu open. Exposed on window so
// i18n.js (loaded later, dynamically) can register the language menus
// and call it too.
var dkMenuRegistry = [];
function dkRegisterMenu(menuId, closeFn){
  if (!menuId || typeof closeFn !== 'function') { return; }
  dkMenuRegistry.push({ menuId: menuId, close: closeFn });
}
function dkCloseNavLinks(){
  var l = document.getElementById('nav-links'), t = document.getElementById('nav-toggle');
  if (l && l.classList.contains('open')) {
    l.classList.remove('open');
    if (t) { t.setAttribute('aria-expanded', 'false'); }
  }
}
function closeAllMenus(exceptMenuId){
  var exceptEl = exceptMenuId ? document.getElementById(exceptMenuId) : null;
  dkMenuRegistry.forEach(function (entry) {
    if (entry.menuId === exceptMenuId) { return; }
    var el = document.getElementById(entry.menuId);
    if (exceptEl && el && el.contains(exceptEl)) { return; } // ancestor: keep open
    try { entry.close(); } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
  });
  // T039 (P5-DES-13): #nav-links is an ancestor of the nav dropdowns,
  // so the ancestor rule above applies here too — closing the mobile
  // nav would hide the dropdown being opened (<=1000px hamburger band,
  // N05 Phase C: band moved 900px -> 1000px).
  if (exceptMenuId !== 'nav-links') {
    var navLinks = document.getElementById('nav-links');
    if (!(exceptEl && navLinks && navLinks.contains(exceptEl))) { dkCloseNavLinks(); }
  }
}
window.dkRegisterMenu = dkRegisterMenu;
window.dkCloseAllMenus = closeAllMenus;
// mobile nav
var t = document.getElementById('nav-toggle'), l = document.getElementById('nav-links');
if(t && l){ t.addEventListener('click', function(){ var open = l.classList.toggle('open'); t.setAttribute('aria-expanded', open ? 'true' : 'false'); if (open) { closeAllMenus('nav-links'); } }); }
// F32 (rec 32): the mobile nav previously closed ONLY via its toggle
// (or by opening another menu) — an outside tap or Escape left it open
// over the page. It now joins the central menu registry (so opening any
// other menu still closes it, via closeAllMenus) AND gets the same two
// closers every bindMenu menu has: an outside-click closer (ignoring
// clicks on the toggle itself and inside the nav, so the dropdown
// carets keep working) and an Escape closer that returns focus to the
// toggle, mirroring bindMenu's returnFocus pattern.
if (typeof window.dkRegisterMenu === 'function') { window.dkRegisterMenu('nav-links', dkCloseNavLinks); }
document.addEventListener('click', function (e) {
  if (l && l.classList.contains('open') && !l.contains(e.target) && e.target !== t && !t.contains(e.target)) { dkCloseNavLinks(); }
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && l && l.classList.contains('open')) { dkCloseNavLinks(); if (t) { t.focus(); } }
});
// active nav
try{
  var here = new URL(window.location.href).pathname.replace(/\/index\.html$/, '/');
  document.querySelectorAll('#nav-links a').forEach(function(a){
    var p = new URL(a.href, window.location.href).pathname.replace(/\/index\.html$/, '/');
    if(p === here){ a.classList.add('active'); }
  });
}catch(e){ window.dkSwallow && window.dkSwallow(e, 'main.js'); }
// reveal on scroll
// N08 (Phase C): stagger the reveal 60ms per item within its parent
// (design §05), capped at 300ms so long lists do not trail absurdly.
// The delay is set once here; the observer (or the fallback below)
// only adds .in — the CSS transition does the rest.
document.querySelectorAll('.reveal').forEach(function(el){
  var sibs = el.parentElement ? el.parentElement.querySelectorAll('.reveal') : [];
  var idx = Array.prototype.indexOf.call(sibs, el);
  if(idx > 0){ el.style.transitionDelay = (Math.min(idx, 5) * 60) + 'ms'; }
});
if('IntersectionObserver' in window && !reduced){
  var io = new IntersectionObserver(function(es){ es.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } }); }, {threshold: .12});
  document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
} else { document.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('in'); }); }
// B53: live tool search — filter + results listbox + Enter routing.
// The registry is the page's own .tool-card elements (one source, shared
// with the /tools/ page): name from data-name, keywords from
// data-keywords, description from the card text. Routing uses ONLY the
// card's own link (allow-list) — the query text is never used as a URL,
// so javascript:/protocol-relative input can never navigate off-site.
var s = document.getElementById('tool-search');
if(s){
  var resultsBox = document.getElementById('tool-search-results');
  var emptyBox = document.getElementById('tool-search-empty');
  var clearBtn = document.getElementById('tool-search-clear');
  var activeOpt = -1; // index into the current visible matches
  function norm(t){ return String(t || '').toLowerCase().replace(/-/g, ' '); }
  // All cards on this page, with their link + searchable text, in DOM order.
  function toolEntries(){
    var out = [];
    document.querySelectorAll('.tool-card').forEach(function(c){
      var link = c.querySelector('a.cardlink');
      if(!link) { return; }
      out.push({ card: c, link: link, name: (c.getAttribute('data-name') || '').trim(),
        hay: norm((c.getAttribute('data-name') || '') + ' ' + (c.getAttribute('data-keywords') || '') + ' ' + c.textContent) });
    });
    return out;
  }
  function currentMatches(q){
    if(!q) { return []; }
    return toolEntries().filter(function(e){ return e.hay.indexOf(q) !== -1; });
  }
  function hideBoxes(){
    if(resultsBox){ resultsBox.hidden = true; resultsBox.innerHTML = ''; }
    if(emptyBox){ emptyBox.hidden = true; }
    s.setAttribute('aria-expanded', 'false');
    activeOpt = -1;
  }
  function markActive(list){
    var opts = resultsBox ? resultsBox.querySelectorAll('[role="option"]') : [];
    opts.forEach(function(o, i){
      var on = (i === activeOpt);
      o.classList.toggle('active', on);
      o.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if(list && list[activeOpt]) { s.setAttribute('aria-activedescendant', 'opt-' + activeOpt); }
    else { s.removeAttribute('aria-activedescendant'); }
  }
  function goTo(entry){
    if(!entry) { return; }
    // Same-origin by construction: the href comes from a card on this page.
    window.location.href = new URL(entry.link.getAttribute('href'), window.location.href).href;
  }
  s.addEventListener('input', function(){
    var q = norm(s.value.trim());
    var entries = toolEntries();
    entries.forEach(function(e){
      e.card.style.display = (!q || e.hay.indexOf(q) !== -1) ? '' : 'none';
    });
    if(!resultsBox && !emptyBox) { return; } // /tools/ page: filter only
    var matches = currentMatches(q);
    activeOpt = -1;
    if(!q){ hideBoxes(); return; }
    if(matches.length === 0){
      if(resultsBox){ resultsBox.hidden = true; resultsBox.innerHTML = ''; }
      if(emptyBox){ emptyBox.hidden = false; }
      s.setAttribute('aria-expanded', 'false');
      return;
    }
    if(emptyBox){ emptyBox.hidden = true; }
    if(resultsBox){
      resultsBox.innerHTML = '';
      matches.forEach(function(e, i){
        var b = document.createElement('button');
        b.type = 'button'; b.setAttribute('role', 'option'); b.id = 'opt-' + i;
        b.setAttribute('aria-selected', 'false'); b.textContent = e.name;
        // mousedown (not click): fires before the input blur that hides the box.
        b.addEventListener('mousedown', function(ev){ ev.preventDefault(); goTo(e); });
        resultsBox.appendChild(b);
      });
      resultsBox.hidden = false;
      s.setAttribute('aria-expanded', 'true');
    }
  });
  s.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){ s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); s.blur(); return; }
    var matches = currentMatches(norm(s.value.trim()));
    if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
      if(!resultsBox || resultsBox.hidden || matches.length === 0) { return; }
      e.preventDefault();
      activeOpt = e.key === 'ArrowDown'
        ? Math.min(activeOpt + 1, matches.length - 1)
        : Math.max(activeOpt - 1, 0);
      markActive(matches);
      return;
    }
    if(e.key === 'Enter'){
      if(matches.length === 0) { return; } // empty state: never navigate
      e.preventDefault();
      goTo(activeOpt >= 0 ? matches[activeOpt] : matches[0]);
    }
  });
  document.addEventListener('click', function(e){
    if(resultsBox && !resultsBox.hidden && !e.target.closest('.search-field')) { hideBoxes(); }
  });
  if(clearBtn){
    clearBtn.addEventListener('click', function(){
      s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); s.focus();
    });
  }
}
// T046 (P5-DES-22): pause infinite animations while the tab is hidden.
// visibilitychange updates the shared state (B58) — the class is set
// from paused || tabHidden, so a manual pause survives a tab switch.
// The CSS rule freezes every animation with play-state:paused (not
// none), so each one resumes from exactly where it stopped — no jump.
document.addEventListener('visibilitychange', function(){
  tabHidden = document.visibilityState === 'hidden';
  dkSyncPaused();
});
dkSyncPaused();
// hero particles
var cv = document.getElementById('hero-canvas');
// T046/B58: `paused` + `tabHidden` are hoisted above (single pause
// state); framePending guards so at most one frame is ever scheduled
// (the visible-kick and the Pause button both re-kick).
var framePending = false;
if(cv){
  var ctx = cv.getContext('2d'), W, H, parts = [];
  function size(){ var r = cv.parentElement.getBoundingClientRect(); W = cv.width = r.width; H = cv.height = r.height; }
  // DA-01 (Phase C): the hero particles are the design's constellation
  // (§01) — violet-only dots (rgba(185,170,255,.8), r .6-2.4, at most
  // 70, one per 16px of width) joined by faint lines when two dots are
  // closer than d^2 < 11000. The line alpha fades with distance.
  function mk(){ parts = []; var n = Math.min(70, Math.floor(W / 16));
    for(var i = 0; i < n; i++){ parts.push({x: Math.random()*W, y: Math.random()*H, r: .6 + Math.random()*1.8, vx: (Math.random()-.5)*.35, vy: (Math.random()-.5)*.35, c: '185,170,255'}); } }
  // paint() draws one frozen frame (lines + dots) at the current
  // positions; draw() moves the dots first, then paints. The two
  // static spots below (resize-while-paused, reduced-motion) call
  // paint() so a frozen canvas looks like a paused animation, not a
  // different picture — and so the line logic exists exactly once.
  function paint(){
    ctx.clearRect(0, 0, W, H);
    var i, j, a, b, dx, dy, d2;
    for(i = 0; i < parts.length; i++){ for(j = i + 1; j < parts.length; j++){
      a = parts[i]; b = parts[j]; dx = a.x - b.x; dy = a.y - b.y; d2 = dx*dx + dy*dy;
      if(d2 < 11000){ ctx.strokeStyle = 'rgba(139,116,255,' + ((1 - d2/11000)*.35).toFixed(3) + ')'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    } }
    parts.forEach(function(p){
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fillStyle = 'rgba(' + p.c + ',.8)'; ctx.fill();
    });
  }
  function draw(){
    parts.forEach(function(p){
      p.x += p.vx; p.y += p.vy;
      if(p.x < 0 || p.x > W) p.vx *= -1; if(p.y < 0 || p.y > H) p.vy *= -1;
    });
    paint();
    framePending = false;
    if(!paused && !reduced && !tabHidden){ framePending = true; requestAnimationFrame(draw); }
  }
  size(); mk(); draw();
  /* F45 (rec 45): resize fires continuously during a window drag and
   * size()+mk() rebuilds the whole particle field per event — throttle
   * to one rebuild per animation frame (same tick pattern as the scroll
   * listeners elsewhere in this file; those are already rAF + passive).
   * The admin tab-indicator resize re-measure is a single cheap read
   * and the pointer handler is already one delegated rAF handler. */
  var cvResizeTick = false;
  window.addEventListener('resize', function(){
    if(cvResizeTick){ return; }
    cvResizeTick = true;
    requestAnimationFrame(function(){
      cvResizeTick = false;
      size(); mk(); if(paused || reduced){ paint(); }
    });
  });
  var pb = document.getElementById('pause-motion');
  if(pb){
    // B58: keep the label via its data-i18n key (not a bare textContent
    // overwrite, which used to discard the binding until the next
    // language change) and expose the state to assistive tech.
    function syncPauseBtn(){
      pb.setAttribute('aria-pressed', paused ? 'true' : 'false');
      pb.setAttribute('data-i18n', paused ? 'rsv_1003' : 'rsv_0433');
      pb.textContent = paused ? dkT('rsv_1003', 'Resume motion') : dkT('rsv_0433', 'Pause motion');
    }
    document.addEventListener('dokit:langchange', syncPauseBtn);
    syncPauseBtn(); // applies a persisted pause (class + label + pressed)
    dkSyncPaused();
    pb.addEventListener('click', function(){
      paused = !paused;
      dkSyncPaused();
      syncPauseBtn();
      try{ localStorage.setItem('dokit_motion_paused', paused ? '1' : '0'); }catch(e){ window.dkSwallow && window.dkSwallow(e, 'main.js'); }
      if(!paused && !reduced && !tabHidden && !framePending){ draw(); }
    });
  }
  document.addEventListener('visibilitychange', function(){
    tabHidden = document.visibilityState === 'hidden';
    if(!tabHidden && !paused && !reduced && !framePending){ framePending = true; requestAnimationFrame(draw); }
  });
  if(reduced){ paint(); }
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
  }catch(e){ window.dkSwallow && window.dkSwallow(e, 'main.js'); }
  return fallback;
}
window.dkT = dkT;
/* F39 (rec 39): shared accessible form-error helper. Marks the field
 * invalid, links it to its message element (aria-describedby), shows
 * the message, and moves focus to the field — the three things the
 * site's showMsg-only pattern never did. The message element may be
 * passed as an id string or an element (notify forms use a classed
 * <p> with no id — one is generated so the link can point at it);
 * when message is null the element's existing text is kept (the
 * notify error already carries its own text + mailto, and the auth
 * catch paths already wrote theirs via showMsg). A showMsg-style
 * message element (class note/err) also gets the err class so the
 * error reads as an error, not a note. The invalid flag clears as
 * soon as the user starts fixing the field. Exposed on window so
 * account.js / settings.js share it (main.js loads first
 * everywhere). Callers keep their own message wording via dkT
 * fallbacks, exactly like the showMsg calls they replace. */
var dkFailCounter = 0;
window.dkFailField = function (inputEl, errEl, message) {
  if (!inputEl) { return false; }
  inputEl.setAttribute('aria-invalid', 'true');
  var err = (typeof errEl === 'string') ? document.getElementById(errEl) : errEl;
  if (err) {
    if (message) { err.textContent = message; }
    if (!err.id) { dkFailCounter += 1; err.id = 'dk-err-' + dkFailCounter; }
    var described = inputEl.getAttribute('aria-describedby') || '';
    if (described.split(/\s+/).indexOf(err.id) === -1) {
      inputEl.setAttribute('aria-describedby', (described ? described + ' ' : '') + err.id);
    }
    if (!err.getAttribute('aria-live')) { err.setAttribute('aria-live', 'polite'); }
    if (err.classList && (err.classList.contains('note') || err.classList.contains('err'))) {
      err.classList.remove('note');
      err.classList.add('err');
    }
    if (err.hidden) { err.hidden = false; }
  }
  if (!inputEl.dataset.dkFailBound) {
    inputEl.dataset.dkFailBound = '1';
    inputEl.addEventListener('input', function () { inputEl.removeAttribute('aria-invalid'); });
  }
  try { inputEl.focus(); } catch (e) { /* old browsers: focus stays put */ }
  return true;
};
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
      // B58: while paused, re-check without touching ci/del — the word
      // freezes mid-type and resumes exactly where it stopped.
      if(paused){ setTimeout(tick, 200); return; }
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
/* F48 (rec 48): the avatar now has srcset derivatives (96w/192w/400w).
 * A src-only swap would leave srcset pointing at the other variant, so
 * the browser would render the wrong (awake/asleep) photo from srcset.
 * Swap both, by the same 'doki-photo' <-> 'doki-photo-sleep' rename —
 * the derivative names keep the same prefix, so one rename covers all
 * sizes. The awake->sleep rename uses a negative lookahead so an
 * already-sleep URL is never double-renamed. */
function dokiSwapPhoto(img, sleep){
  if(!img) return;
  if(sleep){
    if(img.src) img.src = img.src.replace(/doki-photo(?!-sleep)/g, 'doki-photo-sleep');
    var ss = img.getAttribute('srcset');
    if(ss) img.setAttribute('srcset', ss.replace(/doki-photo(?!-sleep)/g, 'doki-photo-sleep'));
  } else {
    if(img.src) img.src = img.src.replace(/doki-photo-sleep/g, 'doki-photo');
    var ss2 = img.getAttribute('srcset');
    if(ss2) img.setAttribute('srcset', ss2.replace(/doki-photo-sleep/g, 'doki-photo'));
  }
}
function dokiSet(el, state){
  if(!el) return;
  DOKI_STATES.forEach(function(s){ el.classList.remove(s); });
  el.classList.add(state);
  // Photo pass: the header img follows the state. Sleep shows the
  // video's own closed-eye frame; every other state restores the
  // open-eye photo (this also ends a mid-blink swap cleanly).
  var img = el.querySelector('.doki-photo');
  if(img && img.src){
    dokiSwapPhoto(img, state === 'doki--sleep');
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
  // DES-21: close fades out (dkAnimateClose) instead of snapping; a
  // click on a panel that is mid-close re-opens it.
  var opened;
  if (panel.classList.contains('open')) {
    if (panel.classList.contains('closing')) { dkCancelClose(panel); opened = true; }
    else { dkAnimateClose(panel, function(){ panel.classList.remove('open'); }); opened = false; }
  } else {
    dkCancelClose(panel); panel.classList.add('open'); opened = true;
  }
  dokiLoadFaq();
  // Panel open: greeting briefly, then idle. Panel closed: sleep off,
  // FAB instance stays idle (it is always idle).
  if(opened){ dokiHeadGreet(); dokiSleepArm(); } else { dokiSleepClear(); }
  // B96: keyboard users land in the input when the panel opens — no
  // extra Tab stops through the page behind the panel.
  if(opened){ var ci = document.getElementById('chat-input'); if(ci){ ci.focus(); } }
}); }
/* F42 (rec 42): the panel-head Doki photo is loading="lazy" (it lives
 * in #chat-panel, display:none until opened, so the browser would not
 * fetch it until first open — and the open would show a missing avatar
 * until the photo arrived). Prefetch on intent: pointer hover, keyboard
 * focus, or touch press on the FAB starts the fetch before the click,
 * so first open is instant on hover/keyboard. Touch without hover still
 * fetches on open (the prefetch and the click are milliseconds apart
 * there — documented limitation). Setting loading="eager" on the
 * already-parsed img triggers the fetch. */
if(fab && panel){
  var dokiHeadImg = document.querySelector('#chat-panel .chead .doki-photo');
  var dokiHeadPrefetched = false;
  function dokiHeadPrefetch(){
    if(dokiHeadPrefetched || !dokiHeadImg) return;
    dokiHeadPrefetched = true;
    dokiHeadImg.loading = 'eager';
  }
  fab.addEventListener('pointerenter', dokiHeadPrefetch);
  fab.addEventListener('focusin', dokiHeadPrefetch);
  fab.addEventListener('pointerdown', dokiHeadPrefetch);
}
// AUD-052: chat-panel Escape-close, mirroring the nav-drop pattern
// (bindNavDrop): close on Escape and return focus to the launcher
// (here the FAB). The panel is non-modal; this only adds the close.
// DES-21: focus returns immediately while the panel fades — the
// keyboard user is never left waiting on (or trapped by) the close.
if(fab && panel){ document.addEventListener('keydown', function(e){
  if(e.key === 'Escape' && panel.classList.contains('open')){
    dkAnimateClose(panel, function(){ panel.classList.remove('open'); });
    fab.focus();
  }
}); }
/* F36 (rec 36): the chat log is a live region — new bot/user messages
 * are announced politely. Set here in JS (one place) instead of
 * editing the shared chrome in 71 pages. */
(function () {
  var log = document.getElementById('chat-log');
  if (log && !log.getAttribute('aria-live')) { log.setAttribute('aria-live', 'polite'); }
})();
/* F36 (rec 36): the chat panel had no close button — keyboard and
 * touch users could only close it with Escape or the FAB toggle.
 * The button is created here in JS (one place) instead of editing
 * the shared chrome in 71 pages; it uses the same animated close
 * path as the FAB toggle and returns focus to the FAB. */
if (fab && panel) {
  var chead = panel.querySelector('.chead');
  if (chead && !document.getElementById('chat-close-btn')) {
    var chatCloseBtn = document.createElement('button');
    chatCloseBtn.type = 'button';
    chatCloseBtn.id = 'chat-close-btn';
    chatCloseBtn.className = 'chat-close';
    chatCloseBtn.setAttribute('aria-label', dkT('rsv_0960', 'Close'));
    chatCloseBtn.textContent = '×';
    chatCloseBtn.addEventListener('click', function () {
      dkAnimateClose(panel, function(){ panel.classList.remove('open'); });
      dokiSleepClear();
      fab.focus();
    });
    chead.appendChild(chatCloseBtn);
  }
}
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
  if(!imgs.length || !imgs[0].src) return;
  /* F48 (rec 48): preload the SLEEP variant the blink swaps to — the
   * dpr-appropriate derivative from the img's own srcset (96w at dpr<=1.5,
   * 192w above), so the 150ms blink frame is cached at the size actually
   * rendered. Was: the 400w sleep photo (118 KB) on every page load. */
  var ss = imgs[0].getAttribute('srcset') || '';
  var cands = ss.split(',').map(function(p){ return p.trim().split(/\s+/); });
  var want = (window.devicePixelRatio || 1) > 1.5 ? '192w' : '96w';
  var pick = null;
  cands.forEach(function(c){ if(c[1] === want) pick = c[0]; });
  var url = pick || imgs[0].src.replace('doki-photo.png', 'doki-photo-sleep.png');
  var pre = new Image();
  pre.src = url.replace(/doki-photo(?!-sleep)/g, 'doki-photo-sleep');
})();
function dokiBlinkTick(){
  // F37 (rec 37): reduced-motion / paused users never get the idle
  // blink — the photo swap is motion, and the global CSS rule cannot
  // reach this JS image swap. The 150ms restore below still runs if
  // a blink was already mid-flight when the user paused, so the
  // open-eye photo is always restored.
  if (reduced || paused) { return; }
  var head = dokiHead();
  if(!head || !head.classList.contains('doki--idle')) return;
  var imgs = dokiPhotoImgs();
  imgs.forEach(function(img){
    if(/doki-photo\.png$/.test(img.src)) dokiSwapPhoto(img, true);
  });
  setTimeout(function(){
    var h = dokiHead();
    if(h && h.classList.contains('doki--idle')){
      imgs.forEach(function(img){ dokiSwapPhoto(img, false); });
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
/* P5-RTE-01: lazy-load the Doki knowledge base on first chat-panel open
 * instead of on every page load (71 KB saved until the user chats).
 * Idempotent: one shared promise for the panel-open call and the submit
 * handler's wait. Resolves even on load failure (after a 3s safety
 * timeout) so chat never hangs — the answer then falls back to links,
 * exactly as it does when no KB is present. */
var __dkKbPromise = null;
function ensureKb(){
  if (window.DKASSIST_KB) { return Promise.resolve(true); }
  if (__dkKbPromise) { return __dkKbPromise; }
  __dkKbPromise = new Promise(function (resolve) {
    var done = false;
    function finish(ok){ if (!done) { done = true; resolve(ok); } }
    try {
      var base = window.__dkJsBase || '';
      if (!base) {
        var m = document.querySelector('script[src$="assets/js/main.js"]');
        base = m ? m.src.replace(/assets\/js\/main\.js.*$/, 'assets/js/') : '';
      }
      if (!base) { finish(false); return; }
      var s = document.createElement('script');
      s.src = base + 'assistant-kb.js';
      s.onload = function(){ finish(true); };
      s.onerror = function(){ finish(false); };
      document.head.appendChild(s);
      setTimeout(function(){ finish(false); }, 3000);
    } catch (e) { finish(false); }
  });
  return __dkKbPromise;
}
function dokiLoadFaq(){
  // KB-only (Oct 26): no FAQ/AI provider is loaded. Doki answers from
  // assistant-kb.js plus the owner-approved static FAQ (dk-faq.js,
  // B97), both lazy-loaded on first panel open (P5-RTE-01 pattern).
  // Still no provider: the FAQ is a static lookup, never a live-AI call.
  ensureDokiSources();
}
// B97: lazy-load the owner-approved FAQ the same way as the KB — one
// shared promise, 3s safety timeout, resolves false on failure so the
// turn falls back to KB/links instead of hanging.
var __dkFaqPromise = null;
function ensureFaq(){
  if (window.DKFAQ) { return Promise.resolve(true); }
  if (__dkFaqPromise) { return __dkFaqPromise; }
  __dkFaqPromise = new Promise(function (resolve) {
    var done = false;
    function finish(ok){ if (!done) { done = true; resolve(ok); } }
    try {
      var base = window.__dkJsBase || '';
      if (!base) {
        var m = document.querySelector('script[src$="assets/js/main.js"]');
        base = m ? m.src.replace(/assets\/js\/main\.js.*$/, 'assets/js/') : '';
      }
      if (!base) { finish(false); return; }
      var s = document.createElement('script');
      s.src = base + 'dk-faq.js';
      s.onload = function(){ finish(true); };
      s.onerror = function(){ finish(false); };
      document.head.appendChild(s);
      setTimeout(function(){ finish(false); }, 3000);
    } catch (e) { finish(false); }
  });
  return __dkFaqPromise;
}
// B97: one combined lazy load for both static Doki sources (KB +
// approved FAQ). A failed load just means that source is skipped.
function ensureDokiSources(){
  return Promise.all([ensureKb(), ensureFaq()]).then(function(){ return true; });
}
// B97/B98 (Phase B): whole-word matching helpers for the Doki matcher.
// Tokenising on Unicode letters/digits (not \b, which is ASCII-only
// and would break non-Latin keywords) keeps Urdu/Arabic/Hindi keywords
// working exactly like English ones.
var DK_STOP = {a:1, an:1, the:1, is:1, are:1, was:1, were:1, do:1, does:1, did:1, how:1, what:1, when:1, where:1, which:1, who:1, whom:1, why:1, can:1, could:1, should:1, would:1, will:1, may:1, might:1, i:1, me:1, my:1, you:1, your:1, we:1, us:1, our:1, it:1, its:1, this:1, that:1, there:1, here:1, of:1, for:1, to:1, in:1, on:1, at:1, by:1, with:1, from:1, and:1, or:1, but:1, if:1, so:1, not:1, no:1, please:1, get:1, have:1, has:1, had:1, am:1, be:1, been:1, any:1, all:1, about:1, into:1, over:1, under:1, up:1, down:1, out:1, per:1, via:1};
function dkTokens(s){
  return (s || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(function (w) { return !!w; });
}
function dkWordEq(a, b){
  // Plural-tolerant equality: 'plan' matches 'plans', never a substring.
  return a === b || (a + 's') === b || (b + 's') === a;
}
function dkPhraseHit(tokens, phrase){
  var pt = dkTokens(phrase);
  if (!pt.length) { return false; }
  if (pt.length === 1) {
    for (var i = 0; i < tokens.length; i++) { if (dkWordEq(tokens[i], pt[0])) { return true; } }
    return false;
  }
  for (var s = 0; s + pt.length <= tokens.length; s++) {
    var ok = true;
    for (var j = 0; j < pt.length; j++) { if (!dkWordEq(tokens[s + j], pt[j])) { ok = false; break; } }
    if (ok) { return true; }
  }
  return false;
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
    try { lang = localStorage.getItem('dokit_lang') || 'en'; } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
    return { messages: this.history.concat([{ role: 'user', text: q }]), personality: 'helpful', lang: lang };
  },
  clear: function () { this.history = []; }
};
var form = document.getElementById('chat-form');
if(form){
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var inp = document.getElementById('chat-input'); var q = (inp.value || '').trim(); if(!q) return;
    /* P5-RTE-01 (B97: KB + approved FAQ): both sources are lazy-loaded
     * (first panel open). If they have not arrived yet, show thinking
     * dots and answer once they land (or after the load fails/times
     * out — the links fallback then applies, as before). The common
     * path (sources already present) runs synchronously, exactly as
     * before. */
    if (window.DKASSIST_KB && window.DKFAQ) { runChatSubmit(); return; }
    var log = document.getElementById('chat-log');
    var b = document.createElement('div'); b.className = 'msg bot';
    var dots = document.createElement('span'); dots.className = 'dk-thinking';
    for (var di = 0; di < 3; di++) { dots.appendChild(document.createElement('i')); }
    b.appendChild(dots); log.appendChild(b); log.scrollTop = log.scrollHeight;
    ensureDokiSources().then(function(){
      if (b.parentNode) { b.parentNode.removeChild(b); }
      runChatSubmit();
    });
    function runChatSubmit(){
    var log = document.getElementById('chat-log');
    var u = document.createElement('div'); u.className = 'msg'; u.textContent = q; log.appendChild(u);
    // B96: drop the suggestion chips once the user has asked — they
    // have done their job, and the transcript stays clean.
    var sg = log.querySelector('.doki-suggest'); if (sg) { sg.parentNode.removeChild(sg); }
    // Session record: user turn + the request a future provider would get.
    // No send happens while provider is null (KB path below answers).
    var req = window.DKChat.buildRequest(q);
    window.DKChat.history.push({ role: 'user', text: q });
    // B96: a brief, honest thinking state on the fast (KB-loaded) path.
    // The answer is a local lookup, but the dots + thinking face make
    // the turn feel answered rather than pasted, and give the header
    // state time to be seen. The KB-wait path above already shows dots
    // while the KB loads, so this delay applies only here.
    var think = document.createElement('div'); think.className = 'msg bot';
    var tdots = document.createElement('span'); tdots.className = 'dk-thinking';
    for (var tdi = 0; tdi < 3; tdi++) { tdots.appendChild(document.createElement('i')); }
    think.appendChild(tdots); log.appendChild(think); log.scrollTop = log.scrollHeight;
    dokiSet(dokiHead(), 'doki--thinking');
    setTimeout(function(){ renderChatAnswer(); }, 300);
    function renderChatAnswer(){
    if (think.parentNode) { think.parentNode.removeChild(think); }
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
    // are never invented. No KB match falls through to the FAQ lookup,
    // then the honest unknown-answer branch (B98).
    var kbHit = null;
    var qTokens = dkTokens(low);
    try {
      var kb = window.DKASSIST_KB;
      if (kb) {
        var kbLang = 'en';
        try { kbLang = localStorage.getItem('dokit_lang') || 'en'; } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
        var entries = kb[kbLang] || kb.en || [];
        // B98: whole-word matcher with a confidence threshold (replaces
        // the substring scorer). The old scorer let a 3-letter stopword
        // match by substring ('for' in 'format' scored +2, 'how' in the
        // phrase 'how many words' scored +2, 'account' contains
        // 'count'), so uncovered questions got confident wrong tool
        // answers. Now a keyword counts only as a whole word (or a
        // consecutive phrase), plural-tolerant, Unicode-safe.
        // Scoring: the entry's first keyword (its distinctive root,
        // e.g. 'resize') scores 3; a multi-word phrase scores 3 (it is
        // specific evidence, e.g. 'who built dokit'); any other single
        // keyword scores 2; a short token (<= 3 letters: 'png', 'wpm',
        // 'pro') scores 3 on an exact whole-word hit only — it is
        // distinctive, not a stopword. One question word can only be
        // spent once: the KB lists both 'plan' and 'plans', and
        // plural-tolerant matching would otherwise count the same word
        // twice (ERR-B-018). A hit needs >= 3, so one generic word
        // (e.g. 'capital' for the case converter, +2) can never answer.
        var best = null, bestScore = 0;
        entries.forEach(function (en) {
          var score = 0;
          var usedSingles = {};
          (en.kw || []).forEach(function (k, ki) {
            var kk = String(k).toLowerCase();
            if (!dkPhraseHit(qTokens, kk)) { return; }
            var kt = dkTokens(kk);
            if (kt.length === 1) {
              var hitTok = null;
              for (var ti = 0; ti < qTokens.length; ti++) { if (dkWordEq(qTokens[ti], kt[0])) { hitTok = qTokens[ti]; break; } }
              if (hitTok && usedSingles[hitTok]) { return; }
              if (hitTok) { usedSingles[hitTok] = 1; }
              if (kt[0].length <= 3) { score += 3; }
              else if (ki === 0) { score += 3; }
              else { score += 2; }
            } else {
              score += 3;
            }
          });
          if (score > bestScore) { bestScore = score; best = en; }
        });
        if (best && bestScore >= 3) { kbHit = best; }
      }
    } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
    // B97: approved-FAQ grounding (second source, KB first). The FAQ
    // file is owner-approved static data (dk-faq.js, 93 Q&As) consulted
    // as a static lookup — never a live-AI call, provider stays null.
    // A hit needs >= 2 distinct content words from the question
    // (whole-word, plural-tolerant) with at least one word of length
    // >= 5, so stopword-only or single-word questions cannot match.
    // (qTokens is defined above, before the KB match.)
    var faqHit = null;
    try {
      var faq = window.DKFAQ;
      if (faq && faq.length) {
        var content = qTokens.filter(function (w) { return w.length >= 4 && !DK_STOP[w]; });
        // Short tokens count only if they are real content words:
        // stopwords ('do', 'is', 'of') appear in nearly every FAQ
        // question and would otherwise inflate any score (ERR-B-019).
        var shorts = qTokens.filter(function (w) { return w.length >= 2 && w.length < 4 && !DK_STOP[w]; });
        var bestFaq = null, bestFaqScore = 0, bestFaqLong = false;
        faq.forEach(function (item) {
          var ft = dkTokens((item.q || '') + ' ' + (item.a || ''));
          var fset = {}; ft.forEach(function (w) { fset[w] = 1; });
          var score = 0, hasLong = false;
          content.forEach(function (w) {
            for (var k in fset) { if (dkWordEq(w, k)) { score += 1; if (w.length >= 5) { hasLong = true; } break; } }
          });
          shorts.forEach(function (w) {
            // Short tokens count only on an exact whole-word hit in the
            // FAQ *question* (not the answer body) — 'pay' must be what
            // the question is about, not a passing mention.
            if (dkTokens(item.q || '').indexOf(w) !== -1) { score += 1; }
          });
          if (score > bestFaqScore) { bestFaqScore = score; bestFaq = item; bestFaqLong = hasLong; }
        });
        if (bestFaq && bestFaqScore >= 2 && bestFaqLong) { faqHit = bestFaq; }
      }
    } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
    // Shared fallback renderer: the sync links path and the AI path's
    // ungrounded/error fallback render exactly the same chips.
    function appendChatLinks(el){
      // WHY (i18n): chat link labels translate through the same dict
      // keys as the footer/cards. T083 (P5-UX-30): the last eight labels
      // (Lessons, Practice, Games, TypeFight Battle, Changelog, API Docs,
      // Design System, Progress) now map to their existing keys too, so
      // every chip renders in the active language.
      var CHAT_LABEL_KEY = {'Pricing':'nav_pricing','Image Compressor':'tool_compressor_name','Image Resizer':'tool_resizer_name','Image Converter':'tool_converter_name','Word Counter':'tool_counter_name','Case Converter':'tool_case_name','Typing Test':'test_title','Board Photo':'bp.title','Password Generator':'cs2_t','Unit Converter':'cs4_t','QR Generator':'cs1_t','Wall of Love':'wol.title','System Status':'status.title','Certificate':'cert_word','Results':'resizer.results_title','Dashboard':'acct_dash_h1','Contact':'nav_contact','FAQ':'nav_faq','All Tools':'nav_all_tools','Lessons':'rsv_0367','Practice':'rsv_0453','Games':'rsv_0280','TypeFight Battle':'tool_typefight_name','Changelog':'rsv_0144','API Docs':'rsv_0214','Design System':'rsv_0208','Progress':'rsv_0469'};
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
      // B97: source line — every KB answer names the site page it came
      // from. Founder/coins derive their URL from the pricing URL: the
      // form carries no data-about / data-referrals attribute, and the
      // replace keeps the same relative depth from every page.
      var pricingHref = form.getAttribute('data-pricing') || '';
      var kbSrcMap = {
        'founder': ['nav_about', pricingHref.replace(/pricing\/$/, 'about/')],
        'image-resizer': ['tool_resizer_name', form.getAttribute('data-resizer')],
        'image-compressor': ['tool_compressor_name', form.getAttribute('data-compressor')],
        'image-converter': ['tool_converter_name', form.getAttribute('data-converter')],
        'word-counter': ['tool_counter_name', form.getAttribute('data-counter')],
        'case-converter': ['tool_case_name', form.getAttribute('data-case')],
        'typing': ['test_title', form.getAttribute('data-typing')],
        'typefight': ['tool_typefight_name', form.getAttribute('data-battle')],
        'pricing': ['nav_pricing', form.getAttribute('data-pricing')],
        'coins': ['ref_nav', pricingHref.replace(/pricing\/$/, 'account/referrals/')],
        'hub': ['nav_all_tools', form.getAttribute('data-tools')]
      };
      var kbSrc = kbSrcMap[kbHit.id] || null;
      if (kbSrc && kbSrc[1]) {
        var ka = document.createElement('a'); ka.className = 'chip'; ka.href = kbSrc[1]; ka.textContent = dkT('rsv_0989', 'Open it'); b.appendChild(document.createElement('br')); b.appendChild(ka);
        b.appendChild(document.createElement('br'));
        var srcLine = document.createElement('span'); srcLine.className = 'doki-source';
        srcLine.textContent = dkT('rsv_1458', 'Source:') + ' ';
        var srcA = document.createElement('a'); srcA.href = kbSrc[1]; srcA.textContent = dkT(kbSrc[0], kbSrc[0]);
        srcLine.appendChild(srcA); b.appendChild(srcLine);
      }
      // KB-hit answer: success briefly, then idle (mirrors the AI path).
      dokiHeadSuccess();
    } else if (faqHit) {
      // B97: approved-FAQ answer, with the same source line (FAQ page).
      b.textContent = faqHit.a || '';
      b.appendChild(document.createElement('br'));
      var fsrc = document.createElement('span'); fsrc.className = 'doki-source';
      fsrc.textContent = dkT('rsv_1458', 'Source:') + ' ';
      var fsrcA = document.createElement('a'); fsrcA.href = form.getAttribute('data-faq'); fsrcA.textContent = dkT('nav_faq', 'FAQ');
      fsrc.appendChild(fsrcA); b.appendChild(fsrc);
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
      // B98: honest unknown-answer branch. Below the confidence
      // threshold Doki says so and directs to Contact FIRST (then FAQ
      // and All Tools) — it never invents an answer and never pitches
      // an unrelated tool. The Contact chip is forced here even when
      // the question's own words suggested other links above.
      b.textContent = dkT('rsv_1452', "I don't have that in DoKit's own information. Please contact us — we'll be glad to help.");
      links = [['Contact', form.getAttribute('data-contact')], ['FAQ', form.getAttribute('data-faq')], ['All Tools', form.getAttribute('data-tools')]];
      appendChatLinks(b);
    }
    // B96: the thinking face set above must always resolve — a KB hit
    // shows success (inside its branch); any other sync answer returns
    // to idle here so the header never sticks on thinking.
    var _h = dokiHead();
    if (_h && _h.classList.contains('doki--thinking')) { dokiSet(_h, 'doki--idle'); }
    log.appendChild(b); inp.value = ''; log.scrollTop = log.scrollHeight;
    // Session record: bot turn (rendered answer text, chips included).
    window.DKChat.history.push({ role: 'bot', text: b.textContent });
    if (window.__dokiChatSave) { window.__dokiChatSave(); }
    } /* end renderChatAnswer (B96: thinking-delay wrapper) */
    } /* end runChatSubmit (P5-RTE-01: KB-wait wrapper) */
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
    if(dokiListening && dokiRec){ try { dokiRec.stop(); } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); } return; }
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
          try { dokiRec.stop(); } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
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
    // B96: suggested questions (covered KB topics only) + tab-scoped
    // history. The chips are real <button>s built here, not in HTML,
    // so every page with the panel gets them from this one place.
    // History lives in sessionStorage (tab-scoped, matching the old
    // in-memory model): a reload in the same tab restores the chat,
    // closing the tab forgets it. Nothing is ever sent to Firestore.
    // The log HTML round-trips safely: user text is inserted via
    // textContent, so it is escaped in the serialised HTML.
    var CHAT_STORE_KEY = 'dokit_chat_history';
    function dokiChatSave(){
      try {
        var msgs = log.querySelectorAll('.msg');
        // Cap the stored transcript (last 30 turns) so one tab cannot
        // grow storage without bound.
        var keep = [];
        for (var i = Math.max(0, msgs.length - 30); i < msgs.length; i++) { keep.push(msgs[i].outerHTML); }
        window.sessionStorage.setItem(CHAT_STORE_KEY, keep.join(''));
      } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
    }
    window.__dokiChatSave = dokiChatSave;
    function dokiSuggestBuild(){
      // Show only while the log holds just the greeting — once the
      // user has asked something, the chips have done their job.
      if (log.querySelector('.doki-suggest')) { return; }
      if (log.querySelectorAll('.msg').length !== 1) { return; }
      var row = document.createElement('div');
      row.className = 'doki-suggest';
      var lab = document.createElement('span');
      lab.className = 'doki-suggest-label';
      lab.textContent = dkT('rsv_1453', 'Try one:');
      row.appendChild(lab);
      var chipQs = ['How do I resize an image?', 'How do I compress an image?', 'How do I start typing practice?', 'How do I earn coins?'];
      ['rsv_1454', 'rsv_1455', 'rsv_1456', 'rsv_1457'].forEach(function (key, idx) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip doki-suggest-chip';
        chip.textContent = dkT(key, chipQs[idx]);
        row.appendChild(chip);
      });
      log.appendChild(row);
    }
    // One delegated listener for the chips: it survives a history
    // restore (restored chips are the same buttons, re-created from
    // the stored HTML) and costs a single handler per page.
    log.addEventListener('click', function (ev) {
      var chip = ev.target && ev.target.closest ? ev.target.closest('.doki-suggest-chip') : null;
      if (!chip) { return; }
      var inp = document.getElementById('chat-input');
      if (!inp) { return; }
      inp.value = chip.textContent;
      chatForm.dispatchEvent(new Event('submit', { cancelable: true }));
    });
    // Restore a same-tab transcript, if any, and rebuild the
    // in-memory session from it (the provider request builder reads
    // DKChat.history). The mode bar lives outside #chat-log, so it is
    // never part of the stored transcript.
    try {
      var stored = window.sessionStorage.getItem(CHAT_STORE_KEY);
      if (stored) {
        log.innerHTML = stored;
        window.DKChat.history = [];
        Array.prototype.forEach.call(log.querySelectorAll('.msg'), function (m) {
          window.DKChat.history.push({ role: m.classList.contains('bot') ? 'bot' : 'user', text: m.textContent });
        });
        // The greeting clone must track the restored greeting.
        var restoredGreet = log.querySelector('.msg');
        if (restoredGreet) { greetClone = restoredGreet.cloneNode(true); }
      }
    } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
    dokiSuggestBuild();
    fresh.addEventListener('click', function () {
      window.DKChat.clear();
      try { window.sessionStorage.removeItem(CHAT_STORE_KEY); } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
      // Re-clone the greeting now (not at init): the i18n engine may
      // have re-rendered it after this script ran, and the stored
      // transcript's first message is the greeting in the live language.
      var g = log.querySelector('.msg');
      if (g) { greetClone = g.cloneNode(true); }
      while (log.firstChild) { log.removeChild(log.firstChild); }
      if (greetClone) { log.appendChild(greetClone.cloneNode(true)); }
      dokiSuggestBuild();
    });
    bar.appendChild(mode);
    bar.appendChild(fresh);
    panel.insertBefore(bar, chatForm);
  } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
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
      /* P5-RTE-01: remember the JS base for lazy loads (KB on first chat
       * open; extra i18n dicts on language switch). document.currentScript
       * is only set while this script evaluates. */
      window.__dkJsBase = base;
      function load(f, next) {
        var s = document.createElement('script'); s.src = base + f;
        if (next) { s.onload = next; s.onerror = next; }
        document.head.appendChild(s);
      }
      /* P5-RTE-01: load only the active language dict (+ English fallback)
       * instead of the 1.25 MB ten-language monolith. Language resolution
       * mirrors i18n.js current(): ?lang= wins, then stored dokit_lang,
       * then English. (assistant-kb.js is no longer loaded here — it loads
       * on first chat-panel open; see ensureKb/dokiLoadFaq.) */
      var LANGS = ['en','ur','ar','hi','es','fr','pt','de','tr','ru'];
      function isLang(c){ return LANGS.indexOf(c) !== -1; }
      function activeLang(){
        try {
          var q = new URLSearchParams(window.location.search).get('lang');
          if (q && isLang(q)) { return q; }
        } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
        try {
          var stored = window.localStorage.getItem('dokit_lang');
          if (stored && isLang(stored)) { return stored; }
        } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
        return 'en';
      }
      var lang = activeLang();
      // Dictionary first, engine second: the engine reads the dict
      // on init, so order matters (chained, not parallel). Once the
      // engine arrives, re-sync the hero H1 (it loads async, after
      // main.js has already run).
      function loadEngine(){
        load('i18n.js', function () {
          if (typeof window.syncHeroH1 === 'function') { window.syncHeroH1(); }
          if (typeof window.syncFavsPanel === 'function') { window.syncFavsPanel(); }
          if (typeof window.syncAuthResolvingRow === 'function') { window.syncAuthResolvingRow(); } // UI-03: resolving row text, once the dict arrives
          if (typeof window.syncPwBits === 'function') { window.syncPwBits(); } // QA8-DICTSYNC: entropy line, tools-extra.js
          if (typeof window.syncInstallBanner === 'function') { window.syncInstallBanner(); }
          if (typeof window.syncSiteBanner === 'function') { window.syncSiteBanner(); }
          if (typeof window.syncTourSteps === 'function') { window.syncTourSteps(); }
          if (typeof window.syncDemoCounts === 'function') { window.syncDemoCounts(); }
          if (typeof window.syncKeyboards === 'function') { window.syncKeyboards(); }
          if (typeof window.syncDurations === 'function') { window.syncDurations(); }
          if (typeof window.syncTrend === 'function') { window.syncTrend(); }
          if (typeof window.syncGoal === 'function') { window.syncGoal(); }
          if (typeof window.syncStreak === 'function') { window.syncStreak(); }
          if (typeof window.syncTimeline === 'function') { window.syncTimeline(); }
          if (typeof window.syncContinue === 'function') { window.syncContinue(); }
          if (typeof window.syncLevel === 'function') { window.syncLevel(); }
          if (typeof window.syncTheme === 'function') { window.syncTheme(); }
          if (typeof window.syncProblemKeys === 'function') { window.syncProblemKeys(); }
          if (typeof window.syncShareMsg === 'function') { window.syncShareMsg(); }
          if (typeof window.syncRzBg === 'function') { window.syncRzBg(); }
        });
      }
      if (lang === 'en') {
        load('i18n-dict-en.js', loadEngine);
      } else {
        load('i18n-dict-en.js', function () {
          load('i18n-dict-' + lang + '.js', loadEngine);
        });
      }
    } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
  })();
  // DES-21: animated close-out for menus/panels (shared helper).
  // Opening animates (dkmenuin .15s) but the hidden-toggle mechanism
  // hid instantly. The close path adds .closing (dkmenuout .15s, the
  // exact reverse), waits DK_CLOSE_MS, then hides. Timeout-only — no
  // animationend listener: a listener would misfire on the NEXT open
  // animation if a close was cancelled mid-flight. Re-open cancels
  // the pending timer first (dkCancelClose), so a fast close->reopen
  // can never hide a freshly opened menu. Reduced-motion users get
  // the instant close (unchanged behaviour); the global CSS rule
  // would also kill the animation, which is why the load-time
  // `reduced` flag — not animationend — decides the path. Exposed on
  // window so i18n.js (loaded later, dynamically) can use it too.
  var DK_CLOSE_MS = 150;
  function dkCancelClose(el){
    if(!el) return;
    if(el._dkCloseTimer){ clearTimeout(el._dkCloseTimer); el._dkCloseTimer = null; }
    el.classList.remove('closing');
  }
  function dkAnimateClose(el, doHide){
    if(!el) return;
    if(el.classList.contains('closing')) return; // already closing; the pending timer hides it
    if(el._dkCloseTimer){ clearTimeout(el._dkCloseTimer); el._dkCloseTimer = null; } // defensive: timer without the class
    if(reduced){ doHide(); return; }
    el.classList.add('closing');
    el._dkCloseTimer = setTimeout(function(){
      el._dkCloseTimer = null;
      el.classList.remove('closing');
      doHide();
    }, DK_CLOSE_MS);
  }
  window.dkAnimateClose = dkAnimateClose;
  window.dkCancelClose = dkCancelClose;
  // Small dropdown helper (used by language + profile menus): toggle
  // on button click, close on outside click or Escape. returnFocus
  // (launcher only): on Escape, return focus to the button — never
  // on outside-click, which would yank focus mid-task.
  /* F36 (rec 36): arrow-key navigation for dropdown menus. Menus are
   * plain navigation links (NOT role="menu" — that role is for
   * application menus; these are site navigation, so links keep
   * their link semantics and arrow keys are an added convenience,
   * not a replacement for Tab). ArrowDown/ArrowUp move between the
   * menu's visible links/buttons (wrapping); Home/End jump to the
   * ends. Attached to the menu element, so it only fires while
   * focus is inside an open menu. */
  function dkMenuArrows(menu){
    menu.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') { return; }
      var items = [];
      menu.querySelectorAll('a[href], button').forEach(function (el) {
        if (!el.hidden && !el.disabled && el.offsetParent !== null) { items.push(el); }
      });
      if (!items.length) { return; }
      var at = items.indexOf(document.activeElement);
      var next = at;
      if (e.key === 'ArrowDown') { next = (at + 1) % items.length; }
      else if (e.key === 'ArrowUp') { next = (at - 1 + items.length) % items.length; }
      else if (e.key === 'Home') { next = 0; }
      else if (e.key === 'End') { next = items.length - 1; }
      e.preventDefault();
      items[next].focus();
    });
  }
  function bindMenu(btnId, menuId, onPick, returnFocus){
    var btn = document.getElementById(btnId), menu = document.getElementById(menuId);
    if (!btn || !menu) { return; }
    // T030 (P5-VIS-07): the one close path for this menu — reused by the
    // outside-click closer, the Escape closer and the central registry
    // (closeAllMenus), so every close behaves identically.
    function closeThis(){
      if (!menu.hidden) { dkAnimateClose(menu, function(){ menu.hidden = true; }); }
      btn.setAttribute('aria-expanded', 'false');
    }
    // T030: register with the central "one menu open at a time" registry.
    if (typeof window.dkRegisterMenu === 'function') { window.dkRegisterMenu(menuId, closeThis); }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      // Re-open a menu that is mid-close instead of letting it vanish.
      if (menu.classList.contains('closing')) {
        closeAllMenus(menuId);
        dkCancelClose(menu); menu.hidden = false;
        btn.setAttribute('aria-expanded', 'true'); return;
      }
      var willOpen = menu.hidden;
      // T030: opening this menu closes every other menu first.
      if (willOpen) { closeAllMenus(menuId); dkCancelClose(menu); menu.hidden = false; }
      else { closeThis(); }
      btn.setAttribute('aria-expanded', String(willOpen));
    });
    document.addEventListener('click', closeThis);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) {
        closeThis();
        if (returnFocus) { btn.focus(); }
      }
    });
    dkMenuArrows(menu); // F36: arrow-key navigation between menu items.
    if (onPick) { menu.addEventListener('click', onPick); }
  }
  // Language selector: owned entirely by i18n.js (it toggles the
  // menu and applies the choice). main.js must NOT also bind it —
  // two toggles on one click would open then immediately close it.
  // Profile avatar menu: links only, no balance shown (no real source).
  // F36: the profile menu now returns focus on Escape too (it was the
  // only bindMenu call without returnFocus — keyboard users lost
  // their place when closing it).
  bindMenu('dkProfBtn', 'profMenu', null, true);
  // Header menus: guest/auth rows (items 99/103). Rows carry
  // data-menu="guest" (Login/Sign up) or "auth" (Dashboard/Settings/
  // Notifications/...). account.js owns the auth truth (Firebase) and
  // reports it via window.dkApplyHeaderAuth; main.js loads account.js
  // on every page (loadAccountModule below), so the stored flag is NOT
  // the source of truth — it is only a 15-second fallback hint if
  // Firebase never reports (SDK blocked/unreachable). The Logout row
  // (data-menu="auth-action") is deliberately NOT toggled here — only
  // account.js shows it, because only account.js can bind the
  // sign-out click.
  // UI-03: a third state — RESOLVING (authed === null). While Firebase
  // auth has not reported yet, no guest/auth row is shown as fact:
  // both stay hidden and a neutral "Checking sign-in…" row (no user
  // data at all) is shown instead. The row is created once here
  // (main.js runs on every page) and re-localised on dokit:langchange
  // like the other boot-time rows. On pages without #profMenu
  // (renderNav pages) the row simply does not exist — no-op.
  var dkAuthResolvingRow = null;
  var dkAuthResolved = false;
  function syncAuthResolvingRow(){
    if (!dkAuthResolvingRow) { return; }
    dkAuthResolvingRow.textContent = dkT('auth_checking_signin', 'Checking sign-in…');
  }
  window.syncAuthResolvingRow = syncAuthResolvingRow;
  try {
    var profMenuEl = document.getElementById('profMenu');
    if (profMenuEl) {
      dkAuthResolvingRow = document.createElement('span');
      dkAuthResolvingRow.className = 'prof-row';
      dkAuthResolvingRow.setAttribute('data-menu', 'resolving');
      dkAuthResolvingRow.hidden = true;
      dkAuthResolvingRow.textContent = dkT('auth_checking_signin', 'Checking sign-in…');
      profMenuEl.insertBefore(dkAuthResolvingRow, profMenuEl.firstChild);
      document.addEventListener('dokit:langchange', syncAuthResolvingRow);
    }
  } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
  function applyHeaderAuth(authed){
    if (authed === null) {
      /* Resolving: hide every state row, show only the neutral note. */
      document.querySelectorAll('#profMenu [data-menu], #appPanel [data-menu]').forEach(function (el) {
        var kind = el.getAttribute('data-menu');
        if (kind === 'guest' || kind === 'auth') { el.hidden = true; }
      });
      if (dkAuthResolvingRow) { dkAuthResolvingRow.hidden = false; }
      try {
        var headR = document.querySelector('#appPanel [data-app-section="account"]');
        if (headR) { headR.hidden = true; }
      } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
      return;
    }
    dkAuthResolved = true;
    if (dkAuthResolvingRow) { dkAuthResolvingRow.hidden = true; }
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
    } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
  }
  window.dkApplyHeaderAuth = applyHeaderAuth;
  /* Boot in RESOLVING, not from the stale flag. If Firebase never
   * reports within 15s (SDK blocked), fall back to the flag hint —
   * the next auth report still corrects it. */
  try {
    applyHeaderAuth(null);
    var dkAuthFlagHint = false;
    try { dkAuthFlagHint = localStorage.getItem('dokit_authed') === '1'; } catch (e) { dkAuthFlagHint = false; }
    setTimeout(function () {
      if (!dkAuthResolved) { try { applyHeaderAuth(dkAuthFlagHint); } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); } }
    }, 15000);
  } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
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
    // T030 (P5-VIS-07): opening this dropdown closes every other menu
    // first (hover-open, caret click and mid-close re-open all flow
    // through open()).
    function open(){ closeAllMenus(menuId); dkCancelClose(menu); menu.hidden = false; caret.setAttribute('aria-expanded', 'true'); }
    function close(){
      // DES-21: only the visual hide is delayed (150ms fade); the state
      // (aria-expanded, pinned) changes immediately, as before.
      if(!menu.hidden){ dkAnimateClose(menu, function(){ menu.hidden = true; }); }
      caret.setAttribute('aria-expanded', 'false'); pinned = false;
    }
    // T030: register this dropdown's existing close with the central registry.
    if (typeof window.dkRegisterMenu === 'function') { window.dkRegisterMenu(menuId, close); }
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
      // DES-21: a caret click on a menu that is mid-close re-opens it
      // instead of pinning a menu that is about to vanish.
      else if (menu.classList.contains('closing')) { pinned = true; open(); }
      else if (pinned) { close(); }
      else { pinned = true; }
    });
    drop.addEventListener('mouseenter', function () {
      try {
        if (window.matchMedia('(hover:hover)').matches) { open(); }
      } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
    });
    drop.addEventListener('mouseleave', function () { if (!pinned) { close(); } });
    document.addEventListener('click', function (e) {
      if (!drop.contains(e.target)) { close(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { close(); caret.focus(); }
    });
    dkMenuArrows(menu); // F36: arrow-key navigation between dropdown links.
  }
  bindNavDrop('pricingDrop', 'pricingCaret', 'pricingMenu');
  bindNavDrop('typingDrop', 'typingCaret', 'typingMenu');
  // Entrance animation (item 114, F10): non-home pages fade/slide
  // their <main> in once on load. Home is excluded (it has the hero
  // canvas + its own .reveal cards). Reduced-motion is handled by
  // the existing global rule (animation:none), not by JS.
  // T047 (P5-DES-23): the full .4s fade replayed on EVERY non-home
  // navigation, which felt slow/repetitive. The first page of the
  // session keeps the full fade; later pages get the .2s variant.
  try {
    var mn = document.querySelector('main');
    if (mn && !document.getElementById('hero-canvas')) {
      var entered = false;
      try { entered = sessionStorage.getItem('dokit_entered') === '1'; } catch (e) {}
      mn.classList.add(entered ? 'dk-enter-short' : 'dk-enter');
      try { sessionStorage.setItem('dokit_entered', '1'); } catch (e) {}
    }
  } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
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
    /* T084 (P5-VIS-09): the label span no longer carries data-i18n — the
     * engine rewrote this theme-managed label to rsv_1019 on every apply,
     * so in light mode it read "Switch to light mode" while the aria-label
     * said "Switch to dark mode". Re-apply on language change so the label
     * stays translated, and expose syncTheme for the engine-load callback
     * below (main.js runs before the dict arrives). */
    window.syncTheme = function () { apply(current()); };
    document.addEventListener('dokit:langchange', function () { apply(current()); });
    btn.addEventListener('click', function (e) {
      // Stop here so the profile menu's document-click closer does
      // not shut the menu the moment the theme is switched.
      if (e) { e.stopPropagation(); }
      var next = (current() === 'dark') ? 'light' : 'dark';
      try { localStorage.setItem('dokit_theme', next); } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
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
      navigator.serviceWorker.register(swUrl).catch(function (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); });
    } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
  })();
  // PWA install banner: shown once per browser until dismissed.
  (function installBanner(){
    var dismissed = false;
    try { dismissed = localStorage.getItem('dokit_pwa_dismissed') === '1'; } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
    var deferred = null, bar = null, barText = null, instBtn = null, disBtn = null;
    // QA8-BANNER: the bar text + buttons are set once when the
    // beforeinstallprompt event fires, before the locale dict is applied,
    // so they froze in English. Re-localise the live bar (if any) when the
    // locale is applied (boot, via window.syncInstallBanner — called by
    // loadSharedScripts once i18n.js loads) and on every language change.
    // Safe no-op when no bar exists yet — the bar is only created inside
    // the beforeinstallprompt handler, and creation-time dkT calls already
    // use the current locale. Behaviour (install / dismiss) is untouched;
    // only the text is re-localised.
    function syncInstall() {
      if (!bar) { return; }
      if (barText) { barText.textContent = dkT('rsv_1055', 'Install DoKit on your device for offline use.'); }
      if (instBtn) { instBtn.textContent = dkT('rsv_0980', 'Install'); }
      if (disBtn) { disBtn.textContent = dkT('saas.dismiss', 'Dismiss'); }
    }
    document.addEventListener('dokit:langchange', syncInstall);
    window.syncInstallBanner = syncInstall;
    if (dismissed) { return; }
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); deferred = e;
      if (document.getElementById('install-banner')) { return; }
      bar = document.createElement('div');
      bar.id = 'install-banner'; bar.className = 'install-banner';
      bar.innerHTML = '<span>' + dkT('rsv_1055', 'Install DoKit on your device for offline use.') + '</span>';
      barText = bar.querySelector('span');
      var inst = document.createElement('button'); inst.className = 'btn'; inst.textContent = dkT('rsv_0980', 'Install');
      instBtn = inst;
      inst.addEventListener('click', function () {
        if (deferred) { deferred.prompt(); deferred = null; }
        bar.remove();
      });
      var dis = document.createElement('button'); dis.className = 'btn ghost'; dis.textContent = dkT('saas.dismiss', 'Dismiss');
      disBtn = dis;
      dis.addEventListener('click', function () {
        try { localStorage.setItem('dokit_pwa_dismissed', '1'); } catch (err) { window.dkSwallow && window.dkSwallow(err, 'main.js'); }
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
    var bar = null, disBtn = null;
    // QA8-BANNER: the Dismiss button is set once at boot, before the locale
    // dict is applied, so it froze in English. Re-localise it when the
    // locale is applied (boot, via window.syncSiteBanner — called by
    // loadSharedScripts once i18n.js loads) and on every language change.
    // Safe no-op when no banner exists (no message set, or dismissed).
    // The message itself is admin-set (window.DOKIT_BANNER), not a
    // translation, so it is left untouched — only the button is re-localised.
    function syncSite() {
      if (disBtn) { disBtn.textContent = dkT('saas.dismiss', 'Dismiss'); }
    }
    document.addEventListener('dokit:langchange', syncSite);
    window.syncSiteBanner = syncSite;
    try {
      var msg = window.DOKIT_BANNER || '';
      if (!msg || sessionStorage.getItem('dokit_banner_dismissed') === '1') { return; }
      bar = document.createElement('div');
      bar.className = 'site-banner';
      bar.innerHTML = '<span></span>';
      bar.querySelector('span').textContent = msg;
      var dis = document.createElement('button'); dis.className = 'btn ghost'; dis.textContent = dkT('saas.dismiss', 'Dismiss');
      disBtn = dis;
      dis.addEventListener('click', function () {
        try { sessionStorage.setItem('dokit_banner_dismissed', '1'); } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
        bar.remove();
      });
      bar.appendChild(dis);
      var main = document.getElementById('main');
      if (main) { main.parentNode.insertBefore(bar, main); } else { document.body.appendChild(bar); }
    } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
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
    // QA8-DEMO: the empty render is re-localised by the engine itself
    // (#demoCounts carries data-i18n="rsv_0001"), so it never froze — but
    // once text is typed, count() writes computed counts and the engine's
    // apply() on a language switch resets the line to the static "0 ..."
    // template (apply runs before dokit:langchange is dispatched), leaving
    // stale counts until the next keystroke. Re-run count() when the locale
    // is applied (boot, via window.syncDemoCounts) and on every language
    // change (listener runs after apply, so the computed counts win).
    document.addEventListener('dokit:langchange', count);
    window.syncDemoCounts = count;
  })();
  // Favorites: star buttons injected into every tool card (device-local
  // list; the panel on the home page renders stored favorites only).
  (function favs(){
    function get() {
      try { return JSON.parse(localStorage.getItem('dokit_favs') || '[]'); } catch (e) { return []; }
    }
    function set(list) {
      try { localStorage.setItem('dokit_favs', JSON.stringify(list)); } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
    }
    // QA7-D1: one paint() per star, kept so a language change can
    // re-localise the star aria-labels (same boot freeze as the panel line).
    var paints = [];
    document.querySelectorAll('.tool-card').forEach(function (card) {
      var link = card.querySelector('a.cardlink'); if (!link) { return; }
      var star = document.createElement('button');
      star.className = 'fav-star'; star.type = 'button';
      star.setAttribute('data-fav', link.getAttribute('href'));
      star.setAttribute('aria-label', dkT('rsv_0976', 'Favorite this tool'));
      function paint() {
        var on = get().some(function (f) { return f.href === link.getAttribute('href'); });
        star.textContent = on ? '★' : '☆'; star.classList.toggle('on', on);
        // QA7-D1 (same widget): the aria-label is set once at boot and
        // freezes in English like the panel line did — refresh it here so
        // the langchange re-paint below re-localises it too.
        star.setAttribute('aria-label', dkT('rsv_0976', 'Favorite this tool'));
      }
      paints.push(paint);
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
    // QA7-D1: the empty-state line is set once at boot, before the locale
    // dict is applied, so it froze in English. Re-render when the locale
    // is applied (boot, via window.syncFavsPanel — called by
    // loadSharedScripts once i18n.js loads) and on every language change.
    // The star aria-labels freeze the same way (paint() also ran at boot),
    // so the sync re-paints them too — same widget, same freeze.
    function syncFavs() {
      paints.forEach(function (p) { p(); });
      renderPanel();
    }
    document.addEventListener('dokit:langchange', syncFavs);
    window.syncFavsPanel = syncFavs;
  })();
  // Guided tour: opened only by the Tour button, never automatically.
  (function tour(){
    var btn = document.getElementById('tour-btn'); if (!btn) { return; }
    // QA8-TOUR: the steps were built once at boot, before the locale dict
    // is applied, so they froze in English. buildSteps() rebuilds them from
    // the current locale; syncTour() rebuilds on locale application (boot,
    // via window.syncTourSteps — called by loadSharedScripts once i18n.js
    // loads) and on every language change, re-rendering the current step
    // if the tour is open (show() keeps the step index, so a mid-tour
    // switch stays on the same step). Buttons are created at open time and
    // were already fine — untouched.
    function buildSteps() {
      return [
        [dkT('rsv_1022', 'Welcome to DoKit'), dkT('rsv_1023', 'Every tool runs in your browser — no signup, no uploads, no watermark.')],
        [dkT('rsv_1026', 'Find a tool'), dkT('rsv_1027', 'Use the search box or browse the tool cards below.')],
        [dkT('rsv_1028', 'Typing school'), dkT('rsv_1029', 'Lessons, practice, games and Urdu typing live under Typing.')],
        [dkT('rsv_1024', 'Your data stays yours'), dkT('rsv_1025', 'Results and favorites save only on this device.')]
      ];
    }
    var steps = buildSteps();
    var i = 0, back = null, card = null, closeGen = 0;
    // F24 (rec 24): closeGen guards the delayed exit removal —
    // a fast re-open bumps it, so a pending timeout can never
    // remove the live tour. Without it, Tour -> Close -> Tour
    // within 180ms would delete the tour mid-show.
    function show() {
      if (!back) {
        back = document.createElement('div'); back.className = 'tour-backdrop';
        back.addEventListener('click', close);
        card = document.createElement('div'); card.className = 'tour-card';
        document.body.appendChild(back); document.body.appendChild(card);
      }
      back.classList.remove('closing'); card.classList.remove('closing'); closeGen++; // F24: cancel any pending exit removal
      back.classList.add('open');
      document.body.classList.add('dk-tour-open'); // T050: hide the sticky bar while the tour is open.
      card.innerHTML = '';
      // F36 (rec 36): the tour card is a dialog — label it with the
      // current step title so screen readers announce the step.
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-label', steps[i][0]);
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
      // UI-01: in-tour language switcher. The tour backdrop (z-index 95)
      // covers the header/footer selectors (header z-index 50), and a
      // real click on one closes the tour instead of switching — so the
      // switcher lives INSIDE the card (z-index 96), where it is always
      // reachable. A <select> needs no new menu/focus-trap code (native
      // keyboard support) and fits the 420px card at 390px viewports.
      // On change it calls the engine's setLang(); the existing
      // syncTour/dokit:langchange path re-renders the CURRENT step in the
      // new language (show() keeps the step index i). Focus after the
      // re-render lands on Next, per the existing F36 contract below.
      var langRow = document.createElement('p');
      langRow.className = 'tour-lang';
      var langLabel = document.createElement('label');
      langLabel.setAttribute('for', 'tour-lang');
      langLabel.textContent = dkT('lang_select_label', 'Language');
      var langSel = document.createElement('select');
      langSel.id = 'tour-lang';
      langSel.setAttribute('aria-label', dkT('lang_select_label', 'Language'));
      var tourLangs = [['en', 'English'], ['ur', 'اردو'], ['ar', 'العربية'], ['hi', 'हिन्दी'], ['es', 'Español'], ['fr', 'Français'], ['pt', 'Português'], ['de', 'Deutsch'], ['tr', 'Türkçe'], ['ru', 'Русский']];
      var curLang = 'en';
      try { var eng0 = window.DK_I18N || window.DKI18N; curLang = (eng0 && typeof eng0.getLang === 'function') ? eng0.getLang() : (document.documentElement.lang || 'en'); } catch (e) { curLang = document.documentElement.lang || 'en'; }
      tourLangs.forEach(function (L) {
        var opt = document.createElement('option'); opt.value = L[0]; opt.textContent = L[1];
        if (L[0] === curLang) { opt.selected = true; }
        langSel.appendChild(opt);
      });
      langSel.addEventListener('change', function () {
        try { var eng = window.DK_I18N || window.DKI18N; if (eng && typeof eng.setLang === 'function') { eng.setLang(langSel.value); } } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
      });
      langRow.appendChild(langLabel); langRow.appendChild(document.createTextNode(' ')); langRow.appendChild(langSel);
      card.appendChild(langRow);
      // F36: show() rebuilds the card's buttons every step, which
      // would drop keyboard focus to <body> — land it on Next/Done.
      try { next.focus(); } catch (e) { /* old browsers: focus stays put */ }
    }
    // F24 (rec 24): real exit animation, not an instant removal.
    // .closing fades the backdrop + scales the card out (180ms, Fast
    // token); the nodes leave the DOM only after it finishes. The
    // generation guard stops a stale timeout from removing a tour
    // that was re-opened in the meantime.
    function close() {
      // F36: focus returns to the Tour button the moment the tour
      // closes (Escape, backdrop, Done or Close) — the keyboard
      // user is never left on a removed node.
      try { btn.focus(); } catch (e) { /* old browsers: focus stays put */ }
      document.body.classList.remove('dk-tour-open');
      var b = back, c = card, gen = ++closeGen; i = 0;
      if (b) { b.classList.remove('open'); b.classList.add('closing'); }
      if (c) { c.classList.add('closing'); }
      setTimeout(function () {
        if (gen !== closeGen) { return; }
        if (b) { b.remove(); } if (c) { c.remove(); }
        if (back === b) { back = null; } if (card === c) { card = null; }
      }, 180);
    }
    btn.addEventListener('click', show);
    // QA8-TOUR (continued): rebuild the steps on language change; if the
    // tour is open, re-render the current step in the new language. If it
    // is closed, the next open reads the rebuilt steps. The .closing guard
    // keeps a language switch inside the 180ms exit animation from
    // resurrecting a tour that is already closing (close() removes the
    // nodes after the animation; show() would cancel that).
    function syncTour() {
      steps = buildSteps();
      if (card && !card.classList.contains('closing')) { show(); }
    }
    document.addEventListener('dokit:langchange', syncTour);
    window.syncTourSteps = syncTour;
    // F36: Escape closes the tour (the card previously had no
    // keyboard handling at all); close() returns focus to the button.
    // The card-null guard means this only fires while a tour is open.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && card) { close(); }
    });
  })();
  // Dismissible tip banner on the home page (dismissal remembered).
  (function tip(){
    var tip = document.getElementById('dk-hint'); if (!tip) { return; }
    try { if (localStorage.getItem('dokit_hint_dismissed') === '1') { tip.remove(); return; } } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
    var close = tip.querySelector('[data-hint-close]');
    if (close) {
      close.addEventListener('click', function () {
        try { localStorage.setItem('dokit_hint_dismissed', '1'); } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
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
      /* B83: the same filter drives the Guides grid — guide cards carry
       * the same data-cat values as tool cards (image/text/typing/
       * security/utility). No second handler: one filter, two grids.
       * The empty state shows only when the grid exists and nothing
       * in it matches (a category with zero guides). */
      var guideCards = document.querySelectorAll('.guides-grid .card');
      var visible = 0;
      guideCards.forEach(function (card) {
        var cats = (card.getAttribute('data-cat') || '').split(' ');
        var show = (!cat || cat === 'all' || cats.indexOf(cat) !== -1);
        card.style.display = show ? '' : 'none';
        if (show) { visible++; }
      });
      var empty = document.getElementById('guides-empty');
      if (empty) { empty.hidden = guideCards.length === 0 || visible !== 0; }
    }
    document.querySelectorAll('[data-filter]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('[data-filter]').forEach(function (c) { c.classList.remove('active'); c.setAttribute('aria-pressed', 'false'); });
        chip.classList.add('active');
        /* B83: pressed state for screen readers (also applied to the
         * /tools/ chips — same handler, same behaviour). */
        chip.setAttribute('aria-pressed', 'true');
        applyFilter(chip.getAttribute('data-filter'));
      });
    });
    /* B83: initial pressed state — "All" is the default view. */
    document.querySelectorAll('[data-filter]').forEach(function (chip) {
      chip.setAttribute('aria-pressed', chip.getAttribute('data-filter') === 'all' ? 'true' : 'false');
    });
    document.querySelectorAll('[data-finder]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var q = chip.getAttribute('data-finder') || '';
        if (search) { search.value = q; search.dispatchEvent(new Event('input', { bubbles: true })); }
      });
    });
  })();
  // B95: FAQ live search — filters the 10 native <details> by question +
  // answer text (textContent matching only; the query is never rendered
  // as HTML). Clearing restores all 10. Enter opens the first visible
  // match. The <details> open/close behaviour itself is untouched (native).
  (function faqSearch(){
    var input = document.getElementById('faq-search');
    if (!input) { return; }
    var items = Array.prototype.slice.call(document.querySelectorAll('.faq details'));
    var empty = document.getElementById('faq-empty');
    if (!items.length) { return; }
    function apply(q) {
      q = (q || '').trim().toLowerCase();
      var visible = 0;
      items.forEach(function (d) {
        var show = !q || d.textContent.toLowerCase().indexOf(q) !== -1;
        d.style.display = show ? '' : 'none';
        if (show) { visible++; }
      });
      if (empty) { empty.hidden = visible !== 0; }
      return visible;
    }
    input.addEventListener('input', function () { apply(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') { return; }
      e.preventDefault();
      apply(input.value);
      var first = items.filter(function (d) { return d.style.display !== 'none'; })[0];
      if (first) {
        first.open = true;
        var sum = first.querySelector('summary');
        if (sum) { sum.focus(); }
      }
    });
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
      try { lang = localStorage.getItem('dokit_lang') || 'en'; } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
      if (lang === 'en') {
        if (h1.innerHTML !== orig) { h1.innerHTML = orig; }
        return;
      }
      var text = null;
      try {
        if (window.DK_I18N && typeof window.DK_I18N.t === 'function') {
          text = window.DK_I18N.t('tools.h1');
        }
      } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
      if (!text || text === 'tools.h1') {
        try {
          var dict = window.DK_I18N_DICT || {};
          text = (dict[lang] && dict[lang]['tools.h1']) || (dict.en && dict.en['tools.h1']);
        } catch (e2) { window.dkSwallow && window.dkSwallow(e2, 'main.js'); }
      }
      if (text) { h1.innerHTML = '<span class="grad">' + esc(text) + '</span>'; }
    }
    document.addEventListener('dokit:langchange', sync);
    // The loader above calls this once i18n.js arrives (async).
    window.syncHeroH1 = sync;
    sync();
  })();
  // Notify-me forms (coming-soon, TypeFight hub, API docs) + the guides
  // newsletter strip: Q1 (Phase D) decided the destination — notify-me
  // forms write to the `notify` collection, the guides strip to
  // `newsletter` (data-collection). Both live rules (df3ef92c) allow a
  // public create with EXACTLY {email, createdAt} (email 4-120 chars),
  // so the topic is deliberately NOT stored and no rules change was
  // needed. Success is shown ONLY on a confirmed write (never on
  // failure — the old dead code confirmed falsely); on failure the form
  // stays usable and shows the error note with the contact mailto.
  document.querySelectorAll('.notify-form').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var emailEl = f.querySelector('input[type="email"]');
      var addr = emailEl ? emailEl.value.trim() : '';
      var sent = f.querySelector('.notify-sent');
      var err = f.querySelector('.notify-error');
      var btn = f.querySelector('button[type="submit"]');
      if (err) { err.hidden = true; }
      // WHY (rules): email must be 4-120 chars; the browser's own
      // type=email check already ran (required + type=email) — this
      // guards the rules' length bound before any write is attempted.
      if (addr.length < 4 || addr.length > 120 || addr.indexOf('@') < 1) {
        // F39: the format error now lands on the email field itself
        // (focus + aria-invalid). The message element keeps its own
        // static text (with the contact mailto), so no message is
        // passed — dkFailField only links and focuses it.
        if (err) { err.hidden = false; }
        if (window.dkFailField && emailEl) { window.dkFailField(emailEl, err, null); }
        return;
      }
      var db = null;
      try { db = (window.DKA && window.DKA.db) ? window.DKA.db() : null; } catch (e2) { window.dkSwallow && window.dkSwallow(e2, 'main.js'); }
      if (!db || !window.firebase || !firebase.firestore) {
        if (err) { err.hidden = false; }
        return;
      }
      // WHY (rules): only these two collections allow a public create
      // with this shape; the attribute is allow-listed, never trusted.
      var col = f.getAttribute('data-collection') || 'notify';
      if (col !== 'notify' && col !== 'newsletter') { col = 'notify'; }
      if (btn) { btn.disabled = true; }
      db.collection(col).add({
        email: addr,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(function () {
        if (sent) { sent.hidden = false; }
        if (emailEl) { emailEl.disabled = true; }
      }, function (e3) {
        window.dkSwallow && window.dkSwallow(e3, 'main.js');
        if (err) { err.hidden = false; }
        if (btn) { btn.disabled = false; }
      });
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
    try { if (localStorage.getItem('dk_steps_seen')) { box.hidden = true; return; } } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
    if (x) { x.addEventListener('click', function () { box.hidden = true; try { localStorage.setItem('dk_steps_seen', '1'); } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); } }); }
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
    /* DES-01: sample-image gradient — JS-side constants mirroring the
     * brand tokens (canvas cannot use CSS var()): violet mirrors
     * --violet (#6C4CF1), orange is the gradient accent (#FF8A5C).
     * Values unchanged. */
    var GRAD_VIOLET = '#6C4CF1';
    var GRAD_ORANGE = '#FF8A5C';
    var c = document.createElement('canvas'); c.width = 800; c.height = 600;
    var x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 800, 600);
    g.addColorStop(0, GRAD_VIOLET); g.addColorStop(1, GRAD_ORANGE);
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
        } catch (err) { /* older browsers */ window.dkSwallow && window.dkSwallow(err, 'main.js'); }
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
  } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
})();

/* Home sticky CTA pill (P5-VIS-02).
 * The pill (#stickyCta, home page only) used to be an unconditional sticky
 * bar that covered page text at every scroll position on every viewport.
 * It is now mobile-only (<=768px), appears only after 600px of scroll, and
 * can be dismissed for the rest of the session. Mirrors the (never-loaded)
 * home.js gate; body.has-sticky-cta reserves bottom padding (style.css)
 * so the shown bar never covers page content. No-ops on every other page. */
(function initStickyCta() {
  var bar = document.getElementById('stickyCta');
  if (!bar) { return; }
  var KEY = 'dokit_sticky_cta_dismissed';
  var dismissed = false;
  try { dismissed = window.sessionStorage.getItem(KEY) === '1'; } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
  var mq = window.matchMedia ? window.matchMedia('(max-width: 768px)') : null;
  function upd() {
    var show = !dismissed && (window.scrollY || window.pageYOffset) > 600 && (!mq || mq.matches);
    bar.classList.toggle('on', show);
    /* Next frame: animate in. */
    requestAnimationFrame(function () { bar.classList.toggle('show', show); });
    document.body.classList.toggle('has-sticky-cta', show);
    bar.hidden = !show;
  }
  var closeBtn = bar.querySelector('.sticky-cta__close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      dismissed = true;
      try { window.sessionStorage.setItem(KEY, '1'); } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
      upd();
    });
  }
  var tick = false;
  window.addEventListener('scroll', function () {
    if (tick) { return; } tick = true;
    requestAnimationFrame(function () { tick = false; upd(); });
  }, { passive: true });
  window.addEventListener('resize', upd);
  if (mq && mq.addEventListener) { mq.addEventListener('change', upd); }
  upd();
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
      try { src = (document.currentScript && document.currentScript.src) || ''; } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
      var marker = 'assets/js/main.js';
      var at = src ? src.indexOf(marker) : -1;
      if (at < 0) { return; }
      window.__dkaLoaded = true;
      var s = document.createElement('script');
      s.src = src.slice(0, at) + 'assets/js/account.js';
      s.defer = true;
      document.head.appendChild(s);
    } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
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
    try { src = (document.currentScript && document.currentScript.src) || ''; } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
    var marker = 'assets/js/main.js';
    var at = src ? src.indexOf(marker) : -1;
    if (at < 0) { return; }
    var s = document.createElement('script');
    s.src = src.slice(0, at) + 'assets/js/referrals.js';
    s.defer = true;
    document.head.appendChild(s);
  } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
})();

/* PAYLOAD-OPT (Phase D): referrals.js is 264 KB and 237 KB of it is
 * unused on the homepage — only renderHomepageShoutout /
 * renderHomepageFeatured run there — yet both homepage loaders injected
 * it eagerly at page load. This ONE shared helper schedules the single
 * injection for idle time instead: the script still always loads
 * (requestIdleCallback with a 3s timeout, else a 1s timer), just after
 * the critical path, and every registered onload callback still runs.
 * One scheduled flag + one callback list, so two loaders can never
 * inject twice. The wallet loader is untouched: the wallet page needs
 * DKREF immediately for its claim button, so it keeps its eager load.
 * The src is resolved at schedule time (document.currentScript is only
 * valid while main.js itself is executing). */
var __dkRefCallbacks = null;
function dkLoadReferralsIdle(onload) {
  if (window.DKREF) { try { if (onload) { onload(); } } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); } return; }
  if (onload) {
    if (__dkRefCallbacks) { __dkRefCallbacks.push(onload); return; }
    __dkRefCallbacks = [onload];
  } else if (!__dkRefCallbacks) { __dkRefCallbacks = []; }
  if (window.__dkRefScheduled) { return; }
  window.__dkRefScheduled = true;
  var base = '';
  try {
    var cur = (document.currentScript && document.currentScript.src) || '';
    var marker = 'assets/js/main.js';
    var at = cur ? cur.indexOf(marker) : -1;
    if (at >= 0) { base = cur.slice(0, at); }
  } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
  function fire() {
    var cbs = __dkRefCallbacks || []; __dkRefCallbacks = null;
    cbs.forEach(function (cb) { try { cb(); } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); } });
  }
  function inject() {
    try {
      if (window.DKREF) { fire(); return; }
      var existing = document.querySelector('script[src$="assets/js/referrals.js"]');
      if (existing) { existing.addEventListener('load', fire); return; }
      if (!base) { return; }
      var sc = document.createElement('script');
      sc.src = base + 'assets/js/referrals.js';
      sc.defer = true;
      sc.onload = fire;
      document.head.appendChild(sc);
    } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
  }
  if (window.requestIdleCallback) { window.requestIdleCallback(inject, { timeout: 3000 }); }
  else { setTimeout(inject, 1000); }
}

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
    dkLoadReferralsIdle(function () {
      try { if (window.DKREF && window.DKREF.renderHomepageShoutout) { window.DKREF.renderHomepageShoutout(); } } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
    });
  } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
})();


/* Homepage featured slot (item #35): mirrors the #55 shoutout loader
 * (same homepage-only path check, same render-on-load) — with one
 * ordering rule: the featured slot goes AFTER the shoutout section
 * when it exists, else right after the hero, so #55 is never
 * displaced. No generator or homepage-HTML edit, so the frozen hero
 * is untouched.
 * FIX4 (Oct 27): the slot is created BEFORE the DKREF/script guards.
 * Previously the guards ran first, and because loadHomepageShoutout
 * (just above in this file) had already injected the referrals.js
 * script tag, this loader hit the script-exists guard and returned
 * without creating #home-featured and without hooking render to the
 * script load — while the shoutout onload renders only the shoutout.
 * So renderHomepageFeatured was never invoked on the homepage (and
 * would have no-op'd on the missing container anyway). */
(function loadHomepageFeatured(){
  try {
    var p = location.pathname || '';
    if (p.charAt(p.length - 1) !== '/') { return; }
    var root = p.replace(/\/+$/, '');
    if (root !== '' && root !== '/DoKit') { return; }
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
    dkLoadReferralsIdle(function () {
      try { if (window.DKREF && window.DKREF.renderHomepageFeatured) { window.DKREF.renderHomepageFeatured(); } } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
    });
  } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
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
      } catch (e2) { window.dkSwallow && window.dkSwallow(e2, 'main.js'); }
      QUEUE.push(e);
      if (QUEUE.length >= MAX_BATCH) { flush(); }
    } catch (e3) { window.dkSwallow && window.dkSwallow(e3, 'main.js'); }
  }
  function flush() {
    if (flushing || !QUEUE.length) { return; }
    var db = null;
    try { db = (window.DKA && window.DKA.db) ? window.DKA.db() : null; } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
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
          } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
        }, { passive: true });
      }
    } catch (e) { window.dkSwallow && window.dkSwallow(e, 'main.js'); }
  }
  window.DKAnalytics = {
    track: function (type, extra) { enqueue(String(type).slice(0, 30), extra || {}); },
    toolUsed: function (tool, action) { enqueue('tool_used', { tool: tool, action: action }); },
    flush: flush
  };
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();

/* B66 — Drag-and-drop upload: ONE shared dropzone implementation.
 * Inspection verdict (why this is the consolidation, not a third copy):
 * the four unloaded bundles (tools/image-{resizer,compressor,converter}/
 * tool.js + tools/board-photo/tool.js) are four DIVERGENT full-tool
 * rewrites, not copies of a dropzone — each ~46-75 KB, each expecting a
 * DKUI.renderNav/renderFooter shell the routed pages do not use, its own
 * embedded i18n dict, and DOM ids the routed pages do not have. Wiring
 * any one of them in would replace the routed tool logic wholesale.
 * So per the owner decision (REUSE FIRST, consolidate if the copies
 * cannot both be wired cleanly): this single handler in main.js — the
 * one script every page already loads — wires any #dz on the page (the
 * four image-tool pages only). Drop/paste feed the SAME file input the
 * browse path uses (DataTransfer + change event), so the existing
 * per-tool handlers run exactly as browse-upload does: same validation,
 * same results, same errors. Nothing is ever uploaded — processing stays
 * on-device (B69). A dropped URL/text is never fetched (no SSRF /
 * open-fetch hole): only File objects from the drop/paste are taken.
 * The unloaded bundles are left untouched as dead code (deleting four
 * full alternate tool implementations is an owner call, not this idea);
 * exactly ONE dropzone implementation exists in the loaded scripts. */
(function () {
  var dz = document.getElementById('dz');
  if (!dz) { return; }
  var input = dz.querySelector('input[type=file]');
  if (!input) { return; }
  var multi = !!input.multiple;
  /* One error line under the dropzone, reused for every rejected file. */
  var errEl = document.createElement('p');
  errEl.className = 'err'; errEl.id = 'dz-err'; errEl.setAttribute('aria-live', 'polite');
  dz.parentNode.insertBefore(errEl, dz.nextSibling);
  function showErr(msg) { errEl.textContent = msg; }
  function clearErr() { errEl.textContent = ''; }
  function t(key, fallback) { return (window.dkT ? window.dkT(key, fallback) : fallback); }
  /* Validate against the input's own accept list + the 25 MB cap the
   * browse path enforces (loadImage in tools.js, validFile in the dead
   * board-photo bundle). A file failing either check shows the SAME
   * message the browse path shows for it. */
  function acceptOk(file) {
    var acc = (input.getAttribute('accept') || '').toLowerCase();
    if (!acc) { return true; }
    var type = (file.type || '').toLowerCase();
    var parts = acc.split(',');
    for (var i = 0; i < parts.length; i++) {
      var a = parts[i].trim();
      if (a === 'image/*' && type.indexOf('image/') === 0) { return true; }
      if (a && a === type) { return true; }
      if (a.charAt(0) === '.' && file.name.toLowerCase().slice(-a.length) === a) { return true; }
    }
    return false;
  }
  function feedFiles(list) {
    var files = Array.prototype.slice.call(list || []);
    if (!files.length) { return; }
    clearErr();
    var good = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (!acceptOk(f)) { showErr(t('rsv_1009', 'This image could not be read. Please choose a PNG, JPG or WebP file.')); return; }
      if (f.size > 25 * 1024 * 1024) { showErr(t('rsv_0977', 'File is larger than 25 MB. Please choose a smaller file.')); return; }
      good.push(f);
    }
    if (!good.length) { return; }
    if (!multi) { good = good.slice(0, 1); }
    /* Feed the real input so the existing change handler runs — the
     * drop path is then identical to browse-upload by construction. */
    var dt = new DataTransfer();
    good.forEach(function (f) { dt.items.add(f); });
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  /* Click anywhere on the zone (except the input/label themselves,
   * whose native behaviour already opens the file dialog) browses. */
  dz.addEventListener('click', function (e) {
    if (e.target === input || (e.target && e.target.tagName === 'LABEL')) { return; }
    input.click();
  });
  dz.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  ['dragover', 'dragenter'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('dragover'); });
  });
  dz.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files) { feedFiles(e.dataTransfer.files); }
  });
  /* Paste is document-level: a paste lands on the focused element, not
   * necessarily on #dz. Skipped inside text fields so typing/pasting
   * text is never hijacked; only clipboard FILES are taken. */
  document.addEventListener('paste', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) { return; }
    var cd = e.clipboardData;
    if (cd && cd.files && cd.files.length) { feedFiles(cd.files); }
  });
  /* An unhandled drop anywhere on the page would navigate the browser
   * away from the tool (dropping a file on a bare page loads it).
   * Block that for the whole document; #dz still handles its own drops. */
  document.addEventListener('dragover', function (e) { e.preventDefault(); });
  document.addEventListener('drop', function (e) { e.preventDefault(); });
})();
