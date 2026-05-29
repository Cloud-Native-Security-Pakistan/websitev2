/**
 * CNSPK · Membership form + live members config
 * ----------------------------------------------------------
 * THE ONLY FILE YOU EDIT after creating the Google Form + Sheet.
 * Full setup walkthrough: /MEMBERSHIP_SETUP.md
 *
 * How it works (no backend):
 *   1. The brand-styled form on /join/ and /members/ POSTs to your Google Form.
 *   2. Google records the response in a linked Google Sheet.
 *   3. You publish that Sheet to the web as CSV.
 *   4. The members map fetches the CSV live and plots every member —
 *      they appear automatically, no JSON editing.
 *
 * Until you fill these in, everything degrades gracefully:
 *   - The form shows a "coming soon" note instead of submitting.
 *   - The map falls back to data/members.json (the seed members).
 * ----------------------------------------------------------
 */

export const MEMBERSHIP = {
  /**
   * Is the Google Form wired up yet? Set true after you complete setup.
   * When false: form is disabled (shows a notice), map uses members.json only.
   */
  enabled: false,

  /**
   * The Google Form POST endpoint.
   * From your form's edit URL:  https://docs.google.com/forms/d/e/FORM_ID/viewform
   * The POST endpoint is:       https://docs.google.com/forms/d/e/FORM_ID/formResponse
   * Paste the formResponse URL here.
   */
  formActionUrl: '',

  /**
   * The "entry.XXXXX" field IDs from your Google Form.
   * Get these from the form's pre-filled link (see MEMBERSHIP_SETUP.md step 4).
   * Map each CNSPK field to its Google entry id.
   */
  formFields: {
    name: 'entry.0000000000',
    role: 'entry.0000000000',
    city: 'entry.0000000000',
    interests: 'entry.0000000000',
    github: 'entry.0000000000',
    linkedin: 'entry.0000000000',
    consent: 'entry.0000000000'
  },

  /**
   * The published-to-web CSV URL of the linked Google Sheet.
   * File → Share → Publish to web → (the responses sheet) → CSV.
   * Looks like:
   *   https://docs.google.com/spreadsheets/d/e/SHEET_ID/pub?gid=0&single=true&output=csv
   */
  sheetCsvUrl: '',

  /**
   * Column header names in your Sheet, mapped to member fields.
   * Google adds a "Timestamp" column automatically; we ignore it.
   * Match these EXACTLY to the question text / column headers in your sheet.
   */
  sheetColumns: {
    name: 'Name',
    role: 'Role',
    city: 'City',
    interests: 'Interests',
    github: 'GitHub',
    linkedin: 'LinkedIn',
    consent: 'Consent',
    approved: 'Approved'   // optional moderation column (see requireApproval)
  },

  /**
   * Moderation toggle.
   *   false → fully automatic: every consenting submission appears on the map.
   *   true  → only rows where the "Approved" column says yes/true/approved show.
   * Default false per the "auto-add" request. Flip to true if you get spam.
   */
  requireApproval: false,

  /**
   * Only show submissions that ticked the consent box (real name + city go on a
   * PUBLIC map — consent is required for privacy). Strongly recommended: true.
   */
  requireConsent: true,

  /**
   * Cap how many live submissions to plot (safety valve against a spam flood).
   */
  maxLiveMembers: 1000
};
