/* DoKit — Board Photo bulk: pure logic (no DOM).
 * UMD: browser exposes window.DKBulkLogic; Node can require() this file.
 * WHY a separate pure module: every rule the UI enforces (validation,
 * editing priority, crop maths, naming, queue, manifest) is testable in
 * Node without a browser, so the harness proves the rules instead of
 * trusting a self-score. The DOM engine (board-photo-bulk.js) only
 * renders state and calls these functions — it never re-implements them.
 * Classic script, var only, no dependencies. */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.DKBulkLogic = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* -- Limits (single source; the DOM engine + ZIP module mirror them) -- */
  var LIMITS = {
    MAX_IMAGES: 500,
    MAX_FILE_BYTES: 25 * 1024 * 1024,
    MAX_MEGAPIXELS: 100,   /* decoded pixels cap: a 100 MP image would blow canvas memory */
    MAX_UNDO: 20,          /* undo steps kept per image */
    MAX_EDIT_PRESETS: 12,  /* custom editing presets, localStorage, settings only */
    MAX_ZIP_ENTRIES: 600,
    MAX_ZIP_TOTAL_UNCOMPRESSED: 500 * 1024 * 1024,
    MAX_ZIP_SINGLE_FILE: 25 * 1024 * 1024,
    MAX_ZIP_RATIO: 200
  };

  /* -- FNV-1a 32-bit hash (content identity for duplicate detection).
   * WHY FNV-1a, not crypto: it runs in every browser without async,
   * and for duplicate detection a 32-bit content hash + file size is
   * plenty (a collision would need identical size AND hash). */
  function fnv1aHex(u8) {
    var h = 0x811c9dc5;
    for (var i = 0; i < u8.length; i++) {
      h ^= u8[i];
      h = Math.imul(h, 0x01000193);
    }
    return ('0000000' + (h >>> 0).toString(16)).slice(-8);
  }

  /* -- File validation (metadata only; the caller sniffs magic bytes
   * first via DKBoardZip.sniffImage and passes the result as `kind`).
   * Every failure carries a machine reason code (see register §23). */
  function validateFileMeta(f) {
    if (!f || typeof f.size !== 'number') { return { ok: false, reason: 'type' }; }
    if (f.size === 0) { return { ok: false, reason: 'empty' }; }
    if (f.kind !== 'png' && f.kind !== 'jpeg' && f.kind !== 'webp') {
      return { ok: false, reason: 'type' };
    }
    if (f.size > LIMITS.MAX_FILE_BYTES) { return { ok: false, reason: 'size' }; }
    if (f.width && f.height) {
      if (f.width < 10 || f.height < 10) { return { ok: false, reason: 'dims' }; }
      if ((f.width * f.height) > LIMITS.MAX_MEGAPIXELS * 1000000) {
        return { ok: false, reason: 'dims' };
      }
    }
    return { ok: true, reason: null };
  }

  /* -- Editing model (§7.4): three layers, one rule.
   * shared = global/selected-applied settings; own = individual overrides.
   * Effective settings = {...shared, ...own} — own always wins, and a
   * global/selected apply only ever writes `shared`, so it can never
   * silently erase an individual override. */
  function defaultSettings() {
    return {
      brightness: 1, contrast: 1, saturation: 1, temp: 0,
      rotation: 0, flipH: false, bw: false, enhance: false,
      bg: null,      /* null = board background; 'original' = keep photo pixels */
      crop: null     /* null = head-safe cover crop; else {x,y,w,h} source pixels */
    };
  }
  function mergeSettings(shared, own) {
    var eff = defaultSettings();
    var k;
    if (shared) { for (k in shared) { if (shared[k] !== undefined) { eff[k] = shared[k]; } } }
    if (own) { for (k in own) { if (own[k] !== undefined) { eff[k] = own[k]; } } }
    return eff;
  }
  /* Apply `settings` to the shared layer of every image in scope.
   * scope 'all' = every image; 'selected' = selected ones only.
   * Returns the list of affected image ids. `own` is never touched. */
  function applyToScope(images, scope, settings) {
    var affected = [];
    for (var i = 0; i < images.length; i++) {
      var im = images[i];
      if (scope === 'selected' && !im.selected) { continue; }
      for (var k in settings) {
        if (settings[k] !== undefined) { im.shared[k] = settings[k]; }
      }
      affected.push(im.id);
    }
    return affected;
  }
  /* Reset one image's individual overrides only (shared survives). */
  function resetIndividual(im) {
    im.own = {};
    im.undoStack = [];
    im.redoStack = [];
  }
  /* Reset every image to its original state (both layers), after the
   * caller has confirmed with the user. */
  function resetAll(images) {
    for (var i = 0; i < images.length; i++) {
      images[i].shared = {};
      images[i].own = {};
      images[i].undoStack = [];
      images[i].redoStack = [];
    }
  }
  /* Undo/redo: snapshots are whole `own` objects (small JSON), depth
   * capped at MAX_UNDO so history can never grow without bound. */
  function pushUndo(im) {
    im.undoStack = im.undoStack || [];
    im.undoStack.push(JSON.stringify(im.own || {}));
    if (im.undoStack.length > LIMITS.MAX_UNDO) { im.undoStack.shift(); }
    im.redoStack = [];
  }
  function undo(im) {
    if (!im.undoStack || !im.undoStack.length) { return false; }
    im.redoStack = im.redoStack || [];
    im.redoStack.push(JSON.stringify(im.own || {}));
    im.own = JSON.parse(im.undoStack.pop());
    return true;
  }
  function redo(im) {
    if (!im.redoStack || !im.redoStack.length) { return false; }
    im.undoStack = im.undoStack || [];
    im.undoStack.push(JSON.stringify(im.own || {}));
    im.own = JSON.parse(im.redoStack.pop());
    return true;
  }

  /* -- Crop maths (same numbers as buildCanvas, so previews match output).
   * coverCropRect: head-safe cover crop, top bias 0.32.
   * smartCropRect: same window SIZE as the reference crop, position
   * recomputed per image (centred horizontally, head-safe vertically).
   * exactCropRect: same FRACTIONAL rect on every image. */
  function coverCropRect(iw, ih, outW, outH) {
    var scale = Math.max(outW / iw, outH / ih);
    var cw = Math.round(outW / scale), ch = Math.round(outH / scale);
    return {
      x: Math.max(0, Math.round((iw - cw) / 2)),
      y: Math.max(0, Math.round((ih - ch) * 0.32)),
      w: cw, h: ch
    };
  }
  function smartCropRect(iw, ih, refW, refH) {
    var cw = Math.min(refW, iw), ch = Math.min(refH, ih);
    return {
      x: Math.max(0, Math.round((iw - cw) / 2)),
      y: Math.max(0, Math.round((ih - ch) * 0.32)),
      w: cw, h: ch
    };
  }
  function exactCropRect(iw, ih, frac) {
    /* frac = {x, y, w, h} in 0..1 of the source image. */
    var w = Math.max(1, Math.round(frac.w * iw));
    var h = Math.max(1, Math.round(frac.h * ih));
    return {
      x: Math.max(0, Math.min(Math.round(frac.x * iw), iw - w)),
      y: Math.max(0, Math.min(Math.round(frac.y * ih), ih - h)),
      w: w, h: h
    };
  }

  /* -- Ordering: move an image id to a new index, returning the new
   * order of ids. The visible serial number is derived from this order
   * at render/export time — it is never the image's identity. */
  function moveItemOrder(ids, id, toIndex) {
    var list = ids.slice();
    var from = list.indexOf(id);
    if (from === -1) { return list; }
    list.splice(from, 1);
    var to = Math.max(0, Math.min(toIndex, list.length));
    list.splice(to, 0, id);
    return list;
  }

  /* -- Export naming: 1.jpg … N.jpg in the user's final order. The
   * number exists ONLY in the filename, never inside the photo. */
  function exportName(index) { return (index + 1) + '.jpg'; }

  /* -- Output validation (§15): dimensions + format + size, checked
   * before an image may enter the ZIP. */
  function validateOutput(o) {
    var reasons = [];
    if (!o || !o.blob) { reasons.push('missing'); }
    if (o && o.w !== o.expectedW) { reasons.push('width'); }
    if (o && o.h !== o.expectedH) { reasons.push('height'); }
    if (o && o.blob && o.blob.size > o.kbTarget * 1024 && o.over) {
      reasons.push('oversize');
    }
    if (o && o.blob && o.blob.size === 0) { reasons.push('empty'); }
    return { ok: reasons.length === 0, reasons: reasons };
  }

  /* -- Processing queue: a tiny pure state machine. The DOM engine drives
   * it (one item at a time, awaiting each), so a failed image can never
   * stop the batch and pause/resume/cancel are just flag flips. */
  function createQueue(ids) {
    var q = {
      pending: ids.slice(), done: [], failed: [],
      paused: false, cancelled: false,
      next: function () {
        if (q.cancelled || q.paused || !q.pending.length) { return null; }
        return q.pending.shift();
      },
      markDone: function (id) { q.done.push(id); },
      markFailed: function (id) { q.failed.push(id); },
      pause: function () { q.paused = true; },
      resume: function () { q.paused = false; },
      cancel: function () { q.cancelled = true; q.pending = []; },
      counts: function () {
        return { pending: q.pending.length, done: q.done.length, failed: q.failed.length };
      }
    };
    return q;
  }

  /* -- Session manifest (IndexedDB): order + settings + status ONLY.
   * Original blobs are stored separately (capped, see bulk.js) and are
   * never in this JSON; thumbnails are small dataURLs. */
  function manifestSerialize(images) {
    return JSON.stringify({
      v: 1,
      savedAt: Date.now(),
      images: images.map(function (im) {
        return {
          id: im.id, name: im.name, size: im.size, hash: im.hash,
          status: im.status, shared: im.shared || {}, own: im.own || {},
          thumb: im.thumb || null, storedBlob: !!im.storedBlob
        };
      })
    });
  }
  function manifestParse(json) {
    try {
      var d = JSON.parse(json);
      if (!d || d.v !== 1 || !Array.isArray(d.images)) { return null; }
      return d;
    } catch (e) { return null; }
  }

  return {
    LIMITS: LIMITS,
    fnv1aHex: fnv1aHex,
    validateFileMeta: validateFileMeta,
    defaultSettings: defaultSettings,
    mergeSettings: mergeSettings,
    applyToScope: applyToScope,
    resetIndividual: resetIndividual,
    resetAll: resetAll,
    pushUndo: pushUndo,
    undo: undo,
    redo: redo,
    coverCropRect: coverCropRect,
    smartCropRect: smartCropRect,
    exactCropRect: exactCropRect,
    moveItemOrder: moveItemOrder,
    exportName: exportName,
    validateOutput: validateOutput,
    createQueue: createQueue,
    manifestSerialize: manifestSerialize,
    manifestParse: manifestParse
  };
}));
