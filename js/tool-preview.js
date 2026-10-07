/**
 * DoKit — Instant image preview for image tools.
 * ============================================================
 * WHAT THIS FILE DOES
 * --------------------
 * Shows an instant thumbnail preview right under the upload drop-zone
 * (the `#dz` element) the moment the user picks or drops image files —
 * before the tool itself finishes loading/processing them.
 *
 * - Single image  → shows that image's thumbnail + name + size.
 * - Multiple      → shows the FIRST image's thumbnail with a "+N more" badge.
 * - The × button  → dismisses the preview and frees its object URL.
 *
 * WHY A SEPARATE FILE (and not inside each tool.js)
 * -------------------------------------------------
 * The three image tools (resizer / converter / compressor) each have their
 * own large minified `tool.js`. Rather than editing minified code, this tiny
 * self-contained module only *observes* file selection — it never interferes
 * with the tool's own handlers (no preventDefault, no stopPropagation).
 *
 * IMPORTANT LOAD ORDER
 * --------------------
 * This script MUST be included BEFORE `tool.js` in the HTML, e.g.:
 *
 *     <script src="../../js/tool-preview.js" defer></script>
 *     <script src="tool.js" defer></script>
 *
 * Reason: every tool clears `fileInput.value = ""` inside its own `change`
 * handler after reading the files. Deferred scripts run in document order, so
 * loading this file first guarantees our `change` listener is registered
 * first and still sees the selected files.
 *
 * MEMORY / SECURITY NOTES
 * -----------------------
 * - Previews use `URL.createObjectURL(file)` — the image never leaves the
 *   browser and is never uploaded anywhere.
 * - Every created object URL is revoked when the preview is dismissed,
 *   replaced, or when the page is hidden — no memory leaks.
 * - Only files whose MIME type starts with "image/" are previewed.
 *
 * @version 1.0.0
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 1. Injected styles — kept here (instead of a CSS file) so the whole
   *    feature ships as ONE small file. The page CSP allows 'unsafe-inline'
   *    styles, so this <style> tag is permitted.
   * ------------------------------------------------------------------ */
  var CSS = [
    '.dk-pv{margin-top:.75rem}',
    '.dk-pv-card{display:flex;align-items:center;gap:.75rem;padding:.6rem .75rem;',
    ' border:1px solid var(--border,#e5e7eb);border-radius:.75rem;',
    ' background:var(--surface,#ffffff);box-shadow:var(--shadow-sm,0 1px 2px rgba(0,0,0,.05))}',
    '.dk-pv-img{width:64px;height:64px;object-fit:cover;border-radius:.5rem;',
    ' flex:0 0 auto;background:#f3f4f6;display:block}',
    '.dk-pv-meta{min-width:0;flex:1 1 auto}',
    '.dk-pv-name{margin:0;font-weight:600;font-size:.9rem;white-space:nowrap;',
    ' overflow:hidden;text-overflow:ellipsis}',
    '.dk-pv-sub{margin:.15rem 0 0;font-size:.8rem;color:var(--text-muted,#6b7280);',
    ' display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}',
    '.dk-pv-more{display:inline-block;padding:.1rem .55rem;border-radius:999px;',
    ' background:var(--primary-soft,#ede9fe);color:var(--primary,#6C4CF1);',
    ' font-weight:700;font-size:.75rem}',
    '.dk-pv-x{flex:0 0 auto;width:2rem;height:2rem;border-radius:50%;',
    ' border:1px solid var(--border,#e5e7eb);background:transparent;',
    ' font-size:1.1rem;line-height:1;cursor:pointer;color:var(--text-muted,#6b7280)}',
    '.dk-pv-x:hover{background:#fee2e2;color:#b91c1c;border-color:#fecaca}',
    '.dk-pv-x:focus-visible{outline:2px solid var(--primary,#6C4CF1);outline-offset:2px}'
  ].join('\n');

  /* ------------------------------------------------------------------ *
   * 2. Small helpers
   * ------------------------------------------------------------------ */

  /**
   * Format a byte count as a human-readable string (e.g. "2.4 MB").
   * @param {number} bytes - File size in bytes.
   * @returns {string} Human-readable size.
   */
  function fmtSize(bytes) {
    if (!bytes || bytes <= 0) return '';
    var units = ['B', 'KB', 'MB', 'GB'];
    var i = 0;
    var n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return (i === 0 ? Math.round(n) : n.toFixed(1)) + ' ' + units[i];
  }

  /**
   * Keep only image files from a FileList/array-like.
   * @param {FileList|Array} list - Files from input or drop event.
   * @returns {File[]} Array of image Files.
   */
  function onlyImages(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      if (f && f.type && f.type.indexOf('image/') === 0) out.push(f);
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * 3. Main wiring — runs once the DOM is ready.
   * ------------------------------------------------------------------ */
  function init() {
    var dz = document.getElementById('dz');           // drop-zone box
    var fileInput = document.getElementById('fileInput'); // hidden file input
    if (!dz || !fileInput) return; // not an image-tool page — do nothing

    /* ---- 3a. Inject the <style> block once ---- */
    if (!document.getElementById('dk-pv-style')) {
      var style = document.createElement('style');
      style.id = 'dk-pv-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    /* ---- 3b. Build the preview card (hidden until first upload) ----
       Placed immediately AFTER the drop-zone so the preview appears
       "where you upload", before the privacy note and sample button. */
    var wrap = document.createElement('div');
    wrap.id = 'dkPreview';
    wrap.className = 'dk-pv';
    wrap.hidden = true;
    wrap.setAttribute('aria-live', 'polite'); // announce preview to screen readers
    wrap.innerHTML =
      '<div class="dk-pv-card">' +
        '<img class="dk-pv-img" alt=""/>' +
        '<div class="dk-pv-meta">' +
          '<p class="dk-pv-name"></p>' +
          '<p class="dk-pv-sub"><span class="dk-pv-size"></span>' +
          '<span class="dk-pv-more" hidden></span></p>' +
        '</div>' +
        '<button type="button" class="dk-pv-x" aria-label="Remove preview">&times;</button>' +
      '</div>';
    dz.insertAdjacentElement('afterend', wrap);

    var img = wrap.querySelector('.dk-pv-img');
    var nameEl = wrap.querySelector('.dk-pv-name');
    var sizeEl = wrap.querySelector('.dk-pv-size');
    var moreEl = wrap.querySelector('.dk-pv-more');
    var xBtn = wrap.querySelector('.dk-pv-x');

    var currentUrl = null; // the object URL currently shown (if any)

    /**
     * Hide the preview and free its object URL (prevents memory leaks).
     */
    function clearPreview() {
      if (currentUrl) {
        try { URL.revokeObjectURL(currentUrl); } catch (e) { /* ignore */ }
        currentUrl = null;
      }
      img.removeAttribute('src');
      wrap.hidden = true;
    }

    /**
     * Render the preview for a fresh batch of files.
     * Shows ONLY the first image; extra images collapse into a "+N more" badge.
     * @param {FileList|Array} files - Newly selected/dropped files.
     */
    function showPreview(files) {
      var imgs = onlyImages(files);
      if (!imgs.length) return; // nothing previewable — leave existing preview alone

      clearPreview(); // revoke the previous object URL before making a new one

      var first = imgs[0];
      currentUrl = URL.createObjectURL(first); // instant, local-only preview
      img.src = currentUrl;
      img.alt = (first.name || 'image') + ' — preview';
      nameEl.textContent = first.name || 'image';
      nameEl.title = first.name || '';
      sizeEl.textContent = fmtSize(first.size);

      if (imgs.length > 1) {
        moreEl.hidden = false;
        moreEl.textContent = '+' + (imgs.length - 1) + ' more';
      } else {
        moreEl.hidden = true;
        moreEl.textContent = '';
      }
      wrap.hidden = false;
    }

    /* ---- 3c. Observe file selection ---------------------------------
       NOTE: our `change` listener is registered BEFORE the tool's own
       (this file loads first — see header), so we still see the files
       even though the tool clears fileInput.value afterwards. */
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files.length) showPreview(fileInput.files);
      // (empty = user cancelled the picker — keep any existing preview)
    });

    /* Drag & drop: dataTransfer.files is never cleared by the tool,
       so listener order does not matter here. */
    dz.addEventListener('drop', function (e) {
      var dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) showPreview(dt.files);
    });

    /* ---- 3d. The × button: dismiss preview + free memory ------------
       Also clears the file input so picking the SAME file again
       re-triggers the change event. The tool's own queue (with its own
       per-file remove buttons) is left untouched — this button only
       dismisses the instant preview. */
    xBtn.addEventListener('click', function () {
      clearPreview();
      try { fileInput.value = ''; } catch (e) { /* ignore */ }
    });

    /* ---- 3e. Stay in sync when the tool itself is cleared ------------
       If the user empties the tool via its own "Clear all"/"Remove all"
       button, a stale preview would be misleading — hide it too. */
    ['clearAllBtn', 'clearBtn'].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.addEventListener('click', clearPreview);
    });

    /* ---- 3f. Final safety net: free the URL if the page unloads ---- */
    window.addEventListener('pagehide', clearPreview);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init(); // deferred scripts already run after parsing — init at once
  }
})();
