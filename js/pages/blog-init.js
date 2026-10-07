/* DoKit — blog article init (CSP-safe).
   Replaces the inline init snippet used on older blog pages (inline scripts
   are blocked by those pages' own `script-src 'self'` CSP meta). Renders
   the site nav + footer via DKUI on DOMContentLoaded. */
document.addEventListener("DOMContentLoaded", function () {
  try {
    if (window.DKUI) {
      DKUI.renderNav("blog");
      DKUI.renderFooter();
      DKUI.init();
    }
  } catch (e) {}
});
