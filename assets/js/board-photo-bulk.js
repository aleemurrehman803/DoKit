/* DoKit — Board Photo BULK upgrade (500-image studio).
 * Single Photo + Bulk Photo modes for the EXISTING Board Photo tool.
 * Everything runs in the browser: photos never leave the device.
 *
 * Architecture (see BOARD_PHOTO_REGISTER.md in dokit-audit):
 *  - board-photo.js (live) owns boards + the pixel pipeline and exposes
 *    window.DKBoardPhoto — this file NEVER re-implements the pipeline.
 *  - board-photo-bulk-logic.js (UMD, pure) owns the rules: validation,
 *    editing priority, crop maths, naming, queue, manifest.
 *  - board-photo-zip.js (UMD) + vendored fflate own ZIP in/out.
 *  - This file owns DOM only: mode switch, intake, manager, editor,
 *    queue driving, export wiring, IndexedDB session, diagnostics.
 * Classic script, var only, no modules, no CDN. Every async call has
 * error handling; every user-facing string goes through dkT() with an
 * English fallback (keys: bpb.* in js/i18n-boardphoto.js). */
(function () {
  'use strict';
  /* The bulk engine cannot run without the live pipeline API. If the
   * page ever loads without board-photo.js, fail silently (single mode
   * keeps working) instead of throwing on load. */
  var API = window.DKBoardPhoto;
  var LOGIC = window.DKBulkLogic;
  var ZIP = window.DKBoardZip;
  var root = document.getElementById('bpb');
  if (!API || !LOGIC || !ZIP || !root) { return; }

  /* -- Small helpers ------------------------------------------------------ */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return API.esc(String(s == null ? '' : s)); }
  /* t(): translated string with {name} placeholders filled. Falls back
   * to the English text when the key is missing (never a raw key). */
  function t(key, fallback, vars) {
    var s = (window.dkT ? window.dkT(key, fallback) : fallback) || fallback;
    if (vars) {
      for (var k in vars) {
        s = s.split('{' + k + '}').join(String(vars[k]));
      }
    }
    return s;
  }
  function fmtKB(bytes) {
    if (bytes < 1024) { return bytes + ' B'; }
    return (bytes / 1024).toFixed(1) + ' KB';
  }
  function clamp(v, lo, hi) {
    v = parseFloat(v);
    if (isNaN(v)) { return lo; }
    return Math.max(lo, Math.min(hi, v));
  }
  function uid() {
    uid.n = (uid.n || 0) + 1;
    return 'bp' + Date.now().toString(36) + '-' + uid.n;
  }
  /* Yield to the browser so a 500-file intake never freezes the UI. */
  function yieldUI() {
    return new Promise(function (res) { setTimeout(res, 0); });
  }

  /* -- State --------------------------------------------------------------- */
  var state = {
    mode: 'single',
    images: [],          /* {id,name,size,hash,blob,url,thumb,width,height,kind,
                            status,selected,shared,own,undoStack,redoStack,
                            outputBlob,outputUrl,error,storedBlob} */
    hashes: {},          /* content-hash -> id (duplicate detection) */
    processing: false,
    paused: false,
    cancelRequested: false,
    queue: null,
    bulkBg: null,        /* page bg-button choice while in bulk mode */
    editorImageId: null,
    editorDraft: null,   /* settings being edited (not yet applied) */
    editorBefore: false, /* before/after toggle */
    editorZoom: 1,
    editPresets: [],     /* custom editing presets, localStorage */
    log: []              /* diagnostics, max 200 entries */
  };

  /* -- Diagnostics (§18): structured, no image bytes, no personal data. --- */
  function diag(code, imageId, order, stage, reason) {
    state.log.push({
      ts: new Date().toISOString(), code: code,
      imageId: imageId || null, order: (order == null ? null : order),
      stage: stage, reason: reason || null,
      retry: null, export: null
    });
    if (state.log.length > 200) { state.log.shift(); }
    renderLog();
  }
  function renderLog() {
    var el = $('bpb-log');
    if (!el) { return; }
    var html = '';
    for (var i = Math.max(0, state.log.length - 30); i < state.log.length; i++) {
      var e = state.log[i];
      html += '<div>[' + esc(e.ts.slice(11, 19)) + '] ' + esc(e.code)
        + (e.imageId ? ' #' + esc(e.imageId) : '')
        + ' ' + esc(e.stage) + (e.reason ? ': ' + esc(e.reason) : '') + '</div>';
    }
    el.innerHTML = html || '<div>—</div>';
  }
  function downloadDiag() {
    var blob = new Blob([JSON.stringify(state.log, null, 2)],
      { type: 'application/json' });
    API.downloadBlob(blob, 'board-photo-diagnostics.json');
  }

  /* -- Status line (one aria-live line for the bulk workspace). ------------ */
  function say(msg) {
    var el = $('bpb-status');
    if (el) { el.textContent = msg; }
  }

  /* -- Mode switching (§4) ------------------------------------------------- */
  function setMode(mode) {
    state.mode = mode;
    var main = document.getElementById('main');
    if (main) { main.setAttribute('data-bp-mode', mode); }
    var hint = $('bp-mode-hint');
    if (hint) {
      hint.textContent = mode === 'bulk'
        ? t('bpb.mode_hint', 'Bulk mode processes up to 500 photos with the same board spec.')
        : '';
      hint.hidden = mode !== 'bulk';
    }
    /* Bulk camera flag must not leak into the single flow. */
    window.__bpBulkCapturing = false;
    if (mode === 'bulk') { saveSessionSoon(); }
  }
  function bindMode() {
    var radios = document.querySelectorAll('input[name="bp-mode"]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].addEventListener('change', function () {
        if (this.checked) { setMode(this.value); }
      });
    }
    setMode('single');
  }

  /* -- IndexedDB session store (§13) --------------------------------------- */
  /* WHY IndexedDB (not localStorage): originals are blobs; localStorage
   * holds ~5 MB of strings. Blobs are stored with caps (D-7): per-file
   * 25 MB (already enforced at intake), total stored 150 MB; anything
   * over the cap stays memory-only and is marked, never silently lost.
   * Every call is guarded — if IndexedDB is unavailable the tool still
   * works, it just cannot restore after a reload (said honestly). */
  var IDB_NAME = 'dokit-bp-bulk', IDB_STORE = 'sessions', IDB_KEY = 'current';
  var IDB_BLOB_TOTAL_CAP = 150 * 1024 * 1024;
  var idbDb = null, idbReady = false, saveTimer = null;
  function idbOpen() {
    return new Promise(function (resolve) {
      if (!window.indexedDB) { resolve(null); return; }
      var req;
      try { req = window.indexedDB.open(IDB_NAME, 1); } catch (e) { resolve(null); return; }
      req.onupgradeneeded = function () {
        try { req.result.createObjectStore(IDB_STORE); } catch (e) { /* store exists */ }
      };
      req.onsuccess = function () { idbDb = req.result; idbReady = true; resolve(idbDb); };
      req.onerror = function () { resolve(null); };
      req.onblocked = function () { resolve(null); };
    });
  }
  function idbPut(value) {
    return new Promise(function (resolve) {
      if (!idbReady || !idbDb) { resolve(false); return; }
      try {
        var tx = idbDb.transaction([IDB_STORE], 'readwrite');
        tx.objectStore(IDB_STORE).put(value, IDB_KEY);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      } catch (e) { resolve(false); }
    });
  }
  function idbGet() {
    return new Promise(function (resolve) {
      if (!idbReady || !idbDb) { resolve(null); return; }
      try {
        var tx = idbDb.transaction([IDB_STORE], 'readonly');
        var req = tx.objectStore(IDB_STORE).get(IDB_KEY);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }
  function saveSessionSoon() {
    if (saveTimer) { clearTimeout(saveTimer); }
    saveTimer = setTimeout(saveSession, 1500);
  }
  /* Save the manifest + capped blobs. Called debounced after changes. */
  function saveSession() {
    if (!idbReady || state.mode !== 'bulk' || !state.images.length) { return; }
    var manifest = LOGIC.manifestSerialize(state.images);
    var blobs = {};
    var total = 0;
    for (var i = 0; i < state.images.length; i++) {
      var im = state.images[i];
      if (!im.blob || im.status === 'needs-file') { continue; }
      if (total + im.blob.size > IDB_BLOB_TOTAL_CAP) { im.storedBlob = false; continue; }
      blobs[im.id] = im.blob;
      total += im.blob.size;
      im.storedBlob = true;
    }
    idbPut({ manifest: manifest, blobs: blobs }).then(function () { /* saved */ });
  }
  /* Restore a previous session. Blobs that were over the cap (or whose
   * store failed) come back as 'needs-file' with their filename, so the
   * user can re-add exactly those photos — never a silent loss. */
  function restoreSession() {
    return idbGet().then(function (saved) {
      if (!saved || !saved.manifest) { return; }
      var d = LOGIC.manifestParse(saved.manifest);
      if (!d || !d.images.length) { return; }
      var restored = 0, missing = 0;
      d.images.forEach(function (m) {
        var blob = saved.blobs ? saved.blobs[m.id] : null;
        var im = {
          id: m.id, name: m.name, size: m.size, hash: m.hash,
          blob: blob || null, url: null, thumb: m.thumb || null,
          width: 0, height: 0, kind: null,
          status: blob ? 'queued' : 'needs-file', selected: false,
          shared: m.shared || {}, own: m.own || {},
          undoStack: [], redoStack: [],
          outputBlob: null, outputUrl: null, error: null,
          storedBlob: !!blob
        };
        if (blob) {
          im.url = URL.createObjectURL(blob);
          state.hashes[im.hash] = im.id;
          restored++;
          /* Dimensions are re-read lazily when the image is processed
           * (decoding 500 images at restore time would freeze the page). */
        } else { missing++; }
        state.images.push(im);
      });
      renderManager();
      say(t('bpb.session_restored',
        'Session restored: {n} photos recovered, {m} need re-adding.',
        { n: restored, m: missing }));
      diag('session_restore', null, null, 'restore',
        'restored=' + restored + ' missing=' + missing);
    }).catch(function () { /* restore is best-effort; never block the tool */ });
  }

  /* -- Intake (§5): all seven upload methods feed ONE pipeline ---------- */
  /* One file's journey: cheap checks first (size/zero) → magic-byte sniff
   * (never the extension) → decode (corrupt detection) → dimension
   * check → content-hash duplicate check → thumbnail → manager.
   * Every rejection carries a reason code; the caller reports it. */
  function readHead(blob, n) {
    return blob.slice(0, n).arrayBuffer().then(function (ab) {
      return new Uint8Array(ab);
    });
  }
  function isZipHead(u8) {
    /* PK\x03\x04 (normal), PK\x05\x06 (empty archive), PK\x07\x08 (spanned). */
    return u8.length >= 4 && u8[0] === 0x50 && u8[1] === 0x4B
      && (u8[2] === 0x03 || u8[2] === 0x05 || u8[2] === 0x07);
  }
  function makeThumb(img) {
    /* Small preview only (max 160 px). The full image is never drawn
     * into a dataURL — thumbs stay tiny so 500 of them stay cheap. */
    try {
      var s = Math.min(1, 160 / Math.max(img.naturalWidth, img.naturalHeight));
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * s));
      c.height = Math.max(1, Math.round(img.naturalHeight * s));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.72);
    } catch (e) { return null; }
  }
  function pushImage(im) {
    state.images.push(im);
    if (im.hash) { state.hashes[im.hash] = im.id; }
    renderManager();
    saveSessionSoon();
    return im;
  }
  function removeImageById(id) {
    for (var i = 0; i < state.images.length; i++) {
      if (state.images[i].id === id) {
        var im = state.images[i];
        if (im.url) { URL.revokeObjectURL(im.url); }
        if (im.outputUrl) { URL.revokeObjectURL(im.outputUrl); }
        if (im.hash && state.hashes[im.hash] === id) { delete state.hashes[im.hash]; }
        state.images.splice(i, 1);
        break;
      }
    }
    renderManager();
    saveSessionSoon();
  }
  /* Add ONE image blob. Returns {added: image} or {rejected: reason}.
   * `sourceName` is shown in reports (archive path for ZIP entries). */
  function addImageBlob(blob, sourceName) {
    var name = sourceName || blob.name || 'photo';
    if (state.images.length >= LOGIC.LIMITS.MAX_IMAGES) {
      return Promise.resolve({ rejected: 'limit', name: name });
    }
    if (!blob || blob.size === 0) {
      return Promise.resolve({ rejected: 'empty', name: name });
    }
    if (blob.size > LOGIC.LIMITS.MAX_FILE_BYTES) {
      return Promise.resolve({ rejected: 'size', name: name });
    }
    var kind = null, hash = null, bytes = null;
    return blob.arrayBuffer().then(function (ab) {
      bytes = new Uint8Array(ab);
      kind = ZIP.sniffImage(bytes);
      var meta = LOGIC.validateFileMeta({ name: name, size: blob.size, kind: kind });
      if (!meta.ok) { return { rejected: meta.reason, name: name }; }
      hash = LOGIC.fnv1aHex(bytes) + ':' + blob.size;
      if (state.hashes[hash]) { return { rejected: 'dup', name: name }; }
      /* Decode to prove the bytes are a real image and to learn size. */
      return API.decodeFile(blob).then(function (img) {
        var meta2 = LOGIC.validateFileMeta({
          name: name, size: blob.size, kind: kind,
          width: img.naturalWidth, height: img.naturalHeight
        });
        if (!meta2.ok) { return { rejected: meta2.reason, name: name }; }
        var im = {
          id: uid(), name: name, size: blob.size, hash: hash,
          blob: blob, url: URL.createObjectURL(blob),
          thumb: makeThumb(img), width: img.naturalWidth,
          height: img.naturalHeight, kind: kind,
          status: 'queued', selected: false,
          shared: {}, own: {}, undoStack: [], redoStack: [],
          outputBlob: null, outputUrl: null, error: null, storedBlob: false
        };
        pushImage(im);
        return { added: im };
      }).catch(function () {
        diag('decode_fail', null, null, 'intake', name);
        return { rejected: 'corrupt', name: name };
      });
    }).catch(function () {
      return { rejected: 'corrupt', name: name };
    });
  }
  /* Intake report: one honest line — added / rejected (with reasons) /
   * duplicates — plus diagnostics for every rejection AND every duplicate.
   * WHY always report (even 0/0/0): the old code only built a message when
   * something was added, so a ZIP of already-present photos showed a bare
   * "ZIP:" line and no diagnostics — live-verified as a failed upload,
   * although the files were correctly skipped as duplicates. The message
   * goes ONLY to #bpb-status (say): #bpb-summary belongs to renderToolbar's
   * "N / 500" count, and writing the same line to both showed it twice. */
  function reportIntake(res, source) {
    var added = res.added || 0;
    var rej = res.rejected || [];
    var dups = res.duplicates || [];
    if (!added && !rej.length && !dups.length) {
      /* Nothing was seen at all (e.g. a ZIP of only folders): say so
       * honestly instead of returning silently. */
      say((source ? source + ': ' : '') + t('bpb.intake_none', 'No photos were added.'));
      diag('intake_empty', null, null, 'intake', source || '');
      return;
    }
    var msg = (source ? source + ': ' : '') + t('bpb.summary', 'Added {a} · rejected {r} · duplicates {d}', { a: added, r: rej.length, d: dups.length });
    if (dups.length) {
      /* Duplicate names are user data: appended as plain text via say()
       * (textContent), never HTML — and only the first five, so a ZIP of
       * 500 duplicates cannot flood the status line. */
      msg += ' (' + dups.slice(0, 5).join(', ') + (dups.length > 5 ? ', …' : '') + ')';
    }
    say(msg);
    rej.forEach(function (r) {
      diag('reject', null, null, 'intake', r.name + ' (' + r.reason + ')');
    });
    dups.forEach(function (n) {
      diag('dup', null, null, 'intake', n);
    });
  }
  /* Add many files (File objects or {name, blob} entries). ZIP files are
   * detected by signature and routed to extraction; the rest go through
   * addImageBlob one by one (sequential, yielding — never a UI freeze). */
  function addFiles(list, source) {
    var files = Array.prototype.slice.call(list || []);
    var res = { added: 0, rejected: [], duplicates: [] };
    var chain = Promise.resolve();
    files.forEach(function (f) {
      chain = chain.then(function () {
        if (state.images.length >= LOGIC.LIMITS.MAX_IMAGES) {
          res.rejected.push({ name: f.name || 'file', reason: 'limit' });
          return null;
        }
        var blob = f.blob || f;
        var name = f.name || blob.name || 'photo';
        /* ZIP detection: signature first, .zip extension second (a ZIP
         * renamed to .jpg is still a ZIP — extensions are never trusted). */
        return readHead(blob, 4).then(function (head) {
          if (isZipHead(head) || /\.zip$/i.test(name)) {
            return addZipBlob(blob, name).then(function (zr) {
              res.added += zr.added;
              res.rejected = res.rejected.concat(zr.rejected);
              res.duplicates = res.duplicates.concat(zr.duplicates);
            });
          }
          return addImageBlob(blob, name).then(function (r) {
            if (r.added) { res.added++; }
            else if (r.rejected === 'dup') { res.duplicates.push(r.name); }
            else if (r.rejected) { res.rejected.push({ name: r.name, reason: r.rejected }); }
          });
        }).catch(function () {
          res.rejected.push({ name: name, reason: 'corrupt' });
        });
      }).then(function () { return yieldUI(); });
    });
    return chain.then(function () {
      reportIntake(res, source);
      return res;
    });
  }
  /* ZIP intake: extract in-browser, then feed every image through the
   * SAME addImageBlob pipeline (so ZIP images get identical validation,
   * duplicate detection and limits as picked files). */
  function addZipBlob(blob, name) {
    return blob.arrayBuffer().then(function (ab) {
      var out;
      try {
        out = ZIP.extractImages(ab, {
          limits: ZIP.LIMITS, alreadyHave: state.images.length
        });
      } catch (e) {
        /* fflate threw before producing a result: corrupt or encrypted. */
        var reason = /encrypt/i.test(e && e.message || '') ? 'zip_enc' : 'zip_bad';
        diag('zip_fail', null, null, 'extract', name + ' (' + reason + ')');
        return { added: 0, rejected: [{ name: name, reason: reason }], duplicates: [] };
      }
      if (out.rejected && out.rejected.length && !out.images.length) {
        /* Whole-archive rejection (bomb / too many entries / corrupt). */
        out.rejected.forEach(function (r) {
          diag('zip_reject', null, null, 'extract', name + ' (' + r.reason + ')');
        });
      }
      var res = { added: 0, rejected: [], duplicates: [] };
      out.rejected.forEach(function (r) {
        if (r.reason === 'dup') { res.duplicates.push(r.name); }
        else { res.rejected.push({ name: r.name, reason: r.reason }); }
      });
      var chain = Promise.resolve();
      out.images.forEach(function (entry) {
        chain = chain.then(function () {
          var b = new Blob([entry.data], { type: 'image/' + entry.kind });
          return addImageBlob(b, entry.name).then(function (r) {
            if (r.added) { res.added++; }
            else if (r.rejected === 'dup') { res.duplicates.push(r.name); }
            else if (r.rejected) { res.rejected.push({ name: r.name, reason: r.rejected }); }
          });
        }).then(function () { return yieldUI(); });
      });
      return chain.then(function () { return res; });
    }).catch(function () {
      return { added: 0, rejected: [{ name: name, reason: 'zip_bad' }], duplicates: [] };
    });
  }
  /* Folder traversal (drag & drop): webkitGetAsEntry, recursive. Where
   * the browser has no entry API, the drop falls back to plain files. */
  function collectEntry(entry, out) {
    if (!entry) { return Promise.resolve(); }
    if (entry.isFile) {
      return new Promise(function (resolve) {
        entry.file(function (f) {
          /* Keep the folder path in the display name so two folders
           * with same-named photos stay distinguishable. */
          try {
            Object.defineProperty(f, 'displayPath', { value: entry.fullPath });
          } catch (e) { /* name stays as-is */ }
          out.push(f);
          resolve();
        }, function () { resolve(); });
      });
    }
    if (entry.isDirectory) {
      var reader = entry.createReader();
      return new Promise(function (resolve) {
        var batch = [];
        (function readNext() {
          reader.readEntries(function (entries) {
            if (!entries.length) {
              var chain = Promise.resolve();
              batch.forEach(function (en) {
                chain = chain.then(function () { return collectEntry(en, out); });
              });
              chain.then(resolve);
              return;
            }
            batch = batch.concat(Array.prototype.slice.call(entries));
            readNext();
          }, function () { resolve(); });
        })();
      });
    }
    return Promise.resolve();
  }
  function handleDrop(e) {
    e.preventDefault();
    var dz = $('bpb-dz');
    if (dz) { dz.classList.remove('dragover'); }
    var dt = e.dataTransfer;
    if (!dt) { return; }
    var items = dt.items ? Array.prototype.slice.call(dt.items) : [];
    var entries = [];
    var hasEntryApi = false;
    items.forEach(function (it) {
      if (it.kind === 'file' && it.webkitGetAsEntry) {
        var en = it.webkitGetAsEntry();
        if (en) { hasEntryApi = true; entries.push(en); }
      }
    });
    if (hasEntryApi) {
      var out = [];
      var chain = Promise.resolve();
      entries.forEach(function (en) {
        chain = chain.then(function () { return collectEntry(en, out); });
      });
      chain.then(function () { addFiles(out, 'Drop'); });
      return;
    }
    if (dt.files && dt.files.length) { addFiles(dt.files, 'Drop'); }
  }
  /* Paste: only when the paste zone (or anything inside the bulk panel)
   * has focus — the page never hijacks paste elsewhere. */
  function handlePaste(e) {
    var items = (e.clipboardData && e.clipboardData.items) || [];
    var files = [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].kind === 'file' && items[i].type.indexOf('image/') === 0) {
        var f = items[i].getAsFile();
        if (f) { files.push(f); }
      }
    }
    if (!files.length) {
      say(t('bpb.err_type', 'Not a supported image (PNG, JPEG or WebP only).'));
      return;
    }
    e.preventDefault();
    addFiles(files, 'Paste');
  }
  /* Camera (bulk): reuse the existing modal + getUserMedia flow by
   * clicking the page's own camera button with the bulk flag set; the
   * capture event hands the frame back to the manager (see board-photo.js
   * camShot handler). Cancel paths reset the flag (see bindCamera). */
  function openBulkCamera() {
    var camBtn = $('camBtn');
    if (!camBtn) {
      say(t('bpb.err_type', 'Not a supported image (PNG, JPEG or WebP only).'));
      return;
    }
    window.__bpBulkCapturing = true;
    camBtn.click();
  }
  function onBulkCapture(e) {
    window.__bpBulkCapturing = false;
    if (state.mode !== 'bulk') { return; }
    var dataUrl = e.detail && e.detail.dataUrl;
    if (!dataUrl) { return; }
    /* dataURL (JPEG from the camera) → Blob → the normal pipeline. */
    fetch(dataUrl).then(function (r) { return r.blob(); }).then(function (blob) {
      addImageBlob(blob, 'camera-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.jpg');
    }).catch(function () {
      say(t('bpb.err_corrupt', 'Image is corrupted and could not be read.'));
    });
  }
  function bindCamera() {
    document.addEventListener('bp-bulk-capture', onBulkCapture);
    /* Every path that closes the camera modal also clears the bulk
     * flag, so a cancelled bulk capture can never swallow the NEXT
     * single-photo capture. */
    ['camClose', 'camX'].forEach(function (id) {
      var b = $(id);
      if (b) { b.addEventListener('click', function () { window.__bpBulkCapturing = false; }); }
    });
    var modal = $('camModal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) { window.__bpBulkCapturing = false; }
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { window.__bpBulkCapturing = false; }
    });
  }
  function bindIntake() {
    var fileInput = $('bpb-file');
    var zipInput = $('bpb-zip-file');
    var folderInput = $('bpb-folder-file');
    function wire(btnId, input) {
      var b = $(btnId);
      if (b && input) {
        b.addEventListener('click', function () { input.click(); });
      }
    }
    wire('bpb-select-btn', fileInput);
    wire('bpb-more-btn', fileInput);
    wire('bpb-zip-btn', zipInput);
    wire('bpb-folder-btn', folderInput);
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        addFiles(fileInput.files, 'Select');
        fileInput.value = '';
      });
    }
    if (zipInput) {
      zipInput.addEventListener('change', function () {
        addFiles(zipInput.files, 'ZIP');
        zipInput.value = '';
      });
    }
    if (folderInput) {
      /* webkitdirectory gives every file with webkitRelativePath set;
       * unsupported browsers simply never open this picker (the Select
       * Photos button is the fallback — said so on the button). */
      folderInput.addEventListener('change', function () {
        addFiles(folderInput.files, 'Folder');
        folderInput.value = '';
      });
    }
    var dz = $('bpb-dz');
    if (dz) {
      ['dragenter', 'dragover'].forEach(function (ev) {
        dz.addEventListener(ev, function (e) {
          e.preventDefault();
          dz.classList.add('dragover');
        });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        dz.addEventListener(ev, function (e) {
          e.preventDefault();
          dz.classList.remove('dragover');
        });
      });
      dz.addEventListener('drop', handleDrop);
      dz.addEventListener('click', function () {
        if (fileInput) { fileInput.click(); }
      });
      dz.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (fileInput) { fileInput.click(); }
        }
      });
    }
    var pasteZone = $('bpb-paste-zone');
    if (pasteZone) {
      pasteZone.addEventListener('paste', handlePaste);
    }
    var camBtn = $('bpb-cam-btn');
    if (camBtn) { camBtn.addEventListener('click', openBulkCamera); }
    bindCamera();
    /* Page background buttons also set the bulk default background
     * (bulk has no separate bg row — one shared control, one behaviour). */
    var bgRow = $('bgRow');
    if (bgRow) {
      bgRow.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('.bbg-btn') : null;
        if (!b) { return; }
        var v = b.getAttribute('data-bg');
        state.bulkBg = (v === 'board') ? null : v;
        if (state.editorImageId) { renderEditorPreview(); }
      });
    }
  }

  /* -- Manager (§6): one grid, stable IDs, order = user's order ---------- */
  function selectedImages() {
    return state.images.filter(function (im) { return im.selected; });
  }
  function statusText(im) {
    if (im.status === 'done') { return t('bpb.status_done', 'Done'); }
    if (im.status === 'failed') { return t('bpb.status_failed', 'Failed'); }
    if (im.status === 'processing') { return t('bpb.status_processing', 'Processing…'); }
    if (im.status === 'needs-file') { return '⚠ ' + t('bpb.err_corrupt', 'Image is corrupted and could not be read.'); }
    return t('bpb.status_queued', 'Queued');
  }
  function renderManager() {
    var grid = $('bpb-grid');
    if (!grid) { return; }
    /* WHY build cards with DOM APIs, not innerHTML: file names are user
     * data — textContent can never inject markup (XSS-safe by shape). */
    grid.innerHTML = '';
    var empty = $('bpb-empty');
    if (empty) { empty.hidden = state.images.length > 0; }
    state.images.forEach(function (im, idx) {
      var li = document.createElement('li');
      li.className = 'bpb-card' + (im.selected ? ' sel' : '') + ' st-' + im.status;
      li.setAttribute('data-id', im.id);
      li.draggable = true;
      var sel = document.createElement('input');
      sel.type = 'checkbox';
      sel.className = 'bpb-sel';
      sel.checked = !!im.selected;
      sel.setAttribute('aria-label', t('bpb.sel_count', '{n} selected', { n: idx + 1 }));
      sel.addEventListener('change', function () {
        im.selected = sel.checked;
        li.classList.toggle('sel', im.selected);
        renderToolbar();
        saveSessionSoon();
      });
      var th = document.createElement('img');
      th.className = 'bpb-thumb';
      th.alt = im.name;
      th.loading = 'lazy';
      if (im.thumb) { th.src = im.thumb; }
      var serial = document.createElement('span');
      serial.className = 'bpb-serial';
      serial.textContent = String(idx + 1);
      var nm = document.createElement('span');
      nm.className = 'bpb-name';
      nm.textContent = im.name;
      nm.title = im.name;
      var meta = document.createElement('span');
      meta.className = 'bpb-meta';
      meta.textContent = (im.width ? im.width + '×' + im.height + ' · ' : '')
        + fmtKB(im.size);
      var st = document.createElement('span');
      st.className = 'bpb-status';
      st.textContent = statusText(im);
      if (im.error) { st.title = im.error; }
      var acts = document.createElement('span');
      acts.className = 'bpb-acts';
      var btns = [
        ['preview', '👁', t('bpb.preview', 'Preview')],
        ['edit', '✎', t('bpb.edit', 'Edit')],
        ['download', '⬇', t('bpb.download_one', 'Download')],
        ['replace', '⇄', t('bpb.replace', 'Replace')],
        ['up', '↑', t('bpb.move_up', 'Move up')],
        ['down', '↓', t('bpb.move_down', 'Move down')],
        ['remove', '×', t('bpb.remove_sel', 'Remove selected')]
      ];
      btns.forEach(function (b) {
        /* Download is only meaningful once the image has an output. */
        if (b[0] === 'download' && !im.outputBlob) { return; }
        if (b[0] === 'replace' && im.status === 'needs-file') { return; }
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn ghost bpb-mini';
        btn.setAttribute('data-act', b[0]);
        btn.setAttribute('aria-label', b[2]);
        btn.title = b[2];
        btn.textContent = b[1];
        acts.appendChild(btn);
      });
      if (im.status === 'needs-file') {
        var re = document.createElement('button');
        re.type = 'button';
        re.className = 'btn ghost bpb-mini';
        re.setAttribute('data-act', 'readd');
        re.textContent = t('bpb.retry', 'Retry failed');
        acts.appendChild(re);
      }
      li.appendChild(sel);
      li.appendChild(th);
      li.appendChild(serial);
      li.appendChild(nm);
      li.appendChild(meta);
      li.appendChild(st);
      li.appendChild(acts);
      grid.appendChild(li);
    });
    renderToolbar();
  }
  function renderToolbar() {
    var sel = selectedImages().length;
    var count = $('bpb-sel-count');
    if (count) {
      count.textContent = t('bpb.sel_count', '{n} selected', { n: sel });
    }
    var any = state.images.length > 0;
    var anyDone = state.images.some(function (im) { return im.status === 'done'; });
    var anyFailed = state.images.some(function (im) { return im.status === 'failed'; });
    var anyWork = state.images.some(function (im) { return im.status !== 'done'; });
    var dis = function (id, off) { var b = $(id); if (b) { b.disabled = off; } };
    dis('bpb-remove-sel', sel === 0);
    dis('bpb-clear-all', !any);
    dis('bpb-retry-failed', !anyFailed);
    dis('bpb-process-btn', !anyWork || state.processing);
    dis('bpb-export-btn', !anyDone || state.processing);
    dis('bpb-sel-all', !any);
    dis('bpb-sel-none', sel === 0);
    var sumEl = $('bpb-summary');
    if (sumEl && any) {
      sumEl.textContent = state.images.length + ' / ' + LOGIC.LIMITS.MAX_IMAGES;
    }
  }
  function findImage(id) {
    for (var i = 0; i < state.images.length; i++) {
      if (state.images[i].id === id) { return state.images[i]; }
    }
    return null;
  }
  function moveImage(id, dir) {
    var ids = state.images.map(function (im) { return im.id; });
    var idx = ids.indexOf(id);
    if (idx === -1) { return; }
    var to = idx + dir;
    if (to < 0 || to >= ids.length) { return; }
    var order = LOGIC.moveItemOrder(ids, id, to);
    state.images.sort(function (a, b) {
      return order.indexOf(a.id) - order.indexOf(b.id);
    });
    renderManager();
    saveSessionSoon();
  }
  function replaceImage(id) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      if (!f) { return; }
      var old = findImage(id);
      if (!old) { return; }
      /* The replacement goes through the same pipeline (validation,
       * duplicate check) — then takes the old image's place, keeping
       * its position, selection and shared settings. */
      addImageBlob(f, f.name).then(function (r) {
        if (!r.added) {
          say(t('bpb.err_type', 'Not a supported image (PNG, JPEG or WebP only).'));
          return;
        }
        var ni = r.added;
        ni.selected = old.selected;
        ni.shared = old.shared;
        ni.own = old.own;
        var idx = state.images.indexOf(ni);
        state.images.splice(idx, 1);
        state.images.splice(state.images.indexOf(old), 1, ni);
        if (old.url) { URL.revokeObjectURL(old.url); }
        if (old.outputUrl) { URL.revokeObjectURL(old.outputUrl); }
        if (old.hash && state.hashes[old.hash] === old.id) { delete state.hashes[old.hash]; }
        renderManager();
        saveSessionSoon();
      });
    });
    input.click();
  }
  function clearAll() {
    if (!state.images.length) { return; }
    /* Confirm: clearing destroys originals + edits for the session. */
    if (!window.confirm(t('bpb.clear_confirm',
      'Remove all {n} photos? Your edits will be lost.', { n: state.images.length }))) {
      return;
    }
    state.images.forEach(function (im) {
      if (im.url) { URL.revokeObjectURL(im.url); }
      if (im.outputUrl) { URL.revokeObjectURL(im.outputUrl); }
    });
    state.images = [];
    state.hashes = {};
    closeEditor();
    renderManager();
    saveSessionSoon();
    say(t('bpb.mgr_empty', 'No photos yet — add some above.'));
  }
  function retryFailed() {
    state.images.forEach(function (im) {
      if (im.status === 'failed') { im.status = 'queued'; im.error = null; }
    });
    renderManager();
    processAll();
  }
  /* Re-add a session-restored image whose blob was over the storage cap. */
  function readdMissing(id) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      var im = findImage(id);
      if (!f || !im) { return; }
      if (f.name !== im.name || f.size !== im.size) {
        say(t('bpb.err_type', 'Not a supported image (PNG, JPEG or WebP only).'));
        return;
      }
      im.blob = f;
      im.url = URL.createObjectURL(f);
      im.status = 'queued';
      im.storedBlob = false;
      API.decodeFile(f).then(function (img) {
        im.width = img.naturalWidth; im.height = img.naturalHeight;
        im.thumb = makeThumb(img);
        /* Re-sniff the real bytes (kind was not in the manifest). */
        return readHead(f, 16).then(function (head) {
          im.kind = ZIP.sniffImage(head) || im.kind;
        }).catch(function () { /* keep the stored kind */ });
      }).then(function () {
        renderManager();
        saveSessionSoon();
      }).catch(function () {
        im.status = 'failed';
        renderManager();
      });
    });
    input.click();
  }
  function bindManager() {
    var grid = $('bpb-grid');
    if (grid) {
      grid.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-act]') : null;
        if (!btn) { return; }
        var li = btn.closest ? btn.closest('.bpb-card') : null;
        if (!li) { return; }
        var id = li.getAttribute('data-id');
        var im = findImage(id);
        if (!im) { return; }
        var act = btn.getAttribute('data-act');
        if (act === 'preview' || act === 'edit') { openEditor(id); }
        else if (act === 'download') { downloadOne(im); }
        else if (act === 'replace') { replaceImage(id); }
        else if (act === 'up') { moveImage(id, -1); }
        else if (act === 'down') { moveImage(id, 1); }
        else if (act === 'remove') { removeImageById(id); }
        else if (act === 'readd') { readdMissing(id); }
      });
      /* Drag-to-reorder (pointer-friendly up/down buttons exist too). */
      var dragId = null;
      grid.addEventListener('dragstart', function (e) {
        var li = e.target.closest ? e.target.closest('.bpb-card') : null;
        if (!li) { return; }
        dragId = li.getAttribute('data-id');
        try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); } catch (err) { /* drag unsupported */ }
      });
      grid.addEventListener('dragover', function (e) {
        if (dragId) { e.preventDefault(); }
      });
      grid.addEventListener('drop', function (e) {
        var li = e.target.closest ? e.target.closest('.bpb-card') : null;
        if (!li || !dragId || li.getAttribute('data-id') === dragId) { dragId = null; return; }
        e.preventDefault();
        var ids = state.images.map(function (im) { return im.id; });
        var order = LOGIC.moveItemOrder(ids, dragId, ids.indexOf(li.getAttribute('data-id')));
        state.images.sort(function (a, b) {
          return order.indexOf(a.id) - order.indexOf(b.id);
        });
        dragId = null;
        renderManager();
        saveSessionSoon();
      });
    }
    function click(id, fn) {
      var b = $(id);
      if (b) { b.addEventListener('click', fn); }
    }
    click('bpb-sel-all', function () {
      state.images.forEach(function (im) { im.selected = true; });
      renderManager();
    });
    click('bpb-sel-none', function () {
      state.images.forEach(function (im) { im.selected = false; });
      renderManager();
    });
    click('bpb-remove-sel', function () {
      var sel = selectedImages();
      if (!sel.length) { return; }
      sel.forEach(function (im) { removeImageById(im.id); });
    });
    click('bpb-clear-all', clearAll);
    click('bpb-retry-failed', retryFailed);
    click('bpb-diag-btn', downloadDiag);
  }

  /* -- Editor (§7, §8): one image at a time, three apply scopes ---------- */
  /* Draft model: the editor edits a COPY of the image's `own` layer.
   * Preview = mergeSettings(shared, draft). Slider positions show the
   * EFFECTIVE value (so the user sees the real result); moving a slider
   * writes that key into the draft (creating an individual override).
   * "Apply to this photo" stores the draft as `own`. "Apply to all /
   * selected" writes ONLY the keys the user changed in this session
   * (the `dirty` set) into other images' `shared` layer — untouched
   * keys are never overwritten, and `own` is never touched. */
  function editorImage() {
    return state.editorImageId ? findImage(state.editorImageId) : null;
  }
  function resolveCrop(crop, iw, ih) {
    /* Crop is stored as fractions (exact) or a reference window (smart).
     * buildCanvas wants source PIXELS — convert here, at render time. */
    if (!crop) { return null; }
    if (crop.mode === 'smart') {
      return LOGIC.smartCropRect(iw, ih, crop.w, crop.h);
    }
    return LOGIC.exactCropRect(iw, ih, crop);
  }
  function effectiveOpts(im, draft) {
    var eff = LOGIC.mergeSettings(im.shared, draft || im.own);
    var iw = im.width, ih = im.height;
    var opts = {
      rotation: eff.rotation, flipH: eff.flipH, bw: eff.bw, enhance: eff.enhance,
      brightness: eff.brightness, contrast: eff.contrast,
      saturation: eff.saturation, temp: eff.temp,
      crop: resolveCrop(eff.crop, iw, ih),
      /* Background: the editor's own choice wins; else the page bg
       * buttons (bulk default); else the board default (null). */
      bg: (eff.bg !== null && eff.bg !== undefined) ? eff.bg : state.bulkBg
    };
    return opts;
  }
  function openEditor(id) {
    var im = findImage(id);
    if (!im || !im.blob) { return; }
    state.editorImageId = id;
    state.editorDraft = JSON.parse(JSON.stringify(im.own || {}));
    state.editorDirty = {};
    state.editorBefore = false;
    state.editorZoom = 1;
    var ed = $('bpb-editor');
    if (ed) { ed.hidden = false; }
    var title = $('bpb-ed-title');
    if (title) { title.textContent = im.name; }
    refreshEditorControls();
    renderEditorPreview();
    renderCropCanvas();
    renderEditPresets();
    var samples = $('bpb-ed-samples');
    if (samples) { samples.hidden = true; }
  }
  function closeEditor() {
    state.editorImageId = null;
    state.editorDraft = null;
    state.editorDirty = {};
    var ed = $('bpb-editor');
    if (ed) { ed.hidden = true; }
  }
  /* Slider positions follow the EFFECTIVE settings (what the user sees). */
  function refreshEditorControls() {
    var im = editorImage();
    if (!im || !state.editorDraft) { return; }
    var eff = LOGIC.mergeSettings(im.shared, state.editorDraft);
    var set = function (id, v) { var el = $(id); if (el) { el.value = String(v); } };
    var setV = function (id, v) { var el = $(id); if (el) { el.textContent = v; } };
    set('bpb-ed-brightness', Math.round((eff.brightness - 1) * 100));
    set('bpb-ed-contrast', Math.round((eff.contrast - 1) * 100));
    set('bpb-ed-saturation', Math.round((eff.saturation - 1) * 100));
    set('bpb-ed-temp', eff.temp);
    setV('bpb-ed-brightness-v', Math.round((eff.brightness - 1) * 100));
    setV('bpb-ed-contrast-v', Math.round((eff.contrast - 1) * 100));
    setV('bpb-ed-saturation-v', Math.round((eff.saturation - 1) * 100));
    setV('bpb-ed-temp-v', String(eff.temp));
    var bg = $('bpb-ed-bg');
    if (bg) {
      bg.value = (eff.bg !== null && eff.bg !== undefined) ? eff.bg
        : (state.bulkBg === null || state.bulkBg === undefined ? 'board' : state.bulkBg);
    }
    var rot = $('bpb-ed-rot-v');
    if (rot) { rot.textContent = String(eff.rotation) + '°'; }
    var bw = $('bpb-ed-bw');
    if (bw) { bw.setAttribute('aria-pressed', eff.bw ? 'true' : 'false'); bw.classList.toggle('active', !!eff.bw); }
    var enh = $('bpb-ed-enhance');
    if (enh) { enh.setAttribute('aria-pressed', eff.enhance ? 'true' : 'false'); enh.classList.toggle('active', !!eff.enhance); }
    var flip = $('bpb-ed-flip');
    if (flip) { flip.setAttribute('aria-pressed', eff.flipH ? 'true' : 'false'); flip.classList.toggle('active', !!eff.flipH); }
  }
  function editorDraftImage() {
    var im = editorImage();
    if (!im) { return Promise.resolve(null); }
    if (im._img) { return Promise.resolve(im._img); }
    return API.decodeFile(im.blob).then(function (img) {
      im._img = img;
      return img;
    });
  }
  /* Preview = the SAME buildCanvas + spec the export uses, so what the
   * user sees is what the ZIP contains. Before/after toggles the draft. */
  function renderEditorPreview() {
    var im = editorImage();
    var cv = $('bpb-ed-canvas');
    if (!im || !cv) { return; }
    editorDraftImage().then(function (img) {
      if (!img || state.editorImageId !== im.id) { return; }
      var spec = API.effSpec();
      var opts = state.editorBefore
        ? { rotation: 0, flipH: false, bw: false, enhance: false,
            brightness: 1, contrast: 1, saturation: 1, temp: 0,
            crop: null, bg: state.bulkBg }
        : effectiveOpts(im, state.editorDraft);
      var built;
      try { built = API.buildCanvas(img, spec, opts); } catch (e) { return; }
      cv.width = built.width;
      cv.height = built.height;
      cv.getContext('2d').drawImage(built, 0, 0);
      cv.style.width = Math.round(built.width * 0.6 * state.editorZoom) + 'px';
    }).catch(function () { /* preview decode failed; the image is flagged at intake */ });
  }
  /* Crop canvas: the source image with a draggable, aspect-locked rect.
   * The rect keeps the output aspect (spec w/h) — a free-aspect rect
   * would stretch the face at export, so it is never allowed. */
  var cropDrag = null;
  function renderCropCanvas() {
    var im = editorImage();
    var cv = $('bpb-ed-crop-canvas');
    if (!im || !cv) { return; }
    editorDraftImage().then(function (img) {
      if (!img || state.editorImageId !== im.id) { return; }
      var W = 320, scale = W / img.naturalWidth;
      var H = Math.max(1, Math.round(img.naturalHeight * scale));
      cv.width = W; cv.height = H;
      var ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0, W, H);
      var spec = API.effSpec();
      var aspect = spec.w / spec.h;
      var eff = LOGIC.mergeSettings(im.shared, state.editorDraft);
      var rect = eff.crop
        ? { x: eff.crop.x * W, y: eff.crop.y * H, w: eff.crop.w * W, h: eff.crop.h * H }
        : cropRectForCanvas(img, spec, W, H);
      /* Dim everything outside the rect; draw the rect itself. */
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, W, rect.y);
      ctx.fillRect(0, rect.y + rect.h, W, H - (rect.y + rect.h));
      ctx.fillRect(0, rect.y, rect.x, rect.h);
      ctx.fillRect(rect.x + rect.w, rect.y, W - (rect.x + rect.w), rect.h);
      ctx.strokeStyle = '#FFC531';
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      cv._rect = rect; cv._scale = scale; cv._aspect = aspect; cv._img = img;
    }).catch(function () { /* ignore */ });
  }
  function cropRectForCanvas(img, spec, W, H) {
    var r = LOGIC.coverCropRect(img.naturalWidth, img.naturalHeight, spec.w, spec.h);
    var scale = W / img.naturalWidth;
    return {
      x: r.x * scale, y: r.y * scale,
      w: r.w * scale, h: r.h * scale
    };
  }
  function cropFractionsFromCanvas(cv) {
    var r = cv._rect;
    return {
      mode: cropMode(),
      x: r.x / cv.width, y: r.y / cv.height,
      w: r.w / cv.width, h: r.h / cv.height
    };
  }
  function cropMode() {
    var radios = document.querySelectorAll('input[name="bpb-crop-mode"]');
    for (var i = 0; i < radios.length; i++) {
      if (radios[i].checked) { return radios[i].value; }
    }
    return 'exact';
  }
  function bindCropCanvas() {
    var cv = $('bpb-ed-crop-canvas');
    if (!cv) { return; }
    function pos(e) {
      var r = cv.getBoundingClientRect();
      var p = (e.touches && e.touches[0]) || e;
      return { x: p.clientX - r.left, y: p.clientY - r.top };
    }
    function start(e) {
      if (!cv._rect) { return; }
      e.preventDefault();
      var p = pos(e);
      var r = cv._rect;
      var edge = 10;
      var nearRight = Math.abs(p.x - (r.x + r.w)) < edge;
      var nearBottom = Math.abs(p.y - (r.y + r.h)) < edge;
      var inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
      cropDrag = {
        mode: (nearRight || nearBottom) ? 'resize' : (inside ? 'move' : null),
        startX: p.x, startY: p.y, rect: { x: r.x, y: r.y, w: r.w, h: r.h }
      };
    }
    function move(e) {
      if (!cropDrag || !cropDrag.mode) { return; }
      e.preventDefault();
      var p = pos(e);
      var dx = p.x - cropDrag.startX, dy = p.y - cropDrag.startY;
      var r = { x: cropDrag.rect.x, y: cropDrag.rect.y, w: cropDrag.rect.w, h: cropDrag.rect.h };
      if (cropDrag.mode === 'move') {
        r.x = Math.max(0, Math.min(cv.width - r.w, r.x + dx));
        r.y = Math.max(0, Math.min(cv.height - r.h, r.y + dy));
      } else {
        /* Resize keeps the output aspect (never stretch the face). */
        var nw = Math.max(20, Math.min(cv.width - r.x, r.w + dx));
        var nh = nw / cv._aspect;
        if (r.y + nh > cv.height) { nh = cv.height - r.y; nw = nh * cv._aspect; }
        r.w = nw; r.h = nh;
      }
      cv._rect = r;
      renderCropCanvasOverlayOnly(cv);
      var frac = cropFractionsFromCanvas(cv);
      if (!state.editorDraft) { state.editorDraft = {}; }
      state.editorDraft.crop = frac;
      state.editorDirty.crop = true;
      renderEditorPreview();
    }
    function end() { cropDrag = null; }
    cv.addEventListener('pointerdown', start);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointerleave', end);
  }
  /* Redraw only the overlay (the image underneath stays put) while
   * dragging, so the cropper stays smooth. */
  function renderCropCanvasOverlayOnly(cv) {
    var img = cv._img;
    if (!img) { return; }
    var ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    var rect = cv._rect;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, cv.width, rect.y);
    ctx.fillRect(0, rect.y + rect.h, cv.width, cv.height - (rect.y + rect.h));
    ctx.fillRect(0, rect.y, rect.x, rect.h);
    ctx.fillRect(rect.x + rect.w, rect.y, cv.width - (rect.x + rect.w), rect.h);
    ctx.strokeStyle = '#FFC531';
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }
  /* Apply the draft to THIS photo only (individual scope). */
  function applyToOne() {
    var im = editorImage();
    if (!im || !state.editorDraft) { return; }
    LOGIC.pushUndo(im);
    im.own = JSON.parse(JSON.stringify(state.editorDraft));
    state.editorDirty = {};
    invalidateOutput(im);
    refreshEditorControls();
    renderEditorPreview();
    renderCropCanvas();
    renderManager();
    saveSessionSoon();
    /* Confirmation, not a restatement of the editor title: the old line
     * said "Edit photo — <name>" again, so the user could not tell the
     * click had done anything without reopening the editor. */
    say(t('bpb.applied_one', 'Applied to {name}.', { name: im.name }));
  }
  /* Invalidate a processed output after an edit (it must be re-run). */
  function invalidateOutput(im) {
    if (im.outputUrl) { URL.revokeObjectURL(im.outputUrl); }
    im.outputBlob = null;
    im.outputUrl = null;
    if (im.status === 'done') { im.status = 'queued'; }
  }
  /* Global / selected apply: confirm first, with representative previews
   * when a crop is part of the change (§7.1, §7.5). */
  function applyToScope(scope) {
    var im = editorImage();
    if (!im || !state.editorDraft) { return; }
    var dirtyKeys = Object.keys(state.editorDirty || {});
    if (!dirtyKeys.length) { return; }
    var targets = scope === 'all' ? state.images : selectedImages();
    if (!targets.length) { return; }
    var settings = {};
    dirtyKeys.forEach(function (k) { settings[k] = state.editorDraft[k]; });
    var doApply = function () {
      var affected = LOGIC.applyToScope(state.images,
        scope === 'all' ? 'all' : 'selected', settings);
      affected.forEach(function (id) {
        var t2 = findImage(id);
        if (t2) { invalidateOutput(t2); }
      });
      /* The edited image itself keeps its own layer untouched — the
       * shared write does not erase its individual overrides. */
      renderManager();
      renderEditorPreview();
      saveSessionSoon();
      /* Confirmation with its own key: the old line reused the confirm
       * QUESTION ("Apply these settings to {n} photos?") as the status,
       * so after applying the user was still asked a question. */
      say(t('bpb.applied_scope', 'Applied to {n} photos.', { n: affected.length }));
      diag('apply_scope', null, null, 'edit',
        scope + ' keys=' + dirtyKeys.join(',') + ' n=' + affected.length);
    };
    if (settings.crop) {
      showCropSamples(scope, settings, doApply);
      return;
    }
    if (!window.confirm(t('bpb.apply_confirm',
      'Apply these settings to {n} photos?', { n: targets.length }))) {
      return;
    }
    doApply();
  }
  /* Representative preview before a bulk crop: the first three images
   * rendered with the crop that WOULD apply to each of them. The user
   * sees the truth (a crop that fits one photo may not fit another)
   * before anything is written. */
  function showCropSamples(scope, settings, onConfirm) {
    var panel = $('bpb-ed-samples');
    var box = $('bpb-ed-samples-imgs');
    if (!panel || !box) { onConfirm(); return; }
    var targets = (scope === 'all' ? state.images : selectedImages()).slice(0, 3);
    box.innerHTML = '';
    var spec = API.effSpec();
    var done = 0;
    panel.hidden = false;
    targets.forEach(function (tim) {
      var c = document.createElement('canvas');
      c.width = 140;
      box.appendChild(c);
      API.decodeFile(tim.blob).then(function (img) {
        var crop = settings.crop;
        var rect = crop.mode === 'smart'
          ? LOGIC.smartCropRect(img.naturalWidth, img.naturalHeight,
              Math.round(crop.w * img.naturalWidth), Math.round(crop.h * img.naturalHeight))
          : LOGIC.exactCropRect(img.naturalWidth, img.naturalHeight, crop);
        var outW = spec.w, outH = spec.h;
        var scale = Math.max(outW / rect.w, outH / rect.h);
        var dw = Math.round(rect.w * scale), dh = Math.round(rect.h * scale);
        var tmp = document.createElement('canvas');
        tmp.width = outW; tmp.height = outH;
        tmp.getContext('2d').drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, dw, dh);
        var ctx = c.getContext('2d');
        var s2 = Math.min(1, 140 / outW);
        c.height = Math.round(outH * s2);
        ctx.drawImage(tmp, 0, 0, Math.round(outW * s2), Math.round(outH * s2));
        if (++done === targets.length) { /* all samples drawn */ }
      }).catch(function () { if (++done === targets.length) { /* ignore */ } });
    });
    var confirm = $('bpb-ed-samples-confirm');
    var cancel = $('bpb-ed-samples-cancel');
    if (confirm) {
      confirm.onclick = function () { panel.hidden = true; onConfirm(); };
    }
    if (cancel) {
      cancel.onclick = function () { panel.hidden = true; };
    }
  }
  /* Custom editing presets (§14): settings only, localStorage, max 12.
   * They store brightness/contrast/saturation/temp — never board specs. */
  function loadEditPresets() {
    try {
      var v = JSON.parse(window.localStorage.getItem('bp_edit_presets') || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function saveEditPresets(list) {
    try { window.localStorage.setItem('bp_edit_presets', JSON.stringify(list.slice(0, 12))); }
    catch (e) { /* storage unavailable: presets just won't persist */ }
  }
  function renderEditPresets() {
    var row = $('bpb-ed-presets');
    if (!row) { return; }
    row.innerHTML = '';
    loadEditPresets().forEach(function (p, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ghost bpb-mini';
      b.textContent = p.name;
      b.addEventListener('click', function () {
        if (!state.editorDraft) { return; }
        ['brightness', 'contrast', 'saturation', 'temp'].forEach(function (k) {
          if (p.settings[k] !== undefined) {
            state.editorDraft[k] = p.settings[k];
            state.editorDirty[k] = true;
          }
        });
        refreshEditorControls();
        renderEditorPreview();
      });
      var x = document.createElement('button');
      x.type = 'button';
      x.className = 'btn ghost bpb-mini';
      x.textContent = '×';
      x.setAttribute('aria-label', 'Delete preset');
      x.addEventListener('click', function () {
        var list = loadEditPresets();
        list.splice(i, 1);
        saveEditPresets(list);
        renderEditPresets();
      });
      var wrap = document.createElement('span');
      wrap.className = 'bchip';
      wrap.appendChild(b);
      wrap.appendChild(x);
      row.appendChild(wrap);
    });
  }
  function bindEditor() {
    var ed = $('bpb-editor');
    if (!ed) { return; }
    function onInput(id, key, map) {
      var el = $(id);
      if (!el) { return; }
      el.addEventListener('input', function () {
        if (!state.editorDraft) { return; }
        state.editorDraft[key] = map(parseFloat(el.value));
        state.editorDirty[key] = true;
        refreshEditorControls();
        renderEditorPreview();
      });
    }
    onInput('bpb-ed-brightness', 'brightness', function (v) { return 1 + v / 100; });
    onInput('bpb-ed-contrast', 'contrast', function (v) { return 1 + v / 100; });
    onInput('bpb-ed-saturation', 'saturation', function (v) { return 1 + v / 100; });
    onInput('bpb-ed-temp', 'temp', function (v) { return v; });
    function click(id, fn) {
      var b = $(id);
      if (b) { b.addEventListener('click', fn); }
    }
    click('bpb-ed-close', closeEditor);
    click('bpb-ed-undo', function () {
      var im = editorImage();
      if (im && LOGIC.undo(im)) {
        state.editorDraft = JSON.parse(JSON.stringify(im.own || {}));
        state.editorDirty = {};
        refreshEditorControls(); renderEditorPreview(); renderCropCanvas();
      }
    });
    click('bpb-ed-redo', function () {
      var im = editorImage();
      if (im && LOGIC.redo(im)) {
        state.editorDraft = JSON.parse(JSON.stringify(im.own || {}));
        state.editorDirty = {};
        refreshEditorControls(); renderEditorPreview(); renderCropCanvas();
      }
    });
    click('bpb-ed-reset', function () {
      var im = editorImage();
      if (!im) { return; }
      LOGIC.pushUndo(im);
      state.editorDraft = {};
      state.editorDirty = {};
      refreshEditorControls(); renderEditorPreview(); renderCropCanvas();
    });
    click('bpb-ed-apply-one', applyToOne);
    click('bpb-ed-apply-all', function () { applyToScope('all'); });
    click('bpb-ed-apply-sel', function () { applyToScope('selected'); });
    click('bpb-ed-rot-l', function () {
      if (!state.editorDraft) { return; }
      var im = editorImage();
      var eff = LOGIC.mergeSettings(im.shared, state.editorDraft);
      state.editorDraft.rotation = (((eff.rotation + 270) % 360) + 360) % 360;
      state.editorDirty.rotation = true;
      refreshEditorControls(); renderEditorPreview(); renderCropCanvas();
    });
    click('bpb-ed-rot-r', function () {
      if (!state.editorDraft) { return; }
      var im = editorImage();
      var eff = LOGIC.mergeSettings(im.shared, state.editorDraft);
      state.editorDraft.rotation = (((eff.rotation + 90) % 360) + 360) % 360;
      state.editorDirty.rotation = true;
      refreshEditorControls(); renderEditorPreview(); renderCropCanvas();
    });
    click('bpb-ed-flip', function () {
      if (!state.editorDraft) { return; }
      var im = editorImage();
      var eff = LOGIC.mergeSettings(im.shared, state.editorDraft);
      state.editorDraft.flipH = !eff.flipH;
      state.editorDirty.flipH = true;
      refreshEditorControls(); renderEditorPreview();
    });
    click('bpb-ed-bw', function () {
      if (!state.editorDraft) { return; }
      var im = editorImage();
      var eff = LOGIC.mergeSettings(im.shared, state.editorDraft);
      state.editorDraft.bw = !eff.bw;
      state.editorDirty.bw = true;
      refreshEditorControls(); renderEditorPreview();
    });
    click('bpb-ed-enhance', function () {
      if (!state.editorDraft) { return; }
      var im = editorImage();
      var eff = LOGIC.mergeSettings(im.shared, state.editorDraft);
      state.editorDraft.enhance = !eff.enhance;
      state.editorDirty.enhance = true;
      refreshEditorControls(); renderEditorPreview();
    });
    click('bpb-ed-before-after', function () {
      state.editorBefore = !state.editorBefore;
      var b = $('bpb-ed-before-after');
      if (b) { b.setAttribute('aria-pressed', state.editorBefore ? 'true' : 'false'); }
      renderEditorPreview();
    });
    click('bpb-ed-zoom-in', function () {
      state.editorZoom = Math.min(2, state.editorZoom + 0.5);
      renderEditorPreview();
    });
    click('bpb-ed-zoom-out', function () {
      state.editorZoom = Math.max(0.5, state.editorZoom - 0.5);
      renderEditorPreview();
    });
    var bg = $('bpb-ed-bg');
    if (bg) {
      bg.addEventListener('change', function () {
        if (!state.editorDraft) { return; }
        state.editorDraft.bg = bg.value === 'board' ? null : bg.value;
        state.editorDirty.bg = true;
        renderEditorPreview();
      });
    }
    var radios = document.querySelectorAll('input[name="bpb-crop-mode"]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].addEventListener('change', function () {
        if (!state.editorDraft) { return; }
        if (state.editorDraft.crop) {
          state.editorDraft.crop.mode = cropMode();
          state.editorDirty.crop = true;
        }
        renderCropCanvas();
      });
    }
    /* Preset save (UI-editor correction, 18 Nov 2026): the visible name
     * field is removed — custom presets auto-name sequentially ("Custom 1",
     * "Custom 2", ...) from the next free number, so saving still works
     * with no name to type. */
    click('bpb-ed-preset-save', function () {
      if (!state.editorDraft) { return; }
      var im = editorImage();
      var eff = LOGIC.mergeSettings(im.shared, state.editorDraft);
      var list = loadEditPresets();
      var n = 1;
      var taken = {};
      list.forEach(function (p) { taken[p.name] = true; });
      while (taken[t('bpb.preset_auto', 'Custom {n}').replace('{n}', String(n))]) { n++; }
      var name = t('bpb.preset_auto', 'Custom {n}').replace('{n}', String(n));
      list.unshift({
        name: name,
        settings: {
          brightness: eff.brightness, contrast: eff.contrast,
          saturation: eff.saturation, temp: eff.temp
        }
      });
      saveEditPresets(list);
      renderEditPresets();
    });
    click('bpb-ed-reset-all', function () {
      if (!state.images.length) { return; }
      if (!window.confirm(t('bpb.reset_all_confirm',
        'Clear all edits on every photo?'))) { return; }
      LOGIC.resetAll(state.images);
      state.images.forEach(function (im) { invalidateOutput(im); });
      closeEditor();
      renderManager();
      saveSessionSoon();
    });
    bindCropCanvas();
  }

  /* -- Processing queue (§12) ---------------------------------------------- */
  /* Two workers pull from one pure queue (LOGIC.createQueue). A failed
   * image is marked and the batch continues; pause/resume/cancel are
   * flag flips checked between items; the UI yields between items so a
   * 500-photo run never freezes the page. */
  function processOne(im) {
    im.status = 'processing';
    renderManager();
    var spec = API.effSpec();
    return API.decodeFile(im.blob).then(function (img) {
      im.width = img.naturalWidth;
      im.height = img.naturalHeight;
      var opts = effectiveOpts(im, null);
      var built = API.buildCanvas(img, spec, opts);
      im.outW = built.width;
      im.outH = built.height;
      return API.fitBlob(built, spec.kb * 1024).then(function (res) {
        var check = LOGIC.validateOutput({
          w: built.width, h: built.height,
          /* Expected = the board spec, not the built size: passing
           * built.width as expected would make the check a tautology
           * that can never catch a wrong-size output. */
          expectedW: spec.w, expectedH: spec.h,
          blob: res.blob, kbTarget: spec.kb, over: res.over
        });
        if (!res.blob || !check.ok) {
          im.status = 'failed';
          im.error = res.over ? 'oversize' : 'process';
          diag('process_fail', im.id, state.images.indexOf(im), 'process', im.error);
          return;
        }
        if (im.outputUrl) { URL.revokeObjectURL(im.outputUrl); }
        im.outputBlob = res.blob;
        im.outputUrl = URL.createObjectURL(res.blob);
        im.status = 'done';
        if (res.over) {
          /* Over target at lowest quality is still a usable file — the
           * user is told honestly (status stays done, note in title). */
          im.error = 'oversize';
        }
      });
    }).catch(function () {
      im.status = 'failed';
      im.error = 'corrupt';
      diag('process_fail', im.id, state.images.indexOf(im), 'process', 'decode');
    });
  }
  function updateProgress(done, total, failed) {
    var bar = $('bpb-progress');
    if (bar) { bar.max = total; bar.value = done; }
    var tx = $('bpb-progress-text');
    if (tx) {
      tx.textContent = t('bpb.progress', '{d} of {n} done', { d: done, n: total })
        + (failed ? ' · ' + failed + ' ' + t('bpb.status_failed', 'Failed') : '');
    }
  }
  function processAll() {
    if (state.processing) { return Promise.resolve(); }
    var todo = state.images.filter(function (im) {
      return im.status === 'queued' || im.status === 'failed';
    });
    if (!todo.length) { return Promise.resolve(); }
    todo.forEach(function (im) { im.status = 'queued'; im.error = null; });
    state.processing = true;
    state.paused = false;
    state.cancelRequested = false;
    var queue = LOGIC.createQueue(todo.map(function (im) { return im.id; }));
    state.queue = queue;
    var total = todo.length;
    renderToolbar();
    var pauseBtn = $('bpb-pause-btn');
    if (pauseBtn) { pauseBtn.textContent = t('bpb.pause', 'Pause'); }
    function worker() {
      function step() {
        if (state.cancelRequested) { return Promise.resolve(); }
        if (state.paused) {
          return new Promise(function (res) { setTimeout(res, 200); }).then(step);
        }
        var id = queue.next();
        if (!id) { return Promise.resolve(); }
        var im = findImage(id);
        if (!im) { return step(); }
        return processOne(im).then(function () {
          /* processOne sets im.status; the queue only learns the outcome
           * here — without this, counts() stays 0 and the progress bar
           * and text never advance (caught by rendered verification). */
          if (im.status === 'done') { queue.markDone(id); }
          else { queue.markFailed(id); }
          var c = queue.counts();
          updateProgress(c.done + c.failed, total, c.failed);
          renderToolbar();
          return yieldUI().then(step);
        });
      }
      return step();
    }
    /* Two workers: enough parallelism for speed, small enough that
     * canvas memory stays bounded on phones. */
    return Promise.all([worker(), worker()]).then(function () {
      state.processing = false;
      state.queue = null;
      var c = queue.counts();
      var cancelled = state.cancelRequested;
      renderManager();
      saveSessionSoon();
      say(cancelled
        ? t('bpb.cancel', 'Cancel')
        : t('bpb.progress', '{d} of {n} done', { d: c.done + c.failed, n: total })
          + ' · ' + c.failed + ' ' + t('bpb.status_failed', 'Failed'));
      diag('process_end', null, null, 'process',
        'done=' + c.done + ' failed=' + c.failed + ' cancelled=' + cancelled);
    });
  }
  function downloadOne(im) {
    if (!im.outputBlob) { return; }
    var idx = state.images.indexOf(im);
    API.downloadBlob(im.outputBlob, LOGIC.exportName(idx));
  }
  /* -- ZIP export (§15) ----------------------------------------------------- */
  function exportZip() {
    if (state.processing) { return Promise.resolve(); }
    var done = state.images.filter(function (im) { return im.status === 'done' && im.outputBlob; });
    if (!done.length) { return Promise.resolve(); }
    var status = $('bpb-export-status');
    /* Soft cap: a ZIP over ~300 MB of outputs is refused honestly
     * (memory safety on phones) — the user can export in two halves. */
    var totalBytes = 0;
    done.forEach(function (im) { totalBytes += im.outputBlob.size; });
    if (totalBytes > 300 * 1024 * 1024) {
      if (status) { status.textContent = t('bpb.err_size', 'File is over 25 MB.'); }
      say(t('bpb.export_fail', 'ZIP could not be created. Please try again.'));
      return Promise.resolve();
    }
    if (status) { status.textContent = t('bpb.progress', '{d} of {n} done', { d: 0, n: done.length }); }
    var files = [];
    var chain = Promise.resolve();
    done.forEach(function (im, i) {
      chain = chain.then(function () {
        return im.outputBlob.arrayBuffer().then(function (ab) {
          files.push({ name: LOGIC.exportName(state.images.indexOf(im)), data: new Uint8Array(ab) });
          if (status) {
            status.textContent = t('bpb.progress', '{d} of {n} done', { d: i + 1, n: done.length });
          }
        });
      });
    });
    return chain.then(function () {
      var zipBytes;
      try {
        zipBytes = ZIP.createZip(files);
      } catch (e) {
        if (status) { status.textContent = t('bpb.export_fail', 'ZIP could not be created. Please try again.'); }
        diag('export_fail', null, null, 'export', 'createZip threw');
        return;
      }
      /* Integrity check: re-read the archive we just built. */
      var check = ZIP.verifyZip(zipBytes);
      if (!check.ok) {
        if (status) { status.textContent = t('bpb.export_fail', 'ZIP could not be created. Please try again.'); }
        diag('export_fail', null, null, 'export', 'verify failed: ' + check.reason);
        return;
      }
      var failed = state.images.length - done.length;
      API.downloadBlob(new Blob([zipBytes], { type: 'application/zip' }), 'board-photos.zip');
      if (status) {
        status.textContent = t('bpb.export_done', 'ZIP ready: {d} photos, {f} failed.',
          { d: done.length, f: failed });
      }
      say(t('bpb.export_done', 'ZIP ready: {d} photos, {f} failed.',
        { d: done.length, f: failed }));
      diag('export_ok', null, null, 'export', 'files=' + done.length + ' bytes=' + zipBytes.length);
    }).catch(function (e) {
      if (status) { status.textContent = t('bpb.export_fail', 'ZIP could not be created. Please try again.'); }
      diag('export_fail', null, null, 'export', String(e && e.message || e));
    });
  }

  /* -- Init ----------------------------------------------------------------- */
  function bindProcess() {
    function click(id, fn) {
      var b = $(id);
      if (b) { b.addEventListener('click', fn); }
    }
    click('bpb-process-btn', processAll);
    click('bpb-pause-btn', function () {
      if (!state.processing || !state.queue) { return; }
      if (state.paused) {
        state.queue.resume();
        state.paused = false;
        var b = $('bpb-pause-btn');
        if (b) { b.textContent = t('bpb.pause', 'Pause'); }
      } else {
        state.queue.pause();
        state.paused = true;
        var b2 = $('bpb-pause-btn');
        if (b2) { b2.textContent = t('bpb.resume', 'Resume'); }
      }
    });
    click('bpb-cancel-btn', function () {
      if (!state.processing || !state.queue) { return; }
      state.cancelRequested = true;
      state.queue.cancel();
    });
    click('bpb-export-btn', exportZip);
  }
  function init() {
    bindMode();
    bindIntake();
    bindManager();
    bindEditor();
    bindProcess();
    state.editPresets = loadEditPresets();
    renderManager();
    renderLog();
    /* Restore a previous bulk session (best-effort, never blocking). */
    idbOpen().then(function () { return restoreSession(); }).catch(function () { /* no session */ });
    window.addEventListener('beforeunload', function () { saveSession(); });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
