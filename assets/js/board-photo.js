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
 * Classic script, var only, no modules, no CDN, no backend.
 *
 * UI-EDITOR CORRECTION (18 Nov 2026, branch board-photo-ui-editor):
 *  - Single upload now shows the ACTUAL photo immediately (preview img)
 *    and a visible editing toolbar (crop / rotate / flip / enhance / B&W /
 *    brightness / contrast / saturation / temperature / colour picker /
 *    background removal / reset) — previously the only edits hid inside
 *    the Advanced panel and there was no preview before Make.
 *  - Automatic board-background replacement via assets/js/board-photo-segment.js
 *    (vendored MediaPipe Selfie Segmentation, colour fallback). The board
 *    preset bg is the default; a manual colour is a labelled override.
 *  - REMOVED UI: Advanced section, Preset Name field + Save Preset button,
 *    old Batch Mode (bulk has its own intake), Email Photo, Use Another
 *    Photo (replaced by Remove photo in the toolbar). Camera, B&W, Face
 *    Guide, Print Sheet, WhatsApp, Custom size, Background buttons kept.
 *  - Per-board note/source/bgMandatory re-attached from the orphan
 *    tools/board-photo/tool.js (verified requirements only, verbatim).
 *  - buildCanvas() now also honours per-call brightness/contrast/
 *    saturation/temp/crop/mask through opts (single-mode state) while the
 *    bulk engine keeps passing every field explicitly, so bulk output
 *    cannot drift.
 *
 * PIPELINE FIX (18 Nov 2026, branch board-photo-pipeline-fix):
 *  - Make Board Photo is now GATED on segmentation state: while the
 *    mask is pending Make is disabled; on failure Make refuses with a
 *    visible error + Retry / Try colour removal / Continue-as-is — a
 *    failed background is never presented as a finished board photo
 *    (the old code rendered the cover-crop and said "Ready").
 *  - The preview render no longer fits quality or publishes a download:
 *    only Make creates the final blob. A labelled Before / After
 *    compare shows the original and the exact final blob (one blob feeds
 *    the After <img> and the download link), and any edit after Make
 *    invalidates that final first. */
(function () {
  'use strict';

  /* DES-01: board-required photo background colours — JS-side constants.
   * These are per-board SPEC DATA (the board requires that background),
   * not theme colours: they deliberately do NOT follow :root tokens, so
   * a theme change can never alter a board's required photo background.
   * Values unchanged; only the literals are named once. */
  var BG_BLUE = '#2e7cd6', BG_PALE_BLUE = '#e6f0ff', BG_LIGHT_BLUE = '#add8e6';

  /* -- Board specs (single source, copied from the Phase 2b file) -------- */
  var BOARDS = [{"id": "bise-bahawalpur", "name": "BISE Bahawalpur", "w": 150, "h": 200, "kb": 22, "bg": BG_PALE_BLUE, "bg_name": "blue", "verified": true}, {"id": "bise-peshawar", "name": "BISE Peshawar", "w": 300, "h": 300, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "bise-swat", "name": "BISE Swat", "w": 300, "h": 300, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "bie-karachi", "name": "BIE Karachi", "w": 200, "h": 230, "kb": 50, "bg": BG_PALE_BLUE, "bg_name": "blue", "verified": true}, {"id": "bbise-quetta", "name": "BBISE Quetta", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "lums", "name": "LUMS", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "karachi-university", "name": "University of Karachi", "w": 230, "h": 200, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "nust", "name": "NUST", "w": 200, "h": 230, "kb": 50, "bg": BG_PALE_BLUE, "bg_name": "blue", "verified": true}, {"id": "uet-lahore", "name": "UET Lahore", "w": 200, "h": 230, "kb": 1024, "bg": "#f8f8f8", "bg_name": "light", "verified": true}, {"id": "fbise", "name": "FBISE (Federal Board)", "w": 200, "h": 230, "kb": 50, "bg": BG_BLUE, "bg_name": "blue", "verified": true}, {"id": "bise-lahore", "name": "BISE Lahore", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "bise-gujranwala", "name": "BISE Gujranwala", "w": 200, "h": 230, "kb": 18, "bg": BG_BLUE, "bg_name": "blue", "verified": false}, {"id": "bise-rawalpindi", "name": "BISE Rawalpindi", "w": 200, "h": 230, "kb": 18, "bg": BG_BLUE, "bg_name": "blue", "verified": false}, {"id": "bise-multan", "name": "BISE Multan", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-faisalabad", "name": "BISE Faisalabad", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-sargodha", "name": "BISE Sargodha", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-dg-khan", "name": "BISE D.G. Khan", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-sahiwal", "name": "BISE Sahiwal", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-hyderabad", "name": "BISE Hyderabad", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-sukkur", "name": "BISE Sukkur", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-larkana", "name": "BISE Larkana", "w": 200, "h": 230, "kb": 1024, "bg": BG_LIGHT_BLUE, "bg_name": "light blue", "verified": true}, {"id": "bise-mirpurkhas", "name": "BISE Mirpurkhas", "w": 200, "h": 230, "kb": 1024, "bg": BG_LIGHT_BLUE, "bg_name": "light blue", "verified": true}, {"id": "bise-mardan", "name": "BISE Mardan", "w": 300, "h": 300, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "bise-kohat", "name": "BISE Kohat", "w": 300, "h": 300, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "bise-abbottabad", "name": "BISE Abbottabad", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-dikhan", "name": "BISE D.I. Khan", "w": 300, "h": 300, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "ajk-board", "name": "AJK Board Mirpur", "w": 200, "h": 230, "kb": 1024, "bg": BG_BLUE, "bg_name": "blue", "verified": true}, {"id": "punjab-university", "name": "Punjab University", "w": 800, "h": 1000, "kb": 200, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "iba-karachi", "name": "IBA Karachi", "w": 200, "h": 230, "kb": 2048, "bg": BG_BLUE, "bg_name": "blue", "verified": true}, {"id": "comsats", "name": "COMSATS", "w": 200, "h": 230, "kb": 50, "bg": BG_BLUE, "bg_name": "blue", "verified": true}, {"id": "aiou", "name": "AIOU", "w": 200, "h": 230, "kb": 50, "bg": BG_BLUE, "bg_name": "blue", "verified": true}, {"id": "generic", "name": "Pakistani admission (typical)", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}];
  /* Board notes/sources/bgMandatory — re-attached from the orphan
   * tools/board-photo/tool.js (18 Nov 2026). tool.js is the dead divergent
   * bundle (D-3, never edited); its note/source strings document
   * already-verified requirements, so they are copied here VERBATIM for
   * verified boards only. Unverified boards get no note/source: their
   * specs are "typical standard", not requirements.
   * bgMandatory is true ONLY when the verified note names ONE required bg
   * colour. FBISE ("Blue or white" — a choice) and Punjab University
   * ("white assumed" — not published) are false, honestly. */
  var BOARD_NOTES = {
    'bise-bahawalpur': { note: 'Official 2026 registration notice: 100\u2013150 px wide, 150\u2013200 px tall, 8\u201322 KB, blue background, head-to-shoulder photo.', source: 'Notification No. 132-Registration, 27-08-2026 (bisebwp.edu.pk)', bgMandatory: true },
    'bise-peshawar': { note: '300\u00d7300 px, white background, JPG.', source: 'BISE Peshawar notification 05/Gen:/Reg:/BISEP (31-10-2022), reaffirmed 2026', bgMandatory: true },
    'bise-swat': { note: '300\u00d7300 px, white background. KB limit not published \u2014 50 KB assumed.', source: 'BISE Swat 9th enrollment notification (bisess.edu.pk)', bgMandatory: true },
    'bie-karachi': { note: 'Passport size, blue background.', source: 'biek.edu.pk enrolment instructions & official forms F04/F08', bgMandatory: true },
    'bbise-quetta': { note: 'White background. Pixel/KB not published \u2014 typical standard used.', source: 'BBISE SSC private registration portal (ssc2.bbise.edu.pk)', bgMandatory: true },
    'lums': { note: 'Passport-size, white background. Pixel/KB not published \u2014 typical standard used.', source: 'admission.lums.edu.pk checklist', bgMandatory: true },
    'karachi-university': { note: 'KU needs LANDSCAPE orientation (unusual) \u2014 double-check before uploading.', source: 'uokadmission.edu.pk profile-picture instructions', bgMandatory: true },
    'nust': { note: 'Light blue background (joining documents); portal specs not published.', source: 'pnec.nust.edu.pk joining instructions', bgMandatory: true },
    'uet-lahore': { note: 'JPG/PNG, max 1 MB, light background. Pixels not published \u2014 typical standard used.', source: 'UET ECAT 2020 official instructions', bgMandatory: true },
    'fbise': { note: 'Blue or white background. Pixels/KB not published \u2014 typical standard used.', source: 'FBISE notification F-01/FBISE/SSC-A/2nd AE-26/0167 (29-07-2026)', bgMandatory: false },
    'bise-lahore': { note: 'White background (official portals). Pixels/KB not published \u2014 typical standard used.', source: 'BISE Lahore registration portals', bgMandatory: true },
    'bise-larkana': { note: 'Light blue background, under 1 MB. Pixels not published \u2014 typical standard used.', source: 'BISE Larkana notification BISE/ACD/LRK/175/2026 (17-09-2026)', bgMandatory: true },
    'bise-mirpurkhas': { note: 'Light blue background, under 1 MB. Pixels not published \u2014 typical standard used.', source: 'BISE Mirpurkhas notification BISE/HSC-Enrolment/MPS/-01 (09-01-2024)', bgMandatory: true },
    'bise-mardan': { note: '300\u00d7300 px, white background.', source: 'BISE Mardan notifications 2017\u20132018 (bisemdn.edu.pk)', bgMandatory: true },
    'bise-kohat': { note: '300\u00d7300 px, white background.', source: 'BISE Kohat notification 142/Gen:/Reg/BISEK (10-09-2025)', bgMandatory: true },
    'bise-dikhan': { note: '300\u00d7300 px, white background.', source: 'BISE D.I. Khan notification (16-05-2019)', bgMandatory: true },
    'ajk-board': { note: 'Passport size, blue background, under 1 MB, JPG. Pixels not published \u2014 typical standard used.', source: 'AJK BISE registration booklets (ajkbise.net)', bgMandatory: true },
    'punjab-university': { note: 'Max 200 KB, max 800\u00d71000 px. Background not published \u2014 white assumed.', source: 'pu.edu.pk official FAQ', bgMandatory: false },
    'iba-karachi': { note: 'Blue background, JPG/GIF/PNG up to 2 MB (testing-services form). Pixels not published \u2014 typical standard used.', source: 'iba.edu.pk testing services form', bgMandatory: true },
    'comsats': { note: 'Blue background. Pixels/KB not published \u2014 typical standard used.', source: 'CUI prospectus for international students', bgMandatory: true },
    'aiou': { note: 'Passport size, blue background. Pixels/KB not published \u2014 typical standard used.', source: 'aiou.edu.pk admission FAQ', bgMandatory: true }
  };
  BOARDS.forEach(function (b) {
    var n = BOARD_NOTES[b.id];
    b.bgMandatory = !!(n && b.verified && n.bgMandatory);
    if (n && b.verified) { b.note = n.note; b.source = n.source; }
  });
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
  var sheetBtn = $('sheetBtn'), waBtn = $('waBtn');
  var cwEl = $('cw'), chEl = $('ch'), ckbEl = $('ckb'), customBtn = $('customBtn');
  /* REMOVED 18 Nov 2026 (UI-editor correction): Advanced section
   * (#advToggle/#advSection/#advBody), Preset Name (#presetName) +
   * Save Preset (#savePresetBtn), old Batch Mode (#batchBtn/#batchInput/
   * #batchList), Email Photo (#emailBtn), Use Another Photo (#againBtn).
   * Their handlers are deleted below; the elements are gone from the HTML.
   * Relocated into the visible toolbar: Enhance/Rotate/Flip, B&W, Face
   * Guide, Camera. Preset chips (#presetRow) survive — presets saved in
   * the bulk editor still apply here. */
  var enhanceBtn = $('enhanceBtn'), rotL = $('rotL'), rotR = $('rotR'), flipBtn = $('flipH');
  var presetRow = $('presetRow');
  var toolbarEl = $('bp-toolbar'), previewImg = $('bp-preview-img'), dzEl = $('dz');
  var dzLabel = $('bp-dz-label'), segStatusEl = $('bp-seg-status'), bgWarnEl = $('bp-bg-warn');
  var cropBtn = $('bp-crop-btn'), cropWrap = $('bp-crop-wrap'), cropCanvas = $('bp-crop-canvas');
  var cropApply = $('bp-crop-apply'), cropCancel = $('bp-crop-cancel');
  var resetBtn = $('bp-reset-btn'), removeBtn = $('bp-remove-photo');
  var rmbgToggle = $('bp-rmbg'), featherEl = $('bp-feather'), featherVal = $('bp-feather-v');
  var bgColorEl = $('bp-bg-color');
  /* PIPELINE FIX elements (18 Nov 2026): the segmentation failure box
   * and the labelled Before / After compare section (both hidden until
   * used). */
  var segFailBox = $('bp-seg-fail'), segFailMsg = $('bp-seg-fail-msg');
  var segRetryBtn = $('bp-seg-retry'), segColourBtn = $('bp-seg-colour'),
      segContinueBtn = $('bp-seg-continue');
  var compareEl = $('bp-compare'), beforeImg = $('bp-before-img'),
      afterImg = $('bp-after-img'), beforeMeta = $('bp-before-meta'),
      afterMeta = $('bp-after-meta');
  /* After-image zoom (image-quality round, 18 Nov 2026): 100% = actual
   * pixels, 200%/300% for edge inspection. At 300% the image renders
   * pixelated so the user sees the real pixels, not a smoothed upscale.
   * Zoom only changes how the FINAL blob is displayed — never the file. */
  var zoomBtns = document.querySelectorAll('.bp-zoom-btn');
  function setAfterZoom(z) {
    if (!afterImg) { return; }
    var base = afterImg.naturalWidth || 150;
    afterImg.style.width = (base * z) + 'px';
    afterImg.style.maxWidth = 'none';
    afterImg.style.maxHeight = 'none';
    afterImg.style.imageRendering = (z >= 3) ? 'pixelated' : 'auto';
    for (var i = 0; i < zoomBtns.length; i++) {
      var on = Number(zoomBtns[i].getAttribute('data-zoom')) === z;
      zoomBtns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      zoomBtns[i].classList.toggle('active', on);
    }
  }
  for (var zi = 0; zi < zoomBtns.length; zi++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        setAfterZoom(Number(btn.getAttribute('data-zoom')) || 1);
      });
    })(zoomBtns[zi]);
  }
  var bwToggle = $('bwToggle'), guideToggle = $('guideToggle'), faceGuide = $('faceGuide');
  var camBtn = $('camBtn'), camModal = $('camModal'), camVideo = $('camVideo');
  var camErr = $('camErr'), camClose = $('camClose'), camX = $('camX'), camShot = $('camShot');

  /* -- State -------------------------------------------------------------- */
  var current = BOARDS[0];
  var loadedImg = null;     // uploaded (or camera-captured) photo
  var currentBlob = null;   // last fitted single-photo output
  var currentURL = null;    // object URL of currentBlob (revoked on replace)
  var customSpec = null;    // {w,h,kb} when the user overrides the board spec
  var bgOverride = null;    // null = board bg; 'original' = no fill; else colour
  var rotation = 0, flipH = false, bwOn = false, enhanceOn = false;
  /* Single-mode edit state (UI-editor correction): the toolbar binds to
   * these; buildCanvas() reads them through opts._single (bulk always
   * passes every field explicitly, so it can never pick these up). */
  var adj = { brightness: 1, contrast: 1, saturation: 1, temp: 0 };
  var singleCrop = null;    // fractions {x,y,w,h} of the source image, or null
  var segMask = null;       // segmentation mask canvas at source size, or null
  var segEngine = '';       // 'mediapipe' | 'colour' | '' (none yet / failed)
  var removeBgOn = true;    // "Remove background" toggle (default ON)
  var featherPx = 1;        // mask edge feather, px at output size (default 1: measured 18 Nov 2026 — feather 2 widened the halo band)
  var loadedDataUrl = null; // original upload, kept independent of output
  /* PIPELINE FIX (18 Nov 2026): segmentation state machine. The old code
   * had no state at all — Make just rendered whatever mask happened to
   * exist (usually none, in the first seconds after upload) and called
   * the result "Ready". Now Make is gated on this state:
   *   idle        — no segmentation run yet for this photo
   *   pending     — a run is in flight; Make is disabled meanwhile
   *   ready       — a usable mask exists; Make may run the full pipeline
   *   failed      — no usable mask (both engines); Make must NOT produce
   *                 a "Ready" board photo — error + Retry / colour /
   *                 continue-as-is instead
   *   unavailable — the segment module itself is missing; same as failed
   *   off         — the user turned background removal off (or chose
   *                 continue-as-is): Make runs the cover-crop pipeline
   *                 and says so honestly, no board-bg claim. */
  var segState = 'idle';
  var segRunId = 0;         // guards async runs against a newer upload
  var finalSeq = 0;         // guards async Make against a newer edit/Make
  var finalReady = false;   // a Make-produced final output exists for the current state
  /* NOTE (bulk upgrade, master prompt §9): NO name/date stamp is drawn on
   * any photo any more. The old stamp controls were removed with the
   * stamp-drawing code — text, logos and watermarks are prohibited on
   * output photos; serial numbers live only in filenames. */

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
  /* Custom size fields show the board's own spec (live-fix round).
   * WHY sync: the fields kept their 200x230/50 defaults even when BISE
   * Bahawalpur (150x200, max 22 KB) was selected, although Make correctly
   * used the preset — the fields lied about what Make would do. They are
   * the starting point for a custom override, so they always show the
   * currently effective spec. Only called when no custom override is
   * active (init + board change, where customSpec is cleared). */
  function syncCustomFields() {
    var b = effSpec();
    if (cwEl) { cwEl.value = b.w; }
    if (chEl) { chEl.value = b.h; }
    if (ckbEl) { ckbEl.value = b.kb; }
  }
  /* Loaded-file name (live-fix round): the file input is cleared after
   * every pick (so re-picking the same file fires change again), which
   * makes the native control read "No file chosen" even though a photo
   * IS loaded. This line is the honest record; file names are user data
   * so it is set via textContent, never HTML. */
  var fileNameEl = $('bp-filename');
  function showLoadedName(name) {
    if (fileNameEl) { fileNameEl.textContent = name || ''; }
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
      + (!b.custom && current.id === 'bise-bahawalpur' ? '<p>' + BWP_NOTE + '</p>' : '')
      + (!b.custom && current.source ? '<p class="note">' + (window.dkT ? window.dkT('bp.spec_source', 'Source: ') : 'Source: ') + esc(current.source) + '</p>' : '')
      + (!b.custom && current.note && current.id !== 'bise-bahawalpur' ? '<p class="note">' + esc(current.note) + '</p>' : '');
  }
  fillOptions(BOARDS);
  showSpec();
  syncCustomFields();
  selectEl.addEventListener('change', function () {
    var found = BOARDS.filter(function (b) { return b.id === selectEl.value; });
    if (found.length) {
      current = found[0];
      /* New board = fresh start: custom size and bg override do not leak
       * from the previous board into this board's photo. */
      customSpec = null; bgOverride = null;
      showSpec(); syncCustomFields(); syncBgBtns(); syncBgWarning(); syncBgColorPicker(); syncMakeBtn(); rerender(true);
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
   * portrait/landscape-flipped), everything else is drawn on top.
   * opts (all optional) lets the bulk engine drive per-image settings
   * through this SAME code path: {rotation, flipH, bw, enhance, bg,
   * brightness, contrast, saturation, temp, crop:{x,y,w,h}}. With no
   * opts the single-photo module globals apply, so the legacy flow
   * renders exactly as before. Crop rects are SOURCE pixels. No text,
   * logo or watermark is ever drawn here (master rule §9). */
  /* Head-safe cover-crop rect (source pixels) — shared by buildCanvas()
   * and the single-mode crop UI, so the cropper's default rect is exactly
   * what Make would have used. Top bias 0.32 keeps heads in frame. */
  function coverCropRect(iw, ih, outW, outH) {
    var scale = Math.max(outW / iw, outH / ih);
    var cw = Math.round(outW / scale), ch = Math.round(outH / scale);
    return { x: Math.max(0, Math.round((iw - cw) / 2)),
      y: Math.max(0, Math.round((ih - ch) * 0.32)), w: cw, h: ch };
  }
  /* Mask bounding box (source pixels, threshold >127, sampled every 4th
   * pixel for speed). Returns null when the mask is empty. */
  /* Mask bounding box (threshold >127). Reads the RED channel: the
   * ORIGINAL segMask carries its binary hard classification in RED
   * (measured 18 Nov 2026) — the refined mask is never passed here.
   * yMax (optional): only scan rows above this source y — used for the
   * head-zone bbox (see subjectCropRect). */
  function maskBBox(maskCanvas, yMax) {
    if (!maskCanvas) { return null; }
    var w = maskCanvas.width, h = maskCanvas.height;
    var d;
    try { d = maskCanvas.getContext('2d').getImageData(0, 0, w, h).data; }
    catch (e) { return null; }
    var yEnd = (yMax !== undefined && yMax < h) ? yMax : h;
    var x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (var y = 0; y < yEnd; y += 4) {
      for (var x = 0; x < w; x += 4) {
        if (d[(y * w + x) * 4] > 127) {
          if (x < x0) { x0 = x; } if (x > x1) { x1 = x; }
          if (y < y0) { y0 = y; } if (y > y1) { y1 = y; }
        }
      }
    }
    if (x1 < 0) { return null; }
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }
  /* Smart Subject Framing (image-quality round, 18 Nov 2026): the cover
   * crop's fixed 0.32 top bias is NOT subject-aware — measured top
   * margins of 0px (head touching the frame) on real photos whose head
   * sits near the top of the source, and side margins of 0px (shoulders
   * touching both edges). When a segmentation mask exists, position the
   * window from the MASK bbox instead: head-top margin >= 8% of the
   * output height, side margins >= 4% of the output width, where the
   * subject fits. If the subject is wider/taller than the window, centre
   * it (symmetric cut) and set warn=true so the UI can say so honestly
   * instead of silently cutting an ear or a shoulder. Returns the same
   * {x,y,w,h} shape as coverCropRect, plus .warn. */
  function subjectCropRect(iw, ih, outW, outH, maskCanvas) {
    var win = coverCropRect(iw, ih, outW, outH);
    var bb = maskBBox(maskCanvas);
    if (!bb) { win.warn = false; return win; }
    var px = outW / win.w, py = outH / win.h; /* output px per source px */
    var topWant = Math.round(outH * 0.08), sideWant = Math.round(outW * 0.04);
    var warn = false;
    /* Head zone = top 45% of the subject (face + ears live here). The
     * shoulders below are WIDER and may touch the frame edges — that is
     * normal ID framing, not a cut — so the horizontal fit and its
     * warning use the head zone only. Centring on the head also puts
     * the face in the middle of the frame, not the shoulders. */
    var headBB = maskBBox(maskCanvas, bb.y0 + Math.round((bb.y1 - bb.y0) * 0.45)) || bb;
    /* Horizontal: shift the window so the head zone has sideWant on both
     * sides. If the head zone is wider than the window allows, centre it
     * (symmetric). */
    var leftM = (headBB.x0 - win.x) * px, rightM = (win.x + win.w - 1 - headBB.x1) * px;
    if (leftM < sideWant || rightM < sideWant) {
      var cx = (headBB.x0 + headBB.x1) / 2;
      var nx = Math.round(cx - win.w / 2);
      if ((headBB.x1 - headBB.x0) * px > outW - 2 * sideWant) { warn = true; }
      win.x = Math.max(0, Math.min(iw - win.w, nx));
    }
    /* Vertical: head margin first. If the mask is taller than the window,
     * align the top (head margin) and cut the bottom — shoulders at the
     * bottom edge are normal for board photos, a cut head is not. */
    var topM = (bb.y0 - win.y) * py;
    if (topM < topWant) {
      var ny = Math.round(bb.y0 - topWant / py);
      if ((bb.y1 - bb.y0) * py > outH - topWant) { warn = true; }
      win.y = Math.max(0, Math.min(ih - win.h, ny));
    }
    win.warn = warn;
    return win;
  }
  function buildCanvas(img, spec, opts) {
    var o = opts || {};
    var single = !!o._single; /* single-mode state applies ONLY with this flag (bulk never sets it) */
    /* WHY per-field fallback (not Object.assign): the module globals are
     * the single-photo state; bulk passes only the fields it overrides. */
    var rot = (((o.rotation !== undefined ? o.rotation : rotation) % 360) + 360) % 360;
    var flip = (o.flipH !== undefined ? o.flipH : flipH);
    var bw = (o.bw !== undefined ? o.bw : bwOn);
    var enh = (o.enhance !== undefined ? o.enhance : enhanceOn);
    var outW = (rot === 90 || rot === 270) ? spec.h : spec.w;
    var outH = (rot === 90 || rot === 270) ? spec.w : spec.h;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    /* Source window: an explicit crop rect wins; otherwise the head-safe
     * cover crop — fill the frame, bias the crop window toward the top
     * (0.32) so a head is not cut off at the top edge. */
    var cw, ch, sx, sy;
    /* Explicit crop wins; in single mode the toolbar crop (fractions of
     * the source image) converts to source pixels here. */
    var cropPx = null;
    if (o.crop && o.crop.w > 0 && o.crop.h > 0) {
      cropPx = { x: o.crop.x || 0, y: o.crop.y || 0, w: o.crop.w, h: o.crop.h };
    } else if (single && singleCrop) {
      cropPx = { x: Math.round(singleCrop.x * iw), y: Math.round(singleCrop.y * ih),
        w: Math.round(singleCrop.w * iw), h: Math.round(singleCrop.h * ih) };
    }
    /* The mask is resolved BEFORE the window: Smart Subject Framing
     * positions the default window from the mask bbox (see
     * subjectCropRect). Bulk passes its mask via o.mask; single mode uses
     * the live segMask when background removal is on. */
    var mask = (single && removeBgOn) ? segMask : (o.mask || null);
    var cropWarn = false;
    if (cropPx) {
      cw = Math.min(cropPx.w, iw); ch = Math.min(cropPx.h, ih);
      sx = Math.max(0, Math.min(cropPx.x, iw - cw));
      sy = Math.max(0, Math.min(cropPx.y, ih - ch));
    } else {
      var cc = (single && mask && window.DKBoardSegment)
        ? subjectCropRect(iw, ih, outW, outH, mask)
        : coverCropRect(iw, ih, outW, outH);
      cw = cc.w; ch = cc.h; sx = cc.x; sy = cc.y;
      cropWarn = !!cc.warn;
    }
    /* The crop warning is visible to the UI/tests: the subject could not
     * be framed with safe margins (wider/taller than the frame). */
    window.__bpCropWarn = cropWarn;
    var canvas = document.createElement('canvas');
    canvas.width = outW; canvas.height = outH;
    var ctx = canvas.getContext('2d');
    /* 'original' means: do not paint any background (photo pixels only,
     * letterboxed by the cover crop itself). Otherwise the chosen bg. */
    var bgVal = (o.bg !== undefined ? o.bg : bgOverride);
    var fill = bgVal === 'original' ? null : (bgVal || spec.bg || '#ffffff');
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(0, 0, outW, outH); }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    /* Filters: Enhance is a gentle lift only — it never alters the face,
     * just brightness/contrast/saturation, as in the old tool. Per-image
     * adjustments multiply on top of it. */
    var filters = [];
    if (bw) { filters.push('grayscale(1)'); }
    /* Single-mode slider values apply only with opts._single; bulk passes
     * every field explicitly, so its numbers are untouched. */
    function adjVal(key, fallback) {
      if (o[key] !== undefined) { return o[key]; }
      return single ? adj[key] : fallback;
    }
    var br = (enh ? 1.06 : 1) * adjVal('brightness', 1);
    var ct = (enh ? 1.12 : 1) * adjVal('contrast', 1);
    var st = (enh ? 1.08 : 1) * adjVal('saturation', 1);
    if (br !== 1 || ct !== 1 || st !== 1) {
      filters.push('brightness(' + br.toFixed(3) + ') contrast(' + ct.toFixed(3)
        + ') saturate(' + st.toFixed(3) + ')');
    }
    /* Quality test seam (image-quality round, 18 Nov 2026): tests may
     * override pipeline constants via window.__bpQuality before Make
     * (ablation runs). Production defaults are the measured winners.
     *   chokePx: mask erosion px at output size (default 1)
     *   sharpen: unsharp amount on the subject interior (default 0.25)
     *   stepDown: two-step downscale on/off (default true) */
    var __Q = (typeof window !== 'undefined' && window.__bpQuality) || {};
    var chokePx = (__Q.chokePx !== undefined) ? __Q.chokePx : 1;
    var sharpAmt = (__Q.sharpen !== undefined) ? __Q.sharpen : 0.25;
    var stepDown = (__Q.stepDown !== undefined) ? !!__Q.stepDown : true;
    /* Ablation-only overrides (default = the live slider / on): featherPx
     * and decont let tests vary the edge pipeline per Make without
     * touching the UI. Production never sets __bpQuality. */
    var qFeatherPx = (__Q.featherPx !== undefined) ? __Q.featherPx : featherPx;
    var qDecont = (__Q.decont !== undefined) ? !!__Q.decont : true;
    /* The subject draw (transforms + filters), shared by the plain path
     * and the masked path so the two can never drift apart.
     * STEP-DOWN (measured 18 Nov 2026, real canvas): a single 800->150
     * draw loses sharpness (Laplacian variance 1351); drawing to a 2x
     * intermediate first, then 2:1 down, recovers +23% (1660) — the
     * browser's resampler keeps more detail at a 2:1 ratio than at 5:1.
     * Two steps are used only when the source window is >2x the output
     * (otherwise a single draw is already a small ratio). */
    function drawSubject(c2) {
      c2.filter = filters.length ? filters.join(' ') : 'none';
      var ratio = Math.max(cw / outW, ch / outH);
      if (stepDown && ratio > 2) {
        var mid = document.createElement('canvas');
        mid.width = outW * 2; mid.height = outH * 2;
        var m2 = mid.getContext('2d');
        m2.imageSmoothingEnabled = true; m2.imageSmoothingQuality = 'high';
        m2.filter = c2.filter;
        m2.save();
        m2.translate(outW, outH);
        if (flip) { m2.scale(-1, 1); }
        m2.rotate(rot * Math.PI / 180);
        m2.drawImage(img, sx, sy, cw, ch, -outW, -outH, outW * 2, outH * 2);
        m2.restore();
        m2.filter = 'none';
        /* The filter was already applied at the intermediate draw — the
         * 2:1 downscale below must run unfiltered, or brightness/
         * contrast would be applied TWICE. */
        c2.filter = 'none';
        c2.save();
        c2.imageSmoothingEnabled = true; c2.imageSmoothingQuality = 'high';
        c2.drawImage(mid, 0, 0, outW, outH);
        c2.restore();
      } else {
        c2.save();
        c2.translate(outW / 2, outH / 2);
        if (flip) { c2.scale(-1, 1); }
        c2.rotate(rot * Math.PI / 180);
        c2.drawImage(img, sx, sy, cw, ch, -outW / 2, -outH / 2, outW, outH);
        c2.restore();
      }
      c2.filter = 'none';
    }
    /* Colour temperature: a warm/cool tint overlay at low alpha. It shifts
     * colour balance only — no pixels are invented, no face is changed. */
    var temp = adjVal('temp', 0);
    function applyTemp(c2) {
      if (temp === 0) { return; }
      c2.save();
      c2.globalCompositeOperation = 'overlay';
      c2.globalAlpha = Math.min(0.12, Math.abs(temp) / 100 * 0.12);
      c2.fillStyle = temp > 0 ? '#ff9a3c' : '#3c7dff';
      c2.fillRect(0, 0, outW, outH);
      c2.restore();
    }
    /* Masked path (image-quality round, 18 Nov 2026): the subject is drawn
     * to a temp canvas (step-down, see drawSubject), the temp tint applied,
     * then the mask — refined at OUTPUT size (choke + bounded feather),
     * never blurred at source size — cuts the background out, the edge band
     * is decontaminated (old-background colour out, subject colour in),
     * and the result is laid over the board-colour fill. A gentle capture
     * sharpening runs on the final canvas, gated to the opaque mask
     * interior. Without a mask (toggle off, or segmentation failed) the
     * plain cover-crop path runs exactly as before. */
    if (mask && window.DKBoardSegment) {
      var tmp = document.createElement('canvas');
      tmp.width = outW; tmp.height = outH;
      var tctx = tmp.getContext('2d');
      drawSubject(tctx);
      applyTemp(tctx);
      /* The mask lives at SOURCE size, so it must go through the SAME
       * source window (sx/sy/cw/ch) and the SAME flip/rotate transforms as
       * the subject — drawing the whole mask scaled to outW/outH would
       * squeeze a landscape mask into a portrait frame and cut a narrow
       * strip out of the face (caught on a landscape portrait, 18 Nov 2026:
       * the face came out tall and narrow). */
      var mCanvas = document.createElement('canvas');
      mCanvas.width = outW; mCanvas.height = outH;
      var mctx = mCanvas.getContext('2d');
      mctx.save();
      mctx.translate(outW / 2, outH / 2);
      if (flip) { mctx.scale(-1, 1); }
      mctx.rotate(rot * Math.PI / 180);
      mctx.drawImage(mask, sx, sy, cw, ch, -outW / 2, -outH / 2, outW, outH);
      mctx.restore();
      /* Refine at output size: the 1px choke cuts the pale fringe and the
       * slider's feather becomes a bounded box blur (see refineMask). */
      mCanvas = window.DKBoardSegment.refineMask(mCanvas, chokePx, qFeatherPx);
      /* destination-in with the refined mask (feather 0 here — the blur
       * already happened inside refineMask). */
      window.DKBoardSegment.applyMaskToCanvas(tmp, mCanvas, 0);
      /* Recolour the edge band from the subject (no old-bg spill). */
      if (qDecont) { window.DKBoardSegment.decontaminate(tmp, mCanvas); }
      ctx.drawImage(tmp, 0, 0);
      /* Gentle sharpening, subject interior only (mask-gated). */
      window.DKBoardSegment.sharpenSubject(canvas, mCanvas, sharpAmt);
    } else {
      drawSubject(ctx);
      applyTemp(ctx);
    }
    return canvas;
  }
  /* Binary-search JPEG quality for the largest quality that still fits
   * the KB target. Resolves {blob, over}: over=true means even the
   * lowest quality stayed over target (caller must say so honestly).
   * DIAGNOSTIC (image-quality round, 18 Nov 2026): the chosen quality
   * is recorded on window.__bpFitQ so tests can tell whether JPEG
   * compression — or something else — is softening the final image.
   * Production code never reads this hook. */
  function fitBlob(canvas, targetBytes) {
    return new Promise(function (resolve) {
      var lo = 0.05, hi = 0.95, best = null, bestQ = null;
      function attempt(q) {
        canvas.toBlob(function (blob) {
          if (!blob) { resolve({ blob: null, over: true }); return; }
          if (blob.size <= targetBytes) {
            best = blob; bestQ = q;
            if (hi - lo < 0.02) {
              window.__bpFitQ = bestQ;
              resolve({ blob: best, over: false }); return; }
            lo = q; attempt((q + hi) / 2);
          } else {
            if (hi - lo < 0.02) {
              if (best) {
                window.__bpFitQ = bestQ;
                resolve({ blob: best, over: false }); return; }
              canvas.toBlob(function (b2) {
                window.__bpFitQ = lo;
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
  /* Re-render the single-photo PREVIEW. Preview only: it builds the
   * canvas and paints it, but it never fits JPEG quality, never creates
   * a blob and never shows a download link — the preview is not a final
   * output. Make (makeBoardPhoto) is the ONLY path that fits quality,
   * creates the blob, and shows the download. (PIPELINE FIX, 18 Nov 2026:
   * the old rerender fitted + published a download on every preview
   * render, so a pre-mask preview could be downloaded as a "board
   * photo" before Make ever ran.)
   * Any call here after a successful Make invalidates that final first:
   * an edit after Make must never leave a stale After preview + download
   * that no longer matches the toolbar state. silent is retained for
   * call-site compatibility; the preview never writes a status message. */
  function rerender(silent) {
    if (!loadedImg) { return; }
    finalSeq++; /* a newer render supersedes any Make still fitting */
    if (finalReady) { invalidateFinal(); }
    var spec = effSpec();
    var built = buildCanvas(loadedImg, spec, { _single: true });
    /* Show the on-page canvas immediately (preview). */
    canvasEl.width = built.width; canvasEl.height = built.height;
    canvasEl.getContext('2d').drawImage(built, 0, 0);
    canvasEl.style.display = '';
  }
  /* Clear a Make-produced final output: the After preview, the download
   * link and the blob all die together (they are one source of truth).
   * Called when any edit / board change / new upload supersedes it. */
  function invalidateFinal() {
    finalReady = false;
    finalSeq++;
    if (currentURL) { URL.revokeObjectURL(currentURL); currentURL = null; }
    currentBlob = null;
    if (compareEl) { compareEl.hidden = true; }
    if (afterImg) { afterImg.removeAttribute('src'); setAfterZoom(1); }
    if (dlEl) { dlEl.style.display = 'none'; dlEl.removeAttribute('href'); }
  }

  /* -- Upload (Phase 2b: FileReader only, never uploaded anywhere) -------- */
  /* Single-photo load, shared by file pick, drag & drop and camera capture.
   * A new photo is a fresh start: every edit resets (a crop from the old
   * photo must never apply to the new one). The ACTUAL photo is shown at
   * once in the preview area, the toolbar appears, and the processed
   * preview renders immediately — Make is no longer the way to discover
   * either. Segmentation then runs in the background; when its mask lands
   * the preview re-renders with the board background applied. */
  function resetSingleEdits() {
    rotation = 0; flipH = false; bwOn = false; enhanceOn = false;
    adj = { brightness: 1, contrast: 1, saturation: 1, temp: 0 };
    singleCrop = null; segMask = null; segEngine = '';
    removeBgOn = true; featherPx = 1; bgOverride = null;
    /* PIPELINE FIX: a fresh photo starts with no mask and no final —
     * the old final (a different photo) must die here, not linger. */
    segState = 'idle'; segRunId++;
    hideSegFail();
    invalidateFinal();
    syncToolbarControls(); syncBgBtns(); syncBgWarning();
    syncMakeBtn();
    if (cropWrap) { cropWrap.hidden = true; }
  }
  function setLoadedImage(img, name, dataUrl) {
    loadedImg = img;
    loadedDataUrl = dataUrl || null;
    resetSingleEdits();
    showLoadedName(name);
    /* Actual-photo preview: replaces the "Your photo" label. The original
     * stays independent — edits only ever affect the processed canvas. */
    if (previewImg && dataUrl) {
      previewImg.src = dataUrl;
      previewImg.hidden = false;
      previewImg.alt = name || '';
    }
    if (dzLabel) { dzLabel.hidden = true; }
    if (toolbarEl) { toolbarEl.hidden = false; }
    say(window.dkT ? window.dkT('bp.ed_loaded', 'Photo loaded \u2014 edit it below, then press \u201cMake board photo\u201d.') : 'Photo loaded \u2014 edit it below, then press \u201cMake board photo\u201d.');
    /* Processed preview at once (no mask yet — cover crop on board bg).
     * The preview is NOT a final output: no download is offered until
     * Make runs the gated pipeline below. */
    rerender(true);
    startSegmentation();
  }
  /* Background replacement, async and non-blocking — but Make is GATED
   * on its result (see segState + makeBoardPhoto). PIPELINE FIX:
   * the old code let Make render while this was still running and
   * claimed "your photo is placed on the board colour instead" when
   * it FAILED — a cover-cropped photo fills the frame, so the board
   * colour was invisible and the user got their ORIGINAL background
   * labelled as a finished board photo. That silent fallback is gone:
   * a failure is a visible error with Retry / colour / continue-as-is,
   * never a success. opts: {forceColour, tolerance} — forceColour skips
   * MediaPipe and flood-fills only (the failure box's manual path). */
  function setSegState(s) {
    segState = s;
    syncMakeBtn();
  }
  function showSegFail() { if (segFailBox) { segFailBox.hidden = false; } }
  function hideSegFail() { if (segFailBox) { segFailBox.hidden = true; } }
  function syncMakeBtn() {
    if (!makeBtn) { return; }
    /* Disabled ONLY while background removal is still running: a click
     * then would produce a "Ready" file with the original background
     * (the race this round closes). Every other state keeps Make
     * clickable — the handler itself refuses a failed segmentation. */
    makeBtn.disabled = !!loadedImg && removeBgOn && bgOverride !== 'original'
      && segState === 'pending';
  }
  function startSegmentation(opts) {
    if (!loadedImg) { return; }
    if (!removeBgOn) {
      /* Background removal is off: there is nothing to wait for. Make
       * runs the cover-crop pipeline and says so honestly. */
      setSegState('off');
      setSegStatus(window.dkT ? window.dkT('bp.ba_seg_off', 'Background removal is off \u2014 the photo keeps its original background. Your board may reject it.') : 'Background removal is off \u2014 the photo keeps its original background. Your board may reject it.');
      return;
    }
    if (!window.DKBoardSegment) {
      setSegState('unavailable');
      setSegStatus(window.dkT ? window.dkT('bp.ed_seg_unavailable', 'Automatic background removal is unavailable in this browser \u2014 the background could not be replaced.') : 'Automatic background removal is unavailable in this browser \u2014 the background could not be replaced.');
      showSegFail();
      return;
    }
    var run = ++segRunId;
    setSegState('pending');
    hideSegFail();
    setSegStatus(window.dkT ? window.dkT('bp.ed_segmenting', 'Removing the background\u2026 (in your browser, nothing is uploaded)') : 'Removing the background\u2026 (in your browser, nothing is uploaded)');
    window.DKBoardSegment.removeBackground(loadedImg, opts || {}).then(function (res) {
      if (run !== segRunId || !loadedImg) { return; } /* superseded by a newer photo/run */
      if (res && res.mask) {
        segMask = res.mask; segEngine = res.engine;
        setSegState('ready');
        setSegStatus(window.dkT
          ? window.dkT('bp.ed_seg_ok', 'Background replaced with the board colour')
          : 'Background replaced with the board colour');
        hideSegFail();
        rerender(true);
      } else {
        segMask = null; segEngine = '';
        setSegState('failed');
        setSegStatus(window.dkT ? window.dkT('bp.ba_seg_failed', 'Background could not be separated \u2014 this photo does NOT meet your board\u2019s background requirement.') : 'Background could not be separated \u2014 this photo does NOT meet your board\u2019s background requirement.');
        showSegFail();
        rerender(true);
      }
    }).catch(function () {
      if (run !== segRunId || !loadedImg) { return; }
      segMask = null; segEngine = '';
      setSegState('failed');
      setSegStatus(window.dkT ? window.dkT('bp.ba_seg_failed', 'Background could not be separated \u2014 this photo does NOT meet your board\u2019s background requirement.') : 'Background could not be separated \u2014 this photo does NOT meet your board\u2019s background requirement.');
      showSegFail();
      rerender(true);
    });
  }
  function setSegStatus(msg) {
    if (segStatusEl) { segStatusEl.textContent = msg || ''; }
  }
  function loadFromFile(file) {
    if (!file) { return; }
    if (!validImageFile(file)) {
      say(window.dkT ? window.dkT('rsv_1260', 'No valid photos chosen \u2014 pick PNG, JPG or WebP files under 25 MB.') : 'No valid photos chosen \u2014 pick PNG, JPG or WebP files under 25 MB.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () { setLoadedImage(img, file.name, reader.result); };
      img.onerror = function () {
        say(window.dkT ? window.dkT('rsv_1228', 'This image could not be processed.') : 'This image could not be processed.');
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
  /* Dropzone: click re-picks (the preview img replaces the label, so the
   * zone itself must stay clickable); drag & drop a photo onto it. */
  if (dzEl && fileEl) {
    dzEl.addEventListener('click', function (e) {
      if (e.target === fileEl) { return; } /* let the input open natively */
      fileEl.click();
    });
    dzEl.addEventListener('dragover', function (e) { e.preventDefault(); });
    dzEl.addEventListener('drop', function (e) {
      e.preventDefault();
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) { loadFromFile(f); }
    });
  }
  /* -- Make Board Photo: the full gated pipeline (PIPELINE FIX) ---------- */
  /* Original image -> all edit settings -> segmentation mask (same source
   * window + flip/rotate transforms as the subject — buildCanvas does
   * that) -> board background -> dimensions -> format -> size check ->
   * final image. No render path after this draws the original over the
   * composited result. Final = After preview = Download: one blob feeds
   * the After <img> and the download link. */
  function makeBoardPhoto() {
    if (!loadedImg) { say((window.dkT ? window.dkT('rsv_0959', 'Choose a photo first.') : 'Choose a photo first.')); return; }
    /* Gate 1: background replacement must be RESOLVED before any final
     * output exists. A pending mask means "not yet", a failed mask means
     * "never as a board photo" — both refuse, neither fakes a success. */
    if (removeBgOn && bgOverride !== 'original') {
      if (segState === 'pending') {
        say(window.dkT ? window.dkT('bp.ba_seg_wait', 'Removing the background\u2026 Make will run when it is ready.') : 'Removing the background\u2026 Make will run when it is ready.');
        return;
      }
      if (segState === 'failed' || segState === 'unavailable') {
        showSegFail();
        say(window.dkT ? window.dkT('bp.ba_seg_failed', 'Background could not be separated \u2014 this photo does NOT meet your board\u2019s background requirement.') : 'Background could not be separated \u2014 this photo does NOT meet your board\u2019s background requirement.');
        return;
      }
      if (segState === 'idle') {
        /* Segmentation never started (module loaded late, or a toggle
         * path skipped it): start it now and let the user press Make
         * again when it resolves. */
        startSegmentation();
        say(window.dkT ? window.dkT('bp.ba_seg_wait', 'Removing the background\u2026 Make will run when it is ready.') : 'Removing the background\u2026 Make will run when it is ready.');
        return;
      }
    }
    /* Gate 2: run the pipeline. */
    var seq = ++finalSeq;
    var spec = effSpec();
    makeBtn.disabled = true; /* processing — re-enabled by the callback */
    say(window.dkT ? window.dkT('bp.ba_making', 'Making your board photo\u2026') : 'Making your board photo\u2026');
    var built = buildCanvas(loadedImg, spec, { _single: true });
    canvasEl.width = built.width; canvasEl.height = built.height;
    canvasEl.getContext('2d').drawImage(built, 0, 0);
    canvasEl.style.display = '';
    fitBlob(built, spec.kb * 1024).then(function (res) {
      if (seq !== finalSeq) {
        /* Superseded by a newer Make or an edit meanwhile: this result
         * must never become the download. */
        syncMakeBtn();
        say(window.dkT ? window.dkT('bp.ba_make_stale', 'Your edits changed the photo \u2014 press \u201cMake board photo\u201d again.') : 'Your edits changed the photo \u2014 press \u201cMake board photo\u201d again.');
        return;
      }
      makeBtn.disabled = false; syncMakeBtn();
      if (!res.blob) { say((window.dkT ? window.dkT('rsv_1228', 'This image could not be processed.') : 'This image could not be processed.')); return; }
      /* Single source of truth: one blob feeds the After preview AND
       * the download link — they cannot drift apart. */
      if (currentURL) { URL.revokeObjectURL(currentURL); }
      currentBlob = res.blob;
      currentURL = URL.createObjectURL(res.blob);
      finalReady = true;
      var bgReplaced = removeBgOn && segState === 'ready' && !!segMask && bgOverride !== 'original';
      if (afterImg) { afterImg.src = currentURL; setAfterZoom(1); }
      if (beforeImg && loadedDataUrl) { beforeImg.src = loadedDataUrl; }
      if (beforeMeta) {
        beforeMeta.textContent = loadedImg.naturalWidth + '\u00d7' + loadedImg.naturalHeight + ' px \u00b7 '
          + (window.dkT ? window.dkT('bp.ba_meta_orig', 'original photo') : 'original photo');
      }
      if (afterMeta) {
        afterMeta.textContent = built.width + '\u00d7' + built.height + ' px \u00b7 JPEG \u00b7 '
          + (Math.round(res.blob.size / 102.4) / 10) + ' KB (max ' + spec.kb + ' KB) \u00b7 '
          + (bgReplaced
            ? (window.dkT ? window.dkT('bp.ba_meta_bg', 'background replaced') : 'background replaced')
            : (window.dkT ? window.dkT('bp.ba_meta_bg_kept', 'original background kept') : 'original background kept'))
          + (window.__bpCropWarn
            ? ' \u00b7 ' + (window.dkT ? window.dkT('bp.ba_crop_warn', 'Subject is wider than the frame \u2014 edges may be cut.') : 'Subject is wider than the frame \u2014 edges may be cut.')
            : '');
      }
      if (compareEl) { compareEl.hidden = false; }
      /* The After <img> IS the final image now — the live preview canvas
       * would only duplicate it, so it hides until the next edit. */
      canvasEl.style.display = 'none';
      if (dlEl) {
        dlEl.href = currentURL;
        dlEl.download = 'board-photo-' + built.width + 'x' + built.height + '.jpg';
        dlEl.style.display = 'inline-block';
      }
      var bgNote = bgReplaced
        ? (window.dkT ? window.dkT('bp.ba_ready_bg_ok', ' Background replaced with the board colour.') : ' Background replaced with the board colour.')
        : (window.dkT ? window.dkT('bp.ba_ready_bg_off', ' Background removal was off \u2014 the original background was kept.') : ' Background removal was off \u2014 the original background was kept.');
      /* JPEG quality warning (image-quality round, 18 Nov 2026): if
       * fitBlob had to drop quality below 0.75 to meet the size limit,
       * say so honestly — never silently export a degraded image. At
       * 150x200 / 22 KB this does not trigger (measured q = 0.943), but
       * the safeguard stays for larger boards / busier photos. */
      var qWarn = (!res.over && window.__bpFitQ !== undefined && window.__bpFitQ < 0.75)
        ? (window.dkT ? window.dkT('bp.ba_quality_warn', ' Quality was reduced to fit the size limit.') : ' Quality was reduced to fit the size limit.')
        : '';
      say(res.over
        ? (window.dkT ? window.dkT('rsv_1226', 'Ready, but still over ') : 'Ready, but still over ') + spec.kb + (window.dkT ? window.dkT('rsv_1227', ' KB at lowest quality \u2014 try a plainer photo.') : ' KB at lowest quality \u2014 try a plainer photo.') + bgNote
        : (window.dkT ? window.dkT('rsv_0998', 'Ready: ') : 'Ready: ') + built.width + '\u00d7' + built.height + (window.dkT ? window.dkT('rsv_0951', ' px, under ') : ' px, under ') + spec.kb + (window.dkT ? window.dkT('rsv_0944', ' KB. Download below.') : ' KB. Download below.') + bgNote + qWarn);
    });
  }
  if (makeBtn) {
    makeBtn.addEventListener('click', function () { makeBoardPhoto(); });
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
          syncBgBtns(); syncBgWarning(); syncBgColorPicker();
          syncMakeBtn(); /* 'Keep original' makes the pending gate moot */
          rerender(true);
        });
      })(bgBtns[bi]);
    }
    syncBgBtns();
  }
  /* Colour picker: a manual colour is an EXPLICIT OVERRIDE of the board
   * preset. When the board's bg is mandatory (see BOARD_NOTES) and the
   * chosen colour differs, the warning below the toolbar says so — the
   * board may reject the photo. The board default always stays one click
   * away ("Board default" button). */
  function syncBgWarning() {
    if (!bgWarnEl) { return; }
    var mandatory = current && current.bgMandatory;
    var off = bgOverride && bgOverride !== 'original'
      ? bgOverride.toLowerCase() !== (current.bg || '').toLowerCase()
      : bgOverride === 'original';
    if (mandatory && off) {
      bgWarnEl.textContent = window.dkT
        ? window.dkT('bp.ed_bg_warn', 'Warning: this background differs from what your board requires')
        : 'Warning: this background differs from what your board requires';
      bgWarnEl.hidden = false;
    } else {
      bgWarnEl.textContent = '';
      bgWarnEl.hidden = true;
    }
  }
  function syncBgColorPicker() {
    if (bgColorEl) {
      bgColorEl.value = (bgOverride && bgOverride !== 'original')
        ? bgOverride : (current.bg || '#ffffff');
    }
  }
  if (bgColorEl) {
    bgColorEl.addEventListener('input', function () {
      bgOverride = bgColorEl.value;
      syncBgBtns(); syncBgWarning();
      syncMakeBtn();
      rerender(true);
    });
    syncBgColorPicker();
  }

  /* -- Restored: custom size (width / height / max-KB override) ------------ */
  function applyCustomSpec(name, w, h, kb) {
    customSpec = { w: w, h: h, kb: kb };
    bgOverride = null; /* custom spec starts from the board background */
    showSpec(); syncBgBtns(); syncBgWarning(); syncBgColorPicker(); syncMakeBtn(); rerender(true);
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
  if (guideToggle && faceGuide) {
    /* Face guide is a visual overlay only (see fragment): it never
     * changes the output image, it just helps framing the preview. */
    guideToggle.addEventListener('change', function () {
      faceGuide.hidden = !guideToggle.checked;
    });
  }

  /* -- Visible editing toolbar (UI-editor correction, 18 Nov 2026) ---------- */
  /* Every control below is visible immediately after upload — no panel to
   * discover first. Each one updates the processed preview live via
   * rerender(true); nothing here touches the original upload. */
  function syncToolbarControls() {
    /* Slider positions + value labels mirror the adj state (used by Reset
     * and by a fresh upload, so the UI can never disagree with the render). */
    function setSlider(id, valId, v) {
      var el = $(id), lab = $(valId);
      if (el) { el.value = String(v); }
      if (lab) { lab.textContent = String(v); }
    }
    setSlider('bp-brightness', 'bp-brightness-v', Math.round((adj.brightness - 1) * 100));
    setSlider('bp-contrast', 'bp-contrast-v', Math.round((adj.contrast - 1) * 100));
    setSlider('bp-saturation', 'bp-saturation-v', Math.round((adj.saturation - 1) * 100));
    setSlider('bp-temp', 'bp-temp-v', adj.temp);
    toggleBtn(enhanceBtn, enhanceOn);
    toggleBtn(flipBtn, flipH);
    if (bwToggle) { bwToggle.checked = bwOn; }
    if (rmbgToggle) { rmbgToggle.checked = removeBgOn; }
    if (featherEl) { featherEl.value = String(featherPx); }
    if (featherVal) { featherVal.textContent = String(featherPx); }
    syncBgColorPicker();
  }
  function bindSlider(id, valId, apply) {
    var el = $(id);
    if (!el) { return; }
    el.addEventListener('input', function () {
      var v = parseInt(el.value, 10) || 0;
      var lab = $(valId);
      if (lab) { lab.textContent = String(v); }
      apply(v);
      rerender(true);
    });
  }
  bindSlider('bp-brightness', 'bp-brightness-v', function (v) { adj.brightness = 1 + v / 100; });
  bindSlider('bp-contrast', 'bp-contrast-v', function (v) { adj.contrast = 1 + v / 100; });
  bindSlider('bp-saturation', 'bp-saturation-v', function (v) { adj.saturation = 1 + v / 100; });
  bindSlider('bp-temp', 'bp-temp-v', function (v) { adj.temp = v; });
  if (rmbgToggle) {
    rmbgToggle.addEventListener('change', function () {
      removeBgOn = rmbgToggle.checked;
      if (removeBgOn) {
        /* Re-enable removal: (re-)run segmentation so Make is gated on
         * a real mask again. The preview keeps the previous mask
         * meanwhile, but Make stays disabled until the new run resolves. */
        if (loadedImg) { startSegmentation(); }
      } else {
        /* Off is an explicit user choice: cancel any run in flight so
         * its late mask cannot re-enable a background the user refused. */
        segRunId++;
        setSegState('off');
        hideSegFail();
        setSegStatus(window.dkT ? window.dkT('bp.ba_seg_off', 'Background removal is off \u2014 the photo keeps its original background. Your board may reject it.') : 'Background removal is off \u2014 the photo keeps its original background. Your board may reject it.');
      }
      syncMakeBtn();
      rerender(true);
    });
  }
  /* Segmentation failure box (PIPELINE FIX): Retry re-runs the full
   * engine chain; "Try colour removal" skips MediaPipe and flood-fills
   * from the borders at a higher tolerance (uniform backdrops only);
   * "Continue without background removal" is the explicit user choice
   * to accept the original background — it is labelled as NOT meeting
   * the board requirement, never presented as a board photo. */
  if (segRetryBtn) {
    segRetryBtn.addEventListener('click', function () {
      hideSegFail();
      startSegmentation();
    });
  }
  if (segColourBtn) {
    segColourBtn.addEventListener('click', function () {
      hideSegFail();
      startSegmentation({ forceColour: true, tolerance: 80 });
    });
  }
  if (segContinueBtn) {
    segContinueBtn.addEventListener('click', function () {
      removeBgOn = false;
      if (rmbgToggle) { rmbgToggle.checked = false; }
      segRunId++; /* cancel any run in flight */
      setSegState('off');
      hideSegFail();
      setSegStatus(window.dkT ? window.dkT('bp.ba_seg_off', 'Background removal is off \u2014 the photo keeps its original background. Your board may reject it.') : 'Background removal is off \u2014 the photo keeps its original background. Your board may reject it.');
      syncMakeBtn();
      rerender(true);
    });
  }
  if (featherEl) {
    featherEl.addEventListener('input', function () {
      featherPx = parseInt(featherEl.value, 10) || 0;
      if (featherVal) { featherVal.textContent = String(featherPx); }
      rerender(true);
    });
  }
  /* Reset restores the appropriate original/shared state: rotation, flip,
   * B&W, Enhance, all four sliders, crop, background override, background
   * removal + feather. The uploaded photo itself is untouched, and the
   * segmentation mask is kept (re-running it would waste seconds). */
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      if (needPhoto()) { return; }
      rotation = 0; flipH = false; bwOn = false; enhanceOn = false;
      adj = { brightness: 1, contrast: 1, saturation: 1, temp: 0 };
      singleCrop = null; removeBgOn = true; featherPx = 1; bgOverride = null;
      if (cropWrap) { cropWrap.hidden = true; }
      syncToolbarControls(); syncBgBtns(); syncBgWarning();
      rerender(true);
    });
  }
  /* Remove photo: clears the upload, the preview, the toolbar and the
   * processed output. Replaces "Use another photo" (deleted) — same
   * outcome, without auto-opening the file picker. */
  if (removeBtn) {
    removeBtn.addEventListener('click', function () {
      loadedImg = null; loadedDataUrl = null; segMask = null; segEngine = '';
      segState = 'idle'; segRunId++; /* cancel any run in flight */
      hideSegFail();
      invalidateFinal(); /* kills the old final's blob, URL, compare + download */
      if (fileEl) { fileEl.value = ''; }
      showLoadedName('');
      if (previewImg) { previewImg.hidden = true; previewImg.removeAttribute('src'); }
      if (dzLabel) { dzLabel.hidden = false; }
      if (toolbarEl) { toolbarEl.hidden = true; }
      if (cropWrap) { cropWrap.hidden = true; }
      canvasEl.style.display = 'none';
      setSegStatus('');
      resetSingleEdits();
      syncMakeBtn();
      say(window.dkT ? window.dkT('rsv_1279', 'Choose another photo.') : 'Choose another photo.');
    });
  }

  /* -- Interactive crop (single mode; same pattern as the bulk editor) ----- */
  /* Draggable + resizable, aspect-locked to the board spec (a free-aspect
   * rect would stretch the face at export, so it is never allowed).
   * Apply stores fractions of the source image; Cancel keeps the previous
   * crop (or none). The original is preserved — crop only changes the
   * source window buildCanvas() draws from. */
  var singleCropDrag = null;
  function renderSingleCrop() {
    if (!loadedImg || !cropCanvas) { return; }
    var img = loadedImg;
    var W = 320, scale = W / img.naturalWidth;
    var H = Math.max(1, Math.round(img.naturalHeight * scale));
    cropCanvas.width = W; cropCanvas.height = H;
    var ctx = cropCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0, W, H);
    var spec = effSpec();
    var aspect = spec.w / spec.h;
    var rect = singleCrop
      ? { x: singleCrop.x * W, y: singleCrop.y * H, w: singleCrop.w * W, h: singleCrop.h * H }
      : (function () {
          /* Same window Make uses: subject-aware framing when a mask
           * exists, so the cropper's default rect == the final export. */
          var r = (segMask && removeBgOn)
            ? subjectCropRect(img.naturalWidth, img.naturalHeight, spec.w, spec.h, segMask)
            : coverCropRect(img.naturalWidth, img.naturalHeight, spec.w, spec.h);
          return { x: r.x * scale, y: r.y * scale, w: r.w * scale, h: r.h * scale, warn: !!r.warn };
        })();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, rect.y);
    ctx.fillRect(0, rect.y + rect.h, W, H - (rect.y + rect.h));
    ctx.fillRect(0, rect.y, rect.x, rect.h);
    ctx.fillRect(rect.x + rect.w, rect.y, W - (rect.x + rect.w), rect.h);
    ctx.strokeStyle = '#FFC531'; ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    cropCanvas._rect = rect; cropCanvas._scale = scale; cropCanvas._aspect = aspect;
    var cropWarnEl = $('bp-crop-warn');
    if (cropWarnEl) { cropWarnEl.hidden = !rect.warn; }
  }
  function renderSingleCropOverlayOnly() {
    if (!loadedImg || !cropCanvas || !cropCanvas._rect) { return; }
    var ctx = cropCanvas.getContext('2d');
    ctx.drawImage(loadedImg, 0, 0, cropCanvas.width, cropCanvas.height);
    var rect = cropCanvas._rect;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, cropCanvas.width, rect.y);
    ctx.fillRect(0, rect.y + rect.h, cropCanvas.width, cropCanvas.height - (rect.y + rect.h));
    ctx.fillRect(0, rect.y, rect.x, rect.h);
    ctx.fillRect(rect.x + rect.w, rect.y, cropCanvas.width - (rect.x + rect.w), rect.h);
    ctx.strokeStyle = '#FFC531'; ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }
  if (cropBtn && cropWrap) {
    cropBtn.addEventListener('click', function () {
      if (needPhoto()) { return; }
      var open = cropWrap.hidden;
      cropWrap.hidden = !open;
      cropBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { renderSingleCrop(); }
    });
  }
  if (cropCanvas) {
    cropCanvas.addEventListener('pointerdown', function (e) {
      if (!cropCanvas._rect) { return; }
      e.preventDefault();
      var r = cropCanvas.getBoundingClientRect();
      var p = { x: e.clientX - r.left, y: e.clientY - r.top };
      var rc = cropCanvas._rect, edge = 10;
      var nearRight = Math.abs(p.x - (rc.x + rc.w)) < edge;
      var nearBottom = Math.abs(p.y - (rc.y + rc.h)) < edge;
      var inside = p.x >= rc.x && p.x <= rc.x + rc.w && p.y >= rc.y && p.y <= rc.y + rc.h;
      singleCropDrag = {
        mode: (nearRight || nearBottom) ? 'resize' : (inside ? 'move' : null),
        startX: p.x, startY: p.y, rect: { x: rc.x, y: rc.y, w: rc.w, h: rc.h }
      };
    });
    cropCanvas.addEventListener('pointermove', function (e) {
      if (!singleCropDrag || !singleCropDrag.mode) { return; }
      e.preventDefault();
      var r = cropCanvas.getBoundingClientRect();
      var p = { x: e.clientX - r.left, y: e.clientY - r.top };
      var dx = p.x - singleCropDrag.startX, dy = p.y - singleCropDrag.startY;
      var rc = { x: singleCropDrag.rect.x, y: singleCropDrag.rect.y,
        w: singleCropDrag.rect.w, h: singleCropDrag.rect.h };
      if (singleCropDrag.mode === 'move') {
        rc.x = Math.max(0, Math.min(cropCanvas.width - rc.w, rc.x + dx));
        rc.y = Math.max(0, Math.min(cropCanvas.height - rc.h, rc.y + dy));
      } else {
        var nw = Math.max(20, Math.min(cropCanvas.width - rc.x, rc.w + dx));
        var nh = nw / cropCanvas._aspect;
        if (rc.y + nh > cropCanvas.height) { nh = cropCanvas.height - rc.y; nw = nh * cropCanvas._aspect; }
        rc.w = nw; rc.h = nh;
      }
      cropCanvas._rect = rc;
      renderSingleCropOverlayOnly();
    });
    ['pointerup', 'pointerleave'].forEach(function (ev) {
      cropCanvas.addEventListener(ev, function () { singleCropDrag = null; });
    });
  }
  if (cropApply) {
    cropApply.addEventListener('click', function () {
      if (cropCanvas && cropCanvas._rect) {
        var rc = cropCanvas._rect;
        singleCrop = { x: rc.x / cropCanvas.width, y: rc.y / cropCanvas.height,
          w: rc.w / cropCanvas.width, h: rc.h / cropCanvas.height };
      }
      if (cropWrap) { cropWrap.hidden = true; }
      rerender(true);
    });
  }
  if (cropCancel) {
    cropCancel.addEventListener('click', function () {
      if (cropWrap) { cropWrap.hidden = true; }
      renderSingleCrop(); /* discard the drag, restore the stored crop */
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
    catch (e) { /* storage unavailable: presets just won't persist */ window.dkSwallow && window.dkSwallow(e, 'board-photo.js'); }
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
  /* Preset saving from single mode is gone with the name field + button
   * (UI-editor correction). Presets are still SAVED from the bulk editor
   * (auto-named "Custom 1", "Custom 2", ...) and their chips still apply
   * here via renderPresets()/presetRow above. */
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

  /* REMOVED 18 Nov 2026 (UI-editor correction): "Use another photo"
   * (#againBtn) is replaced by "Remove photo" in the toolbar — same reset,
   * without auto-opening the file picker. */
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
      var dataUrl = c.toDataURL('image/jpeg', 0.92);
      /* Bulk capture: the bulk engine sets window.__bpBulkCapturing and
       * listens for 'bp-bulk-capture' — the frame goes to the manager
       * instead of the single-photo flow. */
      if (window.__bpBulkCapturing) {
        closeCam();
        document.dispatchEvent(new CustomEvent('bp-bulk-capture',
          { detail: { dataUrl: dataUrl } }));
        return;
      }
      var img = new Image();
      img.onload = function () {
        closeCam();
        setLoadedImage(img, window.dkT ? window.dkT('bp.cam_t', 'Camera') : 'Camera', dataUrl);
      };
      img.src = dataUrl;
    });
  }

  /* Shared file helpers (kept: the Bulk engine API + the upload validator
   * both use them; only the old batch UI that called them is deleted). */
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
  /* REMOVED 18 Nov 2026 (UI-editor correction): old Batch Mode (max 10,
   * one output per input) is deleted — bulk mode has its own intake with
   * ZIP/folder/paste/500 cap. No dangling references remain: batchBtn /
   * batchInput / batchList are gone from the HTML and from the var list. */
  /* REMOVED 18 Nov 2026 (UI-editor correction): Email Photo button.
   * mailto: cannot carry attachments, so it only ever downloaded the photo
   * and opened a draft — the Download button already does the useful half.
   * No dangling references: emailBtn is gone from the HTML and the var list. */

  /* -- Bulk engine API (board-photo-bulk.js consumes this) ---------------- */
  /* Single source of truth for boards + pipeline, so bulk output can never
   * drift from single-photo output. Read-only contract: callers must not
   * mutate BOARDS or the returned spec objects. */
  window.DKBoardPhoto = {
    BOARDS: BOARDS,
    getSpec: function (id) {
      for (var i = 0; i < BOARDS.length; i++) {
        if (BOARDS[i].id === id) { return BOARDS[i]; }
      }
      return getGeneric();
    },
    effSpec: effSpec,
    buildCanvas: buildCanvas,
    fitBlob: fitBlob,
    downloadBlob: downloadBlob,
    decodeFile: decodeFile,
    validImageFile: validImageFile,
    coverCropRect: coverCropRect,
    subjectCropRect: subjectCropRect,
    maskBBox: maskBBox,
    esc: esc
  };
})();
