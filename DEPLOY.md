# Deploying cloudnativesecurity.pk

How the site is served **today**, and the ordered cutover to Cloudflare Pages that never takes the
live site down. Written against verified facts, not assumptions.

---

## 1. Current reality (verified against the live domain)

| Fact | Detail |
| --- | --- |
| Origin | **GitHub Pages** — production responses carry `x-github-request-id` |
| DNS | **Cloudflare-managed** — nameservers `bayan.ns.cloudflare.com` / `marjory.ns.cloudflare.com` |
| Apex | `cloudnativesecurity.pk` resolves to Cloudflare proxy IPs `104.21.42.126` / `172.67.162.8` |
| `www` | **Does not resolve at all — NXDOMAIN.** No DNS record exists for it |
| Cloudflare Pages project | **Does not exist yet** |
| `CNAME` file | Present at the repo root and **load-bearing** — it is what binds GitHub Pages to the apex domain |
| `.github/workflows/pages.yml` | Active, and it is what publishes production today |
| `vercel.json` | Not present anywhere in the repo. There is no Vercel lane |
| Security headers | **All five missing in production** — no CSP, no HSTS, no `X-Content-Type-Options`, no `Referrer-Policy`, no frame protection. GitHub Pages cannot send custom headers |

### What this means for the new config files

- `_headers` and `_redirects` are **inert no-ops on GitHub Pages** — it does not read them. Adding
  them changes nothing in production, which is why they are safe to commit before the migration.
- `404.html` at the repo root **does** take effect immediately: GitHub Pages and Cloudflare Pages both
  serve a root `404.html` for unmatched routes.
- **Do not delete `CNAME` and do not disable `pages.yml` yet.** They are the only thing serving the
  live domain. Retiring them before the Cloudflare Pages project owns the domain would take the site
  down. They are steps 9 and 10 below, not step 1.

---

## 2. Interim option: real security headers on GitHub Pages, today

Traffic already passes through the Cloudflare proxy, so the five missing headers can be injected at
the edge **without waiting for the migration**. Free tier, no origin change, fully reversible.

Cloudflare dashboard → **Rules → Transform Rules → Modify Response Header** → create a rule that
applies to all requests for the zone (`hostname eq "cloudnativesecurity.pk"`), and *set static*:

| Header | Value |
| --- | --- |
| `Content-Security-Policy` | the exact one-line policy from [`_headers`](./_headers) (copy it verbatim so the two lanes never drift) |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` |

Also enable **SSL/TLS → Edge Certificates → Always Use HTTPS** if it is not already on; that is the
one mechanism that owns HTTP→HTTPS (Requirement 1.4), before and after the migration.

Roll back by deleting the rule. When the Cloudflare Pages cutover completes and `_headers` is live,
**delete this Transform Rule** so exactly one mechanism owns the headers.

---

## 3. Zero-downtime cutover to Cloudflare Pages

Run these in order. Nothing touches production until step 8.

1. **Create the Pages project.** Cloudflare dashboard → Workers & Pages → Create → Pages → connect
   this repo (`websitev2`). Build command: none. Build output directory: `/` (repo root — the site is
   plain static HTML). Framework preset: none.
2. **Verify the preview deployment.** On the `*.pages.dev` preview URL, walk **every route in the page
   map** and confirm each returns 200 with its expected content:
   `/`, `/about/`, `/events/`, `/sessions/`, `/sessions/view/`, `/members/`, `/team/`, `/speakers/`,
   `/projects/`, `/wins/`, `/labs/`, `/join/`, `/dispatch/`, `/brand/`, `/cfp/`, `/consultants/`,
   `/code-of-conduct/`, plus `/hire/`, `/sponsor/`, `/speak/` once those pages exist.
3. **Verify `_headers` is in effect on the preview.** `curl -sI https://<preview>.pages.dev/` and
   confirm all five headers are present, then load `/members/` and `/sessions/` with the browser
   console open and confirm **zero CSP violations** — the map tiles, Leaflet marker images, Google
   Fonts, DOMPurify, Tailwind CDN, and the Directory CSV fetch must all still work.
4. **Verify the 404.** Request a bogus path on the preview and confirm the branded Electric Lime
   `404.html` renders with a working link back to `/`.
5. **Set the Pages Functions environment variables** (Settings → Environment variables, for both
   Production and Preview). Secrets live here only — never in the repo or the client bundle:
   - `RESEND_API_KEY` — transactional email API key for the intake notifications
   - `ORGANIZER_INBOX` — destination address for hire/sponsor/speak notifications
   - `NOTIFY_FROM` — verified sender address used by the notification emails
   - `UNSUBSCRIBE_SECRET` — signing secret for the one-click dispatch unsubscribe token
   - *(optional KV bindings)* `DISPATCH_KV` — dispatch subscriber store;
     `RATE_LIMIT_KV` — per-IP counters for the `CF-Connecting-IP` rate limiter. Without these the
     functions still run; the limiter falls back to in-isolate counting.
6. **Smoke-test `/api/*` on the preview** with valid and invalid payloads: `{ ok: true }` on success,
   field-level `400`, `429` when the limiter trips, and no secret value in any response body.
7. **Add the custom domains** to the Pages project: `cloudnativesecurity.pk` (canonical) and
   `www.cloudnativesecurity.pk`. Adding `www` **creates the DNS record that does not exist today** —
   that is the prerequisite for the `www`→apex rule ever firing.
8. **Confirm managed TLS.** Wait for the Pages custom-domain certificate to show *Active* and verify
   the cert covers both hostnames and is non-expired before sending traffic (Requirement 1.2).
9. **Switch DNS.** Repoint the apex record from the GitHub Pages target to the Pages project
   (Cloudflare uses CNAME flattening on the apex), keep it proxied, and add the `www` CNAME if step 7
   did not. Create the **www→apex Redirect Rule** now:
   - *When incoming requests match:* `http.host eq "www.cloudnativesecurity.pk"`
   - *Then:* Dynamic redirect → expression `concat("https://cloudnativesecurity.pk", http.request.uri.path)`
     (add `http.request.uri.query` handling if query strings must survive) → status **308**,
     *Preserve query string* on.

   This edge rule is the single owner of the `www`→apex hop; the mirrored line in [`_redirects`](./_redirects)
   is documentation only, because Cloudflare Pages' `_redirects` matches on path and does not support
   domain-level redirects.
10. **Verify in production** before retiring anything:
    - `curl -sI https://cloudnativesecurity.pk/` → all five headers present
    - `curl -sI https://www.cloudnativesecurity.pk/members/` → `308` to
      `https://cloudnativesecurity.pk/members/` (path preserved, single hop)
    - `curl -sI http://cloudnativesecurity.pk/about/` → redirect to HTTPS, single hop
    - bogus path → branded 404
    - every page-map route → 200 with its marker
    - `/api/*` → JSON contract intact
    - responses no longer carry `x-github-request-id`
11. **Only now retire the GitHub Pages lane.** Disable or delete `.github/workflows/pages.yml`, then
    delete the root `CNAME` file, so a second deployment can never claim the domain
    (Requirement 1.7). Also delete the interim Transform Rule from section 2 if it was created.
12. **Roll back** at any point before step 11 by pointing the apex DNS record back at GitHub Pages —
    `CNAME` and the workflow are still in place, so the old lane is one DNS change away.

---

## 4. Ownership map — one mechanism per behavior

| Behavior | Owner | Not owned by |
| --- | --- | --- |
| Security response headers | `_headers` (after cutover) / Transform Rule (interim) | never both at once |
| HTTP → HTTPS | Cloudflare **Always Use HTTPS** | `_redirects` |
| `www` → apex, 308, path preserved | Cloudflare **Redirect Rule** | `_redirects` (mirror only — Pages ignores host-qualified sources) |
| Unknown route | root `404.html`, served automatically | no routing file needed |
| Managed TLS | Cloudflare Pages custom-domain certificate | no manual cert |
| `/api/*` behavior and headers | `functions/api/*` handler code | `_headers` (it applies to static assets) |
