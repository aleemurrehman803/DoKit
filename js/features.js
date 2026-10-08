/* DoKit — frontend features.
 *
 * A) WhatsApp share FAB (tool pages only)
 * B) Newsletter signup row in the footer (-> Firestore `newsletter`)
 * C) Feedback FAB + accessible modal (-> Firestore `feedback`)
 * D) Keyboard shortcuts (/, t, ?) + footer hint button + help modal
 * E) Recent tools (localStorage, homepage chips)
 * F) Favorites (hearts on tool cards + "My favorites" filter chip)
 * G) Tutorial video section on tool pages (click-to-load, privacy-enhanced)
 * H) Page-view analytics (-> Firestore `analytics`, throttled, no PII)
 *
 * Vanilla JS, IIFE, "use strict". CSP-safe (no inline handlers, no eval).
 * XSS-safe: user-controlled strings are inserted via textContent only.
 * Every feature is defensive: it bails silently when its targets are missing.
 * Exposes window.DKFeatures.setTutorial(slug, id) and window.DK_TUTORIALS.
 */
(function () {
  document.addEventListener("dokit:langchange", function() {
    try { if (window.DKI18N && window.DKI18N.apply) window.DKI18N.apply(); } catch (e) {}
  });
  function T(k, fb) {
    try {
      if (window.DKI18N && window.DKI18N.t) {
        var v = window.DKI18N.t(k);
        if (v && v !== k) return v;
      }
    } catch (e) {}
    return fb;
  }
  "use strict";

  if (window.__dkFeaturesLoaded) return;
  window.__dkFeaturesLoaded = true;

  /* ---------------- utilities ---------------- */

  var U = (typeof window.DKU === "function") ? window.DKU : function (p) { return p; };

  function $(sel, root) {
    try { return (root || document).querySelector(sel); } catch (e) { return null; }
  }
  function $all(sel, root) {
    try { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    catch (e) { return []; }
  }

  var PATH = "";
  try { PATH = String(location.pathname || ""); } catch (e) { PATH = ""; }

  // /tools/<slug>/  (not the /tools/ listing, not /tools/index.html).
  // NOTE: the listing check runs on the RAW segment — slug sanitization
  // strips the dot, so "index.html" must be compared before sanitizing.
  var _m = PATH.match(/\/tools\/([^\/?#]+)\/?$/);
  var _rawSeg = _m ? String(_m[1]) : null;
  var IS_TOOLS_LISTING = !!_rawSeg && (/^index\.html$/i.test(_rawSeg) || /^tools$/i.test(_rawSeg));
  var SLUG = (!_m || IS_TOOLS_LISTING) ? null
    : String(_m[1]).replace(/[^a-z0-9-]/gi, "").toLowerCase();
  var IS_TOOL_PAGE = !!SLUG && !IS_TOOLS_LISTING;

  // True homepage only: the site root (window.DK_BASE-aware) or its
  // index.html. Section pages like /typing/ must NOT match.
  var IS_HOME = (function () {
    try {
      var bp = "/";
      if (typeof window.DK_BASE === "string" && window.DK_BASE) {
        try { bp = new URL(window.DK_BASE, location.href).pathname; }
        catch (e) { bp = "/"; }
      }
      if (bp.charAt(bp.length - 1) !== "/") bp += "/";
      return PATH === bp || PATH === bp.slice(0, -1) || PATH === bp + "index.html";
    } catch (e) { return false; }
  })();

  function lsGet(key, fb) {
    try { var v = window.localStorage.getItem(key); return v == null ? fb : v; }
    catch (e) { return fb; }
  }
  function lsSet(key, val) {
    try { window.localStorage.setItem(key, val); } catch (e) { /* private mode etc. */ }
  }
  function lsGetJson(key, fb) {
    try {
      var v = JSON.parse(window.localStorage.getItem(key));
      return v == null ? fb : v;
    } catch (e) { return fb; }
  }
  function ssGet(key) {
    try { return window.sessionStorage.getItem(key); } catch (e) { return null; }
  }
  function ssSet(key, val) {
    try { window.sessionStorage.setItem(key, val); } catch (e) { /* ignore */ }
  }

  function getDb() {
    try {
      return (window.DKF && typeof window.DKF.db === "function") ? window.DKF.db() : null;
    } catch (e) { return null; }
  }
  // Run fn(db) once Firebase is ready; give up quietly after ~6s.
  function withDb(fn, attemptsLeft) {
    if (attemptsLeft == null) attemptsLeft = 12;
    var db = getDb();
    if (db) { try { fn(db); } catch (e) { /* feature-level */ } return; }
    if (attemptsLeft > 0) {
      setTimeout(function () { withDb(fn, attemptsLeft - 1); }, 500);
    }
  }
  function serverTimestamp() {
    try {
      if (window.firebase && window.firebase.firestore &&
          window.firebase.firestore.FieldValue &&
          typeof window.firebase.firestore.FieldValue.serverTimestamp === "function") {
        return window.firebase.firestore.FieldValue.serverTimestamp();
      }
    } catch (e) { /* fall through */ }
    return null;
  }
  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  /* ---------------- shared modal ---------------- */

  var activeModal = null;

  function closeModal() {
    if (!activeModal) return;
    try {
      var back = activeModal.back;
      if (back && back.parentNode) back.parentNode.removeChild(back);
      document.removeEventListener("keydown", activeModal.onKey, true);
      var lf = activeModal.lastFocus;
      if (lf && typeof lf.focus === "function") { try { lf.focus(); } catch (e) {} }
    } catch (e) { /* ignore */ }
    activeModal = null;
  }

  // opts: { label, build(dialogEl, closeFn) }
  function openModal(opts) {
    closeModal();
    var back, dlg;
    try {
      back = document.createElement("div");
      back.className = "dkf-modal-backdrop";
      dlg = document.createElement("div");
      dlg.className = "dkf-modal";
      dlg.setAttribute("role", "dialog");
      dlg.setAttribute("aria-modal", "true");
      if (opts && opts.label) dlg.setAttribute("aria-label", opts.label);
      back.appendChild(dlg);
    } catch (e) { return; }

    var lastFocus = null;
    try { lastFocus = document.activeElement; } catch (e) { lastFocus = null; }

    function onKey(e) {
      if (e && e.key === "Escape") {
        try { e.stopPropagation(); } catch (err) {}
        closeModal();
      }
    }
    activeModal = { back: back, onKey: onKey, lastFocus: lastFocus };
    back.addEventListener("click", function (e) { if (e.target === back) closeModal(); });
    document.addEventListener("keydown", onKey, true);
    try {
      (document.body || document.documentElement).appendChild(back);
    } catch (e) { activeModal = null; return; }
    try {
      if (opts && typeof opts.build === "function") opts.build(dlg, closeModal);
    } catch (e) { closeModal(); return; }
    var f = dlg.querySelector("button, textarea, input, select, [tabindex]");
    if (f) { try { f.focus(); } catch (e) {} }
  }

  function modalTitle(dlg, text) {
    var h = document.createElement("h3");
    h.className = "dkf-modal__title";
    h.textContent = text;
    dlg.appendChild(h);
    return h;
  }
  function modalActions(dlg, buttons) {
    var row = document.createElement("div");
    row.className = "dkf-modal__actions";
    buttons.forEach(function (b) { row.appendChild(b); });
    dlg.appendChild(row);
    return row;
  }
  function mkButton(text, cls, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.textContent = text;
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }

  /* ---------------- A) WhatsApp share FAB (tool pages only) ---------------- */

  var WA_SVG = '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
    '<path d="M16 3C9.4 3 4 8.4 4 15c0 2.4.7 4.6 2 6.5L4 29l7.7-2c1.8 1 3.9 1.6 6 1.6h.3c6.6 0 12-5.4 12-12S22.6 3 16 3zm0 21.8c-1.8 0-3.6-.5-5.1-1.4l-.4-.2-4.5 1.2 1.2-4.4-.3-.4c-1-1.6-1.6-3.5-1.6-5.6C5.4 9.2 10.2 4.4 16 4.4S26.6 9.2 26.6 15 21.8 24.8 16 24.8zm5.5-7.4c-.3-.2-1.8-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5L14.4 9c-.1-.3-.4-.3-.6-.3h-.5c-.2 0-.5.2-.7.4-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.9 2.9 4.5 4 .6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.4z"/>' +
    "</svg>";

  function initWhatsApp() {
    if (!IS_TOOL_PAGE) return;
    if (!$("body") || $(".dkf-fab--wa")) return;
    var a = document.createElement("a");
    a.className = "dkf-fab dkf-fab--wa";
    try {
      a.href = "https://wa.me/?text=" + encodeURIComponent(document.title + " " + location.href);
    } catch (e) { return; }
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("aria-label", "Share on WhatsApp");
    a.title = "Share on WhatsApp";
    a.innerHTML = WA_SVG; // static markup — no user data
    document.body.appendChild(a);
    document.body.classList.add("dkf-has-wa");
  }

  /* ---------------- C) Feedback FAB + modal ---------------- */

  function openFeedbackModal() {
    var rating = 0;
    openModal({
      label: T("fb_send", "Send feedback"),
      build: function (dlg, close) {
        modalTitle(dlg, "💬 " + T("fb_title", "Feedback"));

        var starsWrap = document.createElement("div");
        starsWrap.className = "dkf-stars";
        starsWrap.setAttribute("role", "radiogroup");
        starsWrap.setAttribute("aria-label", T("fb_rating", "Rating"));
        var stars = [];
        for (var i = 1; i <= 5; i++) {
          (function (v) {
            var s = document.createElement("button");
            s.type = "button";
            s.className = "dkf-star";
            s.textContent = "★";
            s.setAttribute("role", "radio");
            s.setAttribute("aria-checked", "false");
            s.setAttribute("aria-label", v + " " + T("fb_star", "star"));
            s.addEventListener("click", function () {
              rating = v;
              stars.forEach(function (x, idx) {
                var on = idx < v;
                x.classList.toggle("dkf-star--on", on);
                x.setAttribute("aria-checked", on ? "true" : "false");
              });
            });
            stars.push(s);
            starsWrap.appendChild(s);
          })(i);
        }
        dlg.appendChild(starsWrap);

        var ta = document.createElement("textarea");
        ta.className = "dkf-textarea";
        ta.rows = 4;
        ta.maxLength = 500;
        ta.placeholder = T("fb_placeholder", "Tell us what you think (optional)…");
        ta.setAttribute("aria-label", T("fb_comment", "Your comment"));
        dlg.appendChild(ta);

        var submitted = false;
        function showThanks() {
          if (submitted) return;
          submitted = true;
          while (dlg.firstChild) { try { dlg.removeChild(dlg.firstChild); } catch (e) { break; } }
          var p = document.createElement("p");
          p.className = "dkf-modal__thanks";
          p.textContent = "🙏 Shukriya!";
          dlg.appendChild(p);
          setTimeout(close, 1800);
        }

        var cancel = mkButton(T("fb_cancel", "Cancel"), "dkf-btn dkf-btn--ghost", close);
        var submit = mkButton(T("fb_submit", "Submit"), "dkf-btn dkf-btn--primary", function () {
          var comment = String(ta.value || "").slice(0, 500);
          submit.disabled = true;
          submit.textContent = "Sending…";
          withDb(function (db) {
            try {
              db.collection("feedback").add({
                rating: rating,
                comment: comment,
                page: PATH,
                createdAt: serverTimestamp()
              }).then(showThanks, showThanks);
            } catch (e) { showThanks(); }
          });
          // Fallback: never leave the user stuck on "Sending…" if the
          // Firestore write hangs or Firebase never loads.
          setTimeout(function () { if (!submitted) showThanks(); }, 7000);
        });
        modalActions(dlg, [cancel, submit]);
      }
    });
  }

  function initFeedback() {
    if (!$("body") || $(".dkf-fab--fb")) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "dkf-fab dkf-fab--fb";
    b.textContent = "💬";
    b.setAttribute("aria-label", T("fb_send", "Send feedback"));
    b.title = T("fb_send", "Send feedback");
    b.addEventListener("click", openFeedbackModal);
    document.body.appendChild(b);
  }

  /* ---------------- B) Newsletter row + D) shortcuts hint (footer extras) ---------------- */

  var NEWS_KEY = "dokit_news_sub";
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function footerBottom() {
    return $(".footer-bottom") || $("#dk-footer") || $("#site-foot");
  }

  function ensureNewsletter() {
    var host = footerBottom();
    if (!host || !host.isConnected) return false;
    // Re-apply translations after newsletter creation (in case DKI18N loaded after)
    setTimeout(function() {
      try { if (window.DKI18N && window.DKI18N.apply) window.DKI18N.apply(); } catch (e) {}
    }, 100);
    if (host.querySelector(".dkf-news")) return true;

    var wrap = document.createElement("div");
    wrap.className = "dkf-news";

    var label = document.createElement("span");
    label.className = "dkf-news__label";
    label.setAttribute("data-i18n", "news_title");
    label.textContent = T("news_title", "📧 Get new tools first");
    wrap.appendChild(label);

    if (lsGet(NEWS_KEY, null)) {
      var done0 = document.createElement("span");
      done0.className = "dkf-news__done";
      done0.textContent = T("news_subscribed", "✅ Subscribed!");
      wrap.appendChild(done0);
    } else {
      var form = document.createElement("form");
      form.className = "dkf-news__form";
      form.setAttribute("novalidate", "novalidate");

      var input = document.createElement("input");
      input.type = "email";
      input.className = "dkf-input dkf-news__input";
      input.placeholder = "you@example.com";
      input.setAttribute("aria-label", T("news_email_ph", "Email address"));
      input.setAttribute("data-i18n-aria", "news_email_ph");
      input.maxLength = 254;
      input.autocomplete = "email";

      var btn = mkButton(T("news_subscribe", "Subscribe"), "dkf-btn dkf-btn--primary dkf-btn--sm", null);
      btn.setAttribute("data-i18n", "news_subscribe");
      btn.type = "submit";

      var msg = document.createElement("span");
      msg.className = "dkf-news__msg";
      msg.setAttribute("role", "status");

      var finished = false;
      function done() {
        if (finished) return;
        finished = true;
        lsSet(NEWS_KEY, "1");
        var f = wrap.querySelector(".dkf-news__form");
        if (f && f.parentNode) { try { f.parentNode.removeChild(f); } catch (e) {} }
        msg.textContent = "";
        var ok = document.createElement("span");
        ok.className = "dkf-news__done";
        ok.textContent = T("news_subscribed", "✅ Subscribed!");
        wrap.appendChild(ok);
      }

      form.appendChild(input);
      form.appendChild(btn);
      wrap.appendChild(form);
      wrap.appendChild(msg);

      form.addEventListener("submit", function (e) {
        try { e.preventDefault(); } catch (err) {}
        var email = String(input.value || "").trim().slice(0, 254);
        if (!EMAIL_RE.test(email)) {
          msg.textContent = "Please enter a valid email address.";
          try { input.focus(); } catch (err) {}
          return;
        }
        btn.disabled = true;
        btn.textContent = "…";
        withDb(function (db) {
          try {
            db.collection("newsletter").add({
              email: email,
              page: PATH,
              createdAt: serverTimestamp()
            }).then(done, done);
          } catch (err) { done(); }
        });
        // Fallback: don't trap the user if Firebase never resolves.
        setTimeout(function () { if (!finished) done(); }, 7000);
      });
    }

    try { host.appendChild(wrap); } catch (e) { return false; }
    return true;
  }

  function ensureKbdHint() {
    var host = $(".footer-bottom");
    if (!host || !host.isConnected) return false;
    if (host.querySelector(".dkf-kbd-hint")) return true;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "dkf-kbd-hint";
    b.textContent = "⌨️";
    b.setAttribute("aria-label", T("kb_title", "Keyboard shortcuts"));
    b.title = T("kb_title", "Keyboard shortcuts") + " (?)";
    b.addEventListener("click", openShortcutsModal);
    try { host.appendChild(b); } catch (e) { return false; }
    return true;
  }

  function watchFooterExtras() {
    function ensure() {
      var n = ensureNewsletter();
      var k = ensureKbdHint();
      return n || k;
    }
    if (!ensure()) {
      // Footer not rendered yet (deferred page scripts) — poll briefly.
      var tries = 0;
      var t = setInterval(function () {
        tries++;
        if (ensure() || tries >= 20) clearInterval(t);
      }, 500);
    }
    // Re-inject after footer re-renders (e.g. language switch re-renders it).
    try {
      var mo = new MutationObserver(function () {
        var fb = $(".footer-bottom");
        if (fb && !fb.querySelector(".dkf-news")) ensureNewsletter();
        if (fb && !fb.querySelector(".dkf-kbd-hint")) ensureKbdHint();
      });
      var root = document.documentElement || document.body;
      if (root) mo.observe(root, { childList: true, subtree: true });
    } catch (e) { /* MutationObserver unavailable — extras stay as-is */ }
  }

  /* ---------------- D) Keyboard shortcuts ---------------- */

  var SHORTCUTS = [
    { key: "Ctrl+K", descKey: "kb_palette", fb: "Command palette: jump to any tool" },
    { key: "/", descKey: "kb_search", fb: "Focus the site search" },
    { key: "t", descKey: "kb_alltools", fb: "Go to All Tools" },
    { key: "?", descKey: "kb_help", fb: "Show this shortcuts help" },
    { key: "Esc", descKey: "kb_close", fb: "Close dialogs" }
  ];

  function openShortcutsModal() {
    openModal({
      label: T("kb_title", "Keyboard shortcuts"),
      build: function (dlg, close) {
        modalTitle(dlg, "⌨️ " + T("kb_title", "Keyboard shortcuts"));
        var ul = document.createElement("ul");
        ul.className = "dkf-shortcut-list";
        SHORTCUTS.forEach(function (s) {
          var li = document.createElement("li");
          li.className = "dkf-shortcut-row";
          var k = document.createElement("kbd");
          k.textContent = s.key;
          var d = document.createElement("span");
          d.textContent = T(s.descKey, s.fb);
          li.appendChild(k);
          li.appendChild(d);
          ul.appendChild(li);
        });
        dlg.appendChild(ul);
        modalActions(dlg, [mkButton(T("kb_close_btn", "Close"), "dkf-btn dkf-btn--primary", close)]);
      }
    });
  }

  function isTypingTarget(el) {
    if (!el) return false;
    try {
      var tag = (el.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      if (el.isContentEditable) return true;
      if (el.closest && el.closest('[contenteditable="true"]')) return true;
    } catch (e) { /* ignore */ }
    return false;
  }

  function findSearchInput() {
    return $("input[type=search]") ||
           $("[data-search-highlight]") ||
           $("header input[type=text]") ||
           $("header input:not([type])");
  }

  function initShortcuts() {
    document.addEventListener("keydown", function (e) {
      try {
        if (!e || e.defaultPrevented) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (isTypingTarget(e.target)) return;
        if (activeModal) return; // modal has its own key handling
        var k = e.key;
        if (k === "/") {
          var s = findSearchInput();
          if (s) {
            e.preventDefault();
            try { s.focus(); if (typeof s.select === "function") s.select(); } catch (err) {}
          }
        } else if (k === "t" || k === "T") {
          try { location.href = U("/tools/"); } catch (err) {}
        } else if (k === "?") {
          e.preventDefault();
          openShortcutsModal();
        }
      } catch (err) { /* never break the page over a shortcut */ }
    });
  }

  /* ---------------- H) Command palette (UI/UX #41, Oct 8 2026) ----------------
     Ctrl+K / Cmd+K anywhere: search tools + key pages, Enter to jump. */
  function humanizeSlug(slug){
    return String(slug||"").replace(/[-_]+/g," ").replace(/\b\w/g,function(c){return c.toUpperCase();})||"Tool";
  }
  function paletteEntries(){
    var items=[];
    var tools=window.DKTOOLS||[];
    tools.forEach(function(x){
      if(!x||!x.href) return;
      var slug="";
      try{ slug=String(x.href).replace(/^.*\/tools\//,"").replace(/\//g,""); }catch(e){}
      items.push({icon:x.icon||"🔧",label:T(x.nameKey,humanizeSlug(slug)),
        hint:T(x.descKey,""),href:x.href});
    });
    [["🏠","nav_all_tools","/tools/","Browse every free tool"],
     ["⌨️","nav_typing","/typing/","Typing lessons and practice"],
     ["💳","nav_pricing","/pricing.html","Simple, honest pricing"],
     ["❓","nav_faq","/faq.html","Quick answers"],
     ["📝","changelog.title","/changelog.html","What changed recently"]
    ].forEach(function(p){
      items.push({icon:p[0],label:T(p[1],p[3]),hint:"",href:p[2]});
    });
    return items;
  }
  function openPalette(){
    var entries=paletteEntries();
    openModal({
      label:T("kb_palette","Command palette"),
      build:function(dlg,close){
        modalTitle(dlg,"⌘ "+T("kb_palette","Command palette"));
        var wrap=document.createElement("div"); wrap.className="dkf-palette";
        var input=document.createElement("input");
        input.type="text"; input.className="text-input dkf-palette-input";
        input.setAttribute("placeholder",T("kb_palette_ph","Type a tool or page name\u2026"));
        input.setAttribute("aria-label",T("kb_palette","Command palette"));
        input.setAttribute("role","combobox"); input.setAttribute("aria-expanded","true");
        input.setAttribute("aria-autocomplete","list");
        var list=document.createElement("div");
        list.className="dkf-palette-list"; list.setAttribute("role","listbox");
        wrap.appendChild(input); wrap.appendChild(list); dlg.appendChild(wrap);
        var active=0, shown=[];
        function go(href){ close(); try{ location.href=U(href); }catch(e){} }
        function paint(){
          var btns=list.querySelectorAll(".ss-item");
          btns.forEach(function(b,i){ b.classList.toggle("active",i===active); });
        }
        function render(){
          var q=input.value.trim().toLowerCase();
          shown=entries.filter(function(e){
            return !q||((e.label+" "+e.hint).toLowerCase().indexOf(q)>=0);
          }).slice(0,8);
          active=0; list.innerHTML="";
          if(!shown.length){
            var em=document.createElement("div"); em.className="ss-empty";
            em.textContent=T("tools_empty","No tools match your search. Try another word.");
            list.appendChild(em); return;
          }
          shown.forEach(function(e,i){
            var b=document.createElement("button");
            b.type="button"; b.className="ss-item"+(i===0?" active":"");
            b.setAttribute("role","option"); b.id="dkf-pal-"+i;
            var ic=document.createElement("span"); ic.className="ss-icon";
            ic.setAttribute("aria-hidden","true"); ic.textContent=e.icon;
            var nm=document.createElement("span"); nm.className="ss-name"; nm.textContent=e.label;
            b.appendChild(ic); b.appendChild(nm);
            if(e.hint){ var ds=document.createElement("span"); ds.className="ss-desc"; ds.textContent=e.hint; b.appendChild(ds); }
            b.addEventListener("click",function(){ go(e.href); });
            list.appendChild(b);
          });
          input.setAttribute("aria-activedescendant","dkf-pal-0");
        }
        input.addEventListener("input",render);
        input.addEventListener("keydown",function(ev){
          var btns=list.querySelectorAll(".ss-item");
          if(ev.key==="ArrowDown"&&btns.length){ ev.preventDefault(); active=(active+1)%btns.length; paint();
            input.setAttribute("aria-activedescendant","dkf-pal-"+active); }
          else if(ev.key==="ArrowUp"&&btns.length){ ev.preventDefault(); active=(active-1+btns.length)%btns.length; paint();
            input.setAttribute("aria-activedescendant","dkf-pal-"+active); }
          else if(ev.key==="Enter"){ ev.preventDefault(); if(shown[active]) go(shown[active].href); }
        });
        render();
        setTimeout(function(){ try{ input.focus(); }catch(e){} },60);
      }
    });
  }
  function initPalette(){
    document.addEventListener("keydown",function(e){
      try{
        if(!e||e.defaultPrevented) return;
        if(!((e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey)) return;
        if(String(e.key||"").toLowerCase()!=="k") return;
        e.preventDefault();
        if(activeModal){ closeModal(); return; }
        openPalette();
      }catch(err){/* never break the page */}
    });
  }

  /* ---------------- E) Recent tools ---------------- */

  var RECENT_KEY = "dokit_recent_tools";

  function cleanSlug(s) {
    return String(s || "").replace(/[^a-z0-9-]/gi, "").toLowerCase();
  }

  function recordRecent() {
    if (!IS_TOOL_PAGE || !SLUG) return;
    var list = lsGetJson(RECENT_KEY, []);
    if (!Array.isArray(list)) list = [];
    list = list.filter(function (r) { return r && r.slug !== SLUG; });
    var name = SLUG;
    try { name = String(document.title || SLUG); } catch (e) { name = SLUG; }
    list.unshift({ slug: SLUG, name: name, ts: Date.now() });
    list = list.slice(0, 5);
    lsSet(RECENT_KEY, JSON.stringify(list));
  }

  function renderRecent() {
    if (!IS_HOME) return;
    var list = lsGetJson(RECENT_KEY, []);
    if (!Array.isArray(list) || !list.length) return;

    var host = $("#home-recent");
    if (!host) {
      var hero = $("section.hero") || $(".hero");
      if (!hero || !hero.parentNode) return; // no hero: don't invent layout
      host = document.createElement("section");
      host.id = "home-recent";
      host.className = "dkf-recent";
      host.setAttribute("aria-label", T("recent_tools_label", "Recently used tools"));
host.setAttribute("data-i18n-aria", "recent_tools_label");
      var inner = document.createElement("div");
      inner.className = "container";
      host.appendChild(inner);
      hero.parentNode.insertBefore(host, hero.nextSibling);
      host = inner;
    }
    if (host.querySelector(".dkf-recent__chips")) return; // already rendered

    var h = document.createElement("h2");
    h.className = "dkf-recent__title";
    h.textContent = T("recent_title", "🕘 Recently used");
h.setAttribute("data-i18n", "recent_title");
    var chips = document.createElement("div");
    chips.className = "dkf-recent__chips";
    list.slice(0, 5).forEach(function (r) {
      var slug = r && cleanSlug(r.slug);
      if (!slug) return;
      var a = document.createElement("a");
      a.className = "dkf-chip";
      a.href = U("/tools/" + slug + "/");
      a.textContent = (r && r.name) ? String(r.name) : slug; // textContent: XSS-safe
      chips.appendChild(a);
    });
    if (!chips.hasChildNodes()) return;
    host.appendChild(h);
    host.appendChild(chips);
  }

  /* ---------------- F) Favorites ---------------- */

  var FAV_KEY = "dokit_fav_tools";
  var favFilterOn = false;

  function getFavs() {
    var a = lsGetJson(FAV_KEY, []);
    return Array.isArray(a) ? a.filter(function (s) { return typeof s === "string"; }) : [];
  }
  function setFavs(a) { lsSet(FAV_KEY, JSON.stringify(a)); }
  function isFav(slug) { return getFavs().indexOf(slug) !== -1; }
  function toggleFav(slug) {
    var favs = getFavs();
    var i = favs.indexOf(slug);
    var on;
    if (i === -1) { favs.push(slug); on = true; }
    else { favs.splice(i, 1); on = false; }
    setFavs(favs);
    return on;
  }

  function slugFromHref(href) {
    try {
      var p = new URL(href, location.href).pathname;
      var m = p.match(/\/tools\/([a-z0-9-]+)\/?$/i);
      return m ? cleanSlug(m[1]) : null;
    } catch (e) { return null; }
  }

  function paintFavButtons(slug, on) {
    $all('[data-fav="' + slug + '"]').forEach(function (b) {
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.classList.toggle("dkf-fav-btn--on", on);
      b.textContent = on ? "❤️" : "🤍";
    });
  }

  function injectFavButtons(root) {
    $all(".tool-card", root).forEach(function (card) {
      try {
        if (card.querySelector("[data-fav]")) return; // already has one
        var slug = slugFromHref(card.getAttribute("href"));
        if (!slug) return;
        var on = isFav(slug);
        var b = document.createElement("button");
        b.type = "button";
        b.className = "dkf-fav-btn";
        b.setAttribute("data-fav", slug);
        b.setAttribute("aria-pressed", on ? "true" : "false");
        b.setAttribute("aria-label", "Save to favorites");
        b.title = "Save to favorites";
        b.classList.toggle("dkf-fav-btn--on", on);
        b.textContent = on ? "❤️" : "🤍";
        card.classList.add("dkf-has-fav");
        card.insertBefore(b, card.firstChild);
      } catch (e) { /* skip broken cards */ }
    });
  }

  // Single delegated handler for every [data-fav] button (injected or static).
  function initFavDelegate() {
    document.addEventListener("click", function (e) {
      try {
        var el = e.target;
        var btn = (el && el.closest) ? el.closest("[data-fav]") : null;
        if (!btn) return;
        var slug = cleanSlug(btn.getAttribute("data-fav"));
        if (!slug) return;
        e.preventDefault(); // card is an anchor: don't navigate
        e.stopPropagation();
        paintFavButtons(slug, toggleFav(slug));
        if (favFilterOn) applyFavFilter();
      } catch (err) { /* ignore */ }
    });
  }

  function applyFavFilter() {
    var favs = getFavs();
    $all(".tool-card").forEach(function (card) {
      try {
        if (!favFilterOn) { card.hidden = false; return; }
        var slug = slugFromHref(card.getAttribute("href"));
        card.hidden = !(slug && favs.indexOf(slug) !== -1);
      } catch (e) { /* ignore */ }
    });
    // Re-apply after the grid re-renders (tools page re-renders on search).
    // (handled by observeCards below)
  }

  function ensureFavChip() {
    var row = $(".tools-filter") || $("#toolFilters") || $(".chips");
    if (!row || row.querySelector(".dkf-fav-chip")) return;
    var chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip dkf-fav-chip";
    chip.textContent = "❤️ My favorites";
    chip.setAttribute("aria-pressed", "false");
    chip.addEventListener("click", function () {
      favFilterOn = !favFilterOn;
      chip.setAttribute("aria-pressed", favFilterOn ? "true" : "false");
      applyFavFilter();
    });
    try { row.insertBefore(chip, row.firstChild); } catch (e) { return; }
  }

  function observeCards() {
    injectFavButtons(document);
    ensureFavChip();
    var target = $("#toolsGrid") || document.body;
    if (!target) return;
    var scheduled = false;
    function run() {
      if (scheduled) return;
      scheduled = true;
      setTimeout(function () {
        scheduled = false;
        injectFavButtons(target);
        ensureFavChip();
        if (favFilterOn) applyFavFilter();
      }, 0);
    }
    try {
      var mo = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].addedNodes && muts[i].addedNodes.length) { run(); break; }
        }
      });
      mo.observe(target, { childList: true, subtree: true });
    } catch (e) { /* MutationObserver unavailable */ }
  }

  /* ---------------- G) Tutorial video section ---------------- */

  window.DK_TUTORIALS = window.DK_TUTORIALS || {};

  function setTutorial(slug, id) {
    var s = cleanSlug(slug);
    if (!s) return;
    window.DK_TUTORIALS[s] = id ? String(id).slice(0, 64) : null;
  }

  function initTutorial() {
    if (!IS_TOOL_PAGE || !SLUG) return;
    if ($("#dkf-tutorial")) return;
    var main = $("#main") || $("main");
    if (!main) return;

    var sec = document.createElement("section");
    sec.id = "dkf-tutorial";
    sec.className = "dkf-tutorial";
    sec.setAttribute("aria-labelledby", "dkf-tut-h");

    var h = document.createElement("h2");
    h.id = "dkf-tut-h";
    h.textContent = "📺 Video tutorial (30 sec)";
    sec.appendChild(h);

    var vid = window.DK_TUTORIALS[SLUG];
    if (vid) {
      // Click-to-load placeholder: no YouTube request until the user taps.
      var ph = document.createElement("button");
      ph.type = "button";
      ph.className = "dkf-tut__play";
      ph.setAttribute("aria-label", "Play video tutorial");
      var icon = document.createElement("span");
      icon.className = "dkf-tut__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "▶";
      ph.appendChild(icon);
      ph.addEventListener("click", function () {
        var fr = document.createElement("iframe");
        fr.className = "dkf-tut__frame";
        fr.title = "Video tutorial";
        fr.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(vid);
        fr.setAttribute("frameborder", "0");
        fr.setAttribute("allow",
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
        fr.setAttribute("allowfullscreen", "");
        try {
          if (ph.parentNode) ph.parentNode.replaceChild(fr, ph);
        } catch (e) { /* ignore */ }
      });
      sec.appendChild(ph);
    } else {
      var card = document.createElement("div");
      card.className = "dkf-tut__soon";
      var p = document.createElement("p");
      p.textContent = "🎬 Tutorial coming soon — subscribe to get notified";
      var a = document.createElement("a");
      a.className = "dkf-btn dkf-btn--primary dkf-btn--sm";
      a.href = U("/coming-soon.html");
      a.textContent = "Notify me";
      card.appendChild(p);
      card.appendChild(a);
      sec.appendChild(card);
    }

    // Inject right after the main tool UI card; fall back to end of <main>.
    var anchor = main.querySelector(".tcard") || main.querySelector(".thero");
    try {
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(sec, anchor.nextSibling);
      else main.appendChild(sec);
    } catch (e) { /* ignore */ }
  }

  /* ---------------- H) Analytics (throttled, no PII) ---------------- */

  var ANALYTICS_WINDOW_MS = 5 * 60 * 1000;

  function trackAnalytics() {
    var key = "dkf_analytics_" + PATH;
    var last = 0;
    try { last = parseInt(ssGet(key) || "0", 10) || 0; } catch (e) { last = 0; }
    if (Date.now() - last < ANALYTICS_WINDOW_MS) return; // same page in last 5 min
    ssSet(key, String(Date.now()));
    withDb(function (db) {
      try {
        db.collection("analytics").add({
          page: PATH,
          ts: serverTimestamp(),
          ref: (function () { try { return document.referrer || null; } catch (e) { return null; } })(),
          lang: (function () {
            try { return (document.documentElement && document.documentElement.lang) || null; }
            catch (e) { return null; }
          })()
        }).catch(function () { /* analytics must never throw */ });
      } catch (e) { /* analytics must never throw */ }
    });
  }

  /* ---------------- E) Sticky result action (UI/UX #17, Oct 8 2026) ----------------
     Mobile thumb-zone: when a tool's primary action button (marked with
     data-sticky-action) has results ready but is scrolled out of view above,
     show a fixed bottom bar mirroring it. Tapping the bar clicks the real button. */
  function initStickyAction(){
    if(!window.matchMedia||!("IntersectionObserver" in window)) return;
    var btn=document.querySelector("[data-sticky-action]");
    if(!btn) return;
    var bar=document.createElement("div");
    bar.className="dkf-sticky-action"; bar.hidden=true;
    var b=document.createElement("button");
    b.type="button"; b.className="btn btn-primary";
    bar.appendChild(b); document.body.appendChild(bar);
    function syncLabel(){ b.textContent=((btn.textContent||"").trim()||"Continue"); }
    syncLabel();
    b.addEventListener("click",function(){ btn.click(); });
    var mq=window.matchMedia("(max-width: 768px)");
    function targetReady(){
      return btn.offsetParent!==null&&!btn.disabled&&btn.getAttribute("aria-disabled")!=="true";
    }
    function upd(){
      var r=btn.getBoundingClientRect();
      var scrolledPast=r.bottom<0; /* button is above the viewport */
      var show=mq.matches&&targetReady()&&scrolledPast;
      bar.hidden=!show;
      document.body.classList.toggle("dkf-has-sticky",show);
    }
    new IntersectionObserver(function(){ upd(); },{threshold:0}).observe(btn);
    var tick=false;
    window.addEventListener("scroll",function(){
      if(tick) return; tick=true;
      requestAnimationFrame(function(){ tick=false; upd(); });
    },{passive:true});
    window.addEventListener("resize",upd);
    if(mq.addEventListener) mq.addEventListener("change",upd);
    try{
      new MutationObserver(function(){ syncLabel(); upd(); })
        .observe(btn,{attributes:true,childList:true,subtree:true,characterData:true});
    }catch(e){}
    upd();
  }

  /* ---------------- boot ---------------- */

  function init() {
    try { initWhatsApp(); } catch (e) {}
    try { initFeedback(); } catch (e) {}
    try { watchFooterExtras(); } catch (e) {}
    try { initShortcuts(); } catch (e) {}
    try { initPalette(); } catch (e) {}
    try { initStickyAction(); } catch (e) {}
    try { recordRecent(); } catch (e) {}
    try { renderRecent(); } catch (e) {}
    try { initFavDelegate(); } catch (e) {}
    try { observeCards(); } catch (e) {}
    try { initTutorial(); } catch (e) {}
    try { trackAnalytics(); } catch (e) {}
  }

  window.DKFeatures = {
    version: "1.0.0",
    setTutorial: setTutorial
  };

  ready(init);
})();
