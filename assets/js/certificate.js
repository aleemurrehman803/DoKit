/* DoKit — certificate from device-local results (restore).
 * Typing sheet (data-kind="Test"): professional premium sheet —
 * CERTIFICATE OF TYPING PROFICIENCY. Shows ONE actual best test (highest
 * net WPM, ties by accuracy then latest), never a composite of maxima
 * from different tests; net WPM prominent, gross WPM / duration /
 * language only when the stored result carries them (older results show
 * an em-dash, never an invented value); historical grades with a printed
 * grade scale; the professional certification statement; mandatory full
 * name (min 2 chars); frozen DK-YYYY-XXXXXX registration; QR code +
 * verification link; gold seal; name-initial placeholder; signature
 * areas. Practice previews stay clearly marked: only a signed-in issued
 * certificate is verifiable. The record lives in this browser's
 * localStorage so the registration stays stable across views and prints.
 * Battle sheet (data-kind="battle"): TypeFight certificate flow (Task 4) —
 * device-local sequential serial DK-YYYY-NNNNNN (frozen at first creation,
 * stats follow the newest battle result), genuine A4 PDF via jsPDF
 * (historical typefight-pdf.js layout, current /DoKit/ verify URL), and a
 * ?id= single-certificate view (issued document by id, or device record
 * by serial). The PDF button hides when jsPDF did not load (historical
 * rule) instead of pretending to generate a PDF.
 * NOT restored, deliberately: the historical global serial counter
 * (Firestore transaction on config/cert_counter) and the SHA256 signature
 * scheme — the counter needs a production collection + rules change
 * (out of scope here) and the old source itself admits its client-side
 * salt makes signatures forgeable, so neither is presented as secure
 * verification. Device serials are unique within this browser only. */
(function () {
  'use strict';
  var sheet = document.getElementById('cert-filled'); // sheet carries data-kind; #cert-sheet never existed
  if (!sheet) { return; }
  var kind = sheet.getAttribute('data-kind') || 'Test';
  var nameInput = document.getElementById('cert-name');
  var empty = document.getElementById('cert-empty');
  var filled = document.getElementById('cert-filled');
  var nameNote = document.getElementById('cert-name-note');
  var printBtn = document.getElementById('cert-print');
  var pdfBtn = document.getElementById('cert-pdf');
  // Historical registration alphabet (no I/O/0/1 lookalikes).
  var REG_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var VERIFY_BASE = 'https://aleemurrehman803.github.io/DoKit/typing/verify/?reg=';
  var QR_API = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=';
  // TypeFight (Task 4): current verify route + single-view QR size.
  var TF_VERIFY_BASE = 'https://aleemurrehman803.github.io/DoKit/typefight/verify/?id=';
  var TF_VERIFY_PAGE = 'aleemurrehman803.github.io/DoKit/typefight/verify/';
  var TF_QR_API = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=';
  function pick() {
    try {
      if (!window.DK2) { return null; }
      var results = window.DK2.getResults() || [];
      for (var i = 0; i < results.length; i++) {
        var r = results[i];
        if (kind === 'battle' ? r.type === 'battle' : r.kind === 'Test') { return r; }
      }
    } catch (e) {}
    return null;
  }
  function bests() {
    // Historical rule: best WPM and best accuracy are independent maxima
    // across matching results, not necessarily from one single result.
    // Used ONLY to detect whether any result exists; the typing sheet
    // displays bestTest(), never this composite.
    try {
      if (!window.DK2) { return null; }
      var results = window.DK2.getResults() || [];
      var bw = 0, ba = -1, any = false;
      for (var i = 0; i < results.length; i++) {
        var r = results[i];
        if (kind === 'battle' ? r.type === 'battle' : r.kind === 'Test') {
          any = true;
          if (typeof r.wpm === 'number' && r.wpm > bw) { bw = r.wpm; }
          if (typeof r.acc === 'number' && r.acc > ba) { ba = r.acc; }
        }
      }
      return any ? { wpm: bw, acc: ba } : null;
    } catch (e) {}
    return null;
  }
  function bestTest() {
    // Professional rule: ONE actual test result — highest net WPM,
    // ties broken by accuracy, then by latest date. Never a composite
    // of maxima from different tests.
    try {
      if (!window.DK2) { return null; }
      var results = window.DK2.getResults() || [];
      var best = null;
      for (var i = 0; i < results.length; i++) {
        var r = results[i];
        if (r.kind !== 'Test') { continue; }
        if (!best) { best = r; continue; }
        var bw = (typeof best.wpm === 'number') ? best.wpm : 0;
        var rw = (typeof r.wpm === 'number') ? r.wpm : 0;
        var ba = (typeof best.acc === 'number') ? best.acc : -1;
        var ra = (typeof r.acc === 'number') ? r.acc : -1;
        if (rw > bw || (rw === bw && ra > ba)
            || (rw === bw && ra === ba && (r.date || '') > (best.date || ''))) { best = r; }
      }
      return best;
    } catch (e) {}
    return null;
  }
  function gradeFor(wpm, acc) {
    // Historical thresholds (TypeMaster certificate build).
    if (wpm >= 60 && acc >= 97) { return 'Distinction'; }
    if (wpm >= 40 && acc >= 95) { return 'Merit'; }
    if (wpm >= 25 && acc >= 90) { return 'Pass'; }
    return 'Participant';
  }
  function set(id, val) {
    var el = document.getElementById(id);
    if (el) { el.textContent = val; }
  }
  function rand6() {
    var out = '', i;
    try {
      var cryptoObj = window.crypto || window.msCrypto;
      var buf = new Uint32Array(6);
      cryptoObj.getRandomValues(buf);
      for (i = 0; i < 6; i++) { out += REG_ALPHABET.charAt(buf[i] % REG_ALPHABET.length); }
    } catch (e) {
      for (i = 0; i < 6; i++) { out += REG_ALPHABET.charAt(Math.floor(Math.random() * REG_ALPHABET.length)); }
    }
    return out;
  }
  function recordKey() {
    return 'dk_cert_' + (kind === 'battle' ? 'battle' : 'Test');
  }
  function loadRecord() {
    try {
      var raw = window.localStorage.getItem(recordKey());
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function saveRecord(rec) {
    try { window.localStorage.setItem(recordKey(), JSON.stringify(rec)); } catch (e) {}
  }
  // --- TypeFight serials (Task 4) -------------------------------------
  // Historical format DK-YYYY-NNNNNN, sequential. The historical global
  // sequence came from a Firestore transaction; this counter is
  // device-local only (see file header), so a serial is unique within
  // this browser, not globally. The serial freezes at first creation;
  // the record's stats follow the newest battle result.
  function nextTfSerial() {
    var year = new Date().getFullYear();
    var key = 'dk_tf_serial_seq_' + year;
    var seq = 0;
    try { seq = parseInt(window.localStorage.getItem(key) || '0', 10) || 0; } catch (e) {}
    seq += 1;
    try { window.localStorage.setItem(key, String(seq)); } catch (e) {}
    return 'DK-' + year + '-' + String(seq).padStart(6, '0');
  }
  // Historical kind labels (typefight-cert.js page labels).
  function tfKindLabel(k) {
    if (k === 'battle_win') { return 'Battle victory'; }
    if (k === 'wpm_milestone') { return '60+ WPM milestone'; }
    return 'Achievement';
  }
  // Historical kind labels (typefight-pdf.js PDF labels).
  function tfPdfKindLabel(k) {
    if (k === 'battle_win') { return 'Battle Victory'; }
    if (k === 'wpm_milestone') { return 'Typing Excellence — 60+ WPM'; }
    return 'Typing Achievement';
  }
  // --- TypeFight A4 PDF (Task 4, faithful port of typefight-pdf.js) ----
  // Exposed only on battle pages. cert: { username, wpm, accuracy, date,
  // kind, serial }; certId: document id (issued) or serial (device).
  // Rejects when jsPDF did not load; the caller hides the button then.
  function tfQrDataUrl(url) {
    var qrApi = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=4&data=' +
      encodeURIComponent(url);
    return fetch(qrApi).then(function (r) {
      if (!r.ok) { var qerr = 'qr http ' + r.status; throw new Error(qerr); }
      return r.blob();
    }).then(function (blob) {
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.onerror = function () { var rerr = 'qr read'; reject(new Error(rerr)); };
        fr.readAsDataURL(blob);
      });
    }).catch(function () { return null; });
  }
  function tfGenerate(cert, certId) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      var libErr = 'PDF library not loaded';
      return Promise.reject(new Error(libErr));
    }
    var verifyUrl = TF_VERIFY_BASE + certId;
    return tfQrDataUrl(verifyUrl).then(function (qrImg) {
      var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      var W = 210, H = 297;
      var brand = [108, 76, 241]; // DoKit purple #6C4CF1
      var ink = [30, 30, 40];
      var muted = [110, 110, 125];
      doc.setDrawColor(brand[0], brand[1], brand[2]);
      doc.setLineWidth(1.6);
      doc.rect(8, 8, W - 16, H - 16);
      doc.setLineWidth(0.5);
      doc.rect(12, 12, W - 24, H - 24);
      var cx = W / 2;
      var y = 34;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(brand[0], brand[1], brand[2]);
      doc.text('DoKit  •  TypeFight', cx, y, { align: 'center' });
      y += 14;
      doc.setFontSize(30);
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text('Certificate of Achievement', cx, y, { align: 'center' });
      y += 10;
      doc.setDrawColor(brand[0], brand[1], brand[2]);
      doc.setLineWidth(0.8);
      doc.line(cx - 45, y, cx + 45, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text('This certificate is proudly presented to', cx, y, { align: 'center' });
      y += 13;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text(String(cert.username).slice(0, 30), cx, y, { align: 'center' });
      y += 13;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(13);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text('for outstanding performance in', cx, y, { align: 'center' });
      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(brand[0], brand[1], brand[2]);
      doc.text(tfPdfKindLabel(cert.kind), cx, y, { align: 'center' });
      y += 14;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text(cert.wpm + ' WPM', cx - 32, y, { align: 'center' });
      doc.text(cert.accuracy + '% accuracy', cx + 32, y, { align: 'center' });
      y += 14;
      doc.setFont('courier', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text('Reg. No: ' + cert.serial, cx, y, { align: 'center' });
      y += 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text('Issue date: ' + cert.date, cx, y, { align: 'center' });
      y += 18;
      if (qrImg) {
        try { doc.addImage(qrImg, 'PNG', cx - 22, y, 44, 44); } catch (e) { qrImg = null; }
      }
      if (qrImg) { y += 50; }
      doc.setFontSize(10);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text('Scan to verify, or enter the registration number at:', cx, y, { align: 'center' });
      y += 6;
      doc.setTextColor(brand[0], brand[1], brand[2]);
      doc.text(TF_VERIFY_PAGE, cx, y, { align: 'center' });
      y += 20;
      doc.setDrawColor(ink[0], ink[1], ink[2]);
      doc.setLineWidth(0.4);
      doc.line(cx - 40, y, cx + 40, y);
      y += 6;
      doc.setFontSize(10);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text('DoKit TypeFight', cx, y, { align: 'center' });
      doc.setFontSize(8);
      doc.text('Virtual achievement — no cash value.', cx, H - 20, { align: 'center' });
      var safeName = String(cert.username).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 24) || 'fighter';
      doc.save('DoKit-TypeFight-Certificate-' + cert.serial + '-' + safeName + '.pdf');
    });
  }
  if (kind === 'battle') { window.TFPdf = { generate: tfGenerate }; }
  // --- TypeFight ?id= single view (Task 4) ------------------------------
  // Issued documents are addressed by document id; device records are
  // addressed by their serial. Firestore-first, device fallback — the
  // same order as the Verify page. Cloud lookup waits briefly for
  // account.js (a later defer script) to define window.DKA.
  var singleShown = null;
  var singleDone = false;
  var singleRetry = false;
  function showSingleCert(c, id) {
    singleDone = true;
    var nm = c.name || c.username || '—';
    var dt = c.date || (c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : '—');
    var sr = c.serial || '—';
    var detail = tfKindLabel(c.kind) + ' — ' + (c.wpm || 0) + ' WPM · ' + (c.acc || 0) + '% accuracy';
    set('tf-single-name', nm);
    set('tf-single-detail', detail);
    set('tf-single-serial', sr);
    set('tf-single-date', dt);
    set('tf-single-id', id);
    var url = TF_VERIFY_BASE + id;
    var qr = document.getElementById('tf-single-qr');
    if (qr) { qr.src = TF_QR_API + encodeURIComponent(url); }
    var lk = document.getElementById('tf-single-link');
    if (lk) { lk.href = url; lk.textContent = url; }
    singleShown = { id: id, username: nm, wpm: c.wpm || 0, accuracy: c.acc || 0, date: dt, kind: c.kind || 'battle', serial: sr };
    var sPdf = document.getElementById('tf-single-pdf');
    if (sPdf) { sPdf.hidden = !window.jspdf; }
  }
  function singleNotFound() {
    singleDone = true;
    var nf = document.getElementById('tf-single-notfound');
    if (nf) {
      nf.hidden = false;
      nf.textContent = (window.dkT ? window.dkT('acct_cert_nf', 'No matching certificate found for this number.') : 'No matching certificate found for this number.');
    }
    var sPdf = document.getElementById('tf-single-pdf');
    if (sPdf) { sPdf.hidden = true; }
  }
  function runSingleLookup(qid) {
    if (singleDone) { return; }
    var db = null;
    try { db = (window.DKA && DKA.db) ? DKA.db() : null; } catch (e) {}
    function fromLocal() {
      var loc = loadRecord();
      if (loc && loc.serial && loc.serial === qid.toUpperCase()) { showSingleCert(loc, loc.serial); return true; }
      return false;
    }
    if (!db) {
      if (fromLocal()) { return; }
      // Cloud not ready yet: one bounded retry, then report not found.
      if (!singleRetry) {
        singleRetry = true;
        setTimeout(function () { runSingleLookup(qid); }, 2000);
      } else {
        singleNotFound();
      }
      return;
    }
    db.collection('certificates').doc(qid).get().then(function (snap) {
      if (singleDone) { return; }
      var d = null;
      if (snap.exists) { d = snap.data() || {}; if (d.kind !== 'battle') { d = null; } }
      if (d) { showSingleCert(d, qid); return; }
      if (!fromLocal()) { singleNotFound(); }
    }).catch(function () {
      if (singleDone) { return; }
      if (!fromLocal()) { singleNotFound(); }
    });
  }
  function render() {
    var b = bests();
    if (!b) {
      if (empty) { empty.hidden = false; }
      if (filled) { filled.hidden = true; }
      if (nameNote) { nameNote.hidden = true; }
      if (kind === 'battle' && pdfBtn) { pdfBtn.hidden = true; }
      return;
    }
    if (kind === 'battle') {
      // TypeFight practice sheet: newest battle result, plus the frozen
      // device serial. Stats follow the newest result; serial + issue
      // date freeze at first creation (see nextTfSerial).
      var r = pick();
      if (!r) {
        if (empty) { empty.hidden = false; }
        if (filled) { filled.hidden = true; }
        if (pdfBtn) { pdfBtn.hidden = true; }
        return;
      }
      if (empty) { empty.hidden = true; }
      if (filled) { filled.hidden = false; }
      var bname = (nameInput && nameInput.value.trim()) || '—';
      var rec = loadRecord();
      if (!rec || !rec.serial) {
        rec = { serial: nextTfSerial(), kind: 'battle', name: bname, wpm: r.wpm, acc: r.acc, issuedAt: Date.now() };
      } else {
        rec.name = bname;
        rec.wpm = r.wpm;
        rec.acc = r.acc;
      }
      saveRecord(rec);
      set('cert-name-out', bname);
      set('cert-wpm', r.wpm + ' WPM');
      set('cert-acc', r.acc + (window.dkT ? window.dkT('rsv_1047', '% accuracy') : '% accuracy'));
      var bd = r.date ? new Date(r.date) : new Date();
      set('cert-date', bd.toLocaleDateString());
      var bref = 'DK-' + bd.getFullYear()
        + String(bd.getMonth() + 1).padStart(2, '0')
        + String(bd.getDate()).padStart(2, '0') + '-'
        + String(bd.getHours()).padStart(2, '0')
        + String(bd.getMinutes()).padStart(2, '0');
      set('cert-ref', bref);
      set('cert-serial', rec.serial);
      set('cert-photo', bname.charAt(0).toUpperCase());
      var tfVerifyUrl = 'https://aleemurrehman803.github.io/DoKit/typefight/verify/?serial=' + rec.serial;
      var tfQr = document.getElementById('cert-qr');
      if (tfQr) { tfQr.src = TF_QR_API + encodeURIComponent(tfVerifyUrl); }
      var tfVl = document.getElementById('cert-verify-link');
      if (tfVl) { tfVl.href = tfVerifyUrl; tfVl.textContent = tfVerifyUrl; }
      // Genuine PDF only when jsPDF loaded (historical rule); otherwise
      // the button hides instead of opening a print dialog.
      if (pdfBtn) { pdfBtn.hidden = !window.jspdf; }
      return;
    }
    // Typing sheet: full name (min 2 chars) is mandatory before the
    // certificate is shown (historical profile rule).
    var name = (nameInput && nameInput.value.trim()) || '';
    if (name.length < 2) {
      if (empty) { empty.hidden = true; }
      if (filled) { filled.hidden = true; }
      if (nameNote) { nameNote.hidden = false; }
      return;
    }
    if (nameNote) { nameNote.hidden = true; }
    if (empty) { empty.hidden = true; }
    if (filled) { filled.hidden = false; }
    // Professional certificate: the sheet shows ONE actual test — the
    // best test (see bestTest) — not a composite of maxima from
    // different tests. Frozen registration: created once; the name
    // refreshes; displayed stats always follow the current best test.
    var t = bestTest();
    if (!t) { return; }
    var rec2 = loadRecord();
    if (!rec2 || !rec2.regNo) {
      rec2 = { regNo: 'DK-' + new Date().getFullYear() + '-' + rand6(), kind: 'typing', name: name, wpm: t.wpm, acc: t.acc, issuedAt: Date.now() };
    } else {
      rec2.name = name;
      rec2.wpm = t.wpm;
      rec2.acc = t.acc;
    }
    saveRecord(rec2);
    set('cert-name-out', rec2.name);
    set('cert-photo', rec2.name.charAt(0).toUpperCase());
    set('cert-wpm', t.wpm + ' WPM');
    set('cert-acc', t.acc + (window.dkT ? window.dkT('rsv_1047', '% accuracy') : '% accuracy'));
    // New fields are shown ONLY when the stored result carries them.
    // Older results predate gross/duration/language: they show an
    // em-dash, never a calculated or invented value.
    set('cert-gross', (typeof t.gross === 'number') ? t.gross + ' WPM' : '—');
    set('cert-duration', (typeof t.durationSec === 'number') ? t.durationSec + ' seconds' : '—');
    var langNames = { en: 'English' };
    set('cert-language', t.language ? (langNames[t.language] || t.language) : '—');
    set('cert-date', new Date(rec2.issuedAt).toLocaleDateString());
    set('cert-ref', rec2.regNo);
    set('cert-ref-label', 'Reference:');
    set('cert-grade', gradeFor(t.wpm, t.acc));
    var verifyUrl = VERIFY_BASE + rec2.regNo;
    var qr = document.getElementById('cert-qr');
    if (qr) { qr.src = QR_API + encodeURIComponent(verifyUrl); }
    var vl = document.getElementById('cert-verify-link');
    if (vl) { vl.href = verifyUrl; vl.textContent = verifyUrl; }
  }
  if (nameInput) { nameInput.addEventListener('input', render); }
  if (printBtn) { printBtn.addEventListener('click', function () { window.print(); }); }
  if (pdfBtn) {
    if (kind === 'battle') {
      // Practice-sheet PDF: generates from the frozen-serial record.
      pdfBtn.addEventListener('click', function () {
        var rec = loadRecord();
        if (!rec || !window.TFPdf) { return; }
        window.TFPdf.generate(
          { username: rec.name, wpm: rec.wpm, accuracy: rec.acc, date: new Date(rec.issuedAt).toLocaleDateString(), kind: rec.kind, serial: rec.serial },
          rec.serial).catch(function () { try { window.DKUI && DKUI.toast && DKUI.toast('PDF failed — try Print instead'); } catch (e) {} });
      });
    } else {
      pdfBtn.addEventListener('click', function () { window.print(); });
    }
  }
  // Single view (?id=) replaces the practice sheet on battle pages.
  if (kind === 'battle') {
    var single = document.getElementById('tf-single');
    var qid = null;
    try { qid = new URLSearchParams(window.location.search).get('id'); } catch (e) {}
    if (qid && single) {
      var practice = document.getElementById('cert-practice');
      if (practice) { practice.hidden = true; }
      var issueBox = document.getElementById('cert-issue-box');
      if (issueBox) { issueBox.hidden = true; }
      single.hidden = false;
      var sp = document.getElementById('tf-single-print');
      if (sp) { sp.addEventListener('click', function () { window.print(); }); }
      var sPdf = document.getElementById('tf-single-pdf');
      if (sPdf) {
        sPdf.hidden = true; // unhidden by showSingleCert only if jsPDF loaded
        sPdf.addEventListener('click', function () {
          if (singleShown && window.TFPdf) { window.TFPdf.generate(singleShown, singleShown.id).catch(function () { try { window.DKUI && DKUI.toast && DKUI.toast('PDF failed — try Print instead'); } catch (e) {} }); }
        });
      }
      var tries = 0;
      (function waitDka() {
        if (singleDone) { return; }
        if (window.DKA || ++tries > 8) { runSingleLookup(qid); return; }
        setTimeout(waitDka, 250);
      })();
      return;
    }
  }
  render();
})();
