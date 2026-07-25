/**
 * Unit tests for the privacy projection and PII egress guards (Task 4.4).
 *
 * Concrete examples: excluded-field detection, opt-in vs non-opt-in rows, and
 * share-payload PII rejection.
 *
 * Validates: Requirements 11.3, 11.9, 18.5
 */
import { describe, it, expect } from 'vitest';
import {
  SAFE_COLUMNS,
  toPublicRow,
  csvPublishGuard,
  outboundShareGuard,
} from '../js/lib/privacy-projection.js';

const baseSubmission = {
  membershipNo: 'CNSPK-0042',
  name: 'Ayesha Khan',
  role: 'Security Engineer',
  city: 'Lahore',
  interests: 'k8s, supply-chain',
  github: 'ayeshak',
  linkedin: 'in/ayeshak',
  email: 'ayesha@example.pk',
  shareWithPartners: true,
};

describe('toPublicRow — opt-in gating (Req 11.4, 11.5)', () => {
  it('returns a safe row when feature-me-publicly is set', () => {
    const row = toPublicRow({ ...baseSubmission, featurePublicly: true });
    expect(row).not.toBeNull();
    expect(Object.keys(row).sort()).toEqual([...SAFE_COLUMNS].sort());
    expect(row['Membership No']).toBe('CNSPK-0042');
    expect(row.Name).toBe('Ayesha Khan');
    expect(row.City).toBe('Lahore');
  });

  it('returns null when feature-me-publicly is not set', () => {
    expect(toPublicRow({ ...baseSubmission, featurePublicly: false })).toBeNull();
    expect(toPublicRow({ ...baseSubmission })).toBeNull();
  });
});

describe('toPublicRow — excluded-field detection (Req 11.3)', () => {
  it('never carries email or the share-with-partners flag into the public row', () => {
    const row = toPublicRow({ ...baseSubmission, featurePublicly: true });
    expect(Object.prototype.hasOwnProperty.call(row, 'email')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(row, 'shareWithPartners')).toBe(false);
    expect(outboundShareGuard(row).ok).toBe(true);
  });

  it('fills missing safe columns with empty strings rather than dropping them', () => {
    const row = toPublicRow({ featurePublicly: true, name: 'Solo' });
    expect(Object.keys(row).sort()).toEqual([...SAFE_COLUMNS].sort());
    expect(row.Name).toBe('Solo');
    expect(row.GitHub).toBe('');
  });
});

describe('csvPublishGuard — Directory_CSV PII halt (Req 11.9)', () => {
  it('passes a clean set of safe rows unchanged', () => {
    const rows = [toPublicRow({ ...baseSubmission, featurePublicly: true })];
    const result = csvPublishGuard(rows);
    expect(result.ok).toBe(true);
    expect(result.rows).toBe(rows);
  });

  it('halts publication when a row carries an email field', () => {
    const rows = [
      { 'Membership No': 'CNSPK-0001', Name: 'Ok' },
      { 'Membership No': 'CNSPK-0002', Name: 'Leak', email: 'leak@example.com' },
    ];
    const result = csvPublishGuard(rows);
    expect(result.ok).toBe(false);
    expect(result.rows).toBeUndefined();
    expect(result.violation.rowIndex).toBe(1);
    expect(result.violation.offendingFields[0].kind).toBe('email');
  });

  it('halts publication when a row carries the share-with-partners flag', () => {
    const rows = [{ 'Membership No': 'CNSPK-0003', Name: 'Flag', shareWithPartners: false }];
    const result = csvPublishGuard(rows);
    expect(result.ok).toBe(false);
    expect(result.violation.offendingFields[0].kind).toBe('share-with-partners');
  });

  it('detects an email value leaked into a safe column', () => {
    const rows = [{ 'Membership No': 'CNSPK-0004', City: 'reach me at x@y.io' }];
    expect(csvPublishGuard(rows).ok).toBe(false);
  });
});

describe('outboundShareGuard — share-payload PII rejection (Req 18.5)', () => {
  it('passes a safe-column-only payload', () => {
    const payload = { Name: 'Ayesha', Role: 'Engineer', City: 'Lahore' };
    const result = outboundShareGuard(payload);
    expect(result.ok).toBe(true);
    expect(result.payload).toBe(payload);
  });

  it('rejects a payload containing an email value and records the exposure', () => {
    const result = outboundShareGuard({ Name: 'Ayesha', email: 'ayesha@example.pk' });
    expect(result.ok).toBe(false);
    expect(result.payload).toBeUndefined();
    expect(result.violation.surface).toBe('outbound-share');
    expect(result.violation.offendingFields.some((f) => f.kind === 'email')).toBe(true);
  });

  it('rejects a payload containing the share-with-partners flag', () => {
    const result = outboundShareGuard({ Name: 'Ayesha', shareWithPartners: true });
    expect(result.ok).toBe(false);
    expect(result.violation.offendingFields.some((f) => f.kind === 'share-with-partners')).toBe(true);
  });

  it('ignores an empty email field as a non-value', () => {
    expect(outboundShareGuard({ Name: 'Ayesha', email: '' }).ok).toBe(true);
  });
});
