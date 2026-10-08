/* DoKit — Password Generator tool logic (Phase 2, Oct 2026).
 * Uses crypto.getRandomValues (NOT Math.random) for secure passwords.
 * 100% in-browser: nothing is uploaded or stored. */
"use strict";
!function () {
  function t(k) { return (window.DKI18N && typeof window.DKI18N.t === "function") ? window.DKI18N.t(k) : k; }
  function o(id) { return document.getElementById(id); }

  var SETS = {
    upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    lower: "abcdefghijklmnopqrstuvwxyz",
    digits: "0123456789",
    symbols: "!@#$%^&*()-_=+[]{};:,.<>?/~"
  };

  var en = {
    "common.skip": "Skip to content", "common.crumb_home": "Home", "common.crumb_tools": "Tools",
    "toolnames.pw": "Password Generator", "toolnames.qr": "QR Generator", "toolnames.unit": "Unit Converter",
    "toolnames.case_converter": "Case Converter",
    "toolnames.desc_qr": "Turn any text or link into a QR code.",
    "toolnames.desc_unit": "Convert length, weight, temperature, and data.",
    "toolnames.desc_case_converter": "Convert text between six letter cases.",
    "pw.meta_title": "Free Password Generator Online — Strong Random Passwords | DoKit",
    "pw.meta_desc": "Generate strong, random passwords in your browser with crypto-grade randomness. Choose length and character types. Free, private — nothing leaves your device.",
    "pw.hero_desc": "Strong, random passwords with crypto-grade randomness — made privately in your browser.",
    "pw.privacy": "Passwords never leave your device",
    "pw.privacy_line": "Generated with crypto-grade randomness — 100% private.",
    "pw.length": "Length", "pw.include": "Include",
    "pw.upper": "Uppercase (A–Z)", "pw.lower": "Lowercase (a–z)", "pw.digits": "Digits (0–9)", "pw.symbols": "Symbols (!@#$…)",
    "pw.result": "Your password", "pw.strength": "Strength",
    "pw.generate": "Generate", "pw.copy": "Copy", "pw.copied": "Copied!",
    "pw.step1": "Pick length & characters", "pw.step2": "Generate a password", "pw.step3": "Copy & use it",
    "pw.howto_title": "How to make a strong password",
    "pw.howto_1t": "Choose length and characters", "pw.howto_1d": "Drag the slider (8–64) and tick the character types you want.",
    "pw.howto_2t": "Generate", "pw.howto_2d": "Tap Generate — a fresh password appears instantly, using your browser's secure random generator.",
    "pw.howto_3t": "Copy and save", "pw.howto_3d": "Copy it with one tap and store it in a password manager. Never reuse passwords across sites.",
    "pw.faq_q1": "Are the passwords sent anywhere?",
    "pw.faq_a1": "Never. Passwords are generated with your browser's crypto-grade random generator — nothing leaves your device.",
    "pw.faq_q2": "How long should my password be?",
    "pw.faq_a2": "At least 16 characters for important accounts. Longer passwords with mixed character types are exponentially harder to crack.",
    "pw.str_weak": "Weak", "pw.str_fair": "Fair", "pw.str_strong": "Strong", "pw.str_very": "Very strong",
    "pw.hint_none": "Pick at least one character type.",
    "resizer.faq_title": "Frequently asked questions", "resizer.related": "Related tools"
  };
  var ur = {
    "common.skip": "مواد پر جائیں", "common.crumb_home": "ہوم", "common.crumb_tools": "ٹولز",
    "toolnames.pw": "پاس ورڈ جنریٹر", "toolnames.qr": "کیو آر جنریٹر", "toolnames.unit": "یونٹ کنورٹر",
    "toolnames.case_converter": "کیس کنورٹر",
    "toolnames.desc_qr": "کسی بھی متن یا لنک کو کیو آر کوڈ بنائیں۔",
    "toolnames.desc_unit": "لمبائی، وزن، درجہ حرارت اور ڈیٹا تبدیل کریں۔",
    "toolnames.desc_case_converter": "متن کو چھ مختلف کیسز میں تبدیل کریں۔",
    "pw.meta_title": "مفت پاس ورڈ جنریٹر — مضبوط بے ترتیب پاس ورڈ | ڈوکٹ",
    "pw.meta_desc": "کرپٹو معیار کی بے ترتیبی سے مضبوط پاس ورڈ بنائیں۔ لمبائی اور حروف خود چنیں۔ مفت اور نجی۔",
    "pw.hero_desc": "کرپٹو معیار کی بے ترتیبی سے مضبوط پاس ورڈ — آپ کے براؤزر میں مکمل نجی طریقے سے۔",
    "pw.privacy": "پاس ورڈ آپ کے ڈیوائس سے باہر نہیں جاتے",
    "pw.privacy_line": "کرپٹو معیار کی بے ترتیبی سے بنے — 100% نجی۔",
    "pw.length": "لمبائی", "pw.include": "شامل کریں",
    "pw.upper": "بڑے حروف (A–Z)", "pw.lower": "چھوٹے حروف (a–z)", "pw.digits": "ہندسے (0–9)", "pw.symbols": "علامات (!@#$…)",
    "pw.result": "آپ کا پاس ورڈ", "pw.strength": "مضبوطی",
    "pw.generate": "بنائیں", "pw.copy": "کاپی کریں", "pw.copied": "کاپی ہو گیا!",
    "pw.step1": "لمبائی اور حروف چنیں", "pw.step2": "پاس ورڈ بنائیں", "pw.step3": "کاپی کر کے استعمال کریں",
    "pw.howto_title": "مضبوط پاس ورڈ کیسے بنائیں",
    "pw.howto_1t": "لمبائی اور حروف چنیں", "pw.howto_1d": "سلائیڈر گھمائیں (8–64) اور مطلوبہ حروف پر ٹک لگائیں۔",
    "pw.howto_2t": "بنائیں", "pw.howto_2d": "بنائیں دبائیں — براؤزر کے محفوظ رینڈم جنریٹر سے فوراً نیا پاس ورڈ۔",
    "pw.howto_3t": "کاپی کر کے محفوظ کریں", "pw.howto_3d": "ایک ٹیپ سے کاپی کریں اور پاس ورڈ مینیجر میں رکھیں۔ پاس ورڈ دوبارہ استعمال نہ کریں۔",
    "pw.faq_q1": "کیا پاس ورڈ کہیں بھیجے جاتے ہیں؟",
    "pw.faq_a1": "کبھی نہیں۔ پاس ورڈ براؤزر کے کرپٹو معیار کے رینڈم جنریٹر سے بنتے ہیں — کچھ بھی ڈیوائس سے باہر نہیں جاتا۔",
    "pw.faq_q2": "پاس ورڈ کتنا لمبا ہونا چاہیے؟",
    "pw.faq_a2": "اہم اکاؤنٹس کے لیے کم از کم 16 حروف۔ ملے جلے حروف والے لمبے پاس ورڈ توڑنا کہیں مشکل ہوتا ہے۔",
    "pw.str_weak": "کمزور", "pw.str_fair": "درمیانہ", "pw.str_strong": "مضبوط", "pw.str_very": "بہت مضبوط",
    "pw.hint_none": "کم از کم ایک قسم کے حروف چنیں۔",
    "resizer.faq_title": "عمومی سوالات", "resizer.related": "متعلقہ ٹولز"
  };
  if (window.DKI18N && typeof window.DKI18N.add === "function") {
    window.DKI18N.add("en", en); window.DKI18N.add("ur", ur);
  } else {
    (window.__DKI18N_QUEUE__ = window.__DKI18N_QUEUE__ || []).push(["en", en], ["ur", ur]);
  }

  function charset() {
    var s = "";
    if (o("pwUpper").checked) s += SETS.upper;
    if (o("pwLower").checked) s += SETS.lower;
    if (o("pwDigits").checked) s += SETS.digits;
    if (o("pwSymbols").checked) s += SETS.symbols;
    return s;
  }

  // Unbiased random index via crypto.getRandomValues (rejection sampling).
  function randIndex(n) {
    var arr = new Uint32Array(1), max = 0xFFFFFFFF - (0xFFFFFFFF % n);
    do { window.crypto.getRandomValues(arr); } while (arr[0] >= max);
    return arr[0] % n;
  }

  function strengthLabel(len, types) {
    // Rough entropy estimate: len * log2(pool)
    var pool = (types.upper ? 26 : 0) + (types.lower ? 26 : 0) + (types.digits ? 10 : 0) + (types.symbols ? 28 : 0);
    var bits = pool > 1 ? len * (Math.log(pool) / Math.log(2)) : 0;
    if (bits < 40) return t("pw.str_weak");
    if (bits < 60) return t("pw.str_fair");
    if (bits < 90) return t("pw.str_strong");
    return t("pw.str_very");
  }

  function generate() {
    var cs = charset(), hint = o("pwHint");
    if (!cs) { hint.textContent = t("pw.hint_none"); o("pwOut").value = ""; o("pwStrength").textContent = "—"; return; }
    var len = parseInt(o("pwLen").value, 10) || 20;
    var out = "";
    for (var i = 0; i < len; i++) out += cs.charAt(randIndex(cs.length));
    o("pwOut").value = out;
    o("pwStrength").textContent = strengthLabel(len, {
      upper: o("pwUpper").checked, lower: o("pwLower").checked,
      digits: o("pwDigits").checked, symbols: o("pwSymbols").checked
    });
    hint.textContent = "";
  }

  function copy() {
    var el = o("pwOut");
    if (!el.value) return;
    function done() {
      o("pwCopy").textContent = t("pw.copied");
      setTimeout(function () { o("pwCopy").textContent = t("pw.copy"); }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(el.value).then(done).catch(function () { fallback(); });
    } else fallback();
    function fallback() { el.select(); try { document.execCommand("copy"); } catch (e) {} done(); }
  }

  function init() {
    var len = o("pwLen"), out = o("pwLenOut");
    len.addEventListener("input", function () { out.textContent = len.value; });
    o("pwGen").addEventListener("click", generate);
    o("pwCopy").addEventListener("click", copy);
    ["pwUpper", "pwLower", "pwDigits", "pwSymbols"].forEach(function (id) {
      o(id).addEventListener("change", function () { if (o("pwOut").value) generate(); });
    });
    generate(); // show one immediately
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}();
