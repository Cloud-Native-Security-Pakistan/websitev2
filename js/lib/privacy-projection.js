/**
 * privacy-projection — projects a submission to the public-safe row shape and
 * guards every public egress point against PII leakage.
 *
 * Pure ES module: importable in both the browser and Node.
 *
 * The privacy boundary is physical: email and the share-with-partners consent
 * flag live only in the Private Registry. The only shapes this module ever emits
 * are built from the safe-columns set, and the two egress guards refuse to pass
 * any artifact that still carries an email value or the share-with-partners flag.
 *
 * Validates: Requirements 11.2, 11.3, 11.4, 11.5, 11.6, 11.9, 18.4, 18.5
 */

/**
 * The exact set of safe columns that may appear in the Public Directory.
 * @type {readonly string[]}
 */
export const SAFE_COLUMNS = Object.freeze([
  'Membership No',
  'Name',
  'Role',
  'City',
  'Interests',
  'GitHub',
  'LinkedIn',
]);

/**
 * Candidate source keys for each safe column, in priority order. A submission
 * may use canonical camelCase keys or the public display-name keys; either
 * resolves to the same safe column.
 * @type {Record<string, string[]>}
 */
const SAFE_COLUMN_SOURCES = Object.freeze({
  'Membership No': ['membershipNo', 'Membership No', 'memberNo', 'membershipNumber'],
  Name: ['name', 'Name'],
  Role: ['role', 'Role'],
  City: ['city', 'City'],
  Interests: ['interests', 'Interests'],
  GitHub: ['github', 'GitHub', 'githubUrl'],
  LinkedIn: ['linkedin', 'LinkedIn', 'linkedinUrl'],
});

/** Keys that signal the feature-me-publicly opt-in. */
const FEATURE_OPT_IN_KEYS = ['featurePublicly', 'feature_publicly', 'featureMePublicly', 'featureMe', 'feature'];

/** Normalize a key for forbidden-field matching: lowercase, alphanumeric only. */
function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Normalized keys that carry an email value — never allowed in a public artifact. */
const EMAIL_KEYS = new Set(['email', 'emailaddress', 'mail', 'useremail', 'contactemail']);

/** Normalized keys that carry the share-with-partners consent flag — never allowed public. */
const SHARE_KEYS = new Set([
  'sharewithpartners',
  'sharewithpartner',
  'sharepartners',
  'partnerconsent',
  'partners',
  'partnersharing',
]);

/** Standard `local@domain` shape, scanned anywhere within a string value. */
const EMAIL_VALUE_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/** True when any of the feature-opt-in keys is truthy on the submission. */
function isFeatureOptIn(submission) {
  if (!submission || typeof submission !== 'object') return false;
  return FEATURE_OPT_IN_KEYS.some((k) => Boolean(submission[k]));
}

/** First defined, non-undefined source value for a safe column, else ''. */
function pickSafeValue(submission, column) {
  const sources = SAFE_COLUMN_SOURCES[column] || [];
  for (const key of sources) {
    if (submission[key] !== undefined && submission[key] !== null) {
      return submission[key];
    }
  }
  return '';
}

/**
 * Inspect an arbitrary object for PII that must never cross a public egress point.
 * Returns the list of offending fields (empty when the object is clean).
 * @param {object} obj
 * @returns {{ field: string, kind: 'email' | 'share-with-partners' }[]}
 */
function detectPii(obj) {
  const offenders = [];
  if (!obj || typeof obj !== 'object') return offenders;

  for (const [key, value] of Object.entries(obj)) {
    const norm = normalizeKey(key);

    // The share-with-partners flag is forbidden by its mere presence.
    if (SHARE_KEYS.has(norm)) {
      offenders.push({ field: key, kind: 'share-with-partners' });
      continue;
    }

    // An email key counts when it actually carries a value.
    if (EMAIL_KEYS.has(norm)) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        offenders.push({ field: key, kind: 'email' });
      }
      continue;
    }

    // A stray email value leaked into any other field is still PII.
    if (typeof value === 'string' && EMAIL_VALUE_RE.test(value)) {
      offenders.push({ field: key, kind: 'email' });
    }
  }

  return offenders;
}

/**
 * Build a public directory row from a submission, but only when the
 * feature-me-publicly opt-in is set. The row contains exactly the safe columns
 * and never the email value or the share-with-partners flag.
 * @param {object} submission
 * @returns {object | null} The safe-column row, or null when not opted in.
 */
export function toPublicRow(submission) {
  if (!isFeatureOptIn(submission)) return null;

  const row = {};
  for (const column of SAFE_COLUMNS) {
    row[column] = pickSafeValue(submission, column);
  }
  return row;
}

/**
 * Guard the candidate Directory_CSV row set: halt (emit nothing, record the
 * attempted exposure) iff any row carries an email value or the
 * share-with-partners flag.
 * @param {object[]} rows
 * @returns {{ ok: boolean, rows?: object[], violation?: object }}
 */
export function csvPublishGuard(rows) {
  const list = Array.isArray(rows) ? rows : [];

  for (let i = 0; i < list.length; i += 1) {
    const offenders = detectPii(list[i]);
    if (offenders.length > 0) {
      // Halt the entire publication, emit nothing, record what was attempted.
      return {
        ok: false,
        violation: {
          reason: 'pii-egress-blocked',
          surface: 'directory-csv',
          rowIndex: i,
          offendingFields: offenders,
        },
      };
    }
  }

  return { ok: true, rows: list };
}

/**
 * Guard an outbound share payload: halt (emit nothing, record the attempted
 * exposure) iff it contains an email value or the share-with-partners flag.
 * @param {object} payload
 * @returns {{ ok: boolean, payload?: object, violation?: object }}
 */
export function outboundShareGuard(payload) {
  const offenders = detectPii(payload);
  if (offenders.length > 0) {
    return {
      ok: false,
      violation: {
        reason: 'pii-egress-blocked',
        surface: 'outbound-share',
        offendingFields: offenders,
      },
    };
  }

  return { ok: true, payload };
}
