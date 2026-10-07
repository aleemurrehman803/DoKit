/* Board Photo — exam/admission photos for Pakistani boards & universities.
   Vanilla JS, no dependencies. Everything runs locally in the browser. */
(function () {
  "use strict";

  /* ---------------- board specs (from board-specs-verified.json) ---------------- */
  var BOARDS = [
    { id: "bise-bahawalpur", name: "BISE Bahawalpur", w: 150, h: 200, kb: 22, bg: "#e6f0ff", bgName: "blue", verified: true, note: "Official 2026 registration notice: 100–150 px wide, 150–200 px tall, 8–22 KB, blue background, head-to-shoulder photo.", source: "Notification No. 132-Registration, 27-08-2026 (bisebwp.edu.pk)" },
    { id: "bise-peshawar", name: "BISE Peshawar", w: 300, h: 300, kb: 50, bg: "#ffffff", bgName: "white", verified: true, note: "300×300 px, white background, JPG.", source: "BISE Peshawar notification 05/Gen:/Reg:/BISEP (31-10-2022), reaffirmed 2026" },
    { id: "bise-swat", name: "BISE Swat", w: 300, h: 300, kb: 50, bg: "#ffffff", bgName: "white", verified: true, note: "300×300 px, white background. KB limit not published — 50 KB assumed.", source: "BISE Swat 9th enrollment notification (bisess.edu.pk)" },
    { id: "bie-karachi", name: "BIE Karachi", w: 200, h: 230, kb: 50, bg: "#e6f0ff", bgName: "blue", verified: true, note: "Passport size, blue background.", source: "biek.edu.pk enrolment instructions & official forms F04/F08" },
    { id: "bbise-quetta", name: "BBISE Quetta", w: 200, h: 230, kb: 50, bg: "#ffffff", bgName: "white", verified: true, note: "White background. Pixel/KB not published — typical standard used.", source: "BBISE SSC private registration portal (ssc2.bbise.edu.pk)" },
    { id: "lums", name: "LUMS", w: 200, h: 230, kb: 50, bg: "#ffffff", bgName: "white", verified: true, note: "Passport-size, white background. Pixel/KB not published — typical standard used.", source: "admission.lums.edu.pk checklist" },
    { id: "karachi-university", name: "University of Karachi", w: 230, h: 200, kb: 50, bg: "#ffffff", bgName: "white", verified: true, note: "KU needs LANDSCAPE orientation (unusual) — double-check before uploading.", source: "uokadmission.edu.pk profile-picture instructions" },
    { id: "nust", name: "NUST", w: 200, h: 230, kb: 50, bg: "#e6f0ff", bgName: "blue", verified: true, note: "Light blue background (joining documents); portal specs not published.", source: "pnec.nust.edu.pk joining instructions" },
    { id: "uet-lahore", name: "UET Lahore", w: 200, h: 230, kb: 1024, bg: "#f8f8f8", bgName: "light", verified: true, note: "JPG/PNG, max 1 MB, light background. Pixels not published — typical standard used.", source: "UET ECAT 2020 official instructions" },
    { id: "fbise", name: "FBISE (Federal Board)", w: 200, h: 230, kb: 50, bg: "#2e7cd6", bgName: "blue", verified: true, note: "Blue or white background. Pixels/KB not published — typical standard used.", source: "FBISE notification F-01/FBISE/SSC-A/2nd AE-26/0167 (29-07-2026)" },
    { id: "bise-lahore", name: "BISE Lahore", w: 200, h: 230, kb: 50, bg: "#ffffff", bgName: "white", verified: true, note: "White background (official portals). Pixels/KB not published — typical standard used.", source: "BISE Lahore registration portals" },
    { id: "bise-gujranwala", name: "BISE Gujranwala", w: 200, h: 230, kb: 18, bg: "#2e7cd6", bgName: "blue", verified: false, note: "Specs not published — confirm with the board.", source: "Typical standard" },
    { id: "bise-rawalpindi", name: "BISE Rawalpindi", w: 200, h: 230, kb: 18, bg: "#2e7cd6", bgName: "blue", verified: false, note: "Specs not published — confirm with the board.", source: "Typical standard" },
    { id: "bise-multan", name: "BISE Multan", w: 200, h: 230, kb: 50, bg: "#ffffff", bgName: "white", verified: false, note: "Specs not published — confirm with the board.", source: "Typical standard" },
    { id: "bise-faisalabad", name: "BISE Faisalabad", w: 200, h: 230, kb: 50, bg: "#ffffff", bgName: "white", verified: false, note: "Specs not published — confirm with the board.", source: "Typical standard" },
    { id: "bise-sargodha", name: "BISE Sargodha", w: 200, h: 230, kb: 50, bg: "#ffffff", bgName: "white", verified: false, note: "Specs not published — confirm with the board.", source: "Typical standard" },
    { id: "bise-dg-khan", name: "BISE D.G. Khan", w: 200, h: 230, kb: 50, bg: "#ffffff", bgName: "white", verified: false, note: "Specs not published — confirm with the board.", source: "Typical standard" },
    { id: "bise-sahiwal", name: "BISE Sahiwal", w: 200, h: 230, kb: 50, bg: "#ffffff", bgName: "white", verified: false, note: "Specs not published — confirm with the board.", source: "Typical standard" },
    { id: "bise-hyderabad", name: "BISE Hyderabad", w: 200, h: 230, kb: 50, bg: "#ffffff", bgName: "white", verified: false, note: "Specs not published — confirm with the board.", source: "Typical standard" },
    { id: "bise-sukkur", name: "BISE Sukkur", w: 200, h: 230, kb: 50, bg: "#ffffff", bgName: "white", verified: false, note: "Specs not published — confirm with the board.", source: "Typical standard" },
    { id: "bise-larkana", name: "BISE Larkana", w: 200, h: 230, kb: 1024, bg: "#add8e6", bgName: "light blue", verified: true, note: "Light blue background, under 1 MB. Pixels not published — typical standard used.", source: "BISE Larkana notification BISE/ACD/LRK/175/2026 (17-09-2026)" },
    { id: "bise-mirpurkhas", name: "BISE Mirpurkhas", w: 200, h: 230, kb: 1024, bg: "#add8e6", bgName: "light blue", verified: true, note: "Light blue background, under 1 MB. Pixels not published — typical standard used.", source: "BISE Mirpurkhas notification BISE/HSC-Enrolment/MPS/-01 (09-01-2024)" },
    { id: "bise-mardan", name: "BISE Mardan", w: 300, h: 300, kb: 50, bg: "#ffffff", bgName: "white", verified: true, note: "300×300 px, white background.", source: "BISE Mardan notifications 2017–2018 (bisemdn.edu.pk)" },
    { id: "bise-kohat", name: "BISE Kohat", w: 300, h: 300, kb: 50, bg: "#ffffff", bgName: "white", verified: true, note: "300×300 px, white background.", source: "BISE Kohat notification 142/Gen:/Reg/BISEK (10-09-2025)" },
    { id: "bise-abbottabad", name: "BISE Abbottabad", w: 200, h: 230, kb: 50, bg: "#ffffff", bgName: "white", verified: false, note: "Specs not published — confirm with the board.", source: "Typical standard" },
    { id: "bise-dikhan", name: "BISE D.I. Khan", w: 300, h: 300, kb: 50, bg: "#ffffff", bgName: "white", verified: true, note: "300×300 px, white background.", source: "BISE D.I. Khan notification (16-05-2019)" },
    { id: "ajk-board", name: "AJK Board Mirpur", w: 200, h: 230, kb: 1024, bg: "#2e7cd6", bgName: "blue", verified: true, note: "Passport size, blue background, under 1 MB, JPG. Pixels not published — typical standard used.", source: "AJK BISE registration booklets (ajkbise.net)" },
    { id: "punjab-university", name: "Punjab University", w: 800, h: 1000, kb: 200, bg: "#ffffff", bgName: "white", verified: true, note: "Max 200 KB, max 800×1000 px. Background not published — white assumed.", source: "pu.edu.pk official FAQ" },
    { id: "iba-karachi", name: "IBA Karachi", w: 200, h: 230, kb: 2048, bg: "#2e7cd6", bgName: "blue", verified: true, note: "Blue background, JPG/GIF/PNG up to 2 MB (testing-services form). Pixels not published — typical standard used.", source: "iba.edu.pk testing services form" },
    { id: "comsats", name: "COMSATS", w: 200, h: 230, kb: 50, bg: "#2e7cd6", bgName: "blue", verified: true, note: "Blue background. Pixels/KB not published — typical standard used.", source: "CUI prospectus for international students" },
    { id: "aiou", name: "AIOU", w: 200, h: 230, kb: 50, bg: "#2e7cd6", bgName: "blue", verified: true, note: "Passport size, blue background. Pixels/KB not published — typical standard used.", source: "aiou.edu.pk admission FAQ" },
    { id: "generic", name: "Pakistani admission (typical)", w: 200, h: 230, kb: 50, bg: "#ffffff", bgName: "white", verified: false, note: "Common Pakistani exam standard. Confirm exact specs with your board.", source: "Typical standard" }
  ];

  /* ---------------- i18n (English fallback; full Urdu coming soon) ---------------- */
  if (window.DKI18N && typeof window.DKI18N.add === "function") {
    window.DKI18N.add("en", {
      "bp.hero_desc": "Exam & admission photos for Pakistani boards & universities — exact size, background and KB your board asks for. Free, private, in your browser.",
      "bp.privacy": "Your photo never leaves your device — 100% private.",
      "bp.step1": "Find your board or university",
      "bp.search_label": "Search boards & universities",
      "bp.search_ph": "Type to search… e.g. BISE Lahore",
      "bp.select_placeholder": "Select your board / university",
      "bp.no_match": "No match — pick “Pakistani admission (typical)” or set a custom size below.",
      "bp.custom_title": "Custom size (board not listed?)",
      "bp.width": "Width (px)",
      "bp.height": "Height (px)",
      "bp.kb": "Max size (KB)",
      "bp.custom_apply": "Use custom size",
      "bp.step2": "Upload your photo",
      "bp.drop_title": "Drag & drop your photo here",
      "bp.drop_or": "or",
      "bp.drop_browse": "browse your files",
      "bp.drop_hint": "PNG, JPEG, WebP · up to 25 MB · one photo",
      "bp.integrity_note": "Your face is never altered — only size, framing and file size change.",
      "bp.step3": "Download your board photo",
      "bp.download": "Download JPG",
      "bp.again": "Use another photo",
      "bp.bg_label": "Background colour",
      "bp.bg_white": "White",
      "bp.bg_blue": "Blue",
      "bp.bg_red": "Red",
      "bp.bg_board": "Board default",
      "bp.bg_original": "Keep original",
      "bp.print_sheet": "Print Sheet (4×6)",
      "bp.share_wa": "Share on WhatsApp",
      "bp.share_msg": "I made my board photo with DoKit Board Photo",
      "bp.verified": "Verified specs",
      "bp.typical": "Typical — confirm with your board",
      "bp.spec_size": "Size",
      "bp.spec_bg": "Background",
      "bp.spec_kb": "Max file size",
      "bp.bg_tip": "For best results use a photo taken against a plain {bg} background.",
      "bp.result_ok": "Fits the KB target.",
      "bp.result_over": "Still over the target at lowest quality — try a plainer photo.",
      "bp.err_type": "Please choose a PNG, JPEG or WebP image.",
      "bp.err_size": "This file is too large — please use an image under 25 MB.",
      "bp.err_read": "This image couldn't be read — the file may be corrupted.",
      "bp.howto_title": "How to make a board exam photo",
      "bp.howto_1t": "Find your board",
      "bp.howto_1d": "Type your board or university name and pick it from the list. Check the spec card for the exact size, background and KB.",
      "bp.howto_2t": "Upload your photo",
      "bp.howto_2d": "Drop a clear, front-facing photo into the box. A plain background matching your board's requirement works best.",
      "bp.howto_3t": "Auto-fit to board specs",
      "bp.howto_3d": "The photo is auto-cropped to your board's exact dimensions and compressed to fit the KB target — your face stays fully in frame.",
      "bp.howto_4t": "Download",
      "bp.howto_4d": "Download the JPG and upload it straight to your board's admission or registration portal.",
      "bp.tips_title": "Pro tips",
      "bp.tip_1t": "Use a plain background photo",
      "bp.tip_1d": "Boards reject busy backgrounds. Take the photo against a plain wall in the colour your board asks for (usually white or blue).",
      "bp.tip_2t": "Face the camera, neutral expression",
      "bp.tip_2d": "Look straight at the camera with eyes open and a neutral expression — the same rules as a passport photo.",
      "bp.tip_3t": "Check “typical” specs with your board",
      "bp.tip_3d": "Boards marked “typical” haven't published official specs — the common Pakistani exam standard is used. Confirm the size with your board before submitting.",
      "bp.faq_title": "Frequently asked questions",
      "bp.faq_q1": "Which boards and universities are included?",
      "bp.faq_a1": "BISE Peshawar, BISE Swat, BISE Mardan, BISE Kohat and BISE D.I. Khan (300×300 px, white background), BIE Karachi (passport size, blue background), BBISE Quetta (white background), BISE Bahawalpur (150×200 px, 8–22 KB, blue background), FBISE, LUMS, NUST, UET Lahore, Punjab University, University of Karachi, IBA Karachi, COMSATS, AIOU, AJK Board and more. Boards marked “typical” use the common Pakistani exam standard — please confirm with your board.",
      "bp.faq_q2": "What does the verified badge mean?",
      "bp.faq_a2": "“Verified” means the size, background and file-size limit were read from an official board notification or the board's own website. “Typical” means the board hasn't published specs, so the common Pakistani exam standard is used — confirm with your board before submitting.",
      "bp.faq_q3": "What if my board is missing?",
      "bp.faq_a3": "Use the generic “Pakistani admission (typical)” preset, or type your board's width, height and KB target into the custom fields — every field is editable.",
      "bp.faq_q4": "Is my photo uploaded anywhere?",
      "bp.faq_a4": "Never. Everything runs in your browser with JavaScript — your photo never leaves your device.",
      "bp.faq_q5": "How is the photo cropped?",
      "bp.faq_a5": "The tool auto-crops to your board's exact dimensions, keeping the head fully in frame with headroom — your face is never altered or cut.",
      "bp.faq_q6": "What file format do I get?",
      "bp.faq_a6": "A JPG sized to your board's exact pixels and compressed to fit at or under the KB target, ready to upload to the board's portal.",
      "bp.related": "Related tools"
    });
    window.DKI18N.add("ur", {
      "bp.select_placeholder": "اپنا بورڈ / یونیورسٹی منتخب کریں",
      "bp.search_label": "بورڈز اور یونیورسٹیاں تلاش کریں",
      "bp.search_ph": "تلاش کے لیے لکھیں… مثلاً BISE Lahore",
      "bp.no_match": "کوئی نتیجہ نہیں — “Pakistani admission (typical)” منتخب کریں یا نیچے کسٹم سائز لکھیں۔",
      "bp.verified": "تصدیق شدہ تفصیلات",
      "bp.typical": "معمول — اپنے بورڈ سے تصدیق کریں",
      "bp.bg_label": "پس منظر کا رنگ",
      "bp.bg_white": "سفید",
      "bp.bg_blue": "نیلا",
      "bp.bg_red": "سرخ",
      "bp.bg_board": "بورڈ کا طے شدہ",
      "bp.bg_original": "اصل رکھیں",
      "bp.print_sheet": "پرنٹ شیٹ (4×6)",
      "bp.share_wa": "واٹس ایپ پر شیئر کریں",
      "bp.share_msg": "میں نے DoKit Board Photo سے اپنی بورڈ فوٹو بنائی"
    });
  }

  /* ---------------- helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  function t(key, fallback) {
    if (window.DKI18N && typeof window.DKI18N.t === "function") {
      try { var v = window.DKI18N.t(key); if (v && v !== key) return v; } catch (e) {}
    }
    return fallback;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function showErr(msg) {
    var box = $("errBox");
    box.innerHTML = "<strong>Error</strong>" + esc(msg);
    box.hidden = false;
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function clearErr() { $("errBox").hidden = true; }

  /* ---------------- state ---------------- */
  var selected = null;   // selected board object
  var currentBlob = null;
  var currentName = "board-photo.jpg";
  var processing = false;
  var bgOverride = null; // null = board's spec bg; "original" = no fill; else a css colour

  function genericBoard() {
    for (var i = 0; i < BOARDS.length; i++) {
      if (BOARDS[i].id === "generic") return BOARDS[i];
    }
    return BOARDS[0];
  }

  /* ---------------- board dropdown ---------------- */
  var drop = $("boardDrop");
  var toggle = $("boardToggle");
  var menu = $("boardMenu");
  var searchInput = $("boardSearch");
  var toggleLabel = $("boardToggleLabel");
  var dropOpen = false;

  function setDropOpen(open) {
    dropOpen = open;
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    drop.classList.toggle("open", open);
    if (open) {
      searchInput.value = "";
      renderList("");
      setTimeout(function () { searchInput.focus(); }, 30);
    }
  }

  function syncToggleLabel() {
    if (selected && selected.id !== "generic") {
      toggleLabel.textContent = selected.name;
      toggle.classList.add("has-value");
    } else {
      toggleLabel.textContent = t("bp.select_placeholder", "Select your board / university");
      toggle.classList.remove("has-value");
    }
  }

  toggle.addEventListener("click", function (e) {
    e.stopPropagation();
    setDropOpen(!dropOpen);
  });
  toggle.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!dropOpen) setDropOpen(true);
    }
  });
  menu.addEventListener("click", function (e) { e.stopPropagation(); });
  document.addEventListener("click", function (e) {
    if (dropOpen && !drop.contains(e.target)) setDropOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && dropOpen) { setDropOpen(false); toggle.focus(); }
  });
  /* keyboard: arrows move through options, Enter picks */
  searchInput.addEventListener("keydown", function (e) {
    var items = menu.querySelectorAll("#boardList button[data-id]");
    if (!items.length) return;
    var idx = -1;
    for (var i = 0; i < items.length; i++) {
      if (items[i] === document.activeElement) { idx = i; break; }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      (items[idx + 1] || items[0]).focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx <= 0) { searchInput.focus(); }
      else { items[idx - 1].focus(); }
    }
  });
  function badgeHTML(b) {
    if (b.verified) {
      return '<span class="bmini bmini-v">✓ ' + esc(t("bp.verified", "Verified specs")) + "</span>";
    }
    return '<span class="bmini bmini-t">⚠ ' + esc(t("bp.typical", "Typical — confirm with your board")) + "</span>";
  }

  function renderList(filter) {
    var list = $("boardList");
    var q = (filter || "").trim().toLowerCase();
    var html = "";
    var count = 0;
    for (var i = 0; i < BOARDS.length; i++) {
      var b = BOARDS[i];
      if (q && b.name.toLowerCase().indexOf(q) === -1) continue;
      count++;
      html += '<li><button type="button" data-id="' + esc(b.id) + '"' +
        (selected && selected.id === b.id ? ' aria-selected="true"' : "") +
        '><span>' + esc(b.name) + "</span>" + badgeHTML(b) + "</button></li>";
    }
    list.innerHTML = html;
    $("boardNone").hidden = count > 0;
  }

  function renderSpec() {
    var box = $("boardInfo");
    if (!selected) { box.hidden = true; return; }
    var b = selected;
    var badge = b.verified
      ? '<span class="bbadge bbadge-verified">✓ ' + esc(t("bp.verified", "Verified specs")) + "</span>"
      : '<span class="bbadge bbadge-typical">⚠ ' + esc(t("bp.typical", "Typical — confirm with your board")) + "</span>";
    box.innerHTML =
      '<p class="bspec-name">' + esc(b.name) + " " + badge + "</p>" +
      '<div class="bspec-grid">' +
      '<div><p class="bspec-k">' + esc(t("bp.spec_size", "Size")) + '</p><p class="bspec-v">' + b.w + " × " + b.h + " px</p></div>" +
      '<div><p class="bspec-k">' + esc(t("bp.spec_bg", "Background")) + '</p><p class="bspec-v"><span class="bswatch" style="background:' + esc(b.bg) + '"></span>' + esc(b.bgName) + "</p></div>" +
      '<div><p class="bspec-k">' + esc(t("bp.spec_kb", "Max file size")) + "</p><p class=\"bspec-v\">" + (b.kb >= 1024 ? (b.kb / 1024) + " MB" : b.kb + " KB") + "</p></div>" +
      "</div>" +
      '<p class="bspec-note">' + esc(b.note) + "</p>" +
      '<p class="bspec-src">' + esc(b.source) + "</p>";
    box.hidden = false;
  }

  function selectBoard(id) {
    for (var i = 0; i < BOARDS.length; i++) {
      if (BOARDS[i].id === id) { selected = BOARDS[i]; break; }
    }
    if (!selected) selected = genericBoard();
    bgOverride = null; /* new board -> back to its spec background */
    syncToggleLabel();
    setDropOpen(false);
    renderList("");
    renderSpec();
    syncBgBtns();
    if (currentBlob) processImage(lastImage, true);
  }

  /* ---------------- upload ---------------- */
  var lastImage = null;
  var dz = $("dz");
  var fileInput = $("fileInput");

  function validFile(f) {
    if (!f) return false;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) {
      showErr(t("bp.err_type", "Please choose a PNG, JPEG or WebP image."));
      return false;
    }
    if (f.size > 25 * 1024 * 1024) {
      showErr(t("bp.err_size", "This file is too large — please use an image under 25 MB."));
      return false;
    }
    return true;
  }

  function decodeFile(f) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(f);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("decode")); };
      img.src = url;
    });
  }

  function handleFile(f) {
    if (processing || !validFile(f)) return;
    clearErr();
    processing = true;
    decodeFile(f).then(function (img) {
      lastImage = img;
      processImage(img, false);
      processing = false;
    }).catch(function () {
      processing = false;
      showErr(t("bp.err_read", "This image couldn't be read — the file may be corrupted."));
    });
  }

  dz.addEventListener("click", function (e) {
    if (e.target && e.target.id === "browseBtn") return;
    fileInput.click();
  });
  $("browseBtn").addEventListener("click", function (e) {
    e.stopPropagation();
    fileInput.click();
  });
  dz.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener("change", function () {
    if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]);
    fileInput.value = "";
  });
  ["dragover", "dragenter"].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("dragover"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove("dragover"); });
  });
  dz.addEventListener("drop", function (e) {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  /* ---------------- processing ---------------- */
  function canvasToBlob(canvas, quality) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (b) { resolve(b); }, "image/jpeg", quality);
    });
  }

  function processImage(img, silent) {
    if (!img) return;
    var b = selected || genericBoard();
    var W = b.w, H = b.h;
    var target = b.kb * 1024;

    /* head-safe cover crop: fill W×H, bias crop toward the top so the head keeps headroom */
    var scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    var cw = Math.round(W / scale), ch = Math.round(H / scale);
    var sx = Math.max(0, Math.round((img.naturalWidth - cw) / 2));
    var sy = Math.max(0, Math.round((img.naturalHeight - ch) * 0.32));

    var canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext("2d");
    /* background fill: user override > board spec bg > white. "original" = no fill */
    var fill = bgOverride === "original" ? null : (bgOverride || b.bg || "#ffffff");
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(0, 0, W, H); }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, cw, ch, 0, 0, W, H);

    /* binary-search JPEG quality to fit the KB target */
    var lo = 0.05, hi = 0.95, best = null, bestQ = lo;
    function step() {
      if (hi - lo < 0.02) return finish();
      var q = (lo + hi) / 2;
      canvasToBlob(canvas, q).then(function (blob) {
        if (!blob) return finish();
        if (blob.size <= target) { best = blob; bestQ = q; lo = q; }
        else { hi = q; }
        step();
      });
    }
    function finish() {
      if (!best) {
        canvasToBlob(canvas, lo).then(function (blob) { showResult(blob || null, b, true, silent); });
      } else {
        showResult(best, b, false, silent);
      }
    }
    step();
  }

  function showResult(blob, b, overTarget, silent) {
    var step = $("resultStep");
    if (!blob) {
      showErr(t("bp.err_read", "This image couldn't be read — the file may be corrupted."));
      step.hidden = true;
      return;
    }
    currentBlob = blob;
    currentName = "board-photo-" + b.id + ".jpg";
    var url = URL.createObjectURL(blob);
    var img = $("resultImg");
    if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
    img.dataset.url = url;
    img.src = url;

    $("pillDims").textContent = b.w + " × " + b.h + " px · JPG";
    var kb = blob.size / 1024;
    var pill = $("pillSize");
    pill.textContent = kb < 1024 ? kb.toFixed(1) + " KB" : (kb / 1024).toFixed(2) + " MB";
    pill.className = "bpill " + (overTarget ? "warn" : "ok");

    var note = $("resultNote");
    if (overTarget) {
      note.textContent = t("bp.result_over", "Still over the target at lowest quality — try a plainer photo.");
      note.hidden = false;
    } else {
      note.hidden = true;
    }
    step.hidden = false;
    if (!silent) step.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  $("downloadBtn").addEventListener("click", function () {
    if (!currentBlob) return;
    var a = document.createElement("a");
    a.href = URL.createObjectURL(currentBlob);
    a.download = currentName;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  });

  $("againBtn").addEventListener("click", function () {
    currentBlob = null;
    lastImage = null;
    $("resultStep").hidden = true;
    fileInput.click();
  });

  /* ---------------- FEATURE 1: background changer ---------------- */
  var bgBtns = document.querySelectorAll("#bgRow .bbg-btn");
  function syncBgBtns() {
    for (var i = 0; i < bgBtns.length; i++) {
      var v = bgBtns[i].getAttribute("data-bg");
      var active = (bgOverride === null && v === "board") || (bgOverride === v);
      bgBtns[i].classList.toggle("active", active);
      bgBtns[i].setAttribute("aria-pressed", active ? "true" : "false");
    }
  }
  for (var bi = 0; bi < bgBtns.length; bi++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        var v = btn.getAttribute("data-bg");
        bgOverride = (v === "board") ? null : v;
        syncBgBtns();
        if (lastImage) processImage(lastImage, true);
      });
    })(bgBtns[bi]);
  }

  /* ---------------- FEATURE 2: print sheet (4x6in @300dpi) ---------------- */
  $("sheetBtn").addEventListener("click", function () {
    if (!currentBlob) return;
    var url = URL.createObjectURL(currentBlob);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      makePrintSheet(img);
    };
    img.onerror = function () { URL.revokeObjectURL(url); };
    img.src = url;
  });

  function makePrintSheet(img) {
    var SHEET_W = 1200, SHEET_H = 1800, GAP = 12; /* 4x6 inch @ 300 DPI */
    var pw = img.naturalWidth || 200, ph = img.naturalHeight || 230;
    var cols = Math.max(1, Math.floor((SHEET_W + GAP) / (pw + GAP)));
    var rows = Math.max(1, Math.floor((SHEET_H + GAP) / (ph + GAP)));
    var gridW = cols * pw + (cols - 1) * GAP;
    var gridH = rows * ph + (rows - 1) * GAP;
    var ox = Math.round((SHEET_W - gridW) / 2);
    var oy = Math.round((SHEET_H - gridH) / 2);
    var canvas = document.createElement("canvas");
    canvas.width = SHEET_W; canvas.height = SHEET_H;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SHEET_W, SHEET_H);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        ctx.drawImage(img, ox + c * (pw + GAP), oy + r * (ph + GAP), pw, ph);
      }
    }
    canvas.toBlob(function (blob) {
      if (!blob) return;
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "board-photo-sheet-4x6.jpg";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    }, "image/jpeg", 0.92);
  }

  /* ---------------- FEATURE 3: WhatsApp share ---------------- */
  $("waBtn").addEventListener("click", function () {
    var msg = t("bp.share_msg", "I made my board photo with DoKit Board Photo") + " \uD83C\uDF93\n" + location.href;
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank", "noopener");
  });

  /* ---------------- board search + custom ---------------- */
  $("boardSearch").addEventListener("input", function () {
    renderList($("boardSearch").value);
  });
  $("boardList").addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-id]");
    if (btn) selectBoard(btn.getAttribute("data-id"));
  });
  $("customBtn").addEventListener("click", function () {
    var w = Math.max(10, Math.min(4000, parseInt($("cw").value, 10) || 200));
    var h = Math.max(10, Math.min(4000, parseInt($("ch").value, 10) || 230));
    var kb = Math.max(1, Math.min(10240, parseInt($("ckb").value, 10) || 50));
    selected = { id: "custom", name: "Custom (" + w + "×" + h + ")", w: w, h: h, kb: kb, bg: "#ffffff", bgName: "white", verified: false, note: "Your custom size. Confirm exact specs with your board.", source: "Custom" };
    bgOverride = null;
    syncToggleLabel();
    renderList("");
    renderSpec();
    syncBgBtns();
    if (lastImage) processImage(lastImage, true);
  });

  /* ---------------- init ---------------- */
  selected = genericBoard();
  syncToggleLabel();
  setDropOpen(false);
  renderList("");
  renderSpec();
  syncBgBtns();
})();
