# CNSPK Join Strategy

> CNSPK has ~280+ members, a CNCF affiliation, a working WhatsApp room, and a GitHub org that gates membership behind an issue template. That last part is the bottleneck. This document replaces the one-size-fits-all funnel with five honest doorways, ordered by friction.

Voice: confident, technical, warm, anti-friction. *Defense in depth. Hospitality on top.*

---

## 1. The five doorways

The current `/join` page makes every visitor file a GitHub issue. That works for one persona on a good day and loses everyone else. Five doorways instead, ordered by friction. The visitor picks.

### Doorway 1 — Tap In (WhatsApp)
- **Link:** https://chat.whatsapp.com/F5Hf1ZwI22TK6EcV6zz4wo
- **For:** Hira. Curious students. Lurkers.
- **Friction:** Lowest — one tap.
- **After:** Lands in the room, sees the pinned welcome, lurks or speaks.
- **Why:** Pakistani audiences have WhatsApp open by default. Don't meet them there, lose them at click one.

### Doorway 2 — RSVP a Session (CNCF Chapter)
- **Link:** https://community.cncf.io/cloud-native-security-pakistan/
- **For:** Sana's team. Adjacents (journalists, parents, regulators) who want to *see us* before *being us*.
- **Friction:** Medium — CNCF account, calendar, show up.
- **After:** Attend, judge the room, decide on a deeper relationship.
- **Why:** A CISO sending three engineers wants to see the room first. CNCF carries the credibility lift.

### Doorway 3 — Follow the Signal (LinkedIn / X / Instagram)
- **Link:** Footer social links. LinkedIn for Ahmed and Sana; Instagram for Hira; X for practitioners.
- **For:** Ahmed evaluating us. Sana sharing with her board without joining anything.
- **Friction:** Near-zero — one follow.
- **After:** Broadcast in their feed. No DMs from us.
- **Why:** Senior practitioners need a watch-before-commit lane. WhatsApp is too intimate; GitHub is too transactional.

### Doorway 4 — Become a Member (GitHub)
- **Link:** https://github.com/Cloud-Native-Security-Pakistan/become-a-member
- **For:** Anyone ready for the members map and the badge.
- **Friction:** High — issue → Newbie team → PR or form → Member.
- **After:** Members map, GitHub badge, eligible for Contributor and Mentor ranks.
- **Why:** The *real* membership lane. We keep it, but stop pretending it's the front door. It's the back office.

### Doorway 5 — The Inner Circle (Discord, future)
- **Link:** `/join/discord-waitlist` — notify-me until launch (§5).
- **For:** Active practitioners who want async, threaded, searchable conversation.
- **Friction:** Medium — account, server join, role pick.
- **After:** `#start-here`, role picker, channel structure. WhatsApp keeps serving the casual layer.
- **Why:** WhatsApp can't host technical depth — lossy, hard to search, breaks past ~400 active people.

---

## 2. Primary CTA strategy

**Every site-wide "Join" button points to `/join/`.** Not a GitHub issue. Not WhatsApp. Not the CNCF page.

- **GitHub-issue as default** is the current site. IQ-gates the community. Hira doesn't have the GitHub muscle yet; the CISO doesn't either.
- **WhatsApp-direct as default** is premature-intimate. Sana won't tap a WhatsApp link as a first interaction.
- **CNCF chapter as default** subordinates our brand. We are CNCF-affiliated, not CNCF-owned. The lead CTA lands on *our* page first.
- **Doorway picker as default** lets the visitor self-select friction and channel.

Homepage `Join →`, navbar `Join`, about page CTA, footer CTA, event-page chips — all link to `/join/`. Single canonical URL.

---

## 3. Channel-by-channel tactics

### WhatsApp Community
- **State:** Live. De-facto front door for the active core. Standard WhatsApp issues — vendor pitches, recruiter spam, off-topic forwards.
- **Role:** Top-to-mid. Casual home. First channel a curious Pakistani actually opens.
- **Fix:** Pin the §9 welcome and CoC link. Two named admins. One enforced rule: *no DMs to members you haven't met; ask publicly first.* Quarterly noise audit.
- **Cross-promo:** Weekly nudge to upcoming CNCF event. Monthly nudge to GitHub upgrade. Never share Discord invite *before* Discord is real and moderated.

### GitHub org
- **State:** Formal lane. Newbie → Member via PR or form. Members map exists. Flow works but isn't a warm front door.
- **Role:** Deep. Contributor and identity layer. Where the badge lives.
- **Fix:** Auto-comment on new join issues with WhatsApp, CoC, and next-event links. Add `good-first-pr` label and 5–10 starter issues. Make `become-a-member` README the canonical "what you get" doc.
- **Cross-promo:** Each Member upgrade gets a one-line WhatsApp shoutout (with consent). Merged contributors get a LinkedIn post tagged from the org.

### CNCF Chapter (Bevy) page
- **State:** Used for event RSVPs. Underutilised as a credibility surface.
- **Role:** Top-to-mid. Public-square entry, credibility doorway.
- **Fix:** Cross-link from every event listing. Footer link. Use the chapter page as the canonical event RSVP — don't duplicate registration on our own site.
- **Cross-promo:** Event teasers in WhatsApp at 7-day, 1-day, 1-hour. Recordings cross-posted to LinkedIn within 7 days.

### LinkedIn / X / Instagram
- **State:** Broadcast-only.
- **Role:** Awareness. Not a join channel.
- **Fix:** LinkedIn for long-form (Ahmed, Sana). Instagram for visual tip cards (Hira). X for short technical takes. Never DM-recruit.
- **Cross-promo:** Every post ends with one CTA: `→ cloudnativesecurity.pk/join`.

### Discord (future)
- **State:** Does not exist.
- **Role:** Mid-to-deep technical home post-launch.
- **Fix:** See §5.
- **Cross-promo:** `/join/discord-waitlist` notify-me only until launch. No premature invites that fragment the community.

---

## 4. The /join/ page — chapter charter

### Hero (first 5 seconds)
- Eyebrow (mono lime): `// JOIN.SH`
- Display headline (italic caps): **PICK YOUR DOOR. NO GATEKEEPING.**
- Subhead: 280+ practitioners. CNCF-affiliated. Built and run from Lahore, Karachi, Islamabad — and wherever your `kubectl` points.
- Roman Urdu accent: *bharosa* — earned, not asked for.
- Two CTAs above the fold: `Tap into WhatsApp →` (primary) and `Browse upcoming sessions →` (secondary).

### Doorway layout
A 5-card grid. Mobile: stacked. Desktop: 2-2-1 on a 12-column. Order top-down by friction:

1. WhatsApp — lime border, primary visual weight.
2. CNCF Chapter — bone surface, medium weight.
3. Follow the Signal — small chip-style card, bottom right.
4. GitHub Membership — full charcoal card, the formal lane.
5. Discord — half-card, `Coming soon` badge, notify-me input.

Each card uses the `DoorwayCard` component (§10).

### Progression path (XP, not bureaucracy)
A horizontal bar with five labels. No percentages, no points, no leaderboards.

`LURKER → NEWBIE → MEMBER → CONTRIBUTOR → MENTOR`

- **LURKER** — In the WhatsApp room or on the social feed. No commitment, no badge. You're welcome.
- **NEWBIE** — Filed the GitHub join request. On the Newbie team. Read access, learning posture.
- **MEMBER** — Finished registration (PR to the members map, or form). Your face is on the members page.
- **CONTRIBUTOR** — Shipped something — PR merged, talk delivered, session co-hosted. You wear the badge.
- **MENTOR** — Hand-picked by admins. You run a thing. Your name is on the team page.

No timeline, no points race. Progression is *recognition of work already done*.

### Expectations / no-spam guarantee
A short bone-on-charcoal block, one promise per line:

- We will not auto-DM you.
- We will not put you on a drip funnel.
- We will not sell your email or share the members map outside the org.
- We post at most twice a week on social. WhatsApp is busier — mute any time.
- Vendor pitches, MLM, "I have a course to sell" are removed on sight.

### Code of Conduct
A single line under the doorways: `Read the Code of Conduct → /code-of-conduct/`. Linked from every doorway card. CoC link appears *before* any join CTA.

### Sub-asks (recruiter / sponsor / speaker)
A "Not here to join?" block at the bottom. Three small chips, each routing out:

- *I want to hire from CNSPK* → `/hire/`
- *I want to sponsor a session or event* → `/sponsor/`
- *I want to speak* → `/speak/`

Join page is for joiners. These three audiences get their own pages with their own forms — not buried in WhatsApp, not as "drop us a DM".

---

## 5. Discord migration plan — recommendation: **(b) launch in 90 days**

Three options, the answer is delay:

- **(a) Launch with the new website** spreads attention thin. The rebrand needs the spotlight.
- **(c) Skip Discord** contradicts the brand strategy and caps our ceiling. WhatsApp can't host the searchable, threaded, role-gated home Ahmed and future open-source contributors will need.
- **(b) 90-day delay** is the responsible path. Site ships first, the new identity lands with the existing 280+, and we use the 90 days to recruit moderators, define structure, stand up bots.

### Five preconditions before opening
1. **Five named moderators**, recruited from existing Members or Contributors, each in a different time-of-day. Volunteer, written charter.
2. **Channel structure pre-defined** (below). No "we'll figure it out".
3. **Bots:** Mee6 or Carl-bot for moderation; `/coc` command that prints the CoC; join-role gate so newcomers start in `#start-here`.
4. **Welcome flow** written and tested (§9).
5. **First 30-day moderation budget:** at least one mod online during 9pm–11pm PKT every weekday for the first month.

### Channel structure
- `#start-here` (read-only welcome + role picker), `#introductions`, `#announcements` (admin-post-only), `#general`
- `#help-desk` (one question per thread)
- `#kubernetes`, `#runtime-security`, `#policy-and-opa`, `#supply-chain`, `#cloud-providers`
- `#jobs` (your own jobs, no recruiter spam), `#cfp-help` (Ahmed's KubeCon path), `#students` (Hira's space), `#off-topic`

Voice channels off by default. Open one only for scheduled events.

### Who runs it
Chapter admins remain accountable. Five moderators are operational. A `MODERATORS.md` lives in the GitHub org with names, escalation paths, term length (12 months, renewable).

---

## 6. Bilingual on-ramp

Default language is **English**. CNSPK is a technical community working English-language stacks, reading English-language CVEs, aspiring to English-language stages.

Roman Urdu earns its place in three moments:

- **WhatsApp greeting** — opens with `Asalaam-o-alaikum` and one Roman Urdu word of warmth (*bharosa*, *mehfil*, *baithak*). Rest is English.
- **/join page** — exactly one Roman Urdu accent per page (per the brand brief). Here it's *bharosa*.
- **Urdu footer tagline** — "کلاؤڈ نیٹو سیکیورٹی پاکستان", already in the brand spec. Footer accent only.

Hard rule: **the Discord welcome is English-only**. Roman Urdu in Discord splits the technical conversation and signals casual, not credible. Discord is where Pakistani practitioners speak to the global ecosystem.

---

## 7. The first seven days

A staff-free retention sequence. Async, free, no automation beyond what the channel ships with.

- **Day 0 — arrival.** WhatsApp pinned welcome (or Discord `#start-here`) is the only message they see. CoC, expectations, ask: *introduce yourself — name, city, stack.*
- **Day 1 — orientation.** Pinned starter pack: upcoming events, recordings, members map, GitHub join steps. No DM from us.
- **Day 3 — gentle nudge.** Weekly group post: *"Newcomers from this week — drop a hello. Where are you in your cloud-native journey?"* Old members reply. New member feels addressed without being singled out.
- **Day 5 — first event teaser.** Announce the next CNCF chapter session. Newcomer sees the room is alive.
- **Day 7 — upgrade prompt.** Weekly pinned: *"On WhatsApp but not on the members map yet? Two minutes: cloudnativesecurity.pk/join → Become a Member."*

No automation. The cadence is the system.

---

## 8. The anti-list — what we don't do

We're a 280+ chapter, not a SaaS funnel. Off-limits, even when they look like "engagement boosts":

- **No auto-DMs.** Not on join, not on event. DMs from the org account are reserved for safety and admin escalation.
- **No drip-email funnels.** If we send email, it's a single human-edited monthly note, opt-in, one-click unsubscribe. We don't have one yet; we don't need one yet.
- **No premium / paid tier.** Membership is free or it isn't membership.
- **No vanity-metric chasing.** No join contests, no padded numbers, no milestone posts below 1,000.
- **No name-and-shame for inactivity.** Lurkers are fine. *Bharosa* is patient.
- **No mandatory voice/video.** Discord launches text-first. Cameras never required.
- **No vendor blasts** — even from sponsors. Sponsors get sponsored sessions, not DM lists.
- **No fake scarcity.** No "limited spots", no "applications close Friday".
- **No "Pakistan's first…" lead lines.** Makes us a sub-brand. CNSPK is its own thing.

---

## 9. Concrete copy

### /join page hero

> **// JOIN.SH**
>
> *PICK YOUR DOOR.*
> *NO GATEKEEPING.*
>
> 280+ practitioners. CNCF-affiliated. Built and run from Lahore, Karachi, Islamabad — and wherever your `kubectl` points. Walk in through whichever door fits today. *Bharosa* is earned, not asked for.
>
> `[ Tap into WhatsApp → ]   [ Browse upcoming sessions → ]`

### Five doorway cards

**1. Tap In — WhatsApp**
The casual room. ~250 members, daily chatter, weekly questions. Mute any time. No DMs from strangers — ask in the room first.
`Join WhatsApp →`

**2. RSVP a Session — CNCF Chapter**
See the community before you join it. RSVP via our official CNCF chapter page. Free. Pakistani-time. Recordings posted after.
`Browse Events →`

**3. Follow the Signal — LinkedIn · X · Instagram**
Read-only. Long-form on LinkedIn. Quick takes on X. Tool Tuesday on Instagram. Twice a week, max. Zero DM sales.
`Pick a feed →`

**4. Become a Member — GitHub**
The formal lane. Get on the members map, earn the badge, unlock Contributor and Mentor ranks. One issue → Newbie team → PR or form → Member.
`Start the request →`

**5. The Inner Circle — Discord**
Coming soon. The deep technical home: threaded, searchable, channel-organised. Get a notify-me when the doors open.
`Notify me →`

### Progression XP-bar labels

`LURKER` — *You're in the room.*
`NEWBIE` — *You filed the join request.*
`MEMBER` — *You're on the map.*
`CONTRIBUTOR` — *You shipped something we ship.*
`MENTOR` — *You run a thing.*

### WhatsApp first message (pinned)

> *Asalaam-o-alaikum.* Welcome to **CNSPK** — Cloud Native Security Pakistan. We're ~280+ practitioners running cloud-native security in Pakistani teams.
>
> House rules:
> • On-topic: tech, CVEs, your own jobs (not vendor pitches), chai.
> • No DMs to members you don't know. Ask in the room first.
> • Code of Conduct → cloudnativesecurity.pk/code-of-conduct
> • Want the badge? cloudnativesecurity.pk/join → Become a Member.
>
> *Defense in depth. Hospitality on top.*

### Discord welcome (when launched)

> Welcome to the CNSPK Discord. The deep end — Pakistan's cloud-native security practitioners, async, in writing, in public.
>
> → Read first: `#start-here`
> → Pick your roles in `#start-here` to unlock channels.
> → Say hi in `#introductions`.
> → Stuck? `#help-desk`, one question per thread.
> → Code of Conduct is in the channel description. Read it.
>
> `kubectl apply -f pakistan.yaml`

### hi@cloudnativesecurity.pk auto-response

> Salam — thanks for writing in. We read everything but we don't reply to everything. Give us 3 working days.
>
> If you're trying to:
> → Join the community → cloudnativesecurity.pk/join
> → RSVP a session → community.cncf.io/cloud-native-security-pakistan
> → Speak at a session → cloudnativesecurity.pk/speak
> → Sponsor a session → cloudnativesecurity.pk/sponsor
> → Hire from CNSPK → cloudnativesecurity.pk/hire
>
> For anything else, this inbox is the right place. A human will get back to you.
>
> — The CNSPK organisers

---

## 10. Implementation contract

### Routes / pages to create

- `/join/` — **rewrite.** Doorway picker. Replaces the GitHub-issue-first flow.
- `/code-of-conduct/` — **new.** Standalone CoC; linked from every doorway card and the WhatsApp/Discord welcomes.
- `/speak/` — **new.** CFP / speaker route. Form or mailto, plus a one-line response SLA.
- `/sponsor/` — **new.** Sponsor route. What sponsorship looks like, what it doesn't.
- `/hire/` — **new.** Recruiter route. How to post a job to `#jobs` (post-Discord) or to the GitHub org's discussion. Explicit no-spam terms.
- `/join/discord-waitlist` — **new.** Notify-me capture. Single email field. Delete the day Discord opens.

### Data the join page needs

- Member count — verified at **280+** against the official CNCF group page (ocgroups.dev/cncf/group/sxcyqt9). Use "280+" until the next audit; do not invent a more precise figure.
- WhatsApp invite URL — `https://chat.whatsapp.com/F5Hf1ZwI22TK6EcV6zz4wo`. Stored as a constant or in `data/channels.json`.
- CNCF chapter URL — `https://community.cncf.io/cloud-native-security-pakistan/`.
- GitHub join repo URL — `https://github.com/Cloud-Native-Security-Pakistan/becoming-a-member`.
- Social URLs — already in `Footer.js`; reuse.

No new JSON schemas. No data migration.

### Components needed

- `DoorwayCard` — 5 instances on `/join/`. Props: title, eyebrow, body, friction-badge (Lowest / Medium / High / Coming Soon), CTA label, CTA href, optional accent (lime border for primary).
- `ProgressionLadder` — horizontal 5-step XP bar. Props: list of `{rank, oneLiner}`. Static.
- `ExpectationsBlock` — bone-on-charcoal promise list. Static.
- `SubAskRouter` — bottom-of-page chip group with three out-routes (hire / sponsor / speak).
- `WaitlistInput` — single-email notify-me. If no form backend exists, render `mailto:hi@cloudnativesecurity.pk?subject=Discord%20waitlist` and leave a `TODO:`.

All components follow the v2 dark-default styling per `AGENT_BRIEF.md`.

### Homepage `Join →` button

Links to `/join/`. Not WhatsApp. Not GitHub. Not the CNCF chapter. Single canonical destination — applies to the navbar `Join`, the about page CTA, and the footer CTA too.

### What sub-agents must not invent

- No member testimonials.
- No sponsor logos.
- No fictional event or city counts.
- The number is ~280+. The chapter is CNCF-affiliated. Both are true. Anything else needs a `TODO:` and a question to the strategist before it ships.

---

*The doorways are real. The voice is the brand. The 280+ is the only number we use until the next audit. **kubectl apply -f pakistan.yaml**.*
