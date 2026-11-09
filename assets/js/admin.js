/* DoKit — Admin tab switching (Phase 2b).
 * Buttons carry data-atab, panels carry data-apanel with the same key.
 * Clicking a button shows its panel and marks it active; nothing else
 * happens (admin data itself arrives with the Phase 3 backend).
 * Phase F F04 (rec 04): a sliding indicator bar tracks the active tab.
 * The bar is one absolutely-positioned span inside .tabs (see the
 * .tab-indicator rule in style.css); show() measures the active button
 * and moves it with transform (GPU-cheap, no layout). The .tabs row is
 * a horizontal scroller (flex-wrap:nowrap + overflow-x:auto in CSS),
 * so the bar is always on the same single row as the buttons; the
 * active button is scrolled into view. The .active pill remains the
 * no-JS / reduced-motion fallback — the global reduced-motion rule
 * kills the slide and the bar simply jumps. */
(function () {
  'use strict';
  var btns = document.querySelectorAll('[data-atab]');
  if (!btns.length) { return; }
  var tabsRow = btns[0].parentNode;
  var bar = document.createElement('span');
  bar.className = 'tab-indicator';
  bar.setAttribute('aria-hidden', 'true');
  tabsRow.appendChild(bar);
  function moveBar(btn) {
    if (!btn) { bar.style.width = '0px'; return; }
    bar.style.width = btn.offsetWidth + 'px';
    bar.style.transform = 'translateX(' + btn.offsetLeft + 'px)';
    try { btn.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* old browsers: no scroll, bar still moves */ }
  }
  function show(key) {
    var activeBtn = null;
    btns.forEach(function (b) {
      var on = b.getAttribute('data-atab') === key;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      // F36 (rec 36): roving tabindex — only the active tab is in
      // the Tab order; the rest are reached with arrow keys.
      b.setAttribute('tabindex', on ? '0' : '-1');
      if (on) { activeBtn = b; }
    });
    document.querySelectorAll('[data-apanel]').forEach(function (p) {
      p.classList.toggle('open',
        p.getAttribute('data-apanel') === key);
    });
    moveBar(activeBtn);
  }
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      show(b.getAttribute('data-atab'));
    });
  });
  /* F36 (rec 36): arrow-key tab navigation (ARIA tabs pattern,
   * automatic activation — moving to a tab opens its panel, so
   * keyboard users never need a separate Enter). Home/End jump
   * to the first/last tab. */
  tabsRow.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') { return; }
    var at = -1;
    btns.forEach(function (b, idx) { if (b === document.activeElement) { at = idx; } });
    if (at === -1) { return; }
    var next = at;
    if (e.key === 'ArrowRight') { next = (at + 1) % btns.length; }
    else if (e.key === 'ArrowLeft') { next = (at - 1 + btns.length) % btns.length; }
    else if (e.key === 'Home') { next = 0; }
    else if (e.key === 'End') { next = btns.length - 1; }
    e.preventDefault();
    show(btns[next].getAttribute('data-atab'));
    btns[next].focus();
  });
  /* Re-measure after layout settles (fonts/i18n can change button
   * widths after first paint) and on resize. */
  window.addEventListener('resize', function () {
    var active = document.querySelector('[data-atab].active');
    moveBar(active);
  });
  show(btns[0].getAttribute('data-atab')); // first tab open by default
  window.addEventListener('load', function () {
    var active = document.querySelector('[data-atab].active');
    moveBar(active);
  });
})();
