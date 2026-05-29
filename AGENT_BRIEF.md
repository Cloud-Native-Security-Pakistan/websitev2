# CNSPK Website v2 — Shared Agent Brief

> **All sub-agents working on the website revamp must read this in full before touching any file.** This is the single source of truth for design tokens, voice, naming, and constraints.

---

## The mandate

Revamp the live `cloudnativesecurity.pk` site into the new **Electric register** brand. Same stack (static HTML, Tailwind via CDN, vanilla ES6 modules, JSON data, GitHub Pages). No framework migration, no backend.

---

## Hard rules (do not violate)

1. **Use real data only.** Pull from `data/events.json`, `data/members.json`, `data/sessions.json`, `data/team.json`. **Never fabricate** sponsor logos, partner names, testimonials, or member quotes. If you don't have data, leave a clearly labeled placeholder with a `TODO:` comment.

2. **CNSPK** is the official acronym. Not "CNSP". Find-and-replace any "CNSP" you encounter (except inside the literal CNCF/CNSPK product names already settled).

3. **Stay within your assigned files.** Listed at the top of your prompt. Do not edit components, tokens, or other pages outside your stream.

4. **No new dependencies** beyond what the live site already uses (Tailwind CDN, DOMPurify CDN, Leaflet, Google Fonts).

5. **Preserve existing data shapes.** Don't change JSON schemas. Pages must still consume the existing JSON files with the existing fields.

6. **Accessibility:** WCAG AA contrast minimum on all body text. Real focus rings (no `outline:none` without a replacement). Alt text on every image. Semantic HTML.

7. **Do not break the live site's routing.** All existing routes must continue to resolve to a working page. New pages are additive.

---

## The brand — Electric register

### Colors

```
Primary:
  --lime: #C7FF3E          /* main accent, CTAs, lime-on-dark only */
  --lime-600: #9BD11A      /* darker companion for hover, AA on light */
  --lime-glow: #E8FF8A     /* subtle highlights */

Heritage (ceremonial accent only):
  --pak-green: #01411C     /* used sparingly */
  --gold: #C9A227          /* Urdu tagline accent */

Surfaces (dark-mode native):
  --carbon: #0F1115        /* page bg */
  --charcoal: #1A1D24      /* card surfaces */
  --slate: #2A2E37         /* borders, dividers */
  --steel: #6B7280         /* secondary text */
  --bone: #F4F1EA          /* primary text on dark; primary surface on light */
  --bone-2: #E8E3D6        /* subtler bone */

Semantic:
  --watch: #F59E0B         /* warning */
  --breach: #F43F5E        /* error / threat advisory */
  --signal: #06B6D4        /* info */

Signature gradients:
  --grad-stamp-glow: linear-gradient(135deg, #C7FF3E 0%, #9BD11A 100%)
  --grad-terminal-dawn: linear-gradient(180deg, #0F1115 0%, #01411C 50%, #C7FF3E 100%)
```

**Critical:** Lime `#C7FF3E` only ever appears on **dark backgrounds**. On bone/light surfaces, use `#9BD11A` (lime-600) for text and CTAs. Lime on white = WCAG fail.

### Typography

```
--font-display: 'Bricolage Grotesque', system-ui, sans-serif;   /* italic display caps */
--font-body:    'Inter', system-ui, sans-serif;
--font-mono:    'JetBrains Mono', 'SF Mono', Menlo, monospace;
--font-urdu:    'Noto Nastaliq Urdu', serif;
```

**Display:** Bricolage Grotesque, weight 800, **italic**, **uppercase**, letter-spacing -0.03em, line-height 0.92. This is the brand's signature voice.

**Body:** Inter, weights 400/500/600/700/800.

**Mono:** JetBrains Mono for terminal moments, version numbers, code, mono UI labels in lime.

**Urdu:** Noto Nastaliq Urdu — used sparingly. Footer tagline "کلاؤڈ نیٹو سیکیورٹی پاکستان" in `--gold` at low opacity. Set RTL with `direction: rtl` and line-height 2.2.

### Motion

- 150ms for hover state changes
- 200ms for surface elevations (card lift on hover)
- 400ms for scroll-reveals
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` for default, `cubic-bezier(0, 0, 0.2, 1)` for entrances

### Patterns / texture

- Faint grid overlay using `radial-gradient(circle, rgba(199, 255, 62, 0.06) 1px, transparent 0)` at 32-64px sizes for hero backgrounds
- Lime on charcoal cards — use the offset shadow style for the primary CTA: `box-shadow: 6px 6px 0 0 var(--charcoal), 6px 6px 0 1px var(--lime-600);` and shift on hover

### Logo / mark

Use the placeholder Shield SVG (CSS clip-path hexagon with "CN" mono text inside) until Phase 2 ships the real vector. Pattern is established in `sample-site.html`.

```html
<span class="brand-shield">CN</span>
```

```css
.brand-shield {
  width: 32px; height: 36px;
  background: var(--lime);
  clip-path: polygon(50% 0%, 100% 22%, 100% 60%, 50% 100%, 0% 60%, 0% 22%);
  display: grid; place-items: center;
  color: var(--carbon);
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 12px;
}
```

---

## Voice

> **Confident enough to declare, technical enough to be trusted, warm enough to feel like home, fast enough to respect your time.**

Five guidelines:

1. **Headlines in italic display caps.** "BUILT. TESTED. PAKISTANI." not "Built, Tested, Pakistani."
2. **One Roman Urdu word of attitude per page**, where it earns its place. Examples: *bharosa* (trust), *mehfil* (gathering), *takleef* (the pain a tool removes). Never machine-translate technical terms into Urdu. Never publish a full Urdu paragraph.
3. **Lead with the verb, not the apology.** "Run this command" beats "We'd like to suggest you might consider running this command."
4. **No corporate cringe.** Banned phrases: "excited to announce", "buckle up", "🚀🔥💯", "synergy", "next-gen", "leverage" as a verb meaning *use*, "in this day and age", "at the end of the day".
5. **CNSPK is its own thing.** Independent. Run by practitioners. CNCF affiliation is a credential, not the headline. Never write "Pakistan's first CNCF Security Chapter" as the lead identifier — that makes us a sub-brand.

### Approved tagline lines (use any, mix-and-match)

- **kubectl apply -f pakistan.yaml** (sticker / mono / hero accent)
- **Read the CVE. Drink the chai.** (campaign / recruitment / sticker)
- **Built. Tested. Pakistani.** (hero / shirt / event poster)
- **Defense in depth. Hospitality on top.** (about / messaging)
- *Avoid* "Pakistan's home for cloud native security." — flat, generic-friendly.
- *Avoid* "Secure the cloud-native future." — retired.

---

## Naming

- **CNSPK** — official acronym. Use everywhere.
- **Cloud Native Security Pakistan** — full name, used in formal contexts (footer, about, code-of-conduct).
- **The chapter** — informal mention.
- **Not** "CNSP". Not "CNCF Pakistan" (that's a different umbrella). Not "CNCF Bevy Chapter" (deprecated CNCF terminology — now just "CNCF Chapter" / "Cloud Native Community Group").

---

## Page structure (universal)

Every page in v2 follows this shape:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- meta, CSP, fonts -->
  <link rel="stylesheet" href="/css/tokens.css">
  <!-- page-specific styles -->
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

- `Navbar` and `Footer` are dropped in via the JS components — do not hardcode them.
- All pages link `/css/tokens.css` first.
- Page-specific styles go inline in a `<style>` block in the head.

---

## Existing data shapes (do not change)

### `data/events.json`
Array of events with: `id`, `title`, `date`, `location`, `type`, `description`, `image`, `link`.

### `data/members.json`
Array of members with: `id`, `name`, `username`, `location`, `team` (`admin`/`contributor`/`member`/etc), `role`, `interests` (array), `github`, `linkedin`, `twitter`, `website`, `link`, `lat`, `lng`.

### `data/sessions.json`
Array of sessions with: `id`, `title`, `description`, `summary`, `keyTakeaways` (array), `transcript` (array of {time, text}), `date`, `duration`, `type` (`upcoming`/`recorded`), `topic`, `recordingUrl`, `registrationUrl`, `thumbnail`, `speaker` ({name, role, company, image, linkedin, twitter}).

### `data/team.json`
Array of team with: `id`, `name`, `role`, `company`, `location`, `bio`, `image`, `social` (object of platform → url).

---

## Common stream constraints

- Build pages in the **dark theme by default** (carbon background, bone text). Light surfaces appear only as **inverted blocks** for editorial/advisory sections (bone background, carbon text).
- Use Tailwind via CDN exactly as the existing site does. Don't migrate to a build pipeline.
- For shared visual primitives (cards, buttons, eyebrows, stamps), copy the patterns from `CNSPK-Rebrand-Research/sample-site.html` — that file is the visual reference.
- Keep the existing `<head>` CSP and meta tags; just update font URLs to include Bricolage Grotesque alongside Inter and JetBrains Mono.

---

## Reference files

- **Brand spec:** `CNSPK-Rebrand-Research/02-research-color/three-directions.md` (Direction B — Electric)
- **Type system:** `CNSPK-Brand-Identity/03-visual-identity/typography.md`
- **Voice samples:** `CNSPK-Brand-Identity/02-verbal-identity/voice-and-tone.md` and `writing-patterns.md`
- **Visual reference:** `CNSPK-Rebrand-Research/sample-site.html` — the canonical preview of the new register
- **Audit:** `CNSPK-Rebrand-Research/06-migration/website-features-audit.md`
- **Plan:** `CNSPK-Rebrand-Research/06-migration/website-revamp-plan.md`

---

## When in doubt

If a sub-agent is unsure about a design or voice choice:

1. Check the sample-site reference first.
2. Default to **less, simpler, sharper** — if you have to ask "is this too punk", the answer is yes.
3. Leave a `TODO:` comment in the file describing what you weren't sure about.
4. Never invent.
