# TypeMaster

**TypeMaster** — "Type Faster. Type Better." / "تیز لکھیں، بہتر لکھیں"

A free, bilingual (English + اردو) touch-typing tutor: structured lessons,
timed typing tests, typing games, smart practice drills, printable
certificates, and progress tracking. Plain HTML/CSS/JS only — no build
tools, no CDNs, no external requests. Deploy as-is to GitHub Pages (or open
`index.html` in any modern browser).

## Pages

- `index.html` — Home: hero with live typing demo, features, plans
- `signup.html` / `login.html` — Account creation and login
- `dashboard.html` — Continue learning, best WPM, streak, problem keys
- `lessons.html` — Lesson tracks: Beginner / Intermediate / Advanced / Story
- `lesson.html?id=` — Lesson player (typing engine + keyboard guide)
- `test.html` — Timed tests (1–10 min), categories, custom text
- `results.html` — Gross/Net WPM, accuracy, per-key table
- `progress.html` — Trend chart, streak calendar, goals, badges
- `profile.html` — Name/password, theme, language, data export, reset
- `games.html` — Word Fall and Word Sprint typing games
- `practice.html` — Smart drills from your problem keys + common words
- `certificate.html` — Printable typing certificate
- `faq.html` — Typing guides (WPM, accuracy, speed tips)

## Folder structure

```
├── css/
│   ├── main.css      Design system (variables, light/dark, RTL-ready, print)
│   └── player.css    Typing player + on-screen keyboard
├── js/
│   ├── urdu.js       EN + UR string tables (data-i18n)
│   ├── urdu2.js      Additional EN + UR strings (merged into I18N)
│   ├── storage.js    Data layer (localStorage, tm_* keys), async API
│   ├── ui.js         Nav/footer injection, theme + language toggles
│   ├── curriculum.js 44 original lessons with progressive key groups
│   ├── test-data.js  Original test passages (Standard/Advanced/Pro)
│   ├── engine.js     Hidden-input keystroke engine, live stats
│   ├── keyboard.js   QWERTY guide, finger-zone colors, next-key highlight
│   ├── gamification.js XP, levels, badges, streaks
│   ├── charts.js     Dependency-free canvas trend chart + streak calendar
│   ├── games.js      Word Fall + Word Sprint game logic
│   ├── practice.js   Smart practice drills + top-200 word list
│   ├── certificate.js Certificate data fill
│   └── pages/        One script per HTML page (no inline scripts)
├── sitemap.xml / robots.txt   SEO basics
└── README.md
```

## Key mechanics

- **WPM formulas** — Gross = (chars/5)/min, Net = (correct chars/5)/min,
  Accuracy = correct/total keystrokes × 100.
- **Unlock gating** — 90%+ accuracy required to unlock the next lesson.
  Stars: 3 ≥97%, 2 ≥93%, 1 ≥90%.
- **Problem keys** — per-key accuracy tracked across sessions; weakest keys
  surface on the dashboard and feed Smart Practice drills.
- **i18n** — toggle in nav; `document.dir=rtl` + Urdu strings when Urdu
  selected. Lesson/test *content* stays English (typing is English-keyboard).
- **Auth** — browser-local accounts; passwords stored as salted SHA-256
  hashes (SubtleCrypto, with fallback), never plaintext.
- **Security** — strict Content Security Policy on every page, zero inline
  scripts, all user data rendered via `textContent`.

## Privacy

All data (account, progress, scores) stays in the visitor's own browser
(localStorage). Nothing is uploaded anywhere.
