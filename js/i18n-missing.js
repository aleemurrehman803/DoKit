/* ============================================================================
 * DoKit — Missing keys supplemental dictionary (js/i18n-missing.js)
 * ----------------------------------------------------------------------------
 * Provides EN + UR strings for keys used in HTML but missing from all
 * dictionaries (coming-soon, contact, pricing, privacy, terms pages).
 * Loaded after i18n-hotfix.js via DKI18N.add().
 * CSP: plain script, no inline handlers, no eval.
 * ========================================================================== */
(function () {
  'use strict';
  if (!window.DKI18N || typeof window.DKI18N.add !== 'function') { return; }

  /* -- English (canonical, matches HTML character-for-character) ------------ */
  window.DKI18N.add('en', {
    "contact_title": "Contact us",
    "contact_sub": "Questions, ideas, bug reports, tool suggestions — every message is read personally. Nothing goes to a bot; your note reaches the person who built DoKit.",
    "contact_note_t": "Prefer email directly?",
    "form_name": "Your name",
    "form_email": "Your email",
    "form_subject": "Subject",
    "form_message": "Message",
    "form_send": "Send message",
    "cs_title": "Coming soon",
    "tf_sub": "Skill-based typing battles. Real stakes, real winners — coming soon.",
    "cs1_t": "QR Generator",
    "cs1_d": "Create QR codes for links, text, and contact cards — instantly, offline.",
    "cs2_t": "Password Generator",
    "cs2_d": "Strong, random passwords generated on your device. Nothing ever leaves it.",
    "cs3_t": "JSON Formatter",
    "cs3_d": "Pretty-print, minify, and validate JSON without pasting it into a stranger's website.",
    "cs4_t": "Unit Converter",
    "cs4_d": "Length, weight, temperature, and more — with a clean, fast interface.",
    "notify_t": "Get notified",
    "notify_name": "Name",
    "notify_email": "Email",
    "notify_btn": "Notify me",
    "pricing_title": "Simple, honest pricing",
    "pricing_sub": "Start free and stay free for as long as you like. Pay only if you want the extras — and cancel anytime.",
    "free_t": "Free",
    "free_forever": "forever",
    "free_f1": "All free tools, unlimited normal use",
    "pro_note": "Pro is not on sale yet — everything listed here is already free today.",
    "privacy_title": "Privacy Policy",
    "terms_title": "Terms of Use"
  });

  /* -- Urdu ---------------------------------------------------------------- */
  window.DKI18N.add('ur', {
    "contact_title": "رابطہ کریں",
    "contact_sub": "سوالات، آئیڈیاز، بگ رپورٹس، ٹول کی تجاویز — ہر پیغام ذاتی طور پر پڑھا جاتا ہے۔ کچھ بوٹ کے پاس نہیں جاتا؛ آپ کا نوٹ DoKit بنانے والے تک پہنچتا ہے۔",
    "contact_note_t": "براہ راست ای میل پسند کریں گے؟",
    "form_name": "آپ کا نام",
    "form_email": "آپ کا ای میل",
    "form_subject": "موضوع",
    "form_message": "پیغام",
    "form_send": "پیغام بھیجیں",
    "cs_title": "جلد آ رہا ہے",
    "tf_sub": "مہارت پر مبنی ٹائپنگ مقابلے۔ اصل داؤ، اصل فاتح — جلد آ رہا ہے۔",
    "cs1_t": "QR جنریٹر",
    "cs1_d": "لنکس، ٹیکسٹ اور رابطہ کارڈز کے لیے QR کوڈ بنائیں — فوراً، آف لائن۔",
    "cs2_t": "پاس ورڈ جنریٹر",
    "cs2_d": "آپ کے ڈیوائس پر مضبوط، بے ترتیب پاس ورڈ بنائیں۔ کچھ بھی باہر نہیں جاتا۔",
    "cs3_t": "JSON فارمیٹر",
    "cs3_d": "JSON کو خوبصورت بنائیں، چھوٹا کریں اور درست کریں — کسی اجنبی کی ویب سائٹ پر پیسٹ کیے بغیر۔",
    "cs4_t": "یونٹ کنورٹر",
    "cs4_d": "لمبائی، وزن، درجہ حرارت اور مزید — صاف، تیز انٹرفیس کے ساتھ۔",
    "notify_t": "اطلاع پائیں",
    "notify_name": "نام",
    "notify_email": "ای میل",
    "notify_btn": "مجھے بتائیں",
    "pricing_title": "سادہ، ایماندار قیمت",
    "pricing_sub": "مفت شروع کریں اور جب تک چاہیں مفت رہیں۔ صرف اضافی فیچرز چاہیں تو ادائیگی کریں — اور کسی بھی وقت منسوخ کریں۔",
    "free_t": "مفت",
    "free_forever": "ہمیشہ",
    "free_f1": "تمام مفت ٹولز، عام استعمال لا محدود",
    "pro_note": "پرو ابھی فروخت کے لیے نہیں — یہاں درج سب کچھ آج ہی مفت ہے۔",
    "privacy_title": "پرائیویسی پالیسی",
    "terms_title": "شرائط استعمال"
  });
})();
