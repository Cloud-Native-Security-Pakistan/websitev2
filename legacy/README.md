# Cloud Native Security Pakistan (CNSPK) Website

> The official community hub for Cloud Native Security Pakistan, built with a modern glitch/cyberpunk aesthetic.

## 🚀 Overview

This repository hosts the static frontend for the CNSPK community website. It is designed to be hosted on **GitHub Pages** with a modern, "app-like" experience using clean URLs and dynamic client-side fetching.

### Features
- **Interactive Map**: Visualize the community distribution across Pakistan using Leaflet.js (`/members/`).
- **Dynamic Events**: Fetches recent community events and displays them in a responsive grid (`/events/`).
- **Sessions Hub**: A dedicated platform for online talks, featuring AI-generated summaries, transcripts, and premium video player experiences (`/sessions/`).
- **Clean URLs**: Modern URL structure (e.g., `/sessions/view/?id=1`) for a professional look.
- **Member Directory**: Filterable list of members with a split-view dashboard layout.
- **Cyber Aesthetic**: Custom Tailwind CSS design system with glitch effects, glowing text, and glassmorphism.

## 🛠 Tech Stack

- **Core**: HTML5, Modern JavaScript (ES6+ Modules)
- **Styling**: Tailwind CSS v4 (Custom Glitch/Neon Theme)
- **Map**: Leaflet.js + CartoDB Dark Matter Tiles
- **Security**: DOMPurify for XSS protection, strict CSP headers
- **CI/CD**: GitHub Actions for minimal testing and build checks

## 📂 Project Structure

```
cnsp-website/
├── assets/          # Static assets (logos, placeholders)
├── css/             # Custom styles and Tailwind input
├── data/            # JSON Data Store
│   ├── events.json    # Community events
│   ├── members.json   # Member directory
│   ├── sessions.json  # Online sessions & AI transcripts
│   └── team.json      # Core team members
├── js/              # Modular Components
│   ├── EventCard.js     # Event display component
│   ├── SessionCard.js   # Session list item component
│   ├── SessionDetail.js # Full session view with AI features
│   ├── Navbar.js        # Responsive navigation
│   └── ...
├── events/          # Events page (index.html)
├── members/         # Members map dashboard
├── sessions/        # Sessions hub
│   ├── view/          # Individual session detail view
└── README.md        # Documentation
```

## ⚡ Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/cloudnativesecurity-pk/website.git
   cd website
   ```

2. **Run locally**:
   You need a local server to handle ES6 modules and routing.
   ```bash
   # Using Python 3
   python -m http.server 3000
   
   # Using Node.js
   npx serve .
   ```

3. **Open in Browser**:
   Navigate to `http://localhost:3000`.

## 🤝 Contributing

We welcome contributions from the community!

### How to Contribute

1.  **Fork** the repository.
2.  **Create a branch** for your feature or fix (`git checkout -b feature/amazing-feature`).
3.  **Commit** your changes.
4.  **Push** to your branch.
5.  **Open a Pull Request** to the `main` branch.

### 🧪 CI/CD Checks

We have an automated pipeline set up to ensure code quality. When you open a Pull Request, the following checks will run:

-   **Linting**: Checks for JavaScript errors and code style issues.
-   **Build**: Verifies that the CSS builds correctly with Tailwind.
-   **Tests**: Runs basic integrity tests.

**✅ Your PR must pass these checks to be merged.** If a check fails, click on "Details" next to the failure to see what went wrong.

### Common Tasks
-   **Add yourself as a member**: Edit `data/members.json`.
-   **Submit an Event**: Update `data/events.json`.
-   **Fix a bug**: Submit a PR with the fix and description.

## 🔒 Security

- **Sanitization**: All HTML rendering passes through `DOMPurify`.
- **Map Privacy**: We use OpenStreetMap tiles; no client-side API keys are exposed.

## 📜 License

MIT License © Cloud Native Security Pakistan
