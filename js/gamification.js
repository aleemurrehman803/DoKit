/* ============================================================
   TypeMaster — gamification.js : XP, levels, badges, streaks
   Works on top of DB (storage.js). Call Game.afterActivity()
   after a lesson or test completes.
   ============================================================ */

const BADGES = [
  { id: "first-steps", icon: "👣", en: "First Steps", ur: "پہلا قدم", desc_en: "Complete your first lesson", desc_ur: "پہلا سبق مکمل کریں" },
  { id: "tester", icon: "⏱️", en: "Time Trialist", ur: "ٹیسٹ دینے والا", desc_en: "Finish your first timed test", desc_ur: "پہلا وقت والا ٹیسٹ مکمل کریں" },
  { id: "sharpshooter", icon: "🎯", en: "Sharpshooter", ur: "نشانہ باز", desc_en: "Score 100% accuracy in a lesson", desc_ur: "کسی سبق میں 100 فیصد درستگی" },
  { id: "streak3", icon: "🔥", en: "Warming Up", ur: "گرم ہو رہے ہیں", desc_en: "Practice 3 days in a row", desc_ur: "لگاتار 3 دن مشق" },
  { id: "streak7", icon: "🔥", en: "On Fire", ur: "آگ لگی ہے", desc_en: "Practice 7 days in a row", desc_ur: "لگاتار 7 دن مشق" },
  { id: "speed40", icon: "💨", en: "Speedster", ur: "تیز رفتار", desc_en: "Reach 40 net WPM", desc_ur: "40 خالص WPM حاصل کریں" },
  { id: "speed60", icon: "🚀", en: "Rocket Fingers", ur: "راکٹ انگلیاں", desc_en: "Reach 60 net WPM", desc_ur: "60 خالص WPM حاصل کریں" },
  { id: "speed80", icon: "⚡", en: "Lightning", ur: "بجلی", desc_en: "Reach 80 net WPM", desc_ur: "80 خالص WPM حاصل کریں" },
  { id: "scholar", icon: "🎓", en: "Graduate", ur: "گریجویٹ", desc_en: "Finish all beginner lessons", desc_ur: "تمام ابتدائی اسباق مکمل کریں" },
  { id: "marathon", icon: "🏁", en: "Marathoner", ur: "لمبی دوڑ", desc_en: "Complete a 10-minute test", desc_ur: "10 منٹ کا ٹیسٹ مکمل کریں" }
];

const Game = {
  XP_LESSON: 50,
  XP_TEST: 30,
  XP_PERFECT: 25,   // bonus for 100% accuracy

  /* Called after any completed activity. Returns newly earned badge ids. */
  afterActivity(kind, result) {
    const earned = [];
    const give = id => { if (DB.awardBadge(id)) earned.push(id); };

    if (kind === "lesson") {
      DB.addXP(this.XP_LESSON + (result.acc >= 100 ? this.XP_PERFECT : 0));
      give("first-steps");
      if (result.acc >= 100) give("sharpshooter");
      const p = DB.getProgress();
      const doneBeginner = CURRICULUM.filter(l => l.level === "beginner").every(l => p.lessons[l.id] && p.lessons[l.id].done);
      if (doneBeginner) give("scholar");
    } else if (kind === "test") {
      DB.addXP(this.XP_TEST);
      give("tester");
      if (result.nwpm >= 40) give("speed40");
      if (result.nwpm >= 60) give("speed60");
      if (result.nwpm >= 80) give("speed80");
      if (result.dur >= 600) give("marathon");
      const streak = DB.touchStreak();
      if (streak >= 3) give("streak3");
      if (streak >= 7) give("streak7");
    } else {
      DB.touchStreak();
    }
    return earned;
  },

  badgeInfo(id, lang) {
    const b = BADGES.find(x => x.id === id);
    if (!b) return null;
    const ur = lang === "ur";
    return { icon: b.icon, name: ur ? b.ur : b.en, desc: ur ? b.desc_ur : b.desc_en };
  }
};
