/* DoKit — small-tool additions (restored old controls, Phase 2b style).
 * NEW file: phase2/assets/js/tools-additions.js. Load it AFTER tools.js
 * on resizer/compressor/converter/word-counter/case-converter pages,
 * and AFTER tools-extra.js on qr-generator/unit-converter pages.
 * Classic script, var only, no modules, no CDN, device-local only.
 *
 * SAFETY RULE (whole file): nothing here rebinds, replaces or edits
 * an existing control's handler. Each addition is either (a) a value
 * setter for an existing input (presets), (b) a brand-new button with
 * its own output container, or (c) a clear/swap on existing elements.
 * The existing tools.js / tools-extra.js behaviour is therefore
 * untouched when this file loads — and every block is guarded, so
 * loading it on a page without its elements is a no-op.
 * Items that CANNOT be done this way (they need the existing engine
 * to change) are NOT faked here — they are listed as deferred in
 * README.md with their old ids and the exact anchor to change. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) {
    if (n < 1024) { return n + ' B'; }
    if (n < 1048576) { return (n / 1024).toFixed(1) + ' KB'; }
    return (n / 1048576).toFixed(2) + ' MB';
  }
  function downloadBlob(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function loadImage(file) {
    return new Promise(function (res, rej) {
      if (!file || file.size > 25 * 1024 * 1024) {
        /* WHY (i18n): this Error surfaces via .catch into the manual
         * result box, so it must translate like any rendered message.
         * New keys (not rsv_0977/rsv_1009 — those carry longer text). */
        rej(new Error((window.dkT ? window.dkT('rsv_1205', 'File is larger than 25 MB.') : 'File is larger than 25 MB.'))); return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); res(img); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error((window.dkT ? window.dkT('rsv_1206', 'This image could not be read.') : 'This image could not be read.'))); };
      img.src = url;
    });
  }
  /* Copy helper with textarea fallback (same pattern tools.js uses). */
  function copyText(text, done) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { done(true); })
        .catch(function () { done(false); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      done(ok);
    }
  }

  /* ============ Resizer: ratio + social presets (value setters) ==========
   * NEEDS: #rz-w, #rz-h (existing) + buttons [data-ta-ratio] /
   * [data-ta-social] (fragment). WHY: old cropRatios (Free/1:1/4:3/
   * 3:4/16:9/9:16) and socialPresets (exact old sizes, see fragment).
   * HOW: presets only SET the width/height inputs — the existing
   * Resize button (rz-go) still does the actual resize, so the
   * engine is untouched. No input event is dispatched on purpose:
   * tools.js's aspect-lock handler would overwrite the second value
   * if it fired; the user presses Resize with the preset values as-is.
   * A ratio preset keeps the current width and derives height from it
   * (or keeps height and derives width when width is empty). */
  var rzW = $('rz-w'), rzH = $('rz-h');
  if (rzW && rzH) {
    var ratioBtns = document.querySelectorAll('[data-ta-ratio]');
    for (var ri = 0; ri < ratioBtns.length; ri++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var ratio = parseFloat(btn.getAttribute('data-ta-ratio'));
          if (!ratio) { return; } /* "Free" (0) = no preset, leave values */
          var w = parseInt(rzW.value, 10), h = parseInt(rzH.value, 10);
          if (w) { rzH.value = Math.round(w / ratio); }
          else if (h) { rzW.value = Math.round(h * ratio); }
        });
      })(ratioBtns[ri]);
    }
    var socialBtns = document.querySelectorAll('[data-ta-social]');
    for (var si = 0; si < socialBtns.length; si++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          rzW.value = btn.getAttribute('data-ta-w');
          rzH.value = btn.getAttribute('data-ta-h');
        });
      })(socialBtns[si]);
    }
  }

  /* ============ Compressor: manual quality + batch (standalone) ==========
   * NEEDS: #cp-file, #cp-fmt (existing) + #ta-cp-q, #ta-cp-q-val,
   * #ta-cp-manual, #ta-cp-result, #ta-cp-batch, #ta-cp-batch-list
   * (fragment). WHY: old modeQ (manual quality slider) — the new tool
   * only offers target-KB binary search. HOW: standalone encode path
   * with its OWN result container; cp-result / cp-go are never
   * touched, so the target-KB flow keeps working exactly as before.
   * Batch encodes each file at the slider quality with its own
   * download button (max 10, same cap as the converter). */
  function cpQuality() {
    var q = $('ta-cp-q');
    return q ? (parseInt(q.value, 10) || 80) / 100 : 0.8;
  }
  var cpQ = $('ta-cp-q'), cpQVal = $('ta-cp-q-val');
  if (cpQ && cpQVal) {
    cpQ.addEventListener('input', function () { cpQVal.textContent = cpQ.value; });
  }
  var cpManual = $('ta-cp-manual'), cpResult = $('ta-cp-result');
  if (cpManual && cpResult) {
    cpManual.addEventListener('click', function () {
      var file = $('cp-file') ? $('cp-file').files[0] : null;
      /* WHY (i18n): rendered messages go through dkT() like tools.js,
       * so the manual flow translates in all 10 languages. Download
       * reuses rsv_0972 (existing key, no duplicate). */
      if (!file) { cpResult.textContent = (window.dkT ? window.dkT('rsv_1201', 'Choose an image first (above).') : 'Choose an image first (above).'); return; }
      loadImage(file).then(function (img) {
        var c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        var fmtSel = ($('cp-fmt') || {}).value || 'keep';
        var type = fmtSel === 'webp' ? 'image/webp' : 'image/jpeg';
        c.toBlob(function (blob) {
          if (!blob) { cpResult.textContent = (window.dkT ? window.dkT('rsv_1202', 'Could not encode this image.') : 'Could not encode this image.'); return; }
          cpResult.innerHTML = '';
          var p = document.createElement('p');
          p.textContent = (window.dkT ? window.dkT('rsv_1197', 'Manual quality') : 'Manual quality') + ' ' + Math.round(cpQuality() * 100)
            + '%: ' + fmt(blob.size) + ' (' + (window.dkT ? window.dkT('rsv_1204', 'original') : 'original') + ' ' + fmt(file.size) + ')';
          cpResult.appendChild(p);
          var d = document.createElement('button');
          d.className = 'btn'; d.textContent = (window.dkT ? window.dkT('rsv_0972', 'Download') : 'Download');
          d.addEventListener('click', function () {
            downloadBlob(blob, 'dokit-manual.' + type.split('/')[1]);
          });
          cpResult.appendChild(d);
        }, type, cpQuality());
      }).catch(function (e) { cpResult.textContent = e.message; });
    });
  }
  var cpBatch = $('ta-cp-batch'), cpBatchList = $('ta-cp-batch-list');
  if (cpBatch && cpBatchList) {
    cpBatch.addEventListener('change', function () {
      var files = Array.prototype.slice.call(cpBatch.files || [], 0, 10);
      cpBatch.value = '';
      cpBatchList.innerHTML = '';
      if (!files.length) {
        /* WHY (i18n): batch messages go through dkT() like the manual
         * flow (item 36); Download reuses rsv_0972. */
        var li0 = document.createElement('li');
        li0.textContent = (window.dkT ? window.dkT('rsv_1210', 'No images chosen.') : 'No images chosen.');
        cpBatchList.appendChild(li0);
        return;
      }
      files.forEach(function (f) {
        var li = document.createElement('li');
        li.textContent = f.name + ' …';
        cpBatchList.appendChild(li);
        loadImage(f).then(function (img) {
          var c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          var fmtSel = ($('cp-fmt') || {}).value || 'keep';
          var type = fmtSel === 'webp' ? 'image/webp' : 'image/jpeg';
          c.toBlob(function (blob) {
            if (!blob) { li.textContent = f.name + ' ' + (window.dkT ? window.dkT('rsv_1211', '— failed.') : '— failed.'); return; }
            li.innerHTML = '';
            var sp = document.createElement('span');
            sp.textContent = f.name + ' → ' + fmt(blob.size) + ' ';
            var d = document.createElement('button');
            d.className = 'btn ghost'; d.textContent = (window.dkT ? window.dkT('rsv_0972', 'Download') : 'Download');
            d.addEventListener('click', function () {
              downloadBlob(blob, 'dokit-' + f.name.replace(/\.[^.]+$/, '')
                + '.' + type.split('/')[1]);
            });
            li.appendChild(sp); li.appendChild(d);
          }, type, cpQuality());
        }).catch(function () { li.textContent = f.name + ' ' + (window.dkT ? window.dkT('rsv_1212', '— could not be read.') : '— could not be read.'); });
      });
    });
  }

  /* ============ Converter: quality slider + Remove-all ===================
   * NEEDS: #cv-files, #cv-fmt (existing) + #ta-cv-q, #ta-cv-q-val,
   * #ta-cv-all, #ta-cv-list, #ta-cv-clear (fragment). WHY: old q
   * slider (the new converter hardcodes 0.9) and old clearBtn
   * (Remove-all). HOW: the slider drives a NEW "Convert all" button
   * with its own output list — the existing per-file buttons (which
   * hardcode 0.9 inside tools.js) are left alone. Remove-all only
   * clears the file input + the existing list; tools.js rebuilds the
   * list on the next change event, so nothing breaks. */
  var cvQ = $('ta-cv-q'), cvQVal = $('ta-cv-q-val');
  if (cvQ && cvQVal) {
    cvQ.addEventListener('input', function () { cvQVal.textContent = cvQ.value; });
  }
  var cvAll = $('ta-cv-all'), cvList = $('ta-cv-list');
  if (cvAll && cvList) {
    cvAll.addEventListener('click', function () {
      var files = $('cv-files') ? Array.prototype.slice.call($('cv-files').files || [], 0, 10) : [];
      cvList.innerHTML = '';
      /* WHY (i18n): convert-all messages go through dkT(); fail label
       * reuses rsv_1211 and Download reuses rsv_0972 (no duplicates). */
      if (!files.length) { var li0 = document.createElement('li'); li0.textContent = (window.dkT ? window.dkT('rsv_1215', 'No files chosen (above).') : 'No files chosen (above).'); cvList.appendChild(li0); return; }
      var q = cvQ ? (parseInt(cvQ.value, 10) || 90) / 100 : 0.9;
      var fmtSel = ($('cv-fmt') || {}).value || 'webp';
      files.forEach(function (f) {
        var li = document.createElement('li');
        li.textContent = f.name + ' …';
        cvList.appendChild(li);
        loadImage(f).then(function (img) {
          var c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          c.toBlob(function (blob) {
            if (!blob) { li.textContent = f.name + ' ' + (window.dkT ? window.dkT('rsv_1211', '— failed.') : '— failed.'); return; }
            li.innerHTML = '';
            var sp = document.createElement('span');
            sp.textContent = f.name + ' → ' + fmtSel.toUpperCase() + ' ';
            var d = document.createElement('button');
            d.className = 'btn ghost'; d.textContent = (window.dkT ? window.dkT('rsv_0972', 'Download') : 'Download');
            d.addEventListener('click', function () {
              downloadBlob(blob, f.name.replace(/\.[^.]+$/, '') + '.' + fmtSel);
            });
            li.appendChild(sp); li.appendChild(d);
          }, 'image/' + fmtSel, q);
        }).catch(function (e) { li.textContent = f.name + ' — ' + e.message; });
      });
    });
  }
  var cvClear = $('ta-cv-clear');
  if (cvClear) {
    cvClear.addEventListener('click', function () {
      var files = $('cv-files');
      if (files) { files.value = ''; }
      var list = $('cv-list');
      if (list) { list.innerHTML = ''; }
      if (cvList) { cvList.innerHTML = ''; }
    });
  }

  /* ============ Word Counter: Clear + Copy-stats ==========================
   * NEEDS: #wc-input, #wc-out (existing) + #ta-wc-clear,
   * #ta-wc-copy-stats, #ta-wc-msg (fragment). WHY: old clearBtn and
   * copyBtn ("Copy stats"). IMPORTANT: the new wc-copy button copies
   * the INPUT text (tools.js) — this file deliberately does NOT
   * rebind it. The new ta-wc-copy-stats button copies the STATISTICS
   * text (wc-out) instead, which is what the old button did. Parent
   * may repoint wc-copy later; this file leaves existing behaviour
   * intact. Clear dispatches input so tools.js refreshes the stats. */
  var wcClear = $('ta-wc-clear'), wcCopyStats = $('ta-wc-copy-stats');
  if (wcClear) {
    wcClear.addEventListener('click', function () {
      var input = $('wc-input');
      if (!input) { return; }
      input.value = '';
      var ev;
      try { ev = new Event('input', { bubbles: true }); }
      catch (e) { ev = document.createEvent('Event'); ev.initEvent('input', true, false); }
      input.dispatchEvent(ev);
      input.focus();
    });
  }
  if (wcCopyStats) {
    wcCopyStats.addEventListener('click', function () {
      var out = $('wc-out');
      var msg = $('ta-wc-msg');
      if (!out) { return; }
      copyText(out.textContent || '', function (ok) {
        /* WHY (i18n): copy feedback goes through dkT() like the other
         * tools-additions messages (items 36–38). */
        if (msg) { msg.textContent = ok ? (window.dkT ? window.dkT('rsv_1218', 'Statistics copied.') : 'Statistics copied.') : (window.dkT ? window.dkT('rsv_1219', 'Copy failed — select the stats and copy manually.') : 'Copy failed — select the stats and copy manually.'); }
      });
    });
  }

  /* ============ Case Converter: Clear =====================================
   * NEEDS: #cc-input, #cc-out (existing) + #ta-cc-clear (fragment).
   * WHY: old clearBtn (cleared input and re-ran the conversion, which
   * empties the output). Clearing both fields directly is the same
   * visible result without touching the mode buttons. */
  var ccClear = $('ta-cc-clear');
  if (ccClear) {
    ccClear.addEventListener('click', function () {
      var input = $('cc-input'), out = $('cc-out');
      if (input) { input.value = ''; }
      if (out) { out.value = ''; }
      if (input) { input.focus(); }
    });
  }

  /* ============ QR Generator: Clear =======================================
   * NEEDS: #qr-text, #qr-box, #qr-dl, #qr-msg (existing) +
   * #ta-qr-clear (fragment). WHY: old qrClear (cleared text + box,
   * hid output, cleared hint, focused text). Mapped onto the new
   * ids: qr-msg is the new hint, qr-dl is the new output link. */
  var qrClear = $('ta-qr-clear');
  if (qrClear) {
    qrClear.addEventListener('click', function () {
      var text = $('qr-text'), box = $('qr-box'),
        dl = $('qr-dl'), msg = $('qr-msg');
      if (text) { text.value = ''; }
      if (box) { box.innerHTML = ''; }
      if (dl) { dl.style.display = 'none'; }
      if (msg) { msg.textContent = ''; }
      if (text) { text.focus(); }
    });
  }

  /* ============ Unit Converter: Swap ======================================
   * NEEDS: #uc-from, #uc-to (existing) + #ta-uc-swap (fragment).
   * WHY: old ucSwap (swapped the two unit selects, then reconverted).
   * HOW: swap the select values, then dispatch change on uc-from —
   * tools-extra.js's convert() reads both selects on change, so the
   * result updates through the existing path (temperature included,
   * since convertTemp is inside that same path). */
  var ucSwap = $('ta-uc-swap');
  if (ucSwap) {
    ucSwap.addEventListener('click', function () {
      var from = $('uc-from'), to = $('uc-to');
      if (!from || !to) { return; }
      var tmp = from.value;
      from.value = to.value;
      to.value = tmp;
      var ev;
      try { ev = new Event('change', { bubbles: true }); }
      catch (e) { ev = document.createEvent('Event'); ev.initEvent('change', true, false); }
      from.dispatchEvent(ev);
    });
  }
})();
