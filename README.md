# TypeMaster

**TypeMaster** — "Type Faster. Type Better." / "تیز لکھیں، بہتر لکھیں"

A free, bilingual (English + اردو) touch-typing tutor: structured lessons,
timed typing tests, and smart progress tracking. Plain HTML/CSS/JS only —
no build tools, no external CDNs. Open `index.html` in any modern browser,
or deploy as-is to any static host (e.g. GitHub Pages).

## Features

- Step-by-step lessons (beginner → intermediate → advanced) with 90%+
  accuracy gating between lessons
- Timed typing tests (1–10 minutes) across Standard, Advanced and
  Professional categories, plus custom text
- Live WPM and accuracy feedback, per-key analysis, problem-key detection
- Accounts with progress, streaks, XP/levels, badges and goals
  (stored locally in the browser)
- English/Urdu interface with RTL support, light/dark themes, responsive
  mobile layout

## Folder structure

```
├── index.html        Home
├── signup.html       Account creation
├── login.html        Login
├── dashboard.html    Stats overview
├── lessons.html      Lesson catalog
├── lesson.html?id=   Lesson player
├── test.html         Typing test
├── results.html      Test results
├── progress.html     Charts, streaks, goals, badges
├── profile.html      Settings and data export
├── css/
│   ├── main.css      Design system (light/dark, RTL-ready)
│   └── player.css    Typing player + on-screen keyboard
├── js/
│   ├── urdu.js       English + Urdu string tables
│   ├── storage.js    Data layer (browser localStorage)
│   ├── ui.js         Navigation, footer, theme/language toggles
│   ├── curriculum.js Lesson content
│   ├── test-data.js  Test passages
│   ├── engine.js     Keystroke-capture typing engine
│   ├── keyboard.js   On-screen keyboard with finger guidance
│   ├── gamification.js XP, levels, badges, streaks
│   ├── charts.js     Canvas trend chart + streak calendar
│   └── pages/        One init script per page
├── sitemap.xml / robots.txt   SEO basics
└── README.md
```

## How scores work

- **Gross WPM** = (characters typed ÷ 5) ÷ minutes
- **Net WPM** = (correct characters ÷ 5) ÷ minutes
- **Accuracy** = correct keystrokes ÷ total keystrokes × 100
- Stars per lesson: 3 stars ≥ 97%, 2 stars ≥ 93%, 1 star ≥ 90%

## Privacy

All data stays in your own browser (localStorage). Passwords are stored
as salted SHA-256 hashes, never as plain text. No data is sent to any
server.
