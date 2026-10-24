/* DoKit — Password Generator, Unit Converter, QR Generator (Phase 2b).
 * Three small tools in one file, one commented section each.
 * All run in the browser; nothing is uploaded or stored. */
(function () {
  'use strict';

  // -- Password Generator ----------------------------------------------------
  // Secure randomness: crypto.getRandomValues, never Math.random, because
  // Math.random output is predictable and must never seed passwords.
  var pwOut = document.getElementById('pg-out');
  if (pwOut) {
    var pwLen = document.getElementById('pg-len');
    var pwLenVal = document.getElementById('pg-len-val');
    var pwGen = document.getElementById('pg-gen');
    var pwCopy = document.getElementById('pg-copy');
    var pwBits = document.getElementById('pg-bits');
    var SETS = {
      upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lower: 'abcdefghijklmnopqrstuvwxyz',
      digits: '0123456789',
      symbols: '!@#$%^&*()-_=+[]{};:,.<>?'
    };
    var AMBIG = 'Il1O0'; // confusing look-alikes, removed when opted out
    function pool() {
      var p = '';
      if (document.getElementById('pg-upper').checked) { p += SETS.upper; }
      if (document.getElementById('pg-lower').checked) { p += SETS.lower; }
      if (document.getElementById('pg-digits').checked) { p += SETS.digits; }
      if (document.getElementById('pg-symbols').checked) { p += SETS.symbols; }
      if (document.getElementById('pg-noamb').checked) {
        p = p.split('').filter(function (c) {
          return AMBIG.indexOf(c) === -1;
        }).join('');
      }
      return p;
    }
    function generate() {
      var chars = pool();
      var len = parseInt(pwLen.value, 10) || 16;
      if (!chars) { pwOut.textContent = 'Pick at least one character set.'; return; }
      var buf = new Uint32Array(len);
      window.crypto.getRandomValues(buf);
      var out = '';
      for (var i = 0; i < len; i++) { out += chars[buf[i] % chars.length]; }
      pwOut.textContent = out;
      // Entropy hint: length x log2(pool size), rounded — a guide only.
      var bits = Math.round(len * Math.log(chars.length) / Math.log(2));
      if (pwBits) { pwBits.textContent = 'About ' + bits + ' bits of entropy.'; }
    }
    if (pwLen) {
      pwLen.addEventListener('input', function () {
        if (pwLenVal) { pwLenVal.textContent = pwLen.value; }
      });
    }
    if (pwGen) { pwGen.addEventListener('click', generate); }
    if (pwCopy) {
      pwCopy.addEventListener('click', function () {
        if (pwOut.textContent && navigator.clipboard) {
          navigator.clipboard.writeText(pwOut.textContent);
        }
      });
    }
    generate(); // show a password immediately, so the tool never looks empty
  }

  // -- Unit Converter ---------------------------------------------------------
  // Factors are relative to each category's base unit; temperature is
  // special-cased (offsets, not just a factor) — see convertTemp.
  var ucVal = document.getElementById('uc-val');
  if (ucVal) {
    var CATS = {
      length: { base: 'm', units: {
        m: ['Metre', 1], km: ['Kilometre', 1000], cm: ['Centimetre', 0.01],
        mm: ['Millimetre', 0.001], mi: ['Mile', 1609.344],
        yd: ['Yard', 0.9144], ft: ['Foot', 0.3048], in: ['Inch', 0.0254] } },
      weight: { base: 'kg', units: {
        kg: ['Kilogram', 1], g: ['Gram', 0.001], lb: ['Pound', 0.45359237],
        oz: ['Ounce', 0.028349523125] } },
      area: { base: 'm2', units: {
        m2: ['Square metre', 1], km2: ['Square kilometre', 1000000],
        ha: ['Hectare', 10000], acre: ['Acre', 4046.8564224],
        ft2: ['Square foot', 0.09290304] } },
      volume: { base: 'L', units: {
        L: ['Litre', 1], mL: ['Millilitre', 0.001], m3: ['Cubic metre', 1000],
        gal: ['Gallon (US)', 3.785411784], cup: ['Cup (US)', 0.2365882365] } }
    };
    var ucCat = document.getElementById('uc-cat');
    var ucFrom = document.getElementById('uc-from');
    var ucTo = document.getElementById('uc-to');
    var ucOut = document.getElementById('uc-out');
    // Temperature cannot use factors (Celsius/Fahrenheit/Kelvin have
    // different zero points), so it converts via Celsius explicitly.
    function convertTemp(v, from, to) {
      var c = from === 'C' ? v : from === 'F' ? (v - 32) * 5 / 9 : v - 273.15;
      return to === 'C' ? c : to === 'F' ? c * 9 / 5 + 32 : c + 273.15;
    }
    function fillUnits() {
      var cat = ucCat.value;
      ucFrom.innerHTML = ''; ucTo.innerHTML = '';
      if (cat === 'temperature') {
        [['C', 'Celsius'], ['F', 'Fahrenheit'], ['K', 'Kelvin']].forEach(
          function (u, i) {
            var a = document.createElement('option');
            a.value = u[0]; a.textContent = u[1];
            var b = document.createElement('option');
            b.value = u[0]; b.textContent = u[1];
            ucFrom.appendChild(a); ucTo.appendChild(b);
          });
        ucTo.selectedIndex = 1;
      } else {
        Object.keys(CATS[cat].units).forEach(function (key) {
          var label = CATS[cat].units[key][0];
          var a = document.createElement('option');
          a.value = key; a.textContent = label;
          var b = document.createElement('option');
          b.value = key; b.textContent = label;
          ucFrom.appendChild(a); ucTo.appendChild(b);
        });
        ucTo.selectedIndex = 1;
      }
      convert();
    }
    function convert() {
      var v = parseFloat(ucVal.value);
      if (isNaN(v)) { ucOut.textContent = 'Enter a number.'; return; }
      var cat = ucCat.value, from = ucFrom.value, to = ucTo.value, res;
      if (cat === 'temperature') {
        res = convertTemp(v, from, to);
      } else {
        // Via the base unit: value -> base -> target (two multiplications).
        var inBase = v * CATS[cat].units[from][1];
        res = inBase / CATS[cat].units[to][1];
      }
      ucOut.textContent = v + ' ' + from + ' = '
        + (Math.round(res * 1000000) / 1000000) + ' ' + to;
    }
    ucCat.addEventListener('change', fillUnits);
    ucFrom.addEventListener('change', convert);
    ucTo.addEventListener('change', convert);
    ucVal.addEventListener('input', convert);
    fillUnits();
  }

  // -- QR Generator ------------------------------------------------------------
  // Uses the vendored qrcodejs library (MIT, self-hosted in assets/js/
  // vendor/ — no CDN, nothing uploaded). If the library is missing, the
  // page says so instead of pretending to work.
  var qrText = document.getElementById('qr-text');
  if (qrText) {
    var qrBox = document.getElementById('qr-box');
    var qrSize = document.getElementById('qr-size');
    var qrGen = document.getElementById('qr-gen');
    var qrDl = document.getElementById('qr-dl');
    var qrMsg = document.getElementById('qr-msg');
    qrGen.addEventListener('click', function () {
      var text = qrText.value.trim();
      if (!text) { qrMsg.textContent = 'Type some text or a link first.'; return; }
      if (typeof window.QRCode === 'undefined') {
        qrMsg.textContent = 'QR library could not load. Please reload the page.';
        return;
      }
      qrBox.innerHTML = '';
      var size = parseInt(qrSize.value, 10) || 256;
      // qrcodejs API: new QRCode(element, {text, width, height}).
      new window.QRCode(qrBox, { text: text, width: size, height: size,
        correctLevel: window.QRCode.CorrectLevel.M });
      qrMsg.textContent = 'QR code ready. Download it below.';
      var canvas = qrBox.querySelector('canvas');
      var img = qrBox.querySelector('img');
      if (canvas) {
        qrDl.href = canvas.toDataURL('image/png');
        qrDl.download = 'qrcode.png'; qrDl.style.display = 'inline-block';
      } else if (img) {
        qrDl.href = img.src;
        qrDl.download = 'qrcode.png'; qrDl.style.display = 'inline-block';
      }
    });
  }
})();
