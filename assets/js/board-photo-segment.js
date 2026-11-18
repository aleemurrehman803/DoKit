/* DoKit — Board Photo background replacement (UI-editor correction, 18 Nov 2026).
 * Person segmentation, 100% in-browser, zero-cost, no paid API, no CDN.
 *
 * ENGINE (primary): MediaPipe Selfie Segmentation 0.1.1675465747, VENDORED
 * under assets/js/vendor/mediapipe-selfie/ (selfie_segmentation.js 44 KB +
 * SIMD wasm 5.7 MB + tflite model 249 KB = ~6.3 MB total). The vendor script
 * is a plain same-origin <script> (CSP script-src 'self' safe); the wasm +
 * model are fetched ONLY when a photo is uploaded and segmentation starts,
 * so page load is unaffected. locateFile() is pointed at the vendored dir
 * resolved relative to THIS file's own <script src>, so it works under any
 * deploy subpath (GitHub Pages /DoKit/ included) — never a hard-coded root.
 * Model 1 (landscape) is used: it covers head + shoulders, which is what
 * board photos are. NEVER reconstructs faces: the mask only decides which
 * pixels are subject vs background; no pixel of the person is altered,
 * beautified or generated.
 *
 * ENGINE (fallback): colour-based background removal. The photo is
 * downscaled, then a flood fill spreads from every border pixel over
 * near-identical colours (uniform studio/backdrop backgrounds — the
 * normal passport-photo case). It is used ONLY when MediaPipe is
 * unavailable or returns an unusable mask. A mask is unusable when the
 * foreground covers <5% or >95% of the frame — in that case removeBackground
 * reports engine 'none' and the caller must say so honestly instead of
 * shipping a bad cutout.
 *
 * EDGE QUALITY: masks are feathered (blur) when composited; the caller
 * exposes a feather slider. Hair/fine detail is the known weak point of
 * both engines — see the final report for per-photo honest results.
 *
 * Classic script, var only, no modules, no eval. Exposes window.DKBoardSegment:
 *   ensure()            -> Promise<boolean>  (MediaPipe ready?)
 *   removeBackground(img, opts) -> Promise<{mask, engine, coverage, ms, reason}|null>
 *   applyMaskToCanvas(subjectCanvas, maskCanvas, featherPx)
 *   info                -> last run {engine, coverage, ms, reason} (also window.__bpSegInfo, for tests)
 */
(function () {
  'use strict';

  var VENDOR_FILES = ['selfie_segmentation.js', 'selfie_segmentation_solution_simd_wasm_bin.js'];
  var WASM_BYTES = 5694839 + 276493 + 249024 + 249792 + 44542; /* ~6.3 MB vendored, measured 18 Nov 2026 */

  /* -- Vendor base: resolve relative to this file's own script tag -------- */
  function vendorBase() {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var s = scripts[i].getAttribute('src') || '';
      if (s.indexOf('board-photo-segment.js') !== -1) {
        try { return new URL('vendor/mediapipe-selfie/', new URL(s, document.baseURI)).href; }
        catch (e) { return 'vendor/mediapipe-selfie/'; }
      }
    }
    return 'vendor/mediapipe-selfie/';
  }

  /* -- MediaPipe (primary engine) ------------------------------------------ */
  var seg = null, segState = 'idle'; /* idle | ready | failed */
  var segInitPromise = null;

  function ensureMP() {
    if (segState === 'ready') { return Promise.resolve(true); }
    if (segState === 'failed') { return Promise.resolve(false); }
    if (segInitPromise) { return segInitPromise; }
    segInitPromise = new Promise(function (resolve) {
      var settled = false;
      function done(ok) {
        if (settled) { return; }
        settled = true;
        segState = ok ? 'ready' : 'failed';
        resolve(ok);
      }
      /* The vendor script may still be loading (defer order) — wait for it. */
      var waited = 0;
      (function waitForLib() {
        if (typeof window.SelfieSegmentation !== 'undefined') {
          try {
            seg = new window.SelfieSegmentation({
              locateFile: function (f) { return vendorBase() + f; }
            });
            /* modelSelection 1 = landscape model (head + shoulders). */
            seg.setOptions({ modelSelection: 1 });
            /* initialize() can hang offline: 25 s hard cap, then fallback. */
            var to = setTimeout(function () { done(false); }, 25000);
            seg.initialize().then(function () { clearTimeout(to); done(true); })
              .catch(function () { clearTimeout(to); done(false); });
          } catch (e) { done(false); }
          return;
        }
        waited += 100;
        if (waited > 10000) { done(false); return; } /* vendor script never arrived */
        setTimeout(waitForLib, 100);
      })();
    });
    return segInitPromise;
  }

  function segmentWithMP(img) {
    return new Promise(function (resolve) {
      var done = false;
      function finish(mask) { if (!done) { done = true; resolve(mask); } }
      try {
        seg.onResults(function (res) { finish(res && res.segmentationMask ? res.segmentationMask : null); });
        seg.send({ image: img });
      } catch (e) { finish(null); return; }
      setTimeout(function () { finish(null); }, 20000); /* a stuck frame must not hang the tool */
    });
  }

  /* -- Mask helpers --------------------------------------------------------- */
  /* Normalise any mask source (canvas / image / video frame) to a canvas
   * at the source image's own size, white = subject, black = background. */
  function maskToCanvas(maskSrc, w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.drawImage(maskSrc, 0, 0, w, h);
    return c;
  }
  /* Foreground coverage of a mask canvas (0..1). Guards the "unusable mask"
   * rule: <0.05 or >0.95 means the segmenter found (almost) nothing or
   * (almost) everything — either way the cutout cannot be trusted. */
  function maskCoverage(maskCanvas) {
    var w = maskCanvas.width, h = maskCanvas.height;
    var ctx = maskCanvas.getContext('2d');
    var step = Math.max(1, Math.floor(Math.sqrt((w * h) / 20000))); /* sample ~20k px */
    var data = ctx.getImageData(0, 0, w, h).data;
    var fg = 0, n = 0;
    for (var y = 0; y < h; y += step) {
      for (var x = 0; x < w; x += step) {
        var i = (y * w + x) * 4;
        if (data[i] > 127) { fg++; }
        n++;
      }
    }
    return n ? fg / n : 0;
  }
  /* Feather a mask: draw it through a blur so edges blend into the new bg
   * instead of cutting a hard halo. Applied at composite time, the
   * ORIGINAL mask is never mutated (the slider can move freely). */
  function featheredMask(maskCanvas, featherPx) {
    if (!featherPx || featherPx <= 0) { return maskCanvas; }
    var c = document.createElement('canvas');
    c.width = maskCanvas.width; c.height = maskCanvas.height;
    var ctx = c.getContext('2d');
    try { ctx.filter = 'blur(' + featherPx + 'px)'; } catch (e) { /* old browser: hard edge */ }
    ctx.drawImage(maskCanvas, 0, 0);
    try { ctx.filter = 'none'; } catch (e) { /* ignore */ }
    return c;
  }

  /* -- Colour fallback (uniform backgrounds only) --------------------------- */
  /* Flood fill from the frame border over near-identical colours.
   * Runs on a downscaled copy (max 320 px wide) for speed, then upscales
   * the mask to source size. Returns {mask, coverage} or null. */
  function colorRemove(img, tolerance) {
    var tol = tolerance || 48;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var scale = Math.min(1, 320 / iw);
    var w = Math.max(1, Math.round(iw * scale)), h = Math.max(1, Math.round(ih * scale));
    var small = document.createElement('canvas');
    small.width = w; small.height = h;
    var sctx = small.getContext('2d');
    sctx.drawImage(img, 0, 0, w, h);
    var data;
    try { data = sctx.getImageData(0, 0, w, h).data; }
    catch (e) { return null; }
    var bg = new Uint8Array(w * h); /* 1 = background */
    /* Seed: every border pixel. Grow: 4-connected neighbours whose colour
     * is within tolerance (sum of channel deltas) of the pixel we came from.
     * Using the neighbour's own colour (not a single seed colour) lets a
     * softly shaded backdrop still fill completely. */
    var stack = [];
    function push(x, y) {
      var i = y * w + x;
      if (!bg[i]) { bg[i] = 1; stack.push(i); }
    }
    for (var x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (var y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (stack.length) {
      var idx = stack.pop();
      var px = idx % w, py = (idx / w) | 0;
      var o = idx * 4, r = data[o], g = data[o + 1], b = data[o + 2];
      var nb = [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]];
      for (var k = 0; k < 4; k++) {
        var nx = nb[k][0], ny = nb[k][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) { continue; }
        var ni = ny * w + nx;
        if (bg[ni]) { continue; }
        var no = ni * 4;
        var d = Math.abs(data[no] - r) + Math.abs(data[no + 1] - g) + Math.abs(data[no + 2] - b);
        if (d <= tol) { bg[ni] = 1; stack.push(ni); }
      }
    }
    /* Upscale the mask to source size: white = subject (NOT background). */
    var mask = document.createElement('canvas');
    mask.width = iw; mask.height = ih;
    var mctx = mask.getContext('2d');
    var mimg = mctx.createImageData(iw, ih);
    for (var yy = 0; yy < ih; yy++) {
      var sy = Math.min(h - 1, (yy * h / ih) | 0);
      for (var xx = 0; xx < iw; xx++) {
        var sx = Math.min(w - 1, (xx * w / iw) | 0);
        var mi = (yy * iw + xx) * 4;
        var v = bg[sy * w + sx] ? 0 : 255;
        mimg.data[mi] = v; mimg.data[mi + 1] = v; mimg.data[mi + 2] = v; mimg.data[mi + 3] = 255;
      }
    }
    mctx.putImageData(mimg, 0, 0);
    return { mask: mask, coverage: maskCoverage(mask) };
  }

  /* -- Public API ------------------------------------------------------------ */
  var info = { engine: 'none', coverage: 0, ms: 0, reason: '' };
  function setInfo(engine, coverage, ms, reason) {
    info = { engine: engine, coverage: coverage, ms: ms, reason: reason || '' };
    window.__bpSegInfo = info; /* test hook: E2E reads engine + coverage */
    return info;
  }

  /* Main entry: img = loaded HTMLImageElement. opts: {tolerance}.
   * Tries MediaPipe first; on failure/unusable mask falls back to colour
   * removal; if that is unusable too, resolves null (caller keeps the
   * cover-crop-on-board-colour behaviour and says so honestly). */
  function removeBackground(img, opts) {
    var t0 = Date.now();
    var tolerance = (opts && opts.tolerance) || 48;
    return ensureMP().then(function (mpOk) {
      if (mpOk) {
        return segmentWithMP(img).then(function (maskSrc) {
          if (maskSrc) {
            var mask = maskToCanvas(maskSrc, img.naturalWidth, img.naturalHeight);
            var cov = maskCoverage(mask);
            if (cov >= 0.05 && cov <= 0.95) {
              setInfo('mediapipe', cov, Date.now() - t0, '');
              return { mask: mask, engine: 'mediapipe', coverage: cov, ms: Date.now() - t0, reason: '' };
            }
            /* MediaPipe mask unusable — fall through to colour removal. */
            return colorFallback(img, tolerance, t0, 'mediapipe mask unusable (coverage ' + cov.toFixed(2) + ')');
          }
          return colorFallback(img, tolerance, t0, 'mediapipe returned no mask');
        });
      }
      return colorFallback(img, tolerance, t0, 'mediapipe unavailable');
    });
  }
  function colorFallback(img, tolerance, t0, mpReason) {
    var res = null;
    try { res = colorRemove(img, tolerance); } catch (e) { res = null; }
    if (res && res.coverage >= 0.05 && res.coverage <= 0.95) {
      setInfo('colour', res.coverage, Date.now() - t0, mpReason);
      return { mask: res.mask, engine: 'colour', coverage: res.coverage, ms: Date.now() - t0, reason: mpReason };
    }
    setInfo('none', res ? res.coverage : 0, Date.now() - t0,
      mpReason + (res ? '; colour fallback unusable (coverage ' + res.coverage.toFixed(2) + ')' : '; colour fallback failed'));
    return null;
  }

  /* Composite a mask onto a subject canvas IN PLACE: pixels outside the
   * mask become transparent, so the caller's board-colour fill shows
   * through. featherPx blurs the mask edge first (hair halo control). */
  function applyMaskToCanvas(subjectCanvas, maskCanvas, featherPx) {
    var ctx = subjectCanvas.getContext('2d');
    var m = featheredMask(maskCanvas, featherPx || 0);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(m, 0, 0, subjectCanvas.width, subjectCanvas.height);
    ctx.restore();
  }

  window.DKBoardSegment = {
    ensure: ensureMP,
    removeBackground: removeBackground,
    applyMaskToCanvas: applyMaskToCanvas,
    maskCoverage: maskCoverage,
    vendorBytes: WASM_BYTES,
    vendorFiles: VENDOR_FILES.slice(),
    info: function () { return info; }
  };
})();
