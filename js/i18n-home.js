/* ============================================================================
 * DoKit — Homepage supplemental dictionary (js/i18n-home.js)
 * ----------------------------------------------------------------------------
 * Provides EN + UR strings for homepage keys that were missing from every
 * dictionary (hero_tag, cats_sub, why_*, faq teaser, cta, stats, etc.).
 * Loaded on index.html after i18n-hotfix.js via DKI18N.add().
 * CSP: plain script, no inline handlers, no eval.
 * ========================================================================== */
(function () {
  'use strict';
  function __dkAdd(l,d){if(window.DKI18N&&typeof window.DKI18N.add==="function"){window.DKI18N.add(l,d);}else{(window.__DKI18N_QUEUE__=window.__DKI18N_QUEUE__||[]).push([l,d]);if(window.console&&console.warn)console.warn("[i18n] DKI18N not ready - queued dict for "+l);}}

  /* -- English (canonical, matches index.html character-for-character) ------ */
  __dkAdd('en', {
    "skip_link": "Skip to content",
    "hero_eyebrow": "Free online tools",
    "hero_tag": "Resize images, count words, master typing — fast, free, and private. Nothing leaves your browser.",
    "hero_cta_tools": "Browse all tools",
    "hero_cta_typing": "Start typing practice",
    "search_label": "Search tools",
    "cats_title": "Browse by category",
    "cats_sub": "Tap a category to see its tools — or search above.",
    "tools_empty": "No tools match your search. Try another word.",
    "why_title": "Why DoKit?",
    "why_sub": "Built differently — on purpose.",
    "why1_t": "Private by design",
    "why1_d": "Your files never leave your device. Everything runs in your browser — nothing to hack, nothing to leak.",
    "why2_t": "Blazing fast",
    "why2_d": "Zero bloat, zero tracking scripts. Pages open in a blink and tools respond instantly.",
    "why3_t": "Free core, forever",
    "why3_d": "Every tool on this page is free to use — no account, no watermarks, no catches.",
    "why4_t": "English + اردو",
    "why4_d": "A full Urdu interface with right-to-left layout, alongside English.",
    "stat_tools_l": "Free tools",
    "stat_private_l": "Private — files stay on your device",
    "stat_signup_l": "Sign-up required",
    "stat_lang_l": "Languages",
    "home2.seg4_t": "Teachers",
    "home2.seg4_d": "Typing lessons and practice for the whole class — free forever, no accounts to manage.",
    "faq_teaser_t": "Quick answers",
    "faq_teaser_sub": "The three questions everyone asks first.",
    "fq1_q": "Is DoKit really free?",
    "fq1_a": "Yes — every tool listed here is free with no account, no watermarks, and no usage caps on normal use.",
    "fq2_q": "Do my files get uploaded anywhere?",
    "fq2_a": "Never. Image tools process your files inside your own browser.",
    "fq3_q": "Do I need to create an account?",
    "fq3_a": "No. Open a tool and use it.",
    "faq_more": "More questions",
    "cta_t": "Ready to get things done?",
    "cta_d": "Join thousands of people using DoKit's free tools every day. No signup required.",
    "cta_btn": "Explore tools"
  });

  /* -- Urdu ---------------------------------------------------------------- */
  __dkAdd('ur', {
    "skip_link": "مواد پر جائیں",
    "hero_eyebrow": "مفت آن لائن ٹولز",
    "hero_tag": "تصویریں ری سائز کریں، الفاظ گنیں، ٹائپنگ سیکھیں — تیز، مفت، اور نجی۔ آپ کے براؤزر سے کچھ باہر نہیں جاتا۔",
    "hero_cta_tools": "تمام ٹولز دیکھیں",
    "hero_cta_typing": "ٹائپنگ پریکٹس شروع کریں",
    "search_label": "ٹولز تلاش کریں",
    "cats_title": "زمرے کے حساب سے دیکھیں",
    "cats_sub": "اپنے ٹولز دیکھنے کے لیے کسی زمرے پر ٹیپ کریں — یا اوپر تلاش کریں۔",
    "tools_empty": "کوئی ٹول نہیں ملا۔ کوئی اور لفظ آزمائیں۔",
    "why_title": "DoKit کیوں؟",
    "why_sub": "جان بوجھ کر مختلف بنایا گیا۔",
    "why1_t": "نجی بائی ڈیزائن",
    "why1_d": "آپ کی فائلیں آپ کے ڈیوائس سے باہر نہیں جاتیں۔ سب کچھ آپ کے براؤزر میں چلتا ہے — ہیک کرنے کو کچھ نہیں، لیک ہونے کو کچھ نہیں۔",
    "why2_t": "بجلی جیسی رفتار",
    "why2_d": "نہ بھاری کوڈ، نہ ٹریکنگ اسکرپٹس۔ صفحات پلک جھپکتے کھلتے ہیں اور ٹولز فوراً جواب دیتے ہیں۔",
    "why3_t": "مفت بنیاد، ہمیشہ",
    "why3_d": "اس صفحے کا ہر ٹول مفت ہے — نہ اکاؤنٹ، نہ واٹر مارک، نہ کوئی شرط۔",
    "why4_t": "English + اردو",
    "why4_d": "انگریزی کے ساتھ مکمل اردو انٹرفیس اور دائیں سے بائیں لے آؤٹ۔",
    "stat_tools_l": "مفت ٹولز",
    "stat_private_l": "نجی — فائلیں آپ کے ڈیوائس پر رہتی ہیں",
    "stat_signup_l": "سائن اپ درکار",
    "stat_lang_l": "زبانیں",
    "home2.seg4_t": "اساتذہ",
    "home2.seg4_d": "پوری کلاس کے لیے ٹائپنگ اسباق اور پریکٹس — ہمیشہ مفت، کوئی اکاؤنٹ سنبھالنے کی ضرورت نہیں۔",
    "faq_teaser_t": "فوری جوابات",
    "faq_teaser_sub": "وہ تین سوالات جو سب پہلے پوچھتے ہیں۔",
    "fq1_q": "کیا DoKit واقعی مفت ہے؟",
    "fq1_a": "جی ہاں — یہاں درج ہر ٹول مفت ہے، نہ اکاؤنٹ، نہ واٹر مارک، اور عام استعمال پر کوئی حد نہیں۔",
    "fq2_q": "کیا میری فائلیں کہیں اپ لوڈ ہوتی ہیں؟",
    "fq2_a": "کبھی نہیں۔ تصویری ٹولز آپ کی فائلیں آپ کے اپنے براؤزر میں پروسیس کرتے ہیں۔",
    "fq3_q": "کیا مجھے اکاؤنٹ بنانا ہوگا؟",
    "fq3_a": "نہیں۔ ٹول کھولیں اور استعمال کریں۔",
    "faq_more": "مزید سوالات",
    "cta_t": "کام نمٹانے کے لیے تیار؟",
    "cta_d": "ہزاروں لوگ روزانہ DoKit کے مفت ٹولز استعمال کرتے ہیں۔ سائن اپ کی ضرورت نہیں۔",
    "cta_btn": "ٹولز دیکھیں"
  });

  // -- home2.* keys (fix 2026-10-07) --
  __dkAdd('en', {
    "home2.bar_free": "free",
    "home2.bar_private": "Private by design",
    "home2.hero_h1": "Get everyday tasks done in seconds — free.",
    "home2.hint_a": "Tip: press",
    "home2.hint_b": "to search",
    "home2.kicker_cats": "Find your tool",
    "home2.kicker_proof": "Loved in real life",
    "home2.kicker_why": "The DoKit promise",
    "home2.proof_sub": "Students, freelancers and shop owners reach for DoKit daily — no sign-up, no learning curve.",
    "home2.proof_t": "Made for everyday people",
    "home2.seg1_d": "Word counts checked and essays polished — right before the deadline, no account needed.",
    "home2.seg1_t": "Students",
    "home2.seg2_d": "Client images resized and compressed in the browser — nothing uploaded, nothing to explain.",
    "home2.seg2_t": "Freelancers",
    "home2.seg3_d": "Product photos converted and shrunk before listing — files never leave the device.",
    "home2.seg3_t": "Small shops",
    "home2.strip_nosignup": "No sign-up",
    "home2.strip_tools": "tools"
  });
  __dkAdd('ur', {
    "home2.bar_free": "مفت",
    "home2.bar_private": "پرائیویسی پہلے",
    "home2.hero_h1": "روزمرہ کے کام سیکنڈوں میں نمٹائیں — مفت۔",
    "home2.hint_a": "ٹپ: دبائیں",
    "home2.hint_b": "تلاش کے لیے",
    "home2.kicker_cats": "اپنا ٹول تلاش کریں",
    "home2.kicker_proof": "حقیقی زندگی میں پسندیدہ",
    "home2.kicker_why": "ڈوکٹ کا وعدہ",
    "home2.proof_sub": "طلبہ، فری لانسرز اور دکان دار روزانہ ڈوکٹ استعمال کرتے ہیں۔",
    "home2.proof_t": "عام لوگوں کے لیے بنایا گیا",
    "home2.seg1_d": "الفاظ گنے اور مضامین سنوارے — آخری لمحے سے پہلے۔",
    "home2.seg1_t": "طلبہ",
    "home2.seg2_d": "کلائنٹ کی تصاویر براؤزر میں ری سائز اور کمپریس کیں۔",
    "home2.seg2_t": "فری لانسرز",
    "home2.seg3_d": "مصنوعات کی تصاویر لسٹنگ سے پہلے تبدیل اور چھوٹی کیں۔",
    "home2.seg3_t": "چھوٹی دکانیں",
    "home2.strip_nosignup": "سائن اپ نہیں",
    "home2.strip_tools": "ٹولز"
  });
})();
