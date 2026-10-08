/* DoKit — Unit Converter tool logic (Phase 2, Oct 2026).
 * Pure JS math, live conversion. 100% in-browser. */
"use strict";
!function () {
  function t(k) { return (window.DKI18N && typeof window.DKI18N.t === "function") ? window.DKI18N.t(k) : k; }
  function o(id) { return document.getElementById(id); }

  // Factors are relative to the base unit of each category.
  var CATS = {
    length: { base: "m", units: { mm: 0.001, cm: 0.01, m: 1, km: 1000, inch: 0.0254, foot: 0.3048, mile: 1609.344 } },
    weight: { base: "kg", units: { g: 0.001, kg: 1, oz: 0.028349523125, lb: 0.45359237 } },
    temp: { base: "c", units: { c: 1, f: 1, k: 1 } }, // special-cased below
    data: { base: "mb", units: { kb: 1 / 1024, mb: 1, gb: 1024, tb: 1048576 } }
  };
  var UNIT_LABEL = {
    mm: "mm", cm: "cm", m: "m", km: "km", inch: "inch", foot: "ft", mile: "mi",
    g: "g", kg: "kg", oz: "oz", lb: "lb",
    c: "°C", f: "°F", k: "K",
    kb: "KB", mb: "MB", gb: "GB", tb: "TB"
  };

  var en = {
    "common.skip": "Skip to content", "common.crumb_home": "Home", "common.crumb_tools": "Tools",
    "toolnames.unit": "Unit Converter", "toolnames.qr": "QR Generator", "toolnames.pw": "Password Generator",
    "toolnames.word_counter": "Word Counter",
    "toolnames.desc_qr": "Turn any text or link into a QR code.",
    "toolnames.desc_pw": "Strong random passwords, generated privately.",
    "toolnames.desc_word_counter": "Live word, character, and reading-time stats.",
    "uc.meta_title": "Free Unit Converter Online — Length, Weight, Temperature | DoKit",
    "uc.meta_desc": "Convert length, weight, temperature, and data units instantly in your browser. Free, private — nothing leaves your device.",
    "uc.hero_desc": "Convert length, weight, temperature, and data — live, right in your browser.",
    "uc.privacy": "Everything happens on your device",
    "uc.privacy_line": "Pure math in your browser — 100% private.",
    "uc.category": "Category", "uc.from": "From", "uc.to": "To", "uc.swap": "Swap units",
    "uc.cat_length": "Length", "uc.cat_weight": "Weight", "uc.cat_temp": "Temperature", "uc.cat_data": "Data",
    "uc.step1": "Pick a category", "uc.step2": "Enter a value", "uc.step3": "See it converted live",
    "uc.howto_title": "How to convert units",
    "uc.howto_1t": "Choose a category", "uc.howto_1d": "Length, weight, temperature, or data — the unit lists update automatically.",
    "uc.howto_2t": "Enter your value", "uc.howto_2d": "Type a number and pick the “from” and “to” units. Use ⇄ to swap them.",
    "uc.howto_3t": "Read the result", "uc.howto_3d": "The answer updates live as you type — no buttons needed.",
    "uc.faq_q1": "Does the converter need the internet?",
    "uc.faq_a1": "No. All conversions are pure JavaScript math in your browser — it even works offline once the page is cached.",
    "uc.faq_q2": "Which units are supported?",
    "uc.faq_a2": "Length (mm, cm, m, km, inch, foot, mile), weight (g, kg, oz, lb), temperature (°C, °F, K), and data (KB, MB, GB, TB).",
    "resizer.faq_title": "Frequently asked questions", "resizer.related": "Related tools"
  };
  var ur = {
    "common.skip": "مواد پر جائیں", "common.crumb_home": "ہوم", "common.crumb_tools": "ٹولز",
    "toolnames.unit": "یونٹ کنورٹر", "toolnames.qr": "کیو آر جنریٹر", "toolnames.pw": "پاس ورڈ جنریٹر",
    "toolnames.word_counter": "الفاظ کی گنتی",
    "toolnames.desc_qr": "کسی بھی متن یا لنک کو کیو آر کوڈ بنائیں۔",
    "toolnames.desc_pw": "مضبوط بے ترتیب پاس ورڈ، مکمل نجی طریقے سے۔",
    "toolnames.desc_word_counter": "الفاظ، حروف اور پڑھنے کے وقت کے لائیو اعداد۔",
    "uc.meta_title": "مفت یونٹ کنورٹر — لمبائی، وزن، درجہ حرارت | ڈوکٹ",
    "uc.meta_desc": "لمبائی، وزن، درجہ حرارت اور ڈیٹا کی اکائیاں فوراً تبدیل کریں۔ مفت اور نجی۔",
    "uc.hero_desc": "لمبائی، وزن، درجہ حرارت اور ڈیٹا تبدیل کریں — آپ کے براؤزر میں لائیو۔",
    "uc.privacy": "سب کچھ آپ کے ڈیوائس پر ہوتا ہے",
    "uc.privacy_line": "براؤزر میں خالص حساب — 100% نجی۔",
    "uc.category": "قسم", "uc.from": "از", "uc.to": "تک", "uc.swap": "اکائیاں بدلیں",
    "uc.cat_length": "لمبائی", "uc.cat_weight": "وزن", "uc.cat_temp": "درجہ حرارت", "uc.cat_data": "ڈیٹا",
    "uc.step1": "قسم چنیں", "uc.step2": "قدر لکھیں", "uc.step3": "لائیو نتیجہ دیکھیں",
    "uc.howto_title": "یونٹ کیسے تبدیل کریں",
    "uc.howto_1t": "قسم چنیں", "uc.howto_1d": "لمبائی، وزن، درجہ حرارت یا ڈیٹا — اکائیوں کی فہرست خود بدل جائے گی۔",
    "uc.howto_2t": "قدر لکھیں", "uc.howto_2d": "عدد لکھیں اور “از” اور “تک” کی اکائیاں چنیں۔ بدلنے کے لیے ⇄ دبائیں۔",
    "uc.howto_3t": "نتیجہ پڑھیں", "uc.howto_3d": "لکھتے ہی جواب لائیو بدلتا ہے — بٹن کی ضرورت نہیں۔",
    "uc.faq_q1": "کیا کنورٹر کو انٹرنیٹ چاہیے؟",
    "uc.faq_a1": "نہیں۔ تمام تبدیلیاں براؤزر میں خالص جاوا اسکرپٹ حساب ہیں — صفحہ کیش ہونے کے بعد آف لائن بھی چلتا ہے۔",
    "uc.faq_q2": "کون سی اکائیاں معاون ہیں؟",
    "uc.faq_a2": "لمبائی (mm، cm، m، km، انچ، فٹ، میل)، وزن (g، kg، oz، lb)، درجہ حرارت (°C، °F، K) اور ڈیٹا (KB، MB، GB، TB)۔",
    "resizer.faq_title": "عمومی سوالات", "resizer.related": "متعلقہ ٹولز"
  };
  if (window.DKI18N && typeof window.DKI18N.add === "function") {
    window.DKI18N.add("en", en); window.DKI18N.add("ur", ur);
  } else {
    (window.__DKI18N_QUEUE__ = window.__DKI18N_QUEUE__ || []).push(["en", en], ["ur", ur]);
  }

  function tempConvert(v, from, to) {
    var c = from === "c" ? v : from === "f" ? (v - 32) * 5 / 9 : v - 273.15;
    return to === "c" ? c : to === "f" ? c * 9 / 5 + 32 : c + 273.15;
  }

  function fmt(v) {
    if (!isFinite(v)) return "—";
    if (v !== 0 && (Math.abs(v) >= 1e12 || Math.abs(v) < 1e-9)) return v.toExponential(6);
    var s = Number(v.toPrecision(10)).toString();
    return s;
  }

  function fillUnits() {
    var cat = o("ucCat").value, units = Object.keys(CATS[cat].units);
    var fu = o("ucFromUnit"), tu = o("ucToUnit");
    var prevF = fu.value, prevT = tu.value;
    fu.innerHTML = ""; tu.innerHTML = "";
    units.forEach(function (u) {
      var a = document.createElement("option"); a.value = u; a.textContent = UNIT_LABEL[u]; fu.appendChild(a);
      var b = document.createElement("option"); b.value = u; b.textContent = UNIT_LABEL[u]; tu.appendChild(b);
    });
    // Sensible defaults per category
    var defs = { length: ["m", "km"], weight: ["kg", "g"], temp: ["c", "f"], data: ["mb", "gb"] };
    fu.value = units.indexOf(prevF) >= 0 ? prevF : defs[cat][0];
    tu.value = units.indexOf(prevT) >= 0 ? prevT : defs[cat][1];
  }

  function convert() {
    var cat = o("ucCat").value, v = parseFloat(o("ucFromVal").value);
    var from = o("ucFromUnit").value, to = o("ucToUnit").value;
    if (isNaN(v)) { o("ucToVal").value = ""; return; }
    var res;
    if (cat === "temp") res = tempConvert(v, from, to);
    else res = v * CATS[cat].units[from] / CATS[cat].units[to];
    o("ucToVal").value = fmt(res);
  }

  function init() {
    fillUnits();
    o("ucCat").addEventListener("change", function () { fillUnits(); convert(); });
    o("ucFromVal").addEventListener("input", convert);
    o("ucFromUnit").addEventListener("change", convert);
    o("ucToUnit").addEventListener("change", convert);
    o("ucSwap").addEventListener("click", function () {
      var f = o("ucFromUnit"), tsel = o("ucToUnit"), tmp = f.value;
      f.value = tsel.value; tsel.value = tmp; convert();
    });
    convert();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}();
