/**
 * Smoke test — verifies the Node test harness runs and that the js/lib/ pure-logic
 * module layer is importable with the expected stub signatures.
 *
 * Real behavior is covered by the property/unit suites added in later tasks.
 */
import { describe, it, expect } from 'vitest';
import * as lib from '../js/lib/index.js';

describe('test harness', () => {
  it('runs in single-execution mode', () => {
    expect(true).toBe(true);
  });
});

describe('js/lib barrel exports', () => {
  const expectedExports = [
    // intake-validation
    'isValidEmail',
    'validateSubmission',
    // membership-number
    'formatMembershipNumber',
    'nextMembershipNumber',
    // privacy-projection
    'SAFE_COLUMNS',
    'toPublicRow',
    'csvPublishGuard',
    'outboundShareGuard',
    // csv
    'serializeCSV',
    'parseCSV',
    // map-render
    'resolveCity',
    'buildPins',
    // sanitize
    'sanitizeHTML',
    // brand-tokens
    'isBrandToken',
    'isLimeSurfaceValid',
    'meetsBodyContrast',
    'isAcronymClean',
    // heading-order
    'isValidHeadingOrder',
    // channels
    'filterDoorways',
    // content-rules
    'projectRepoRule',
    'winIsAttributed',
    'selectSubmitTarget',
  ];

  it.each(expectedExports)('exports %s', (name) => {
    expect(lib[name]).toBeDefined();
  });

  it('exposes the frozen SAFE_COLUMNS set', () => {
    expect(Array.isArray(lib.SAFE_COLUMNS)).toBe(true);
    expect(lib.SAFE_COLUMNS).toContain('Membership No');
    expect(Object.isFrozen(lib.SAFE_COLUMNS)).toBe(true);
  });
});
