/**
 * intake-validation — schema-driven validator for the membership, dispatch,
 * hire, sponsor, and speak forms.
 *
 * Pure ES module: importable in both the browser and Node. The validator is
 * the single source of truth for the field constraints; the server-side
 * `/api/*` re-validation (Task 12.3) and the client forms (Task 12.1) both
 * mirror it.
 *
 * Rules enforced (Property 1):
 *   - required fields must be non-empty
 *   - single-line text fields are 1–200 characters
 *   - free-text fields are at most 1000 characters
 *   - email values match the standard `local@domain` shape
 *   - an opt-in control (dispatch newsletter) must be selected
 * On rejection the validator returns the offending field id and a message, and
 * it never mutates the supplied values so the caller can preserve entered input.
 *
 * Validates: Requirements 8.2, 8.3, 19.1, 19.2
 */

/** Inclusive character bounds for single-line text fields. */
export const SINGLE_LINE_MIN = 1;
export const SINGLE_LINE_MAX = 200;

/** Inclusive upper bound for free-text fields (no lower bound unless required). */
export const FREE_TEXT_MAX = 1000;

/**
 * Standard `local@domain` email shape:
 *   - a local part with no whitespace and no `@`
 *   - a single `@`
 *   - a domain with no whitespace/`@` containing at least one dot and a TLD
 * Intentionally pragmatic rather than full RFC 5322.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Standard `local@domain` email shape check.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value);
}

/**
 * Treats undefined / null / empty-string as "not provided".
 * Whitespace is significant for length, so a single space counts as one char.
 * @param {unknown} value
 * @returns {boolean}
 */
function isEmpty(value) {
  return value === undefined || value === null || value === '';
}

/**
 * Field schemas for the five intake forms. Each field is
 *   { id, type: 'singleline'|'freetext'|'email'|'optin', required: boolean }
 * and is checked in declaration order so the first offending field is reported.
 */
export const SCHEMAS = Object.freeze({
  membership: Object.freeze({
    fields: Object.freeze([
      { id: 'name', type: 'singleline', required: true },
      { id: 'email', type: 'email', required: true },
      { id: 'city', type: 'singleline', required: true },
      { id: 'role', type: 'singleline', required: true },
      { id: 'org', type: 'singleline', required: false },
      { id: 'interests', type: 'freetext', required: false },
      { id: 'github', type: 'singleline', required: false },
      { id: 'linkedin', type: 'singleline', required: false },
    ]),
  }),
  dispatch: Object.freeze({
    fields: Object.freeze([
      { id: 'email', type: 'email', required: true },
      { id: 'optIn', type: 'optin', required: true },
    ]),
  }),
  hire: Object.freeze({
    fields: Object.freeze([
      { id: 'name', type: 'singleline', required: true },
      { id: 'email', type: 'email', required: true },
      { id: 'org', type: 'singleline', required: true },
      { id: 'role_sought', type: 'singleline', required: true },
      { id: 'message', type: 'freetext', required: true },
    ]),
  }),
  sponsor: Object.freeze({
    fields: Object.freeze([
      { id: 'name', type: 'singleline', required: true },
      { id: 'email', type: 'email', required: true },
      { id: 'org', type: 'singleline', required: true },
      { id: 'sponsorship_interest', type: 'singleline', required: true },
      { id: 'message', type: 'freetext', required: true },
    ]),
  }),
  speak: Object.freeze({
    fields: Object.freeze([
      { id: 'name', type: 'singleline', required: true },
      { id: 'email', type: 'email', required: true },
      { id: 'talk_title', type: 'singleline', required: true },
      { id: 'abstract', type: 'freetext', required: true },
      { id: 'links', type: 'singleline', required: false },
    ]),
  }),
});

/**
 * Validate a single field value against its rule. Returns null when valid,
 * otherwise a { field, message } describing the first violation.
 * @param {object} field
 * @param {unknown} value
 * @returns {{ field: string, message: string } | null}
 */
function validateField(field, value) {
  const { id, type, required } = field;
  const empty = type === 'optin' ? value !== true : isEmpty(value);

  // Required fields must be present / selected.
  if (required && empty) {
    return {
      field: id,
      message: type === 'optin' ? 'This option must be selected.' : 'This field is required.',
    };
  }

  // Optional, unset fields need no further checks.
  if (!required && empty && type !== 'optin') {
    return null;
  }

  switch (type) {
    case 'optin':
      // Required already handled above; an optional opt-in is always acceptable.
      return null;

    case 'email':
      if (!isValidEmail(value)) {
        return { field: id, message: 'Enter a valid email address (local@domain).' };
      }
      return null;

    case 'singleline': {
      if (typeof value !== 'string') {
        return { field: id, message: 'This field must be text.' };
      }
      if (value.length < SINGLE_LINE_MIN || value.length > SINGLE_LINE_MAX) {
        return {
          field: id,
          message: `Must be between ${SINGLE_LINE_MIN} and ${SINGLE_LINE_MAX} characters.`,
        };
      }
      return null;
    }

    case 'freetext': {
      if (typeof value !== 'string') {
        return { field: id, message: 'This field must be text.' };
      }
      if (value.length > FREE_TEXT_MAX) {
        return { field: id, message: `Must be at most ${FREE_TEXT_MAX} characters.` };
      }
      return null;
    }

    default:
      return { field: id, message: `Unknown field type: ${type}.` };
  }
}

/**
 * Validate a form submission against a field schema without mutating `values`.
 *
 * @param {Record<string, unknown>} values - The entered field values.
 * @param {object|string} schema - A schema object ({ fields: [...] }) or the
 *   name of one of the built-in SCHEMAS ('membership' | 'dispatch' | 'hire' |
 *   'sponsor' | 'speak').
 * @returns {{ valid: boolean, field?: string, message?: string }}
 */
export function validateSubmission(values, schema) {
  const resolved = typeof schema === 'string' ? SCHEMAS[schema] : schema;
  if (!resolved || !Array.isArray(resolved.fields)) {
    throw new Error('validateSubmission: a schema with a `fields` array is required.');
  }

  const supplied = values && typeof values === 'object' ? values : {};

  for (const field of resolved.fields) {
    // Read-only access; never assign back into `supplied`.
    const result = validateField(field, supplied[field.id]);
    if (result) {
      return { valid: false, field: result.field, message: result.message };
    }
  }

  return { valid: true };
}
