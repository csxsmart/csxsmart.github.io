# csxsmart.github.io

Personal academic homepage of **Sixing Chen (陈思行)** — Applied Physics @ Southeast University.

Live site: https://csxsmart.github.io

## Structure

```
.
├── index.html          # Single-page site (all sections)
├── assets/
│   ├── style.css       # Styles (light + dark theme, responsive)
│   ├── main.js         # Theme toggle, mobile nav, scroll reveal
│   └── profile.jpg     # ← Add your portrait here (260×300+ recommended)
└── README.md
```

## Features

- Bilingual 中文 / English toggle (auto-detects browser language, remembers your choice)
- Responsive layout (desktop → mobile) with a collapsible nav
- Light / dark mode toggle (remembers your choice)
- Sections: About · Research · Projects · Publications · Awards · Skills · News · Contact
- No build step, no dependencies — pure HTML/CSS/JS
- Fonts from Google Fonts (Newsreader + Inter + JetBrains Mono)

## How to customize

Everything lives in `index.html`. Common edits:

| What to change | Where |
|----------------|-------|
| Your photo | Add `assets/profile.jpg` |
| CV / resume | Add `assets/cv.pdf` (the "Curriculum Vitae" button links to it) |
| Add a project | Copy a `<article class="project">…</article>` block in the Projects section |
| Add a publication | Copy a `<li class="pub">…</li>` block in the Publications section |
| Add a news item | Copy a `<li>` in the News section |
| Accent color | Edit `--accent` in `assets/style.css` |
| Links (GitHub / email / Scholar) | Search for `href=` in `index.html` |

## Preview locally

```bash
npx http-server -p 8080
# then open http://localhost:8080
```

## Deploy

Push to the `main` branch of `csxsmart/csxsmart.github.io` — GitHub Pages serves it automatically at https://csxsmart.github.io.
