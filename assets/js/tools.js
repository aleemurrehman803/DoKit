
(function(){
function $(id){ return document.getElementById(id); }
function fmt(n){ if(n < 1024) return n + ' B'; if(n < 1048576) return (n/1024).toFixed(1) + ' KB'; return (n/1048576).toFixed(2) + ' MB'; }
function err(el, msg){ el.textContent = msg; el.className = 'err'; }
function okmsg(el, msg){ el.textContent = msg; el.className = 'ok'; }
function downloadBlob(blob, name){ var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function loadImage(file){
  return new Promise(function(res, rej){
    if(file.size > 25 * 1024 * 1024){ rej(new Error('File is larger than 25 MB. Please choose a smaller file.')); return; }
    var url = URL.createObjectURL(file); var img = new Image();
    img.onload = function(){ URL.revokeObjectURL(url); res(img); };
    img.onerror = function(){ URL.revokeObjectURL(url); rej(new Error('This image could not be read. Please choose a PNG, JPG or WebP file.')); };
    img.src = url;
  });
}
function guardMP(img, noteEl){
  var mp = img.naturalWidth * img.naturalHeight / 1000000;
  if(mp > 16){
    var sc = Math.sqrt(16 / mp);
    if(noteEl){ noteEl.textContent = 'Note: image ' + mp.toFixed(1) + 'MP — pre-scaled to 16MP to protect mobile memory.'; noteEl.className = ''; }
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
    rows.forEach(function(r){
      var d = document.createElement('div'); var b = document.createElement('b'); b.textContent = r[0] + ': '; d.appendChild(b); d.appendChild(document.createTextNode(String(r[1]))); out.appendChild(d);
    });
  });
  var cp = $('wc-copy');
  if(cp){ cp.addEventListener('click', function(){ if(navigator.clipboard){ navigator.clipboard.writeText(wc.value); } }); }
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
// ---------- Image Resizer ----------
var rz = $('rz-file');
if(rz){
  var img = null, note = $('rz-note'), res = $('rz-result');
  rz.addEventListener('change', function(){
    var f = rz.files[0]; if(!f) return;
    loadImage(f).then(function(im){ img = im; guardMP(im, note);
      $('rz-w').value = im.naturalWidth; $('rz-h').value = im.naturalHeight;
      res.innerHTML = ''; var p = document.createElement('p'); p.textContent = 'Original: ' + im.naturalWidth + '×' + im.naturalHeight + ' — ' + fmt(f.size); res.appendChild(p);
    }).catch(function(e){ err(res, e.message); });
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
  var go = $('rz-go');
  if(go){ go.addEventListener('click', function(){
    if(!img){ err(res, 'Pehle image choose karein.'); return; }
    var w = parseInt(wIn.value, 10), h = parseInt(hIn.value, 10);
    if(!w || !h || w < 1 || h < 1){ err(res, 'Sahi width aur height likhein.'); return; }
    var sc = guardMP(img, note);
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    var sw = img.naturalWidth * sc, sh = img.naturalHeight * sc;
    ctx.drawImage(img, 0, 0, sw, sh, 0, 0, w, h);
    var fmtSel = ($('rz-fmt') || {}).value || 'original';
    var type = fmtSel === 'original' ? undefined : 'image/' + fmtSel;
    var q = parseFloat(($('rz-q') || {}).value || '0.9');
    c.toBlob(function(blob){
      if(!blob){ err(res, 'Resize nahi ho saka. Doosri file try karein.'); return; }
      res.innerHTML = '';
      var p = document.createElement('p'); p.textContent = 'Resized: ' + w + '×' + h + ' — ' + fmt(blob.size) + ' (' + (type || 'original format') + ')'; res.appendChild(p);
      var im2 = document.createElement('img'); im2.src = URL.createObjectURL(blob); im2.alt = 'Resized image preview'; res.appendChild(im2);
      var d = document.createElement('button'); d.className = 'btn'; d.textContent = 'Download'; d.style.marginTop = '12px';
      d.addEventListener('click', function(){ var ext = fmtSel === 'original' ? 'png' : fmtSel; downloadBlob(blob, 'dokit-' + w + 'x' + h + '.' + ext); });
      res.appendChild(d);
    }, type, q);
  }); }
}
// ---------- Image Compressor ----------
var cpF = $('cp-file');
if(cpF){
  var cimg = null, cres = $('cp-result'), cnote = $('cp-note');
  cpF.addEventListener('change', function(){
    var f = cpF.files[0]; if(!f) return;
    loadImage(f).then(function(im){ cimg = im; guardMP(im, cnote);
      cres.innerHTML = ''; var p = document.createElement('p'); p.textContent = 'Original: ' + im.naturalWidth + '×' + im.naturalHeight + ' — ' + fmt(f.size); cres.appendChild(p);
    }).catch(function(e){ err(cres, e.message); });
  });
  var cgo = $('cp-go');
  if(cgo){ cgo.addEventListener('click', function(){
    if(!cimg){ err(cres, 'Pehle image choose karein.'); return; }
    var targetSel = ($('cp-target') || {}).value || '100';
    var targetKB = targetSel === 'custom' ? parseFloat(($('cp-custom') || {}).value || '0') : parseFloat(targetSel);
    if(!targetKB || targetKB <= 0){ err(cres, 'Sahi target size (KB) choose karein.'); return; }
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
      if(!best){ err(cres, 'Compress nahi ho saka.'); return; }
      cres.innerHTML = '';
      var p = document.createElement('p');
      var ext = type.split('/')[1];
      if(best.blob.size <= target){ p.textContent = 'Done! ' + fmt(best.blob.size) + ' (target ' + targetKB + ' KB, quality ' + Math.round(best.q * 100) + '%)'; }
      else { p.textContent = 'Closest possible: ' + fmt(best.blob.size) + ' (still above the ' + targetKB + ' KB target — try resizing smaller or using WebP).'; }
      cres.appendChild(p);
      var im2 = document.createElement('img'); im2.src = URL.createObjectURL(best.blob); im2.alt = 'Compressed image preview'; cres.appendChild(im2);
      var d = document.createElement('button'); d.className = 'btn'; d.textContent = 'Download'; d.style.marginTop = '12px';
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
    if(cvF.files.length > 10){ var w = document.createElement('p'); w.textContent = 'Note: aik waqt me 10 files tak — pehli 10 li gayi hain.'; list.appendChild(w); }
    files.forEach(function(f){
      var li = document.createElement('li');
      var sp = document.createElement('span'); sp.textContent = f.name + ' (' + fmt(f.size) + ')'; li.appendChild(sp);
      var b = document.createElement('button'); b.className = 'btn ghost'; b.textContent = 'Convert & Download';
      b.addEventListener('click', function(){
        loadImage(f).then(function(im){
          var sc = guardMP(im, null);
          var c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          var fmtSel = ($('cv-fmt') || {}).value || 'webp';
          c.toBlob(function(blob){
            if(!blob){ b.textContent = 'Failed — dobara try karein'; return; }
            var base = f.name.replace(/\.[^.]+$/, '');
            downloadBlob(blob, base + '.' + fmtSel); b.textContent = 'Downloaded ✓';
          }, 'image/' + fmtSel, 0.9);
        }).catch(function(e){ b.textContent = e.message; });
      });
      li.appendChild(b); list.appendChild(li);
    });
  });
}
})();
