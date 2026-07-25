/**
 * Feature: cnspk-website-platform, Property 4: Directory CSV round-trips
 * losslessly across all safe-column values, including CSV-special characters
 * (commas, double quotes, newlines).
 *
 * For any Public Directory record whose safe-column values are arbitrary strings
 * — including CSV-special characters — serializing the record to the Directory_CSV
 * format and parsing it back yields a record equal field-by-field across all
 * safe columns.
 *
 * Validates: Requirements 12.5
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { serializeCSV, parseCSV } from '../../js/lib/csv.js';

// The Public Directory safe columns (the only published shape).
const SAFE_COLUMNS = [
  'Membership No',
  'Name',
  'Role',
  'City',
  'Interests',
  'GitHub',
  'LinkedIn',
  'Approved',
];

// A field value built from arbitrary characters with CSV-special characters
// (comma, double quote, CR, LF, tab) deliberately mixed in so they appear often.
const fieldValue = fc.stringOf(
  fc.oneof(
    fc.char(),
    fc.constantFrom(',', '"', '\n', '\r', '\t', ';'),
    fc.fullUnicode()
  ),
  { maxLength: 50 }
);

// A safe-column record: every safe column mapped to an arbitrary field value.
const recordArb = fc.record(
  Object.fromEntries(SAFE_COLUMNS.map((col) => [col, fieldValue]))
);

describe('Property 4: Directory CSV round-trips losslessly', () => {
  it('serialize -> parse yields an equal record across all safe columns', () => {
    fc.assert(
      fc.property(recordArb, (record) => {
        const csv = serializeCSV([record], SAFE_COLUMNS);
        const parsed = parseCSV(csv);

        expect(parsed).toHaveLength(1);
        for (const col of SAFE_COLUMNS) {
          expect(parsed[0][col]).toBe(record[col]);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('round-trips a batch of records losslessly', () => {
    fc.assert(
      fc.property(fc.array(recordArb, { minLength: 1, maxLength: 10 }), (records) => {
        const csv = serializeCSV(records, SAFE_COLUMNS);
        const parsed = parseCSV(csv);

        expect(parsed).toHaveLength(records.length);
        records.forEach((record, r) => {
          for (const col of SAFE_COLUMNS) {
            expect(parsed[r][col]).toBe(record[col]);
          }
        });
      }),
      { numRuns: 200 }
    );
  });
});
