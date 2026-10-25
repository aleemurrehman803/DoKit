/* DoKit — certificate from device-local results (restore). */
(function () {
  'use strict';
  var sheet = document.getElementById('cert-filled'); // sheet carries data-kind; #cert-sheet never existed
  if (!sheet) { return; }
  var kind = sheet.getAttribute('data-kind') || 'Test';
  var nameInput = document.getElementById('cert-name');
  var empty = document.getElementById('cert-empty');
  var filled = document.getElementById('cert-filled');
  var printBtn = document.getElementById('cert-print');
  var pdfBtn = document.getElementById('cert-pdf');
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
  function set(id, val) {
    var el = document.getElementById(id);
    if (el) { el.textContent = val; }
  }
  function render() {
    var r = pick();
    if (!r) {
      if (empty) { empty.hidden = false; }
      if (filled) { filled.hidden = true; }
      return;
    }
    if (empty) { empty.hidden = true; }
    if (filled) { filled.hidden = false; }
    var name = (nameInput && nameInput.value.trim()) || '\u2014';
    set('cert-name-out', name);
    set('cert-wpm', r.wpm + ' WPM');
    set('cert-acc', r.acc + (window.dkT ? window.dkT('rsv_1047', '% accuracy') : '% accuracy'));
    var d = r.date ? new Date(r.date) : new Date();
    set('cert-date', d.toLocaleDateString());
    var ref = 'DK-' + d.getFullYear()
      + String(d.getMonth() + 1).padStart(2, '0')
      + String(d.getDate()).padStart(2, '0') + '-'
      + String(d.getHours()).padStart(2, '0')
      + String(d.getMinutes()).padStart(2, '0');
    set('cert-ref', ref);
  }
  if (nameInput) { nameInput.addEventListener('input', render); }
  if (printBtn) { printBtn.addEventListener('click', function () { window.print(); }); }
  if (pdfBtn) { pdfBtn.addEventListener('click', function () { window.print(); }); }
  render();
})();
