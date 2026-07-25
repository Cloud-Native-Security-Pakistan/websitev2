/**
 * Unit tests for the heading-order checker (Task 10.1).
 *
 * Concrete examples: valid descents, skipped levels with their reported
 * positions, and the empty / single-heading / first-heading-not-h1 edges.
 *
 * Validates: Requirements 4.5
 */
import { describe, it, expect } from 'vitest';
import {
  checkHeadingOrder,
  isValidHeadingOrder,
  findHeadingOrderViolations,
  headingLevelsFromTags,
  HEADING_ORDER_VIOLATIONS,
} from '../js/lib/heading-order.js';

describe('isValidHeadingOrder — increases of at most one level', () => {
  it('accepts a sequence that steps down one level at a time', () => {
    expect(isValidHeadingOrder([1, 2, 3, 4, 5, 6])).toBe(true);
  });

  it('accepts repeated levels at the same depth', () => {
    expect(isValidHeadingOrder([1, 2, 2, 2, 3])).toBe(true);
  });

  it('accepts an ascent of any size (closing several sections)', () => {
    expect(isValidHeadingOrder([1, 2, 3, 4, 2])).toBe(true);
    expect(isValidHeadingOrder([1, 2, 3, 4, 5, 6, 1])).toBe(true);
  });

  it('rejects a jump that skips an intervening level', () => {
    expect(isValidHeadingOrder([1, 3])).toBe(false);
    expect(isValidHeadingOrder([1, 2, 2, 5])).toBe(false);
  });
});

describe('checkHeadingOrder — violation reporting', () => {
  it('names the offending position and the pair', () => {
    const result = checkHeadingOrder([1, 2, 4, 5]);
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);

    const [violation] = result.violations;
    expect(violation.index).toBe(2);
    expect(violation.previousIndex).toBe(1);
    expect(violation.previousLevel).toBe(2);
    expect(violation.level).toBe(4);
    expect(violation.skippedBy).toBe(1);
    expect(violation.reason).toBe(HEADING_ORDER_VIOLATIONS.SKIPPED_LEVEL);
    expect(result.firstViolation).toBe(violation);
  });

  it('reports every offending pair, not just the first', () => {
    const violations = findHeadingOrderViolations([1, 3, 1, 4]);
    expect(violations.map((v) => v.index)).toEqual([1, 3]);
    expect(violations.map((v) => v.skippedBy)).toEqual([1, 2]);
  });

  it('flags an out-of-range or non-integer level without corrupting later pairs', () => {
    const result = checkHeadingOrder([1, 7, 2]);
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].reason).toBe(HEADING_ORDER_VIOLATIONS.INVALID_LEVEL);
    expect(result.violations[0].index).toBe(1);

    expect(checkHeadingOrder([1, Number.NaN]).violations[0].reason).toBe(
      HEADING_ORDER_VIOLATIONS.INVALID_LEVEL,
    );
  });
});

describe('checkHeadingOrder — edge cases', () => {
  it('treats an empty sequence as valid with no violations', () => {
    const result = checkHeadingOrder([]);
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.firstViolation).toBeNull();
    expect(isValidHeadingOrder(undefined)).toBe(true);
  });

  it('treats a single heading as valid on the skip rule regardless of level', () => {
    expect(isValidHeadingOrder([1])).toBe(true);
    expect(isValidHeadingOrder([3])).toBe(true);
  });

  it('flags a first heading that is not h1 only when requireH1First is set', () => {
    expect(isValidHeadingOrder([2, 3])).toBe(true);

    const result = checkHeadingOrder([2, 3], { requireH1First: true });
    expect(result.valid).toBe(false);
    expect(result.violations[0].reason).toBe(HEADING_ORDER_VIOLATIONS.FIRST_HEADING_NOT_H1);
    expect(result.violations[0].index).toBe(0);
    expect(isValidHeadingOrder([1, 2], { requireH1First: true })).toBe(true);
  });
});

describe('headingLevelsFromTags', () => {
  it('converts heading tags to numeric levels, case-insensitively', () => {
    expect(headingLevelsFromTags(['h1', 'H2', 'h3'])).toEqual([1, 2, 3]);
  });

  it('maps unrecognized tags to NaN so they surface as invalid levels', () => {
    const levels = headingLevelsFromTags(['h1', 'div', 'h7']);
    expect(levels[0]).toBe(1);
    expect(Number.isNaN(levels[1])).toBe(true);
    expect(Number.isNaN(levels[2])).toBe(true);
    expect(isValidHeadingOrder(levels)).toBe(false);
  });
});
