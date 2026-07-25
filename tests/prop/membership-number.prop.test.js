/**
 * Feature: cnspk-website-platform, Property 2: Membership numbers are well-formed
 * and strictly increasing from the baseline.
 *
 * For any counter value `n` in 0..999,999,999 and any configured baseline `b`,
 * the formatter produces `^CNSPK-\d{4,}$` equal to `n` zero-padded to >= 4 digits
 * (extending beyond four digits without padding loss when n > 9999), the first
 * assignment after baseline `b` equals `b + 1`, and the value for `n + 1` orders
 * strictly after the value for `n`.
 *
 * Validates: Requirements 9.1, 9.4
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  formatMembershipNumber,
  nextMembershipNumber,
  MAX_COUNTER,
} from '../../js/lib/membership-number.js';

const WELL_FORMED = /^CNSPK-\d{4,}$/;
const RUNS = 200; // >= 100 iterations required by the plan.

/** Extract the embedded numeric sequence value from a membership number. */
function seqValue(memberNo) {
  return parseInt(memberNo.slice('CNSPK-'.length), 10);
}

describe('Property 2: membership numbers well-formed and strictly increasing', () => {
  it('formats to CNSPK-NNNN zero-padded to at least four digits (no padding loss past 9999)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX_COUNTER }), (n) => {
        const formatted = formatMembershipNumber(n);
        // Well-formed shape with >= 4 digits.
        expect(formatted).toMatch(WELL_FORMED);
        const digits = formatted.slice('CNSPK-'.length);
        expect(digits.length).toBeGreaterThanOrEqual(4);
        // Equals n zero-padded to a minimum of four digits.
        expect(digits).toBe(String(n).padStart(4, '0'));
        // The embedded value round-trips to exactly n (no truncation/padding loss).
        expect(seqValue(formatted)).toBe(n);
        // Beyond 9999: full digits preserved, no leading-zero loss.
        if (n > 9999) {
          expect(digits).toBe(String(n));
          expect(digits.length).toBe(String(n).length);
        }
      }),
      { numRuns: RUNS }
    );
  });

  it('assigns the first number after baseline b as b + 1', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX_COUNTER - 1 }), (b) => {
        expect(nextMembershipNumber(b)).toBe(formatMembershipNumber(b + 1));
        expect(seqValue(nextMembershipNumber(b))).toBe(b + 1);
      }),
      { numRuns: RUNS }
    );
  });

  it('orders the value for n + 1 strictly after the value for n', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX_COUNTER - 1 }), (n) => {
        const cur = formatMembershipNumber(n);
        const nxt = formatMembershipNumber(n + 1);
        // Both well-formed.
        expect(cur).toMatch(WELL_FORMED);
        expect(nxt).toMatch(WELL_FORMED);
        // Strictly increasing by embedded sequence value (the order that the
        // membership sequence defines, holding across the 9999 -> 10000 width change).
        expect(seqValue(nxt)).toBeGreaterThan(seqValue(cur));
        expect(seqValue(nxt)).toBe(seqValue(cur) + 1);
      }),
      { numRuns: RUNS }
    );
  });
});
