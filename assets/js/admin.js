/* DoKit — Admin tab switching (Phase 2b).
 * Buttons carry data-atab, panels carry data-apanel with the same key.
 * Clicking a button shows its panel and marks it active; nothing else
 * happens (admin data itself arrives with the Phase 3 backend). */
(function () {
  'use strict';
  var btns = document.querySelectorAll('[data-atab]');
  if (!btns.length) { return; }
  function show(key) {
    btns.forEach(function (b) {
      var on = b.getAttribute('data-atab') === key;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('[data-apanel]').forEach(function (p) {
      p.classList.toggle('open',
        p.getAttribute('data-apanel') === key);
    });
  }
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      show(b.getAttribute('data-atab'));
    });
  });
  show(btns[0].getAttribute('data-atab')); // first tab open by default
})();
