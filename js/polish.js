/* DoKit — Visual Polish Pack (js/polish.js)
 * Interactions for the 50 design ideas. Vanilla JS, no dependencies,
 * CSP-safe (no eval, no inline handlers). All features are defensive:
 * each init checks for its targets and bails silently when absent.
 * Respects prefers-reduced-motion and disables heavy effects on touch.
 */
(function () {
  "use strict";

  var reducedMotion = false;
  try {
    reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}
  var finePointer = false;
  try {
    finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  } catch (e) {}

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  /* ============ 6. Typewriter on hero headline ============ */
  function initTypewriter() {
    if (reducedMotion) return;
    var els = document.querySelectorAll("[data-typewriter]");
    if (!els.length) return;
    els.forEach(function (el) {
      if (el.dataset.twDone) return;
      el.dataset.twDone = "1";
      var full = el.textContent;
      el.textContent = "";
      el.classList.add("typewriter");
      var caret = document.createElement("span");
      caret.className = "typewriter-caret";
      caret.setAttribute("aria-hidden", "true");
      el.appendChild(caret);
      var i = 0;
      var speed = parseInt(el.getAttribute("data-tw-speed"), 10) || 45;
      (function tick() {
        if (i < full.length) {
          // Keep caret last: insert text before it.
          caret.before(document.createTextNode(full.charAt(i)));
          i++;
          setTimeout(tick, speed + Math.random() * 40);
        } else {
          setTimeout(function () { caret.style.display = "none"; }, 2500);
        }
      })();
    });
  }

  /* ============ 7. Scroll reveal (supplements .reveal CSS fallback) ============ */
  function initReveal() {
    var els = document.querySelectorAll(".reveal:not(.visible):not(.in-view)");
    if (!els.length) return;
    if (reducedMotion || !("IntersectionObserver" in window)) {
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
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    els.forEach(function (el, idx) {
      if (!el.style.getPropertyValue("--reveal-delay")) {
        el.style.setProperty("--reveal-delay", Math.min(idx % 6, 5) * 70 + "ms");
      }
      io.observe(el);
    });
  }

  /* ============ 9. Confetti burst (pure canvas, no dependency) ============ */
  var confettiCanvas = null, confettiCtx = null, confettiParts = [], confettiRAF = 0;
  function confettiBurst(x, y, count) {
    if (reducedMotion) return;
    try {
      if (!confettiCanvas) {
        confettiCanvas = document.createElement("canvas");
        confettiCanvas.id = "dk-confetti";
        confettiCanvas.setAttribute("aria-hidden", "true");
        document.body.appendChild(confettiCanvas);
        confettiCtx = confettiCanvas.getContext("2d");
      }
      confettiCanvas.width = window.innerWidth;
      confettiCanvas.height = window.innerHeight;
      var colors = ["#6C4CF1", "#FFC531", "#ec4899", "#2FA36B", "#2669B8", "#f97316"];
      for (var i = 0; i < (count || 60); i++) {
        confettiParts.push({
          x: x, y: y,
          vx: (Math.random() - 0.5) * 11,
          vy: Math.random() * -9 - 3,
          s: Math.random() * 7 + 4,
          r: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.3,
          c: colors[(Math.random() * colors.length) | 0],
          life: 1
        });
      }
      if (!confettiRAF) confettiLoop();
    } catch (e) {}
  }
  function confettiLoop() {
    if (!confettiCtx) { confettiRAF = 0; return; }
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiParts = confettiParts.filter(function (p) { return p.life > 0 && p.y < confettiCanvas.height + 30; });
    if (!confettiParts.length) {
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      confettiRAF = 0;
      return;
    }
    confettiParts.forEach(function (p) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.32; p.vx *= 0.99; p.r += p.vr; p.life -= 0.008;
      confettiCtx.save();
      confettiCtx.globalAlpha = Math.max(p.life, 0);
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.r);
      confettiCtx.fillStyle = p.c;
      confettiCtx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.62);
      confettiCtx.restore();
    });
    confettiRAF = requestAnimationFrame(confettiLoop);
  }
  // Public hook: window.DKConfetti.burst(x, y, n). Auto-burst near coin badge.
  function initConfettiHook() {
    window.DKConfetti = { burst: confettiBurst };
    document.addEventListener("dk:coins-earned", function (ev) {
      var d = ev && ev.detail ? ev.detail : {};
      var n = d.count || 40;
      var badge = document.getElementById("dkCoinBadge") || document.querySelector(".dk-coinbadge");
      var x = window.innerWidth / 2, y = window.innerHeight * 0.3;
      if (badge) {
        var r = badge.getBoundingClientRect();
        x = r.left + r.width / 2; y = r.top + r.height / 2;
      }
      confettiBurst(x, y, n);
    });
  }

  /* ============ 21. Cursor glow (desktop only) ============ */
  function initCursorGlow() {
    if (!finePointer || reducedMotion) return;
    var glow = document.getElementById("cursor-glow");
    if (!glow) {
      glow = document.createElement("div");
      glow.id = "cursor-glow";
      glow.setAttribute("aria-hidden", "true");
      document.body.appendChild(glow);
    }
    var tx = 0, ty = 0, x = 0, y = 0, shown = false, raf = 0;
    function loop() {
      x += (tx - x) * 0.12; y += (ty - y) * 0.12;
      glow.style.transform = "translate(" + x + "px," + y + "px)";
      if (Math.abs(tx - x) > 0.5 || Math.abs(ty - y) > 0.5 || !shown) raf = requestAnimationFrame(loop);
      else raf = 0;
    }
    document.addEventListener("mousemove", function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!shown) { shown = true; glow.style.opacity = "1"; }
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    document.addEventListener("mouseleave", function () {
      shown = false; glow.style.opacity = "0";
    });
  }

  /* ============ 23. Magnetic buttons (desktop only) ============ */
  function initMagnetic() {
    if (!finePointer || reducedMotion) return;
    document.querySelectorAll(".magnetic, .btn-glow").forEach(function (btn) {
      if (btn.dataset.magDone) return;
      btn.dataset.magDone = "1";
      btn.classList.add("magnetic");
      btn.addEventListener("mousemove", function (e) {
        var r = btn.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        btn.style.transform = "translate(" + (dx * 0.12).toFixed(1) + "px," + (dy * 0.12).toFixed(1) + "px)";
      });
      btn.addEventListener("mouseleave", function () { btn.style.transform = ""; });
    });
  }

  /* ============ 24. Card 3D tilt (desktop only) ============ */
  function initTilt() {
    if (!finePointer || reducedMotion) return;
    document.querySelectorAll(".tilt, .tool-card").forEach(function (card) {
      if (card.dataset.tiltDone) return;
      card.dataset.tiltDone = "1";
      card.classList.add("tilt");
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = "perspective(800px) rotateY(" + (px * 7).toFixed(2) + "deg) rotateX(" + (-py * 7).toFixed(2) + "deg) translateY(-4px)";
      });
      card.addEventListener("mouseleave", function () { card.style.transform = ""; });
    });
  }

  /* ============ 28. Parallax hero ============ */
  function initParallax() {
    if (reducedMotion) return;
    var els = document.querySelectorAll("[data-parallax]");
    if (!els.length) return;
    var ticking = false;
    function update() {
      var sy = window.scrollY || window.pageYOffset;
      els.forEach(function (el) {
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0.25;
        el.style.transform = "translateY(" + (sy * speed).toFixed(1) + "px)";
      });
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ============ 30. Scroll progress bar ============ */
  function initScrollProgress() {
    var bar = document.getElementById("scroll-progress");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "scroll-progress";
      bar.setAttribute("aria-hidden", "true");
      document.body.appendChild(bar);
    }
    var ticking = false;
    function update() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
      bar.style.width = pct.toFixed(2) + "%";
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ============ 32. Click ripple ============ */
  function initRipple() {
    if (reducedMotion) return;
    document.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest(".btn, .ripple") : null;
      if (!btn) return;
      var r = btn.getBoundingClientRect();
      var d = Math.max(r.width, r.height);
      var ink = document.createElement("span");
      ink.className = "ripple-ink";
      ink.setAttribute("aria-hidden", "true");
      ink.style.width = ink.style.height = d + "px";
      ink.style.left = (e.clientX - r.left - d / 2) + "px";
      ink.style.top = (e.clientY - r.top - d / 2) + "px";
      // Ensure positioning context without breaking layout.
      var pos = window.getComputedStyle(btn).position;
      if (pos === "static") btn.style.position = "relative";
      if (window.getComputedStyle(btn).overflow === "visible") btn.style.overflow = "hidden";
      btn.appendChild(ink);
      setTimeout(function () { ink.remove(); }, 650);
    });
  }

  /* ============ 38. Copy button feedback ============ */
  function initCopyFeedback() {
    document.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("[data-copy]") : null;
      if (!btn || btn.dataset.copyDone === "1") return;
      var text = btn.getAttribute("data-copy") || "";
      function done() {
        btn.dataset.copyDone = "1";
        var orig = btn.innerHTML;
        btn.classList.add("copied");
        // Use textContent-safe label swap: keep it simple and XSS-safe.
        btn.setAttribute("data-orig", orig);
        btn.innerHTML = "";
        var tick = document.createElement("span");
        tick.setAttribute("aria-hidden", "true");
        tick.textContent = "✓ ";
        var label = document.createElement("span");
        label.textContent = "Copied!";
        btn.appendChild(tick); btn.appendChild(label);
        setTimeout(function () {
          btn.innerHTML = btn.getAttribute("data-orig") || "";
          btn.classList.remove("copied");
          btn.dataset.copyDone = "";
        }, 1600);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
      } else {
        var ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); } catch (err) {}
        ta.remove(); done();
      }
    });
  }

  /* ============ 42. Back to top ============ */
  function initBackToTop() {
    var btn = document.getElementById("back-to-top");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "back-to-top";
      btn.setAttribute("aria-label", "Back to top");
      btn.textContent = "↑";
      document.body.appendChild(btn);
    }
    var ticking = false;
    function update() {
      var show = (window.scrollY || window.pageYOffset) > 600;
      btn.classList.toggle("show", show);
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    });
    update();
  }

  /* ============ 43. Sticky nav shrink ============ */
  function initNavShrink() {
    var header = document.querySelector(".site-header");
    if (!header) return;
    var ticking = false;
    function update() {
      header.classList.toggle("shrunk", (window.scrollY || window.pageYOffset) > 40);
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ============ 45. Testimonial auto-slider ============ */
  function initTestimonialSlider() {
    document.querySelectorAll(".testimonial-slider").forEach(function (slider) {
      if (slider.dataset.tsDone) return;
      slider.dataset.tsDone = "1";
      var track = slider.querySelector(".testimonial-track");
      var slides = track ? track.querySelectorAll(".testimonial-slide") : [];
      if (!track || slides.length < 2) return;
      var dotsWrap = document.createElement("div");
      dotsWrap.className = "testimonial-dots";
      dotsWrap.setAttribute("role", "tablist");
      var idx = 0, timer = 0;
      slides.forEach(function (_, i) {
        var dot = document.createElement("button");
        dot.setAttribute("aria-label", "Go to testimonial " + (i + 1));
        dot.setAttribute("role", "tab");
        if (i === 0) dot.classList.add("active");
        dot.addEventListener("click", function () { go(i); restart(); });
        dotsWrap.appendChild(dot);
      });
      slider.appendChild(dotsWrap);
      var dots = dotsWrap.querySelectorAll("button");
      var isRTL = false;
      try { isRTL = document.documentElement.getAttribute("dir") === "rtl"; } catch (e) {}
      function go(i) {
        idx = (i + slides.length) % slides.length;
        track.style.transform = "translateX(" + (isRTL ? "" : "-") + idx * 100 + "%)";
        dots.forEach(function (d, j) {
          d.classList.toggle("active", j === idx);
          d.setAttribute("aria-selected", j === idx ? "true" : "false");
        });
      }
      function restart() {
        if (timer) clearInterval(timer);
        if (!reducedMotion) timer = setInterval(function () { go(idx + 1); }, 6000);
      }
      slider.addEventListener("mouseenter", function () { if (timer) clearInterval(timer); });
      slider.addEventListener("mouseleave", restart);
      // Touch swipe
      var sx = 0;
      track.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
      track.addEventListener("touchend", function (e) {
        var dx = e.changedTouches[0].clientX - sx;
        if (Math.abs(dx) > 40) { go(idx + (dx < 0 ? 1 : -1)); restart(); }
      }, { passive: true });
      restart();
    });
  }

  /* ============ 46. Pricing monthly/yearly toggle ============ */
  function initPricingToggle() {
    document.querySelectorAll("[data-pricing-toggle]").forEach(function (toggle) {
      if (toggle.dataset.ptDone) return;
      toggle.dataset.ptDone = "1";
      var input = toggle.querySelector('input[type="checkbox"]');
      var root = document.querySelector(toggle.getAttribute("data-pricing-toggle")) || document;
      function apply() {
        var annual = input ? input.checked : toggle.getAttribute("aria-pressed") === "true";
        root.classList.toggle("pricing-annual", annual);
      }
      if (input) input.addEventListener("change", apply);
      else toggle.addEventListener("click", function () {
        toggle.setAttribute("aria-pressed", toggle.getAttribute("aria-pressed") === "true" ? "false" : "true");
        apply();
      });
      apply();
    });
  }

  /* ============ 47. Search term highlight ============ */
  function highlightSearchTerms(container, query) {
    if (!container || !query || query.length < 2) return;
    var terms = query.trim().split(/\s+/).filter(function (t) { return t.length >= 2; });
    if (!terms.length) return;
    // Clear previous highlights first.
    container.querySelectorAll("mark.search-hit").forEach(function (m) {
      var parent = m.parentNode;
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    });
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = node.parentNode;
        if (!p || p.closest("script,style,mark,input,textarea")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    var esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); };
    var re = new RegExp("(" + terms.map(esc).join("|") + ")", "gi");
    nodes.forEach(function (node) {
      if (!re.test(node.nodeValue)) return;
      re.lastIndex = 0;
      var frag = document.createDocumentFragment();
      var last = 0, m;
      while ((m = re.exec(node.nodeValue))) {
        frag.appendChild(document.createTextNode(node.nodeValue.slice(last, m.index)));
        var mark = document.createElement("mark");
        mark.className = "search-hit";
        mark.textContent = m[0];
        frag.appendChild(mark);
        last = m.index + m[0].length;
      }
      frag.appendChild(document.createTextNode(node.nodeValue.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }
  function initSearchHighlight() {
    document.querySelectorAll("[data-search-highlight]").forEach(function (input) {
      if (input.dataset.shDone) return;
      input.dataset.shDone = "1";
      var target = document.querySelector(input.getAttribute("data-search-highlight"));
      if (!target) return;
      var t = 0;
      input.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(function () { highlightSearchTerms(target, input.value); }, 200);
      });
    });
  }

  /* ============ Boot ============ */
  function boot() {
    try {
      initTypewriter();
      initReveal();
      initConfettiHook();
      initCursorGlow();
      initMagnetic();
      initTilt();
      initParallax();
      initScrollProgress();
      initRipple();
      initCopyFeedback();
      initBackToTop();
      initNavShrink();
      initTestimonialSlider();
      initPricingToggle();
      initSearchHighlight();
    } catch (e) { /* polish is progressive enhancement; never break the page */ }
  }

  // Re-run reveal for dynamically injected content (SPA-ish page scripts).
  function rebind() {
    try { initReveal(); initMagnetic(); initTilt(); } catch (e) {}
  }
  window.DKPolish = { rebind: rebind, confetti: confettiBurst, highlight: highlightSearchTerms };

  onReady(boot);
})();
