# CNSPK Website v2 — Electric Register

> Rebrand preview of **cloudnativesecurity.pk** — the Cloud Native Security Pakistan community site.
> **This is a staging/review build, not production.** The live site still runs the previous (emerald) design.

`kubectl apply -f pakistan.yaml`

---

## What this is

A full visual rebrand of the CNSPK site into the **Electric register**: lime on charcoal, bone for warmth, italic display caps, a stamp-style grammar. Same tech stack as the live site — static HTML, Tailwind (CDN), vanilla ES6 modules, JSON data — no framework, no backend. Deployable on Vercel as-is.

This repo exists for **within-team review** before we cut the rebrand over to the live domain.

---

## Review it

- **Live preview:** deployed on Vercel from `main` (see the deployment link in the repo's Vercel integration / PR checks).
- **Run locally:**
  ```bash
  npx serve .
  # then open http://localhost:3000
  ```
  Any static server works — it's plain files. (A local server is needed because the pages use ES6 modules + `fetch` for the JSON data.)

---

## What changed from the live site

| | Live (v1) | This build (v2) |
|---|---|---|
| Primary color | Emerald `#10B981` | **Electric Lime `#C7FF3E`** (dark surfaces only) |
| Surfaces | mixed | Carbon `#0F1115` / Charcoal / Bone |
| Display type | Inter / Space Grotesk | **Bricolage Grotesque** (italic, uppercase) |
| Body / Mono | Inter / JetBrains Mono | same |
| Bilingual | none | Urdu (Noto Nastaliq) ceremonial accent |
| `/about/`, `/join/` | old Courier-New terminal theme | **rebuilt** — join now a 5-doorway picker |
| `/brand/` | deprecated blue palette + anti-scrape JS | **rebuilt** as public Electric brand book |
| New pages | — | `/cfp/`, `/code-of-conduct/`, `/dispatch/`, `/labs/`, `/speakers/`, `/wins/` |

Full brand spec is in [`AGENT_BRIEF.md`](./AGENT_BRIEF.md). Join funnel strategy is in [`JOIN_STRATEGY.md`](./JOIN_STRATEGY.md).

---

## Page map

```
/                    home — hero, stats, dispatch signup
/about/              the chapter, four pillars, founding story
/join/               5-doorway picker (WhatsApp · CNCF · social · GitHub · Discord)
/events/            events grid (upcoming/past), data-driven
/sessions/          session archive + search + topic filter
/sessions/view/     session detail — AI summary, transcript, share (the moat)
/members/           directory + Leaflet map (split view)
/team/              core team
/consultants/       hire experts
/projects/          open-source projects
/brand/             public brand book (Electric register)
/cfp/               call for speakers
/code-of-conduct/   the CoC
/dispatch/          newsletter
/labs/              CTF / hands-on labs
/speakers/          speaker index
/wins/              member wins feed
```

---

## Tech

- **Static HTML** + **Tailwind via CDN** + **vanilla ES6 modules** (`js/`)
- **JSON data** (`data/`): `events.json`, `members.json`, `sessions.json`, `team.json` — unchanged shapes from the live site
- **Design tokens** in `css/tokens.css` (all color/type/motion variables + shared primitives) — loaded first on every page
- **Components** in `js/`: `Navbar`, `Footer`, `EventCard`, `SessionCard`, `SessionDetail`, `MemberCard`, `FilterPanel`, `Map`
- **DOMPurify** for sanitizing all rendered data; **Leaflet** for the members map
- **`vercel.json`** — `cleanUrls`, `trailingSlash`, security headers

---

## Known TODOs (pending, not bugs)

Please don't file these as review issues — they're tracked and intentional for this stage:

- **Discord waitlist** → currently a `mailto:` fallback; needs a real form backend before Discord launches
- **`/hire/` and `/sponsor/` pages** → not built yet; the join page's sub-asks route to `mailto:` for now
- **3 project cards** (`CTF Challenges`, `Community Bot`, `The Dispatch`) → marked "Not yet public", no repo link until those repos ship
- **Event images** → still Unsplash placeholders; swap for real CNSPK event photos
- **Logo** → placeholder CSS hex-shield; final vector ships in a later phase

---

## How to give feedback

Open an issue or comment on the review PR. For visual/copy notes, a screenshot + the page path (`/join/`, `/brand/`, etc.) is plenty.

---

*Built. Tested. Pakistani. · CNCF-affiliated · staging build for team review*
