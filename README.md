# TypeMaster — Stage 1 (MVP)

**TypeMaster** — "Type Faster. Type Better." / "تیز لکھیں، بہتر لکھیں"

A free, bilingual (English + اردو) touch-typing tutor: structured lessons,
timed typing tests, and smart progress tracking. Plain HTML/CSS/JS only —
no build tools, no CDNs. Deploy as-is to GitHub Pages (or open `index.html`
in any modern browser).

## Folder structure

```
typemaster-site/
├── index.html        Home — hero, features, pricing glimpse
├── signup.html       Account creation (SHA-256 hashed passwords)
├── login.html        Login + demo forgot-password
├── dashboard.html    Continue lesson, best WPM, streak, problem keys
├── lessons.html      Beginner / Intermediate / Advanced lesson cards
├── lesson.html?id=   Lesson player (typing engine + keyboard guide)
├── test.html         Category + duration picker, test player, custom text
├── results.html      Gross/Net WPM, accuracy, per-key table, share card
├── progress.html     Trend chart, streak calendar, goals, badges
├── profile.html      Name/password, theme, language, data export, reset
├── css/
│   ├── main.css      Design system (variables, light/dark, RTL-ready)
│   └── player.css    Typing player + on-screen keyboard
├── js/
│   ├── urdu.js       EN + UR string tables (data-i18n)
│   ├── storage.js    Data layer (localStorage, tm_* keys) — clean async
│   │                 API so Firebase Auth/Firestore can replace it later
│   ├── ui.js         Nav/footer injection, theme + language toggles
│   ├── curriculum.js 25 original lessons with progressive key groups
│   ├── test-data.js  Original test passages (Standard/Advanced/Pro)
│   ├── engine.js     Hidden-input keystroke engine, live stats
│   ├── keyboard.js   QWERTY guide, finger-zone colors, next-key highlight
│   ├── gamification.js XP, levels, badges, streaks
│   └── charts.js     Dependency-free canvas trend chart + streak calendar
├── sitemap.xml / robots.txt   SEO basics
└── README.md
```

## Key mechanics

- **WPM formulas** — Gross = (chars/5)/min, Net = (correct chars/5)/min,
  Accuracy = correct/total keystrokes × 100.
- **Unlock gating** — 90%+ accuracy required to unlock the next lesson.
  Stars: 3 ≥97%, 2 ≥93%, 1 ≥90%.
- **Problem keys** — per-key accuracy tracked across sessions; weakest keys
  surface on the dashboard.
- **i18n** — toggle in nav; `document.dir=rtl` + Urdu strings when Urdu
  selected. Lesson/test *content* stays English (typing is English-keyboard).
- **Auth** — demo-grade localStorage auth; passwords stored as SHA-256
  hashes (SubtleCrypto, with fallback), never plaintext.

## Roadmap

- **Stage 2:** Paddle billing (Free/Pro/School), certificates, blog + FAQ (SEO/AEO)
- **Stage 3:** Teacher dashboard, Urdu-keyboard typing lessons
