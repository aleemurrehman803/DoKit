
(function(){
function $(id){ return document.getElementById(id); }
function fmt(n){ if(n < 1024) return n + ' B'; if(n < 1048576) return (n/1024).toFixed(1) + ' KB'; return (n/1048576).toFixed(2) + ' MB'; }
function err(el, msg){ el.textContent = msg; el.className = 'err'; }
function okmsg(el, msg){ el.textContent = msg; el.className = 'ok'; }
function downloadBlob(blob, name){ var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function loadImage(file){
  return new Promise(function(res, rej){
    if(file.size > 25 * 1024 * 1024){ rej(new Error((window.dkT ? window.dkT('rsv_0977', 'File is larger than 25 MB. Please choose a smaller file.') : 'File is larger than 25 MB. Please choose a smaller file.'))); return; }
    var url = URL.createObjectURL(file); var img = new Image();
    img.onload = function(){ URL.revokeObjectURL(url); res(img); };
    img.onerror = function(){ URL.revokeObjectURL(url); rej(new Error((window.dkT ? window.dkT('rsv_1009', 'This image could not be read. Please choose a PNG, JPG or WebP file.') : 'This image could not be read. Please choose a PNG, JPG or WebP file.'))); };
    img.src = url;
  });
}
function guardMP(img, noteEl){
  var mp = img.naturalWidth * img.naturalHeight / 1000000;
  if(mp > 16){
    var sc = Math.sqrt(16 / mp);
    if(noteEl){ noteEl.textContent = (window.dkT ? window.dkT('rsv_0988', 'Note: image ') : 'Note: image ') + mp.toFixed(1) + (window.dkT ? window.dkT('rsv_0982', 'MP — pre-scaled to 16MP to protect mobile memory.') : 'MP — pre-scaled to 16MP to protect mobile memory.'); noteEl.className = ''; }
    return sc;
  }
  return 1;
}
// ---------- Word Counter ----------
var wc = $('wc-input');
if(wc){
  var out = $('wc-out');
  var stops = ['the','be','to','of','and','a','in','that','it','is','was','for','on','are','as','with','his','they','at','be','this','have','from','or','one','had','by','word','but','not','what','all','were','we','when','your','can','said','there','use','an','each','which','she','do','how','their','will','up','other','about','out','many','then','them','these','so','some','her','would','make','like','him','into','time','has','look','two','more','write','go','see','number','no','way','could','people','my','than','first','water','been','call','who','oil','its','now','find','long','down','day','did','get','come','made','may','part'];
  wc.addEventListener('input', function(){
    var t = wc.value;
    var words = t.trim() ? t.trim().split(/\s+/).length : 0;
    var chars = t.length;
    var charsNoSpace = t.replace(/\s/g, '').length;
    var sentences = t.trim() ? t.split(/[.!?]+/).filter(function(s){ return s.trim().length > 0; }).length : 0;
    var paras = t.trim() ? t.split(/\n\s*\n/).filter(function(s){ return s.trim().length > 0; }).length : 0;
    var readMin = words / 200, speakMin = words / 130;
    function mm(x){ var m = Math.floor(x), s = Math.round((x - m) * 60); return m + 'm ' + s + 's'; }
    var freq = {};
    t.toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).forEach(function(w){
      if(w.length > 2 && stops.indexOf(w) === -1){ freq[w] = (freq[w] || 0) + 1; }
    });
    var top = Object.keys(freq).sort(function(a,b){ return freq[b] - freq[a]; }).slice(0, 8)
      .map(function(w){ return w + ' (' + freq[w] + ')'; }).join(', ') || '—';
    out.innerHTML = '';
    var rows = [['Words', words], ['Characters', chars], ['Characters (no spaces)', charsNoSpace], ['Sentences', sentences], ['Paragraphs', paras], ['Reading time', mm(readMin)], ['Speaking time', mm(speakMin)], ['Top words', top]];
    // WHY (i18n): stat labels translate through the old wc.* keys
    // (verbatim old values; ur has none, so ur falls back to English).
    // 'Top words' translates through rsv_1015 (Oct 25 JS gate pass).
    var WC_LABEL_KEY = {'Words':'wc.words','Characters':'wc.chars','Characters (no spaces)':'wc.chars_nospace','Sentences':'wc.sentences','Paragraphs':'wc.paragraphs','Reading time':'wc.reading','Speaking time':'wc.speaking','Top words':'rsv_1015'};
    rows.forEach(function(r){
      var d = document.createElement('div'); var b = document.createElement('b');
      var rk = WC_LABEL_KEY[r[0]];
      b.textContent = (rk && window.dkT ? window.dkT(rk, r[0]) : r[0]) + ': ';
      d.appendChild(b); d.appendChild(document.createTextNode(String(r[1]))); out.appendChild(d);
    });
  });
  var cp = $('wc-copy');
  if(cp){ cp.addEventListener('click', function(){ if(navigator.clipboard){ navigator.clipboard.writeText(wc.value); } }); }
  // WHY (i18n): re-render stats on language change so the labels
  // translate without waiting for the next keystroke.
  document.addEventListener('dokit:langchange', function(){ wc.dispatchEvent(new Event('input')); });
}
// ---------- Case Converter ----------
var cc = $('cc-input');
if(cc){
  var ccOut = $('cc-out');
  function titleCase(s){ return s.replace(/\w\S*/g, function(w){ return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }); }
  function sentenceCase(s){ return s.toLowerCase().replace(/(^\s*[a-z]|[.!?]\s+[a-z])/g, function(m){ return m.toUpperCase(); }); }
  function camel(s){ var w = s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); return w.map(function(x, i){ return i === 0 ? x : x.charAt(0).toUpperCase() + x.slice(1); }).join(''); }
  function snake(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }
  function kebab(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function alt(s){ var up = true; return s.split('').map(function(c){ if(/[a-z]/i.test(c)){ var r = up ? c.toUpperCase() : c.toLowerCase(); up = !up; return r; } return c; }).join(''); }
  function inv(s){ return s.split('').map(function(c){ return c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase(); }).join(''); }
  var modes = {upper: function(s){ return s.toUpperCase(); }, lower: function(s){ return s.toLowerCase(); }, title: titleCase, sentence: sentenceCase, camel: camel, snake: snake, kebab: kebab, alt: alt, inv: inv};
  document.querySelectorAll('button[data-case]').forEach(function(btn){
    btn.addEventListener('click', function(){ var f = modes[btn.getAttribute('data-case')]; if(f){ ccOut.value = f(cc.value); } });
  });
  var cpy = $('cc-copy');
  if(cpy){ cpy.addEventListener('click', function(){
    var v = ccOut.value; if(!v) return;
    if(navigator.clipboard){ navigator.clipboard.writeText(v).catch(function(){}); }
    else { ccOut.select(); try{ document.execCommand('copy'); }catch(e){} }
  }); }
}
/* ---------- Resizer parked fixes: stored-ZIP writer + color-based
 * background removal. No dependencies: resized images are already
 * compressed (PNG/JPG/WebP), so stored ZIP entries lose nothing, and
 * removal samples colours from the image itself — the old tool's own
 * method ("It is not AI — it is color-based"). ---------- */
/* CRC-32 (IEEE, polynomial 0xEDB88320), required by the ZIP format. */
var CRC_TABLE = (function(){
  var tbl = [];
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) { c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); }
    tbl[n] = c >>> 0;
  }
  return tbl;
})();
function crc32(buf){
  var crc = 0xFFFFFFFF, view = new Uint8Array(buf);
  for (var i = 0; i < view.length; i++) { crc = CRC_TABLE[(crc ^ view[i]) & 0xFF] ^ (crc >>> 8); }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
/* DOS date/time packing for ZIP headers (local time, 2-second steps). */
function dosDateTime(d){
  var time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((Math.floor(d.getSeconds() / 2)) & 31);
  var date = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
  return { time: time, date: date };
}
/* Build a stored (method 0) ZIP blob from [{name, blob}]. Names here are
 * ASCII (dokit-WxH-N.ext), so no UTF-8 flag is needed. */
function buildZip(files){
  return Promise.all(files.map(function(f){
    return f.blob.arrayBuffer().then(function(buf){ return { name: f.name, buf: buf }; });
  })).then(function(items){
    var parts = [], central = [], offset = 0, now = dosDateTime(new Date());
    items.forEach(function(it){
      var nb = [];
      for (var i = 0; i < it.name.length; i++) { nb.push(it.name.charCodeAt(i) & 0xFF); }
      var crc = crc32(it.buf), size = it.buf.byteLength;
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0, true);
      lh.setUint16(8, 0, true);
      lh.setUint16(10, now.time, true);
      lh.setUint16(12, now.date, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, size, true);
      lh.setUint32(22, size, true);
      lh.setUint16(26, nb.length, true);
      lh.setUint16(28, 0, true);
      parts.push(lh.buffer, new Uint8Array(nb).buffer, it.buf);
      central.push({ nb: nb, crc: crc, size: size, offset: offset, time: now.time, date: now.date });
      offset += 30 + nb.length + size;
    });
    var cdStart = offset, cdParts = [];
    central.forEach(function(e){
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0, true);
      ch.setUint16(10, 0, true);
      ch.setUint16(12, e.time, true);
      ch.setUint16(14, e.date, true);
      ch.setUint32(16, e.crc, true);
      ch.setUint32(20, e.size, true);
      ch.setUint32(24, e.size, true);
      ch.setUint16(28, e.nb.length, true);
      ch.setUint16(30, 0, true);
      ch.setUint16(32, 0, true);
      ch.setUint16(34, 0, true);
      ch.setUint16(36, 0, true);
      ch.setUint32(38, 0, true);
      ch.setUint32(42, e.offset, true);
      cdParts.push(ch.buffer, new Uint8Array(e.nb).buffer);
    });
    var cdSize = cdParts.reduce(function(s, b){ return s + b.byteLength; }, 0);
    var eocd = new DataView(new ArrayBuffer(22));
    eocd.setUint32(0, 0x06054b50, true);
    eocd.setUint16(4, 0, true);
    eocd.setUint16(6, 0, true);
    eocd.setUint16(8, central.length, true);
    eocd.setUint16(10, central.length, true);
    eocd.setUint32(12, cdSize, true);
    eocd.setUint32(16, cdStart, true);
    eocd.setUint16(20, 0, true);
    return new Blob(parts.concat(cdParts, [eocd.buffer]), { type: 'application/zip' });
  });
}
/* Sample the background colour from a source image's corners: average a
 * 3x3 block at each corner, then take the most common corner colour
 * (plain backgrounds agree in 3-4 corners; a stray object in one corner
 * cannot outvote them). Drawn small (max 200px) — sampling needs
 * colours, not pixels. Works for <img> and <canvas> sources. */
function sampleBgColor(src){
  var sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
  if (!sw || !sh) { return null; }
  var sc = Math.min(1, 200 / Math.max(sw, sh));
  var c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * sc)); c.height = Math.max(1, Math.round(sh * sc));
  var ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0, c.width, c.height);
  function corner(x, y){
    var d;
    try { d = ctx.getImageData(Math.max(0, Math.min(c.width - 3, x)), Math.max(0, Math.min(c.height - 3, y)), 3, 3).data; }
    catch (e) { return null; }
    var r = 0, g = 0, b = 0, n = 0;
    for (var i = 0; i < d.length; i += 4) { if (d[i + 3] > 0) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } }
    return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : null;
  }
  var corners = [corner(0, 0), corner(c.width - 3, 0), corner(0, c.height - 3), corner(c.width - 3, c.height - 3)].filter(Boolean);
  if (!corners.length) { return null; }
  var best = corners[0], bestN = 0;
  corners.forEach(function(col){
    var n = corners.filter(function(o){ return o[0] === col[0] && o[1] === col[1] && o[2] === col[2]; }).length;
    if (n > bestN) { bestN = n; best = col; }
  });
  return best;
}
/* Clear pixels matching the sampled background within tolerance
 * (per-channel max difference — the same "tolerance" intuition as the
 * old tool's slider). Already-transparent pixels are left untouched,
 * so contain-fit pads survive. */
function removeBgFromCanvas(canvas, src, tol){
  var bg = sampleBgColor(src);
  if (!bg) { return; }
  var ctx = canvas.getContext('2d'), img;
  try { img = ctx.getImageData(0, 0, canvas.width, canvas.height); }
  catch (e) { return; }
  var d = img.data;
  for (var i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) { continue; }
    if (Math.max(Math.abs(d[i] - bg[0]), Math.abs(d[i + 1] - bg[1]), Math.abs(d[i + 2] - bg[2])) <= tol) { d[i + 3] = 0; }
  }
  ctx.putImageData(img, 0, 0);
}
// ---------- Image Resizer ----------
var rz = $('rz-file');
if(rz){
  var img = null, imgs = [], note = $('rz-note'), res = $('rz-result');
  rz.addEventListener('change', function(){
    var files = Array.prototype.slice.call(rz.files || [], 0, 10);
    if(!files.length) return;
    var loaded = [];
    var done = 0;
    files.forEach(function(f, idx){
      loadImage(f).then(function(im){
        guardMP(im, note);
        loaded[idx] = { file: f, img: im };
        if(++done === files.length){
          imgs = loaded.filter(function(x){ return !!x; });
          img = imgs.length ? imgs[0].img : null;
          if(img){ $('rz-w').value = img.naturalWidth; $('rz-h').value = img.naturalHeight; }
          res.innerHTML = ''; var p = document.createElement('p');
          p.textContent = imgs.length + (window.dkT ? window.dkT('rsv_1375', ' images loaded') : ' images loaded');
          res.appendChild(p);
        }
      }).catch(function(e){ err(res, e.message); });
    });
  });
  var lock = $('rz-lock'), wIn = $('rz-w'), hIn = $('rz-h'), pct = $('rz-pct'), mode = $('rz-mode');
  function syncPct(){
    if(!img) return;
    if(mode.value === 'percent'){ var p = parseFloat(pct.value) || 100; wIn.value = Math.round(img.naturalWidth * p / 100); hIn.value = Math.round(img.naturalHeight * p / 100); }
  }
  if(mode){ mode.addEventListener('change', function(){ var pm = $('rz-pct-wrap'); if(pm){ pm.style.display = mode.value === 'percent' ? '' : 'none'; } syncPct(); }); }
  if(pct){ pct.addEventListener('input', syncPct); }
  if(wIn){ wIn.addEventListener('input', function(){ if(lock && lock.checked && img){ hIn.value = Math.round(wIn.value * img.naturalHeight / img.naturalWidth); } }); }
  if(hIn){ hIn.addEventListener('input', function(){ if(lock && lock.checked && img){ wIn.value = Math.round(hIn.value * img.naturalWidth / img.naturalHeight); } }); }
  /* Rotate/flip (item 73): builds a transformed source canvas first, so
   * the fit pipeline below runs unchanged on the rotated/flipped image. */
  function rotatedSource(im){
    var rot = parseInt(($('rz-rot') || {}).value || '0', 10) || 0;
    var fh = !!($('rz-flip-h') || {}).checked, fv = !!($('rz-flip-v') || {}).checked;
    if(!rot && !fh && !fv) return im;
    var swap = (rot === 90 || rot === 270);
    var rc = document.createElement('canvas');
    rc.width = swap ? im.naturalHeight : im.naturalWidth;
    rc.height = swap ? im.naturalWidth : im.naturalHeight;
    var rctx = rc.getContext('2d');
    rctx.translate(rc.width / 2, rc.height / 2);
    rctx.rotate(rot * Math.PI / 180);
    rctx.scale(fh ? -1 : 1, fv ? -1 : 1);
    rctx.drawImage(im, -im.naturalWidth / 2, -im.naturalHeight / 2);
    rc.naturalWidth = rc.width; rc.naturalHeight = rc.height;
    return rc;
  }
  var bgSel = $('rz-bg');
  if(bgSel){ bgSel.addEventListener('change', function(){ var cw = $('rz-bg-color-wrap'); if(cw){ cw.style.display = bgSel.value === 'solid' ? '' : 'none'; } }); }
  /* Background removal controls (parked fix): built here so no page
   * HTML changes are needed. Labels refresh on language change via
   * the same dokit:langchange pattern the word-counter stats use. */
  var bgRow = bgSel ? bgSel.closest('.row') : null;
  var bgChk = null, bgTol = null, bgTolVal = null, bgNote = null, bgChkLabel = null, bgTolLabel = null;
  function syncRzBg(){
    if (bgChkLabel) { bgChkLabel.textContent = (window.dkT ? window.dkT('rsv_1385', 'Auto-remove plain background') : 'Auto-remove plain background'); }
    if (bgTolLabel) { bgTolLabel.textContent = (window.dkT ? window.dkT('rsv_1386', 'Tolerance') : 'Tolerance'); }
    if (bgNote) { bgNote.textContent = (window.dkT ? window.dkT('rsv_1387', 'Heads up: auto removal is color-based, not AI — it works best on plain, single-color backgrounds.') : 'Heads up: auto removal is color-based, not AI — it works best on plain, single-color backgrounds.'); }
  }
  /* Expose for the main.js loader (keyboard.js pattern): tools.js runs
   * before the dict arrives, so initial-load labels need this re-sync. */
  window.syncRzBg = syncRzBg;
  if (bgRow && bgRow.parentNode) {
    var rzRow = document.createElement('div'); rzRow.className = 'row';
    var rzCell = document.createElement('div');
    var rzLab = document.createElement('label');
    bgChk = document.createElement('input'); bgChk.type = 'checkbox'; bgChk.id = 'rz-bg-remove';
    bgChkLabel = document.createElement('span');
    rzLab.appendChild(bgChk); rzLab.appendChild(document.createTextNode(' ')); rzLab.appendChild(bgChkLabel);
    rzCell.appendChild(rzLab);
    var rzCell2 = document.createElement('div');
    bgTolLabel = document.createElement('label'); bgTolLabel.setAttribute('for', 'rz-bg-tol');
    bgTol = document.createElement('input'); bgTol.type = 'range'; bgTol.id = 'rz-bg-tol'; bgTol.min = '0'; bgTol.max = '100'; bgTol.value = '30';
    bgTolVal = document.createElement('span');
    bgTol.addEventListener('input', function(){ if (bgTolVal) { bgTolVal.textContent = bgTol.value; } });
    rzCell2.appendChild(bgTolLabel); rzCell2.appendChild(document.createTextNode(' ')); rzCell2.appendChild(bgTol); rzCell2.appendChild(document.createTextNode(' ')); rzCell2.appendChild(bgTolVal);
    rzRow.appendChild(rzCell); rzRow.appendChild(rzCell2);
    bgRow.parentNode.insertBefore(rzRow, bgRow.nextSibling);
    bgNote = document.createElement('p');
    bgRow.parentNode.insertBefore(bgNote, rzRow.nextSibling);
    bgTolVal.textContent = bgTol.value;
    syncRzBg();
    document.addEventListener('dokit:langchange', syncRzBg);
  }
  var go = $('rz-go');
  if(go){ go.addEventListener('click', function(){
    /* Removal settings for this run (parked fix): checkbox + tolerance
     * slider from the controls built above; sampling stays per image. */
    var removeOn = !!($('rz-bg-remove') || {}).checked;
    var tol = parseInt(($('rz-bg-tol') || {}).value || '30', 10);
    if (isNaN(tol)) { tol = 30; }
    tol = Math.max(0, Math.min(100, tol));
    var list = imgs.length ? imgs : (img ? [{ file: null, img: img }] : []);
    if(!list.length){ err(res, (window.dkT ? window.dkT('rsv_0993', 'Pehle image choose karein.') : 'Pehle image choose karein.')); return; }
    var w = parseInt(wIn.value, 10), h = parseInt(hIn.value, 10);
    if(!w || !h || w < 1 || h < 1){ err(res, (window.dkT ? window.dkT('rsv_1006', 'Sahi width aur height likhein.') : 'Sahi width aur height likhein.')); return; }
    res.innerHTML = '';
    /* ZIP collection (parked fix): batch outputs are gathered as they
     * finish; when every item is done and 2+ succeeded, one ZIP
     * download is offered alongside the individual downloads. */
    var zipItems = [], zipDone = 0;
    function zipTick(){
      if (++zipDone !== list.length) { return; }
      if (zipItems.length < 2) { return; }
      zipItems.sort(function(a, b){ return a.idx - b.idx; });
      var zb = document.createElement('button'); zb.className = 'btn'; zb.id = 'rz-zip'; zb.style.marginTop = '12px'; zb.style.marginLeft = '8px';
      zb.textContent = (window.dkT ? window.dkT('rsv_1383', 'Download all as ZIP') : 'Download all as ZIP');
      zb.addEventListener('click', function(){
        buildZip(zipItems).then(function(zipBlob){ downloadBlob(zipBlob, 'dokit-' + w + 'x' + h + '.zip'); }).catch(function(){ err(res, (window.dkT ? window.dkT('rsv_1384', 'Couldn\'t build the ZIP file. Try downloading images one by one.') : 'Couldn\'t build the ZIP file. Try downloading images one by one.')); });
      });
      res.appendChild(zb);
    }
    list.forEach(function(entry, idx){
    var srcImg = rotatedSource(entry.img);
    var img = srcImg;
    var sc = guardMP(img, note);
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    var sw = img.naturalWidth * sc, sh = img.naturalHeight * sc;
    /* Fit modes (item 72): stretch distorts to exact size (old behaviour);
     * cover scales to fill then centre-crops the overflow; contain scales
     * to fit inside and pads the rest (transparent, or white for JPEG,
     * which has no alpha channel). */
    var fitMode = ($('rz-fit') || {}).value || 'stretch';
    var fmtSelEarly = ($('rz-fmt') || {}).value || 'original';
    /* Background (item 74): solid fills the whole canvas first (pad areas
     * + JPEG flattening); JPEG without a solid colour flattens to white;
     * otherwise the canvas stays transparent. This replaces the item-72
     * contain-only JPEG fill, which would have overwritten a solid colour. */
    var bgMode = ($('rz-bg') || {}).value || 'keep';
    /* Removal skips fills: a solid/white fill would paint over the
     * transparency that removal creates. */
    if (!removeOn) {
      if (bgMode === 'solid') { ctx.fillStyle = ($('rz-bg-color') || {}).value || '#ffffff'; ctx.fillRect(0, 0, w, h); }
      else if (fmtSelEarly === 'jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
    }
    if (fitMode === 'cover') {
      var scCover = Math.max(w / sw, h / sh);
      var dwCover = sw * scCover, dhCover = sh * scCover;
      ctx.drawImage(img, 0, 0, sw, sh, (w - dwCover) / 2, (h - dhCover) / 2, dwCover, dhCover);
    } else if (fitMode === 'contain') {
      var scContain = Math.min(w / sw, h / sh);
      var dwContain = sw * scContain, dhContain = sh * scContain;
      ctx.drawImage(img, 0, 0, sw, sh, (w - dwContain) / 2, (h - dhContain) / 2, dwContain, dhContain);
    } else {
      ctx.drawImage(img, 0, 0, sw, sh, 0, 0, w, h);
    }
    /* Removal pass (parked fix): sample this image's corners, clear
     * matching pixels. Runs after fit so rotate/flip/fit are
     * respected; pads (alpha 0) are untouched. */
    if (removeOn) { removeBgFromCanvas(c, srcImg, tol); }
    var fmtSel = ($('rz-fmt') || {}).value || 'original';
    var type = fmtSel === 'original' ? undefined : 'image/' + fmtSel;
    /* JPEG cannot hold transparency: removal forces PNG output. */
    if (removeOn && fmtSel === 'jpeg') { type = 'image/png'; }
    var outExt = (removeOn && fmtSel === 'jpeg') ? 'png' : (fmtSel === 'original' ? 'png' : fmtSel);
    var q = parseFloat(($('rz-q') || {}).value || '0.9');
    c.toBlob(function(blob){
      if(!blob){ err(res, (window.dkT ? window.dkT('rsv_0999', 'Resize nahi ho saka. Doosri file try karein.') : 'Resize nahi ho saka. Doosri file try karein.')); zipTick(); return; }
      var p = document.createElement('p'); p.textContent = (window.dkT ? window.dkT('rsv_1001', 'Resized: ') : 'Resized: ') + w + '×' + h + ' — ' + fmt(blob.size) + ' (' + (type || (window.dkT ? window.dkT('rsv_1014', 'original format') : 'original format')) + ')'; res.appendChild(p);
      if (removeOn && fmtSel === 'jpeg') { var np = document.createElement('p'); np.textContent = (window.dkT ? window.dkT('rsv_1388', 'Removal keeps transparency — saved as PNG.') : 'Removal keeps transparency — saved as PNG.'); res.appendChild(np); }
      var im2 = document.createElement('img'); im2.src = URL.createObjectURL(blob); im2.alt = (window.dkT ? window.dkT('rsv_1000', 'Resized image preview') : 'Resized image preview'); res.appendChild(im2);
      var d = document.createElement('button'); d.className = 'btn'; d.textContent = (window.dkT ? window.dkT('rsv_0972', 'Download') : 'Download'); d.style.marginTop = '12px';
      var outName = list.length > 1 ? 'dokit-' + w + 'x' + h + '-' + (idx + 1) + '.' + outExt : 'dokit-' + w + 'x' + h + '.' + outExt;
      d.addEventListener('click', function(){ downloadBlob(blob, outName); });
      res.appendChild(d);
      zipItems.push({ idx: idx, name: outName, blob: blob });
      zipTick();
    }, type, q);
    });
  }); }
}
// ---------- Image Compressor ----------
var cpF = $('cp-file');
if(cpF){
  var cimg = null, cres = $('cp-result'), cnote = $('cp-note');
  cpF.addEventListener('change', function(){
    var f = cpF.files[0]; if(!f) return;
    loadImage(f).then(function(im){ cimg = im; guardMP(im, cnote);
      cres.innerHTML = ''; var p = document.createElement('p'); p.textContent = (window.dkT ? window.dkT('rsv_0990', 'Original: ') : 'Original: ') + im.naturalWidth + '×' + im.naturalHeight + ' — ' + fmt(f.size); cres.appendChild(p);
    }).catch(function(e){ err(cres, e.message); });
  });
  var cgo = $('cp-go');
  if(cgo){ cgo.addEventListener('click', function(){
    if(!cimg){ err(cres, (window.dkT ? window.dkT('rsv_0993', 'Pehle image choose karein.') : 'Pehle image choose karein.')); return; }
    var targetSel = ($('cp-target') || {}).value || '100';
    var targetKB = targetSel === 'custom' ? parseFloat(($('cp-custom') || {}).value || '0') : parseFloat(targetSel);
    if(!targetKB || targetKB <= 0){ err(cres, (window.dkT ? window.dkT('rsv_1005', 'Sahi target size (KB) choose karein.') : 'Sahi target size (KB) choose karein.')); return; }
    var target = targetKB * 1024;
    var outFmt = ($('cp-fmt') || {}).value || 'keep';
    var sc = guardMP(cimg, cnote);
    var c = document.createElement('canvas'); c.width = Math.round(cimg.naturalWidth * sc); c.height = Math.round(cimg.naturalHeight * sc);
    c.getContext('2d').drawImage(cimg, 0, 0, c.width, c.height);
    function blobAt(type, q){ return new Promise(function(r){ c.toBlob(function(b){ r(b); }, type, q); }); }
    (async function(){
      var type = 'image/jpeg';
      if(outFmt === 'webp') type = 'image/webp';
      else if(outFmt === 'keep'){ type = 'image/jpeg'; }
      var lo = 0.05, hi = 0.95, best = null;
      for(var i = 0; i < 8; i++){
        var mid = (lo + hi) / 2; var b = await blobAt(type, mid);
        if(!b) break; best = {blob: b, q: mid};
        if(b.size <= target){ lo = mid; } else { hi = mid; }
      }
      if(!best){ err(cres, (window.dkT ? window.dkT('rsv_0963', 'Compress nahi ho saka.') : 'Compress nahi ho saka.')); return; }
      cres.innerHTML = '';
      var p = document.createElement('p');
      var ext = type.split('/')[1];
      if(best.blob.size <= target){ p.textContent = (window.dkT ? window.dkT('rsv_0971', 'Done! ') : 'Done! ') + fmt(best.blob.size) + (window.dkT ? window.dkT('rsv_0938', ' (target ') : ' (target ') + targetKB + (window.dkT ? window.dkT('rsv_0943', ' KB, quality ') : ' KB, quality ') + Math.round(best.q * 100) + '%)'; }
      else { p.textContent = (window.dkT ? window.dkT('rsv_0961', 'Closest possible: ') : 'Closest possible: ') + fmt(best.blob.size) + (window.dkT ? window.dkT('rsv_0937', ' (still above the ') : ' (still above the ') + targetKB + (window.dkT ? window.dkT('rsv_0940', ' KB target — try resizing smaller or using WebP).') : ' KB target — try resizing smaller or using WebP).'); }
      cres.appendChild(p);
      var im2 = document.createElement('img'); im2.src = URL.createObjectURL(best.blob); im2.alt = (window.dkT ? window.dkT('rsv_0964', 'Compressed image preview') : 'Compressed image preview'); cres.appendChild(im2);
      var d = document.createElement('button'); d.className = 'btn'; d.textContent = (window.dkT ? window.dkT('rsv_0972', 'Download') : 'Download'); d.style.marginTop = '12px';
      d.addEventListener('click', function(){ downloadBlob(best.blob, 'dokit-compressed.' + ext); });
      cres.appendChild(d);
    })();
  }); }
}
// ---------- Image Converter ----------
var cvF = $('cv-files');
if(cvF){
  var list = $('cv-list');
  cvF.addEventListener('change', function(){
    list.innerHTML = '';
    var files = Array.prototype.slice.call(cvF.files || []).slice(0, 10);
    if(cvF.files.length > 10){ var w = document.createElement('p'); w.textContent = (window.dkT ? window.dkT('rsv_0987', 'Note: aik waqt me 10 files tak — pehli 10 li gayi hain.') : 'Note: aik waqt me 10 files tak — pehli 10 li gayi hain.'); list.appendChild(w); }
    files.forEach(function(f){
      var li = document.createElement('li');
      var sp = document.createElement('span'); sp.textContent = f.name + ' (' + fmt(f.size) + ')'; li.appendChild(sp);
      var b = document.createElement('button'); b.className = 'btn ghost'; b.textContent = (window.dkT ? window.dkT('rsv_0965', 'Convert & Download') : 'Convert & Download');
      b.addEventListener('click', function(){
        loadImage(f).then(function(im){
          var sc = guardMP(im, null);
          var c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          var fmtSel = ($('cv-fmt') || {}).value || 'webp';
          c.toBlob(function(blob){
            if(!blob){ b.textContent = (window.dkT ? window.dkT('rsv_0975', 'Failed — dobara try karein') : 'Failed — dobara try karein'); return; }
            var base = f.name.replace(/\.[^.]+$/, '');
            downloadBlob(blob, base + '.' + fmtSel); b.textContent = (window.dkT ? window.dkT('rsv_0973', 'Downloaded ✓') : 'Downloaded ✓');
          }, 'image/' + fmtSel, 0.9);
        }).catch(function(e){ b.textContent = e.message; });
      });
      li.appendChild(b); list.appendChild(li);
    });
  });
}
})();
