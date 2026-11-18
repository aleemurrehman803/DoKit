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
 * unavailable or returns an unusable mask, or when the user explicitly
 * picks "Try colour removal" after a failure (forceColour). A mask is
 * unusable when the foreground covers <5% or >95% of the frame — in
 * that case removeBackground reports engine 'none' and the caller must
 * treat that as a FAILED background replacement (error + retry), never
 * a silent cover-crop success.
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
  /* NOTE (image-quality round, 18 Nov 2026): the old featheredMask
   * (uniform Gaussian blur) was removed — it is what spread the pale
   * halo. refineMask below (choke + bounded box blur) replaces it. */

  /* -- Mask refinement (image-quality round, 18 Nov 2026) ------------------ */
  /* MASK CHANNELS — measured in-page 18 Nov 2026 (woman-yellow, 800x705):
   * MediaPipe's mask canvas carries the mask TWICE: RED is the BINARY
   * hard classification (278,094 px > 127, zero mid values) and ALPHA is
   * the SOFT edge (256,004 px > 127 plus 26,395 mid values). The colour
   * fallback's mask is RGB binary with alpha 255. Both producers agree
   * on one thing: the mask value is in RED. refineMask therefore reads
   * RED (the hard edge — the choke erodes a clean boundary, not the
   * model's own soft fringe) and writes the refined value into BOTH
   * RGB and ALPHA: the compositor (destination-in) reads ALPHA, and a
   * second refine pass over an already-refined mask is a true no-op.
   * The first version wrote RGB=v with alpha 255 — destination-in then
   * kept EVERYTHING and the background was never removed (caught by the
   * ablation: the After image kept its original yellow background while
   * the UI claimed "background replaced").
   * The raw MediaPipe mask's effective resolution is the model's 256x144
   * input (verified from the tflite: input tensor [1,144,256,3], output
   * [1,144,256,1]). The soft halo the user sees is created DOWNSTREAM:
   * the mask downscale to 150x200 plus the old uniform Gaussian feather
   * (blur 2px) spread a 2-5px band in which the ORIGINAL background
   * colour leaked through (measured halo 8.5-20.5px at 150x200 output).
   * refineMask fixes the edge AT OUTPUT SIZE (150x200 = 30k px, so
   * ImageData processing is cheap):
   *   1. CHOKE: erode the mask ~1px (3x3 min filter) — cuts the outer
   *      fringe band that contains background pixels, without touching
   *      hair/ears/arms (1px at 150 wide is below a hair strand).
   *   2. FEATHER: a small separable BOX blur (radius = featherPx) instead
   *      of a Gaussian — a box blur's support is bounded, so the soft band
   *      stays narrow and predictable (feather 1 = ~3px band total).
   * The mask itself is never upscaled and never blurred at source size. */
  function erode3(a, w, h) {
    var out = new Float32Array(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var m = 255;
        for (var dy = -1; dy <= 1; dy++) {
          var yy = y + dy; if (yy < 0) { yy = 0; } if (yy >= h) { yy = h - 1; }
          for (var dx = -1; dx <= 1; dx++) {
            var xx = x + dx; if (xx < 0) { xx = 0; } if (xx >= w) { xx = w - 1; }
            var v = a[yy * w + xx];
            if (v < m) { m = v; }
          }
        }
        out[y * w + x] = m;
      }
    }
    return out;
  }
  function boxBlur1d(a, w, h, r, horizontal) {
    var out = new Float32Array(w * h);
    var n = 2 * r + 1;
    if (horizontal) {
      for (var y = 0; y < h; y++) {
        var sum = 0;
        for (var x = -r; x <= r; x++) {
          var xx = x < 0 ? 0 : (x >= w ? w - 1 : x);
          sum += a[y * w + xx];
        }
        for (var x2 = 0; x2 < w; x2++) {
          out[y * w + x2] = sum / n;
          var xa = x2 - r, xb = x2 + r + 1;
          sum += a[y * w + (xb >= w ? w - 1 : xb)] - a[y * w + (xa < 0 ? 0 : xa)];
        }
      }
    } else {
      for (var x = 0; x < w; x++) {
        var s2 = 0;
        for (var y = -r; y <= r; y++) {
          var yy = y < 0 ? 0 : (y >= h ? h - 1 : y);
          s2 += a[yy * w + x];
        }
        for (var y2 = 0; y2 < h; y2++) {
          out[y2 * w + x] = s2 / n;
          var ya = y2 - r, yb = y2 + r + 1;
          s2 += a[(yb >= h ? h - 1 : yb) * w + x] - a[(ya < 0 ? 0 : ya) * w + x];
        }
      }
    }
    return out;
  }
  function refineMask(maskCanvas, chokePx, featherPx) {
    var w = maskCanvas.width, h = maskCanvas.height;
    var src = maskCanvas.getContext('2d').getImageData(0, 0, w, h).data;
    var a = new Float32Array(w * h);
    for (var i = 0; i < w * h; i++) { a[i] = src[i * 4]; } /* mask value is in RED (see channel note above) */
    var c = 0;
    while (c < (chokePx || 0)) { a = erode3(a, w, h); c++; }
    if (featherPx && featherPx > 0) {
      a = boxBlur1d(a, w, h, featherPx, true);
      a = boxBlur1d(a, w, h, featherPx, false);
    }
    var out = document.createElement('canvas');
    out.width = w; out.height = h;
    var octx = out.getContext('2d');
    var img = octx.createImageData(w, h);
    for (var j = 0; j < w * h; j++) {
      var v = a[j] < 0 ? 0 : (a[j] > 255 ? 255 : a[j]);
      /* Value in RGB AND alpha (see channel note above): destination-in
       * reads alpha — alpha 255 here would keep the whole background. */
      img.data[j * 4] = v; img.data[j * 4 + 1] = v;
      img.data[j * 4 + 2] = v; img.data[j * 4 + 3] = v;
    }
    octx.putImageData(img, 0, 0);
    return out;
  }
  /* Colour decontamination: after the mask is applied, the semi-transparent
   * edge band still carries the ORIGINAL background's colour (the mask edge
   * sits a pixel outside the true subject edge, so those pixels ARE old
   * background). Recolour each band pixel from the nearest fully-opaque
   * subject pixel (iterative 3x3 dilation, ~4px reach) — the band keeps
   * its own alpha, so the edge stays soft, but it now reads as subject
   * colour instead of a grey/yellow fringe. Alpha is never touched. */
  function decontaminate(subjectCanvas, maskCanvas) {
    var w = subjectCanvas.width, h = subjectCanvas.height;
    var sctx = subjectCanvas.getContext('2d');
    var s = sctx.getImageData(0, 0, w, h);
    var m = maskCanvas.getContext('2d').getImageData(0, 0, w, h).data;
    var d = s.data;
    var filled = new Uint8Array(w * h);
    /* The refined mask carries its value in ALPHA (and mirrors it in RGB)
     * — read alpha here so the band test agrees with destination-in. */
    for (var i = 0; i < w * h; i++) { filled[i] = m[i * 4 + 3] > 242 ? 1 : 0; }
    for (var pass = 0; pass < 4; pass++) {
      var changed = false;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var idx = y * w + x;
          if (filled[idx]) { continue; }
          var alpha = m[idx * 4 + 3];
          if (alpha <= 12 || alpha >= 243) { continue; } /* band only */
          var r = 0, g = 0, b = 0, n = 0;
          for (var dy = -1; dy <= 1; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) { continue; }
              var nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) { continue; }
              var ni = ny * w + nx;
              if (!filled[ni]) { continue; }
              var o = ni * 4;
              r += d[o]; g += d[o + 1]; b += d[o + 2]; n++;
            }
          }
          if (n) {
            var o2 = idx * 4;
            d[o2] = r / n; d[o2 + 1] = g / n; d[o2 + 2] = b / n;
            filled[idx] = 1; changed = true;
          }
        }
      }
      if (!changed) { break; }
    }
    sctx.putImageData(s, 0, 0);
  }
  /* Gentle capture sharpening, applied ONLY where the mask is fully opaque
   * (subject interior — never the background, never the edge band, so no
   * ringing at the cutout). Compensates the softening of the 150x200
   * downscale; it is a measured pipeline step (amount picked by the
   * browser ablation), not a user-facing "sharpen" button. */
  function sharpenSubject(canvas, maskCanvas, amount) {
    if (!amount || amount <= 0) { return; }
    var w = canvas.width, h = canvas.height;
    var ctx = canvas.getContext('2d');
    var s = ctx.getImageData(0, 0, w, h);
    var m = maskCanvas.getContext('2d').getImageData(0, 0, w, h).data;
    var d = s.data;
    var rgb = new Float32Array(w * h * 3);
    for (var i = 0; i < w * h; i++) {
      rgb[i * 3] = d[i * 4]; rgb[i * 3 + 1] = d[i * 4 + 1]; rgb[i * 3 + 2] = d[i * 4 + 2];
    }
    var blur = boxBlurRGB(rgb, w, h, 1);
    /* Sharpen only where the refined mask is fully opaque (alpha > 242)
     * — the subject interior, never the background or the edge band. */
    for (var j = 0; j < w * h; j++) {
      if (m[j * 4 + 3] > 242) {
        var o = j * 4, b3 = j * 3;
        d[o] = clamp255(d[o] + amount * (d[o] - blur[b3]));
        d[o + 1] = clamp255(d[o + 1] + amount * (d[o + 1] - blur[b3 + 1]));
        d[o + 2] = clamp255(d[o + 2] + amount * (d[o + 2] - blur[b3 + 2]));
      }
    }
    ctx.putImageData(s, 0, 0);
  }
  function clamp255(v) { return v < 0 ? 0 : (v > 255 ? 255 : v); }
  function boxBlurRGB(rgb, w, h, r) {
    var tmp = new Float32Array(w * h * 3);
    var out = new Float32Array(w * h * 3);
    var n = 2 * r + 1;
    for (var y = 0; y < h; y++) {
      for (var ch = 0; ch < 3; ch++) {
        var sum = 0;
        for (var x = -r; x <= r; x++) {
          var xx = x < 0 ? 0 : (x >= w ? w - 1 : x);
          sum += rgb[(y * w + xx) * 3 + ch];
        }
        for (var x2 = 0; x2 < w; x2++) {
          tmp[(y * w + x2) * 3 + ch] = sum / n;
          var xa = x2 - r, xb = x2 + r + 1;
          sum += rgb[(y * w + (xb >= w ? w - 1 : xb)) * 3 + ch]
            - rgb[(y * w + (xa < 0 ? 0 : xa)) * 3 + ch];
        }
      }
    }
    for (var x3 = 0; x3 < w; x3++) {
      for (var ch2 = 0; ch2 < 3; ch2++) {
        var s2 = 0;
        for (var y3 = -r; y3 <= r; y3++) {
          var yy = y3 < 0 ? 0 : (y3 >= h ? h - 1 : y3);
          s2 += tmp[(yy * w + x3) * 3 + ch2];
        }
        for (var y4 = 0; y4 < h; y4++) {
          out[(y4 * w + x3) * 3 + ch2] = s2 / n;
          var ya = y4 - r, yb = y4 + r + 1;
          s2 += tmp[((yb >= h ? h - 1 : yb) * w + x3) * 3 + ch2]
            - tmp[((ya < 0 ? 0 : ya) * w + x3) * 3 + ch2];
        }
      }
    }
    return out;
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

  /* Main entry: img = loaded HTMLImageElement. opts: {tolerance, forceColour}.
   * forceColour skips MediaPipe and flood-fills only (the failure box's
   * "Try colour removal" manual path). Tries MediaPipe first; on
   * failure/unusable mask falls back to colour removal; if that is
   * unusable too, resolves null (caller must treat that as a FAILED
   * background replacement — never a silent cover-crop success). */
  function removeBackground(img, opts) {
    var t0 = Date.now();
    var tolerance = (opts && opts.tolerance) || 48;
    /* TEST HOOK (pipeline fix, 18 Nov 2026): __bpSegTestFail forces a
     * segmentation failure so the failure path can be tested
     * deterministically. Production code never sets this flag. */
    if (window.__bpSegTestFail) {
      setInfo('none', 0, Date.now() - t0, 'test hook forced failure');
      return Promise.resolve(null);
    }
    /* Manual colour removal: skip MediaPipe, flood-fill only. */
    if (opts && opts.forceColour) {
      return Promise.resolve(colorFallback(img, tolerance, t0, 'manual colour removal'));
    }
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
   * through. featherPx now runs through refineMask (bounded box blur,
   * no choke) — the old Gaussian blur is gone: it spread the edge band
   * to 2-5px and let the original background leak in as a halo. */
  function applyMaskToCanvas(subjectCanvas, maskCanvas, featherPx) {
    var ctx = subjectCanvas.getContext('2d');
    var m = refineMask(maskCanvas, 0, featherPx || 0);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(m, 0, 0, subjectCanvas.width, subjectCanvas.height);
    ctx.restore();
  }

  window.DKBoardSegment = {
    ensure: ensureMP,
    removeBackground: removeBackground,
    applyMaskToCanvas: applyMaskToCanvas,
    refineMask: refineMask,
    decontaminate: decontaminate,
    sharpenSubject: sharpenSubject,
    maskCoverage: maskCoverage,
    vendorBytes: WASM_BYTES,
    vendorFiles: VENDOR_FILES.slice(),
    info: function () { return info; }
  };
})();
