# Security Policy

Cloud Native Security Pakistan (CNSPK) runs this site as a **static website** —
plain HTML, vanilla ES6 modules, and JSON data — deployed to **GitHub Pages**
from the repository root. There is no backend, no database, and no server-side
code. This document describes the controls that are *actually* in place and how
to report a vulnerability. We keep it honest: if a control isn't configured, we
don't claim it.

## How to Report a Vulnerability

If you discover a security vulnerability, please **do not** open a public issue.

Email **security@cloudnativesecurity.pk** with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- A suggested fix, if you have one

We aim to acknowledge reports within **48 hours** and will work with you on a
fix and coordinated disclosure. A machine-readable contact is published at
[`/.well-known/security.txt`](/.well-known/security.txt) per RFC 9116.

## What's Actually in Place

### Content Security Policy (per-page `<meta>`)

GitHub Pages **cannot set custom HTTP response headers**. As a result, the site
**cannot** send header-based controls such as `Content-Security-Policy`,
`Strict-Transport-Security` (HSTS), `X-Content-Type-Options`, or
`X-Frame-Options`. Any such header would have to come from a reverse proxy or a
different host, and we do not run one.

Instead, each page declares a Content Security Policy via a
`<meta http-equiv="Content-Security-Policy">` tag in its `<head>`. The policy
restricts `default-src` to `'self'` and explicitly allowlists only the origins
the site genuinely uses (Google Fonts, and on data-driven pages the CDNs and
image hosts those pages load from).

**Known limitation:** the `frame-ancestors` directive is **not enforceable via a
`<meta>` tag** — browsers only honour it when delivered as an HTTP header. On
GitHub Pages we therefore cannot enforce clickjacking protection through CSP.
This is a documented constraint of the hosting platform, not an oversight.

HTTPS itself is provided and enforced by GitHub Pages for the
`cloudnativesecurity.pk` custom domain (the "Enforce HTTPS" setting), not by
anything in this repository.

### Client-Side Input Handling

Pages render content from the JSON files in `data/`. Where dynamic or
externally-sourced strings are injected into the DOM, they are sanitized with
**DOMPurify** before insertion. External links open with
`rel="noopener noreferrer"` and use HTTPS.

### Automation in this Repository

This repository contains exactly **two** GitHub Actions workflows:

1. **`.github/workflows/pages.yml`** — builds and deploys the site to GitHub
   Pages on pushes to `main`. Before publishing, it prunes repository-internal
   files (for example `tools/`, Markdown docs, and `package.json`) from the
   deployed artifact so they are not served.
2. **`.github/workflows/pr-checks.yml`** — runs on pull requests against `main`.
   It installs dependencies, runs the linter (`npm run lint`), builds CSS
   (`npm run build:css`), and runs `npm test`. The test step is currently a
   placeholder that passes; it exists so the job is wired up for real tests
   later.

**Dependency updates** are automated with **Dependabot**
(`.github/dependabot.yml`), which opens weekly update PRs for the `npm` and
`github-actions` ecosystems.

### What We Do *Not* Run

To set expectations accurately, the following are **not** configured in this
repository, despite being common in larger projects:

- No secrets-scanning workflow (e.g. Gitleaks)
- No container/dependency vulnerability scanner (e.g. Trivy)
- No static analysis / SAST (e.g. CodeQL)
- No end-to-end or cross-browser test suite
- No pre-commit or pre-push git hooks enforced by this repo
- No header-based security controls (see the CSP section above for why)

If any of these are added later, this document will be updated to match.

## Guidance for Contributors

1. **Never commit secrets.** The site is fully static and client-side; anything
   committed is public. There is no server to hold a secret.
2. **Sanitize injected content.** Run dynamic strings through DOMPurify before
   writing them into the DOM.
3. **Keep external resources HTTPS-only** and add `rel="noopener noreferrer"` to
   links that open in a new tab.
4. **Update the page CSP when you add an origin.** If a page starts loading from
   a new host (font, image, script, or style), add that origin to that page's
   `<meta>` CSP — and nothing broader.
5. **Review Dependabot PRs** promptly and check the GitHub Security tab for any
   advisories.

---

**Last Updated:** 2026-06-05
