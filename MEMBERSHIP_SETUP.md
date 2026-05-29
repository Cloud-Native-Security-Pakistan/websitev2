# Membership Form → Live Map — Setup Guide

> Wire up the "add yourself to the map" feature. ~15 minutes, one-time. No backend, no code changes beyond pasting a few IDs into `js/membership-config.js`.

## How it works

```
Member fills the brand form  →  POSTs to your Google Form  →  Google Sheet (responses)
                                                                  ↓  (published as CSV)
        Members map  ←  fetches the sheet live  ←  geocodes city → lat/lng (city-coords.json)
```

The member submits, lands in your Google Sheet, and appears on the map on the next page load. You never edit JSON.

Until you finish this setup, everything still works: the form shows a "coming soon" notice and the map shows the seed members from `data/members.json`.

---

## Step 1 — Create the Google Form

1. Go to <https://forms.google.com> → blank form. Name it "CNSPK — Add yourself to the map".
2. Add these questions **in this order**, matching the types:

   | Question | Type | Required |
   |---|---|---|
   | Name | Short answer | ✅ |
   | Role | Short answer | — |
   | City | Short answer (or Dropdown with the city list) | ✅ |
   | Interests | Short answer | — |
   | GitHub | Short answer | — |
   | LinkedIn | Short answer | — |
   | Consent | Checkbox ("I agree to appear on the public map") | ✅ |

   > Tip: use the same city names as `data/city-coords.json` (Lahore, Karachi, Islamabad, …). Unknown cities fall back to a generic Pakistan pin.

3. Top-right → **Send** → the `<>` (link) tab → copy the form URL. It looks like:
   `https://docs.google.com/forms/d/e/FORM_ID/viewform`

---

## Step 2 — Get the POST endpoint

Take your form URL and change the ending from `/viewform` to `/formResponse`:

```
https://docs.google.com/forms/d/e/FORM_ID/formResponse
```

Paste that into `formActionUrl` in `js/membership-config.js`.

---

## Step 3 — Get the field IDs (the `entry.XXXX` values)

1. On the form, click the **⋮ menu → Get pre-filled link**.
2. Fill every field with a dummy value (e.g. "TEST") and click **Get link → Copy link**.
3. The copied URL contains `entry.123456789=TEST` for each question. Example:
   ```
   ...formResponse?entry.111111=TEST&entry.222222=TEST&entry.333333=TEST...
   ```
4. Match each `entry.XXXX` to its question (the order matches your questions) and paste into `formFields` in `js/membership-config.js`:
   ```js
   formFields: {
     name:      'entry.111111',
     role:      'entry.222222',
     city:      'entry.333333',
     interests: 'entry.444444',
     github:    'entry.555555',
     linkedin:  'entry.666666',
     consent:   'entry.777777'
   }
   ```

---

## Step 4 — Link a Sheet + publish it as CSV

1. In the Form → **Responses** tab → the green Sheets icon → **Create spreadsheet**.
2. Open that Sheet. Note the column headers Google created (they match your question text). 
3. **File → Share → Publish to web.**
4. In the dialog: pick the **responses sheet** (not "Entire document"), format **Comma-separated values (.csv)**, click **Publish**.
5. Copy the generated URL. It looks like:
   ```
   https://docs.google.com/spreadsheets/d/e/SHEET_ID/pub?gid=0&single=true&output=csv
   ```
6. Paste it into `sheetCsvUrl` in `js/membership-config.js`.

---

## Step 5 — Match the column names

In `js/membership-config.js`, set `sheetColumns` to match your Sheet's **exact header text**. Google names columns after your questions, so usually:

```js
sheetColumns: {
  name: 'Name',
  role: 'Role',
  city: 'City',
  interests: 'Interests',
  github: 'GitHub',
  linkedin: 'LinkedIn',
  consent: 'Consent',
  approved: 'Approved'   // optional — see moderation below
}
```

> If a header differs (e.g. Google made it "What's your name?"), put that exact text here.

---

## Step 6 — Flip it on

In `js/membership-config.js`:

```js
enabled: true,
```

Commit, push, redeploy. Done — the form is live and submissions appear on the map.

---

## Moderation (optional)

By default **every consenting submission appears automatically** (`requireApproval: false`).

If you start getting spam, turn on approval gating:

1. In your Google Sheet, add a column named **`Approved`** (after the auto columns).
2. In `membership-config.js` set `requireApproval: true`.
3. Now only rows where you type `yes` (or `true`/`approved`) in the Approved column show on the map. You moderate by editing the sheet — no code.

---

## Privacy notes

- The form requires a **consent checkbox** — names + city go on a *public* map, so consent is mandatory (`requireConsent: true`).
- Don't collect emails/phones on the public form. If you want them for internal use, mark those questions and **don't** map them to `sheetColumns` — the site only reads the columns you map.
- The published CSV is public-readable by anyone with the URL. Only publish the columns you're comfortable being public (Google lets you publish a specific sheet/range).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Form shows "coming soon" | `enabled` is still `false`, or `formActionUrl` is blank. |
| Submit seems to do nothing | Check `formActionUrl` ends in `/formResponse`, and the `entry.*` IDs are real (not the `entry.000…` placeholders). |
| New members don't appear on map | Confirm the Sheet is **published to web as CSV** and `sheetCsvUrl` is the `output=csv` link. Check `sheetColumns` match the headers exactly. |
| Everyone lands on one pin | Their city isn't in `data/city-coords.json` — add it, or it falls back to the national centroid. |
| Member appears twice | They match a seed member in `members.json` by name/username — the loader dedupes, but check spelling. |

---

*Built. Tested. Pakistani. · the map fills itself now.*
