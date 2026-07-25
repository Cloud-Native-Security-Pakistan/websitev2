/**
 * membership-number — pure formatter mirroring the Apps Script numbering logic.
 *
 * Pure ES module: importable in both the browser and Node. This is the Node-side
 * mirror of the `Registration_Processor` numbering in
 * `tools/create-membership-form.gs` so the numbering rules can be property-tested
 * without Google infrastructure.
 *
 * Behavioral contract (Property 2 / Requirements 9.1, 9.4):
 *   - Format `CNSPK-NNNN`, zero-padded to a minimum of four digits.
 *   - Extend beyond four digits without padding loss when the value exceeds 9999
 *     (the Apps Script `slice(-4)` truncation bug is intentionally NOT mirrored).
 *   - The first assignment after baseline `b` equals `b + 1`.
 *   - The embedded sequence value of `n + 1` orders strictly after that of `n`.
 *
 * Validates: Requirements 9.1, 9.4
 */

/** Membership-number prefix, mirroring `CNSPK.MEMBER_PREFIX`. */
export const MEMBER_PREFIX = 'CNSPK-';

/** Minimum zero-padding width, mirroring `CNSPK.MEMBER_PAD`. */
export const MEMBER_PAD = 4;

/** Inclusive upper bound of the supported counter range (Requirement 9.4). */
export const MAX_COUNTER = 999_999_999;

/**
 * Assert that a value is a non-negative integer within the supported range.
 * @param {number} value
 * @param {string} label - Used in the thrown error message.
 */
function assertCounter(value, label) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new TypeError(`membership-number: ${label} must be an integer`);
  }
  if (value < 0 || value > MAX_COUNTER) {
    throw new RangeError(
      `membership-number: ${label} must be in range 0..${MAX_COUNTER}`
    );
  }
}

/**
 * Format a counter value as `CNSPK-NNNN`, zero-padded to at least four digits,
 * extending beyond four digits without padding loss.
 * @param {number} n - Counter value in range 0..999,999,999.
 * @returns {string} e.g. "CNSPK-0042" or "CNSPK-12345"
 */
export function formatMembershipNumber(n) {
  assertCounter(n, 'counter');
  return MEMBER_PREFIX + String(n).padStart(MEMBER_PAD, '0');
}

/**
 * Compute the first membership number assigned after a baseline (baseline + 1).
 * @param {number} baseline - Configured baseline in range 0..999,999,998.
 * @returns {string} The formatted next membership number.
 */
export function nextMembershipNumber(baseline) {
  assertCounter(baseline, 'baseline');
  if (baseline === MAX_COUNTER) {
    throw new RangeError(
      `membership-number: baseline ${baseline} has no successor in range`
    );
  }
  return formatMembershipNumber(baseline + 1);
}
