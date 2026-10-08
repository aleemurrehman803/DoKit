/* DoKit — QR Generator tool logic (Phase 2, Oct 2026).
 * Uses vendored qrcodejs (MIT) from js/vendor/qrcode.min.js — no CDN.
 * 100% in-browser: the code is drawn locally, nothing is uploaded. */
"use strict";
!function () {
  function t(k) { return (window.DKI18N && typeof window.DKI18N.t === "function") ? window.DKI18N.t(k) : k; }
  function o(id) { return document.getElementById(id); }

  // i18n dictionary (EN + UR; other languages fall back to EN)
  var en = {
    "common.skip": "Skip to content", "common.crumb_home": "Home", "common.crumb_tools": "Tools",
    "toolnames.qr": "QR Generator", "toolnames.pw": "Password Generator", "toolnames.unit": "Unit Converter",
    "toolnames.word_counter": "Word Counter",
    "toolnames.desc_pw": "Strong random passwords, generated privately.",
    "toolnames.desc_unit": "Convert length, weight, temperature, and data.",
    "toolnames.desc_word_counter": "Live word, character, and reading-time stats.",
    "qr.meta_title": "Free QR Code Generator Online — Text & URL to QR | DoKit",
    "qr.meta_desc": "Generate QR codes from any text or URL instantly in your browser. Download as PNG. Free, private — nothing leaves your device.",
    "qr.hero_desc": "Turn any text or link into a scannable QR code — generated instantly in your browser.",
    "qr.privacy": "Your text never leaves your device",
    "qr.privacy_line": "Text never leaves your device — 100% private.",
    "qr.label": "Text or link", "qr.placeholder": "https://example.com or any text…",
    "qr.size": "Size", "qr.generate": "Generate QR", "qr.clear": "Clear", "qr.download": "Download PNG",
    "qr.step1": "Type text or paste a link", "qr.step2": "Generate the QR code", "qr.step3": "Download the PNG",
    "qr.howto_title": "How to make a QR code",
    "qr.howto_1t": "Enter your text or link", "qr.howto_1d": "Type anything — a website URL, a message, or contact details.",
    "qr.howto_2t": "Generate", "qr.howto_2d": "Tap Generate QR — the code is drawn instantly, right in your browser.",
    "qr.howto_3t": "Download", "qr.howto_3d": "Save the PNG at 256, 512, or 1024 px and share or print it anywhere.",
    "qr.faq_q1": "Is my text uploaded anywhere?",
    "qr.faq_a1": "Never. The QR code is drawn in your browser with JavaScript — your text never leaves your device.",
    "qr.faq_q2": "What can I put in a QR code?",
    "qr.faq_a2": "Any text up to a few thousand characters: website URLs, plain messages, phone numbers, or email addresses.",
    "qr.hint_empty": "Type something first, then tap Generate QR.",
    "qr.hint_ready": "Scan it with any phone camera.",
    "resizer.faq_title": "Frequently asked questions", "resizer.related": "Related tools"
  };
  var ur = {
    "common.skip": "مواد پر جائیں", "common.crumb_home": "ہوم", "common.crumb_tools": "ٹولز",
    "toolnames.qr": "کیو آر جنریٹر", "toolnames.pw": "پاس ورڈ جنریٹر", "toolnames.unit": "یونٹ کنورٹر",
    "toolnames.word_counter": "الفاظ کی گنتی",
    "toolnames.desc_pw": "مضبوط بے ترتیب پاس ورڈ، مکمل نجی طریقے سے۔",
    "toolnames.desc_unit": "لمبائی، وزن، درجہ حرارت اور ڈیٹا تبدیل کریں۔",
    "toolnames.desc_word_counter": "الفاظ، حروف اور پڑھنے کے وقت کے لائیو اعداد۔",
    "qr.meta_title": "مفت کیو آر کوڈ جنریٹر — متن اور لنک سے کیو آر | ڈوکٹ",
    "qr.meta_desc": "کسی بھی متن یا لنک سے فوراً کیو آر کوڈ بنائیں۔ PNG ڈاؤن لوڈ کریں۔ مفت اور نجی۔",
    "qr.hero_desc": "کسی بھی متن یا لنک کو اسکین ہونے والا کیو آر کوڈ بنائیں — آپ کے براؤزر میں فوراً۔",
    "qr.privacy": "آپ کا متن آپ کے ڈیوائس سے باہر نہیں جاتا",
    "qr.privacy_line": "متن آپ کے ڈیوائس سے باہر نہیں جاتا — 100% نجی۔",
    "qr.label": "متن یا لنک", "qr.placeholder": "https://example.com یا کوئی متن…",
    "qr.size": "سائز", "qr.generate": "کیو آر بنائیں", "qr.clear": "صاف کریں", "qr.download": "PNG ڈاؤن لوڈ کریں",
    "qr.step1": "متن لکھیں یا لنک چسپاں کریں", "qr.step2": "کیو آر کوڈ بنائیں", "qr.step3": "PNG ڈاؤن لوڈ کریں",
    "qr.howto_title": "کیو آر کوڈ کیسے بنائیں",
    "qr.howto_1t": "متن یا لنک لکھیں", "qr.howto_1d": "کچھ بھی لکھیں — ویب سائٹ کا لنک، پیغام یا رابطے کی تفصیل۔",
    "qr.howto_2t": "بنائیں", "qr.howto_2d": "کیو آر بنائیں دبائیں — کوڈ آپ کے براؤزر میں فوراً بن جائے گا۔",
    "qr.howto_3t": "ڈاؤن لوڈ کریں", "qr.howto_3d": "256، 512 یا 1024 پکسل میں PNG محفوظ کریں اور کہیں بھی شیئر یا پرنٹ کریں۔",
    "qr.faq_q1": "کیا میرا متن کہیں اپ لوڈ ہوتا ہے؟",
    "qr.faq_a1": "کبھی نہیں۔ کیو آر کوڈ آپ کے براؤزر میں بنتا ہے — متن ڈیوائس سے باہر نہیں جاتا۔",
    "qr.faq_q2": "کیو آر کوڈ میں کیا رکھ سکتا ہوں؟",
    "qr.faq_a2": "چند ہزار حروف تک کوئی بھی متن: ویب سائٹ کے لنک، پیغامات، فون نمبر یا ای میل۔",
    "qr.hint_empty": "پہلے کچھ لکھیں، پھر کیو آر بنائیں دبائیں۔",
    "qr.hint_ready": "کسی بھی فون کے کیمرے سے اسکین کریں۔",
    "resizer.faq_title": "عمومی سوالات", "resizer.related": "متعلقہ ٹولز"
  };
  if (window.DKI18N && typeof window.DKI18N.add === "function") {
    window.DKI18N.add("en", en); window.DKI18N.add("ur", ur);
  } else {
    (window.__DKI18N_QUEUE__ = window.__DKI18N_QUEUE__ || []).push(["en", en], ["ur", ur]);
  }

  function generate() {
    var txt = o("qrText").value.trim();
    var hint = o("qrHint"), out = o("qrOut"), box = o("qrBox");
    if (!txt) { hint.textContent = t("qr.hint_empty"); out.hidden = true; return; }
    if (typeof QRCode === "undefined") { hint.textContent = "QR library failed to load."; return; }
    var size = parseInt(o("qrSize").value, 10) || 512;
    box.innerHTML = "";
    try {
      new QRCode(box, { text: txt, width: size, height: size, correctLevel: QRCode.CorrectLevel.M });
    } catch (e) { hint.textContent = String(e && e.message || e); return; }
    out.hidden = false;
    hint.textContent = t("qr.hint_ready");
  }

  function download() {
    var box = o("qrBox");
    var canvas = box.querySelector("canvas");
    var img = box.querySelector("img");
    var url = null;
    if (canvas) { try { url = canvas.toDataURL("image/png"); } catch (e) {} }
    if (!url && img && img.src) url = img.src;
    if (!url) return;
    var a = document.createElement("a");
    a.href = url; a.download = "dokit-qr.png";
    document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); }, 1000);
  }

  function init() {
    o("qrGen").addEventListener("click", generate);
    o("qrClear").addEventListener("click", function () {
      o("qrText").value = ""; o("qrBox").innerHTML = "";
      o("qrOut").hidden = true; o("qrHint").textContent = ""; o("qrText").focus();
    });
    o("qrDl").addEventListener("click", download);
    o("qrSize").addEventListener("change", function () { if (!o("qrOut").hidden) generate(); });
    o("qrText").addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") generate();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}();
