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
 *    batch photos (one output per input), WhatsApp share (TEXT link
 *    only — see note on waBtn), Facebook share (TEXT link only, same
 *    mechanism), "Use another photo".
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
 *    Guide, WhatsApp, Facebook, Custom size, Background buttons kept.
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
  var waBtn = $('waBtn'), fbBtn = $('fbBtn');
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
  /* Pre-download verification gate (subject+crop round, 18 Nov 2026):
   * the panel that checks the exact final blob before Download is
   * offered. All guarded — the gate simply never shows on a page
   * without the panel. */
  var gateEl = $('bp-gate'), gateStatusEl = $('bp-gate-status'),
      gateIssuesEl = $('bp-gate-issues'), gateZoomEl = $('bp-gate-zoom'),
      gateZoomCap = $('bp-gate-zoom-cap'), gateFixesEl = $('bp-gate-fixes'),
      gateRerunBtn = $('bp-gate-rerun'), gateCropBtn = $('bp-gate-crop'),
      gateFeatherBtn = $('bp-gate-feather'), gateAnywayBtn = $('bp-gate-anyway');
  /* Photo analysis (cutout/share round, 18 Nov 2026): the panel that
   * shows the FIRST assessment after upload — subject/head detection,
   * head position + margins, board-spec fit — before crop/background. */
  var analysisEl = $('bp-analysis'), analysisBody = $('bp-analysis-body');
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
  var rotation = 0, straighten = 0, flipH = false, bwOn = false, enhanceOn = false;
  /* Single-mode edit state (UI-editor correction): the toolbar binds to
   * these; buildCanvas() reads them through opts._single (bulk always
   * passes every field explicitly, so it can never pick these up). */
  var adj = { brightness: 1, contrast: 1, saturation: 1, temp: 0,
    sharpness: 0.25, highlights: 0, shadows: 0 };
  var loadedFileBytes = 0; /* upload size, for the analysis panel */
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
      renderAnalysis(); /* board spec changed: fit + background lines move */
    }
  });
  if (filterEl) {
    filterEl.addEventListener('input', function () {
      var q = filterEl.value.trim().toLowerCase();
      var list = BOARDS.filter(function (b) {
        return !q || b.name.toLowerCase().indexOf(q) !== -1;
      });
      /* Board-auto fix (cutout/share round, 18 Nov 2026): the filter
       * used to SWITCH the board to the first match on every keystroke
       * AND wipe the manual background override — typing "bis" while
       * Peshawar was selected silently moved the photo to Bahawalpur.
       * A filter must only filter the dropdown: the selected board
       * stays selected (it is kept in the list even when it does not
       * match the query, so the <select> can never silently switch),
       * and the override is untouched. Selection changes ONLY through
       * the 'change' handler above, which clears the override + re-syncs
       * the warning, picker, Make button and preview together. */
      if (list.indexOf(current) === -1) { list = [current].concat(list); }
      fillOptions(list);
      selectEl.value = current.id;
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
    /* SUBJECT+CROP ROUND (18 Nov 2026): safety margin for the mask's
     * edge error. The mask can barely MISS an ear (a protrusion of
     * ~12–20 source px can be erased by refineMask's output-size choke,
     * and the mask edge itself is only accurate to a few px) — and a
     * window fitted exactly to the mask then cuts that ear silently.
     * Dilate the head zone by 2% of the output width on each side and
     * 2% of the output height on top BEFORE centring, so the window
     * keeps a little air around the head. The dilation is used for
     * POSITIONING only: the warn flag below still uses the REAL head
     * width — warning on the buffer would cry wolf on tight-but-fine
     * headshots whose real head fits with safe margins. */
    var dilX = Math.round(outW * 0.02 / px), dilY = Math.round(outH * 0.02 / py);
    var headDil = { x0: headBB.x0 - dilX, x1: headBB.x1 + dilX,
      y0: headBB.y0 - dilY, y1: headBB.y1 };
    /* Horizontal: shift the window so the head zone has sideWant on both
     * sides. If the head zone is wider than the window allows, centre it
     * (symmetric). The POSITIONING trigger uses the dilated margins (so
     * the window recentres on the head as soon as the safety buffer
     * gets tight), but the WARN flag is evaluated on the UNDILATED
     * margins — exactly as before this round. Otherwise the buffer
     * itself would flip verdicts: a head with a 17px top margin (fine)
     * newly enters the vertical branch once the 4px buffer is applied,
     * and the latent tall-subject warn would call it "wider than the
     * frame" although the head is fully in frame (caught on
     * man-glasses, 18 Nov 2026: warn flipped False→True on the buffer
     * alone). The buffer buys air; it must never buy a warning. */
    var leftM = (headDil.x0 - win.x) * px, rightM = (win.x + win.w - 1 - headDil.x1) * px;
    var leftM0 = (headBB.x0 - win.x) * px, rightM0 = (win.x + win.w - 1 - headBB.x1) * px;
    if (leftM < sideWant || rightM < sideWant) {
      var cx = (headDil.x0 + headDil.x1) / 2;
      var nx = Math.round(cx - win.w / 2);
      if ((leftM0 < sideWant || rightM0 < sideWant)
          && (headBB.x1 - headBB.x0) * px > outW - 2 * sideWant) { warn = true; }
      win.x = Math.max(0, Math.min(iw - win.w, nx));
    }
    /* Vertical: head margin first. If the mask is taller than the window,
     * align the top (head margin) and cut the bottom — shoulders at the
     * bottom edge are normal for board photos, a cut head is not. The
     * dilated head top is used here too, so the window keeps the same
     * 2%-of-height air above the head that the sides get. Warn, again,
     * on the undilated top margin (see the note above). */
    var topM = (headDil.y0 - win.y) * py;
    var topM0 = (bb.y0 - win.y) * py;
    if (topM < topWant) {
      var ny = Math.round(headDil.y0 - topWant / py);
      if (topM0 < topWant && (bb.y1 - bb.y0) * py > outH - topWant) { warn = true; }
      win.y = Math.max(0, Math.min(ih - win.h, ny));
    }
    win.warn = warn;
    return win;
  }
  /* Pale-wedge cleanup (subject+crop round, 18 Nov 2026 — EXPERIMENTAL,
   * shipped only if the fringe harness proves it: see the measurement
   * note in buildCanvas). The live failure on curly hair is NOT a cut
   * face: it is a pale wedge of the ORIGINAL light wall surviving
   * BETWEEN curl locks, where the mask blob covers the gap as if it
   * were hair, hard-edged against the strong board blue. Those pixels
   * are opaque, pale, the colour of the original background, and
   * within a few px of a real mask boundary — so they can be keyed out
   * without touching the subject: sample the original background
   * colour from the subject canvas corners where the refined mask is
   * background, then zero the mask alpha of pixels that are (a) opaque
   * (alpha > 200), (b) within 3 px of the mask boundary, and (c) within
   * Euclidean colour distance 48 of the sampled background. The
   * sampled colour is kept on window.__bpWedgeBg for the pre-download
   * gate's wedge test; the zeroed count is on window.__bpWedgePx.
   * `apply` false only samples (ablation measurement): the gate still
   * gets the true background colour, but no mask pixel is touched.
   * Returns the number of mask pixels zeroed (0 when the background
   * cannot be sampled — e.g. the subject fills every corner — or
   * when apply is false). */
  function cleanWedge(subjectCanvas, maskCanvas, apply) {
    var w = subjectCanvas.width, h = subjectCanvas.height;
    var s, m;
    try {
      s = subjectCanvas.getContext('2d').getImageData(0, 0, w, h).data;
      m = maskCanvas.getContext('2d').getImageData(0, 0, w, h);
    } catch (e) { return 0; }
    var md = m.data;
    /* Sample: 12x12 corner patches, mask-background pixels only
     * (alpha < 128). A corner full of shoulder contributes nothing —
     * only real background pixels vote. Median, not mean: a stray
     * hair pixel in a corner must not pull the sample. */
    var rs = [], gs = [], bs = [];
    var PATCH = 12;
    function sampleCorner(x0, y0) {
      for (var y = y0; y < y0 + PATCH && y < h; y++) {
        for (var x = x0; x < x0 + PATCH && x < w; x++) {
          var i = (y * w + x) * 4;
          if (md[i + 3] < 128) {
            rs.push(s[i]); gs.push(s[i + 1]); bs.push(s[i + 2]);
          }
        }
      }
    }
    sampleCorner(0, 0); sampleCorner(w - PATCH, 0);
    sampleCorner(0, h - PATCH); sampleCorner(w - PATCH, h - PATCH);
    if (rs.length < 20) { return 0; }
    function median(a) {
      a.sort(function (p, q) { return p - q; });
      return a[Math.floor(a.length / 2)];
    }
    var bg = { r: median(rs), g: median(gs), b: median(bs) };
    window.__bpWedgeBg = bg;
    /* Boundary proximity: dilate the background (alpha < 128) by 3 px
     * (3 passes of a 3x3 dilate) — any pixel inside the dilated region
     * is within Chebyshev distance 3 of the boundary. */
    var nearBg = new Uint8Array(w * h);
    for (var p = 0; p < w * h; p++) {
      nearBg[p] = md[p * 4 + 3] < 128 ? 1 : 0;
    }
    for (var pass = 0; pass < 3; pass++) {
      var next = new Uint8Array(w * h);
      for (var y2 = 0; y2 < h; y2++) {
        for (var x2 = 0; x2 < w; x2++) {
          if (nearBg[y2 * w + x2]) { next[y2 * w + x2] = 1; continue; }
          var hit = false;
          for (var dy = -1; dy <= 1 && !hit; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
              var nx = x2 + dx, ny = y2 + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) { continue; }
              if (nearBg[ny * w + nx]) { hit = true; break; }
            }
          }
          next[y2 * w + x2] = hit ? 1 : 0;
        }
      }
      nearBg = next;
    }
    var flags = new Uint8Array(w * h);
    var changed = 0;
    for (var i2 = 0; i2 < w * h; i2++) {
      if (md[i2 * 4 + 3] <= 200 || !nearBg[i2]) { continue; }
      var o = i2 * 4;
      var dr = s[o] - bg.r, dg = s[o + 1] - bg.g, db = s[o + 2] - bg.b;
      if (Math.sqrt(dr * dr + dg * dg + db * db) <= 48) {
        flags[i2] = 1;
        changed++;
      }
    }
    if (apply && changed) {
      for (var i3 = 0; i3 < w * h; i3++) {
        if (!flags[i3]) { continue; }
        var o3 = i3 * 4;
        md[o3] = 0; md[o3 + 1] = 0; md[o3 + 2] = 0; md[o3 + 3] = 0;
      }
      maskCanvas.getContext('2d').putImageData(m, 0, 0);
      return changed;
    }
    return 0;
  }
  function buildCanvas(img, spec, opts) {
    var o = opts || {};
    /* Wedge diagnostics reset per render (never stale across photos):
     * the masked path below re-samples + re-counts when it runs. */
    window.__bpWedgePx = 0; window.__bpWedgeBg = null;
    var single = !!o._single; /* single-mode state applies ONLY with this flag (bulk never sets it) */
    /* WHY per-field fallback (not Object.assign): the module globals are
     * the single-photo state; bulk passes only the fields it overrides. */
    var rot = (((o.rotation !== undefined ? o.rotation : rotation) % 360) + 360) % 360;
    var st = single ? straighten : 0; /* fine straighten (deg), single mode
      only — bulk passes rotation explicitly and never sets this, so bulk
      output cannot drift. outW/outH swapping uses rot only (90/270). */
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
      /* SUBJECT+CROP ROUND: an explicit crop used to clear the warning
       * (cropWarn stayed false) and blind the analysis — a cut ear
       * looked fine. The full-source mask is checked against the crop
       * window here, so the After meta and the analysis panel warn. */
      if (single && mask) {
        var cut = cropCutsSubject();
        cropWarn = cut.cut;
        window.__bpCropSides = cut.sides;
      }
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
    if (!cropWarn) { window.__bpCropSides = []; }
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
    /* SUBJECT+CROP ROUND (18 Nov 2026): this was `var st` — the SAME name
     * as the straighten variable above (buildCanvas :424), so the
     * saturation value (~1.0–1.08) silently REPLACED straighten in every
     * rotate((rot + st)...) call and the Straighten slider did nothing
     * (the subject always rotated ~+1°). Renamed to `sat`: straighten
     * keeps `st`, saturation keeps `sat`, and the two can never collide. */
    var sat = (enh ? 1.08 : 1) * adjVal('saturation', 1);
    if (br !== 1 || ct !== 1 || sat !== 1) {
      filters.push('brightness(' + br.toFixed(3) + ') contrast(' + ct.toFixed(3)
        + ') saturate(' + sat.toFixed(3) + ')');
    }
    /* Quality test seam (image-quality round, 18 Nov 2026): tests may
     * override pipeline constants via window.__bpQuality before Make
     * (ablation runs). Production defaults are the measured winners.
     *   chokePx: mask erosion px at output size (default 2 — cutout/share
     *     round, 18 Nov 2026: the fringe ablation measured choke 2 beats
     *     choke 1 on the config-independent zone metric, 1,493 vs 1,623)
     *   sharpen: unsharp amount on the subject interior (default 0.25)
     *   stepDown: two-step downscale on/off (default true) */
    var __Q = (typeof window !== 'undefined' && window.__bpQuality) || {};
    var chokePx = (__Q.chokePx !== undefined) ? __Q.chokePx : 2;
    var sharpAmt = (__Q.sharpen !== undefined) ? __Q.sharpen : (single ? adj.sharpness : 0.25);
    var stepDown = (__Q.stepDown !== undefined) ? !!__Q.stepDown : true;
    /* Ablation-only overrides (default = the live slider / on): featherPx
     * and decont let tests vary the edge pipeline per Make without
     * touching the UI. alphaGamma (default 3 — cutout/share round,
     * 18 Nov 2026: the fringe ablation measured gamma 3 + choke 2 as
     * the best edge, zone-fringe 1,307 vs 1,623 baseline, sharpness
     * preserved at 1.90 median) steepens the mask alpha ramp — see
     * refineMask's gamma note. Production never sets __bpQuality. */
    var qFeatherPx = (__Q.featherPx !== undefined) ? __Q.featherPx : featherPx;
    var qDecont = (__Q.decont !== undefined) ? !!__Q.decont : true;
    var qGamma = (__Q.alphaGamma !== undefined) ? __Q.alphaGamma : 3;
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
        m2.rotate((rot + st) * Math.PI / 180);
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
        c2.rotate((rot + st) * Math.PI / 180);
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
    /* Highlights / Shadows (cutout/share round, 18 Nov 2026): a
     * luminance lift on the SUBJECT pixels (same place as the
     * temperature tint, before masking — the board-colour fill is
     * never touched). Highlights move bright pixels toward/away from
     * white, shadows move dark pixels toward/away from black; the
     * per-pixel channel scale preserves hue. Both default to 0 (no
     * change). In the plain path the cover-cropped subject fills the
     * frame, so the whole canvas IS the subject there. */
    function applyHiSh(c2) {
      var hi = adjVal('highlights', 0), sh = adjVal('shadows', 0);
      if (hi === 0 && sh === 0) { return; }
      var w = c2.canvas.width, h = c2.canvas.height;
      var img;
      try { img = c2.getImageData(0, 0, w, h); } catch (e) { return; }
      var d = img.data;
      for (var i = 0; i < d.length; i += 4) {
        var r = d[i], g = d[i + 1], b = d[i + 2];
        var L = 0.299 * r + 0.587 * g + 0.114 * b;
        if (L <= 0) { continue; } /* transparent pixel: nothing to lift */
        var nL = L;
        if (L > 128 && hi !== 0) { nL = L + (hi / 100) * (255 - L) * (L - 128) / 127; }
        else if (L < 128 && sh !== 0) { nL = L + (sh / 100) * L * (128 - L) / 127; }
        if (nL !== L) {
          var f = nL / L;
          d[i] = f * r < 0 ? 0 : (f * r > 255 ? 255 : f * r);
          d[i + 1] = f * g < 0 ? 0 : (f * g > 255 ? 255 : f * g);
          d[i + 2] = f * b < 0 ? 0 : (f * b > 255 ? 255 : f * b);
        }
      }
      c2.putImageData(img, 0, 0);
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
      applyHiSh(tctx);
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
      mctx.rotate((rot + st) * Math.PI / 180);
      mctx.drawImage(mask, sx, sy, cw, ch, -outW / 2, -outH / 2, outW, outH);
      mctx.restore();
      /* Refine at output size: the 2px choke cuts the pale fringe and the
       * slider's feather becomes a bounded box blur (see refineMask).
       * (Was "1px choke" in the comment — the production default has
       * been choke 2 since the cutout/share round; comment fixed
       * 18 Nov 2026, subject+crop round.) */
      mCanvas = window.DKBoardSegment.refineMask(mCanvas, chokePx, qFeatherPx, qGamma);
      /* Pale-wedge cleanup (subject+crop round, 18 Nov 2026): key out
       * opaque slivers of the ORIGINAL background surviving inside the
       * mask (pale wall between curl locks) before the mask is applied.
       * Gated on a real background replacement: with bg 'original'
       * there is no board colour for a wedge to clash with, and the
       * sampled background would be meaningless. __bpQuality.wedgeCleanup
       * === false disables it for ablation measurement (tests only);
       * production always runs it. The count lands on
       * window.__bpWedgePx so the fringe harness can report the
       * mask-area change per photo. If the harness ever shows a
       * regression or a white-shirt canary failure, delete this block
       * (and the helper above) — the gate + custom crop handle the
       * wedge instead. */
      window.__bpWedgePx = 0;
      if (fill) {
        /* Sample always (the gate's wedge test needs the true original
         * background colour even when the cleanup itself is switched
         * off for ablation); apply only when cleanup is enabled. */
        window.__bpWedgePx = cleanWedge(tmp, mCanvas,
          __Q.wedgeCleanup !== false);
      }
      /* destination-in with the refined mask (feather 0 here — the blur
       * already happened inside refineMask). */
      window.DKBoardSegment.applyMaskToCanvas(tmp, mCanvas, 0);
      /* Recolour the edge band from the subject (no old-bg spill). */
      if (qDecont) { window.DKBoardSegment.decontaminate(tmp, mCanvas); }
      ctx.drawImage(tmp, 0, 0);
      /* The gate's colour-key tests (verifyFinal) read the UNBLENDED
       * subject pixels from this canvas, stashed on the built canvas:
       * the final's band pixels are blends of subject and board
       * colour, so a hair + pale-bg blend can land on the wall colour
       * and false-flag as fringe — the subject canvas holds the raw
       * photo pixel at each location (hair stays dark, wall stays
       * wall), so the key decides correctly. */
      canvas.__bpSubjectCanvas = tmp;
      /* Gentle sharpening, subject interior only (mask-gated). */
      window.DKBoardSegment.sharpenSubject(canvas, mCanvas, sharpAmt);
    } else {
      drawSubject(ctx);
      applyTemp(ctx);
      applyHiSh(ctx);
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
    /* The gate verdict belongs to the dead final: hide the panel and
     * clear the verdict, so a stale PASS/FAIL can never be read as
     * applying to the next Make. */
    if (gateEl) { gateEl.hidden = true; }
    window.__bpGate = null;
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
    rotation = 0; straighten = 0; flipH = false; bwOn = false; enhanceOn = false;
    adj = { brightness: 1, contrast: 1, saturation: 1, temp: 0,
      sharpness: 0.25, highlights: 0, shadows: 0 };
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
    renderAnalysis(); /* shows "Analysing…" until the mask lands */
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
      renderAnalysis();
      return;
    }
    if (!window.DKBoardSegment) {
      setSegState('unavailable');
      setSegStatus(window.dkT ? window.dkT('bp.ed_seg_unavailable', 'Automatic background removal is unavailable in this browser \u2014 the background could not be replaced.') : 'Automatic background removal is unavailable in this browser \u2014 the background could not be replaced.');
      showSegFail();
      renderAnalysis();
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
        renderAnalysis(); /* subject/head/fit assessment, shown FIRST */
      } else {
        segMask = null; segEngine = '';
        setSegState('failed');
        setSegStatus(window.dkT ? window.dkT('bp.ba_seg_failed', 'Background could not be separated \u2014 this photo does NOT meet your board\u2019s background requirement.') : 'Background could not be separated \u2014 this photo does NOT meet your board\u2019s background requirement.');
        showSegFail();
        rerender(true);
        renderAnalysis();
      }
    }).catch(function () {
      if (run !== segRunId || !loadedImg) { return; }
      segMask = null; segEngine = '';
      setSegState('failed');
      setSegStatus(window.dkT ? window.dkT('bp.ba_seg_failed', 'Background could not be separated \u2014 this photo does NOT meet your board\u2019s background requirement.') : 'Background could not be separated \u2014 this photo does NOT meet your board\u2019s background requirement.');
      showSegFail();
      rerender(true);
      renderAnalysis();
    });
  }
  /* Output-space refined mask (subject+crop round, 18 Nov 2026): draws
   * the segmentation mask through the SAME crop window + rotation/flip
   * as buildCanvas, at output size, and refines it the same way.
   * Shared by maskOutBBox() (analysis panel) and verifyFinal() (the
   * pre-download gate), so the panel, the gate and Make can never
   * disagree about which mask the final image used. Returns null
   * without a mask, or {canvas, outW, outH, crop:{sx,sy,cw,ch}}. */
  function liveRefineParams() {
    /* The SAME values buildCanvas uses: production = the live feather
     * slider + choke 2 + gamma 3; the __bpQuality ablation seam may
     * override any of them per Make (tests only — production never
     * sets it). maskOutBBox used to hardcode refineMask(c, 2, 1, 3),
     * so moving the feather slider changed the final image but NOT the
     * panel's bbox — the panel and the framing silently disagreed. */
    var __Q = (typeof window !== 'undefined' && window.__bpQuality) || {};
    return {
      choke: (__Q.chokePx !== undefined) ? __Q.chokePx : 2,
      feather: (__Q.featherPx !== undefined) ? __Q.featherPx : featherPx,
      gamma: (__Q.alphaGamma !== undefined) ? __Q.alphaGamma : 3
    };
  }
  function refinedOutputMask() {
    if (!segMask || !loadedImg || !window.DKBoardSegment) { return null; }
    var spec = effSpec();
    var iw = loadedImg.naturalWidth, ih = loadedImg.naturalHeight;
    /* Output dims swap on a 90/270° rotation, exactly as in buildCanvas. */
    var rotN = (((rotation % 360) + 360) % 360);
    var outW = (rotN === 90 || rotN === 270) ? spec.h : spec.w;
    var outH = (rotN === 90 || rotN === 270) ? spec.w : spec.h;
    var cw, ch, sx, sy;
    if (singleCrop) {
      cw = Math.min(Math.round(singleCrop.w * iw), iw);
      ch = Math.min(Math.round(singleCrop.h * ih), ih);
      sx = Math.max(0, Math.min(Math.round(singleCrop.x * iw), iw - cw));
      sy = Math.max(0, Math.min(Math.round(singleCrop.y * ih), ih - ch));
    } else {
      var cc = subjectCropRect(iw, ih, outW, outH, segMask);
      cw = cc.w; ch = cc.h; sx = cc.x; sy = cc.y;
    }
    var c = document.createElement('canvas');
    c.width = outW; c.height = outH;
    var x = c.getContext('2d');
    x.save();
    x.translate(outW / 2, outH / 2);
    if (flipH) { x.scale(-1, 1); }
    x.rotate(((rotation + straighten) * Math.PI) / 180);
    x.drawImage(segMask, sx, sy, cw, ch, -outW / 2, -outH / 2, outW, outH);
    x.restore();
    var p = liveRefineParams();
    var refined = window.DKBoardSegment.refineMask(c, p.choke, p.feather, p.gamma);
    return { canvas: refined, outW: outW, outH: outH,
      crop: { sx: sx, sy: sy, cw: cw, ch: ch } };
  }
  /* Output-space mask bbox (cutout/share round): reads the opaque bbox
   * from refinedOutputMask(). The analysis panel reports head margins
   * from THIS box, so it always matches the framing Make will produce.
   * Returns null without a mask. Besides the whole-subject bbox it
   * also returns `head` — the bbox of the head zone (top 45% of the
   * subject, where the face and ears live) — because the whole-subject
   * side margins are SHOULDER margins: an ear touching a side edge is
   * invisible to them (subject+crop round). */
  function maskOutBBox() {
    var rm = refinedOutputMask();
    if (!rm) { return null; }
    var outW = rm.outW, outH = rm.outH;
    var d;
    try { d = rm.canvas.getContext('2d').getImageData(0, 0, outW, outH).data; }
    catch (e) { return null; }
    var x0 = outW, y0 = outH, x1 = -1, y1 = -1, opaque = 0;
    for (var y = 0; y < outH; y++) {
      for (var xx = 0; xx < outW; xx++) {
        if (d[(y * outW + xx) * 4 + 3] > 127) {
          opaque++;
          if (xx < x0) { x0 = xx; } if (xx > x1) { x1 = xx; }
          if (y < y0) { y0 = y; } if (y > y1) { y1 = y; }
        }
      }
    }
    if (x1 < 0) { return null; }
    /* Head zone: same 45% rule as subjectCropRect, applied to the
     * output-size mask. yMax is exclusive of the shoulders below. */
    var headYMax = y0 + Math.round((y1 - y0) * 0.45);
    var hx0 = outW, hy0 = outH, hx1 = -1, hy1 = -1;
    for (var hy = 0; hy < headYMax; hy++) {
      for (var hx = 0; hx < outW; hx++) {
        if (d[(hy * outW + hx) * 4 + 3] > 127) {
          if (hx < hx0) { hx0 = hx; } if (hx > hx1) { hx1 = hx; }
          if (hy < hy0) { hy0 = hy; } if (hy > hy1) { hy1 = hy; }
        }
      }
    }
    var head = (hx1 < 0) ? null
      : { x0: hx0, y0: hy0, x1: hx1, y1: hy1 };
    return { x0: x0, y0: y0, x1: x1, y1: y1, outW: outW, outH: outH,
      coverage: opaque / (outW * outH), head: head };
  }
  /* Does an explicit user crop cut the subject? (subject+crop round.)
   * maskOutBBox() re-derives the bbox INSIDE the cropped window, so a
   * cut ear looks fine to it — the analysis is blind exactly when the
   * user has cropped. This compares the FULL-SOURCE mask bbox against
   * the crop rect in source pixels instead, and NAMES the cut sides
   * (left/right/top/bottom). A 2 source-px tolerance absorbs mask-edge
   * noise at the crop boundary. Returns {cut, sides:[...]}. */
  function cropCutsSubject() {
    var none = { cut: false, sides: [] };
    if (!singleCrop || !segMask || !loadedImg) { return none; }
    var bb = maskBBox(segMask);
    if (!bb) { return none; }
    var iw = loadedImg.naturalWidth, ih = loadedImg.naturalHeight;
    var cx0 = singleCrop.x * iw, cy0 = singleCrop.y * ih;
    var cx1 = cx0 + singleCrop.w * iw, cy1 = cy0 + singleCrop.h * ih;
    var sides = [];
    if (bb.x0 < cx0 - 2) { sides.push('left'); }
    if (bb.x1 > cx1 + 2) { sides.push('right'); }
    if (bb.y0 < cy0 - 2) { sides.push('top'); }
    if (bb.y1 > cy1 + 2) { sides.push('bottom'); }
    return { cut: sides.length > 0, sides: sides };
  }
  /* Photo analysis (cutout/share round): the FIRST assessment after
   * upload — subject/head detection, head position + margins, and
   * whether the photo fits the board spec — shown BEFORE crop and
   * background change. Re-rendered when segmentation lands, when the
   * board changes, and when a crop is applied. Every line is built
   * from dict keys with {placeholders} (same pattern as the bulk
   * preset names), so Urdu reads correctly. */
  function renderAnalysis() {
    if (!analysisEl || !analysisBody) { return; }
    if (!loadedImg) { analysisEl.hidden = true; analysisBody.textContent = ''; return; }
    var spec = effSpec();
    var T = window.dkT || null;
    function tr(key, fb) { return T ? T(key, fb) : fb; }
    function sub(s, k, v) { return s.split(k).join(v); }
    function line(text, cls) {
      var p = document.createElement('p');
      p.className = 'note' + (cls ? ' ' + cls : '');
      p.textContent = text;
      analysisBody.appendChild(p);
    }
    analysisBody.textContent = '';
    analysisEl.hidden = false;
    /* Fit line: source dims -> board dims + file size (always shown,
     * even while segmentation is still running). */
    var sizeTxt = loadedFileBytes > 0
      ? (Math.round(loadedFileBytes / 102.4) / 10) + ' KB' : '—';
    line(sub(sub(sub(sub(sub(sub(
      tr('bp.an_fit', 'Photo {iw}×{ih} px → board {w}×{h} px, max {kb} KB. Source file {size}.'),
      '{iw}', String(loadedImg.naturalWidth)), '{ih}', String(loadedImg.naturalHeight)),
      '{w}', String(spec.w)), '{h}', String(spec.h)), '{kb}', String(spec.kb)),
      '{size}', sizeTxt));
    if (loadedImg.naturalWidth < spec.w || loadedImg.naturalHeight < spec.h) {
      line(tr('bp.an_small', 'Source is smaller than the board size — the output will be upscaled and may look soft.'), 'err');
    }
    /* Background line: what Make will use (board spec, or the manual
     * override) against what the board requires. */
    var effBg = bgOverride === 'original'
      ? tr('bp.bg_original', 'Keep original')
      : (bgOverride || spec.bg);
    line(sub(sub(tr('bp.an_bg', 'Background: {bg} — board requires {req}.'),
      '{bg}', effBg), '{req}', bgName(spec.bg_name) + ' (' + spec.bg + ')'));
    /* Subject + head lines need a mask. */
    if (segState === 'pending' || segState === 'idle') {
      line(tr('bp.an_analysing', 'Analysing your photo…'));
      return;
    }
    if (segState === 'off') {
      line(tr('bp.an_off', 'Background removal is off — the photo keeps its original background.'));
      return;
    }
    if (segState !== 'ready' || !segMask) {
      line(tr('bp.an_nosubject', 'No subject found — the photo may be too busy or too dark. Try a plainer photo.'), 'err');
      return;
    }
    var bb = maskOutBBox();
    if (!bb) {
      line(tr('bp.an_nosubject', 'No subject found — the photo may be too busy or too dark. Try a plainer photo.'), 'err');
      return;
    }
    line(sub(sub(tr('bp.an_subject', 'Subject found — {engine}, coverage {cov}% of the frame.'),
      '{engine}', segEngine || 'mediapipe'), '{cov}', String(Math.round(bb.coverage * 100))));
    /* SUBJECT+CROP ROUND: side margins come from the HEAD-ZONE bbox
     * (bb.head), not the whole-subject bbox — the whole-subject sides
     * are SHOULDER margins, and shoulders are wider than the head, so
     * an ear touching a side edge was invisible to the old numbers.
     * The head line below reports the head's own margins. */
    var head = bb.head || bb;
    var topM = head.y0, leftM = head.x0, rightM = bb.outW - 1 - head.x1;
    var headW = Math.round((head.x1 - head.x0 + 1) / bb.outW * 100);
    line(sub(sub(sub(sub(sub(
      tr('bp.an_head', 'Head: top margin {top}px ({topp}% of frame height), head width {w}% of the frame, side margins {l}px / {r}px.'),
      '{top}', String(topM)), '{topp}', String(Math.round(topM / bb.outH * 100))),
      '{w}', String(headW)), '{l}', String(leftM)), '{r}', String(rightM)));
    /* Verdict: headroom first (a cut head is the worst failure), then
     * width (edges may be cut), else ready. Thresholds match the
     * framing the pipeline itself enforces (8% top, 4% sides). */
    var topWant = Math.round(bb.outH * 0.08), sideWant = Math.round(bb.outW * 0.04);
    function sideName(s) {
      return tr('bp.side_' + s, s);
    }
    /* An explicit user crop blinds maskOutBBox (it re-derives the bbox
     * INSIDE the cropped window), so the cut is checked against the
     * FULL-SOURCE mask FIRST — before the top verdict, which reads the
     * same blind in-window bbox and would otherwise misreport a crop
     * that cuts the head top as a headroom problem. The cut sides are
     * NAMED, so the user knows which edge to widen. */
    var cut = singleCrop ? cropCutsSubject() : null;
    if (cut && cut.cut) {
      var sidesTxt = cut.sides.map(sideName).join(', ');
      line(sub(tr('bp.an_crop_cut', 'Your crop cuts the subject on the {sides} — widen the crop there or that edge will be missing.'),
        '{sides}', sidesTxt), 'err');
    } else if (topM < topWant) {
      line(tr('bp.an_verdict_top', 'Head is too close to the top — retake with more space above the head.'), 'err');
    } else if (leftM < sideWant || rightM < sideWant || window.__bpCropWarn) {
      /* Head-zone side margin below the threshold: the head touches a
       * side edge, so an ear may already be cut — name the side. */
      if (leftM < sideWant || rightM < sideWant) {
        var edgeSide = leftM <= rightM ? 'left' : 'right';
        line(sub(tr('bp.an_head_edge', 'Head touches the {side} edge — an ear may be cut.'),
          '{side}', sideName(edgeSide)), 'err');
      } else {
        line(tr('bp.an_verdict_wide', 'Subject is wider than the frame — edges may be cut.'), 'err');
      }
    } else {
      line(tr('bp.an_verdict_ok', 'Ready for crop — head fully in frame with headroom.'), 'ok');
    }
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
    loadedFileBytes = file.size || 0; /* analysis panel: source size */
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
  /* -- Pre-download verification gate (subject+crop round, 18 Nov 2026) - */
  /* Checks the EXACT blob the user would download — decoded from the
   * blob itself, never from a preview canvas — against three gates:
   *   G1 BACKGROUND: the 4 corners (5x5 patches) + the 4px edge band
   *      are the board colour within Δ≤16/channel (above JPEG noise
   *      at q≈0.94). Only clearly-background pixels (mask alpha < 12)
   *      are tested, so a subject touching the frame edge cannot
   *      false-flag it.
   *   G2 FRINGE/WEDGE: pale pixels (luminance > 170, channel spread
   *      < 70) in the mask transition band, AND opaque pale pixels
   *      within 3 px of the mask boundary matching the sampled
   *      original-background colour (the curly-hair wedge test — the
   *      same colour sample cleanWedge takes in buildCanvas).
   *   G3 SUBJECT INTEGRITY: the head-zone bbox (top 45% of the
   *      subject) keeps top ≥8% of outH and sides ≥4% of outW, the
   *      head is present, and coverage is within ±5% of the analysis
   *      panel's value.
   * Returns a Promise of {pass, issues:[{side, region, kind}],
   * counts:{...}, skipped:[...]}. `region` is output px for the zoomed
   * view. The gate is async (decoding the blob takes a tick) — Make
   * reveals the compare + Download only after its verdict. */
  function hexToRgb(hex) {
    if (!hex || hex[0] !== '#') { return null; }
    var h = hex.slice(1);
    if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
    if (h.length !== 6) { return null; }
    var n = parseInt(h, 16);
    if (isNaN(n)) { return null; }
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function verifyFinal(built, blob, spec) {
    return new Promise(function (resolve) {
      var outW = built.width, outH = built.height;
      var bgHex = bgOverride === 'original' ? null : (bgOverride || spec.bg);
      var bgRgb = bgHex ? hexToRgb(bgHex) : null;
      var bgReplaced = removeBgOn && segState === 'ready' && !!segMask
        && bgOverride !== 'original';
      var analysis = null;
      try { analysis = maskOutBBox(); } catch (e) { analysis = null; }
      /* Decode the BLOB (createImageBitmap, Image fallback) — the blob
       * is what the user downloads, so it is what gets checked. */
      function decode(cb) {
        if (typeof createImageBitmap === 'function') {
          createImageBitmap(blob).then(function (bmp) {
            var c = document.createElement('canvas');
            c.width = outW; c.height = outH;
            c.getContext('2d').drawImage(bmp, 0, 0);
            if (bmp.close) { bmp.close(); }
            cb(c);
          }).catch(function () { decodeViaImg(cb); });
        } else { decodeViaImg(cb); }
      }
      function decodeViaImg(cb) {
        var url = URL.createObjectURL(blob);
        var im = new Image();
        im.onload = function () {
          var c = document.createElement('canvas');
          c.width = outW; c.height = outH;
          c.getContext('2d').drawImage(im, 0, 0);
          URL.revokeObjectURL(url);
          cb(c);
        };
        im.onerror = function () { URL.revokeObjectURL(url); cb(null); };
        im.src = url;
      }
      decode(function (srcCanvas) {
        var issues = [], skipped = [];
        var counts = { bandPx: 0, bandFringe: 0, wedgePx: 0,
          coverage: null, analysisCoverage: null };
        if (!srcCanvas) {
          resolve({ pass: false, done: true,
            issues: [{ kind: 'verify-error', side: 'photo', region: null }],
            counts: counts, skipped: skipped });
          return;
        }
        var px;
        try { px = srcCanvas.getContext('2d').getImageData(0, 0, outW, outH).data; }
        catch (e) {
          resolve({ pass: false, done: true,
            issues: [{ kind: 'verify-error', side: 'photo', region: null }],
            counts: counts, skipped: skipped });
          return;
        }
        /* Colour-key source (G2): the unblended subject canvas
         * buildCanvas stashed on the built canvas (see there). The
         * PALE test still reads the final blob (the visual condition);
         * the colour KEY reads the subject canvas, where a pixel is
         * the raw photo pixel — hair stays dark, wall stays wall —
         * instead of the final's subject/board blend. Falls back to
         * the final pixels when there is no stashed canvas (plain
         * path has no mask, so G2 is skipped there anyway). */
        var keyPx = px;
        try {
          var sc = built && built.__bpSubjectCanvas;
          if (sc && sc.width === outW && sc.height === outH) {
            keyPx = sc.getContext('2d').getImageData(0, 0, outW, outH).data;
          }
        } catch (e) { keyPx = px; }
        var rm = null, maskA = null;
        if (bgReplaced) {
          try { rm = refinedOutputMask(); } catch (e) { rm = null; }
          if (rm) {
            try { maskA = rm.canvas.getContext('2d').getImageData(0, 0, rm.outW, rm.outH).data; }
            catch (e) { maskA = null; }
          }
        }
        function isPale(i) {
          var r = px[i], g = px[i + 1], b = px[i + 2];
          var lum = 0.299 * r + 0.587 * g + 0.114 * b;
          var spread = Math.max(r, g, b) - Math.min(r, g, b);
          return lum > 170 && spread < 70;
        }
        /* --- G1: background corners + edge band ---------------------- */
        if (!bgRgb) {
          skipped.push('bg');
        } else if (!maskA) {
          skipped.push('bg');
        } else {
          /* Only test background pixels that are ALSO clear of the
           * subject (≥3 px from any opaque pixel): JPEG ringing at a
           * hard subject/blue boundary shifts near-edge pixels by
           * >16, and those pixels are transition, not background —
           * testing them false-flagged every photo whose subject
           * touches the frame edge (woman-1's bottom strip). */
          var nearSubj = new Uint8Array(outW * outH);
          for (var ns = 0; ns < outW * outH; ns++) {
            nearSubj[ns] = maskA[ns * 4 + 3] > 127 ? 1 : 0;
          }
          for (var np = 0; np < 3; np++) {
            var nxtS = new Uint8Array(outW * outH);
            for (var yS = 0; yS < outH; yS++) {
              for (var xS = 0; xS < outW; xS++) {
                if (nearSubj[yS * outW + xS]) { nxtS[yS * outW + xS] = 1; continue; }
                var hitS = false;
                for (var dyS = -1; dyS <= 1 && !hitS; dyS++) {
                  for (var dxS = -1; dxS <= 1; dxS++) {
                    var nxS = xS + dxS, nyS = yS + dyS;
                    if (nxS < 0 || nyS < 0 || nxS >= outW || nyS >= outH) { continue; }
                    if (nearSubj[nyS * outW + nxS]) { hitS = true; break; }
                  }
                }
                nxtS[yS * outW + xS] = hitS ? 1 : 0;
              }
            }
            nearSubj = nxtS;
          }
          function isClearBg(x, y) {
            var ai = (y * outW + x) * 4 + 3;
            return maskA[ai] < 12 && !nearSubj[y * outW + x];
          }
          var badCorners = [];
          var cornerXY = [[0, 0], [outW - 5, 0], [0, outH - 5], [outW - 5, outH - 5]];
          for (var ci = 0; ci < 4; ci++) {
            var cx0 = cornerXY[ci][0], cy0 = cornerXY[ci][1];
            var sr = 0, sg = 0, sb = 0, n = 0;
            for (var cy = cy0; cy < cy0 + 5; cy++) {
              for (var cx = cx0; cx < cx0 + 5; cx++) {
                if (!isClearBg(cx, cy)) { continue; } /* subject/transition/near-edge: not bg */
                var pi = (cy * outW + cx) * 4;
                sr += px[pi]; sg += px[pi + 1]; sb += px[pi + 2]; n++;
              }
            }
            if (n < 5) { continue; } /* corner is subject: nothing to test */
            var mr = sr / n, mg = sg / n, mb = sb / n;
            var dmax = Math.max(Math.abs(mr - bgRgb[0]),
              Math.abs(mg - bgRgb[1]), Math.abs(mb - bgRgb[2]));
            if (dmax > 16) {
              badCorners.push({ x: cx0, y: cy0, w: 5, h: 5 });
            }
          }
          if (badCorners.length) {
            issues.push({ kind: 'bg', side: 'corners',
              region: badCorners[0] });
          }
          /* Edge band: 4px strips, clearly-background pixels only. */
          var bandEdges = [
            { side: 'top', x0: 0, y0: 0, x1: outW, y1: 4 },
            { side: 'bottom', x0: 0, y0: outH - 4, x1: outW, y1: outH },
            { side: 'left', x0: 0, y0: 0, x1: 4, y1: outH },
            { side: 'right', x0: outW - 4, y0: 0, x1: outW, y1: outH }
          ];
          var worstEdge = null, worstFrac = 0;
          for (var ei = 0; ei < 4; ei++) {
            var ed = bandEdges[ei];
            var tot = 0, bad = 0;
            for (var ey = ed.y0; ey < ed.y1; ey++) {
              for (var ex = ed.x0; ex < ed.x1; ex++) {
                if (!isClearBg(ex, ey)) { continue; }
                tot++;
                var pei = (ey * outW + ex) * 4;
                if (Math.max(Math.abs(px[pei] - bgRgb[0]),
                    Math.abs(px[pei + 1] - bgRgb[1]),
                    Math.abs(px[pei + 2] - bgRgb[2])) > 16) { bad++; }
              }
            }
            if (tot >= 20) {
              var frac = bad / tot;
              if (frac > worstFrac) {
                worstFrac = frac;
                worstEdge = { side: ed.side,
                  region: { x: ed.x0, y: ed.y0, w: ed.x1 - ed.x0, h: ed.y1 - ed.y0 } };
              }
            }
          }
          if (worstEdge && worstFrac > 0.02) {
            issues.push({ kind: 'bg', side: worstEdge.side,
              region: worstEdge.region });
          }
        }
        /* --- G2: fringe band + wedge --------------------------------- */
        if (!maskA) {
          skipped.push('fringe');
        } else {
          /* Boundary proximity: dilate the background (alpha < 128) by
           * 3 px, same as cleanWedge — a pixel inside is within
           * Chebyshev distance 3 of the mask boundary. */
          var nearBg = new Uint8Array(outW * outH);
          for (var p = 0; p < outW * outH; p++) {
            nearBg[p] = maskA[p * 4 + 3] < 128 ? 1 : 0;
          }
          for (var pass = 0; pass < 3; pass++) {
            var nxt = new Uint8Array(outW * outH);
            for (var y2 = 0; y2 < outH; y2++) {
              for (var x2 = 0; x2 < outW; x2++) {
                if (nearBg[y2 * outW + x2]) { nxt[y2 * outW + x2] = 1; continue; }
                var hit = false;
                for (var dy = -1; dy <= 1 && !hit; dy++) {
                  for (var dx = -1; dx <= 1; dx++) {
                    var nx = x2 + dx, ny = y2 + dy;
                    if (nx < 0 || ny < 0 || nx >= outW || ny >= outH) { continue; }
                    if (nearBg[ny * outW + nx]) { hit = true; break; }
                  }
                }
                nxt[y2 * outW + x2] = hit ? 1 : 0;
              }
            }
            nearBg = nxt;
          }
          var bandPx = 0, bandFringe = 0;
          var wedgePx = 0, wx0 = outW, wy0 = outH, wx1 = -1, wy1 = -1;
          var sample = window.__bpWedgeBg || null;
          /* Band fringe is colour-keyed to the SAMPLED ORIGINAL
           * background (same 48 tolerance as the wedge test), not
           * merely "pale": the transition band is a blend of subject
           * and board colour, so a feathered edge blended against a
           * pale board (#e6f0ff, the board default) is pale by
           * construction — man-1 counted 404 such blend px and the
           * gate failed a good final (probe 18 Nov 2026). The key
           * reads the UNBLENDED subject canvas (keyPx, above), where
           * a band pixel is the raw photo pixel — dark hair stays
           * dark and cannot land on the wall colour — while a real
           * fringe pixel is the ORIGINAL wall colour leaking at the
           * edge, which matches the sample. Board-coloured pixels
           * are excluded too (they ARE the background). Without a
           * sample (bg kept original) the band cannot be judged —
           * blend and leak are indistinguishable — so it stays 0. */
          /* A pixel is the board colour within `tol` per channel.
           * Default 16 = the G1 correctness tolerance (JPEG noise).
           * The WEDGE test passes 32: that is a VISIBILITY tolerance,
           * not a correctness one — a wedge pixel within 32 of the
           * board colour is too close to it to read as "something
           * cut away" (a brightened warm wall at (243,234,229)
           * against the pale default (230,240,255) differs by 26
           * and is a faint warm tint, not a missing chunk; the same
           * pixel against strong blue differs by ~140 and counts). */
          function isBoard(gi, tol) {
            tol = tol || 16;
            return Math.max(Math.abs(px[gi] - bgRgb[0]),
              Math.abs(px[gi + 1] - bgRgb[1]),
              Math.abs(px[gi + 2] - bgRgb[2])) <= tol;
          }
          function isLeak(gi) {
            return matchesSample(gi, keyPx);
          }
          /* A pixel matches the sampled original background when it
           * is close in RGB (≤48) AND close in chroma (channel
           * spread within 25): skin is warm (spread ~50–60) while
           * most walls are near-neutral (spread ~0–25), so chroma
           * separates brightened skin at the boundary — which RGB
           * distance alone cannot (man-1 at +40 brightness: skin
           * (255,238,196) sits 40 from the wall sample, inside the
           * 48 tolerance, but its spread 59 vs the wall's 8 gives it
           * away — 47 false wedge px, probe 18 Nov 2026). A
           * saturated wall (yellow, spread ~135) still matches its
           * own sample, because the comparison is against the
           * SAMPLE's spread, not an absolute cap. */
          function matchesSample(gi, arr) {
            if (!sample) { return false; }
            var dr = arr[gi] - sample.r, dg = arr[gi + 1] - sample.g,
                db = arr[gi + 2] - sample.b;
            if (Math.sqrt(dr * dr + dg * dg + db * db) > 48) { return false; }
            var spreadPx = Math.max(arr[gi], arr[gi + 1], arr[gi + 2])
              - Math.min(arr[gi], arr[gi + 1], arr[gi + 2]);
            var spreadSm = Math.max(sample.r, sample.g, sample.b)
              - Math.min(sample.r, sample.g, sample.b);
            return Math.abs(spreadPx - spreadSm) <= 25;
          }
          for (var gy = 0; gy < outH; gy++) {
            for (var gx = 0; gx < outW; gx++) {
              var gi = (gy * outW + gx) * 4;
              var al = maskA[gi + 3];
              if (al > 0 && al < 255) {
                bandPx++;
                if (isPale(gi) && !isBoard(gi) && isLeak(gi)) { bandFringe++; }
              }
              /* Wedge: opaque, PALE, near the boundary, the colour of
               * the ORIGINAL background — pale wall surviving inside
               * the mask, not fringe on the edge. PALE is load-bearing
               * here: without it a grey beard against a grey wall
               * counts as a wedge (man-1 measured 52 false pixels),
               * because beard and wall match within tolerance 48. A
               * pale wall wedge reads as "something cut away" against
               * strong blue; a grey beard does not. The colour key
               * reads the FINAL pixels here, deliberately — NOT the
               * subject canvas: the wedge is what the user SEES, and
               * an edit that brightens a surviving wall sliver makes
               * it more visible, not less. (The BAND test below keys
               * on the subject canvas instead, because a band pixel
               * in the final is a blend and its colour is undecidable
               * there.) A wedge pixel the colour of the BOARD is
               * excluded — it is invisible against the background it
               * sits on (a brightened wedge at +40 brightness reads
               * warm near-white, within ~30 of the pale default
               * (230,240,255): a faint tint, not a missing chunk —
               * but glaring against strong blue, where it still
               * counts; see isBoard's 32 tolerance). */
              if (sample && al > 200 && nearBg[gy * outW + gx] && isPale(gi) && !isBoard(gi, 32)) {
                if (matchesSample(gi, px)) {
                  wedgePx++;
                  if (gx < wx0) { wx0 = gx; } if (gx > wx1) { wx1 = gx; }
                  if (gy < wy0) { wy0 = gy; } if (gy > wy1) { wy1 = gy; }
                }
              }
            }
          }
          counts.bandPx = bandPx; counts.bandFringe = bandFringe;
          counts.wedgePx = wedgePx;
          if (!sample) { skipped.push('wedge'); }
          /* Measured thresholds (subject+crop round, 11-photo set,
           * cleanup ON, band colour-keyed to the sampled original
           * bg, wedge chroma-checked): the worst GOOD final has 16
           * wedge px (woman-1, after the cleanup removed 269) and 0
           * band-leak px, so the band count alone cannot flag
           * anything — it is a backstop for egregious cases only
           * (>25% of the band AND >200 px). The wedge test is the
           * real detector: good finals sit at 0–16, a real pale
           * wedge (man-2's white wall, 29 px) clears 25. */
          if (wedgePx >= 25) {
            issues.push({ kind: 'wedge',
              side: (wx0 < outW / 2) ? 'left' : 'right',
              region: { x: Math.max(0, wx0 - 4), y: Math.max(0, wy0 - 4),
                w: Math.min(outW, wx1 - wx0 + 9), h: Math.min(outH, wy1 - wy0 + 9) },
              n: wedgePx });
          }
          if (bandPx > 0 && bandFringe > 200
              && bandFringe / bandPx > 0.25) {
            issues.push({ kind: 'fringe', side: 'edge', region: null,
              n: bandFringe });
          }
        }
        /* --- G3: subject integrity (head zone + coverage) ------------ */
        if (!maskA) {
          skipped.push('subject');
        } else {
          var sx0 = outW, sy0 = outH, sx1 = -1, sy1 = -1, opaque = 0;
          for (var sy = 0; sy < outH; sy++) {
            for (var sx = 0; sx < outW; sx++) {
              if (maskA[(sy * outW + sx) * 4 + 3] > 127) {
                opaque++;
                if (sx < sx0) { sx0 = sx; } if (sx > sx1) { sx1 = sx; }
                if (sy < sy0) { sy0 = sy; } if (sy > sy1) { sy1 = sy; }
              }
            }
          }
          counts.coverage = opaque / (outW * outH);
          counts.analysisCoverage = analysis ? analysis.coverage : null;
          if (sx1 < 0) {
            issues.push({ kind: 'nosubject', side: 'photo', region: null });
          } else {
            var headYMax = sy0 + Math.round((sy1 - sy0) * 0.45);
            var hx0 = outW, hy0 = outH, hx1 = -1, hy1 = -1;
            for (var hy = 0; hy < headYMax; hy++) {
              for (var hx = 0; hx < outW; hx++) {
                if (maskA[(hy * outW + hx) * 4 + 3] > 127) {
                  if (hx < hx0) { hx0 = hx; } if (hx > hx1) { hx1 = hx; }
                  if (hy < hy0) { hy0 = hy; } if (hy > hy1) { hy1 = hy; }
                }
              }
            }
            /* Margin checks run ONLY when the photo is upright
             * (rotation 0): the head-zone geometry is orientation-
             * defined — "top 45% of the subject" is the head only
             * when the head is up. After a 90° rotation the head is
             * sideways, so the top-45% slice cuts across head AND
             * body and its bbox spans the full width: every rotated
             * man-1 final false-flagged a left-edge "cut ear"
             * (probe 18 Nov 2026). Rotated finals still get the
             * coverage + head-present checks below; the user rotated
             * deliberately and the preview shows the result. */
            var upright = (rotation % 360) === 0;
            if (!upright) { skipped.push('head-margins'); }
            var topWant = Math.round(outH * 0.08),
                sideWant = Math.round(outW * 0.04);
            if (upright && hy0 < topWant) {
              issues.push({ kind: 'head', side: 'top',
                region: { x: 0, y: 0, w: outW, h: Math.max(10, hy0 + 12) } });
            }
            if (upright && hx0 < sideWant) {
              issues.push({ kind: 'head', side: 'left',
                region: { x: 0, y: Math.max(0, hy0 - 4), w: Math.max(10, hx0 + 12),
                  h: Math.max(10, hy1 - hy0 + 8) } });
            }
            if (upright && outW - 1 - hx1 < sideWant) {
              issues.push({ kind: 'head', side: 'right',
                region: { x: Math.max(0, hx1 - 12), y: Math.max(0, hy0 - 4),
                  w: Math.min(outW, outW - hx1 + 12), h: Math.max(10, hy1 - hy0 + 8) } });
            }
            if (analysis && analysis.coverage
                && Math.abs(counts.coverage - analysis.coverage)
                  > 0.05 * analysis.coverage) {
              issues.push({ kind: 'coverage', side: 'photo', region: null });
            }
          }
        }
        resolve({ pass: issues.length === 0, done: true,
          issues: issues, counts: counts, skipped: skipped,
          _srcCanvas: srcCanvas });
      });
    });
  }
  function gateIssueText(issue) {
    var T = window.dkT || null;
    function tr(key, fb) { return T ? T(key, fb) : fb; }
    function sub(s, k, v) { return s.split(k).join(v); }
    var side = tr('bp.side_' + issue.side, issue.side);
    switch (issue.kind) {
      case 'bg':
        return sub(tr('bp.gate_issue_bg', 'Background is not the board colour ({side}).'),
          '{side}', side);
      case 'wedge':
        return sub(tr('bp.gate_issue_wedge', 'Pale old background left at the {side} edge — widen the crop or raise edge softening.'),
          '{side}', side);
      case 'fringe':
        return sub(tr('bp.gate_issue_fringe', 'Pale fringe along the edge ({n} px) — raise edge softening or re-run the cutout.'),
          '{n}', String(issue.n || 0));
      case 'head':
        return sub(tr('bp.gate_issue_head', 'Head is too close to the {side} edge — an ear may be cut.'),
          '{side}', side);
      case 'nosubject':
        return tr('bp.gate_issue_nosubject', 'No subject found in the final photo.');
      case 'coverage':
        return tr('bp.gate_issue_coverage', 'Subject size changed unexpectedly after Make.');
      default:
        return tr('bp.gate_issue_verify', 'The final photo could not be checked — download anyway only if the preview looks right.');
    }
  }
  function showGateChecking() {
    window.__bpGate = null;
    if (!gateEl) { return; }
    gateEl.hidden = false;
    gateEl.classList.remove('bp-gate-pass', 'bp-gate-fail');
    if (gateStatusEl) {
      gateStatusEl.textContent = window.dkT
        ? window.dkT('bp.gate_checking', 'Checking your photo…')
        : 'Checking your photo…';
    }
    if (gateIssuesEl) { gateIssuesEl.textContent = ''; }
    if (gateZoomEl) { gateZoomEl.hidden = true; }
    if (gateZoomCap) { gateZoomCap.hidden = true; }
    if (gateFixesEl) { gateFixesEl.hidden = true; }
  }
  function renderGate(v) {
    /* The verdict is visible to tests (and to the gate probe) on
     * window.__bpGate: {pass, issues, counts, skipped}. */
    window.__bpGate = v;
    if (!gateEl) { return; }
    gateEl.hidden = false;
    gateEl.classList.remove('bp-gate-pass', 'bp-gate-fail');
    function tr(key, fb) {
      return window.dkT ? window.dkT(key, fb) : fb;
    }
    if (v.pass) {
      gateEl.classList.add('bp-gate-pass');
      if (gateStatusEl) {
        var line = '✓ ' + tr('bp.gate_pass', 'Checked: edges clean, subject complete.');
        if (v.skipped && v.skipped.length) {
          line += ' ' + tr('bp.gate_skipped', 'Background kept — background checks skipped.');
        }
        gateStatusEl.textContent = line;
      }
      if (gateIssuesEl) { gateIssuesEl.textContent = ''; }
      if (gateZoomEl) { gateZoomEl.hidden = true; }
      if (gateZoomCap) { gateZoomCap.hidden = true; }
      if (gateFixesEl) { gateFixesEl.hidden = true; }
      return;
    }
    gateEl.classList.add('bp-gate-fail');
    if (gateStatusEl) {
      gateStatusEl.textContent = '⚠ ' + tr('bp.gate_fail', 'Check found {n} issue(s) — fix below, or download anyway.')
        .split('{n}').join(String(v.issues.length));
    }
    if (gateIssuesEl) {
      gateIssuesEl.textContent = '';
      for (var i = 0; i < v.issues.length; i++) {
        var li = document.createElement('li');
        li.textContent = gateIssueText(v.issues[i]);
        gateIssuesEl.appendChild(li);
      }
    }
    /* Zoomed view of the worst region (wedge first, then head, then
     * background): the user sees the exact pixels the gate objected
     * to, at 3x with no smoothing, so the judgement is honest. */
    var worst = null, worstRank = 99;
    var rank = { wedge: 0, head: 1, bg: 2, fringe: 3, coverage: 4, nosubject: 5 };
    for (var j = 0; j < v.issues.length; j++) {
      var iss = v.issues[j];
      if (!iss.region) { continue; }
      var r = (rank[iss.kind] === undefined) ? 9 : rank[iss.kind];
      if (r < worstRank) { worstRank = r; worst = iss; }
    }
    if (worst && worst.region && v._srcCanvas && gateZoomEl) {
      var rg = worst.region;
      var scale = Math.min(3, 300 / Math.max(rg.w, rg.h, 1));
      gateZoomEl.width = Math.max(1, Math.round(rg.w * scale));
      gateZoomEl.height = Math.max(1, Math.round(rg.h * scale));
      var zx = gateZoomEl.getContext('2d');
      zx.imageSmoothingEnabled = false;
      zx.drawImage(v._srcCanvas, rg.x, rg.y, rg.w, rg.h,
        0, 0, gateZoomEl.width, gateZoomEl.height);
      gateZoomEl.hidden = false;
      if (gateZoomCap) {
        gateZoomCap.textContent = gateIssueText(worst);
        gateZoomCap.hidden = false;
      }
    } else {
      if (gateZoomEl) { gateZoomEl.hidden = true; }
      if (gateZoomCap) { gateZoomCap.hidden = true; }
    }
    if (gateFixesEl) { gateFixesEl.hidden = false; }
    if (gateAnywayBtn) { gateAnywayBtn.hidden = false; }
  }
  if (gateRerunBtn) {
    gateRerunBtn.addEventListener('click', function () {
      /* Re-run the cutout, then Make again: the old verdict is stale
       * the moment the mask changes, so the panel hides until then. */
      if (gateEl) { gateEl.hidden = true; }
      window.__bpGate = null;
      hideSegFail();
      startSegmentation();
    });
  }
  if (gateCropBtn) {
    gateCropBtn.addEventListener('click', function () {
      if (!loadedImg) { return; }
      if (cropWrap) { cropWrap.hidden = false; }
      if (cropBtn) { cropBtn.setAttribute('aria-expanded', 'true'); }
      renderSingleCrop();
      if (cropWrap && cropWrap.scrollIntoView) {
        cropWrap.scrollIntoView({ block: 'nearest' });
      }
    });
  }
  if (gateFeatherBtn) {
    gateFeatherBtn.addEventListener('click', function () {
      /* Edge softening is the feather slider: focus it (and scroll it
       * into view) so the user adjusts the exact control the gate
       * named. The verdict stays until the next Make. */
      if (featherEl) {
        if (featherEl.scrollIntoView) { featherEl.scrollIntoView({ block: 'nearest' }); }
        featherEl.focus();
      }
    });
  }
  if (gateAnywayBtn) {
    gateAnywayBtn.addEventListener('click', function () {
      /* Explicit override, never silent: the Download link appears and
       * the panel records that the user chose to download anyway. */
      if (dlEl) { dlEl.style.display = 'inline-block'; }
      if (window.__bpGate) { window.__bpGate.overridden = true; }
      if (gateStatusEl) {
        gateStatusEl.textContent += ' ' + (window.dkT
          ? window.dkT('bp.gate_anyway_note', 'Downloaded anyway — the issues above still apply.')
          : 'Downloaded anyway — the issues above still apply.');
      }
      gateAnywayBtn.hidden = true;
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
      if (compareEl) { compareEl.hidden = true; } /* revealed after the gate verdict, below */
      /* The After <img> IS the final image now — the live preview canvas
       * would only duplicate it, so it hides until the next edit. */
      canvasEl.style.display = 'none';
      if (dlEl) {
        dlEl.href = currentURL;
        dlEl.download = 'board-photo-' + built.width + 'x' + built.height + '.jpg';
        dlEl.style.display = 'none'; /* hidden until the gate verdict */
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
      /* SUBJECT+CROP ROUND: the pre-download gate runs on the exact
       * blob above. The compare + Download reveal wait for its verdict
       * — a flagged photo never offers a silent download, and the
       * Ready message below is written after the verdict, so it can
       * never claim "Download below" for a photo whose download is
       * still hidden behind a failed check. */
      showGateChecking();
      verifyFinal(built, res.blob, spec).then(function (verdict) {
        if (seq !== finalSeq) { return; } /* superseded meanwhile */
        renderGate(verdict);
        if (compareEl) { compareEl.hidden = false; }
        if (verdict.pass && dlEl) { dlEl.style.display = 'inline-block'; }
        if (res.over) {
          say((window.dkT ? window.dkT('rsv_1226', 'Ready, but still over ') : 'Ready, but still over ') + spec.kb + (window.dkT ? window.dkT('rsv_1227', ' KB at lowest quality \u2014 try a plainer photo.') : ' KB at lowest quality \u2014 try a plainer photo.') + bgNote
            + (verdict.pass ? '' : (window.dkT ? window.dkT('bp.gate_say_fail', ' The photo check found issues — see below.') : ' The photo check found issues — see below.')));
        } else if (verdict.pass) {
          say((window.dkT ? window.dkT('rsv_0998', 'Ready: ') : 'Ready: ') + built.width + '\u00d7' + built.height + (window.dkT ? window.dkT('rsv_0951', ' px, under ') : ' px, under ') + spec.kb + (window.dkT ? window.dkT('rsv_0944', ' KB. Download below.') : ' KB. Download below.') + bgNote + qWarn);
        } else {
          say((window.dkT ? window.dkT('rsv_0998', 'Ready: ') : 'Ready: ') + built.width + '\u00d7' + built.height + (window.dkT ? window.dkT('rsv_0951', ' px, under ') : ' px, under ') + spec.kb + (window.dkT ? window.dkT('rsv_0944', ' KB. Download below.') : ' KB. Download below.') + bgNote + qWarn
            + (window.dkT ? window.dkT('bp.gate_say_fail', ' The photo check found issues — see below.') : ' The photo check found issues — see below.'));
        }
      });
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
    setSlider('bp-sharpness', 'bp-sharpness-v', Math.round(adj.sharpness * 100));
    setSlider('bp-highlights', 'bp-highlights-v', adj.highlights);
    setSlider('bp-shadows', 'bp-shadows-v', adj.shadows);
    /* Straighten shows degrees: setSlider writes the same value to the
     * input and the label, so the label needs its own line (input must
     * stay a bare number or the range control rejects it). */
    var stEl = $('bp-straighten'), stLab = $('bp-straighten-v');
    if (stEl) { stEl.value = String(straighten); }
    if (stLab) { stLab.textContent = straighten + '°'; }
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
  bindSlider('bp-sharpness', 'bp-sharpness-v', function (v) { adj.sharpness = v / 100; });
  bindSlider('bp-highlights', 'bp-highlights-v', function (v) { adj.highlights = v; });
  bindSlider('bp-shadows', 'bp-shadows-v', function (v) { adj.shadows = v; });
  /* Straighten needs its own listener (not bindSlider): the value label
   * shows degrees, and bindSlider writes the bare number to the label. */
  var straightenEl = $('bp-straighten'), straightenLab = $('bp-straighten-v');
  if (straightenEl) {
    straightenEl.addEventListener('input', function () {
      var v = parseInt(straightenEl.value, 10) || 0;
      if (straightenLab) { straightenLab.textContent = v + '°'; }
      straighten = v;
      rerender(true);
    });
  }
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
      rotation = 0; straighten = 0; flipH = false; bwOn = false; enhanceOn = false;
      adj = { brightness: 1, contrast: 1, saturation: 1, temp: 0,
        sharpness: 0.25, highlights: 0, shadows: 0 };
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
      loadedFileBytes = 0;
      syncMakeBtn();
      renderAnalysis(); /* no photo: the panel hides */
      say(window.dkT ? window.dkT('rsv_1279', 'Choose another photo.') : 'Choose another photo.');
    });
  }

  /* -- Interactive crop (single mode; same pattern as the bulk editor) ----- */
  /* Draggable + resizable from ANY side. Aspect stays LOCKED to the board
   * spec: drawSubject stretches the crop window into the output, so a
   * free-aspect rect would DISTORT the face at export — the lock is a
   * correctness rule, not a limitation. The user sees the FULL photo
   * while cropping (the rect is drawn over the whole image, never a
   * zoomed fragment). Apply stores fractions of the source image;
   * Cancel keeps the previous crop (or none). The original is
   * preserved — crop only changes the source window buildCanvas()
   * draws from (same render path, no second resample). */
  var singleCropDrag = null;
  /* The 8 drag handles: 4 edge midpoints (N/S/E/W) + 4 corners.
   * Drawn as gold #FFC531 squares (10x10) with a thin dark outline so
   * they read on light photos too. */
  function cropHandlePoints(rect) {
    var cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    return [
      { id: 'nw', x: rect.x, y: rect.y },
      { id: 'n', x: cx, y: rect.y },
      { id: 'ne', x: rect.x + rect.w, y: rect.y },
      { id: 'e', x: rect.x + rect.w, y: cy },
      { id: 'se', x: rect.x + rect.w, y: rect.y + rect.h },
      { id: 's', x: cx, y: rect.y + rect.h },
      { id: 'sw', x: rect.x, y: rect.y + rect.h },
      { id: 'w', x: rect.x, y: cy }
    ];
  }
  function drawCropOverlay(ctx, rect, W, H) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, rect.y);
    ctx.fillRect(0, rect.y + rect.h, W, H - (rect.y + rect.h));
    ctx.fillRect(0, rect.y, rect.x, rect.h);
    ctx.fillRect(rect.x + rect.w, rect.y, W - (rect.x + rect.w), rect.h);
    ctx.strokeStyle = '#FFC531'; ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    var pts = cropHandlePoints(rect);
    for (var i = 0; i < pts.length; i++) {
      /* The square is clamped inside the canvas: a handle on the rect's
       * edge (x=0 or x=W) would otherwise draw half off-canvas and
       * only a 5px sliver would show. The GRAB point stays the logical
       * handle position (hitCropHandle uses pts, not the drawn square),
       * so clamping the drawing changes nothing about dragging. */
      var hx = Math.max(0, Math.min(pts[i].x - 5, W - 10));
      var hy = Math.max(0, Math.min(pts[i].y - 5, H - 10));
      ctx.fillStyle = '#FFC531';
      ctx.fillRect(hx, hy, 10, 10);
      ctx.strokeStyle = '#7a5b00'; ctx.lineWidth = 1;
      ctx.strokeRect(hx, hy, 10, 10);
    }
    ctx.strokeStyle = '#FFC531'; ctx.lineWidth = 2;
  }
  function hitCropHandle(p, rect) {
    /* Generous 9px grab radius around each 10x10 handle (fingers and
     * imprecise mice both land it). Handles win over move: a point on
     * the border is a resize, not a drag. */
    var pts = cropHandlePoints(rect);
    for (var i = 0; i < pts.length; i++) {
      if (Math.abs(p.x - pts[i].x) <= 9 && Math.abs(p.y - pts[i].y) <= 9) {
        return pts[i].id;
      }
    }
    return null;
  }
  function cropCursorFor(mode) {
    return { nw: 'nwse-resize', se: 'nwse-resize',
      ne: 'nesw-resize', sw: 'nesw-resize',
      e: 'ew-resize', w: 'ew-resize', n: 'ns-resize', s: 'ns-resize',
      move: 'move' }[mode] || 'default';
  }
  /* Aspect-locked resize for one drag step. s = drag-start rect (display
   * px), dx/dy = pointer delta, Wc/Hc = canvas size, aspect = board
   * w/h. One axis drives, the other follows (h = w / aspect) — the
   * face can never stretch. Edge drags keep the rect's centre on the
   * untouched axis (symmetric growth); corner drags anchor the opposite
   * corner. Min size 20 display px on BOTH axes; the rect always stays
   * inside the canvas. */
  function cropDragRect(mode, s, dx, dy, Wc, Hc, aspect) {
    var minW = Math.max(20, 20 * aspect); /* w >= 20 AND h = w/aspect >= 20 */
    var rc = { x: s.x, y: s.y, w: s.w, h: s.h };
    function fitW(w, maxW) {
      w = Math.max(minW, Math.min(maxW, w));
      var h = w / aspect;
      if (h > Hc) { h = Hc; w = h * aspect; }
      return { w: w, h: h };
    }
    function fitH(h, maxH) {
      h = Math.max(20, Math.min(maxH, h));
      var w = h * aspect;
      if (w > Wc) { w = Wc; h = w / aspect; }
      return { w: w, h: h };
    }
    if (mode === 'e') {
      var fe = fitW(s.w + dx, Wc - s.x);
      rc.w = fe.w; rc.h = fe.h;
      rc.y = Math.max(0, Math.min(Hc - rc.h, (s.y + s.h / 2) - rc.h / 2));
    } else if (mode === 'w') {
      var right = s.x + s.w;
      var nx = Math.max(0, Math.min(right - minW, s.x + dx));
      var fw = fitW(right - nx, right);
      rc.w = fw.w; rc.h = fw.h; rc.x = right - rc.w;
      rc.y = Math.max(0, Math.min(Hc - rc.h, (s.y + s.h / 2) - rc.h / 2));
    } else if (mode === 's') {
      var fs = fitH(s.h + dy, Hc - s.y);
      rc.w = fs.w; rc.h = fs.h;
      rc.x = Math.max(0, Math.min(Wc - rc.w, (s.x + s.w / 2) - rc.w / 2));
    } else if (mode === 'n') {
      var bottom = s.y + s.h;
      var ny = Math.max(0, Math.min(bottom - 20, s.y + dy));
      var fn = fitH(bottom - ny, bottom);
      rc.w = fn.w; rc.h = fn.h; rc.y = bottom - rc.h;
      rc.x = Math.max(0, Math.min(Wc - rc.w, (s.x + s.w / 2) - rc.w / 2));
    } else if (mode === 'se') {
      var fse = fitW(s.w + dx, Wc - s.x);
      rc.w = fse.w; rc.h = fse.h;
      if (s.y + rc.h > Hc) { var hse = fitH(Hc - s.y, Hc - s.y); rc.w = hse.w; rc.h = hse.h; }
    } else if (mode === 'nw') {
      var right2 = s.x + s.w, bottom2 = s.y + s.h;
      var nx2 = Math.max(0, Math.min(right2 - minW, s.x + dx));
      var fnw = fitW(right2 - nx2, right2);
      rc.w = fnw.w; rc.h = fnw.h; rc.x = right2 - rc.w; rc.y = bottom2 - rc.h;
      if (rc.y < 0) { var hnw = fitH(bottom2, bottom2); rc.w = hnw.w; rc.h = hnw.h; rc.x = right2 - rc.w; rc.y = 0; }
    } else if (mode === 'ne') {
      var bottom3 = s.y + s.h;
      var fne = fitW(s.w + dx, Wc - s.x);
      rc.w = fne.w; rc.h = fne.h; rc.y = bottom3 - rc.h;
      if (rc.y < 0) { var hne = fitH(bottom3, bottom3); rc.w = hne.w; rc.h = hne.h; rc.y = 0; }
    } else if (mode === 'sw') {
      var right3 = s.x + s.w;
      var nx3 = Math.max(0, Math.min(right3 - minW, s.x + dx));
      var fsw = fitW(right3 - nx3, right3);
      rc.w = fsw.w; rc.h = fsw.h; rc.x = right3 - rc.w;
      if (s.y + rc.h > Hc) { var hsw = fitH(Hc - s.y, Hc - s.y); rc.w = hsw.w; rc.h = hsw.h; rc.x = right3 - rc.w; }
    }
    return rc;
  }
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
    if (singleCrop) {
      /* A stored crop has no .warn of its own: re-check it against the
       * full-source mask, so reopening the cropper still shows the
       * cut-subject warning the analysis panel shows. */
      rect.warn = cropCutsSubject().cut;
    }
    drawCropOverlay(ctx, rect, W, H);
    cropCanvas._rect = rect; cropCanvas._scale = scale; cropCanvas._aspect = aspect;
    var cropWarnEl = $('bp-crop-warn');
    if (cropWarnEl) { cropWarnEl.hidden = !rect.warn; }
  }
  function renderSingleCropOverlayOnly() {
    if (!loadedImg || !cropCanvas || !cropCanvas._rect) { return; }
    var ctx = cropCanvas.getContext('2d');
    ctx.drawImage(loadedImg, 0, 0, cropCanvas.width, cropCanvas.height);
    drawCropOverlay(ctx, cropCanvas._rect, cropCanvas.width, cropCanvas.height);
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
      /* Capture the pointer: without this a drag that runs past the
       * canvas edge stops dead (no more pointermove events), so a
       * long drag could never reach the clamp — the rect simply
       * froze where the pointer left. With capture the drag keeps
       * tracking outside and cropDragRect's clamping engages. */
      try { cropCanvas.setPointerCapture(e.pointerId); } catch (err) { /* old browsers: drag still works inside */ }
      var r = cropCanvas.getBoundingClientRect();
      var p = { x: e.clientX - r.left, y: e.clientY - r.top };
      var rc = cropCanvas._rect;
      var handle = hitCropHandle(p, rc);
      var inside = p.x >= rc.x && p.x <= rc.x + rc.w && p.y >= rc.y && p.y <= rc.y + rc.h;
      singleCropDrag = {
        mode: handle || (inside ? 'move' : null),
        startX: p.x, startY: p.y, rect: { x: rc.x, y: rc.y, w: rc.w, h: rc.h }
      };
      cropCanvas.style.cursor = cropCursorFor(singleCropDrag.mode);
    });
    cropCanvas.addEventListener('pointermove', function (e) {
      if (!cropCanvas._rect) { return; }
      var r = cropCanvas.getBoundingClientRect();
      var p = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (!singleCropDrag || !singleCropDrag.mode) {
        /* Hover: the cursor tells the user what a drag here would do. */
        var hover = hitCropHandle(p, cropCanvas._rect);
        var inside = p.x >= cropCanvas._rect.x && p.x <= cropCanvas._rect.x + cropCanvas._rect.w
          && p.y >= cropCanvas._rect.y && p.y <= cropCanvas._rect.y + cropCanvas._rect.h;
        cropCanvas.style.cursor = cropCursorFor(hover || (inside ? 'move' : null));
        return;
      }
      e.preventDefault();
      var dx = p.x - singleCropDrag.startX, dy = p.y - singleCropDrag.startY;
      var s = singleCropDrag.rect;
      var rc;
      if (singleCropDrag.mode === 'move') {
        rc = { x: Math.max(0, Math.min(cropCanvas.width - s.w, s.x + dx)),
          y: Math.max(0, Math.min(cropCanvas.height - s.h, s.y + dy)),
          w: s.w, h: s.h };
      } else {
        rc = cropDragRect(singleCropDrag.mode, s, dx, dy,
          cropCanvas.width, cropCanvas.height, cropCanvas._aspect);
      }
      cropCanvas._rect = rc;
      renderSingleCropOverlayOnly();
    });
    ['pointerup', 'pointerleave'].forEach(function (ev) {
      cropCanvas.addEventListener(ev, function () {
        singleCropDrag = null;
        if (cropCanvas._rect) { cropCanvas.style.cursor = 'default'; }
      });
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
      renderAnalysis(); /* the crop window moved: head margins change */
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
  /* REMOVED 18 Nov 2026 (cutout/share round): Print Sheet (4x6)
   * (#sheetBtn) is gone from the HTML and this handler is deleted with
   * it — the owner asked for the Print option to be removed entirely.
   * The sheet builder (1200x1800 tile download) is gone too; Download
   * already gives the single board photo, which is what the sheet
   * tiled. rsv_1229/rsv_1230 stay in the main dicts (unused). */

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

  /* -- Facebook share (cutout/share round, 18 Nov 2026) ------------------- */
  /* Same HONEST mechanism as WhatsApp: facebook.com/sharer/sharer.php
   * shares a PAGE LINK only — no website can attach an image file
   * through it (Facebook has no wa.me-style file upload, and the Web
   * Share API's file sharing is not offered by Facebook on desktop).
   * The user downloads the photo first and attaches it manually when
   * posting. Nothing here uploads the image anywhere. */
  if (fbBtn) {
    fbBtn.addEventListener('click', function () {
      window.open('https://www.facebook.com/sharer/sharer.php?u='
        + encodeURIComponent(window.location.href),
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
        /* Camera frames have no File: estimate the JPEG size from the
         * data URL (base64 ≈ 4/3 of the bytes) for the analysis panel. */
        loadedFileBytes = Math.round(dataUrl.length * 0.75);
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
    /* Subject+crop round test seams: the analysis bbox (with head zone),
     * the explicit-crop cut check, and the refined output-size mask as a
     * PNG data URL (alpha channel = refined mask) so tests can prove the
     * mask really follows the live feather slider. */
    maskOutBBox: maskOutBBox,
    cropCutsSubject: cropCutsSubject,
    refinedMaskDataURL: function () {
      var rm = refinedOutputMask();
      if (!rm) { return null; }
      return { dataUrl: rm.canvas.toDataURL('image/png'),
        outW: rm.outW, outH: rm.outH };
    },
    esc: esc
  };
})();
