/**
 * CNSPK · Membership registry config
 * ----------------------------------------------------------
 * THE ONLY FILE YOU EDIT after running the Apps Script
 * (tools/create-membership-form.gs). The script PRINTS this
 * exact block — copy it over. Full guide: /MEMBERSHIP_SETUP.md
 *
 * Privacy model:
 *   - The form collects email + a partner-sharing flag.
 *   - Those live ONLY in the PRIVATE responses sheet.
 *   - A separate "Public Directory" sheet (no email, opt-in only)
 *     is the ONLY thing published as CSV and read by the map.
 *
 * Until enabled:true + URLs are set, everything degrades:
 *   - the form shows a "coming soon" notice
 *   - the map falls back to data/members.json (seed members)
 * ----------------------------------------------------------
 */

export const MEMBERSHIP = {
  /** Set true after running the Apps Script and pasting the values below. */
  enabled: false,

  /** Google Form POST endpoint — the .../formResponse URL. */
  formActionUrl: '',

  /** entry.XXXX field ids — the Apps Script prints these for you. */
  formFields: {
    name: 'entry.0000000000',
    email: 'entry.0000000000',
    city: 'entry.0000000000',
    role: 'entry.0000000000',
    org: 'entry.0000000000',
    interests: 'entry.0000000000',
    github: 'entry.0000000000',
    linkedin: 'entry.0000000000',
    feature: 'entry.0000000000',   // "feature me publicly" opt-in checkbox
    share: 'entry.0000000000'      // "share with partners" opt-in checkbox
  },

  /**
   * The EXACT checkbox option text (must match the Google Form choice text,
   * because a checkbox submits its label as the value). The Apps Script
   * prints these too.
   */
  featureOptionText: 'Yes — feature me on the CNSPK website and members map',
  shareOptionText: 'Yes — CNSPK may share my details with partner organizations for hiring and internships',

  /**
   * Published-to-web CSV of the PUBLIC DIRECTORY sheet only.
   * (Never the raw responses sheet — that has email.)
   */
  sheetCsvUrl: '',

  /** Public Directory column headers → member fields. */
  sheetColumns: {
    membershipNo: 'Membership No',
    name: 'Name',
    role: 'Role',
    city: 'City',
    interests: 'Interests',
    github: 'GitHub',
    linkedin: 'LinkedIn'
  },

  /**
   * The public sheet is ALREADY opt-in only (the trigger only copies
   * featured members into it), so requireConsent/requireApproval are
   * belt-and-suspenders for the map loader.
   */
  requireConsent: false,    // public sheet only ever contains opt-in members
  requireApproval: false,   // set true + add an "Approved" col to gate manually
  maxLiveMembers: 2000
};
