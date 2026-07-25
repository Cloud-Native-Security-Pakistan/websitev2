/**
 * Unit tests for the membership registry processor (Tasks 3.3, 3.4, 4.3, 5.3).
 *
 * `tools/create-membership-form.gs` is Google Apps Script: it depends on
 * SpreadsheetApp / PropertiesService / LockService / MailApp / ScriptApp, none
 * of which exist in Node, so the trigger itself cannot be executed here. This
 * suite therefore covers the script from three angles:
 *
 *  1. BEHAVIOUR of the pure mirrors in `js/lib/` that the script must agree
 *     with — numbering/padding (`membership-number.js`) and the privacy
 *     projection plus publish guard (`privacy-projection.js`).
 *  2. AGREEMENT between those mirrors and the script: the self-contained
 *     numbering and privacy-projection helpers are extracted from the `.gs`
 *     source text and evaluated in Node against a stub `CNSPK` config, then
 *     compared field-by-field with the pure modules. Only helpers with no
 *     Google-service dependency are extracted this way.
 *  3. STATIC assertions against the `.gs` source for the safeguards that can
 *     only be observed structurally: `LockService` serialization, the absence
 *     of the `slice(-4)` truncation bug, the excluded-field check preceding
 *     every public-sheet write, the publish guard gating the Directory_CSV,
 *     and a retry path that does not block the submit trigger with
 *     `Utilities.sleep`.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 10.1, 10.3, 10.4,
 * 10.5, 11.1, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 16.5, 17.2
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  formatMembershipNumber,
  nextMembershipNumber,
} from '../js/lib/membership-number.js';
import {
  SAFE_COLUMNS,
  toPublicRow,
  csvPublishGuard,
} from '../js/lib/privacy-projection.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const GS_PATH = path.join(here, '..', 'tools', 'create-membership-form.gs');
const GS = readFileSync(GS_PATH, 'utf8');

/**
 * The same source with comments stripped. Structural assertions run against
 * this so that prose describing a fixed bug (e.g. the words "slice(-4)" in the
 * file header) can never satisfy or break a check about the code itself.
 */
const CODE = GS
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

/** Slice a self-contained region of a source between two anchors. */
function region(src, startAnchor, endAnchor) {
  const start = src.indexOf(startAnchor);
  expect(start, `anchor not found: ${startAnchor}`).toBeGreaterThan(-1);
  const end = src.indexOf(endAnchor, start + startAnchor.length);
  expect(end, `anchor not found after start: ${endAnchor}`).toBeGreaterThan(start);
  return src.slice(start, end);
}

/** Stub of the script's CNSPK config, matching the values in the .gs file. */
const CNSPK_STUB = {
  MEMBER_PREFIX: 'CNSPK-',
  MEMBER_PAD: 4,
  FEATURE_OPT: 'Yes — feature me on the CNSPK website and members map',
  SAFE_COLUMNS: [...SAFE_COLUMNS],
};

// --- extract the numbering formatter from the script ---
const gsFormatMemberNo = new Function(
  'CNSPK',
  `${region(GS, 'function cnspkFormatMemberNo_', 'function cnspkReadLastNumber_')}
   return cnspkFormatMemberNo_;`
)(CNSPK_STUB);

// --- extract the privacy-projection mirror from the script ---
const gsPrivacy = new Function(
  'CNSPK',
  `${region(GS, 'var CNSPK_SAFE_COLUMN_SOURCES', 'function cnspkReadPublicRows_')}
   return {
     toPublicRow: cnspkToPublicRow_,
     detectPii: cnspkDetectPii_,
     csvPublishGuard: cnspkCsvPublishGuard_,
     confirmConsent: cnspkConfirmFeatureConsent_
   };`
)(CNSPK_STUB);

describe('numbering invariants — pure mirror (Req 9.1, 9.4)', () => {
  it('pads to a minimum of four digits', () => {
    expect(formatMembershipNumber(1)).toBe('CNSPK-0001');
    expect(formatMembershipNumber(281)).toBe('CNSPK-0281');
    expect(formatMembershipNumber(9999)).toBe('CNSPK-9999');
  });

  it('extends past 9999 without padding loss', () => {
    expect(formatMembershipNumber(10000)).toBe('CNSPK-10000');
    expect(formatMembershipNumber(123456)).toBe('CNSPK-123456');
    expect(formatMembershipNumber(999999999)).toBe('CNSPK-999999999');
  });

  it('assigns baseline + 1 as the first new number', () => {
    // MEMBERSHIP_SETUP.md: cnspk_last_no = 280 → first new member is 281.
    expect(nextMembershipNumber(280)).toBe('CNSPK-0281');
    expect(nextMembershipNumber(0)).toBe('CNSPK-0001');
    expect(nextMembershipNumber(9999)).toBe('CNSPK-10000');
  });
});

describe('numbering agreement — .gs mirror matches js/lib (Req 9.1, 9.4)', () => {
  it('produces the same string as formatMembershipNumber across the range', () => {
    const samples = [1, 9, 10, 99, 100, 280, 281, 999, 1000, 9999, 10000, 10001, 99999, 123456, 999999999];
    for (const n of samples) {
      expect(gsFormatMemberNo(n), `n=${n}`).toBe(formatMembershipNumber(n));
    }
  });

  it('never truncates a value above 9999 (the fixed slice(-4) bug)', () => {
    for (let n = 9995; n <= 10010; n += 1) {
      const formatted = gsFormatMemberNo(n);
      expect(formatted).toBe(`CNSPK-${String(n).padStart(4, '0')}`);
      expect(formatted.slice('CNSPK-'.length).replace(/^0+/, '')).toBe(String(n));
    }
  });
});

describe('privacy projection — opt-in only public rows (Req 11.4, 11.5)', () => {
  const submission = {
    membershipNo: 'CNSPK-0281',
    name: 'Ayesha Khan',
    role: 'Security Engineer',
    city: 'Lahore',
    interests: 'k8s, supply-chain',
    github: 'https://github.com/ayeshak',
    linkedin: 'https://linkedin.com/in/ayeshak',
  };

  it('emits exactly the safe columns for an opted-in submission', () => {
    const row = toPublicRow({ ...submission, featurePublicly: true });
    expect(Object.keys(row).sort()).toEqual([...SAFE_COLUMNS].sort());
    expect(gsPrivacy.toPublicRow({ ...submission, featurePublicly: true })).toEqual(row);
  });

  it('emits nothing when the feature-me opt-in is absent or false', () => {
    for (const optIn of [undefined, false, '', 0, null]) {
      const input = { ...submission, featurePublicly: optIn };
      expect(toPublicRow(input)).toBeNull();
      expect(gsPrivacy.toPublicRow(input)).toBeNull();
    }
  });

  it('keeps email and the partner flag out of the projected row', () => {
    const input = {
      ...submission,
      featurePublicly: true,
      email: 'ayesha@example.pk',
      shareWithPartners: true,
    };
    for (const row of [toPublicRow(input), gsPrivacy.toPublicRow(input)]) {
      expect(Object.keys(row)).toEqual([...SAFE_COLUMNS]);
      expect(JSON.stringify(row)).not.toContain('ayesha@example.pk');
      expect(csvPublishGuard([row]).ok).toBe(true);
      expect(gsPrivacy.csvPublishGuard([row]).ok).toBe(true);
    }
  });
});

describe('publish guard — halts on email or partner flag (Req 11.9)', () => {
  const cleanRow = {
    'Membership No': 'CNSPK-0281',
    Name: 'Ayesha Khan',
    Role: 'Security Engineer',
    City: 'Lahore',
    Interests: 'k8s',
    GitHub: '',
    LinkedIn: '',
  };

  it('passes a clean set of safe-column rows', () => {
    expect(csvPublishGuard([cleanRow, cleanRow]).ok).toBe(true);
    expect(gsPrivacy.csvPublishGuard([cleanRow, cleanRow]).ok).toBe(true);
  });

  it('halts the whole publication when any row carries an email value', () => {
    const rows = [cleanRow, { ...cleanRow, Email: 'leak@example.pk' }];
    for (const result of [csvPublishGuard(rows), gsPrivacy.csvPublishGuard(rows)]) {
      expect(result.ok).toBe(false);
      expect(result.rows == null).toBe(true);
      expect(result.violation.rowIndex).toBe(1);
      expect(result.violation.offendingFields[0].kind).toBe('email');
    }
  });

  it('halts when any row carries the share-with-partners flag, even when false', () => {
    const rows = [{ ...cleanRow, shareWithPartners: false }];
    for (const result of [csvPublishGuard(rows), gsPrivacy.csvPublishGuard(rows)]) {
      expect(result.ok).toBe(false);
      expect(result.violation.offendingFields[0].kind).toBe('share-with-partners');
    }
  });

  it('halts on an email value smuggled into a safe column', () => {
    const rows = [{ ...cleanRow, City: 'Lahore (reach me at x@y.io)' }];
    expect(csvPublishGuard(rows).ok).toBe(false);
    expect(gsPrivacy.csvPublishGuard(rows).ok).toBe(false);
  });
});

describe('consent confirmation in the script (Req 11.6, 11.7)', () => {
  it('confirms the exact opt-in option text as opted in', () => {
    const verdict = gsPrivacy.confirmConsent(CNSPK_STUB.FEATURE_OPT);
    expect(verdict).toMatchObject({ confirmed: true, optedIn: true });
  });

  it('confirms an empty cell as not opted in', () => {
    expect(gsPrivacy.confirmConsent('')).toMatchObject({ confirmed: true, optedIn: false });
    expect(gsPrivacy.confirmConsent('   ')).toMatchObject({ confirmed: true, optedIn: false });
  });

  it('refuses to confirm an unreadable or unrecognized consent value', () => {
    for (const value of [null, undefined, 'yes', 'Yes please', 'TRUE']) {
      const verdict = gsPrivacy.confirmConsent(value);
      expect(verdict.confirmed).toBe(false);
      expect(verdict.optedIn).toBe(false);
    }
  });
});

describe('static safeguards in tools/create-membership-form.gs', () => {
  it('serializes membership-number assignment with LockService (Req 9.2)', () => {
    expect(CODE).toContain('LockService.getScriptLock()');
    expect(CODE).toMatch(/lock\.tryLock\(CNSPK\.LOCK_TIMEOUT_MS\)/);
    expect(CODE).toContain('lock.releaseLock()');
  });

  it('no longer contains the slice(-4) truncation bug (Req 9.1)', () => {
    expect(CODE).not.toContain('slice(-4)');
    expect(CODE).not.toContain('slice(-CNSPK.MEMBER_PAD)');
    expect(CODE).not.toMatch(/\+\s*n\)\.slice\(/);
    // The formatter pads up to a minimum width instead of cutting a suffix.
    expect(CODE).toContain("while (digits.length < CNSPK.MEMBER_PAD)");
  });

  it('reads and persists the counter in Script Properties (Req 9.3, 9.4)', () => {
    expect(CODE).toContain("PROP_LAST_NO: 'cnspk_last_no'");
    expect(CODE).toContain('props.getProperty(CNSPK.PROP_LAST_NO)');
    expect(CODE).toContain('props.setProperty(CNSPK.PROP_LAST_NO, String(next))');
  });

  it('writes and verifies the number in the private row before consuming it (Req 9.5, 9.6)', () => {
    const assign = region(CODE, 'function cnspkAssignMembershipNumber_', 'function cnspkUtcNow_');
    const write = assign.indexOf('io.writeNumber(memberNo)');
    const verify = assign.indexOf('io.readBack()');
    const persist = assign.indexOf('props.setProperty(CNSPK.PROP_LAST_NO');
    expect(write).toBeGreaterThan(-1);
    expect(verify).toBeGreaterThan(write);
    expect(persist).toBeGreaterThan(verify);
    expect(assign).toContain('registry-write-failed');
  });

  it('halts assignment when the persisted counter cannot be read (Req 9.7)', () => {
    const read = region(CODE, 'function cnspkReadLastNumber_', 'function cnspkAssignMembershipNumber_');
    expect(read).toContain('counter-missing');
    expect(read).toContain('counter-malformed');
    expect(read).toContain('counter-read-threw');
    // A missing counter must never be silently treated as zero.
    expect(read).not.toMatch(/getProperty\([^)]*\)\s*\|\|\s*'0'/);
  });

  it('sends exactly one welcome email carrying the number, with no drip enrollment (Req 10.1, 10.2, 16.5)', () => {
    expect(CODE).toContain('cnspkMailAlreadySent_');
    expect(CODE).toContain('cnspkMarkMailSent_');
    expect(CODE).toContain("MAIL_SENT_PREFIX: 'cnspk_mail_sent_'");
    expect(CODE).toContain('Membership No: ');
    // Exactly two send sites: the member welcome and the organizer escalation.
    const sends = CODE.match(/MailApp\.sendEmail/g) || [];
    expect(sends.length).toBe(2);
    // No list enrollment and no recurring trigger — nothing can become a drip.
    expect(CODE).not.toMatch(/every(Minutes|Hours|Days|Weeks)\(/);
    expect(CODE).not.toMatch(/addSubscriber|mailingList|GroupsApp/i);
  });

  it('skips the send and records a failure entry for an invalid address (Req 10.3)', () => {
    const send = region(CODE, 'function cnspkSendWelcomeEmail_', 'function cnspkProcessEmailRetries');
    const validate = send.indexOf('cnspkIsValidEmail_(ctx.email)');
    const attempt = send.indexOf('cnspkSendWelcomeOnce_(ctx)');
    expect(validate).toBeGreaterThan(-1);
    expect(attempt).toBeGreaterThan(validate);
    expect(send).toContain('welcome-email-not-attempted');
    expect(send).toContain('invalid-address');
  });

  it('retries 3 times spaced >=30s inside a 5-minute window without blocking the trigger (Req 10.4)', () => {
    expect(CODE).toContain('MAX_SEND_ATTEMPTS: 3');
    expect(CODE).toMatch(/RETRY_SPACING_MS:\s*60 \* 1000/);
    expect(CODE).toMatch(/RETRY_WINDOW_MS:\s*5 \* 60 \* 1000/);
    expect(CODE).toContain('.after(CNSPK.RETRY_SPACING_MS)');
    // Utilities.sleep would burn the ~6 minute execution budget; it may appear
    // only in the one-time setup routine, never in the retry/email path.
    const sleeps = CODE.match(/Utilities\.sleep/g) || [];
    expect(sleeps.length).toBe(1);
    expect(CODE.indexOf('Utilities.sleep'))
      .toBeLessThan(CODE.indexOf('function cnspkFormatMemberNo_'));
    const retry = region(CODE, 'function cnspkProcessEmailRetries', 'var CNSPK_SAFE_COLUMN_SOURCES');
    expect(retry).not.toContain('Utilities.sleep');
    expect(retry).toContain('item.attempts >= CNSPK.MAX_SEND_ATTEMPTS');
    expect(retry).toContain('CNSPK.RETRY_WINDOW_MS');
  });

  it('escalates through a distinct channel when recording the failure fails (Req 10.5)', () => {
    const record = region(CODE, 'function cnspkRecordFailureOrEscalate_', 'function cnspkIsValidEmail_');
    expect(record).toContain('if (!recorded.ok)');
    expect(record).toContain('cnspkEscalate_(stamped)');
    const escalate = region(CODE, 'function cnspkEscalate_', 'function cnspkRecordFailureOrEscalate_');
    expect(escalate).toContain('MailApp.sendEmail'); // distinct from the Ops Log sheet
    expect(escalate).toContain('CNSPK.PROP_ESCALATIONS'); // quota-free last resort
  });

  it('checks for excluded fields before any public-sheet write (Req 11.5, 11.6)', () => {
    const writeFn = region(CODE, 'function cnspkWritePublicRow_', 'function cnspkReadPublicRows_');
    const consentGate = writeFn.indexOf('if (!consent.confirmed)');
    const optInGate = writeFn.indexOf('cnspkToPublicRow_(submission)');
    const piiCheck = writeFn.indexOf('cnspkDetectPii_(row)');
    const append = writeFn.indexOf('pub.appendRow(values)');
    expect(consentGate).toBeGreaterThan(-1);
    expect(optInGate).toBeGreaterThan(consentGate);
    expect(piiCheck).toBeGreaterThan(optInGate);
    expect(append).toBeGreaterThan(piiCheck);

    // The only other appendRow on the public sheet is the header row in setup.
    const appends = CODE.match(/pub\.appendRow\(/g) || [];
    expect(appends.length).toBe(2);
    expect(CODE).toContain('pub.appendRow(CNSPK.SAFE_COLUMNS.slice())');
  });

  it('keeps an unconfirmed member private and records the number for review (Req 11.7)', () => {
    const writeFn = region(CODE, 'function cnspkWritePublicRow_', 'function cnspkReadPublicRows_');
    expect(writeFn).toContain('consent-unconfirmed');
    expect(writeFn).toContain("kind: 'public-row-halted'");
    expect(writeFn).toContain('memberNo: memberNo');
  });

  it('publishes only the Public Directory, through the guard (Req 11.8, 11.9)', () => {
    const publish = region(CODE, 'function cnspkPublishDirectoryCsv', 'function cnspkBumpDirectoryRevision_');
    expect(publish).toContain('ss.getSheetByName(CNSPK.PUBLIC_SHEET)');
    expect(publish).not.toContain('CNSPK.RAW_SHEET_HINT)'); // never opens the private sheet
    const guard = publish.indexOf('cnspkCsvPublishGuard_(read.rows)');
    const halt = publish.indexOf('cnspkQuarantinePublicSheet_');
    expect(guard).toBeGreaterThan(-1);
    expect(halt).toBeGreaterThan(guard);
    expect(publish).toContain('publication halted');
  });

  it('offers an organizer-triggered immediate refresh and is honest about caching (Req 17.2)', () => {
    expect(CODE).toContain('function cnspkRefreshDirectoryNow()');
    const refresh = region(CODE, 'function cnspkRefreshDirectoryNow', 'function cnspkOnFormSubmit');
    expect(refresh).toContain('cnspkPublishDirectoryCsv()');
    expect(refresh).toContain('?rev=');
    // The ~5 minute published-CSV cache is stated to the organizer, not hidden.
    expect(refresh).toMatch(/~5 minutes/);
    expect(GS).toMatch(/Apps Script has NO API for File > Publish to web/);
  });

  it('keeps the documented setupCnspkMembership entry point intact', () => {
    expect(CODE).toContain('function setupCnspkMembership()');
    expect(CODE).toContain('FormApp.create(CNSPK.FORM_TITLE)');
    expect(CODE).toContain("SpreadsheetApp.create('CNSPK — Membership Registry')");
    expect(CODE).toContain('ss.insertSheet(CNSPK.PUBLIC_SHEET)');
    expect(CODE).toContain("ScriptApp.newTrigger('cnspkOnFormSubmit')");
    expect(CODE).toContain('.onFormSubmit()');
  });
});
