/**
 * Feature: cnspk-website-platform, Property 1: Input validation accepts exactly
 * the valid submissions and preserves entered values.
 *
 * For any generated form submission against a given form schema (membership,
 * dispatch newsletter, or a sub-ask), the validator SHALL accept the submission
 * if and only if every required field is non-empty, every single-line text field
 * is 1–200 characters, every free-text field is at most 1000 characters, the
 * email value matches `local@domain`, and (for dispatch) the opt-in control is
 * selected; and on rejection it SHALL identify the offending field and leave all
 * previously entered values unchanged.
 *
 * Validates: Requirements 8.2, 8.3, 19.1, 19.2
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  SCHEMAS,
  SINGLE_LINE_MIN,
  SINGLE_LINE_MAX,
  FREE_TEXT_MAX,
  isValidEmail,
  validateSubmission,
} from '../../js/lib/intake-validation.js';

const RUNS = 200; // ≥100 iterations per task requirement.

/**
 * Independent reference oracle for "is this submission valid?" — mirrors the
 * acceptance criteria directly rather than reusing the validator's internals.
 */
function oracleIsValid(values, schema) {
  for (const field of schema.fields) {
    const v = values[field.id];
    const empty = field.type === 'optin' ? v !== true : v === undefined || v === null || v === '';

    if (field.required && empty) return false;
    if (!field.required && empty && field.type !== 'optin') continue;

    if (field.type === 'email' && !isValidEmail(v)) return false;
    if (field.type === 'singleline') {
      if (typeof v !== 'string') return false;
      if (v.length < SINGLE_LINE_MIN || v.length > SINGLE_LINE_MAX) return false;
    }
    if (field.type === 'freetext') {
      if (typeof v !== 'string') return false;
      if (v.length > FREE_TEXT_MAX) return false;
    }
  }
  return true;
}

// --- Generators -------------------------------------------------------------

// A valid single-line value: 1..200 chars (any unicode, incl. a lone space).
const validSingleLine = fc.string({ minLength: SINGLE_LINE_MIN, maxLength: SINGLE_LINE_MAX });

// A valid free-text value for a REQUIRED field: 1..1000 chars (non-empty).
const validRequiredFreeText = fc.string({ minLength: 1, maxLength: FREE_TEXT_MAX });
// A valid free-text value for an OPTIONAL field: 0..1000 chars.
const validOptionalFreeText = fc.string({ maxLength: FREE_TEXT_MAX });

// A valid email of shape local@domain.tld.
const validEmail = fc
  .tuple(
    fc.stringMatching(/^[A-Za-z0-9._%+-]{1,20}$/),
    fc.stringMatching(/^[A-Za-z0-9-]{1,15}$/),
    fc.stringMatching(/^[A-Za-z]{2,6}$/),
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

// A grab-bag of values that may or may not satisfy a given field rule, so the
// validator and the oracle are exercised across the whole input space.
const messyValue = fc.oneof(
  fc.constant(undefined),
  fc.constant(null),
  fc.constant(''),
  fc.constant('   '),
  fc.boolean(),
  fc.integer(),
  fc.string({ maxLength: 5 }),
  validSingleLine,
  // Occasionally too long for a single line but ok for free text.
  fc.string({ minLength: SINGLE_LINE_MAX + 1, maxLength: 400 }),
  // Occasionally too long even for free text.
  fc.string({ minLength: FREE_TEXT_MAX + 1, maxLength: FREE_TEXT_MAX + 50 }),
  validEmail,
);

/** Build an arbitrary record covering exactly the schema's field ids. */
function arbitraryRecord(schema) {
  const shape = {};
  for (const field of schema.fields) {
    shape[field.id] =
      field.type === 'optin' ? fc.option(fc.boolean(), { nil: undefined }) : messyValue;
  }
  return fc.record(shape, { requiredKeys: [] });
}

/** Build a record guaranteed to satisfy the schema. */
function validRecord(schema) {
  const shape = {};
  for (const field of schema.fields) {
    if (field.type === 'optin') shape[field.id] = fc.constant(true);
    else if (field.type === 'email') shape[field.id] = validEmail;
    else if (field.type === 'freetext')
      shape[field.id] = field.required ? validRequiredFreeText : validOptionalFreeText;
    else shape[field.id] = validSingleLine;
  }
  return fc.record(shape);
}

const SCHEMA_NAMES = Object.keys(SCHEMAS);

describe('Property 1: intake validation accepts exactly valid submissions', () => {
  it('accepts iff the oracle considers the submission valid (across all schemas)', () => {
    for (const name of SCHEMA_NAMES) {
      const schema = SCHEMAS[name];
      fc.assert(
        fc.property(arbitraryRecord(schema), (values) => {
          const result = validateSubmission(values, name);
          expect(result.valid).toBe(oracleIsValid(values, schema));
        }),
        { numRuns: RUNS },
      );
    }
  });

  it('accepts every fully-valid record and reports valid:true', () => {
    for (const name of SCHEMA_NAMES) {
      fc.assert(
        fc.property(validRecord(SCHEMAS[name]), (values) => {
          expect(validateSubmission(values, name)).toEqual({ valid: true });
        }),
        { numRuns: RUNS },
      );
    }
  });

  it('on rejection identifies an offending field that is part of the schema', () => {
    for (const name of SCHEMA_NAMES) {
      const ids = SCHEMAS[name].fields.map((f) => f.id);
      fc.assert(
        fc.property(arbitraryRecord(SCHEMAS[name]), (values) => {
          const result = validateSubmission(values, name);
          if (!result.valid) {
            expect(ids).toContain(result.field);
            expect(typeof result.message).toBe('string');
            expect(result.message.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: RUNS },
      );
    }
  });

  it('never mutates the supplied values (preserves entered input)', () => {
    for (const name of SCHEMA_NAMES) {
      fc.assert(
        fc.property(arbitraryRecord(SCHEMAS[name]), (values) => {
          const snapshot = structuredClone(values);
          validateSubmission(values, name);
          expect(values).toEqual(snapshot);
        }),
        { numRuns: RUNS },
      );
    }
  });
});
