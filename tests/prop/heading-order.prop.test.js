/**
 * Feature: cnspk-website-platform, Property 9: Heading order descends without
 * skipping levels.
 *
 * For any public page, the sequence of heading levels never increases by more
 * than one level between consecutive headings.
 *
 * Validates: Requirements 4.5
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  HEADING_ORDER_VIOLATIONS,
  MAX_HEADING_LEVEL,
  MIN_HEADING_LEVEL,
  checkHeadingOrder,
  findHeadingOrderViolations,
  headingLevelsFromTags,
  isValidHeadingOrder,
} from '../../js/lib/heading-order.js';

/**
 * A valid sequence by construction: start at h1, then each step either descends
 * by any amount or rises by exactly one — never a skip.
 */
const validSequenceArb = fc
  .array(fc.integer({ min: 0, max: MAX_HEADING_LEVEL }), { maxLength: 15 })
  .map((steps) => {
    const levels = [MIN_HEADING_LEVEL];
    let current = MIN_HEADING_LEVEL;
    for (const step of steps) {
      // step 0 -> rise by exactly one (capped at h6); otherwise descend/stay.
      current =
        step === 0
          ? Math.min(current + 1, MAX_HEADING_LEVEL)
          : Math.max(MIN_HEADING_LEVEL, current - (step - 1));
      levels.push(current);
    }
    return levels;
  });

/** An arbitrary in-range sequence, which may well skip a level. */
const arbitrarySequenceArb = fc.array(
  fc.integer({ min: MIN_HEADING_LEVEL, max: MAX_HEADING_LEVEL }),
  { maxLength: 15 },
);

/** The same sequence spelled as heading tags, in mixed case. */
const asTags = (levels) => levels.map((level, i) => (i % 2 === 0 ? `h${level}` : `H${level}`));

/** Independent expectation: no consecutive pair may rise by more than one. */
function expectedValid(levels) {
  for (let i = 1; i < levels.length; i += 1) {
    if (levels[i] - levels[i - 1] > 1) return false;
  }
  return true;
}

describe('Property 9: heading levels never rise by more than one', () => {
  it('accepts exactly the sequences with no skipped level, and names every offending index', () => {
    fc.assert(
      fc.property(
        validSequenceArb,
        arbitrarySequenceArb,
        (valid, arbitrary) => {
          // Sequences built to the rule always pass.
          expect(isValidHeadingOrder(valid)).toBe(true);
          expect(findHeadingOrderViolations(valid)).toHaveLength(0);
          // They also start at h1, so the stricter check passes too.
          expect(isValidHeadingOrder(valid, { requireH1First: true })).toBe(true);

          // An arbitrary sequence matches the independently computed verdict.
          const expected = expectedValid(arbitrary);
          const result = checkHeadingOrder(arbitrary);
          expect(result.valid).toBe(expected);
          expect(isValidHeadingOrder(arbitrary)).toBe(expected);

          // Every reported violation names a real offending index.
          result.violations.forEach((violation) => {
            expect(violation.reason).toBe(HEADING_ORDER_VIOLATIONS.SKIPPED_LEVEL);
            expect(violation.index).toBeGreaterThan(0);
            expect(arbitrary[violation.index] - arbitrary[violation.index - 1]).toBeGreaterThan(1);
            expect(violation.previousLevel).toBe(arbitrary[violation.index - 1]);
            expect(violation.level).toBe(arbitrary[violation.index]);
            expect(violation.skippedBy).toBe(violation.level - violation.previousLevel - 1);
          });
          if (!expected) expect(result.firstViolation).not.toBeNull();

          // Tags resolve to the same levels, and so to the same verdict.
          const levelsFromTags = headingLevelsFromTags(asTags(arbitrary));
          expect(levelsFromTags).toEqual(arbitrary);
          expect(isValidHeadingOrder(levelsFromTags)).toBe(expected);

          // Edge cases: nothing to compare means nothing to violate.
          expect(isValidHeadingOrder([])).toBe(true);
          expect(isValidHeadingOrder(arbitrary.slice(0, 1))).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });
});
