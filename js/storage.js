/* ============================================================
   TypeMaster — storage.js : data layer abstraction
   Backend is localStorage TODAY. The DB object exposes a clean
   async API so Firebase Auth + Firestore can replace the inside
   of these functions later WITHOUT touching any other file.
   All keys are namespaced with tm_.
   ============================================================ */

const TM = {
  users: "tm_users",        // [{name,email,passHash,createdAt}]
  session: "tm_session",    // {email} | null
  settings: "tm_settings",  // {lang:'en'|'ur', theme:'light'|'dark'}
  progPrefix: "tm_prog_"    // per-user progress objects
};

/* ---------- low-level helpers ---------- */
function lsGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch (e) { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch (e) { return false; }
}
function lsDel(key) { try { localStorage.removeItem(key); } catch (e) {} }

/* SHA-256 via SubtleCrypto; falls back to a simple hash when
   crypto.subtle is unavailable (e.g. file:// in some browsers). */
async function hashPassword(pw) {
  const salted = "typemaster$" + pw;
  try {
    if (crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salted));
      return "sha256$" + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (e) { /* fall through to fallback */ }
  // Fallback: cyrb53 (non-crypto, better than plaintext)
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < salted.length; i++) {
    const ch = salted.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return "cyrb53$" + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

function blankProgress() {
  return {
    lessons: {},          // lessonId -> {stars, acc, done:true}
    tests: [],            // [{date, cat, dur, gwpm, nwpm, acc, typos}]
    keyStats: {},         // char -> {ok, n}
    streak: { count: 0, last: null },
    goals: { targetWpm: 40 },
    xp: 0,
    badges: []            // [badgeId]
  };
}

/* ============================================================
   DB — the only object pages talk to. Keep every data access here.
   ============================================================ */
const DB = {
  /* ----- auth ----- */
  async signup(name, email, password) {
    email = email.trim().toLowerCase();
    const users = lsGet(TM.users, []);
    if (users.some(u => u.email === email)) return { ok: false, error: "taken" };
    const passHash = await hashPassword(password);
    users.push({ name: name.trim(), email, passHash, createdAt: Date.now() });
    lsSet(TM.users, users);
    lsSet(TM.progPrefix + email, blankProgress());
    lsSet(TM.session, { email });
    return { ok: true };
  },

  async login(email, password) {
    email = email.trim().toLowerCase();
    const users = lsGet(TM.users, []);
    const u = users.find(x => x.email === email);
    if (!u) return { ok: false, error: "nouser" };
    const h = await hashPassword(password);
    if (h !== u.passHash) return { ok: false, error: "wrongpw" };
    lsSet(TM.session, { email });
    return { ok: true };
  },

  logout() { lsDel(TM.session); },

  currentUser() {
    const s = lsGet(TM.session, null);
    if (!s) return null;
    const users = lsGet(TM.users, []);
    return users.find(u => u.email === s.email) || null;
  },

  requireUser() {
    const u = this.currentUser();
    if (!u) { location.href = "login.html"; return null; }
    return u;
  },

  async updateName(name) {
    const u = this.currentUser(); if (!u) return false;
    const users = lsGet(TM.users, []);
    const rec = users.find(x => x.email === u.email);
    rec.name = name.trim(); lsSet(TM.users, users);
    return true;
  },

  async updatePassword(oldPw, newPw) {
    const u = this.currentUser(); if (!u) return { ok: false };
    const users = lsGet(TM.users, []);
    const rec = users.find(x => x.email === u.email);
    if ((await hashPassword(oldPw)) !== rec.passHash) return { ok: false, error: "oldpw" };
    rec.passHash = await hashPassword(newPw);
    lsSet(TM.users, users);
    return { ok: true };
  },

  /* ----- progress (per logged-in user) ----- */
  _pkey() {
    const u = this.currentUser();
    return u ? TM.progPrefix + u.email : null;
  },
  getProgress() {
    const k = this._pkey();
    if (!k) return blankProgress();
    const p = lsGet(k, null);
    return p || blankProgress();
  },
  _saveProgress(p) { const k = this._pkey(); if (k) lsSet(k, p); },

  saveLessonResult(lessonId, acc) {
    const p = this.getProgress();
    const stars = acc >= 97 ? 3 : acc >= 93 ? 2 : 1;
    const prev = p.lessons[lessonId];
    if (!prev || stars > prev.stars) p.lessons[lessonId] = { stars, acc: Math.round(acc * 10) / 10, done: true };
    this._saveProgress(p);
    return stars;
  },

  saveTestResult(r) {
    const p = this.getProgress();
    p.tests.unshift({ date: Date.now(), cat: r.cat, dur: r.dur, gwpm: r.gwpm, nwpm: r.nwpm, acc: r.acc, typos: r.typos });
    if (p.tests.length > 100) p.tests.length = 100;
    this._saveProgress(p);
  },

  recordKeyStats(delta) {
    // delta: {char: {ok: n, bad: n}}
    const p = this.getProgress();
    for (const ch in delta) {
      if (!p.keyStats[ch]) p.keyStats[ch] = { ok: 0, n: 0 };
      p.keyStats[ch].ok += delta[ch].ok || 0;
      p.keyStats[ch].n += (delta[ch].ok || 0) + (delta[ch].bad || 0);
    }
    this._saveProgress(p);
  },

  problemKeys(limit) {
    const p = this.getProgress();
    return Object.entries(p.keyStats)
      .filter(([, s]) => s.n >= 5)
      .map(([ch, s]) => ({ ch, acc: s.ok / s.n, n: s.n }))
      .sort((a, b) => a.acc - b.acc)
      .slice(0, limit || 8);
  },

  touchStreak() {
    const p = this.getProgress();
    const today = new Date().toDateString();
    if (p.streak.last === today) return p.streak.count;
    const yesterday = new Date(Date.now() - 864e5).toDateString();
    p.streak.count = (p.streak.last === yesterday) ? p.streak.count + 1 : 1;
    p.streak.last = today;
    this._saveProgress(p);
    return p.streak.count;
  },

  addXP(n) {
    const p = this.getProgress();
    p.xp += n;
    this._saveProgress(p);
    return p.xp;
  },
  level() { return Math.floor(this.getProgress().xp / 200) + 1; },

  awardBadge(id) {
    const p = this.getProgress();
    if (!p.badges.includes(id)) { p.badges.push(id); this._saveProgress(p); return true; }
    return false;
  },

  setGoal(wpm) {
    const p = this.getProgress();
    p.goals.targetWpm = Math.max(10, Math.min(200, wpm | 0));
    this._saveProgress(p);
  },

  bestWPM() {
    const p = this.getProgress();
    return p.tests.reduce((m, t) => Math.max(m, t.nwpm || 0), 0);
  },

  /* ----- settings (global, not per-user) ----- */
  getSettings() { return Object.assign({ lang: "en", theme: "light" }, lsGet(TM.settings, {})); },
  saveSettings(s) { lsSet(TM.settings, Object.assign(this.getSettings(), s)); },

  /* ----- data portability ----- */
  exportData() {
    const u = this.currentUser(); if (!u) return null;
    return JSON.stringify({ user: { name: u.name, email: u.email }, progress: this.getProgress() }, null, 2);
  },
  resetProgress() {
    const k = this._pkey(); if (k) lsSet(k, blankProgress());
  }
};
