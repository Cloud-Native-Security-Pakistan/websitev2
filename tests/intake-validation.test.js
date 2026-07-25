/**
 * Unit tests for intake-validation boundaries.
 *
 * Length boundaries (0/1/200/201 single-line, 1000/1001 free-text), valid and
 * invalid email shapes, and the dispatch opt-in unset case.
 *
 * Requirements: 8.2, 8.3, 19.2
 */
import { describe, it, expect } from 'vitest';
import {
  SINGLE_LINE_MAX,
  FREE_TEXT_MAX,
  isValidEmail,
  validateSubmission,
} from '../js/lib/intake-validation.js';

const repeat = (n) => 'a'.repeat(n);

// A complete, valid membership base we can tweak one field at a time.
function membershipBase(overrides = {}) {
  return {
    name: 'Ayesha Khan',
    email: 'ayesha@example.com',
    city: 'Lahore',
    role: 'Security Engineer',
    ...overrides,
  };
}

describe('single-line length boundaries (0/1/200/201)', () => {
  it('rejects a required single-line field at 0 chars (empty)', () => {
    const result = validateSubmission(membershipBase({ name: '' }), 'membership');
    expect(result.valid).toBe(false);
    expect(result.field).toBe('name');
  });

  it('accepts a required single-line field at 1 char', () => {
    expect(validateSubmission(membershipBase({ name: repeat(1) }), 'membership')).toEqual({
      valid: true,
    });
  });

  it('accepts a required single-line field at 200 chars', () => {
    expect(
      validateSubmission(membershipBase({ name: repeat(SINGLE_LINE_MAX) }), 'membership'),
    ).toEqual({ valid: true });
  });

  it('rejects a required single-line field at 201 chars', () => {
    const result = validateSubmission(
      membershipBase({ name: repeat(SINGLE_LINE_MAX + 1) }),
      'membership',
    );
    expect(result.valid).toBe(false);
    expect(result.field).toBe('name');
  });

  it('accepts an optional single-line field left empty (org)', () => {
    expect(validateSubmission(membershipBase({ org: '' }), 'membership')).toEqual({ valid: true });
  });

  it('rejects an optional single-line field that exceeds 200 chars (org)', () => {
    const result = validateSubmission(
      membershipBase({ org: repeat(SINGLE_LINE_MAX + 1) }),
      'membership',
    );
    expect(result.valid).toBe(false);
    expect(result.field).toBe('org');
  });
});

describe('free-text length boundaries (1000/1001)', () => {
  it('accepts free text at 1000 chars', () => {
    expect(
      validateSubmission(membershipBase({ interests: repeat(FREE_TEXT_MAX) }), 'membership'),
    ).toEqual({ valid: true });
  });

  it('rejects free text at 1001 chars', () => {
    const result = validateSubmission(
      membershipBase({ interests: repeat(FREE_TEXT_MAX + 1) }),
      'membership',
    );
    expect(result.valid).toBe(false);
    expect(result.field).toBe('interests');
  });

  it('rejects a required free-text field left empty (hire message)', () => {
    const result = validateSubmission(
      {
        name: 'Recruiter',
        email: 'r@example.com',
        org: 'Acme',
        role_sought: 'AppSec',
        message: '',
      },
      'hire',
    );
    expect(result.valid).toBe(false);
    expect(result.field).toBe('message');
  });
});

describe('email shape validation', () => {
  it.each(['a@b.co', 'first.last@example.com', 'user+tag@sub.domain.org', 'x@y.io'])(
    'accepts valid email %s',
    (email) => {
      expect(isValidEmail(email)).toBe(true);
    },
  );

  it.each(['', 'plainaddress', 'no-domain@', '@no-local.com', 'no domain@x.com', 'a@b', 'a@@b.com'])(
    'rejects invalid email %s',
    (email) => {
      expect(isValidEmail(email)).toBe(false);
    },
  );

  it('rejects a membership submission with a malformed email and flags the field', () => {
    const result = validateSubmission(membershipBase({ email: 'not-an-email' }), 'membership');
    expect(result.valid).toBe(false);
    expect(result.field).toBe('email');
  });
});

describe('dispatch opt-in', () => {
  it('accepts a valid email with the opt-in selected', () => {
    expect(validateSubmission({ email: 'sub@example.com', optIn: true }, 'dispatch')).toEqual({
      valid: true,
    });
  });

  it('rejects when the opt-in is unset (undefined)', () => {
    const result = validateSubmission({ email: 'sub@example.com' }, 'dispatch');
    expect(result.valid).toBe(false);
    expect(result.field).toBe('optIn');
  });

  it('rejects when the opt-in is explicitly false', () => {
    const result = validateSubmission({ email: 'sub@example.com', optIn: false }, 'dispatch');
    expect(result.valid).toBe(false);
    expect(result.field).toBe('optIn');
  });

  it('rejects a bad email before the opt-in is considered', () => {
    const result = validateSubmission({ email: 'bad', optIn: true }, 'dispatch');
    expect(result.valid).toBe(false);
    expect(result.field).toBe('email');
  });
});

describe('value preservation', () => {
  it('does not mutate the supplied values object', () => {
    const values = membershipBase({ name: '' });
    const snapshot = structuredClone(values);
    validateSubmission(values, 'membership');
    expect(values).toEqual(snapshot);
  });
});
