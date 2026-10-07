/**
 * DoKit — Urdu Typing Lessons Data
 * ==================================
 * WHAT: 25 structured Urdu typing lessons, beginner → expert progression.
 *       Each lesson has target text, learning objective, and pass criteria.
 *
 * WHY: Structured progression (like English typing tutors) takes a complete
 *      beginner to fluent Urdu typist. Random practice doesn't build skill.
 *
 * LESSON STRUCTURE (25 total):
 *   Beginner (1-5):   ا س د → ف گ ح → ج ک ل → home-row review → م ن و
 *   Intermediate (6-12): ب پ ت ٹ, ر ز ے, special chars (ی ء ہ ھ ں),
 *                        common words, joining practice
 *   Advanced (13-18): Short sentences → paragraphs → speed building
 *   Expert (19-25):   Urdu numerals ۰-۹, numbers+Urdu mix, punctuation,
 *                     stories, timed challenges, final mastery
 *
 * PASS CRITERIA (must meet BOTH to unlock next lesson):
 *   - WPM target: 8 (L1) → 35 (L25), progressive
 *   - Accuracy target: 90% (L1) → 96% (L25), progressive
 *
 * Each lesson object:
 *   { id, level, title, objective, text, targetWpm, targetAccuracy }
 *
 * Also includes 3 timed-test passages (1/3/5 min): روزمرہ، پاکستان، علم
 *
 * @module UrduLessons
 */
(function () {
  "use strict";

  window.URDU_LESSONS = [
    /* ============ BEGINNER 1-5: letters, home row ============ */
    { id: 1, level: "beginner",
      title: "Alif, Seen, Daal", titleUr: "ا س د",
      objective: "Pehli 3 keys: ا (a), س (s), د (d). Sahi ungliyon se aadat banayen.",
      text: "ا س د ا س د س ا د د ا س ا د س س ا د ا س د د س ا ا س د س د ا",
      targetWpm: 8, targetAcc: 90 },
    { id: 2, level: "beginner",
      title: "Fay, Gaaf, Hay", titleUr: "ف گ ح",
      objective: "Nayi keys: ف (f), گ (g), ح (h). Pichli keys ke sath milayen.",
      text: "ف گ ح ف گ ح گ ف ح ح ف گ ف ح گ گ ف ح ح گ ف ف ح گ ف ح گ",
      targetWpm: 8, targetAcc: 90 },
    { id: 3, level: "beginner",
      title: "Jeem, Kaaf, Laam", titleUr: "ج ک ل",
      objective: "Nayi keys: ج (j), ک (k), ل (l). Home row mukammal.",
      text: "ج ک ل ج ک ل ک ج ل ل ج ک ج ل ک ک ج ل ل ک ج ج ل ک ج ک ل",
      targetWpm: 10, targetAcc: 90 },
    { id: 4, level: "beginner",
      title: "Home Row Review", titleUr: "مشق",
      objective: "9 keys ka imtihan: ا س د ف گ ح ج ک ل — baghair dekhe.",
      text: "ا س د ف گ ح ج ک ل ل ک ج ح گ ف د س ا ج ک ل ا س د ف گ ح ک ل ج",
      targetWpm: 10, targetAcc: 92 },
    { id: 5, level: "beginner",
      title: "Meem, Noon, Wao", titleUr: "م ن و",
      objective: "Nayi keys: م (m), ن (n), و (w). Chhote lafz jorna seekhen.",
      text: "م ن و م ن و ن م و و م ن نام کام ہم تم من نم وم نم",
      targetWpm: 12, targetAcc: 92 },

    /* ============ INTERMEDIATE 6-12: words, joins, specials ============ */
    { id: 6, level: "intermediate",
      title: "Bay, Pay, Tay, Ttay", titleUr: "ب پ ت ٹ",
      objective: "Nayi keys: ب (b), پ (p), ت (t), ٹ (Shift+t).",
      text: "ب پ ت ٹ ب پ ت ٹ پ ب ٹ ت ٹ پ ب اب تب بت پت ٹب",
      targetWpm: 12, targetAcc: 92 },
    { id: 7, level: "intermediate",
      title: "Ray, Zay, Bari Yay", titleUr: "ر ز ے",
      objective: "Nayi keys: ر (r), ز (z), ے (y).",
      text: "ر ز ے ر ز ے ز ر ے رے زے زر رز",
      targetWpm: 14, targetAcc: 92 },
    { id: 8, level: "intermediate",
      title: "Special Letters", titleUr: "ی ء ہ ھ ں",
      objective: "Khaas haroof: ی (i), ء (u), ہ (o), ھ (Shift+h), ں (Shift+n).",
      text: "ی ء ہ ھ ں ی ء ہ ھ ں میں نہیں یہ وہ ھا",
      targetWpm: 14, targetAcc: 92 },
    { id: 9, level: "intermediate",
      title: "Common Words I", titleUr: "عام الفاظ",
      objective: "Roz ke chhote lafz tezi se likhna.",
      text: "اب سب تب جب ہم تم نام کام دن رات گھر",
      targetWpm: 15, targetAcc: 93 },
    { id: 10, level: "intermediate",
      title: "Common Words II", titleUr: "عام الفاظ",
      objective: "Lambay aam lafz: jorne ki mashq.",
      text: "کتاب قلم پانی روٹی بچہ سکول استاد کرسی",
      targetWpm: 16, targetAcc: 93 },
    { id: 11, level: "intermediate",
      title: "Joining Practice", titleUr: "جوڑ",
      objective: "Harfon ko jorna: darmiyani shaklon ki mashq.",
      text: "لکھنا پڑھنا سیکھنا کھانا پینا بولنا سننا",
      targetWpm: 16, targetAcc: 93 },
    { id: 12, level: "intermediate",
      title: "Noon Ghunna & Do-Chashmi", titleUr: "ں ھ",
      objective: "میں، نہیں، تمھیں — ں اور ھ ka sahih istemal.",
      text: "میں نہیں تمھیں انہیں چاند گندم مہینہ",
      targetWpm: 18, targetAcc: 93 },

    /* ============ ADVANCED 13-18: sentences, paragraphs, speed ============ */
    { id: 13, level: "advanced",
      title: "Short Sentences I", titleUr: "جملے",
      objective: "Mukammal jumlay: waqfa aur rawani.",
      text: "میرا نام احمد ہے۔ میں سکول جاتا ہوں۔ مجھے کتابیں پسند ہیں۔",
      targetWpm: 18, targetAcc: 93 },
    { id: 14, level: "advanced",
      title: "Short Sentences II", titleUr: "جملے",
      objective: "Zyada jumlay, musalsal rawani.",
      text: "اردو ہماری قومی زبان ہے۔ ہم روز اردو بولتے ہیں۔ اردو سیکھنا آسان ہے۔",
      targetWpm: 20, targetAcc: 94 },
    { id: 15, level: "advanced",
      title: "Paragraph I", titleUr: "پیراگراف",
      objective: "Lamba matn baghair rukay likhna.",
      text: "صبح سویرے سورج نکلتا ہے۔ پرندے چہچہاتے ہیں۔ بچے سکول جاتے ہیں۔ استاد پڑھاتے ہیں۔ سب خوش رہتے ہیں۔",
      targetWpm: 20, targetAcc: 94 },
    { id: 16, level: "advanced",
      title: "Paragraph II", titleUr: "پیراگراف",
      objective: "Tafseeli matn: tawajjuh aur raftaar.",
      text: "پاکستان ایک خوبصورت ملک ہے۔ یہاں پہاڑ، دریا اور میدان ہیں۔ لوگ محنتی اور مہمان نواز ہیں۔",
      targetWpm: 22, targetAcc: 94 },
    { id: 17, level: "advanced",
      title: "Speed Building", titleUr: "رفتار",
      objective: "Aam jumlon ko baar baar likh kar raftaar barhayen.",
      text: "اردو ٹائپنگ سیکھو روز پریکٹس کرو رفتار بڑھاؤ اردو ٹائپنگ سیکھو",
      targetWpm: 25, targetAcc: 94 },
    { id: 18, level: "advanced",
      title: "Mixed Review", titleUr: "اعادہ",
      objective: "Sab kuch aik sath: mushkil jor aur naye lafz.",
      text: "چھٹی کے دن ہم گھر پر تھے۔ امی نے کھانا بنایا۔ ابو بازار گئے۔",
      targetWpm: 25, targetAcc: 95 },

    /* ============ EXPERT 19-25: numbers, punctuation, mastery ============ */
    { id: 19, level: "expert",
      title: "Urdu Numerals", titleUr: "ہندسے",
      objective: "Urdu ginti: ۰ سے ۹ تک (number row).",
      text: "۰۱۲۳۴۵۶۷۸۹ ۱۲۳ ۴۵۶ ۷۸۹۰ ۱۲ ۳۴ ۵۶",
      targetWpm: 20, targetAcc: 95 },
    { id: 20, level: "expert",
      title: "Numbers + Urdu Mix", titleUr: "ہندسے اور الفاظ",
      objective: "Hinson aur lafzon ka imtizaaj.",
      text: "دکان پر ۱۰ روپے کی روٹی ملتی ہے۔ بس نمبر ۵ آئی۔",
      targetWpm: 25, targetAcc: 95 },
    { id: 21, level: "expert",
      title: "Punctuation Mastery", titleUr: "اوقاف",
      objective: "، ۔ ؛ ؟ — sahih auqaaf ka istemal.",
      text: "کیا حال ہے؟ میں ٹھیک ہوں، شکریہ! اردو خوبصورت زبان ہے؛ سب اسے پسند کرتے ہیں۔",
      targetWpm: 25, targetAcc: 95 },
    { id: 22, level: "expert",
      title: "Story I", titleUr: "کہانی",
      objective: "Lambi kahani: isteqamat aur tawajjuh.",
      text: "ایک دفعہ کا ذکر ہے کہ ایک گاؤں میں ایک لکڑہارا رہتا تھا۔ وہ روز جنگل جاتا اور لکڑیاں کاٹتا۔ ایک دن اس کی کلہاڑی دریا میں گر گئی۔",
      targetWpm: 28, targetAcc: 95 },
    { id: 23, level: "expert",
      title: "Story II", titleUr: "کہانی",
      objective: "Gehra matn: raftaar barqarar rakhen.",
      text: "محنت کامیابی کی کنجی ہے۔ جو لوگ دل لگا کر کام کرتے ہیں وہ ضرور کامیاب ہوتے ہیں۔ وقت کی قدر کرو اور ہمت نہ ہارو۔",
      targetWpm: 30, targetAcc: 95 },
    { id: 24, level: "expert",
      title: "Timed Challenge", titleUr: "مقابلہ",
      objective: "Imtihani matn: aala raftaar ka muzahira.",
      text: "علم انسان کی سب سے بڑی دولت ہے۔ کتابیں ہماری بہترین دوست ہیں۔ جو شخص پڑھتا ہے وہ کبھی ناکام نہیں ہوتا۔",
      targetWpm: 32, targetAcc: 96 },
    { id: 25, level: "expert",
      title: "Final Mastery", titleUr: "مہارت",
      objective: "Aakhri imtihan: sab kuch — harf, hinsay, auqaaf.",
      text: "اردو ۲۰۲۶ میں بھی زندہ ہے! کیا آپ ۱۰۰ الفاظ فی منٹ ٹائپ کر سکتے ہیں؟ پریکٹس، محنت اور لگن سے سب ممکن ہے۔",
      targetWpm: 35, targetAcc: 96 }
  ];

  /* Timed test passages (1/3/5 min) */
  window.URDU_TESTS = [
    { id: "t1", title: "روزمرہ", titleEn: "Daily Life",
      text: "صبح اٹھ کر میں وضو کرتا ہوں اور نماز پڑھتا ہوں۔ پھر ناشتہ کرتا ہوں اور سکول جاتا ہوں۔ سکول میں استاد ہمیں اردو، حساب اور انگریزی پڑھاتے ہیں۔ چھٹی کے بعد میں گھر آ کر کھانا کھاتا ہوں اور کھیلتا ہوں۔ شام کو میں سبق یاد کرتا ہوں۔ رات کو جلدی سو جاتا ہوں تاکہ صبح تازہ دم اٹھوں۔" },
    { id: "t2", title: "پاکستان", titleEn: "Pakistan",
      text: "پاکستان جنوبی ایشیا کا ایک اہم ملک ہے۔ اس کا دارالحکومت اسلام آباد ہے۔ کراچی سب سے بڑا شہر اور معاشی مرکز ہے۔ لاہور ثقافتی دل کہلاتا ہے۔ یہاں اردو قومی زبان ہے۔ پاکستان کے شمال میں دنیا کے بلند ترین پہاڑ ہیں جن میں کے ٹو بھی شامل ہے۔ دریائے سندھ اس ملک کی شہ رگ ہے۔" },
    { id: "t3", title: "علم کی اہمیت", titleEn: "Knowledge",
      text: "علم وہ روشنی ہے جو جہالت کے اندھیروں کو دور کرتی ہے۔ جو قومیں علم حاصل کرتی ہیں وہ ترقی کرتی ہیں۔ کتاب انسان کی بہترین دوست ہے۔ پڑھنے کی عادت انسان کو دانشمند بناتی ہے۔ ہمیں چاہیے کہ روز کچھ نہ کچھ پڑھیں۔ علم کبھی ضائع نہیں ہوتا۔ محنت اور لگن سے ہر مشکل آسان ہو جاتی ہے۔" }
  ];

  window.URDU_LEVELS = [
    { id: "beginner", name: "Beginner", nameUr: "ابتدائی", range: [1, 5], color: "#22c55e" },
    { id: "intermediate", name: "Intermediate", nameUr: "درمیانہ", range: [6, 12], color: "#3b82f6" },
    { id: "advanced", name: "Advanced", nameUr: "اعلیٰ", range: [13, 18], color: "#f59e0b" },
    { id: "expert", name: "Expert", nameUr: "ماہر", range: [19, 25], color: "#ef4444" }
  ];
})();
