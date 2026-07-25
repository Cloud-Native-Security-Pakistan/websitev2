/**
 * heading-order — verifies a page's heading-level sequence descends without
 * skipping levels.
 *
 * Pure ES module: importable in both the browser and Node.
 *
 * The rule (Requirement 4.5): between any two consecutive headings the level may
 * stay the same, drop by any amount (h4 -> h2 closes two sections, which is
 * fine), or rise by at most one (h2 -> h3). A rise of two or more (h2 -> h4)
 * skips an intervening level and is a violation.
 *
 * Callers get back the offending positions, not just a boolean, so a report can
 * name the heading that is wrong.
 *
 * Validates: Requirements 4.5
 */

/** Lowest valid HTML heading level. */
export const MIN_HEADING_LEVEL = 1;

/** Highest valid HTML heading level. */
export const MAX_HEADING_LEVEL = 6;

/** Violation reason codes. */
export const HEADING_ORDER_VIOLATIONS = Object.freeze({
  SKIPPED_LEVEL: 'skipped-level',
  INVALID_LEVEL: 'invalid-level',
  FIRST_HEADING_NOT_H1: 'first-heading-not-h1',
});

/** True for an integer within the h1–h6 range. */
function isHeadingLevel(value) {
  return Number.isInteger(value) && value >= MIN_HEADING_LEVEL && value <= MAX_HEADING_LEVEL;
}

/**
 * Convert heading tags or selectors to numeric levels, e.g.
 * `['h1', 'H2', 'h3']` -> `[1, 2, 3]`. Anything unrecognized becomes `NaN` so
 * `checkHeadingOrder` reports it as an invalid level rather than silently
 * dropping it.
 * @param {(string|number)[]} tags
 * @returns {number[]}
 */
export function headingLevelsFromTags(tags) {
  const list = Array.isArray(tags) ? tags : [];
  return list.map((tag) => {
    if (typeof tag === 'number') return tag;
    const match = /^\s*h([1-6])\s*$/i.exec(String(tag));
    return match ? Number(match[1]) : Number.NaN;
  });
}

/**
 * Check a page's heading-level sequence.
 *
 * Edge cases: an empty sequence and a single heading have no consecutive pair,
 * so they are valid on the skip rule. A first heading that is not `h1` is
 * reported only when `requireH1First` is set, and it is reported separately from
 * the consecutive-pair violations so the two rules stay distinguishable.
 *
 * @param {number[]} levels - e.g. [1, 2, 2, 3, 2]
 * @param {{ requireH1First?: boolean }} [options]
 * @returns {{
 *   valid: boolean,
 *   levels: number[],
 *   violations: { index: number, level: number, previousLevel: number|null, previousIndex: number|null, skippedBy: number, reason: string, message: string }[],
 *   firstViolation: object|null
 * }}
 */
export function checkHeadingOrder(levels, options = {}) {
  const { requireH1First = false } = options;
  const sequence = Array.isArray(levels) ? levels.slice() : [];
  const violations = [];

  if (requireH1First && sequence.length > 0 && sequence[0] !== MIN_HEADING_LEVEL) {
    violations.push({
      index: 0,
      level: sequence[0],
      previousLevel: null,
      previousIndex: null,
      skippedBy: 0,
      reason: HEADING_ORDER_VIOLATIONS.FIRST_HEADING_NOT_H1,
      message: `heading 0: page starts at h${sequence[0]} instead of h1`,
    });
  }

  // The last in-range level seen, so an out-of-range entry does not corrupt the
  // comparison for the headings that follow it.
  let previousLevel = null;
  let previousIndex = null;

  for (let index = 0; index < sequence.length; index += 1) {
    const level = sequence[index];

    if (!isHeadingLevel(level)) {
      violations.push({
        index,
        level,
        previousLevel,
        previousIndex,
        skippedBy: 0,
        reason: HEADING_ORDER_VIOLATIONS.INVALID_LEVEL,
        message: `heading ${index}: ${String(level)} is not a heading level between h${MIN_HEADING_LEVEL} and h${MAX_HEADING_LEVEL}`,
      });
      continue;
    }

    if (previousLevel !== null && level - previousLevel > 1) {
      violations.push({
        index,
        level,
        previousLevel,
        previousIndex,
        skippedBy: level - previousLevel - 1,
        reason: HEADING_ORDER_VIOLATIONS.SKIPPED_LEVEL,
        message: `heading ${index}: h${previousLevel} -> h${level} skips ${level - previousLevel - 1} level(s)`,
      });
    }

    previousLevel = level;
    previousIndex = index;
  }

  return {
    valid: violations.length === 0,
    levels: sequence,
    violations,
    firstViolation: violations.length > 0 ? violations[0] : null,
  };
}

/**
 * Whether a sequence of heading levels never increases by more than one level
 * between consecutive headings.
 * @param {number[]} levels - e.g. [1, 2, 2, 3, 2]
 * @param {{ requireH1First?: boolean }} [options]
 * @returns {boolean}
 */
export function isValidHeadingOrder(levels, options = {}) {
  return checkHeadingOrder(levels, options).valid;
}

/**
 * The violations for a sequence, empty when the order is valid.
 * @param {number[]} levels
 * @param {{ requireH1First?: boolean }} [options]
 * @returns {object[]}
 */
export function findHeadingOrderViolations(levels, options = {}) {
  return checkHeadingOrder(levels, options).violations;
}
