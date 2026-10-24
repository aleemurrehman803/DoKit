/* DoKit — Board Photo tool (Phase 2b).
 * Pick a board (32 boards/universities, specs from the old tool's
 * board list), upload a photo, and download it at that board's size
 * and max KB. Only BISE Bahawalpur's spec is published-notice
 * verified; every other board shows its verification state honestly.
 * Pipeline: fill background colour -> cover-crop photo -> binary
 * search JPEG quality until the file fits the board's max KB. */
(function () {
  'use strict';
  var BOARDS = [{"id": "bise-bahawalpur", "name": "BISE Bahawalpur", "w": 150, "h": 200, "kb": 22, "bg": "#e6f0ff", "bg_name": "blue", "verified": true}, {"id": "bise-peshawar", "name": "BISE Peshawar", "w": 300, "h": 300, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "bise-swat", "name": "BISE Swat", "w": 300, "h": 300, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "bie-karachi", "name": "BIE Karachi", "w": 200, "h": 230, "kb": 50, "bg": "#e6f0ff", "bg_name": "blue", "verified": true}, {"id": "bbise-quetta", "name": "BBISE Quetta", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "lums", "name": "LUMS", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "karachi-university", "name": "University of Karachi", "w": 230, "h": 200, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "nust", "name": "NUST", "w": 200, "h": 230, "kb": 50, "bg": "#e6f0ff", "bg_name": "blue", "verified": true}, {"id": "uet-lahore", "name": "UET Lahore", "w": 200, "h": 230, "kb": 1024, "bg": "#f8f8f8", "bg_name": "light", "verified": true}, {"id": "fbise", "name": "FBISE (Federal Board)", "w": 200, "h": 230, "kb": 50, "bg": "#2e7cd6", "bg_name": "blue", "verified": true}, {"id": "bise-lahore", "name": "BISE Lahore", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "bise-gujranwala", "name": "BISE Gujranwala", "w": 200, "h": 230, "kb": 18, "bg": "#2e7cd6", "bg_name": "blue", "verified": false}, {"id": "bise-rawalpindi", "name": "BISE Rawalpindi", "w": 200, "h": 230, "kb": 18, "bg": "#2e7cd6", "bg_name": "blue", "verified": false}, {"id": "bise-multan", "name": "BISE Multan", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-faisalabad", "name": "BISE Faisalabad", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-sargodha", "name": "BISE Sargodha", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-dg-khan", "name": "BISE D.G. Khan", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-sahiwal", "name": "BISE Sahiwal", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-hyderabad", "name": "BISE Hyderabad", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-sukkur", "name": "BISE Sukkur", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-larkana", "name": "BISE Larkana", "w": 200, "h": 230, "kb": 1024, "bg": "#add8e6", "bg_name": "light blue", "verified": true}, {"id": "bise-mirpurkhas", "name": "BISE Mirpurkhas", "w": 200, "h": 230, "kb": 1024, "bg": "#add8e6", "bg_name": "light blue", "verified": true}, {"id": "bise-mardan", "name": "BISE Mardan", "w": 300, "h": 300, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "bise-kohat", "name": "BISE Kohat", "w": 300, "h": 300, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "bise-abbottabad", "name": "BISE Abbottabad", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}, {"id": "bise-dikhan", "name": "BISE D.I. Khan", "w": 300, "h": 300, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "ajk-board", "name": "AJK Board Mirpur", "w": 200, "h": 230, "kb": 1024, "bg": "#2e7cd6", "bg_name": "blue", "verified": true}, {"id": "punjab-university", "name": "Punjab University", "w": 800, "h": 1000, "kb": 200, "bg": "#ffffff", "bg_name": "white", "verified": true}, {"id": "iba-karachi", "name": "IBA Karachi", "w": 200, "h": 230, "kb": 2048, "bg": "#2e7cd6", "bg_name": "blue", "verified": true}, {"id": "comsats", "name": "COMSATS", "w": 200, "h": 230, "kb": 50, "bg": "#2e7cd6", "bg_name": "blue", "verified": true}, {"id": "aiou", "name": "AIOU", "w": 200, "h": 230, "kb": 50, "bg": "#2e7cd6", "bg_name": "blue", "verified": true}, {"id": "generic", "name": "Pakistani admission (typical)", "w": 200, "h": 230, "kb": 50, "bg": "#ffffff", "bg_name": "white", "verified": false}];
  var BWP_NOTE = 'Official 2026 registration notice: 100\u2013150 px wide, '
    + '150\u2013200 px tall, 8\u201322 KB, blue background, '
    + 'head-to-shoulder photo.';

  var selectEl = document.getElementById('bp-board');
  var filterEl = document.getElementById('bp-filter');
  var specEl = document.getElementById('bp-spec');
  var fileEl = document.getElementById('bp-file');
  var canvasEl = document.getElementById('bp-canvas');
  var makeBtn = document.getElementById('bp-make');
  var dlEl = document.getElementById('bp-download');
  var msgEl = document.getElementById('bp-msg');
  if (!selectEl || !canvasEl) { return; }

  var current = BOARDS[0]; // default board until the user picks one
  var loadedImg = null;    // the uploaded photo, once chosen

  // Fill the board dropdown from the spec list (single source).
  function fillOptions(list) {
    selectEl.innerHTML = '';
    list.forEach(function (b) {
      var o = document.createElement('option');
      o.value = b.id;
      o.textContent = b.name + ' (' + b.w + '\u00d7' + b.h + ' px, max '
        + b.kb + ' KB)';
      selectEl.appendChild(o);
    });
  }
  // Show the chosen board's spec, including its verification state.
  function showSpec() {
    var b = current;
    specEl.innerHTML = '<p><b>' + b.name + '</b> \u2014 ' + b.w + '\u00d7'
      + b.h + ' px, max ' + b.kb + ' KB, background: ' + b.bg_name + ' ('
      + b.bg + ')' + (b.verified
        ? ' <span class="ok">\u2713 Verified spec</span>'
        : ' <span class="err">Unverified \u2014 confirm on your board\u2019s notice</span>')
      + '</p>' + (b.id === 'bise-bahawalpur' ? '<p>' + BWP_NOTE + '</p>' : '');
  }
  fillOptions(BOARDS);
  showSpec();
  selectEl.addEventListener('change', function () {
    var found = BOARDS.filter(function (b) { return b.id === selectEl.value; });
    if (found.length) { current = found[0]; showSpec(); }
  });
  // Searchable dropdown: typing filters the board list by name.
  if (filterEl) {
    filterEl.addEventListener('input', function () {
      var q = filterEl.value.trim().toLowerCase();
      var list = BOARDS.filter(function (b) {
        return !q || b.name.toLowerCase().indexOf(q) !== -1;
      });
      fillOptions(list);
      if (list.length) {
        selectEl.value = list[0].id; current = list[0];
        showSpec();
      }
    });
  }
  // Load the uploaded photo (never uploaded anywhere — FileReader only).
  fileEl.addEventListener('change', function () {
    var file = fileEl.files[0];
    if (!file) { return; }
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        loadedImg = img;
        msgEl.textContent = 'Photo loaded. Press \u201cMake board photo\u201d.';
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  // Build the photo: cover-crop onto the background colour, then
  // binary-search JPEG quality (8 steps) for the largest quality that
  // still fits the board's max KB.
  makeBtn.addEventListener('click', function () {
    if (!loadedImg) { msgEl.textContent = 'Choose a photo first.'; return; }
    var b = current;
    var ctx = canvasEl.getContext('2d');
    canvasEl.width = b.w; canvasEl.height = b.h;
    ctx.fillStyle = b.bg; ctx.fillRect(0, 0, b.w, b.h);
    // Cover-fit: scale so the photo covers the whole frame, centred.
    var scale = Math.max(b.w / loadedImg.width, b.h / loadedImg.height);
    var dw = loadedImg.width * scale, dh = loadedImg.height * scale;
    ctx.drawImage(loadedImg, (b.w - dw) / 2, (b.h - dh) / 2, dw, dh);
    var lo = 0.10, hi = 0.92, best = null;
    for (var i = 0; i < 8; i++) {
      var q = (lo + hi) / 2;
      var url = canvasEl.toDataURL('image/jpeg', q);
      var bytes = Math.round(url.length * 3 / 4); // base64 -> bytes
      if (bytes <= b.kb * 1024) { best = url; lo = q; }
      else { hi = q; }
    }
    if (best) {
      dlEl.href = best;
      dlEl.download = 'board-photo-' + b.w + 'x' + b.h + '.jpg';
      dlEl.style.display = 'inline-block';
      msgEl.textContent = 'Ready: ' + b.w + '\u00d7' + b.h + ' px, under '
        + b.kb + ' KB. Download below.';
    } else {
      dlEl.style.display = 'none';
      msgEl.textContent = 'Could not reach ' + b.kb + ' KB from this photo '
        + 'even at lowest quality — try a smaller or simpler original.';
    }
  });
})();
