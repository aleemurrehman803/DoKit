window.DK_BASE=function(){try{var l=document.querySelector('link[rel="manifest"]');if(l&&l.href)return l.href.slice(0,l.href.lastIndexOf("/")+1)}catch(e){}try{var s=document.currentScript;if(s&&s.src){var i=s.src.indexOf(window.DKU("/js/"));if(i>0)return s.src.slice(0,i+1)}}catch(e2){}return "/"}();window.DK_VER="20261007-02";window.DKU=function(p){p=String(p==null?"":p);if(/^(?:https?:)?\/\/|^(?:data|mailto|tel):|^#/i.test(p))return p;var u=p.charAt(0)==="/"?window.DK_BASE+p.slice(1):p;if(/\.(js|css|png|svg|webp|jpg|jpeg|json)(\?|$)/i.test(u)&&u.indexOf("DK_VER")<0){u+=(u.indexOf("?")>=0?"&":"?")+"v="+window.DK_VER}return u};!function(){"use strict";function e(e){return window.DKI18N&&"function"==typeof window.DKI18N.t?window.DKI18N.t(e):e}function t(){return window.DKI18N&&"function"==typeof window.DKI18N.getLang?window.DKI18N.getLang():"en"}var n='<svg width="32" height="32" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><defs><linearGradient id="dknav" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7D5CFF"/><stop offset="1" stop-color="#4A2FD6"/></linearGradient></defs><rect x="2" y="2" width="60" height="60" rx="15" fill="url(#dknav)"/><path d="M16 15 A8.5 8.5 0 1 1 32.5 10.5" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round"/><rect x="20.75" y="17" width="6.5" height="31" rx="3.25" fill="#fff"/><path d="M24 19 C39 19 45.5 25 45.5 32.5 C45.5 40 39 46 24 46" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/></svg>',o=[["en","English"],["ur","اردو"],["ar","العربية"],["hi","हिन्दी"],["es","Español"],["fr","Français"],["pt","Português"],["de","Deutsch"],["tr","Türkçe"],["ru","Русский"]],a=[{href:window.DKU("/tools/image-resizer/"),icon:"🖼️",nameKey:"tool_resizer_name",descKey:"tool_resizer_desc"},{href:window.DKU("/tools/image-compressor/"),icon:"🗜️",nameKey:"tool_compressor_name",descKey:"tool_compressor_desc"},{href:window.DKU("/tools/image-converter/"),icon:"🔄",nameKey:"tool_converter_name",descKey:"tool_converter_desc"},{href:window.DKU("/tools/word-counter/"),icon:"🔢",nameKey:"tool_counter_name",descKey:"tool_counter_desc"},{href:window.DKU("/tools/case-converter/"),icon:"🔠",nameKey:"tool_case_name",descKey:"tool_case_desc"},{href:window.DKU("/typing/"),icon:"⌨️",nameKey:"tool_typing_name",descKey:"tool_typing_desc"}];function r(e){return String(e).replace(/[&<>"']/g,function(e){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[e]})}var i=null;function s(t){var n=e(t);i||((i=document.createElement("div")).className="toast-wrap",i.setAttribute("aria-live","polite"),document.body.appendChild(i));var o=document.createElement("div");o.className="toast",o.textContent=n,i.appendChild(o),setTimeout(function(){o.style.opacity="0",o.style.transition="opacity .3s",setTimeout(function(){o.remove()},320)},2600)}var c="dokit_theme";function l(e){document.documentElement.setAttribute("data-theme",e),m()}function d(){l(function(){try{var e=window.localStorage.getItem(c);if("dark"===e||"light"===e)return e}catch(e){}return window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}());/* FIX 2026-10-07: delegated binding so the theme toggle keeps working after
       renderNav() re-renders the button (e.g. on language switch). The old
       direct binding was lost whenever the nav was rebuilt. */
    if(!d.b){d.b=1;document.addEventListener("click",function(t){var b=t.target&&t.target.closest?t.target.closest("#themeToggle"):null;if(b){var e="dark"===document.documentElement.getAttribute("data-theme")?"light":"dark";try{window.localStorage.setItem(c,e)}catch(e){}l(e)}})}}function m(){var t=document.getElementById("themeToggle");if(t){var n="dark"===document.documentElement.getAttribute("data-theme");t.textContent=n?"☀️":"🌙",t.setAttribute("aria-label",e("theme_toggle_title"))}}function u(){var b=document.getElementById("langBtn"),m=document.getElementById("langMenu");function c(){if(m&&!m.hidden){m.hidden=true;if(b)b.setAttribute("aria-expanded","false")}}if(b&&!b.dataset.bound){b.dataset.bound="1";b.addEventListener("click",function(e){e.stopPropagation();if(!m)return;var w=m.hidden;m.hidden=!w;b.setAttribute("aria-expanded",String(w))});document.addEventListener("click",c);document.addEventListener("keydown",function(e){"Escape"===e.key&&c()})}if(m&&!m.dataset.bound){m.dataset.bound="1";m.addEventListener("click",function(e){var l=e.target.closest?e.target.closest("li[data-lang]"):null;if(l&&window.DKI18N&&"function"==typeof window.DKI18N.setLang){window.DKI18N.setLang(l.getAttribute("data-lang"));c()}});m.addEventListener("keydown",function(e){var l=e.target.closest?e.target.closest("li[data-lang]"):null;if(l&&("Enter"===e.key||" "===e.key)){e.preventDefault();if(window.DKI18N&&"function"==typeof window.DKI18N.setLang){window.DKI18N.setLang(l.getAttribute("data-lang"));c()}}})}f()}function f(){var cur=t(),s=document.getElementById("langCur"),b=document.getElementById("langBtn"),m=document.getElementById("langMenu"),lbl=cur;for(var i=0;i<o.length;i++)if(o[i][0]===cur)lbl=o[i][1];if(s)s.textContent=lbl;if(b)b.setAttribute("aria-label",e("lang_select_label")+": "+lbl);if(m){var it=m.querySelectorAll("li[data-lang]");for(var j=0;j<it.length;j++)it[j].setAttribute("aria-selected",String(it[j].getAttribute("data-lang")===cur))}}var p=0;function v(){var e=Date.now();if(!(e-p<4e3)){p=e;try{s("err_unexpected")}catch(e){}}}window.addEventListener("error",function(){v()}),window.addEventListener("unhandledrejection",function(){v()});var g={"image/png":1,"image/jpeg":1,"image/webp":1};function h(e){var t=new Error("DKUI.image: "+e);return t.code=e,t}var _={loadFile:function(e){return Promise.resolve().then(function(){if(!e)throw h("CORRUPT");if("image/gif"===e.type)throw h("GIF_ANIMATED");if(!g[e.type])throw h("TYPE");if(e.size>26214400)throw h("SIZE");return function(e){return"function"==typeof createImageBitmap?createImageBitmap(e,{imageOrientation:"from-image"}).catch(function(){return createImageBitmap(e)}):new Promise(function(t,n){var o=URL.createObjectURL(e),a=new Image;a.onload=function(){URL.revokeObjectURL(o),createImageBitmap(a).then(t,n)},a.onerror=function(){URL.revokeObjectURL(o),n(h("CORRUPT"))},a.src=o})}(e).then(function(t){return{bitmap:t,w:t.width,h:t.height,name:e.name||"image"}},function(){throw h("CORRUPT")})})},fitToMP:function(e,t){t=t||16;var n=e.width,o=e.height;if(n*o<=1e6*t)return Promise.resolve({bitmap:e,w:n,h:o,scaled:!1});var a=Math.sqrt(1e6*t/(n*o)),r=Math.max(1,Math.round(n*a)),i=Math.max(1,Math.round(o*a)),s=document.createElement("canvas");return s.width=r,s.height=i,s.getContext("2d").drawImage(e,0,0,r,i),createImageBitmap(s).then(function(t){try{e.close&&e.close()}catch(e){}return{bitmap:t,w:r,h:i,scaled:!0}})},toBlob:function(e,t,n){return new Promise(function(o,a){try{e.toBlob(function(e){e?o(e):a(h("CORRUPT"))},t,n)}catch(e){a(h("CORRUPT"))}})},download:function(e,t){var n=URL.createObjectURL(e),o=document.createElement("a"),a="download"in o,r=/iPad|iPhone|iPod/.test(navigator.userAgent||"");if(a&&!r)o.href=n,o.download=t||"dokit-download",document.body.appendChild(o),o.click(),setTimeout(function(){URL.revokeObjectURL(n),o.remove()},4e3);else{window.open(n,"_blank");try{s("img_save_hint")}catch(e){}setTimeout(function(){URL.revokeObjectURL(n)},3e4)}},formatBytes:function(e){if((e=Number(e)||0)<1024)return e+" B";for(var t=["KB","MB","GB"],n=e/1024,o=0;n>=1024&&o<t.length-1;)n/=1024,o++;return Math.round(10*n)/10+" "+t[o]},revoke:function(e){try{URL.revokeObjectURL(e)}catch(e){}}};window.DKUI={version:"1.0.0",renderNav:function(i){i=i||"";var s=document.getElementById("site-nav");if(s){s.className="site-header";var c=a.map(function(t){return'<a href="'+t.href+'"><span aria-hidden="true">'+t.icon+"</span><span><strong>"+r(e(t.nameKey))+"</strong><small>"+r(e(t.descKey))+"</small></span></a>"}).join(""),l=o.map(function(e){return'<li role="option" tabindex="0" data-lang="'+e[0]+'" aria-selected="'+(t()===e[0])+'">'+r(e[1])+(['ar','hi','de','ru'].indexOf(e[0])>-1?' <span class="lang-beta">beta</span>':"")+"</li>"}).join("");s.innerHTML='<div class="container nav-inner"><a class="brand" href="/" aria-label="'+r(e("nav_home"))+'">'+n+'<span>DoKit</span></a><nav class="nav-links" aria-label="'+r(e("nav_primary"))+'"><div class="nav-dropdown" id="toolsDropdown"><button class="chip" id="toolsDropBtn" aria-haspopup="true" aria-expanded="false">'+r(e("nav_tools"))+' <span aria-hidden="true">▾</span></button><div class="nav-dropdown__menu" role="menu"><a href="/tools/"><span aria-hidden="true">🧰</span><span><strong>'+r(e("nav_all_tools"))+"</strong><small>"+r(e("nav_all_tools_desc"))+"</small></span></a>"+c+'<div class="nav-dropdown__sep" role="separator"></div><div class="nav-dropdown__label">'+r(e("nav_coming_soon"))+'</div><a href="/typefight/"><span aria-hidden="true">⚔️</span><span><strong>'+r(e("tool_typefight_name"))+"</strong><small>"+r(e("tool_typefight_desc"))+"</small></span></a></div></div>"+g(window.DKU("/typing/"),"nav_typing","typing")+g(window.DKU("/pricing.html"),"nav_pricing","pricing")+'</nav><div class="nav-spacer"></div><div class="nav-actions"><div class="lang-drop" id="langDrop"><button type="button" class="lang-btn" id="langBtn" aria-haspopup="listbox" aria-expanded="false" aria-label="'+r(e("lang_select_label"))+'"><span aria-hidden="true">\uD83C\uDF10</span> <span id="langCur"></span></button><ul class="lang-menu" id="langMenu" role="listbox" aria-label="'+r(e("lang_select_label"))+'" hidden>'+l+'</ul></div><button class="dk-avatarbtn" id="dkProfBtn" aria-label="'+r(e("nav_profile"))+'" title="'+r(e("nav_profile"))+'"><span class="dk-avatarbtn__inner"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg></span><span class="dk-coinbadge" id="dkCoinBadge" hidden></span></button><button class="toggle-btn" id="themeToggle" aria-label="'+r(e("theme_toggle_title"))+'"></button><a class="btn btn-primary btn-sm nav-cta" href="/tools/">'+r(e("nav_get_started"))+'</a><button class="toggle-btn mobile-menu-btn" id="mobileMenuBtn" aria-expanded="false" aria-label="Menu">☰</button></div></div><nav class="mobile-nav container" id="mobileNav" aria-label="'+r(e("nav_primary"))+'"><a href="/tools/">'+r(e("nav_all_tools"))+"</a>"+(function(){var C=[["nav_cat_image",["tool_resizer_name","tool_compressor_name","tool_converter_name"]],["nav_cat_text",["tool_counter_name","tool_case_name"]],["nav_cat_typing",["tool_typing_name"]]],K={};a.forEach(function(t){K[t.nameKey]=t;});return C.map(function(c){var h=c[1].map(function(k){var t=K[k];return t?'<a href="'+t.href+'">'+t.icon+" "+r(e(t.nameKey))+"</a>":"";}).join("");return h?'<div class="mnav-cat"><span class="mnav-cat-t">'+r(e(c[0]))+"</span>"+h+"</div>":"";}).join("");})()+'<a href="/typing/">'+r(e("nav_typing"))+'</a><a href="/typefight/">⚔️ '+r(e("tool_typefight_name"))+' <span class="badge badge-amber">'+r(e("badge_soon"))+'</span></a><a href="/pricing.html">'+r(e("nav_pricing"))+"</a></nav>";var d=document.getElementById("toolsDropdown"),u=document.getElementById("toolsDropBtn");d&&u&&(u.addEventListener("click",function(e){e.stopPropagation();var t=d.classList.toggle("open");u.setAttribute("aria-expanded",t?"true":"false")}),document.addEventListener("click",function(){d.classList.remove("open"),u.setAttribute("aria-expanded","false")}),document.addEventListener("keydown",function(e){"Escape"===e.key&&(d.classList.remove("open"),u.setAttribute("aria-expanded","false"))}));var p=document.getElementById("mobileMenuBtn"),v=document.getElementById("mobileNav");p&&v&&p.addEventListener("click",function(){var e=v.classList.toggle("open");p.setAttribute("aria-expanded",e?"true":"false")}),f(),m(),window.DKI18N&&"function"==typeof window.DKI18N.apply&&window.DKI18N.apply()}function g(t,n,o){return'<a href="'+t+'" class="'+(i===o?"active":"")+'">'+r(e(n))+"</a>"}},renderFooter:function(){var t=document.getElementById("site-foot")||document.getElementById("dk-footer");function o(t,n){return'<div class="footer-col"><h4>'+r(e(t))+"</h4><ul>"+n.map(function(t){return'<li><a href="'+t[0]+'">'+r(e(t[1]))+"</a></li>"}).join("")+"</ul></div>"}t&&(t.className="site-footer",t.innerHTML='<div class="container"><div class="footer-grid"><div class="footer-brand"><a class="brand" href="/">'+n+"<span>DoKit</span></a><p>"+r(e("footer_tagline"))+"</p></div>"+o("footer_tools",[["/tools/image-resizer/","tool_resizer_name"],["/tools/image-compressor/","tool_compressor_name"],["/tools/image-converter/","tool_converter_name"],["/tools/word-counter/","tool_counter_name"],["/tools/case-converter/","tool_case_name"],["/typing/","tool_typing_name"]])+o("footer_company",[["/about.html","nav_about"],["/contact.html","nav_contact"],["/pricing.html","nav_pricing"]])+o("footer_resources",[["/tools/","nav_all_tools"],["/faq.html","nav_faq"],["/changelog.html","changelog.title"],["/design-system.html","design_system.title"],["/coming-soon.html","nav_coming_soon"]])+o("footer_legal",[["/privacy.html","nav_privacy"],["/terms.html","nav_terms"]])+'</div><div class="footer-bottom"><span>'+r(e("footer_developer"))+"</span><span>"+r(e("footer_rights"))+"</span><span>"+r(e("footer_edu"))+"</span></div></div>",window.DKI18N&&"function"==typeof window.DKI18N.apply&&window.DKI18N.apply())},toast:s,initTheme:d,initLang:u,init:function(){d(),u(),function(){try{"serviceWorker"in navigator&&navigator.serviceWorker.register(window.DKU("/sw.js")).catch(function(){})}catch(e){}}()},image:_,refreshLangToggle:f}}();;(function(){function dkFix(root){(root||document).querySelectorAll('a[href^="/"]').forEach(function(a){var h=a.getAttribute("href");if(h&&h.charAt(0)==="/"&&h.charAt(1)!=="/")a.setAttribute("href",window.DKU(h))})}if(window.DKUI){var rn=window.DKUI.renderNav,rf=window.DKUI.renderFooter;if(rn)window.DKUI.renderNav=function(i){rn(i);dkFix(document.getElementById("site-nav"))};if(rf)window.DKUI.renderFooter=function(){rf();dkFix(document.getElementById("site-foot"))}}})();;(function(){function init(){document.querySelectorAll(".tsection.collapsible").forEach(function(sec){var h=sec.querySelector("h2");if(!h||h.dataset.cbound)return;h.dataset.cbound="1";h.setAttribute("tabindex","0");h.setAttribute("role","button");h.setAttribute("aria-expanded","false");function tog(){var o=sec.classList.toggle("open");h.setAttribute("aria-expanded",String(o))}h.addEventListener("click",tog);h.addEventListener("keydown",function(e){if("Enter"===e.key||" "===e.key){e.preventDefault();tog()}})})}if("loading"===document.readyState)document.addEventListener("DOMContentLoaded",init);else init()})();

/* DoKit shared UI components — Worker 2 (60-point frontend upgrade).
 * One self-contained IIFE, plain JS, no modules, no external requests.
 * Exposes stable globals: window.DKIcons, window.DKToast, window.DKModal.
 * CSS consumed from tokens.css (.toast-stack/.toast, .cmdk-*, .reveal/.visible,
 * .ba-slider, .skeleton, .empty-state__*, .glass, .bg-mesh, .bg-noise).
 * w2.css adds ONLY: .ic sizing + .modal styles.
 */
(function () {
  "use strict";

  /* ---------- tiny helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  /* Shared esc (js/dk-utils.js) with local fallback — resolved once at load. */
  var esc = (window.DKUtils && DKUtils.esc) || function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  function t(key, fallback) {
    try {
      if (window.DKI18N && typeof window.DKI18N.t === "function") {
        var v = window.DKI18N.t(key);
        if (v && v !== key) return v;
      }
    } catch (e) {}
    return fallback != null ? fallback : key;
  }
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  /* ============================================================
   * 1. SVG ICON SYSTEM
   * 24x24, stroke-based, currentColor. Symbols injected once as
   * hidden <svg><defs> at top of body. window.DKIcons(name, cls)
   * returns '<svg class="ic ..."><use href="#dk-i-NAME"/></svg>'.
   * ============================================================ */
  var ICON_PATHS = {
    "search": '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    "copy": '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    "check": '<polyline points="20 6 9 17 4 12"/>',
    "x": '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    "chevron-down": '<polyline points="6 9 12 15 18 9"/>',
    "chevron-right": '<polyline points="9 18 15 12 9 6"/>',
    "star": '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    "star-fill": '<polygon fill="currentColor" stroke="none" points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>',
    "image": '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    "text": '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
    "keyboard": '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9.5 14h5"/>',
    "menu": '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    "globe": '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    "sun": '<circle cx="12" cy="12" r="4.5"/><line x1="12" y1="2" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22"/><line x1="2" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22" y2="12"/><line x1="4.9" y1="4.9" x2="6.7" y2="6.7"/><line x1="17.3" y1="17.3" x2="19.1" y2="19.1"/><line x1="4.9" y1="19.1" x2="6.7" y2="17.3"/><line x1="17.3" y1="6.7" x2="19.1" y2="4.9"/>',
    "moon": '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    "home": '<path d="M3 9.5l9-7 9 7V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    "arrow-right": '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    "share": '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
    "user": '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    "coin": '<circle cx="12" cy="12" r="9"/><path d="M12 6.5v11"/><path d="M15 9.6c-.7-1-1.8-1.6-3-1.6-1.9 0-3.2 1-3.2 2.4 0 3 6.4 1.6 6.4 4.6 0 1.4-1.3 2.4-3.2 2.4-1.2 0-2.3-.6-3-1.6"/>',
    "gift": '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
    "download": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    "upload": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    "info": '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    "alert": '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    "external": '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    "sparkles": '<path d="M12 3l1.9 5.6a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"/><path d="M19 3.5v3M17.5 5h3"/>',
    "history": '<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><polyline points="12 7 12 12 15 14.5"/>',
    "heart": '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'
  };
  var ICON_NAMES = Object.keys(ICON_PATHS);

  function injectIcons() {
    if (document.getElementById("dk-icon-defs")) return;
    var symbols = ICON_NAMES.map(function (n) {
      return '<symbol id="dk-i-' + n + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        ICON_PATHS[n] + "</symbol>";
    }).join("");
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("id", "dk-icon-defs");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;";
    var defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = symbols;
    svg.appendChild(defs);
    if (document.body) document.body.insertBefore(svg, document.body.firstChild);
    else document.documentElement.appendChild(svg);
  }

  function DKIcons(name, cls) {
    name = String(name || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (ICON_PATHS[name] == null) name = "info";
    var c = "ic" + (cls ? " " + String(cls).replace(/[<>"']/g, "") : "");
    return '<svg class="' + c + '" aria-hidden="true" focusable="false">' +
      '<use href="#dk-i-' + name + '" xlink:href="#dk-i-' + name + '"></use></svg>';
  }
  window.DKIcons = DKIcons;
  window.DKIconNames = ICON_NAMES.slice();

  /* ============================================================
   * 2. TOAST UPGRADE — window.DKToast(msg, type)
   * type: "success" | "error" | "info" (default "info")
   * Stacks in .toast-stack (created if missing), auto-dismiss 3s.
   * ============================================================ */
  var TOAST_ICONS = { success: "check", error: "alert", info: "info" };
  function DKToast(msg, type) {
    type = type === "success" || type === "error" ? type : "info";
    var stack = $(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      stack.setAttribute("aria-live", "polite");
      stack.setAttribute("aria-atomic", "false");
      document.body.appendChild(stack);
    }
    // cap the stack so rapid errors can't flood the page
    while (stack.children.length >= 4) stack.removeChild(stack.firstChild);
    var el = document.createElement("div");
    el.className = "toast toast--" + type;
    el.setAttribute("role", "status");
    el.innerHTML = DKIcons(TOAST_ICONS[type], "toast__icon") +
      '<span class="toast__msg">' + esc(msg) + "</span>";
    stack.appendChild(el);
    var done = false;
    function dismiss() {
      if (done) return;
      done = true;
      el.classList.add("toast--hide");
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 350);
    }
    setTimeout(dismiss, 3000);
    el.addEventListener("click", dismiss);
    return { dismiss: dismiss, el: el };
  }
  window.DKToast = DKToast;

  /* ============================================================
   * 3. COMMAND PALETTE (Ctrl+K / Cmd+K) + "/" homepage search
   * ============================================================ */
  function toolList() {
    var src = window.DKTools || window.DKTOOLS;
    if (src && src.length) return src;
    var U = function (p) { return (typeof window.DKU === "function") ? window.DKU(p) : p; };
    return [
      { href: U("/tools/image-resizer/"), name: "Image Resizer", nameKey: "tool_resizer_name", icon: "image" },
      { href: U("/tools/image-compressor/"), name: "Image Compressor", nameKey: "tool_compressor_name", icon: "image" },
      { href: U("/tools/image-converter/"), name: "Image Converter", nameKey: "tool_converter_name", icon: "image" },
      { href: U("/tools/word-counter/"), name: "Word Counter", nameKey: "tool_counter_name", icon: "text" },
      { href: U("/tools/case-converter/"), name: "Case Converter", nameKey: "tool_case_name", icon: "text" },
      { href: U("/typing/"), name: "Typing Tutor", nameKey: "tool_typing_name", icon: "keyboard" },
      { href: U("/typing/lessons.html"), name: "Typing Lessons", nameKey: "tool_tlessons_name", icon: "keyboard" },
      { href: U("/typing/test.html"), name: "Typing Test", nameKey: "tool_ttest_name", icon: "clock" },
      { href: U("/typing/games.html"), name: "Typing Games", nameKey: "tool_tgames_name", icon: "sparkles" },
      { href: U("/typing/practice.html"), name: "Typing Practice", nameKey: "tool_tpractice_name", icon: "keyboard" },
      { href: U("/typing/certificate.html"), name: "Typing Certificate", nameKey: "tool_tcert_name", icon: "star" }
    ];
  }
  function itemName(it) {
    if (it.nameKey) return t(it.nameKey, it.name || it.slug || "");
    return it.name || it.slug || "";
  }
  function itemDesc(it) {
    if (it.descKey) return t(it.descKey, it.desc || "");
    return it.desc || "";
  }
  function itemIcon(it) {
    // emoji icons (existing DKTOOLS) render as-is; icon keys use DKIcons
    if (it.icon && !/[\uD800-\uDBFF]/.test(String(it.icon)) && ICON_PATHS[it.icon]) return DKIcons(it.icon);
    if (it.icon) return '<span class="cmdk-item__emoji" aria-hidden="true">' + esc(it.icon) + "</span>";
    return DKIcons("sparkles");
  }

  var cmdk = null; // {overlay, input, list, items, active}
  function buildCmdk() {
    var overlay = document.createElement("div");
    overlay.className = "cmdk-overlay";
    overlay.setAttribute("hidden", "");
    overlay.innerHTML =
      '<div class="cmdk" role="dialog" aria-modal="true" aria-label="' + esc(t("cmdk_label", "Search tools")) + '">' +
      '<div class="cmdk__head">' + DKIcons("search") +
      '<input class="cmdk-input" type="text" role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-autocomplete="list" ' +
      'placeholder="' + esc(t("cmdk_placeholder", "Search tools…  (Ctrl+K)")) + '" autocomplete="off" spellcheck="false"/>' +
      '<kbd class="cmdk__kbd">ESC</kbd></div>' +
      '<div class="cmdk-list" id="cmdk-list" role="listbox" aria-label="' + esc(t("cmdk_results", "Results")) + '"></div>' +
      '<div class="cmdk__foot"><span>' + DKIcons("arrow-right") + " " + esc(t("cmdk_hint", "Enter to open")) + "</span></div>" +
      "</div>";
    document.body.appendChild(overlay);
    var input = $(".cmdk-input", overlay);
    var list = $(".cmdk-list", overlay);
    cmdk = { overlay: overlay, input: input, list: list, items: [], active: -1 };

    function render(q) {
      var query = String(q || "").trim().toLowerCase();
      var all = toolList();
      var hits = all.filter(function (it) {
        if (!query) return true;
        var hay = (itemName(it) + " " + itemDesc(it) + " " + (it.slug || "")).toLowerCase();
        return query.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
      }).slice(0, 12);
      cmdk.items = hits;
      cmdk.active = hits.length ? 0 : -1;
      if (!hits.length) {
        list.innerHTML = '<div class="cmdk-empty">' + esc(t("cmdk_empty", "No tools found")) + "</div>";
        return;
      }
      list.innerHTML = hits.map(function (it, i) {
        return '<a class="cmdk-item' + (i === 0 ? " is-active" : "") + '" role="option" href="' + esc(it.href || "#") +
          '" aria-selected="' + (i === 0 ? "true" : "false") + '" data-idx="' + i + '">' +
          itemIcon(it) +
          '<span class="cmdk-item__text"><strong>' + esc(itemName(it)) + "</strong>" +
          (itemDesc(it) ? "<small>" + esc(itemDesc(it)) + "</small>" : "") + "</span>" +
          DKIcons("arrow-right", "cmdk-item__go") + "</a>";
      }).join("");
    }
    function setActive(i) {
      var items = $all(".cmdk-item", list);
      if (!items.length) return;
      cmdk.active = (i + items.length) % items.length;
      items.forEach(function (a, j) {
        var on = j === cmdk.active;
        a.classList.toggle("is-active", on);
        a.setAttribute("aria-selected", on ? "true" : "false");
        if (on && a.scrollIntoView) a.scrollIntoView({ block: "nearest" });
      });
    }
    input.addEventListener("input", function () { render(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(cmdk.active + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(cmdk.active - 1); }
      else if (e.key === "Enter") {
        e.preventDefault();
        var it = cmdk.items[cmdk.active];
        if (it && it.href) window.location.href = it.href;
      }
    });
    list.addEventListener("mousemove", function (e) {
      var a = e.target && e.target.closest ? e.target.closest(".cmdk-item") : null;
      if (a) setActive(parseInt(a.getAttribute("data-idx"), 10) || 0);
    });
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) closeCmdk(); });
    cmdk.render = render;
    cmdk.setActive = setActive;
    return cmdk;
  }
  function openCmdk() {
    if (!cmdk) buildCmdk();
    cmdk.input.value = "";
    cmdk.render("");
    cmdk.overlay.removeAttribute("hidden");
    // next frame so CSS transitions on .cmdk-overlay can run
    requestAnimationFrame(function () { cmdk.overlay.classList.add("open"); });
    document.body.classList.add("cmdk-open");
    setTimeout(function () { cmdk.input.focus(); }, 30);
  }
  function closeCmdk() {
    if (!cmdk) return;
    cmdk.overlay.classList.remove("open");
    cmdk.overlay.setAttribute("hidden", "");
    document.body.classList.remove("cmdk-open");
    if (cmdk.input) cmdk.input.blur();
  }
  function isCmdkOpen() { return !!(cmdk && !cmdk.overlay.hasAttribute("hidden")); }
  function toggleCmdk() { isCmdkOpen() ? closeCmdk() : openCmdk(); }

  function focusHomeSearch() {
    var s = $('input[data-cmdk-search]') || $("#homeSearch") || $("#site-search") ||
      $(".hero-search input") || $('input[type="search"]');
    if (s && s.offsetParent !== null) { s.focus(); return true; }
    return false;
  }

  /* ============================================================
   * 4. REVEAL ON SCROLL
   * ============================================================ */
  function initReveal() {
    document.documentElement.classList.add("js");
    var els = $all(".reveal");
    if (!els.length) return;
    // data-delay="120" -> --reveal-delay:120ms (CSS stagger hook)
    els.forEach(function (el) {
      var d = el.getAttribute("data-delay");
      if (d != null && !el.style.getPropertyValue("--reveal-delay")) {
        el.style.setProperty("--reveal-delay", parseInt(d, 10) + "ms");
      }
    });
    if (!("IntersectionObserver" in window) || reducedMotion()) {
      els.forEach(function (el) { el.classList.add("visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("visible");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ============================================================
   * 5. BEFORE/AFTER SLIDER — .ba-slider
   * Pointer drag sets --ba-pos (0-100). Keyboard arrows work.
   * RTL-safe: arrow direction follows computed direction.
   * ============================================================ */
  function initBaSliders() {
    $all(".ba-slider").forEach(function (el) {
      if (el.dataset.baBound) return;
      el.dataset.baBound = "1";
      var start = parseFloat(el.getAttribute("data-pos"));
      if (isNaN(start)) start = 50;
      function setPos(p) {
        p = Math.max(0, Math.min(100, Math.round(p)));
        el.style.setProperty("--ba-pos", p);
        el.setAttribute("aria-valuenow", String(p));
      }
      el.setAttribute("role", "slider");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-valuemin", "0");
      el.setAttribute("aria-valuemax", "100");
      el.setAttribute("aria-label", el.getAttribute("aria-label") || t("ba_label", "Before / after comparison"));
      setPos(start);
      var dragging = false;
      function posFromEvent(e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width;
        var rtl = getComputedStyle(el).direction === "rtl";
        if (rtl) x = 1 - x;
        setPos(x * 100);
      }
      el.addEventListener("pointerdown", function (e) {
        dragging = true;
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
        posFromEvent(e);
        e.preventDefault();
      });
      el.addEventListener("pointermove", function (e) { if (dragging) posFromEvent(e); });
      el.addEventListener("pointerup", function () { dragging = false; });
      el.addEventListener("pointercancel", function () { dragging = false; });
      el.addEventListener("keydown", function (e) {
        var rtl = getComputedStyle(el).direction === "rtl";
        var step = e.shiftKey ? 10 : 5;
        var cur = parseFloat(el.getAttribute("aria-valuenow")) || 50;
        var d = 0;
        if (e.key === "ArrowRight") d = rtl ? -step : step;
        else if (e.key === "ArrowLeft") d = rtl ? step : -step;
        else if (e.key === "Home") { setPos(0); e.preventDefault(); return; }
        else if (e.key === "End") { setPos(100); e.preventDefault(); return; }
        if (d) { setPos(cur + d); e.preventDefault(); }
      });
    });
  }

  /* ============================================================
   * 6. COUNT-UP — [data-countup]
   * Animates 0 -> target on intersect. Reduced-motion jumps to final.
   * data-decimals, data-prefix, data-suffix, data-duration supported.
   * ============================================================ */
  function initCountUp() {
    var els = $all("[data-countup]");
    if (!els.length) return;
    function format(v, el) {
      var dec = parseInt(el.getAttribute("data-decimals") || "0", 10);
      var pre = el.getAttribute("data-prefix") || "";
      var suf = el.getAttribute("data-suffix") || "";
      var num = dec > 0 ? v.toFixed(dec)
        : Math.round(v).toLocaleString("en-US").replace(/,/g, "\u2009"); // thin-space grouping
      return pre + num + suf;
    }
    function run(el) {
      if (el.dataset.counted) return;
      el.dataset.counted = "1";
      var target = parseFloat(el.getAttribute("data-countup"));
      if (isNaN(target)) target = parseFloat(el.textContent.replace(/[^\d.\-]/g, "")) || 0;
      if (reducedMotion()) { el.textContent = format(target, el); return; }
      var dur = parseInt(el.getAttribute("data-duration") || "1200", 10);
      var t0 = null;
      function frame(ts) {
        if (t0 == null) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = format(target * eased, el);
        if (p < 1) requestAnimationFrame(frame);
        else el.textContent = format(target, el);
      }
      requestAnimationFrame(frame);
    }
    if (!("IntersectionObserver" in window)) { els.forEach(run); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { run(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.4 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ============================================================
   * 8. MODAL HELPER — window.DKModal(html)
   * Returns the element; .open()/.close() attached.
   * Focus-lite: focuses first focusable on open, restores on close.
   * Esc + overlay click close. API kept stable for Phase 3.
   * ============================================================ */
  var modalPrevFocus = null;
  function DKModal(html) {
    var el = document.createElement("div");
    el.className = "modal";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("hidden", "");
    el.innerHTML =
      '<div class="modal__dialog" role="document">' +
      '<button type="button" class="modal__close" aria-label="' + esc(t("modal_close", "Close")) + '">' +
      DKIcons("x") + "</button>" +
      '<div class="modal__body">' + String(html == null ? "" : html) + "</div>" +
      "</div>";
    function focusables() {
      return $all('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', el)
        .filter(function (n) { return !n.disabled && n.offsetParent !== null; });
    }
    function open() {
      modalPrevFocus = document.activeElement;
      if (!el.parentNode) document.body.appendChild(el);
      el.removeAttribute("hidden");
      requestAnimationFrame(function () { el.classList.add("open"); });
      document.body.classList.add("modal-open");
      setTimeout(function () {
        var f = $(".modal__close", el) || focusables()[0];
        if (f) f.focus();
      }, 40);
    }
    function close() {
      el.classList.remove("open");
      el.setAttribute("hidden", "");
      document.body.classList.remove("modal-open");
      if (modalPrevFocus && modalPrevFocus.focus) {
        try { modalPrevFocus.focus(); } catch (e) {}
      }
      modalPrevFocus = null;
    }
    el.addEventListener("mousedown", function (e) { if (e.target === el) close(); });
    $(".modal__close", el).addEventListener("click", close);
    el.open = open;
    el.close = close;
    el.isOpen = function () { return !el.hasAttribute("hidden"); };
    return el;
  }
  window.DKModal = DKModal;

  /* ============================================================
   * 7. GLOBAL KEYS: Ctrl/Cmd+K palette, "/" search, Esc closes all
   * ============================================================ */
  function closeOpenDropdowns() {
    $all(".nav-dropdown.open").forEach(function (d) {
      d.classList.remove("open");
      var b = $("[aria-expanded]", d);
      if (b) b.setAttribute("aria-expanded", "false");
    });
    $all("[data-dropdown].open, [data-menu].open").forEach(function (d) {
      d.classList.remove("open");
    });
  }
  function initKeys() {
    document.addEventListener("keydown", function (e) {
      var inField = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "") ||
        (e.target && e.target.isContentEditable);
      // Ctrl+K / Cmd+K — command palette
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        toggleCmdk();
        return;
      }
      // "/" focuses homepage search (not while typing elsewhere)
      if (e.key === "/" && !inField && !isCmdkOpen()) {
        if (focusHomeSearch()) e.preventDefault();
        return;
      }
      // Esc closes topmost layer
      if (e.key === "Escape" || e.key === "Esc") {
        if (isCmdkOpen()) { closeCmdk(); return; }
        var openModal = $(".modal.open") || $(".modal:not([hidden])");
        if (openModal && openModal.close) { openModal.close(); return; }
        closeOpenDropdowns();
      }
    });
  }

  /* ---------- boot ---------- */
  onReady(function () {
    injectIcons();
    initReveal();
    initBaSliders();
    initCountUp();
    initKeys();
  });
  // expose for coordinator/testing
  window.DKUI2 = {
    version: "1.0.0",
    icons: window.DKIconNames,
    openPalette: openCmdk,
    closePalette: closeCmdk
  };
})();

/* Worker 6: referral + profile + gamification */
/* DoKit Worker 6 (Phase 3) — Referral + Profile navbar features
 * + SCOPE ADDITION: floating social share sidebar & gamification hooks.
 * Client-side only (localStorage). One IIFE. Does NOT touch js/ui.js.
 * Reuses globals from ui.js: window.DKModal, window.DKToast, window.DKIcons,
 * window.DKI18N (t / add / refresh) and window.DKU. Reuses token classes:
 * .modal .toast .field .input .label .btn .hint .stat__num .toggle-btn .glass.
 *
 * Public APIs exposed (documented for tool pages / Phase-3 merge):
 *
 *   window.DKTrackTool(slug)
 *     Record that a tool page was used (call once per visit/use, e.g.
 *     DKTrackTool("image-resizer")). Feeds the "Tools used" stat in the
 *     profile modal AND awards +2 coins the FIRST time each tool is used
 *     (once per slug — refreshes don't farm coins). Toast on earn.
 *
 *   window.DKRef
 *     { uid(), link(), count(), refs(), referredBy() }
 *     uid()   — stable 6-char user id (dk_uid, generated once)
 *     link()  — full referral link https://aleemurrehman803.github.io/DoKit/?ref=XXXXXX
 *     count() — number of recorded referrals (dk_refs)
 *
 *   window.DKCoins  (gamification wallet — localStorage dk_coins / dk_txns)
 *     get()            → current balance (number)
 *     add(n, reason)   → earn n coins (n>0), writes {delta, reason, date} to
 *                        dk_txns, DKToast "+n Coins", live-updates the navbar
 *                        coin pill. Returns new balance.
 *     spend(n, reason) → spend n coins if balance suffices (writes negative
 *                        txn); returns true/false. Toasts "Not enough coins"
 *                        on failure.
 *     onChange(cb)     → cb(balance) called on every balance change (incl.
 *                        cross-tab via the storage event).
 *     Legacy aliases kept: balance() === get(), award(d, r) === silent add,
 *     txns() → history array.
 *     Coin economy in this build: +10 welcome bonus (first visit), +2 per
 *     newly-tried tool (DKTrackTool), +5 when a referral link converts on
 *     this device (captureRef). NOTE (simulation): this is client-only, so
 *     the +5 referral reward is credited on the JOINING device; a production
 *     backend would credit the referrer's account instead.
 *
 *   window.DKW6        — debug handle { renderReferral, renderProfile }
 *   window.DKW6I18N    — i18n dicts {en, ur} mirroring /tmp/w6_i18n.json, so the
 *                        Phase-3 merge can DKI18N.add() them if load order differs.
 */
(function () {
  "use strict";

  /* ================= 1. i18n dictionaries (EN + UR) ================= */
  /* Other DKI18N languages fall back to English automatically via DKI18N.t(). */
  var W6_EN = {
    "ref.nav": "Refer",
    "ref.title": "Invite friends, earn coins",
    "ref.subtitle": "Share your personal link. When friends join DoKit through it, you both earn.",
    "ref.your_referrals": "Your referrals",
    "ref.reward_note": "Earn 50 coins for every friend who joins",
    "ref.your_link": "Your referral link",
    "ref.copy_link": "Copy link",
    "ref.copied": "Copied!",
    "ref.share_via": "Share via",
    "ref.share_native": "More options",
    "ref.share_text": "Try DoKit — every tool you'll ever need, free and private, right in your browser:",
    "ref.history": "Referral history",
    "ref.history_empty": "No referrals yet — share your link to get started.",
    "ref.joined_via": "You joined via a referral link",
    "ref.joined_via_title": "Joined via referral",
    "ref.how_title": "How it works",
    "ref.step1t": "Share your link",
    "ref.step1d": "Copy your personal referral link, or share it directly to WhatsApp, Facebook, X and more.",
    "ref.step2t": "Friends join",
    "ref.step2d": "When someone opens your link and visits DoKit, they are counted as your referral.",
    "ref.step3t": "You both earn coins",
    "ref.step3d": "You get 50 coins for every referral — and they get a 10-coin welcome bonus.",
    "prof.nav": "Profile",
    "prof.title": "Your profile",
    "prof.guest": "Guest",
    "prof.coins": "Coins",
    "prof.value_note": "1 coin = Rs 1 · 1 coin ≈ $0.0036 (indicative)",
    "prof.indicative": "indicative",
    "prof.insufficient": "Not enough coins",
    "prof.tools_used": "Tools used",
    "prof.referrals": "Referrals",
    "prof.streak": "Day streak",
    "prof.joined": "Joined",
    "prof.history": "Coin history",
    "prof.history_empty": "No coin activity yet.",
    "prof.edit_title": "Edit profile",
    "prof.name": "Name",
    "prof.name_ph": "Your name",
    "prof.email": "Email",
    "prof.email_ph": "you@example.com",
    "prof.save": "Save",
    "prof.saved": "Profile saved",
    "prof.email_invalid": "Please enter a valid email address.",
    "prof.welcome_toast": "Welcome bonus! +10 coins",
    "prof.txn_welcome": "Welcome bonus",
    "prof.txn_referral": "Referral reward",
    "prof.txn_tool": "Tool used",
    "share.bar_label": "Share this page",
    "share.whatsapp": "Share on WhatsApp",
    "share.facebook": "Share on Facebook",
    "share.x": "Share on X",
    "share.telegram": "Share on Telegram",
    "share.copy": "Copy link",
    "share.open": "Share",
    "share.close": "Close share options"
  };
  var W6_UR = {
    "ref.nav": "ریفر",
    "ref.title": "دوستوں کو مدعو کریں، کوئنز کمائیں",
    "ref.subtitle": "اپنا ذاتی لنک شیئر کریں۔ جب دوست اس کے ذریعے DoKit میں شامل ہوں تو آپ دونوں کمائیں۔",
    "ref.your_referrals": "آپ کے ریفرلز",
    "ref.reward_note": "شامل ہونے والے ہر دوست پر 50 کوئنز کمائیں",
    "ref.your_link": "آپ کا ریفرل لنک",
    "ref.copy_link": "لنک کاپی کریں",
    "ref.copied": "کاپی ہو گیا!",
    "ref.share_via": "اس کے ذریعے شیئر کریں",
    "ref.share_native": "مزید آپشنز",
    "ref.share_text": "DoKit آزمائیں — ہر وہ ٹول جو آپ کو کبھی چاہیے، مفت اور نجی، براہِ راست آپ کے براؤزر میں:",
    "ref.history": "ریفرل ہسٹری",
    "ref.history_empty": "ابھی کوئی ریفرل نہیں — شروع کرنے کے لیے اپنا لنک شیئر کریں۔",
    "ref.joined_via": "آپ ریفرل لنک کے ذریعے شامل ہوئے ہیں",
    "ref.joined_via_title": "ریفرل کے ذریعے شمولیت",
    "ref.how_title": "یہ کیسے کام کرتا ہے",
    "ref.step1t": "اپنا لنک شیئر کریں",
    "ref.step1d": "اپنا ذاتی ریفرل لنک کاپی کریں، یا براہِ راست واٹس ایپ، فیس بک، ایکس وغیرہ پر شیئر کریں۔",
    "ref.step2t": "دوست شامل ہوں",
    "ref.step2d": "جب کوئی آپ کا لنک کھول کر DoKit دیکھے تو وہ آپ کا ریفرل شمار ہوتا ہے۔",
    "ref.step3t": "آپ دونوں کوئنز کمائیں",
    "ref.step3d": "ہر ریفرل پر آپ کو 50 کوئنز ملتے ہیں — اور انہیں 10 کوئنز کا خوش آمدیدی بونس ملتا ہے۔",
    "prof.nav": "پروفائل",
    "prof.title": "آپ کا پروفائل",
    "prof.guest": "مہمان",
    "prof.coins": "کوئنز",
    "prof.value_note": "1 کوئن = 1 روپیہ · 1 کوئن ≈ $0.0036 (تخمینی)",
    "prof.indicative": "تخمینی",
    "prof.insufficient": "کوئنز ناکافی ہیں",
    "prof.tools_used": "استعمال شدہ ٹولز",
    "prof.referrals": "ریفرلز",
    "prof.streak": "لگاتار دن",
    "prof.joined": "شمولیت",
    "prof.history": "کوئن ہسٹری",
    "prof.history_empty": "ابھی کوئن کی کوئی سرگرمی نہیں۔",
    "prof.edit_title": "پروفائل میں ترمیم",
    "prof.name": "نام",
    "prof.name_ph": "آپ کا نام",
    "prof.email": "ای میل",
    "prof.email_ph": "you@example.com",
    "prof.save": "محفوظ کریں",
    "prof.saved": "پروفائل محفوظ ہو گئی",
    "prof.email_invalid": "براہ کرم درست ای میل درج کریں۔",
    "prof.welcome_toast": "خوش آمدیدی بونس! +10 کوئنز",
    "prof.txn_welcome": "خوش آمدیدی بونس",
    "prof.txn_referral": "ریفرل انعام",
    "prof.txn_tool": "ٹول استعمال کیا",
    "share.bar_label": "یہ صفحہ شیئر کریں",
    "share.whatsapp": "واٹس ایپ پر شیئر کریں",
    "share.facebook": "فیس بک پر شیئر کریں",
    "share.x": "ایکس پر شیئر کریں",
    "share.telegram": "ٹیلیگرام پر شیئر کریں",
    "share.copy": "لنک کاپی کریں",
    "share.open": "شیئر کریں",
    "share.close": "شیئر آپشنز بند کریں"
  };

  /* ================= 2. Small safe helpers ================= */
  function t(key) {
    try { return (window.DKI18N && typeof window.DKI18N.t === "function") ? window.DKI18N.t(key) : key; }
    catch (e) { return key; }
  }
  function ic(name, cls) {
    try { return (typeof window.DKIcons === "function") ? window.DKIcons(name, cls || "") : ""; }
    catch (e) { return ""; }
  }
  function toast(msg, type) {
    try { if (typeof window.DKToast === "function") window.DKToast(msg, type); } catch (e) {}
  }
  function refreshI18n() {
    try { if (window.DKI18N && typeof window.DKI18N.refresh === "function") window.DKI18N.refresh(); } catch (e) {}
  }
  /* (duplicate esc removed Oct 7, 2026 — identical definition at top of this IIFE) */
  function lsGet(key, dflt) {
    try {
      var v = window.localStorage.getItem(key);
      return (v == null) ? dflt : JSON.parse(v);
    } catch (e) { return dflt; }
  }
  function lsSet(key, val) {
    try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function lsHas(key) {
    try { return window.localStorage.getItem(key) !== null; }
    catch (e) { return true; } /* privacy mode: act as if present so we never double-award */
  }
  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      var lang = (window.DKI18N && typeof window.DKI18N.getLang === "function") ? window.DKI18N.getLang() : "en";
      return d.toLocaleDateString(lang === "ur" ? "ur-PK" : lang, { year: "numeric", month: "short", day: "numeric" });
    } catch (e) { return ""; }
  }
  function copyText(str, done) {
    function fallback() {
      try {
        var ta = document.createElement("textarea");
        ta.value = str;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { ta.setSelectionRange(0, ta.value.length); } catch (e2) {}
        document.execCommand("copy");
        ta.remove();
      } catch (e) {}
      if (done) done();
    }
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        navigator.clipboard.writeText(str).then(function () { if (done) done(); }, fallback);
      } else fallback();
    } catch (e) { fallback(); }
  }

  /* ================= 3. Identity: dk_uid ================= */
  var UID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; /* no 0/O/1/I/L — unambiguous */
  function genUid() {
    var s = "", i, n;
    try {
      if (window.crypto && typeof window.crypto.getRandomValues === "function") {
        var buf = new Uint32Array(6);
        window.crypto.getRandomValues(buf);
        for (i = 0; i < 6; i++) s += UID_CHARS.charAt(buf[i] % UID_CHARS.length);
        return s;
      }
    } catch (e) {}
    for (i = 0; i < 6; i++) { n = Math.floor(Math.random() * UID_CHARS.length); s += UID_CHARS.charAt(n); }
    return s;
  }
  function getUid() {
    var uid = lsGet("dk_uid", "");
    if (typeof uid !== "string" || !/^[A-Z2-9]{6}$/.test(uid)) {
      uid = genUid();
      lsSet("dk_uid", uid);
    }
    return uid;
  }
  function refLink() {
    return "https://aleemurrehman803.github.io/DoKit/?ref=" + getUid();
  }

  /* ================= 4. Coins wallet: dk_coins / dk_txns / dk_profile / dk_joined ================= */
  var coinListeners = [];
  function refreshCoinPill() {
    try {
      var el = document.getElementById("dkCoinPillN");
      if (el) el.textContent = String(getCoins());
    } catch (e) {}
  }
  function emitCoins() {
    refreshCoinPill();
    var bal = getCoins();
    for (var i = 0; i < coinListeners.length; i++) {
      try { coinListeners[i](bal); } catch (e) {}
    }
  }
  function getCoins() {
    var v = Number(lsGet("dk_coins", 0));
    return isNaN(v) ? 0 : Math.max(0, Math.floor(v));
  }
  function setCoins(v) {
    v = Number(v);
    lsSet("dk_coins", isNaN(v) ? 0 : Math.max(0, Math.floor(v)));
  }
  function getTxns() {
    var a = lsGet("dk_txns", []);
    return Array.isArray(a) ? a : [];
  }
  /* Silent internal credit. Public earn path is DKCoins.add() (toasts + pill). */
  function awardCoins(delta, reasonKey) {
    delta = Math.floor(Number(delta) || 0);
    if (!delta) return getCoins();
    setCoins(getCoins() + delta);
    var tx = getTxns();
    tx.unshift({ delta: delta, reason: reasonKey || "", date: new Date().toISOString() });
    lsSet("dk_txns", tx.slice(0, 100));
    emitCoins();
    return getCoins();
  }
  function earnToast(n) { toast("+" + n + " " + t("prof.coins"), "success"); }
  function getProfile() {
    var p = lsGet("dk_profile", {});
    return (p && typeof p === "object") ? p : {};
  }
  function ensureCoins() {
    if (!lsHas("dk_joined")) lsSet("dk_joined", new Date().toISOString());
    if (!lsHas("dk_coins")) setCoins(0);
    /* Welcome bonus: exactly once, first visit ever (localStorage backed). */
    if (!lsHas("dk_welcomed")) {
      lsSet("dk_welcomed", true);
      awardCoins(10, "prof.txn_welcome");
      toast(t("prof.welcome_toast"), "success");
    }
  }

  /* ================= 5. Visit streak: dk_streak {count, last} ================= */
  function dayStr(d) {
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function updateStreak() {
    var today = dayStr(new Date());
    var st = lsGet("dk_streak", null);
    if (!st || typeof st !== "object") st = { count: 0, last: "" };
    if (st.last === today) return Number(st.count) || 0;
    var y = new Date();
    y.setDate(y.getDate() - 1);
    st.count = (st.last === dayStr(y)) ? (Number(st.count) || 0) + 1 : 1;
    st.last = today;
    lsSet("dk_streak", st);
    return st.count;
  }
  function getStreak() {
    var st = lsGet("dk_streak", null);
    return (st && typeof st === "object") ? (Number(st.count) || 0) : 0;
  }

  /* ================= 6. Referral capture from ?ref=CODE ================= */
  function captureRef() {
    var code = null;
    try { code = new URLSearchParams(window.location.search).get("ref"); } catch (e) { return; }
    if (typeof code !== "string" || !/^[A-Za-z0-9]{6}$/.test(code)) return;
    if (code === getUid()) return; /* own link */
    var by = lsGet("dk_ref_by", []);
    if (!Array.isArray(by)) by = [];
    for (var i = 0; i < by.length; i++) {
      if (by[i] && by[i].code === code) return; /* recorded once per code */
    }
    by.push({ code: code, date: new Date().toISOString() });
    lsSet("dk_ref_by", by);
    lsSet("dk_referred_by", code);
    /* +5 referral reward. Client-only simulation: credited on the joining
       device; a production backend would credit the referrer instead. */
    awardCoins(5, "prof.txn_referral");
    earnToast(5);
    toast(t("ref.joined_via"), "success");
  }

  /* ================= 7. Public tool-tracking API ================= */
  /* Tool pages call window.DKTrackTool("image-resizer") once per visit/use.
   * Feeds the "Tools used" stat in the profile modal. Awards +2 coins the
   * FIRST time each tool is used (once per slug — page refreshes can't farm). */
  function trackTool(slug) {
    slug = String(slug == null ? "" : slug).trim().toLowerCase();
    if (!slug) return;
    var a = lsGet("dk_tools_used", []);
    if (!Array.isArray(a)) a = [];
    if (a.indexOf(slug) === -1) {
      a.push(slug);
      lsSet("dk_tools_used", a);
      awardCoins(2, "prof.txn_tool");
      earnToast(2);
    }
  }
  try { window.DKTrackTool = trackTool; } catch (e) {}

  /* ================= 8. Navbar injection (Refer + Profile + coin pill) ================= */
  function makeNavBtn(id, icon, i18nKey, onClick, withPill) {
    var b = document.createElement("button");
    b.type = "button";
    b.id = id;
    b.className = "toggle-btn dk-navbtn";
    b.setAttribute("data-i18n-aria", i18nKey);
    b.setAttribute("aria-label", t(i18nKey));
    var h = ic(icon) + '<span class="dk-navbtn__label" data-i18n="' + i18nKey + '">' + esc(t(i18nKey)) + "</span>";
    if (withPill) {
      h += '<span class="dk-coin-pill" data-i18n-title="prof.coins" title="' + esc(t("prof.coins")) + '">' +
        ic("coin") + '<span id="dkCoinPillN" class="stat__num">' + getCoins() + "</span></span>";
    }
    b.innerHTML = h;
    b.addEventListener("click", onClick);
    return b;
  }
  /* ---------- Navbar avatar button (Google-style profile chip) ---------- */
  /* The corner profile entry is a proper circular avatar — not the generic
   * square toggle button the other nav actions use. Shows the user's
   * initial when a profile name is set, otherwise a clean user icon. The
   * coin count rides as a small badge on the avatar corner; its inner
   * number keeps id="dkCoinPillN" so refreshCoinPill()/emitCoins() keep
   * working untouched. */
  function avatarBtnInner() {
    var name = String((getProfile() || {}).name || "").trim();
    if (name) {
      return '<span class="dk-avatarbtn__initial" aria-hidden="true">' +
        esc(name.charAt(0).toUpperCase()) + "</span>";
    }
    return ic("user", "dk-avatarbtn__icon");
  }
  function makeAvatarBtn() {
    var b = document.createElement("button");
    b.type = "button";
    b.id = "dkProfBtn";
    b.className = "dk-avatarbtn";
    b.setAttribute("data-i18n-aria", "prof.nav");
    b.setAttribute("aria-label", t("prof.nav"));
    b.setAttribute("aria-haspopup", "dialog");
    b.innerHTML = avatarBtnInner() +
      '<span class="dk-avatarbtn__badge" data-i18n-title="prof.coins" title="' + esc(t("prof.coins")) + '">' +
      ic("coin") + '<span id="dkCoinPillN" class="stat__num">' + getCoins() + "</span></span>";
    b.addEventListener("click", openProfile);
    return b;
  }
  /* Re-render the navbar avatar after the user saves a profile name in the
   * profile modal. Keeps the coin badge element and listeners intact. */
  function refreshProfAvatar() {
    try {
      var b = document.getElementById("dkProfBtn");
      if (!b) return;
      b.setAttribute("aria-label", t("prof.nav"));
      var badge = b.querySelector(".dk-avatarbtn__badge");
      b.innerHTML = avatarBtnInner();
      if (badge) b.appendChild(badge);
      refreshCoinPill();
    } catch (e) {}
  }
  function injectNav() {
    try {
      var actions = document.querySelector(".nav-actions");
      if (!actions) return; /* skip silently */
      if (document.getElementById("dkRefBtn") || document.getElementById("dkProfBtn")) return; /* idempotent */
      var refBtn = makeNavBtn("dkRefBtn", "gift", "ref.nav", openReferral, false);
      var profBtn = makeAvatarBtn(); /* circular Google-style avatar, not a toggle */
      var theme = document.getElementById("themeToggle");
      if (theme && theme.parentNode === actions) {
        actions.insertBefore(refBtn, theme);
        actions.insertBefore(profBtn, theme);
      } else {
        actions.appendChild(refBtn);
        actions.appendChild(profBtn);
      }
      refreshI18n(); /* translate freshly injected data-i18n spans if engine is ready */
    } catch (e) {}
  }
  /* Re-inject if renderNav ever re-renders the header (defensive, additive only). */
  function watchNav() {
    try {
      var nav = document.getElementById("site-nav");
      if (!nav || typeof window.MutationObserver !== "function") return;
      var mo = new window.MutationObserver(function () {
        if (!document.getElementById("dkRefBtn")) injectNav();
      });
      mo.observe(nav, { childList: true, subtree: true });
    } catch (e) {}
  }

  /* ================= 9. Floating social share sidebar ================= */
  /* Fixed at the inline-end edge (right in LTR, left in RTL), vertically
   * centered, glassy. Shares the CURRENT page URL — with ?ref=UID appended
   * when the visitor has a referral code, so shares double as referrals.
   * Mobile: hidden off-canvas, toggled by a share FAB (bottom-inline-end). */
  function shareUrl() {
    var url;
    try { url = String(window.location.href); } catch (e) { return ""; }
    var uid = lsGet("dk_uid", "");
    if (typeof uid === "string" && /^[A-Z2-9]{6}$/.test(uid)) {
      try {
        var u = new URL(url);
        if (!u.searchParams.get("ref")) u.searchParams.set("ref", uid);
        url = u.toString();
      } catch (e) {}
    }
    return url;
  }
  function doShare(net) {
    var url = shareUrl();
    if (!url) return;
    var title = "";
    try { title = document.title || ""; } catch (e) {}
    var enc = encodeURIComponent, u = null;
    if (net === "wa") u = "https://wa.me/?text=" + enc(title + " " + url);
    else if (net === "fb") u = "https://www.facebook.com/sharer/sharer.php?u=" + enc(url);
    else if (net === "x") u = "https://x.com/intent/post?text=" + enc(title + " " + url);
    else if (net === "tg") u = "https://t.me/share/url?url=" + enc(url) + "&text=" + enc(title);
    else if (net === "copy") { copyText(url, function () { toast(t("ref.copied"), "success"); }); return; }
    if (u) { try { window.open(u, "_blank", "noopener,noreferrer"); } catch (e) {} }
  }
  function injectShareBar() {
    try {
      if (!document.body || document.getElementById("dkShareBar")) return; /* idempotent */
      var nets = [
        ["wa", "WA", "share.whatsapp", "dk-soc--wa"],
        ["fb", "FB", "share.facebook", "dk-soc--fb"],
        ["x", "X", "share.x", "dk-soc--x"],
        ["tg", "TG", "share.telegram", "dk-soc--tg"]
      ];
      var h = "";
      for (var i = 0; i < nets.length; i++) {
        var n = nets[i];
        h += '<button type="button" class="dk-soc ' + n[3] + '" data-soc="' + n[0] + '"' +
          ' data-i18n-aria="' + n[2] + '" aria-label="' + esc(t(n[2])) + '"' +
          ' title="' + esc(t(n[2])) + '">' + n[1] + "</button>";
      }
      h += '<button type="button" class="dk-soc dk-soc--copy" data-soc="copy"' +
        ' data-i18n-aria="share.copy" aria-label="' + esc(t("share.copy")) + '"' +
        ' title="' + esc(t("share.copy")) + '">' + ic("copy") + "</button>";
      var bar = document.createElement("div");
      bar.id = "dkShareBar";
      bar.className = "dk-sharebar glass";
      bar.setAttribute("role", "toolbar");
      bar.setAttribute("data-i18n-aria", "share.bar_label");
      bar.setAttribute("aria-label", t("share.bar_label"));
      bar.innerHTML = h;
      document.body.appendChild(bar);

      var fab = document.createElement("button");
      fab.id = "dkShareFab";
      fab.type = "button";
      fab.className = "dk-share-fab";
      fab.setAttribute("data-i18n-aria", "share.open");
      fab.setAttribute("aria-label", t("share.open"));
      fab.setAttribute("title", t("share.open"));
      fab.setAttribute("aria-expanded", "false");
      fab.setAttribute("aria-controls", "dkShareBar");
      fab.innerHTML = ic("share");
      document.body.appendChild(fab);

      function closeBar() {
        bar.classList.remove("dk-sharebar--open");
        fab.setAttribute("aria-expanded", "false");
        fab.setAttribute("data-i18n-aria", "share.open");
        fab.setAttribute("aria-label", t("share.open"));
        fab.setAttribute("title", t("share.open"));
      }
      fab.addEventListener("click", function () {
        var open = bar.classList.toggle("dk-sharebar--open");
        fab.setAttribute("aria-expanded", String(open));
        var k = open ? "share.close" : "share.open";
        fab.setAttribute("data-i18n-aria", k);
        fab.setAttribute("aria-label", t(k));
        fab.setAttribute("title", t(k));
      });
      bar.addEventListener("click", function (ev) {
        var el = ev.target;
        var b = (el && el.closest && typeof el.closest === "function") ? el.closest("[data-soc]") : null;
        if (!b) return;
        doShare(b.getAttribute("data-soc"));
        closeBar();
      });
      document.addEventListener("keydown", function (ev) {
        if (ev && ev.key === "Escape") closeBar();
      });
      refreshI18n();
    } catch (e) {}
  }

  /* ================= 10. Modal plumbing ================= */
  function openPopup(html, bind) {
    if (typeof window.DKModal !== "function") return null;
    var m = window.DKModal(html);
    var closed = false;
    function finish() { setTimeout(function () { try { m.remove(); } catch (e) {} }, 320); }
    function close() { if (closed) return; closed = true; try { m.close(); } catch (e) {} finish(); }
    m.open();
    /* DKModal's own close button / overlay-click call its internal close;
       remove the node from the DOM afterwards so re-opens stay fresh. */
    try {
      var x = m.querySelector(".modal__close");
      if (x) x.addEventListener("click", finish);
      m.addEventListener("mousedown", function (ev) { if (ev.target === m) finish(); });
    } catch (e) {}
    refreshI18n();
    try { bind(m, close); } catch (e) {}
    return { el: m, close: close };
  }

  /* ================= 11. Referral modal ================= */
  function shareButtons(link) {
    var text = t("ref.share_text");
    var enc = encodeURIComponent;
    var items = [
      { id: "wa", label: "WhatsApp", url: "https://wa.me/?text=" + enc(text + " " + link) },
      { id: "fb", label: "Facebook", url: "https://www.facebook.com/sharer/sharer.php?u=" + enc(link) },
      { id: "li", label: "LinkedIn", url: "https://www.linkedin.com/sharing/share-offsite/?url=" + enc(link) },
      { id: "x", label: "X", url: "https://x.com/intent/post?text=" + enc(text + " " + link) },
      { id: "tg", label: "Telegram", url: "https://t.me/share/url?url=" + enc(link) + "&text=" + enc(text) }
    ];
    var h = items.map(function (s) {
      return '<button type="button" class="btn btn-ghost btn-sm dk-share-btn" data-share-url="' + esc(s.url) + '">' +
        ic("share") + "<span>" + esc(s.label) + "</span></button>";
    }).join("");
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      h += '<button type="button" class="btn btn-ghost btn-sm dk-share-btn" id="dkNativeShare">' +
        ic("external") + '<span data-i18n="ref.share_native">' + esc(t("ref.share_native")) + "</span></button>";
    }
    return h;
  }
  function histRows(list) {
    if (!list.length) {
      return '<div class="dk-empty" data-i18n="ref.history_empty">' + esc(t("ref.history_empty")) + "</div>";
    }
    return list.map(function (r) {
      return '<div class="dk-hist-row"><span class="dk-code">' + esc(String(r.code).slice(0, 3) + "•••") + "</span>" +
        '<span class="dk-date">' + esc(fmtDate(r.date)) + "</span></div>";
    }).join("");
  }
  function renderReferral() {
    var link = refLink();
    var refs = lsGet("dk_refs", []);
    if (!Array.isArray(refs)) refs = [];
    var by = lsGet("dk_ref_by", []);
    if (!Array.isArray(by)) by = [];
    var h = "";
    h += '<h2 class="dk-mtitle">' + ic("gift") + ' <span data-i18n="ref.title">' + esc(t("ref.title")) + "</span></h2>";
    h += '<p class="dk-msub" data-i18n="ref.subtitle">' + esc(t("ref.subtitle")) + "</p>";
    h += '<div class="dk-coin-hero"><div class="dk-coin-num stat__num">' + refs.length + "</div>" +
      '<div class="dk-coin-cap" data-i18n="ref.your_referrals">' + esc(t("ref.your_referrals")) + "</div>" +
      '<div class="dk-reward" data-i18n="ref.reward_note">' + esc(t("ref.reward_note")) + "</div></div>";
    h += '<div class="field"><label class="label" for="dkRefLink" data-i18n="ref.your_link">' + esc(t("ref.your_link")) + "</label>" +
      '<div class="dk-link-row"><input class="input dk-link-input" id="dkRefLink" dir="ltr" readonly value="' + esc(link) + '">' +
      '<button type="button" class="btn btn-primary btn-sm" id="dkCopyLink">' + ic("copy") +
      ' <span data-i18n="ref.copy_link">' + esc(t("ref.copy_link")) + "</span></button></div></div>";
    h += '<h3 class="dk-h3" data-i18n="ref.share_via">' + esc(t("ref.share_via")) + "</h3>";
    h += '<div class="dk-share-grid">' + shareButtons(link) + "</div>";
    h += '<h3 class="dk-h3" data-i18n="ref.history">' + esc(t("ref.history")) + "</h3>";
    h += '<div class="dk-hist">' + histRows(refs) + "</div>";
    if (by.length) {
      h += '<h3 class="dk-h3" data-i18n="ref.joined_via_title">' + esc(t("ref.joined_via_title")) + "</h3>";
      h += '<div class="dk-hist">' + histRows(by) + "</div>";
    }
    h += '<h3 class="dk-h3" data-i18n="ref.how_title">' + esc(t("ref.how_title")) + "</h3>";
    h += '<ol class="dk-steps">' +
      '<li><strong data-i18n="ref.step1t">' + esc(t("ref.step1t")) + '</strong><span data-i18n="ref.step1d">' + esc(t("ref.step1d")) + "</span></li>" +
      '<li><strong data-i18n="ref.step2t">' + esc(t("ref.step2t")) + '</strong><span data-i18n="ref.step2d">' + esc(t("ref.step2d")) + "</span></li>" +
      '<li><strong data-i18n="ref.step3t">' + esc(t("ref.step3t")) + '</strong><span data-i18n="ref.step3d">' + esc(t("ref.step3d")) + "</span></li>" +
      "</ol>";
    return '<div class="dk-ref">' + h + "</div>";
  }
  function openReferral() {
    var link = refLink();
    openPopup(renderReferral(), function (m) {
      var input = m.querySelector("#dkRefLink");
      var copy = m.querySelector("#dkCopyLink");
      if (input) input.addEventListener("focus", function () { try { input.select(); } catch (e) {} });
      if (copy) copy.addEventListener("click", function () {
        copyText(link, function () { toast(t("ref.copied"), "success"); });
      });
      var btns = m.querySelectorAll("[data-share-url]");
      for (var i = 0; i < btns.length; i++) {
        (function (b) {
          b.addEventListener("click", function () {
            var u = b.getAttribute("data-share-url");
            if (u) { try { window.open(u, "_blank", "noopener,noreferrer"); } catch (e) {} }
          });
        })(btns[i]);
      }
      var native = m.querySelector("#dkNativeShare");
      if (native && typeof navigator !== "undefined" && typeof navigator.share === "function") {
        native.addEventListener("click", function () {
          try {
            navigator.share({ title: t("ref.title"), text: t("ref.share_text"), url: link }).catch(function () {});
          } catch (e) {}
        });
      }
    });
  }

  /* ================= 12. Profile modal ================= */
  function statCell(numHtml, i18nKey) {
    return '<div class="dk-stat"><div class="dk-stat-n">' + numHtml + '</div>' +
      '<div class="dk-stat-l" data-i18n="' + i18nKey + '">' + esc(t(i18nKey)) + "</div></div>";
  }
  function renderProfile() {
    var prof = getProfile();
    var name = String(prof.name || "").trim();
    var email = String(prof.email || "").trim();
    var coins = getCoins();
    var txns = getTxns();
    var tools = lsGet("dk_tools_used", []);
    if (!Array.isArray(tools)) tools = [];
    var refs = lsGet("dk_refs", []);
    if (!Array.isArray(refs)) refs = [];
    var joined = lsGet("dk_joined", "");
    var initial = name ? name.charAt(0).toUpperCase() : "";
    var pkr = coins.toLocaleString("en-PK");
    var usdt = (coins * 0.0036).toFixed(2);

    var h = "";
    h += '<h2 class="dk-mtitle">' + ic("user") + ' <span data-i18n="prof.title">' + esc(t("prof.title")) + "</span></h2>";
    h += '<div class="dk-profile-head"><div class="dk-avatar" aria-hidden="true">' +
      (initial ? esc(initial) : ic("user")) + "</div>" +
      '<div class="dk-profile-id"><div class="dk-pname" id="dkPName">' + esc(name || t("prof.guest")) + "</div>" +
      (email ? '<div class="dk-pemail" id="dkPEmail" dir="ltr">' + esc(email) + "</div>" : "") + "</div></div>";

    h += '<div class="dk-coin-hero"><div class="dk-coin-ic" aria-hidden="true">' + ic("coin") + "</div>" +
      '<div class="dk-coin-num stat__num">' + coins.toLocaleString("en-US") + "</div>" +
      '<div class="dk-coin-cap" data-i18n="prof.coins">' + esc(t("prof.coins")) + "</div>" +
      '<div class="dk-value">Rs ' + esc(pkr) + ' · ≈ $' + esc(usdt) + ' USDT ' +
      '<span class="dk-indic">(<span data-i18n="prof.indicative">' + esc(t("prof.indicative")) + "</span>)</span></div>" +
      '<div class="hint" data-i18n="prof.value_note">' + esc(t("prof.value_note")) + "</div></div>";

    h += '<div class="dk-stat-grid">' +
      statCell('<span class="stat__num">' + tools.length + "</span>", "prof.tools_used") +
      statCell('<span class="stat__num">' + refs.length + "</span>", "prof.referrals") +
      statCell('<span class="stat__num">' + getStreak() + "</span>", "prof.streak") +
      statCell(esc(fmtDate(joined) || "—"), "prof.joined") +
      "</div>";

    h += '<h3 class="dk-h3" data-i18n="prof.history">' + esc(t("prof.history")) + "</h3>";
    if (txns.length) {
      h += '<div class="dk-hist">' + txns.map(function (x) {
        var d = Number(x.delta) || 0;
        var cls = d >= 0 ? "dk-pos" : "dk-neg";
        var sign = d >= 0 ? "+" : "−";
        return '<div class="dk-hist-row"><span class="dk-txn-d ' + cls + '">' + sign + Math.abs(d) + "</span>" +
          '<span class="dk-txn-r">' + esc(t(x.reason) || String(x.reason || "")) + "</span>" +
          '<span class="dk-date">' + esc(fmtDate(x.date)) + "</span></div>";
      }).join("") + "</div>";
    } else {
      h += '<div class="dk-empty" data-i18n="prof.history_empty">' + esc(t("prof.history_empty")) + "</div>";
    }

    h += '<h3 class="dk-h3" data-i18n="prof.edit_title">' + esc(t("prof.edit_title")) + "</h3>";
    h += '<form id="dkProfForm" novalidate>' +
      '<div class="field"><label class="label" for="dkPNameIn" data-i18n="prof.name">' + esc(t("prof.name")) + "</label>" +
      '<input class="input" id="dkPNameIn" name="name" maxlength="80" autocomplete="name" value="' + esc(name) + '"' +
      ' data-i18n-ph="prof.name_ph" placeholder="' + esc(t("prof.name_ph")) + '"></div>' +
      '<div class="field"><label class="label" for="dkPEmailIn" data-i18n="prof.email">' + esc(t("prof.email")) + "</label>" +
      '<input class="input" id="dkPEmailIn" name="email" type="email" dir="ltr" maxlength="120" autocomplete="email" value="' + esc(email) + '"' +
      ' data-i18n-ph="prof.email_ph" placeholder="' + esc(t("prof.email_ph")) + '"></div>' +
      '<div class="error-msg" id="dkProfErr" role="alert" hidden></div>' +
      '<button class="btn btn-primary" type="submit"><span data-i18n="prof.save">' + esc(t("prof.save")) + "</span></button>" +
      "</form>";
    return '<div class="dk-prof">' + h + "</div>";
  }
  function openProfile() {
    openPopup(renderProfile(), function (m) {
      var form = m.querySelector("#dkProfForm");
      if (!form) return;
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var nameEl = m.querySelector("#dkPNameIn");
        var emailEl = m.querySelector("#dkPEmailIn");
        var errEl = m.querySelector("#dkProfErr");
        var name = nameEl ? String(nameEl.value || "").trim().slice(0, 80) : "";
        var email = emailEl ? String(emailEl.value || "").trim().slice(0, 120) : "";
        if (errEl) { errEl.hidden = true; errEl.textContent = ""; }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          if (errEl) { errEl.textContent = t("prof.email_invalid"); errEl.hidden = false; }
          if (emailEl) emailEl.setAttribute("aria-invalid", "true");
          return;
        }
        if (emailEl) emailEl.removeAttribute("aria-invalid");
        lsSet("dk_profile", { name: name, email: email });
        refreshProfAvatar(); /* navbar avatar now shows the saved initial */
        var pName = m.querySelector("#dkPName");
        if (pName) pName.textContent = name || t("prof.guest");
        var avatar = m.querySelector(".dk-avatar");
        if (avatar) {
          if (name) { avatar.textContent = name.charAt(0).toUpperCase(); }
          else { avatar.innerHTML = ic("user"); }
        }
        toast(t("prof.saved"), "success");
      });
    });
  }

  /* ================= 13. Boot ================= */
  function registerI18n() {
    try {
      if (window.DKI18N && typeof window.DKI18N.add === "function") {
        window.DKI18N.add("en", W6_EN);
        window.DKI18N.add("ur", W6_UR);
      }
    } catch (e) {}
    /* Exposed so the Phase-3 merge can register later if this script ran first. */
    try { window.DKW6I18N = { en: W6_EN, ur: W6_UR }; } catch (e) {}
  }
  /* Bind click handler to the profile button rendered by renderNav().
   * The button HTML is now part of renderNav() output (not injected). */
  function bindProfBtn() {
    try {
      var b = document.getElementById("dkProfBtn");
      if (!b || b.dataset.pbound) return;
      b.dataset.pbound = "1";
      b.addEventListener("click", function (e) {
        e.preventDefault();
        openProfile();
      });
      refreshProfAvatar();
      emitCoins();
    } catch (e) {}
  }
  function boot() {
    registerI18n();
    getUid();          /* dk_uid — generate once */
    ensureCoins();     /* dk_joined, dk_coins, +10 welcome bonus (once) */
    updateStreak();    /* dk_streak — consecutive-day counter */
    captureRef();      /* ?ref=CODE → dk_ref_by / dk_referred_by + toast (+5 coins) */
    bindProfBtn();     /* Attach click handler to profile btn in renderNav HTML */
    injectShareBar();  /* floating social share sidebar + mobile FAB */
    /* Retry binding after renderNav populates the navbar */
    try { setTimeout(bindProfBtn, 500); setTimeout(bindProfBtn, 1500); } catch (e) {}
  }

  /* Cross-tab: keep the coin pill fresh when another tab changes the balance. */
  try {
    window.addEventListener("storage", function (ev) {
      if (ev && ev.key === "dk_coins") emitCoins();
    });
  } catch (e) {}

  /* Public API surface (also useful for Phase-3 verification). */
  try {
    window.DKRef = {
      uid: getUid,
      link: refLink,
      count: function () { var a = lsGet("dk_refs", []); return Array.isArray(a) ? a.length : 0; },
      refs: function () { var a = lsGet("dk_refs", []); return Array.isArray(a) ? a.slice() : []; },
      referredBy: function () { var a = lsGet("dk_ref_by", []); return Array.isArray(a) ? a.slice() : []; }
    };
    /* DKCoins removed (V3 audit): dead code, 0 callers. Live system is DKCredits (Firestore). */
    window.DKW6 = { renderReferral: renderReferral, renderProfile: renderProfile, shareUrl: shareUrl };
  } catch (e) {}

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

/* Worker 4: bottom nav + empty states + optimistic UI */
/* DoKit Worker 4 — tool pages upgrade pack (points 22, 29, 55).
   Self-contained IIFE; coordinator merges this into js/ui.js.
   Does NOT touch tool logic: additive DOM decoration only. */
(function () {
  "use strict";
  if (window.__w4init) { return; }
  window.__w4init = true;

  function t(key, fb) {
    try {
      if (window.DKI18N && typeof window.DKI18N.t === "function") {
        var v = window.DKI18N.t(key);
        if (v && v !== key) { return v; }
      }
    } catch (e) { /* noop */ }
    return fb;
  }

  /* Base-aware URL: prefers window.DKU (ui.js), falls back to relative paths
     derived from page depth (/tools/<tool>/ is 2 levels deep). */
  function u(path) {
    try {
      if (typeof window.DKU === "function") { return window.DKU(path); }
    } catch (e) { /* noop */ }
    var p = String(location.pathname || "/").replace(/index\.html$/, "");
    var depth = (p.match(/\//g) || []).length; /* "/tools/x/" -> 3 */
    var rel = depth > 2 ? "../../" : "./";
    if (path === "/") { return rel; }
    return rel + String(path).replace(/^\//, "");
  }

  /* ---------- (55) Mobile bottom nav: Home / Tools / Search ---------- */
  function buildBottomNav() {
    if (document.querySelector(".dk-bottomnav")) { return; }
    var nav = document.createElement("nav");
    nav.className = "dk-bottomnav";
    nav.setAttribute("aria-label", t("tools2.bnav_label", "Quick navigation"));
    var here = String(location.pathname || "");
    var onTools = /\/tools\//.test(here);
    var onHome = /^\/(?:index\.html)?$/.test(here);
    function item(path, icon, key, fb, active) {
      var a = document.createElement("a");
      a.href = u(path);
      var ic = document.createElement("span");
      ic.className = "dk-bn-ic";
      ic.setAttribute("aria-hidden", "true");
      ic.textContent = icon;
      var lb = document.createElement("span");
      lb.textContent = t(key, fb);
      a.appendChild(ic);
      a.appendChild(lb);
      if (active) { a.setAttribute("aria-current", "page"); }
      return a;
    }
    nav.appendChild(item("/", "\uD83C\uDFE0", "tools2.bnav_home", "Home", onHome && !onTools));
    nav.appendChild(item("/tools/", "\uD83E\uDDF0", "tools2.bnav_tools", "Tools", onTools));
    var search = item("/tools/#w4search", "\uD83D\uDD0D", "tools2.bnav_search", "Search", false);
    nav.appendChild(search);
    document.body.appendChild(nav);
  }

  /* On the tools index: focus the search box when arriving via #w4search. */
  function focusSearch() {
    if (location.hash !== "#w4search") { return; }
    var box = document.getElementById("toolSearch");
    if (box) {
      setTimeout(function () {
        try { box.scrollIntoView({ block: "center" }); } catch (e) { /* noop */ }
        box.focus({ preventScroll: true });
      }, 350);
    }
  }

  /* ---------- (22) Empty-state decorator ----------
     Upgrades static AND tool.js-generated ".tempty" blocks to the
     .empty-state__* BEM structure, and adds a working action button. */
  function upgradeEmpty(el) {
    if (!el || el.dataset.w4done) { return; }
    el.dataset.w4done = "1";
    el.classList.add("empty-state");
    var ic = el.querySelector(".empty-icon");
    if (ic) { ic.classList.add("empty-state__icon"); }
    var ps = el.querySelectorAll(":scope > p");
    var textP = null, i, p;
    for (i = 0; i < ps.length; i++) {
      p = ps[i];
      if (p.classList.contains("empty-state__title") ||
          p.classList.contains("empty-state__action") ||
          p.classList.contains("empty-state__text")) { continue; }
      textP = textP || p;
    }
    if (textP && !el.querySelector(".empty-state__title")) {
      var title = document.createElement("p");
      title.className = "empty-state__title";
      title.textContent = t("tools2.empty_title", "Nothing here yet");
      textP.parentNode.insertBefore(title, textP);
    }
    if (textP) { textP.classList.add("empty-state__text"); }
    if (!el.querySelector(".empty-state__action") && document.getElementById("fileInput")) {
      var act = document.createElement("p");
      act.className = "empty-state__action";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tbtn tbtn-primary tbtn-sm";
      btn.setAttribute("data-empty-browse", "");
      btn.textContent = t("tools2.empty_add_images", "Add images");
      act.appendChild(btn);
      el.appendChild(act);
    }
  }

  function scanEmpty(root) {
    var list = (root === document ? document : root).querySelectorAll ?
      root.querySelectorAll(".tempty:not([data-w4done])") : [];
    for (var i = 0; i < list.length; i++) { upgradeEmpty(list[i]); }
  }

  /* ---------- (29) Optimistic UI: instant pressed feedback ----------
     Visual-only (no disable): tool.js keeps full control of its buttons. */
  var PRESS_SEL = "#processBtn,#applyAllBtn,#downloadNowBtn,#zipBtn,#copyBtn," +
    "#cropApply,#bgRemoveBtn,#enhanceBtn,#fApply,#boardAutoCrop,#boardAutoBg,#boardAutoEnhance";
  document.addEventListener("click", function (e) {
    var browse = e.target && e.target.closest ? e.target.closest("[data-empty-browse]") : null;
    if (browse) {
      var fi = document.getElementById("fileInput");
      if (fi) { fi.click(); }
      return;
    }
    var btn = e.target && e.target.closest ? e.target.closest(PRESS_SEL) : null;
    if (btn && !btn.disabled && !btn.classList.contains("is-working")) {
      btn.classList.add("is-working");
      setTimeout(function () { btn.classList.remove("is-working"); }, 1600);
    }
  });

  function init() {
    buildBottomNav();
    focusSearch();
    scanEmpty(document);
    if (typeof MutationObserver !== "undefined" && document.body) {
      var mo = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var nodes = muts[i].addedNodes;
          for (var j = 0; j < nodes.length; j++) {
            var n = nodes[j];
            if (!n || n.nodeType !== 1) { continue; }
            if (n.classList && n.classList.contains("tempty")) { upgradeEmpty(n); }
            if (n.querySelectorAll) {
              var inner = n.querySelectorAll(".tempty:not([data-w4done])");
              for (var k = 0; k < inner.length; k++) { upgradeEmpty(inner[k]); }
            }
          }
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* SaaS: sample + checklist */
/* SaaS: sample files + 3-step checklist (shared) */
(function(){
  "use strict";
  function t(k){ return (window.DKI18N&&window.DKI18N.t(k))||k; }
  function sampleImage(){
    var c=document.createElement('canvas'); c.width=800; c.height=600;
    var x=c.getContext('2d'), g=x.createLinearGradient(0,0,800,600);
    g.addColorStop(0,'#6C4CF1'); g.addColorStop(1,'#FF8A5C');
    x.fillStyle=g; x.fillRect(0,0,800,600);
    x.fillStyle='rgba(255,255,255,.92)'; x.textAlign='center';
    x.font='bold 72px sans-serif'; x.fillText('Sample',400,290);
    x.font='32px sans-serif'; x.fillText('DoKit',400,350);
    return new Promise(function(res){ c.toBlob(function(b){ res(new File([b],'sample.png',{type:'image/png'})); },'image/png'); });
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest?e.target.closest('[data-sample]'):null;
    if(!b) return;
    var kind=b.getAttribute('data-sample');
    if(kind==='image'){
      var input=document.querySelector('input[type="file"]');
      if(!input) return;
      b.disabled=true;
      sampleImage().then(function(f){
        try{
          var dt=new DataTransfer(); dt.items.add(f); input.files=dt.files;
          input.dispatchEvent(new Event('change',{bubbles:true}));
        }catch(err){ /* older browsers */ }
        b.disabled=false;
      });
    }else if(kind==='text'){
      var ta=document.querySelector('textarea#text');
      if(ta){ ta.value=t('saas.sample_text'); ta.dispatchEvent(new Event('input',{bubbles:true})); ta.focus(); }
    }
  });
  /* 3-step checklist */
  document.querySelectorAll('[data-saas-steps]').forEach(function(box){
    var x=box.querySelector('.saas-steps-x');
    try{ if(localStorage.getItem('dk_steps_seen')){ box.hidden=true; return; } }catch(e){}
    if(x) x.addEventListener('click',function(){ box.hidden=true; try{localStorage.setItem('dk_steps_seen','1');}catch(e){} });
    var steps=box.querySelectorAll('.saas-step');
    function done(n){ if(steps[n]) steps[n].classList.add('done'); }
    document.addEventListener('change',function(e){
      var el=e.target;
      if(el.matches&&el.matches('input[type="file"]')&&el.files&&el.files.length) done(0);
      else if(el.matches&&el.matches('.tinput,.tselect,input[type="range"],select')) done(1);
    });
    document.addEventListener('input',function(e){
      var el=e.target;
      if(el.matches&&el.matches('textarea#text')&&el.value.trim()) done(0);
    });
    document.addEventListener('click',function(e){
      var el=e.target.closest?e.target.closest('button,a'):null;
      if(el&&(el.id==='zipBtn'||/download|process/i.test(el.id||'')||/download|process/i.test(el.textContent||''))) done(2);
    });
  });
})();
/* DoKit Visual Polish Pack loader (appended 2026-10-07).
 * Loads css/polish.css + js/polish.js on every page that includes ui.js.
 * Additive only: if files fail to load, the site works exactly as before. */
;(function () {
  try {
    var U = (typeof window.DKU === "function") ? window.DKU : function (p) { return p; };
    if (!document.querySelector('link[data-dk-polish]')) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = U("/css/polish.css");
      link.setAttribute("data-dk-polish", "1");
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-dk-polish]')) {
      var s = document.createElement("script");
      s.src = U("/js/polish.js");
      s.defer = true;
      s.setAttribute("data-dk-polish", "1");
      document.head.appendChild(s);
    }
  } catch (e) { /* polish is optional */ }
})();
