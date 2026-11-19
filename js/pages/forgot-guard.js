/* Forgot-password early-click guard — flat login page (Nov 2026).
 * Loaded as a classic (no defer, no async) same-origin script in <head>,
 * immediately after the CSP <meta> in account/login.html, so it runs
 * before the body is parsed and catches clicks on #forgotLink from the
 * earliest possible moment. The link has no handler until login.js binds
 * one inside its DOMContentLoaded listener, so a click in that window was
 * silently ignored. This listener shows visible feedback instead
 * ("still loading…", or the network error once firebase.js reports the
 * SDK failed via window.__dkaSdkFailed). It NEVER disables the button,
 * so nothing can ever be left permanently disabled, and once the real
 * handler is bound (forgotLink.dataset.dka, set by login.js at bind time)
 * it becomes a no-op and the real handler owns the click.
 * Delegation (one document-level listener) is used because the link does
 * not exist yet when this runs; #err-general is looked up at click time
 * for the same reason. A stale #err-email message is cleared when showing
 * feedback, mirroring what the real handler does on entry.
 * English text is deliberate: i18n has not loaded yet at parse time,
 * exactly like the directory guard. Queue-and-replay was considered and
 * rejected: replaying a send after binding risks double-sends, and the
 * handler has no double-click guard.
 * No inline script is used here: the flat page's CSP (script-src 'self'
 * …) refuses inline scripts, so this guard lives in an external file. */
(function () {
  document.addEventListener('click', function (ev) {
    var b = (ev.target && ev.target.closest) ? ev.target.closest('#forgotLink') : null;
    if (!b) return; /* not the forgot link */
    if (b.dataset.dka) return; /* real handler owns the click once bound */
    ev.preventDefault();
    var e = document.getElementById('err-general');
    if (!e) return;
    var em = document.getElementById('err-email');
    if (em) em.textContent = '';
    e.hidden = false;
    /* NOTE: do NOT touch e.className here. On this page #err-general gets
     * its styling from .form-error (css/auth.css), and the .note/.err
     * classes the directory guard uses are not loaded on this page — so
     * replacing the class would strip the red error styling permanently,
     * because the real handler never restores it. textContent alone matches
     * exactly what the real handler does on this page. */
    if (window.__dkaSdkFailed) {
      e.textContent = 'Network error. Check your connection and try again.';
    } else {
      e.textContent = 'Sign-in is still loading. Please wait a moment and try again.';
    }
  });
})();
