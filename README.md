# Cloud Native Security Pakistan (CNSPK) Website · v2

> The official community hub for Cloud Native Security Pakistan. Now in the **Electric register** — italic display caps, lime on carbon, mono UI, Urdu accent. Built. Tested. Pakistani.

## 🚀 Overview

This repository hosts the static frontend for the CNSPK community site. It runs on **GitHub Pages** with clean URLs, vanilla ES6 modules, and JSON-driven content. No build step, no backend.

**v2 is a rebrand**, not a rewrite. The stack stays. The look, voice, and naming change.

- **CNSPK** is the canonical acronym (not "CNSP", not "CNCF Pakistan").
- The visual register is **Electric** — see `AGENT_BRIEF.md` for the full token set, voice rules, and naming conventions.
- All design tokens live in `/css/tokens.css`. Components consume tokens; pages compose components.

### Features

- **Interactive Member Map**: Community distribution across Pakistan via Leaflet.js (`/members/`).
- **Events Hub**: Real-time meetup listings (`/events/`).
- **Sessions Hub**: Talks with summaries, transcripts, and recording links (`/sessions/`).
- **Clean URLs**: `/sessions/view/?id=1`-style routing, no hashbangs.
- **Member Directory**: Filterable, role-aware split view.
- **Electric Register**: Italic display caps, mono UI labels, lime CTAs with offset shadow, Urdu accent in low-opacity gold.

## 🛠 Tech Stack

- **Core**: HTML5, ES6 Modules, vanilla JS (no framework).
- **Styling**: CSS custom properties (`/css/tokens.css`) + Tailwind via CDN for utility composition.
- **Type**: Bricolage Grotesque (display, italic 800), Inter (body), JetBrains Mono (UI/terminal), Noto Nastaliq Urdu (accent), all via Google Fonts CDN.
- **Map**: Leaflet.js + CartoDB Dark Matter tiles.
- **Security**: DOMPurify for XSS protection, strict CSP headers per page.
- **CI/CD**: GitHub Actions for lint + integrity checks.

## 📂 Project Structure

```
cloudnativesecurity.pk-website-v2/
├── AGENT_BRIEF.md       # 📌 Read first — design tokens, voice, naming, constraints
├── css/
│   ├── tokens.css         # Electric register tokens + utilities (link first on every page)
│   └── input.css          # Tailwind input (legacy; tokens.css is the source of truth)
├── data/                  # JSON data — schemas frozen, do not change
│   ├── events.json
│   ├── members.json
│   ├── sessions.json
│   └── team.json
├── js/                    # ES6 modules
│   ├── Navbar.js          # Sticky top nav with brand-shield + mono links + Join CTA
│   ├── Footer.js          # 4-column grid + Urdu tagline + bharosa command-line stamp
│   ├── utils.js           # fetchData, sanitize, domReady, debounce
│   ├── EventCard.js
│   ├── SessionCard.js
│   ├── SessionDetail.js
│   ├── MemberCard.js
│   ├── FilterPanel.js
│   └── Map.js
├── about/        members/        events/        sessions/
├── team/         consultants/    join/          brand/
├── projects/
└── README.md
```

## ⚡ Quick Start

1. **Clone**:
   ```bash
   git clone https://github.com/cloudnativesecurity-pk/website.git
   cd website
   ```

2. **Serve locally** (ES6 modules require a real HTTP server):
   ```bash
   # Python 3
   python -m http.server 3000

   # Node
   npx serve .

   # Or use the included Windows helper
   ./server.ps1
   ```

3. **Open** `http://localhost:3000`.

## 🎨 Working on the rebrand

If you're picking up a slice of the v2 revamp:

1. **Read `AGENT_BRIEF.md` first.** It defines tokens, voice, naming, and the hard rules (no fabricated data, CNSPK not CNSP, real socials only).
2. **Use `/css/tokens.css` for everything.** Custom properties cover color, type, motion, radius, shadow. Utility classes (`.brand-shield`, `.section-eyebrow`, `.btn-primary`, `.btn-secondary`, `.status-pill`, `.stamp`) compose the rest.
3. **Components mount themselves.** Pages drop in `<div id="navbar"></div>` and `<div id="footer"></div>`, then call `new Navbar().init()` and `new Footer().init()` from a module script.
4. **Sample reference**: `CNSPK-Rebrand-Research/sample-site.html` is the visual ground truth.
5. **Stay in your stream.** If you're working on a specific stream (Foundation, Pages, Components, Data), only touch the files listed in your prompt.

### Page boilerplate

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CNSPK · Page title</title>
  <link rel="stylesheet" href="/css/tokens.css" />
  <!-- page-specific styles inline -->
</head>
<body>
  <div id="navbar"></div>
  <main>
    <!-- page content -->
  </main>
  <div id="footer"></div>
  <script type="module">
    import { Navbar } from '/js/Navbar.js';
    import { Footer } from '/js/Footer.js';
    new Navbar().init();
    new Footer().init();
  </script>
</body>
</html>
```

## 🤝 Contributing

1. **Fork** the repository.
2. **Branch** off main: `git checkout -b feature/your-thing`.
3. **Commit** your changes.
4. **Push** to your branch.
5. **Open a PR** to `main`.

### CI checks

The PR pipeline runs:

- **Lint** — JS style and error checks.
- **Build** — CSS sanity (Tailwind compiles, tokens parse).
- **Tests** — basic integrity.

PRs must pass before merge. If something fails, click "Details" on the failing check.

### Common tasks

- **Add yourself as a member** — edit `data/members.json`.
- **Submit an event** — edit `data/events.json`.
- **Fix a bug** — open a PR with the fix and a short description of the cause.
- **Style change** — first check if a token exists in `/css/tokens.css`. If yes, use it. If no, add it there before using inline.

## 🔒 Security

- **Sanitization**: all dynamic HTML passes through DOMPurify (`utils.sanitize`).
- **Map privacy**: OpenStreetMap tiles, no API keys client-side.
- **CSP**: strict per-page Content Security Policy headers.

## 📜 License

MIT License © Cloud Native Security Pakistan
