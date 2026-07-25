/**
 * Feature: cnspk-website-platform, Property 3: PII never crosses any public
 * egress point, and public rows exist only for opt-ins.
 *
 * For any membership submission, the public projection exists iff the
 * feature-me-publicly opt-in is set, and whenever it exists its field set
 * equals exactly the safe-columns set and contains neither the email value nor
 * the share-with-partners flag; furthermore, for any candidate Directory_CSV and
 * any outbound share payload, publication/sharing is halted (emitting no data and
 * recording the attempted exposure) iff the artifact contains an email value or
 * the share-with-partners flag.
 *
 * Validates: Requirements 11.2, 11.3, 11.4, 11.5, 11.6, 11.9, 18.4, 18.5
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  SAFE_COLUMNS,
  toPublicRow,
  csvPublishGuard,
  outboundShareGuard,
} from '../../js/lib/privacy-projection.js';

const NUM_RUNS = 200;

// Arbitrary string value that can never look like an email (no '@'),
// while still exercising CSV-special characters (commas, quotes, newlines).
const safeValueArb = fc.string({ maxLength: 60 }).map((s) => s.replace(/@/g, '#'));

// A well-formed email value used to deliberately inject PII.
const emailArb = fc
  .tuple(
    fc.stringMatching(/^[a-z0-9]{1,12}$/),
    fc.stringMatching(/^[a-z0-9]{1,12}$/),
    fc.constantFrom('com', 'pk', 'org', 'io'),
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

// A full membership submission, including the PII fields that must never leak.
const submissionArb = fc.record({
  featurePublicly: fc.boolean(),
  shareWithPartners: fc.boolean(),
  email: emailArb,
  membershipNo: safeValueArb,
  name: safeValueArb,
  role: safeValueArb,
  city: safeValueArb,
  interests: safeValueArb,
  github: safeValueArb,
  linkedin: safeValueArb,
});

// A clean public row: exactly the safe columns with non-email values.
const cleanRowArb = fc.record(
  Object.fromEntries(SAFE_COLUMNS.map((col) => [col, safeValueArb])),
);

describe('Property 3 — opt-in gating and exact safe-column shape', () => {
  it('returns a public row iff feature-me-publicly is set, and never leaks PII', () => {
    fc.assert(
      fc.property(submissionArb, (submission) => {
        const row = toPublicRow(submission);

        if (!submission.featurePublicly) {
          // Non-opted-in members never get a public row.
          expect(row).toBeNull();
          return;
        }

        // Opted-in: the row exists and has exactly the safe columns.
        expect(row).not.toBeNull();
        expect(Object.keys(row).sort()).toEqual([...SAFE_COLUMNS].sort());

        // No email value and no share-with-partners flag survive the projection.
        expect(Object.prototype.hasOwnProperty.call(row, 'email')).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(row, 'shareWithPartners')).toBe(false);
        for (const value of Object.values(row)) {
          expect(String(value)).not.toMatch(/@/);
        }

        // A row produced by the projection always passes the egress guards.
        expect(outboundShareGuard(row).ok).toBe(true);
        expect(csvPublishGuard([row]).ok).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Property 3 — egress guards halt iff PII is present', () => {
  // Build an artifact from a clean row plus optional PII injections, tracking
  // whether any PII was actually added.
  const taintArb = fc.record({
    base: cleanRowArb,
    addEmailKey: fc.boolean(),
    addShareKey: fc.boolean(),
    addEmailValue: fc.boolean(),
    email: emailArb,
  });

  function buildArtifact(t) {
    const obj = { ...t.base };
    let hasPii = false;
    if (t.addEmailKey) {
      obj.email = t.email;
      hasPii = true;
    }
    if (t.addShareKey) {
      obj.shareWithPartners = true;
      hasPii = true;
    }
    if (t.addEmailValue) {
      obj.City = `lives near ${t.email}`;
      hasPii = true;
    }
    return { obj, hasPii };
  }

  it('outboundShareGuard passes iff no email value and no share flag', () => {
    fc.assert(
      fc.property(taintArb, (t) => {
        const { obj, hasPii } = buildArtifact(t);
        const result = outboundShareGuard(obj);
        expect(result.ok).toBe(!hasPii);
        if (hasPii) {
          // Halted: emit nothing, record the attempted exposure.
          expect(result.payload).toBeUndefined();
          expect(result.violation).toBeDefined();
          expect(result.violation.offendingFields.length).toBeGreaterThan(0);
        } else {
          expect(result.payload).toBe(obj);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('csvPublishGuard halts the whole publish iff any row carries PII', () => {
    fc.assert(
      fc.property(fc.array(taintArb, { maxLength: 8 }), (taints) => {
        const built = taints.map(buildArtifact);
        const rows = built.map((b) => b.obj);
        const anyPii = built.some((b) => b.hasPii);

        const result = csvPublishGuard(rows);
        expect(result.ok).toBe(!anyPii);
        if (anyPii) {
          expect(result.rows).toBeUndefined();
          expect(result.violation).toBeDefined();
          expect(result.violation.surface).toBe('directory-csv');
          expect(typeof result.violation.rowIndex).toBe('number');
        } else {
          expect(result.rows).toBe(rows);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
