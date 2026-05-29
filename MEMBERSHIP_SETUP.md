# Membership Registry — Setup Guide

> Turn the CNSPK membership form into a real registry: every member gets a **membership number** (emailed to them), and opted-in members appear on the public map. Privacy-safe by design — email and partner-sharing data never go public.

## The architecture

```
Member fills the form  →  PRIVATE responses sheet (has email + partner flag)
                            │
                            ▼  on-submit Apps Script trigger
                       • assigns CNSPK-0001…
                       • emails member their number + welcome
                       • IF "feature me" ticked → copies SAFE columns to ↓
                            │
                       PUBLIC DIRECTORY sheet (no email, opt-in only)
                            │
                            ▼  published as CSV
                       Members map reads it → member appears
```

**Why two sheets:** a registry collects email (PII). Publishing the raw sheet would leak it. So only the *Public Directory* sheet — no email, no partner flag, only members who opted in — is ever published.

---

## Step 1 — Run the Apps Script (creates everything)

1. Go to **https://script.google.com** → **New project**.
2. Delete the stub, paste the entire contents of `tools/create-membership-form.gs`. Save.
3. Function dropdown → select **`setupCnspkMembership`** → click **Run ▶**.
4. Approve the authorization prompt (your account, creating your own form + sheet + the welcome-email trigger).
5. Open **View → Logs** (or the Execution log).

The script creates:
- The **membership form** (Name, Email, City, Role — required; Org, Interests, GitHub, LinkedIn — optional; two opt-in checkboxes: *feature me publicly* + *share with partners*)
- A **"CNSPK — Membership Registry"** spreadsheet with:
  - `Form Responses 1` (PRIVATE — email lives here, + a `Membership No` column)
  - `Public Directory` (the safe, publishable sheet)
- An **on-submit trigger** that assigns numbers, emails members, and populates the public sheet for opt-ins.

---

## Step 2 — Paste the config

The log prints a ready-to-paste block. Copy it into `js/membership-config.js` — it fills `enabled`, `formActionUrl`, all the `entry.XXXX` field ids, the two checkbox option texts, and `sheetColumns`.

---

## Step 3 — Publish ONLY the Public Directory sheet as CSV

This is the one manual click the script can't do.

1. Open the **CNSPK — Membership Registry** spreadsheet.
2. **File → Share → Publish to web.**
3. In the dialog, **select the `Public Directory` sheet** (NOT "Entire document" — that would expose the private responses).
4. Format: **Comma-separated values (.csv)** → **Publish**.
5. Copy the `output=csv` URL → paste into `sheetCsvUrl` in `js/membership-config.js`.

> ⚠️ **Never** publish "Entire document" or the `Form Responses 1` sheet — those contain email addresses and the partner-sharing flag.

---

## Step 4 — Ship it

```
git add js/membership-config.js
git commit -m "Wire up membership registry"
git push
```

Redeploy. The "Join the chapter" button on the members page now registers people, emails them a number, and (for opt-ins) drops their pin on the map.

---

## What each consent checkbox does

| Checkbox | If ticked | If not |
|---|---|---|
| **Feature me on the website + map** | Name/role/city/interests/socials + member# copied to the public directory → appears on map | Stays a *private* member — still gets a number, just not shown publicly |
| **Share with partner organizations** | Flag recorded in the private sheet for your internal hiring/intern outreach | Not shared |

The form itself is **compulsory to become a member**; the public-listing and partner-sharing are both **optional opt-ins**, exactly as asked.

---

## Membership numbers

- Format: `CNSPK-0001`, `CNSPK-0002`, … (zero-padded, sequential).
- Assigned automatically on submit, written to the private sheet, and emailed to the member.
- The counter persists in Script Properties (`cnspk_last_no`). If you ever need to start from a specific number (e.g. you already have 280 members and want new ones to start at 281), set `cnspk_last_no` to `280` in the Apps Script project: **Project Settings → Script Properties**.

---

## Moderation (optional)

The public sheet is already opt-in only. If you want a manual approval gate on top:
1. Add an `Approved` column to the **Public Directory** sheet.
2. In `membership-config.js` set `requireApproval: true`.
3. Only rows where `Approved` says `yes` show on the map.

---

## Privacy checklist (do this before launch)

- [ ] Confirm only the **Public Directory** sheet is published — open the CSV URL in an incognito window and verify there's **no email column**.
- [ ] The form's confirmation message + the website form both state name/role/city will be public for opt-ins.
- [ ] Consider adding a one-line privacy note + a contact email for removal requests (GDPR-style "right to be forgotten" — a member can ask you to delete their row).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Form shows "coming soon" | `enabled:false` or blank `formActionUrl`. |
| No membership email arrives | Check the trigger installed (Apps Script → Triggers). `MailApp` has a daily quota (~100 consumer / 1500 Workspace) — fine for normal signups. |
| Opted-in member not on map | Confirm the **Public Directory** sheet is the one published as CSV, and `sheetCsvUrl` is the `output=csv` link. |
| Everyone on one pin | Their city isn't in `data/city-coords.json` — add it. |
| Numbers should start at 281 | Set Script Property `cnspk_last_no` = `280`. |

---

*Built. Tested. Pakistani. · every member, a number · the map fills itself.*
