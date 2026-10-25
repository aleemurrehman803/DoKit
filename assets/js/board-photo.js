/* DoKit — Board Photo tool (Phase 2b + restored power features).
 * REPLACES phase2/assets/js/board-photo.js (same <script> tag, same page).
 *
 * Preserved from the Phase 2b file, unchanged in behaviour:
 *  - 32 boards/universities with w/h/max-KB/background + verified flag.
 *  - Search filter, spec card with honest verified/unverified state.
 *  - Cover-crop onto the board colour, binary-search JPEG quality to
 *    the board's max KB, download link. Photo never leaves the browser.
 * Restored from the old tool (old ids kept, see board-photo-controls.html):
 *  - Background buttons, custom size (w/h/max-KB override), Advanced
 *    panel (Enhance, Rotate L/R, Flip, presets in localStorage),
 *    name/date stamp, B/W toggle, face-guide toggle, camera capture,
 *    batch photos (one output per input), Print Sheet 4x6, WhatsApp
 *    share (TEXT link only — see note on waBtn), "Use another photo".
 * Crop change vs Phase 2b: the old tool's head-safe crop is used
 * (crop biased toward the top, factor 0.32) so heads keep headroom.
 * Every optional control is guarded: with no fragment on the page the
 * file still works exactly like the Phase 2b version.
 * Classic script, var only, no modules, no CDN, no backend. */
(function () {
  'use strict';

  /* -- Board specs (single source, copied from the Phase 2b file) -------- */
  var BOARDS = [{"id": "bise-bahawalpur", "name": "BISE Bahawalpur", "w": 150, "h": 200, "kb": 22, "bg": "#e6f0ff", "bg_name": "blue", "verified": true}, {"id": "bise-peshawar", "name": "BISE Peshawar", "w": 300, "h": 300, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "bise-swat", "name": "BISE Swat", "w": 300, "h": 300, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "bie-karachi", "name": "BIE Karachi", "w": 200, "h": 230, "kb": 50, "bg": "#e6f0ff", "bg_name": "blue", "verified": true}, {"id": "bbise-quetta", "name": "BBISE Quetta", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "lums", "name": "LUMS", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "karachi-university", "name": "University of Karachi", "w": 230, "h": 200, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "nust", "name": "NUST", "w": 200, "h": 230, "kb": 50, "bg": "#e6f0ff", "bg_name": "blue", "verified": true}, {"id": "uet-lahore", "name": "UET Lahore", "w": 200, "h": 230, "kb": 1024, "bg": "#f8f8f8", "bg_name": "light", "verified": true}, {"id": "fbise", "name": "FBISE (Federal Board)", "w": 200, "h": 230, "kb": 50, "bg": "#2e7cd6", "bg_name": "blue", "verified": true}, {"id": "bise-lahore", "name": "BISE Lahore", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "bise-gujranwala", "name": "BISE Gujranwala", "w": 200, "h": 230, "kb": 18, "bg": "#2e7cd6", "bg_name": "blue", "verified": false}, {"id": "bise-rawalpindi", "name": "BISE Rawalpindi", "w": 200, "h": 230, "kb": 18, "bg": "#2e7cd6", "bg_name": "blue", "verified": false}, {"id": "bise-multan", "name": "BISE Multan", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-faisalabad", "name": "BISE Faisalabad", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-sargodha", "name": "BISE Sargodha", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-dg-khan", "name": "BISE D.G. Khan", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-sahiwal", "name": "BISE Sahiwal", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-hyderabad", "name": "BISE Hyderabad", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-sukkur", "name": "BISE Sukkur", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-larkana", "name": "BISE Larkana", "w": 200, "h": 230, "kb": 1024, "bg": "#add8e6", "bg_name": "light blue", "verified": true}, {"id": "bise-mirpurkhas", "name": "BISE Mirpurkhas", "w": 200, "h": 230, "kb": 1024, "bg": "#add8e6", "bg_name": "light blue", "verified": true}, {"id": "bise-mardan", "name": "BISE Mardan", "w": 300, "h": 300, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "bise-kohat", "name": "BISE Kohat", "w": 300, "h": 300, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "bise-abbottabad", "name": "BISE Abbottabad", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-dikhan", "name": "BISE D.I. Khan", "w": 300, "h": 300, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "ajk-board", "name": "AJK Board Mirpur", "w": 200, "h": 230, "kb": 1024, "bg": "#2e7cd6", "bg_name": "blue", "verified": true}, {"id": "punjab-university", "name": "Punjab University", "w": 800, "h": 1000, "kb": 200, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "iba-karachi", "name": "IBA Karachi", "w": 200, "h": 230, "kb": 2048, "bg": "#2e7cd6", "bg_name": "blue", "verified": true}, {"id": "comsats", "name": "COMSATS", "w": 200, "h": 230, "kb": 50, "bg": "#2e7cd6", "bg_name": "blue", "verified": true}, {"id": "aiou", "name": "AIOU", "w": 200, "h": 230, "kb": 50, "bg": "#2e7cd6", "bg_name": "blue", "verified": true}, {"id": "generic", "name": "Pakistani admission (typical)", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}];
  var BWP_NOTE = (window.dkT ? window.dkT('rsv_1051', 'Official 2026 registration notice: 100\u2013150 px wide, ') : 'Official 2026 registration notice: 100\u2013150 px wide, ')
    + (window.dkT ? window.dkT('rsv_1050', '150\u2013200 px tall, 8\u201322 KB, blue background, ') : '150\u2013200 px tall, 8\u201322 KB, blue background, ')
    + (window.dkT ? window.dkT('rsv_1053', 'head-to-shoulder photo.') : 'head-to-shoulder photo.');

  /* -- Required Phase 2b elements (page does not run without these) ------ */
  var selectEl = document.getElementById('bp-board');
  var filterEl = document.getElementById('bp-filter');
  var specEl = document.getElementById('bp-spec');
  var fileEl = document.getElementById('bp-file');
  var canvasEl = document.getElementById('bp-canvas');
  var makeBtn = document.getElementById('bp-make');
  var dlEl = document.getElementById('bp-download');
  var msgEl = document.getElementById('bp-msg');
  if (!selectEl || !canvasEl) { return; }

  /* -- Optional restored-control elements (all guarded) ------------------- */
  function $(id) { return document.getElementById(id); }
  var bgRow = $('bgRow');
  var sheetBtn = $('sheetBtn'), waBtn = $('waBtn'), againBtn = $('againBtn');
  var cwEl = $('cw'), chEl = $('ch'), ckbEl = $('ckb'), customBtn = $('customBtn');
  var advToggle = $('advToggle'), advSection = $('advSection'), advBody = $('advBody');
  var enhanceBtn = $('enhanceBtn'), rotL = $('rotL'), rotR = $('rotR'), flipBtn = $('flipH');
  var presetName = $('presetName'), savePresetBtn = $('savePresetBtn'), presetRow = $('presetRow');
  var stampName = $('stampName'), stampDate = $('stampDate');
  var bwToggle = $('bwToggle'), guideToggle = $('guideToggle'), faceGuide = $('faceGuide');
  var camBtn = $('camBtn'), camModal = $('camModal'), camVideo = $('camVideo');
  var camErr = $('camErr'), camClose = $('camClose'), camX = $('camX'), camShot = $('camShot');
  var batchBtn = $('batchBtn'), batchInput = $('batchInput'), batchList = $('batchList');

  /* -- State -------------------------------------------------------------- */
  var current = BOARDS[0];
  var loadedImg = null;     // uploaded (or camera-captured) photo
  var currentBlob = null;   // last fitted single-photo output
  var currentURL = null;    // object URL of currentBlob (revoked on replace)
  var customSpec = null;    // {w,h,kb} when the user overrides the board spec
  var bgOverride = null;    // null = board bg; 'original' = no fill; else colour
  var rotation = 0, flipH = false, bwOn = false, enhanceOn = false;
  var stampText = '', stampDateOn = false;
  var renderSeq = 0;        // guards async fitBlob against stale re-renders

  function say(msg) { if (msgEl) { msgEl.textContent = msg; } }
  function clampInt(v, fallback, min, max) {
    var n = parseInt(v, 10);
    if (isNaN(n)) { return fallback; }
    if (n < min) { return min; }
    if (n > max) { return max; }
    return n;
  }
  /* Effective output spec: custom override wins on size/KB, but the
   * background still comes from the board (or the bg buttons). */
  function effSpec() {
    if (customSpec) {
      return { name: current.name + ' (custom)', w: customSpec.w,
        h: customSpec.h, kb: customSpec.kb, bg: current.bg,
        bg_name: current.bg_name, verified: false, custom: true };
    }
    return current;
  }

  /* -- Board dropdown + spec card (Phase 2b behaviour) --------------------- */
  function fillOptions(list) {
    selectEl.innerHTML = '';
    list.forEach(function (b) {
      var o = document.createElement('option');
      o.value = b.id;
      o.textContent = b.name + ' (' + b.w + '\u00d7' + b.h + (window.dkT ? window.dkT('rsv_0950', ' px, max ') : ' px, max ')
        + b.kb + (window.dkT ? window.dkT('rsv_0941', ' KB)') : ' KB)');
      selectEl.appendChild(o);
    });
  }
  function bgName(n){ var k = {'blue':'rsv_1060','light blue':'rsv_1054','light':'rsv_1062','white':'rsv_1061'}[n]; return (window.dkT && k) ? window.dkT(k, n) : n; }
  function showSpec() {
    if (!specEl) { return; }
    var b = effSpec();
    specEl.innerHTML = '<p><b>' + b.name + '</b> \u2014 ' + b.w + '\u00d7'
      + b.h + (window.dkT ? window.dkT('rsv_0950', ' px, max ') : ' px, max ') + b.kb + (window.dkT ? window.dkT('rsv_0942', ' KB, background: ') : ' KB, background: ') + bgName(b.bg_name) + ' ('
      + b.bg + ')' + (b.verified
        ? ' <span class="ok">' + (window.dkT ? window.dkT('rsv_1058', '\u2713 Verified spec') : '\u2713 Verified spec') + '</span>'
        : ' <span class="err">' + (window.dkT ? window.dkT('rsv_1059', 'Unverified \u2014 confirm on your board\u2019s notice') : 'Unverified \u2014 confirm on your board\u2019s notice') + '</span>')
      + '</p>' + (b.custom
        ? '<p>' + (window.dkT ? window.dkT('rsv_1276', 'Custom size overrides the board spec until you pick another board.') : 'Custom size overrides the board spec until you pick another board.') + '</p>' : '')
      + (!b.custom && current.id === 'bise-bahawalpur' ? '<p>' + BWP_NOTE + '</p>' : '');
  }
  fillOptions(BOARDS);
  showSpec();
  selectEl.addEventListener('change', function () {
    var found = BOARDS.filter(function (b) { return b.id === selectEl.value; });
    if (found.length) {
      current = found[0];
      /* New board = fresh start: custom size and bg override do not leak
       * from the previous board into this board's photo. */
      customSpec = null; bgOverride = null;
      showSpec(); syncBgBtns(); rerender(true);
    }
  });
  if (filterEl) {
    filterEl.addEventListener('input', function () {
      var q = filterEl.value.trim().toLowerCase();
      var list = BOARDS.filter(function (b) {
        return !q || b.name.toLowerCase().indexOf(q) !== -1;
      });
      fillOptions(list);
      if (list.length) {
        selectEl.value = list[0].id; current = list[0];
        customSpec = null; bgOverride = null;
        showSpec(); syncBgBtns();
      }
    });
  }

  /* -- Core pipeline (shared by single photo AND batch: DRY) --------------- */
  /* Build the output canvas for one image at one spec, applying every
   * active transform. Rotation swaps output w/h (a 90-degree photo is
   * portrait/landscape-flipped), everything else is drawn on top. */
  function buildCanvas(img, spec) {
    var rot = ((rotation % 360) + 360) % 360;
    var outW = (rot === 90 || rot === 270) ? spec.h : spec.w;
    var outH = (rot === 90 || rot === 270) ? spec.w : spec.h;
    /* Head-safe cover crop: fill the frame, bias the crop window toward
     * the top (0.32) so a head is not cut off at the top edge. */
    var scale = Math.max(outW / img.naturalWidth, outH / img.naturalHeight);
    var cw = Math.round(outW / scale), ch = Math.round(outH / scale);
    var sx = Math.max(0, Math.round((img.naturalWidth - cw) / 2));
    var sy = Math.max(0, Math.round((img.naturalHeight - ch) * 0.32));
    var canvas = document.createElement('canvas');
    canvas.width = outW; canvas.height = outH;
    var ctx = canvas.getContext('2d');
    /* 'original' means: do not paint any background (photo pixels only,
     * letterboxed by the cover crop itself). Otherwise the chosen bg. */
    var fill = bgOverride === 'original' ? null : (bgOverride || spec.bg || '#ffffff');
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(0, 0, outW, outH); }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    var filters = [];
    if (bwOn) { filters.push('grayscale(1)'); }
    /* Enhance is a gentle lift only — it never alters the face, just
     * brightness/contrast/saturation, as in the old tool. */
    if (enhanceOn) { filters.push('brightness(1.06) contrast(1.12) saturate(1.08)'); }
    ctx.filter = filters.length ? filters.join(' ') : 'none';
    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    if (flipH) { ctx.scale(-1, 1); }
    ctx.rotate(rot * Math.PI / 180);
    ctx.drawImage(img, sx, sy, cw, ch, -outW / 2, -outH / 2, outW, outH);
    ctx.restore();
    ctx.filter = 'none';
    /* Name/date stamp, bottom-right on a translucent strip so it stays
     * readable on any photo. Date is always "today" at render time. */
    if (stampText || stampDateOn) {
      var pad = Math.max(6, Math.round(outH * 0.03));
      var fs = Math.max(10, Math.round(outH * 0.055));
      var lines = [];
      if (stampText) { lines.push(stampText); }
      if (stampDateOn) {
        var d = new Date();
        lines.push(('0' + d.getDate()).slice(-2) + '-'
          + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + d.getFullYear());
      }
      var label = lines.join('  \u2022  ');
      ctx.font = '600 ' + fs + 'px system-ui, -apple-system, sans-serif';
      ctx.textBaseline = 'bottom';
      var tw = ctx.measureText(label).width;
      var bx = outW - tw - pad * 1.2, by = outH - pad * 0.9;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx - pad * 0.6, by - fs - pad * 0.7, tw + pad * 1.2, fs + pad * 0.9);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, bx, by);
    }
    return canvas;
  }
  /* Binary-search JPEG quality for the largest quality that still fits
   * the KB target. Resolves {blob, over}: over=true means even the
   * lowest quality stayed over target (caller must say so honestly). */
  function fitBlob(canvas, targetBytes) {
    return new Promise(function (resolve) {
      var lo = 0.05, hi = 0.95, best = null;
      function attempt(q) {
        canvas.toBlob(function (blob) {
          if (!blob) { resolve({ blob: null, over: true }); return; }
          if (blob.size <= targetBytes) {
            best = blob;
            if (hi - lo < 0.02) { resolve({ blob: best, over: false }); return; }
            lo = q; attempt((q + hi) / 2);
          } else {
            if (hi - lo < 0.02) {
              if (best) { resolve({ blob: best, over: false }); return; }
              canvas.toBlob(function (b2) {
                resolve({ blob: b2, over: true });
              }, 'image/jpeg', lo);
              return;
            }
            hi = q; attempt((lo + q) / 2);
          }
        }, 'image/jpeg', q);
      }
      attempt((lo + hi) / 2);
    });
  }
  function downloadBlob(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  /* Re-render the single-photo preview. silent=true (control tweaks)
   * leaves bp-msg alone; the Make button passes false for feedback. */
  function rerender(silent) {
    if (!loadedImg) { return; }
    var seq = ++renderSeq;
    var spec = effSpec();
    var built = buildCanvas(loadedImg, spec);
    /* Show the on-page canvas immediately (preview), then fit quality. */
    canvasEl.width = built.width; canvasEl.height = built.height;
    canvasEl.getContext('2d').drawImage(built, 0, 0);
    canvasEl.style.display = '';
    fitBlob(built, spec.kb * 1024).then(function (res) {
      if (seq !== renderSeq) { return; } /* a newer render supersedes this */
      if (!res.blob) { if (!silent) { say((window.dkT ? window.dkT('rsv_1228', 'This image could not be processed.') : 'This image could not be processed.')); } return; }
      if (currentURL) { URL.revokeObjectURL(currentURL); }
      currentBlob = res.blob;
      currentURL = URL.createObjectURL(res.blob);
      if (dlEl) {
        dlEl.href = currentURL;
        dlEl.download = 'board-photo-' + spec.w + 'x' + spec.h + '.jpg';
        dlEl.style.display = 'inline-block';
      }
      if (!silent) {
        say(res.over
          ? (window.dkT ? window.dkT('rsv_1226', 'Ready, but still over ') : 'Ready, but still over ') + spec.kb + (window.dkT ? window.dkT('rsv_1227', ' KB at lowest quality — try a plainer photo.') : ' KB at lowest quality — try a plainer photo.')
          : (window.dkT ? window.dkT('rsv_0998', 'Ready: ') : 'Ready: ') + spec.w + '\u00d7' + spec.h + (window.dkT ? window.dkT('rsv_0951', ' px, under ') : ' px, under ') + spec.kb + (window.dkT ? window.dkT('rsv_0944', ' KB. Download below.') : ' KB. Download below.'));
      }
    });
  }

  /* -- Upload (Phase 2b: FileReader only, never uploaded anywhere) -------- */
  function loadFromFile(file) {
    if (!file) { return; }
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        loadedImg = img;
        say((window.dkT ? window.dkT('rsv_0994', 'Photo loaded. Press \u201cMake board photo\u201d.') : 'Photo loaded. Press \u201cMake board photo\u201d.'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  if (fileEl) {
    fileEl.addEventListener('change', function () {
      loadFromFile(fileEl.files[0]);
      fileEl.value = '';
    });
  }
  if (makeBtn) {
    makeBtn.addEventListener('click', function () {
      if (!loadedImg) { say((window.dkT ? window.dkT('rsv_0959', 'Choose a photo first.') : 'Choose a photo first.')); return; }
      rerender(false);
    });
  }

  /* -- Restored: background buttons ---------------------------------------- */
  function syncBgBtns() {
    if (!bgRow) { return; }
    var btns = bgRow.querySelectorAll('.bbg-btn');
    for (var i = 0; i < btns.length; i++) {
      var v = btns[i].getAttribute('data-bg');
      var active = (bgOverride === null && v === 'board') || (bgOverride === v);
      btns[i].classList.toggle('active', active);
      btns[i].setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }
  if (bgRow) {
    var bgBtns = bgRow.querySelectorAll('.bbg-btn');
    for (var bi = 0; bi < bgBtns.length; bi++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var v = btn.getAttribute('data-bg');
          bgOverride = (v === 'board') ? null : v;
          syncBgBtns();
          rerender(true);
        });
      })(bgBtns[bi]);
    }
    syncBgBtns();
  }

  /* -- Restored: custom size (width / height / max-KB override) ------------ */
  function applyCustomSpec(name, w, h, kb) {
    customSpec = { w: w, h: h, kb: kb };
    bgOverride = null; /* custom spec starts from the board background */
    showSpec(); syncBgBtns(); rerender(true);
  }
  if (customBtn) {
    customBtn.addEventListener('click', function () {
      var w = cwEl ? clampInt(cwEl.value, 200, 10, 4000) : 200;
      var h = chEl ? clampInt(chEl.value, 230, 10, 4000) : 230;
      var kb = ckbEl ? clampInt(ckbEl.value, 50, 1, 10240) : 50;
      applyCustomSpec('Custom (' + w + '\u00d7' + h + ')', w, h, kb);
      if (!loadedImg) { say((window.dkT ? window.dkT('rsv_1277', 'Custom size set: ') : 'Custom size set: ') + w + '\u00d7' + h + (window.dkT ? window.dkT('rsv_0950', ' px, max ') : ' px, max ') + kb + (window.dkT ? window.dkT('rsv_1278', ' KB. Now choose a photo.') : ' KB. Now choose a photo.')); }
    });
  }

  /* -- Restored: Advanced panel toggle ------------------------------------- */
  if (advToggle && advBody) {
    advToggle.addEventListener('click', function () {
      var open = advBody.hidden;
      advBody.hidden = !open;
      if (advSection) { advSection.classList.toggle('open', open); }
      advToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* -- Restored: Enhance / Rotate / Flip / B&W / stamp / guide ------------- */
  function needPhoto() {
    if (!loadedImg) { say((window.dkT ? window.dkT('rsv_1241', 'Please upload a photo first.') : 'Please upload a photo first.')); return true; }
    return false;
  }
  function toggleBtn(btn, on) {
    if (!btn) { return; }
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  if (enhanceBtn) {
    enhanceBtn.addEventListener('click', function () {
      if (needPhoto()) { return; }
      enhanceOn = !enhanceOn; toggleBtn(enhanceBtn, enhanceOn); rerender(true);
    });
  }
  if (rotL) {
    rotL.addEventListener('click', function () {
      if (needPhoto()) { return; }
      rotation = (rotation + 270) % 360; rerender(true);
    });
  }
  if (rotR) {
    rotR.addEventListener('click', function () {
      if (needPhoto()) { return; }
      rotation = (rotation + 90) % 360; rerender(true);
    });
  }
  if (flipBtn) {
    flipBtn.addEventListener('click', function () {
      if (needPhoto()) { return; }
      flipH = !flipH; toggleBtn(flipBtn, flipH); rerender(true);
    });
  }
  if (bwToggle) {
    bwToggle.addEventListener('change', function () {
      bwOn = bwToggle.checked; rerender(true);
    });
  }
  if (stampName) {
    stampName.addEventListener('input', function () {
      stampText = stampName.value.trim(); rerender(true);
    });
  }
  if (stampDate) {
    stampDate.addEventListener('change', function () {
      stampDateOn = stampDate.checked; rerender(true);
    });
  }
  if (guideToggle && faceGuide) {
    /* Face guide is a visual overlay only (see fragment): it never
     * changes the output image, it just helps framing the preview. */
    guideToggle.addEventListener('change', function () {
      faceGuide.hidden = !guideToggle.checked;
    });
  }

  /* -- Restored: presets (device-local only, max 12) ----------------------- */
  function loadPresets() {
    try {
      var v = JSON.parse(window.localStorage.getItem('bp_presets') || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function savePresets(list) {
    try { window.localStorage.setItem('bp_presets', JSON.stringify(list.slice(0, 12))); }
    catch (e) { /* storage unavailable: presets just won't persist */ }
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function renderPresets() {
    if (!presetRow) { return; }
    var list = loadPresets(), html = '';
    for (var i = 0; i < list.length; i++) {
      html += '<span class="bchip"><button type="button" data-i="' + i + '">'
        + esc(list[i].name) + ' <small>' + list[i].w + '\u00d7' + list[i].h
        + '</small></button><button type="button" class="bx" data-del="' + i
        + '" aria-label="' + (window.dkT ? window.dkT('rsv_1243', 'Delete preset') : 'Delete preset') + '">\u00d7</button></span>';
    }
    presetRow.innerHTML = html;
  }
  if (presetRow) {
    presetRow.addEventListener('click', function (e) {
      var del = e.target.closest ? e.target.closest('[data-del]') : null;
      if (del) {
        var l = loadPresets();
        l.splice(parseInt(del.getAttribute('data-del'), 10), 1);
        savePresets(l); renderPresets();
        return;
      }
      var btn = e.target.closest ? e.target.closest('[data-i]') : null;
      if (btn) {
        var p = loadPresets()[parseInt(btn.getAttribute('data-i'), 10)];
        if (p) { applyCustomSpec(p.name, p.w, p.h, p.kb); }
      }
    });
    renderPresets();
  }
  if (savePresetBtn) {
    savePresetBtn.addEventListener('click', function () {
      var spec = effSpec();
      var name = (presetName ? presetName.value.trim() : '')
        || (spec.w + '\u00d7' + spec.h);
      var list = loadPresets();
      list.unshift({ name: name, w: spec.w, h: spec.h, kb: spec.kb });
      savePresets(list); renderPresets();
      if (presetName) { presetName.value = ''; }
      say((window.dkT ? window.dkT('rsv_1242', 'Preset saved: ') : 'Preset saved: ') + name + '.');
    });
  }

  /* -- Restored: Print Sheet 4x6 -------------------------------------------- */
  if (sheetBtn) {
    sheetBtn.addEventListener('click', function () {
      if (!currentBlob) { say((window.dkT ? window.dkT('rsv_1230', 'Make a board photo first, then print a sheet.') : 'Make a board photo first, then print a sheet.')); return; }
      var url = URL.createObjectURL(currentBlob);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        /* 4x6 inch at 300 DPI = 1200x1800 px; tile the photo with a
         * 12 px gap, centred, on white — the sheet itself is a download,
         * nothing is sent to a printer or server. */
        var SHEET_W = 1200, SHEET_H = 1800, GAP = 12;
        var pw = img.naturalWidth || 200, ph = img.naturalHeight || 230;
        var cols = Math.max(1, Math.floor((SHEET_W + GAP) / (pw + GAP)));
        var rows = Math.max(1, Math.floor((SHEET_H + GAP) / (ph + GAP)));
        var gridW = cols * pw + (cols - 1) * GAP;
        var gridH = rows * ph + (rows - 1) * GAP;
        var ox = Math.round((SHEET_W - gridW) / 2);
        var oy = Math.round((SHEET_H - gridH) / 2);
        var canvas = document.createElement('canvas');
        canvas.width = SHEET_W; canvas.height = SHEET_H;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, SHEET_W, SHEET_H);
        for (var r = 0; r < rows; r++) {
          for (var c = 0; c < cols; c++) {
            ctx.drawImage(img, ox + c * (pw + GAP), oy + r * (ph + GAP), pw, ph);
          }
        }
        canvas.toBlob(function (blob) {
          if (blob) { downloadBlob(blob, 'board-photo-sheet-4x6.jpg'); }
        }, 'image/jpeg', 0.92);
      };
      img.onerror = function () { URL.revokeObjectURL(url); };
      img.src = url;
    });
  }

  /* -- Restored: WhatsApp share (HONEST mechanism) -------------------------- */
  /* wa.me links carry TEXT only — no website can attach an image file
   * through a wa.me link. The old tool did exactly this: it opened a
   * wa.me text link (message + page URL). The fragment tells the user
   * to download the photo first and attach it manually in WhatsApp.
   * Nothing here uploads the image anywhere. */
  if (waBtn) {
    waBtn.addEventListener('click', function () {
      var msg = 'I made my board photo with DoKit Board Photo 🎓\n'
        + window.location.href;
      window.open('https://wa.me/?text=' + encodeURIComponent(msg),
        '_blank', 'noopener');
    });
  }

  /* -- Restored: "Use another photo" reset ---------------------------------- */
  if (againBtn) {
    againBtn.addEventListener('click', function () {
      loadedImg = null; currentBlob = null;
      if (currentURL) { URL.revokeObjectURL(currentURL); currentURL = null; }
      if (fileEl) { fileEl.value = ''; }
      canvasEl.style.display = 'none';
      if (dlEl) { dlEl.style.display = 'none'; }
      say((window.dkT ? window.dkT('rsv_1279', 'Choose another photo.') : 'Choose another photo.'));
      if (fileEl) { fileEl.click(); }
    });
  }

  /* -- Restored: camera capture (getUserMedia + snapshot) ------------------- */
  var camStream = null;
  function stopCam() {
    if (camStream) {
      camStream.getTracks().forEach(function (tr) { tr.stop(); });
      camStream = null;
    }
    if (camVideo) { camVideo.srcObject = null; }
  }
  function closeCam() {
    if (camModal) { camModal.hidden = true; }
    stopCam();
  }
  if (camBtn && camModal) {
    camBtn.addEventListener('click', function () {
      if (camErr) { camErr.hidden = true; }
      camModal.hidden = false;
      /* Clear fallback first: no camera API, or permission denied, both
       * land on the same honest message (never a silent failure). */
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (camErr) {
          camErr.textContent = (window.dkT ? window.dkT('rsv_1249', 'Camera not available on this device or browser. Please choose a photo file instead.') : 'Camera not available on this device or browser. Please choose a photo file instead.');
          camErr.hidden = false;
        }
        return;
      }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then(function (stream) {
          camStream = stream;
          if (camVideo) { camVideo.srcObject = stream; camVideo.play(); }
        })
        .catch(function () {
          if (camErr) {
            camErr.textContent = (window.dkT ? window.dkT('rsv_1250', 'Camera permission was denied or the camera is unavailable. Please allow camera access or choose a photo file instead.') : 'Camera permission was denied or the camera is unavailable. Please allow camera access or choose a photo file instead.');
            camErr.hidden = false;
          }
        });
    });
    if (camClose) { camClose.addEventListener('click', closeCam); }
    if (camX) { camX.addEventListener('click', closeCam); }
    camModal.addEventListener('click', function (e) {
      if (e.target === camModal) { closeCam(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !camModal.hidden) { closeCam(); }
    });
  }
  if (camShot && camVideo) {
    camShot.addEventListener('click', function () {
      if (!camVideo.videoWidth) { return; }
      var c = document.createElement('canvas');
      c.width = camVideo.videoWidth; c.height = camVideo.videoHeight;
      c.getContext('2d').drawImage(camVideo, 0, 0);
      var img = new Image();
      img.onload = function () {
        closeCam();
        loadedImg = img;
        say((window.dkT ? window.dkT('rsv_1251', 'Photo captured. Press \u201cMake board photo\u201d.') : 'Photo captured. Press \u201cMake board photo\u201d.'));
        rerender(false);
      };
      img.src = c.toDataURL('image/jpeg', 0.92);
    });
  }

  /* -- Restored: batch photos (multi-file, one output per input) ------------ */
  function decodeFile(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }
  function validImageFile(f) {
    return f && /^image\/(png|jpeg|webp)$/.test(f.type)
      && f.size <= 25 * 1024 * 1024;
  }
  if (batchBtn && batchInput) {
    batchBtn.addEventListener('click', function () { batchInput.click(); });
  }
  if (batchInput && batchList) {
    batchInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(batchInput.files || [], 0, 10)
        .filter(validImageFile);
      batchInput.value = '';
      batchList.innerHTML = '';
      if (!files.length) {
        batchList.innerHTML = '<li class="thint">' + (window.dkT ? window.dkT('rsv_1260', 'No valid photos chosen — pick PNG, JPG or WebP files under 25 MB.') : 'No valid photos chosen — pick PNG, JPG or WebP files under 25 MB.') + '</li>';
        return;
      }
      /* Each file goes through the SAME buildCanvas + fitBlob as the
       * single photo, so batch output always matches the current spec
       * and transforms — no second pipeline to drift. */
      files.forEach(function (f, idx) {
        var li = document.createElement('li');
        li.innerHTML = '<span class="thint">' + (window.dkT ? window.dkT('rsv_1261', 'Processing ') : 'Processing ') + esc(f.name) + ' \u2026</span>';
        batchList.appendChild(li);
        decodeFile(f).then(function (img) {
          var spec = effSpec();
          var built = buildCanvas(img, spec);
          return fitBlob(built, spec.kb * 1024).then(function (res) {
            if (!res.blob) {
              li.innerHTML = '<span class="thint">' + esc(f.name) + (window.dkT ? window.dkT('rsv_1262', ' — could not be processed.') : ' — could not be processed.') + '</span>';
              return;
            }
            var url = URL.createObjectURL(res.blob);
            li.innerHTML = '';
            var th = document.createElement('img');
            th.src = url; th.alt = f.name;
            var nm = document.createElement('span');
            nm.textContent = f.name + ' (' + spec.w + '\u00d7' + spec.h
              + ', ' + (res.blob.size / 1024).toFixed(1) + ' KB'
              + (res.over ? (window.dkT ? window.dkT('rsv_1263', ', over target') : ', over target') : '') + ')';
            var dl = document.createElement('button');
            dl.type = 'button'; dl.className = 'btn ghost';
            dl.textContent = (window.dkT ? window.dkT('rsv_1264', 'Download JPG') : 'Download JPG');
            dl.addEventListener('click', function () {
              downloadBlob(res.blob, 'board-photo-' + (idx + 1) + '.jpg');
            });
            li.appendChild(th); li.appendChild(nm); li.appendChild(dl);
          });
        }).catch(function () {
          li.innerHTML = '<span class="thint">' + esc(f.name) + (window.dkT ? window.dkT('rsv_1265', ' — could not be read.') : ' — could not be read.') + '</span>';
        });
      });
    });
  }
  /* -- Item 50 (NEW, not in the old deliverable): Email photo, HONEST -- */
  /* mailto: links cannot carry attachments — no website can attach a
   * file through mailto:. So this button downloads the made photo (so
   * the file is ready in Downloads) and opens a mail draft via
   * window.open, same pattern as the WhatsApp handler. The note next
   * to the button says plainly to attach the downloaded photo
   * manually. It never claims the photo is attached. */
  var emailBtn = $('emailBtn');
  if (emailBtn) {
    emailBtn.addEventListener('click', function () {
      if (!currentBlob) { say((window.dkT ? window.dkT('rsv_1254', 'Make a board photo first, then email it.') : 'Make a board photo first, then email it.')); return; }
      downloadBlob(currentBlob, 'board-photo.jpg');
      var subj = (window.dkT ? window.dkT('rsv_1255', 'My board photo') : 'My board photo');
      var body = (window.dkT ? window.dkT('rsv_1256', 'My board photo (made with DoKit Board Photo).') : 'My board photo (made with DoKit Board Photo).');
      window.open('mailto:?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(body), '_blank', 'noopener');
    });
  }
})();
