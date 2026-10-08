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

    /* ---------------- i18n ----------------
   * All bp.* strings now live in the central dictionary (js/i18n-boardphoto.js).
   * This module reads them via DKI18N.t() — see t() helper below. */


  /* Fix: bind language dropdown and theme toggle (DKUI.init was never called on tool pages) */
  try {
    if (window.DKUI && typeof window.DKUI.init === "function") {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () { try { window.DKUI.init(); } catch (e) {} });
      } else {
        window.DKUI.init();
      }
    }
  } catch (e) {}

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
  var enhanceOn = false;
  var rotation = 0;      // 0 / 90 / 180 / 270
  var flipH = false;
  var bwOn = false;
  var stampOn = false;
  var stampText = "";
  var stampDateOn = false;

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
      toggleLabel.textContent = String(selected.name);
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
      html += '<li><button type="button" data-id="' + esc(String(b.id)) + '"' +
        (selected && selected.id === b.id ? ' aria-selected="true"' : "") +
        '><span>' + esc(String(b.name)) + "</span>" + badgeHTML(b) + "</button></li>";
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
  /* Build the final board photo canvas: crop + bg + rotate/flip + filters + stamp. */
  function buildPhotoCanvas(img) {
    var b = selected || genericBoard();
    var rot = ((rotation % 360) + 360) % 360;
    var outW = (rot === 90 || rot === 270) ? b.h : b.w;
    var outH = (rot === 90 || rot === 270) ? b.w : b.h;

    /* head-safe cover crop: fill outW×outH, bias crop toward the top so the head keeps headroom */
    var scale = Math.max(outW / img.naturalWidth, outH / img.naturalHeight);
    var cw = Math.round(outW / scale), ch = Math.round(outH / scale);
    var sx = Math.max(0, Math.round((img.naturalWidth - cw) / 2));
    var sy = Math.max(0, Math.round((img.naturalHeight - ch) * 0.32));

    var canvas = document.createElement("canvas");
    canvas.width = outW; canvas.height = outH;
    var ctx = canvas.getContext("2d");
    /* background fill: user override > board spec bg > white. "original" = no fill */
    var fill = bgOverride === "original" ? null : (bgOverride || b.bg || "#ffffff");
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(0, 0, outW, outH); }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    var filters = [];
    if (bwOn) filters.push("grayscale(1)");
    if (enhanceOn) filters.push("brightness(1.06) contrast(1.12) saturate(1.08)");
    ctx.filter = filters.length ? filters.join(" ") : "none";

    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    if (flipH) ctx.scale(-1, 1);
    ctx.rotate(rot * Math.PI / 180);
    ctx.drawImage(img, sx, sy, cw, ch, -outW / 2, -outH / 2, outW, outH);
    ctx.restore();
    ctx.filter = "none";

    /* name / date stamp, bottom-right */
    if (stampOn && (stampText || stampDateOn)) {
      var pad = Math.max(6, Math.round(outH * 0.03));
      var fs = Math.max(10, Math.round(outH * 0.055));
      var lines = [];
      if (stampText) lines.push(stampText);
      if (stampDateOn) {
        var d = new Date();
        lines.push(("0" + d.getDate()).slice(-2) + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + d.getFullYear());
      }
      var label = lines.join("  •  ");
      ctx.font = "600 " + fs + "px system-ui, -apple-system, sans-serif";
      ctx.textBaseline = "bottom";
      var tw = ctx.measureText(label).width;
      var bx = outW - tw - pad * 1.2, by = outH - pad * 0.9;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(bx - pad * 0.6, by - fs - pad * 0.7, tw + pad * 1.2, fs + pad * 0.9);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, bx, by);
    }
    return { canvas: canvas, b: b };
  }

  /* Binary-search JPEG quality to fit the KB target. Resolves {blob, over}. */
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
              canvas.toBlob(function (b2) { resolve({ blob: b2, over: true }); }, "image/jpeg", lo);
              return;
            }
            hi = q; attempt((lo + q) / 2);
          }
        }, "image/jpeg", q);
      }
      attempt((lo + hi) / 2);
    });
  }

  function processImage(img, silent) {
    if (!img) return;
    var built = buildPhotoCanvas(img);
    fitBlob(built.canvas, built.b.kb * 1024).then(function (res) {
      showResult(res.blob, built.b, res.over, silent, silent);
    });
  }

  function showResult(blob, b, overTarget, silent, noHist) {
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
    var wrap = $("previewWrap");
    wrap.classList.remove("pop");
    void wrap.offsetWidth;
    wrap.classList.add("pop");
    if (!silent && !noHist) pushHistory(b);
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
  function applyCustomSpec(name, w, h, kb, idp) {
    selected = { id: (idp || "custom") + "-" + w + "x" + h, name: name, w: w, h: h, kb: kb, bg: "#ffffff", bgName: "white", verified: false, note: t("bp.custom_note", "Your custom size. Confirm exact specs with your board."), source: "Custom" };
    bgOverride = null;
    syncToggleLabel();
    renderList("");
    renderSpec();
    syncBgBtns();
    if (lastImage) processImage(lastImage, true);
  }
  $("customBtn").addEventListener("click", function () {
    var w = Math.max(10, Math.min(4000, parseInt($("cw").value, 10) || 200));
    var h = Math.max(10, Math.min(4000, parseInt($("ch").value, 10) || 230));
    var kb = Math.max(1, Math.min(10240, parseInt($("ckb").value, 10) || 50));
    applyCustomSpec("Custom (" + w + "×" + h + ")", w, h, kb, "custom");
  });

  /* ---------------- toast ---------------- */
  var toastTimer = null;
  function toast(msg) {
    var el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("show");
      setTimeout(function () { el.hidden = true; }, 320);
    }, 2200);
  }
  function needPhoto() {
    if (!lastImage) { toast(t("bp.need_photo", "Please upload a photo first.")); return true; }
    return false;
  }

  /* ---------------- advanced section toggle ---------------- */
  var advOpen = false, advTimer = null;
  $("advToggle").addEventListener("click", function () {
    advOpen = !advOpen;
    var sec = $("advSection"), body = $("advBody");
    clearTimeout(advTimer);
    if (advOpen) {
      body.hidden = false;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { sec.classList.add("open"); });
      });
    } else {
      sec.classList.remove("open");
      advTimer = setTimeout(function () { if (!advOpen) body.hidden = true; }, 340);
    }
    $("advToggle").setAttribute("aria-expanded", advOpen ? "true" : "false");
  });

  /* ---------------- FEATURE: auto enhance ---------------- */
  $("enhanceBtn").addEventListener("click", function () {
    if (needPhoto()) return;
    enhanceOn = !enhanceOn;
    $("enhanceBtn").classList.toggle("active", enhanceOn);
    $("enhanceBtn").setAttribute("aria-pressed", enhanceOn ? "true" : "false");
    processImage(lastImage, true);
    if (enhanceOn) toast(t("bp.toast_enhanced", "Photo enhanced!"));
  });

  /* ---------------- FEATURE: rotate / flip ---------------- */
  $("rotL").addEventListener("click", function () {
    if (needPhoto()) return;
    rotation = (rotation + 270) % 360;
    processImage(lastImage, true);
    toast(t("bp.toast_rotated", "Photo rotated"));
  });
  $("rotR").addEventListener("click", function () {
    if (needPhoto()) return;
    rotation = (rotation + 90) % 360;
    processImage(lastImage, true);
    toast(t("bp.toast_rotated", "Photo rotated"));
  });
  $("flipH").addEventListener("click", function () {
    if (needPhoto()) return;
    flipH = !flipH;
    $("flipH").classList.toggle("active", flipH);
    processImage(lastImage, true);
    toast(t("bp.toast_flipped", "Photo flipped"));
  });

  /* ---------------- FEATURE: my presets ---------------- */
  function loadPresets() {
    try { var v = JSON.parse(localStorage.getItem("bp_presets") || "[]"); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function savePresets(p) {
    try { localStorage.setItem("bp_presets", JSON.stringify(p.slice(0, 12))); } catch (e) {}
  }
  function renderPresets() {
    var row = $("presetRow"), list = loadPresets(), html = "";
    for (var i = 0; i < list.length; i++) {
      html += '<span class="bchip"><button type="button" data-i="' + i + '">' + esc(list[i].name) +
        ' <small>' + list[i].w + "×" + list[i].h + '</small></button><button type="button" class="bx" data-del="' + i + '" aria-label="Delete">×</button></span>';
    }
    row.innerHTML = html;
  }
  $("presetRow").addEventListener("click", function (e) {
    var del = e.target.closest("[data-del]");
    if (del) {
      var l = loadPresets();
      l.splice(parseInt(del.getAttribute("data-del"), 10), 1);
      savePresets(l); renderPresets();
      return;
    }
    var btn = e.target.closest("[data-i]");
    if (btn) {
      var p = loadPresets()[parseInt(btn.getAttribute("data-i"), 10)];
      if (p) { applyCustomSpec(p.name, p.w, p.h, p.kb, "preset"); toast(p.name); }
    }
  });
  $("savePresetBtn").addEventListener("click", function () {
    var b = selected || genericBoard();
    var name = $("presetName").value.trim() || (b.w + "×" + b.h);
    var list = loadPresets();
    list.unshift({ name: name, w: b.w, h: b.h, kb: b.kb });
    savePresets(list); renderPresets();
    $("presetName").value = "";
    toast(t("bp.toast_preset", "Preset saved!"));
  });

  /* ---------------- FEATURE: name/date stamp ---------------- */
  $("stampName").addEventListener("input", function () {
    stampText = $("stampName").value.trim();
    stampOn = !!(stampText || stampDateOn);
    if (lastImage) processImage(lastImage, true);
  });
  $("stampDate").addEventListener("change", function () {
    stampDateOn = $("stampDate").checked;
    stampOn = !!(stampText || stampDateOn);
    if (lastImage) processImage(lastImage, true);
  });

  /* ---------------- FEATURE: B&W toggle ---------------- */
  $("bwToggle").addEventListener("change", function () {
    bwOn = $("bwToggle").checked;
    if (lastImage) processImage(lastImage, true);
    toast(t(bwOn ? "bp.toast_bw_on" : "bp.toast_bw_off", bwOn ? "B&W mode on" : "B&W mode off"));
  });

  /* ---------------- FEATURE: face guide ---------------- */
  $("guideToggle").addEventListener("change", function () {
    var on = $("guideToggle").checked;
    $("faceGuide").hidden = !on;
    toast(t(on ? "bp.toast_guide_on" : "bp.toast_guide_off", on ? "Face guide on" : "Face guide off"));
  });

  /* ---------------- FEATURE: email ---------------- */
  $("emailBtn").addEventListener("click", function () {
    var sub = encodeURIComponent(t("bp.email_sub", "My Board Photo"));
    var body = encodeURIComponent(t("bp.email_body", "Please find my board photo attached.") + "\n\n" + t("bp.email_note", "Note: attach the downloaded JPG manually — browsers cannot attach files automatically."));
    window.location.href = "mailto:?subject=" + sub + "&body=" + body;
  });

  /* ---------------- FEATURE: camera capture ---------------- */
  var camStream = null;
  function stopCam() {
    if (camStream) { camStream.getTracks().forEach(function (tr) { tr.stop(); }); camStream = null; }
    var v = $("camVideo");
    if (v) v.srcObject = null;
  }
  function closeCam() { $("camModal").hidden = true; stopCam(); }
  $("camBtn").addEventListener("click", function () {
    $("camErr").hidden = true;
    $("camModal").hidden = false;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      $("camErr").textContent = t("bp.cam_err", "Camera not available on this device.");
      $("camErr").hidden = false;
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false }).then(function (stream) {
      camStream = stream;
      $("camVideo").srcObject = stream;
    }).catch(function () {
      $("camErr").textContent = t("bp.cam_err", "Camera not available on this device.");
      $("camErr").hidden = false;
    });
  });
  $("camClose").addEventListener("click", closeCam);
  $("camX").addEventListener("click", closeCam);
  $("camModal").addEventListener("click", function (e) { if (e.target === $("camModal")) closeCam(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("camModal").hidden) closeCam(); });
  $("camShot").addEventListener("click", function () {
    var v = $("camVideo");
    if (!v.videoWidth) return;
    var c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    var img = new Image();
    img.onload = function () {
      closeCam();
      lastImage = img;
      clearErr();
      processImage(img, false);
      toast(t("bp.toast_captured", "Photo captured!"));
    };
    img.src = c.toDataURL("image/jpeg", 0.92);
  });

  /* ---------------- FEATURE: history ---------------- */
  function loadHist() {
    try { var v = JSON.parse(localStorage.getItem("bp_history") || "[]"); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function renderHist() {
    var row = $("histRow"), list = loadHist();
    if (!list.length) {
      row.innerHTML = '<p class="thint" style="margin:0">' + esc(t("bp.hist_empty", "No recent photos yet.")) + '</p>';
      return;
    }
    var html = "";
    for (var i = 0; i < list.length; i++) {
      html += '<button type="button" data-h="' + i + '" title="' + esc(list[i].name || "") + '"><img src="' + list[i].url + '" alt="Recent photo ' + (i + 1) + '"/></button>';
    }
    row.innerHTML = html;
  }
  function pushHistory(b) {
    try {
      var img = $("resultImg");
      if (!img.naturalWidth) return;
      var max = 240, r = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      var th = document.createElement("canvas");
      th.width = Math.max(1, Math.round(img.naturalWidth * r));
      th.height = Math.max(1, Math.round(img.naturalHeight * r));
      th.getContext("2d").drawImage(img, 0, 0, th.width, th.height);
      var list = loadHist();
      list.unshift({ name: b.name, w: b.w, h: b.h, url: th.toDataURL("image/jpeg", 0.72) });
      localStorage.setItem("bp_history", JSON.stringify(list.slice(0, 5)));
      renderHist();
    } catch (e) {}
  }
  $("histRow").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-h]");
    if (!btn) return;
    var item = loadHist()[parseInt(btn.getAttribute("data-h"), 10)];
    if (!item) return;
    fetch(item.url).then(function (r) { return r.blob(); }).then(function (blob) {
      showResult(blob, { id: "history", name: item.name, w: item.w, h: item.h, kb: 99999 }, false, false, true);
    }).catch(function () {});
  });

  /* ---------------- FEATURE: batch mode ---------------- */
  function validFileSilent(f) {
    return f && /^image\/(png|jpeg|webp)$/.test(f.type) && f.size <= 25 * 1024 * 1024;
  }
  $("batchBtn").addEventListener("click", function () { $("batchInput").click(); });
  $("batchInput").addEventListener("change", function () {
    var files = Array.prototype.slice.call($("batchInput").files || [], 0, 10).filter(validFileSilent);
    $("batchInput").value = "";
    var list = $("batchList");
    list.innerHTML = "";
    if (!files.length) {
      list.innerHTML = '<li class="thint">' + esc(t("bp.batch_empty", "No photos yet — choose some above.")) + '</li>';
      return;
    }
    files.forEach(function (f, idx) {
      var li = document.createElement("li");
      li.innerHTML = '<span class="thint">…</span>';
      list.appendChild(li);
      decodeFile(f).then(function (img) {
        var built = buildPhotoCanvas(img);
        return fitBlob(built.canvas, built.b.kb * 1024).then(function (res) {
          if (!res.blob) { li.innerHTML = '<span class="thint">' + esc(f.name) + '</span>'; return; }
          var url = URL.createObjectURL(res.blob);
          li.innerHTML = "";
          var th = document.createElement("img");
          th.src = url; th.alt = f.name;
          var nm = document.createElement("span");
          nm.className = "bqname"; nm.textContent = f.name;
          var dl = document.createElement("button");
          dl.type = "button"; dl.className = "tbtn tbtn-ghost tbtn-sm";
          dl.textContent = t("bp.download", "Download JPG");
          dl.addEventListener("click", function () {
            var a = document.createElement("a");
            a.href = url; a.download = "board-photo-" + (idx + 1) + ".jpg";
            document.body.appendChild(a); a.click(); a.remove();
          });
          li.appendChild(th); li.appendChild(nm); li.appendChild(dl);
        });
      }).catch(function () {
        li.innerHTML = '<span class="thint">' + esc(f.name) + '</span>';
      });
    });
  });

  /* ---------------- init ---------------- */
  selected = genericBoard();
  syncToggleLabel();
  setDropOpen(false);
  renderList("");
  renderSpec();
  syncBgBtns();
  renderPresets();
  renderHist();

  /* Phase 3 (i18n): re-render language-dependent dynamic content when the
   * site language changes. Static [data-i18n] nodes are handled by the core
   * engine; dropdown list, spec card, presets and history are JS-rendered. */
  document.addEventListener("dokit:langchange", function () {
    try {
      var si = $("boardSearch");
      syncToggleLabel();
      setDropOpen(false);
      renderList(si ? si.value : "");
      renderSpec();
      syncBgBtns();
      renderPresets();
      renderHist();
    } catch (e) { /* non-fatal */ }
  });
})();
