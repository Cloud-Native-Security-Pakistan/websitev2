/**
 * CNSPK — Membership Registry generator (Google Apps Script)
 * ==========================================================
 * Builds the full CNSPK membership form, a PRIVATE responses
 * sheet, a PUBLIC directory sheet (safe columns only), a private
 * Ops Log, and an on-submit trigger that:
 *    • assigns each member a membership number (CNSPK-0001…),
 *      serialized with LockService so concurrent submissions can
 *      never collide (Req 9.2)
 *    • emails them their number + a welcome — exactly one email,
 *      never a drip sequence (Req 10.1, 10.2, 16.5)
 *    • copies ONLY public-safe fields to the public directory
 *      IF they opted into being featured, after verifying the row
 *      carries none of the excluded fields (Req 11.1–11.7)
 *
 * Privacy model — IMPORTANT:
 *    The raw responses sheet holds email + the partner-sharing
 *    flag and is NEVER published. Only the "Public Directory"
 *    sheet (no email, only opted-in members) is published as CSV
 *    and read by the website map. Every public write and every
 *    publish action passes an excluded-field check first; when a
 *    check cannot be satisfied we keep data PRIVATE and fail
 *    loudly (a halted publish beats a leaked email).
 *
 * Mirrors (keep in sync — the Node tests pin these rules):
 *    • js/lib/membership-number.js  → numbering / padding rules
 *    • js/lib/privacy-projection.js → toPublicRow, csvPublishGuard
 *    The pure mirrors are property-tested in Node; this file must
 *    agree with them. The historical `slice(-4)` truncation bug
 *    (which corrupted numbers above 9999) is fixed here.
 *
 * ---- HOW TO RUN (one time) ----
 * 1. https://script.google.com → New project.
 * 2. Paste this whole file. Save.
 * 3. Function dropdown → "setupCnspkMembership" → Run ▶.
 * 4. Approve the authorization prompt (your account, your data).
 * 5. Open  View → Logs  and copy the printed config block into
 *    js/membership-config.js.
 * 6. Publish ONLY the "Public Directory" sheet to web as CSV
 *    (instructions are printed in the log) and paste that URL
 *    into sheetCsvUrl.
 *
 * ---- ORGANIZER FUNCTIONS (run manually when needed) ----
 *    • cnspkPublishDirectoryCsv()   — guard + publish check (Req 11.8, 11.9)
 *    • cnspkRefreshDirectoryNow()   — immediate refresh after a removal (Req 17.2)
 *    • cnspkProcessEmailRetries()   — drains the welcome-email retry queue
 * ==========================================================
 */

// ---- Shared constants (keep in sync with MembershipForm.js) ----
var CNSPK = {
  FORM_TITLE: 'CNSPK Membership — Join the Chapter',
  PUBLIC_SHEET: 'Public Directory',
  RAW_SHEET_HINT: 'Form Responses 1',
  OPS_SHEET: 'Ops Log',                // PRIVATE: failure + escalation entries
  QUARANTINE_SHEET: 'Quarantine',      // PRIVATE: rows pulled out of the public sheet
  MEMBER_PREFIX: 'CNSPK-',
  MEMBER_PAD: 4,                       // CNSPK-0001 (MINIMUM width, never a truncation)
  FEATURE_OPT: 'Yes — feature me on the CNSPK website and members map',
  SHARE_OPT: 'Yes — CNSPK may share my details with partner organizations for hiring and internships',
  // The only columns that may ever appear in the Public Directory.
  // Mirrors SAFE_COLUMNS in js/lib/privacy-projection.js.
  SAFE_COLUMNS: ['Membership No', 'Name', 'Role', 'City', 'Interests', 'GitHub', 'LinkedIn'],

  // ---- Script Property keys ----
  PROP_LAST_NO: 'cnspk_last_no',            // baseline / last assigned counter (Req 9.3, 9.4)
  PROP_SS_ID: 'cnspk_ss_id',
  PROP_ORGANIZER: 'cnspk_organizer_email',  // escalation target (Req 10.5)
  PROP_RETRY_QUEUE: 'cnspk_pending_emails', // welcome-email retry queue (Req 10.4)
  PROP_DIRECTORY_REV: 'cnspk_directory_rev',// cache-busting revision (Req 17.2)
  PROP_ESCALATIONS: 'cnspk_escalation_backlog',
  MAIL_SENT_PREFIX: 'cnspk_mail_sent_',     // one-email-per-member marker (Req 10.1, 16.5)

  // ---- Timing / limits ----
  MAX_SEND_ATTEMPTS: 3,                // Req 10.4
  RETRY_SPACING_MS: 60 * 1000,         // ≥30s spacing required; we use 60s
  RETRY_WINDOW_MS: 5 * 60 * 1000,      // Req 10.4
  LOCK_TIMEOUT_MS: 30 * 1000,          // Req 9.2
  MAX_COUNTER: 999999999,              // Req 9.4 upper bound

  // Provincial/territorial capitals (each province once), + diaspora.
  // "Other" is enabled on the question itself for write-ins (see qCity below).
  CITIES: [
    'Islamabad',        // Federal Capital
    'Lahore',           // Punjab
    'Karachi',          // Sindh
    'Peshawar',         // Khyber Pakhtunkhwa
    'Quetta',           // Balochistan
    'Gilgit',           // Gilgit-Baltistan
    'Muzaffarabad',     // Azad Jammu & Kashmir
    'Outside Pakistan'  // diaspora
  ],
  ROLES: [
    'Student', 'Junior Engineer (0–2 yrs)', 'Engineer (3–5 yrs)',
    'Senior Engineer (6–10 yrs)', 'Staff / Principal (10+ yrs)',
    'Security Lead / CISO', 'Founder / Freelancer', 'Other'
  ]
};

function setupCnspkMembership() {
  // ---------- 1. Form ----------
  var form = FormApp.create(CNSPK.FORM_TITLE);
  form.setTitle(CNSPK.FORM_TITLE);
  form.setDescription(
    'Become a registered member of Cloud Native Security Pakistan. ' +
    'Every member gets a membership number. Required to fill once; ' +
    'whether you appear on the public map is your choice below. ' +
    'kubectl apply -f pakistan.yaml'
  );
  form.setConfirmationMessage(
    "You're registered. Your CNSPK membership number is on its way to your email. " +
    'Welcome to the chapter — read the CVE, drink the chai.'
  );
  form.setCollectEmail(false);          // we collect email as our own field (below)
  form.setAllowResponseEdits(false);
  form.setLimitOneResponsePerUser(false);
  form.setProgressBar(true);

  // ---------- 2. Questions (order defines sheet column order) ----------
  // COMPULSORY core membership fields
  var qName = form.addTextItem().setTitle('Full Name').setRequired(true);

  var qEmail = form.addTextItem()
    .setTitle('Email')
    .setHelpText('Where we send your membership number. Kept private — never shown publicly.')
    .setRequired(true);
  // light email validation
  try {
    qEmail.setValidation(
      FormApp.createTextValidation().requireTextIsEmail()
        .setHelpText('Please enter a valid email.').build()
    );
  } catch (e) {}

  var qCity = form.addTextItem()
    .setTitle('City')
    .setHelpText('Your city in Pakistan (or "Outside Pakistan" if abroad). The website form gives you a searchable list.')
    .setRequired(true);

  var qRole = form.addListItem()
    .setTitle('Role / Career stage')
    .setChoiceValues(CNSPK.ROLES)
    .setRequired(true);

  // OPTIONAL profile fields
  var qOrg = form.addTextItem()
    .setTitle('Organization / University')
    .setHelpText('Optional.')
    .setRequired(false);

  var qInterests = form.addTextItem()
    .setTitle('Interests')
    .setHelpText('Comma-separated, e.g. Kubernetes, DevSecOps, Supply Chain. Optional.')
    .setRequired(false);

  var qGithub = form.addTextItem().setTitle('GitHub').setHelpText('Profile URL. Optional.').setRequired(false);
  var qLinkedin = form.addTextItem().setTitle('LinkedIn').setHelpText('Profile URL. Optional.').setRequired(false);

  // CONSENT — both optional opt-ins
  var qFeature = form.addCheckboxItem()
    .setTitle('Public directory')
    .setHelpText('Optional. Leave unticked to stay a private member (you still get a number).')
    .setChoiceValues([CNSPK.FEATURE_OPT])
    .setRequired(false);

  var qShare = form.addCheckboxItem()
    .setTitle('Partner opportunities')
    .setHelpText('Optional. For internships / hiring from CNSPK partner organizations.')
    .setChoiceValues([CNSPK.SHARE_OPT])
    .setRequired(false);

  // ---------- 3. Response spreadsheet ----------
  var ss = SpreadsheetApp.create('CNSPK — Membership Registry');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  Utilities.sleep(1500);

  // Add "Membership No" column to the raw responses sheet
  var raw = ss.getSheets()[0];
  raw.setName(CNSPK.RAW_SHEET_HINT);
  var lastCol = raw.getLastColumn();
  raw.getRange(1, lastCol + 1).setValue('Membership No');

  // ---------- 4. Public Directory sheet (safe columns only) ----------
  var pub = ss.insertSheet(CNSPK.PUBLIC_SHEET);
  pub.appendRow(CNSPK.SAFE_COLUMNS.slice());
  pub.setFrozenRows(1);

  // ---------- 4b. Private operational sheets ----------
  // Ops Log: welcome-email failures, halted public rows, escalations (Req 10.3-10.5, 11.7).
  // Quarantine: rows removed from the Public Directory because they carried PII (Req 11.9).
  cnspkEnsureOpsSheets_(ss);

  // ---------- 5. Persist config for the trigger ----------
  var props = PropertiesService.getScriptProperties();
  // Baseline counter. Set this to 280 (Project Settings → Script Properties)
  // to make the first new member CNSPK-0281 (Req 9.4).
  props.setProperty(CNSPK.PROP_LAST_NO, '0');
  props.setProperty(CNSPK.PROP_SS_ID, ss.getId());
  props.setProperty(CNSPK.PROP_RETRY_QUEUE, '[]');
  try {
    var organizer = Session.getEffectiveUser().getEmail();
    if (organizer) props.setProperty(CNSPK.PROP_ORGANIZER, organizer);
  } catch (e) {}

  // ---------- 6. Install the on-submit trigger ----------
  // Remove any old trigger for this handler first (idempotent).
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'cnspkOnФormSubmit' || fn === 'cnspkOnFormSubmit' ||
        fn === 'cnspkProcessEmailRetries') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('cnspkOnFormSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  // ---------- 7. Print config ----------
  var publishedFormUrl = form.getPublishedUrl();
  var formResponseUrl = publishedFormUrl.replace('/viewform', '/formResponse');
  var entry = {
    name: 'entry.' + qName.getId(),
    email: 'entry.' + qEmail.getId(),
    city: 'entry.' + qCity.getId(),
    role: 'entry.' + qRole.getId(),
    org: 'entry.' + qOrg.getId(),
    interests: 'entry.' + qInterests.getId(),
    github: 'entry.' + qGithub.getId(),
    linkedin: 'entry.' + qLinkedin.getId(),
    feature: 'entry.' + qFeature.getId(),
    share: 'entry.' + qShare.getId()
  };

  var L = [];
  L.push('');
  L.push('======================================================================');
  L.push('  CNSPK MEMBERSHIP REGISTRY — CREATED');
  L.push('======================================================================');
  L.push('  Form (share/embed):  ' + publishedFormUrl);
  L.push('  Edit form:           ' + form.getEditUrl());
  L.push('  Registry spreadsheet:' + ss.getUrl());
  L.push('');
  L.push('  PRIVACY: the "' + CNSPK.RAW_SHEET_HINT + '" sheet has email + partner flag.');
  L.push('           DO NOT publish it. Publish ONLY the "' + CNSPK.PUBLIC_SHEET + '" sheet.');
  L.push('           "' + CNSPK.OPS_SHEET + '" and "' + CNSPK.QUARANTINE_SHEET + '" are private too.');
  L.push('');
  L.push('----------------------------------------------------------------------');
  L.push('  PASTE INTO  js/membership-config.js');
  L.push('----------------------------------------------------------------------');
  L.push('  enabled: true,');
  L.push("  formActionUrl: '" + formResponseUrl + "',");
  L.push('  formFields: {');
  L.push("    name:      '" + entry.name + "',");
  L.push("    email:     '" + entry.email + "',");
  L.push("    city:      '" + entry.city + "',");
  L.push("    role:      '" + entry.role + "',");
  L.push("    org:       '" + entry.org + "',");
  L.push("    interests: '" + entry.interests + "',");
  L.push("    github:    '" + entry.github + "',");
  L.push("    linkedin:  '" + entry.linkedin + "',");
  L.push("    feature:   '" + entry.feature + "',");
  L.push("    share:     '" + entry.share + "'");
  L.push('  },');
  L.push('  featureOptionText: ' + JSON.stringify(CNSPK.FEATURE_OPT) + ',');
  L.push('  shareOptionText:   ' + JSON.stringify(CNSPK.SHARE_OPT) + ',');
  L.push("  sheetCsvUrl: '<publish the \"" + CNSPK.PUBLIC_SHEET + "\" sheet as CSV, paste URL>',");
  L.push('  sheetColumns: {');
  L.push("    membershipNo: 'Membership No', name: 'Name', role: 'Role', city: 'City',");
  L.push("    interests: 'Interests', github: 'GitHub', linkedin: 'LinkedIn'");
  L.push('  },');
  L.push('');
  L.push('----------------------------------------------------------------------');
  L.push('  PUBLISH THE PUBLIC SHEET (only manual step):');
  L.push('   In the spreadsheet: File > Share > Publish to web');
  L.push('   > pick the "' + CNSPK.PUBLIC_SHEET + '" sheet (NOT entire document)');
  L.push('   > Comma-separated values (.csv) > Publish');
  L.push('   > paste the output=csv URL into sheetCsvUrl above.');
  L.push('');
  L.push('  THEN run cnspkPublishDirectoryCsv() once to verify the guard passes.');
  L.push('  After removing a member row, run cnspkRefreshDirectoryNow().');
  L.push('======================================================================');
  Logger.log(L.join('\n'));

  try {
    SpreadsheetApp.getUi().alert('CNSPK membership form created. Open View > Logs to copy the config block.');
  } catch (e) {}

  return L.join('\n');
}

/** Create the private Ops Log / Quarantine sheets if they are missing (idempotent). */
function cnspkEnsureOpsSheets_(ss) {
  var ops = ss.getSheetByName(CNSPK.OPS_SHEET);
  if (!ops) {
    ops = ss.insertSheet(CNSPK.OPS_SHEET);
    ops.appendRow(['UTC Timestamp', 'Kind', 'Membership No', 'Submitted Address', 'Reason', 'Detail']);
    ops.setFrozenRows(1);
  }
  var q = ss.getSheetByName(CNSPK.QUARANTINE_SHEET);
  if (!q) {
    q = ss.insertSheet(CNSPK.QUARANTINE_SHEET);
    q.appendRow(['UTC Timestamp', 'Reason', 'Original Row (JSON)']);
    q.setFrozenRows(1);
  }
  return { ops: ops, quarantine: q };
}

/* ==========================================================================
 * 1. MEMBERSHIP NUMBERING  (Requirements 9.1–9.7)
 * ==========================================================================
 * Mirrors js/lib/membership-number.js. The old implementation formatted with
 * `('0000000' + n).slice(-4)`, which silently TRUNCATED any sequence value
 * above 9999 (10000 → "0000"). Padding here is a MINIMUM width, never a cut.
 * ========================================================================== */

/**
 * Format a counter value as CNSPK-NNNN, zero-padded to a minimum of four
 * digits and extending to more digits without padding loss (Req 9.1).
 * @param {number} n Positive integer sequence value.
 * @return {string} e.g. "CNSPK-0281", "CNSPK-12345"
 */
function cnspkFormatMemberNo_(n) {
  var digits = String(n);
  while (digits.length < CNSPK.MEMBER_PAD) {
    digits = '0' + digits;
  }
  return CNSPK.MEMBER_PREFIX + digits;
}

/**
 * Inspect whatever a Private Registry "Membership No" cell already holds.
 *
 * Used as an idempotency gate: a spreadsheet form-submit trigger can be
 * re-delivered (Google retries a failed execution, and an organizer may re-run
 * the handler by hand after fixing a fault). Numbering the same row twice would
 * consume a second number and send a second welcome email, so an already
 * numbered row must be recognized rather than re-numbered (Req 9.2, 9.5).
 *
 * A cell holding something that is NOT a well-formed CNSPK number is reported
 * as present-but-invalid: we refuse to overwrite it, because we cannot tell
 * whether it is a hand-edited number that a member has already been told.
 *
 * @param {*} rawValue The current cell value.
 * @return {{present: boolean, valid: boolean, memberNo: string|null,
 *           sequence: number|null, text: string}}
 */
function cnspkParseMemberNo_(rawValue) {
  var text = String(rawValue === null || rawValue === undefined ? '' : rawValue).trim();
  if (text === '') {
    return { present: false, valid: false, memberNo: null, sequence: null, text: '' };
  }
  var prefix = CNSPK.MEMBER_PREFIX;
  if (text.slice(0, prefix.length) !== prefix) {
    return { present: true, valid: false, memberNo: null, sequence: null, text: text };
  }
  var digits = text.slice(prefix.length);
  if (!/^\d+$/.test(digits)) {
    return { present: true, valid: false, memberNo: null, sequence: null, text: text };
  }
  var sequence = parseInt(digits, 10);
  if (!isFinite(sequence) || sequence < 1 || sequence > CNSPK.MAX_COUNTER) {
    return { present: true, valid: false, memberNo: null, sequence: null, text: text };
  }
  // Re-format so a value written with different padding still resolves to the
  // canonical form the rest of the pipeline uses.
  return {
    present: true,
    valid: true,
    memberNo: cnspkFormatMemberNo_(sequence),
    sequence: sequence,
    text: text
  };
}

/**
 * Read the persisted last-assigned number (Req 9.3, 9.4).
 * An unreadable, missing or malformed value is NOT treated as zero — that
 * would restart numbering and hand out duplicates. We report failure so the
 * caller halts assignment (Req 9.7).
 * @return {{ok: boolean, value: number|null, error: string|null}}
 */
function cnspkReadLastNumber_(props) {
  var rawValue;
  try {
    rawValue = props.getProperty(CNSPK.PROP_LAST_NO);
  } catch (err) {
    // PropertiesService itself failed (quota, transient backend error).
    return { ok: false, value: null, error: 'counter-read-threw: ' + err };
  }
  if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
    return { ok: false, value: null, error: 'counter-missing' };
  }
  var text = String(rawValue).trim();
  if (!/^\d+$/.test(text)) {
    return { ok: false, value: null, error: 'counter-malformed: ' + text };
  }
  var value = parseInt(text, 10);
  if (!isFinite(value) || value < 0 || value > CNSPK.MAX_COUNTER) {
    return { ok: false, value: null, error: 'counter-out-of-range: ' + text };
  }
  return { ok: true, value: value, error: null };
}

/**
 * Assign the next membership number, serialized against concurrent
 * submissions (Req 9.2), and write it to the Private Registry row BEFORE the
 * number is consumed (Req 9.5).
 *
 * Ordering is deliberate:
 *   check the row is not already numbered → read counter → format candidate →
 *   write to the private row → verify the write by reading the cell back →
 *   only then persist the new counter.
 * If the write (or the read-back verification) fails, the counter is left
 * untouched, so the same number is offered to the next submission and no
 * member is silently numbered (Req 9.6).
 *
 * The leading already-numbered check makes the assignment idempotent: a
 * re-delivered or manually re-run submission reuses the number already in the
 * row instead of consuming a second one (Req 9.2).
 *
 * @param {{writeNumber: function(string): void, readBack: function(): string}} io
 *        writeNumber writes the value into the private row; readBack returns
 *        the value currently stored in that cell.
 * @return {{ok: boolean, memberNo: string|null, sequence: number|null,
 *           reused: boolean, error: string|null}}
 */
function cnspkAssignMembershipNumber_(props, io) {
  var lock = LockService.getScriptLock();
  var acquired = false;
  try {
    acquired = lock.tryLock(CNSPK.LOCK_TIMEOUT_MS);
  } catch (lockErr) {
    return { ok: false, memberNo: null, sequence: null, reused: false, error: 'lock-error: ' + lockErr };
  }
  if (!acquired) {
    // Refuse rather than race. The submission row stays un-numbered and the
    // failure is recorded/escalated by the caller.
    return { ok: false, memberNo: null, sequence: null, reused: false, error: 'lock-timeout' };
  }

  try {
    // ---- idempotency gate: never number the same row twice (Req 9.2) ----
    var existing;
    try {
      existing = cnspkParseMemberNo_(io.readBack());
    } catch (peekErr) {
      // Cannot tell whether the row is already numbered: halt rather than risk
      // handing out a second number for the same member.
      return {
        ok: false, memberNo: null, sequence: null, reused: false,
        error: 'registry-read-failed: ' + peekErr
      };
    }
    if (existing.present) {
      if (!existing.valid) {
        return {
          ok: false, memberNo: null, sequence: null, reused: false,
          error: 'registry-cell-unrecognized: "' + existing.text + '"'
        };
      }
      // Already assigned in an earlier delivery of this submission. The counter
      // is untouched, so no number is consumed a second time.
      return {
        ok: true, memberNo: existing.memberNo, sequence: existing.sequence,
        reused: true, error: null
      };
    }

    var read = cnspkReadLastNumber_(props);
    if (!read.ok) {
      // Req 9.7 — halt instead of risking a duplicate.
      return { ok: false, memberNo: null, sequence: null, reused: false, error: read.error };
    }
    if (read.value >= CNSPK.MAX_COUNTER) {
      return { ok: false, memberNo: null, sequence: null, reused: false, error: 'counter-exhausted' };
    }

    var next = read.value + 1;                       // baseline + 1 (Req 9.4)
    var memberNo = cnspkFormatMemberNo_(next);

    // ---- write to the Private Registry row first (Req 9.5) ----
    try {
      io.writeNumber(memberNo);
      SpreadsheetApp.flush();
    } catch (writeErr) {
      // Number NOT consumed: counter still holds read.value (Req 9.6).
      return {
        ok: false, memberNo: null, sequence: null, reused: false,
        error: 'registry-write-failed: ' + writeErr
      };
    }

    // ---- verify the write actually landed before consuming the number ----
    var confirmed = '';
    try {
      confirmed = String(io.readBack() || '').trim();
    } catch (verifyErr) {
      return {
        ok: false, memberNo: null, sequence: null, reused: false,
        error: 'registry-verify-failed: ' + verifyErr
      };
    }
    if (confirmed !== memberNo) {
      return {
        ok: false, memberNo: null, sequence: null, reused: false,
        error: 'registry-write-unconfirmed: expected ' + memberNo + ' found "' + confirmed + '"'
      };
    }

    // ---- only now is the number consumed (Req 9.3) ----
    try {
      props.setProperty(CNSPK.PROP_LAST_NO, String(next));
    } catch (persistErr) {
      // The row already carries the number but the counter did not advance:
      // the next submission would reuse it. Surface loudly instead of
      // pretending success.
      // The idempotency gate above keeps this recoverable: the row keeps the
      // number, and a re-run reuses it rather than issuing a second one.
      return {
        ok: false, memberNo: memberNo, sequence: next, reused: false,
        error: 'counter-persist-failed: ' + persistErr
      };
    }

    return { ok: true, memberNo: memberNo, sequence: next, reused: false, error: null };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/* ==========================================================================
 * 2. FAILURE RECORDING + ESCALATION  (Requirements 10.3, 10.4, 10.5, 11.7)
 * ========================================================================== */

/** UTC timestamp, ISO-8601 — the format every failure entry uses. */
function cnspkUtcNow_() {
  return new Date().toISOString();
}

/**
 * Record a failure entry in the private Ops Log.
 * Entry fields per Req 10.3 / 10.4: member identifier, submitted address,
 * UTC timestamp, reason.
 * @return {{ok: boolean, error: string|null}}
 */
function cnspkRecordFailure_(ss, entry) {
  try {
    var sheets = cnspkEnsureOpsSheets_(ss);
    sheets.ops.appendRow([
      entry.timestamp || cnspkUtcNow_(),
      entry.kind || 'failure',
      entry.memberNo || '',
      entry.address || '',
      entry.reason || '',
      entry.detail || ''
    ]);
    SpreadsheetApp.flush();
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Escalate when recording the failure ITSELF failed (Req 10.5).
 *
 * The failed mechanism is the spreadsheet Ops Log, so the escalation channel
 * is a direct organizer email — a different mechanism, sent immediately
 * (well inside the 60s requirement, since this runs in the same execution).
 *
 * Honest limitation: if the member's welcome email failed because the MailApp
 * daily quota is exhausted, the organizer email can fail too. That is why
 * there is a third, quota-free channel: the escalation backlog Script Property
 * plus a loud Logger entry, which surfaces in the Apps Script execution log
 * and in the failure notification Google sends the script owner.
 */
function cnspkEscalate_(entry) {
  var props = PropertiesService.getScriptProperties();
  var organizer = '';
  try { organizer = props.getProperty(CNSPK.PROP_ORGANIZER) || ''; } catch (e) {}

  var summary =
    'CNSPK registry escalation (' + (entry.kind || 'failure') + ')\n' +
    'When (UTC): ' + (entry.timestamp || cnspkUtcNow_()) + '\n' +
    'Member:     ' + (entry.memberNo || '(unassigned)') + '\n' +
    'Address:    ' + (entry.address || '(none)') + '\n' +
    'Reason:     ' + (entry.reason || '') + '\n' +
    'Detail:     ' + (entry.detail || '');

  if (organizer) {
    try {
      MailApp.sendEmail({
        to: organizer,
        subject: '[CNSPK] registry failure needs manual follow-up: ' + (entry.reason || 'unknown'),
        body: summary
      });
      return { ok: true, channel: 'organizer-email' };
    } catch (mailErr) {
      summary += '\nEscalation email also failed: ' + mailErr;
    }
  } else {
    summary += '\nNo organizer address configured (' + CNSPK.PROP_ORGANIZER + ').';
  }

  // Quota-free last resort: persist + log loudly. Never swallow silently.
  try {
    var backlog = props.getProperty(CNSPK.PROP_ESCALATIONS) || '';
    props.setProperty(CNSPK.PROP_ESCALATIONS, (backlog + '\n' + summary).slice(-8000));
  } catch (e) {}
  Logger.log('CNSPK ESCALATION (unrecorded): ' + summary);
  return { ok: false, channel: 'script-property-backlog' };
}

/**
 * Record a failure and escalate if the recording itself did not succeed
 * (Req 10.5). Always use this instead of calling cnspkRecordFailure_ directly.
 */
function cnspkRecordFailureOrEscalate_(ss, entry) {
  var stamped = {
    timestamp: entry.timestamp || cnspkUtcNow_(),
    kind: entry.kind || 'failure',
    memberNo: entry.memberNo || '',
    address: entry.address || '',
    reason: entry.reason || '',
    detail: entry.detail || ''
  };
  var recorded = cnspkRecordFailure_(ss, stamped);
  if (!recorded.ok) {
    stamped.detail = (stamped.detail ? stamped.detail + ' | ' : '') +
      'ops-log write failed: ' + recorded.error;
    cnspkEscalate_(stamped);
  }
  return recorded;
}

/* ==========================================================================
 * 3. WELCOME EMAIL  (Requirements 10.1–10.5, 16.5)
 * ==========================================================================
 * Exactly one email per registration, containing the assigned number, sent in
 * the same execution as the assignment (so well inside 60s). No list
 * subscription, no follow-up schedule, no drip sequence — ever (Req 16.5,
 * binding per JOIN_STRATEGY.md §8).
 *
 * Retry design (Req 10.4) — and the Apps Script compromise it works around:
 *   Utilities.sleep() would burn the shared ~6-minute execution budget of the
 *   form-submit trigger, so three attempts spaced ≥30s cannot be done inline.
 *   Instead a failed send is queued in a Script Property and a ONE-OFF
 *   time-based trigger (+60s) runs cnspkProcessEmailRetries(), which retries
 *   and re-queues until 3 attempts are used or the 5-minute window closes,
 *   then records the failure entry. The submit trigger returns immediately.
 * ========================================================================== */

/** local@domain format check, mirroring js/lib/intake-validation.js. */
function cnspkIsValidEmail_(value) {
  var text = String(value == null ? '' : value).trim();
  if (!text) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

/** Idempotency marker so a member can never receive two welcome emails. */
function cnspkMailAlreadySent_(props, memberNo) {
  try {
    return !!props.getProperty(CNSPK.MAIL_SENT_PREFIX + memberNo);
  } catch (e) {
    // If we cannot tell, assume it was sent: a missing email is recoverable by
    // hand, a duplicate email violates Req 10.2 / 16.5.
    return true;
  }
}

function cnspkMarkMailSent_(props, memberNo) {
  try {
    props.setProperty(CNSPK.MAIL_SENT_PREFIX + memberNo, cnspkUtcNow_());
  } catch (e) {
    Logger.log('CNSPK: could not persist sent-marker for ' + memberNo + ': ' + e);
  }
}

/** The one welcome message. Contains the assigned number (Req 10.1). */
function cnspkWelcomeBody_(ctx) {
  return '<div style="font-family:Inter,Arial,sans-serif;color:#0F1115;line-height:1.6">' +
    '<p>Salaam ' + escapeHtml_(String(ctx.name || 'member').split(' ')[0]) + ',</p>' +
    '<p>Your registration succeeded — you are now a registered member of ' +
    '<strong>Cloud Native Security Pakistan</strong>.</p>' +
    '<p style="font-size:20px"><strong>Membership No: ' +
    '<span style="color:#0a8a45">' + escapeHtml_(ctx.memberNo) + '</span></strong></p>' +
    '<p>' + (ctx.isFeatured
      ? 'You opted to be featured — your pin will appear on the public members map shortly.'
      : 'You chose to stay a private member. You can ask to be featured any time.') +
    '</p>' +
    '<p>This is the only email your registration triggers. We do not run drip ' +
    'sequences; anything beyond this is opt-in only.</p>' +
    '<p>Read the CVE. Drink the chai.<br>— The CNSPK organizers</p>' +
    '<p style="font-family:monospace;color:#6B7280;font-size:12px">kubectl apply -f pakistan.yaml</p>' +
    '</div>';
}

/**
 * Attempt one send. Returns {ok, error} — never throws.
 * Checks the MailApp daily quota (~100 consumer / 1500 Workspace) first and
 * fails loudly with a distinct reason rather than dropping the mail silently.
 */
function cnspkSendWelcomeOnce_(ctx) {
  var remaining = null;
  try {
    remaining = MailApp.getRemainingDailyQuota();
  } catch (quotaErr) {
    remaining = null; // quota unknown; attempt the send anyway
  }
  if (remaining !== null && remaining <= 0) {
    return { ok: false, error: 'mail-quota-exhausted (remaining=0)' };
  }
  try {
    MailApp.sendEmail({
      to: ctx.email,
      subject: 'Welcome to CNSPK — your membership number is ' + ctx.memberNo,
      htmlBody: cnspkWelcomeBody_(ctx)
    });
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Queue helpers for the pending-retry list held in Script Properties. */
function cnspkReadRetryQueue_(props) {
  try {
    var raw = props.getProperty(CNSPK.PROP_RETRY_QUEUE);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    return Object.prototype.toString.call(parsed) === '[object Array]' ? parsed : [];
  } catch (e) {
    Logger.log('CNSPK: retry queue unreadable, starting empty: ' + e);
    return [];
  }
}

function cnspkWriteRetryQueue_(props, queue) {
  try {
    props.setProperty(CNSPK.PROP_RETRY_QUEUE, JSON.stringify(queue));
    return true;
  } catch (e) {
    Logger.log('CNSPK: retry queue write failed: ' + e);
    return false;
  }
}

/** Schedule the one-off retry pass (never a recurring member-facing sequence). */
function cnspkScheduleRetryPass_() {
  try {
    ScriptApp.newTrigger('cnspkProcessEmailRetries')
      .timeBased()
      .after(CNSPK.RETRY_SPACING_MS)   // ≥30s spacing (Req 10.4)
      .create();
    return true;
  } catch (e) {
    Logger.log('CNSPK: could not schedule retry pass: ' + e);
    return false;
  }
}

/**
 * Send the single welcome email for a freshly assigned number.
 * The assigned Membership_Number is retained in every failure path (Req 10.3, 10.4).
 * @return {{ok: boolean, skipped: boolean, reason: string|null}}
 */
function cnspkSendWelcomeEmail_(ss, props, ctx) {
  // Req 10.3 — empty or malformed address: do not attempt the send at all.
  if (!cnspkIsValidEmail_(ctx.email)) {
    cnspkRecordFailureOrEscalate_(ss, {
      kind: 'welcome-email-not-attempted',
      memberNo: ctx.memberNo,
      address: String(ctx.email == null ? '' : ctx.email),
      reason: String(ctx.email == null || String(ctx.email).trim() === ''
        ? 'invalid-address: empty'
        : 'invalid-address: failed local@domain format validation')
    });
    return { ok: false, skipped: true, reason: 'invalid-address' };
  }

  // Req 10.2 / 16.5 — exactly one email per registration.
  if (cnspkMailAlreadySent_(props, ctx.memberNo)) {
    return { ok: true, skipped: true, reason: 'already-sent' };
  }

  var attempt = cnspkSendWelcomeOnce_(ctx);
  if (attempt.ok) {
    cnspkMarkMailSent_(props, ctx.memberNo);
    return { ok: true, skipped: false, reason: null };
  }

  // Attempt 1 of 3 failed → queue the remaining attempts out-of-band.
  var now = Date.now();
  var queue = cnspkReadRetryQueue_(props);
  queue.push({
    memberNo: ctx.memberNo,
    email: String(ctx.email).trim(),
    name: ctx.name || '',
    isFeatured: !!ctx.isFeatured,
    attempts: 1,
    firstAttemptAt: now,
    nextAttemptAt: now + CNSPK.RETRY_SPACING_MS,
    lastError: attempt.error
  });
  var queued = cnspkWriteRetryQueue_(props, queue);

  if (!queued) {
    // Cannot queue → we cannot honour the retry schedule; record now.
    cnspkRecordFailureOrEscalate_(ss, {
      kind: 'welcome-email-failed',
      memberNo: ctx.memberNo,
      address: String(ctx.email).trim(),
      reason: 'send-failed and retry queue unavailable',
      detail: attempt.error
    });
    return { ok: false, skipped: false, reason: 'queue-unavailable' };
  }

  cnspkScheduleRetryPass_();
  return { ok: false, skipped: false, reason: 'queued-for-retry' };
}

/**
 * Drain the welcome-email retry queue. Installed as a one-off time-based
 * trigger; also safe to run manually.
 *
 * Per queued member: at most CNSPK.MAX_SEND_ATTEMPTS attempts, each ≥30s
 * apart, all inside a 5-minute window. When the attempts or the window are
 * exhausted, a failure entry is recorded (member id, address, UTC timestamp,
 * reason) and the assigned number is retained (Req 10.4).
 */
function cnspkProcessEmailRetries() {
  var props = PropertiesService.getScriptProperties();

  // One-off triggers accumulate against the project trigger limit; clear ours
  // (including the one currently running) before scheduling the next pass.
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === 'cnspkProcessEmailRetries') ScriptApp.deleteTrigger(t);
    });
  } catch (e) {
    Logger.log('CNSPK: retry trigger cleanup failed: ' + e);
  }

  var queue = cnspkReadRetryQueue_(props);
  if (!queue.length) return;

  var ss = null;
  try {
    ss = SpreadsheetApp.openById(props.getProperty(CNSPK.PROP_SS_ID));
  } catch (e) {
    Logger.log('CNSPK: registry unreachable during retry pass: ' + e);
  }

  var now = Date.now();
  var remaining = [];

  queue.forEach(function (item) {
    if (cnspkMailAlreadySent_(props, item.memberNo)) return;         // never double-send

    if (now < (item.nextAttemptAt || 0)) {                            // honour ≥30s spacing
      remaining.push(item);
      return;
    }

    var windowExpired = (now - (item.firstAttemptAt || now)) > CNSPK.RETRY_WINDOW_MS;
    if (windowExpired) {
      cnspkRecordFailureOrEscalate_(ss, {
        kind: 'welcome-email-failed',
        memberNo: item.memberNo,
        address: item.email,
        reason: 'send-failed: 5-minute retry window expired after ' + item.attempts + ' attempt(s)',
        detail: item.lastError || ''
      });
      return;                                                        // number retained, entry recorded
    }

    var attempt = cnspkSendWelcomeOnce_({
      memberNo: item.memberNo,
      email: item.email,
      name: item.name,
      isFeatured: item.isFeatured
    });
    item.attempts = (item.attempts || 0) + 1;
    item.nextAttemptAt = Date.now() + CNSPK.RETRY_SPACING_MS;

    if (attempt.ok) {
      cnspkMarkMailSent_(props, item.memberNo);
      return;
    }
    item.lastError = attempt.error;

    if (item.attempts >= CNSPK.MAX_SEND_ATTEMPTS) {
      cnspkRecordFailureOrEscalate_(ss, {
        kind: 'welcome-email-failed',
        memberNo: item.memberNo,
        address: item.email,
        reason: 'send-failed after ' + item.attempts + ' attempts spaced >=30s within 5 minutes',
        detail: item.lastError || ''
      });
      return;                                                        // number retained
    }
    remaining.push(item);
  });

  cnspkWriteRetryQueue_(props, remaining);
  if (remaining.length) cnspkScheduleRetryPass_();
}

/* ==========================================================================
 * 4. PRIVACY SPLIT  (Requirements 11.1–11.7)
 * ==========================================================================
 * Direct mirror of js/lib/privacy-projection.js (toPublicRow, csvPublishGuard).
 * The pure module is property-tested in Node; this port must agree with it.
 * Rule of the house: when consent or cleanliness cannot be CONFIRMED, the
 * member stays private and the failure is recorded.
 * ========================================================================== */

/** Source keys per safe column, in priority order (mirrors SAFE_COLUMN_SOURCES). */
var CNSPK_SAFE_COLUMN_SOURCES = {
  'Membership No': ['membershipNo', 'Membership No', 'memberNo', 'membershipNumber'],
  'Name': ['name', 'Name'],
  'Role': ['role', 'Role'],
  'City': ['city', 'City'],
  'Interests': ['interests', 'Interests'],
  'GitHub': ['github', 'GitHub', 'githubUrl'],
  'LinkedIn': ['linkedin', 'LinkedIn', 'linkedinUrl']
};

/** Keys that signal the feature-me-publicly opt-in. */
var CNSPK_FEATURE_OPT_IN_KEYS =
  ['featurePublicly', 'feature_publicly', 'featureMePublicly', 'featureMe', 'feature'];

/** Normalized keys carrying an email value — never allowed in a public artifact. */
var CNSPK_EMAIL_KEYS = ['email', 'emailaddress', 'mail', 'useremail', 'contactemail'];

/** Normalized keys carrying the share-with-partners consent flag — never public. */
var CNSPK_SHARE_KEYS = [
  'sharewithpartners', 'sharewithpartner', 'sharepartners',
  'partnerconsent', 'partners', 'partnersharing'
];

/** Standard local@domain shape, scanned anywhere inside a string value. */
var CNSPK_EMAIL_VALUE_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

function cnspkNormalizeKey_(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cnspkIncludes_(list, value) {
  for (var i = 0; i < list.length; i += 1) {
    if (list[i] === value) return true;
  }
  return false;
}

/**
 * Inspect an object for PII that must never cross a public egress point.
 * @return {Array<{field: string, kind: string}>} offenders (empty when clean)
 */
function cnspkDetectPii_(obj) {
  var offenders = [];
  if (!obj || typeof obj !== 'object') return offenders;

  Object.keys(obj).forEach(function (key) {
    var value = obj[key];
    var norm = cnspkNormalizeKey_(key);

    // The share-with-partners flag is forbidden by its mere presence.
    if (cnspkIncludes_(CNSPK_SHARE_KEYS, norm)) {
      offenders.push({ field: key, kind: 'share-with-partners' });
      return;
    }
    // An email key counts when it actually carries a value.
    if (cnspkIncludes_(CNSPK_EMAIL_KEYS, norm)) {
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        offenders.push({ field: key, kind: 'email' });
      }
      return;
    }
    // A stray email value leaked into any other field is still PII.
    if (typeof value === 'string' && CNSPK_EMAIL_VALUE_RE.test(value)) {
      offenders.push({ field: key, kind: 'email' });
    }
  });

  return offenders;
}

/** True when any feature-opt-in key is truthy on the submission. */
function cnspkIsFeatureOptIn_(submission) {
  if (!submission || typeof submission !== 'object') return false;
  for (var i = 0; i < CNSPK_FEATURE_OPT_IN_KEYS.length; i += 1) {
    if (submission[CNSPK_FEATURE_OPT_IN_KEYS[i]]) return true;
  }
  return false;
}

/**
 * Build a public directory row — only when the feature-me-publicly opt-in is
 * set. Exactly the safe columns, never email, never the partner flag
 * (Req 11.2, 11.4, 11.5). Mirrors toPublicRow().
 * @return {object|null}
 */
function cnspkToPublicRow_(submission) {
  if (!cnspkIsFeatureOptIn_(submission)) return null;

  var row = {};
  CNSPK.SAFE_COLUMNS.forEach(function (column) {
    var sources = CNSPK_SAFE_COLUMN_SOURCES[column] || [];
    var picked = '';
    for (var i = 0; i < sources.length; i += 1) {
      var v = submission[sources[i]];
      if (v !== undefined && v !== null) { picked = v; break; }
    }
    row[column] = picked;
  });
  return row;
}

/**
 * Guard a candidate Directory_CSV row set: halt the whole publication if ANY
 * row carries an email value or the share-with-partners flag (Req 11.9).
 * Mirrors csvPublishGuard().
 * @return {{ok: boolean, rows: Array|null, violation: object|null}}
 */
function cnspkCsvPublishGuard_(rows) {
  var list = Object.prototype.toString.call(rows) === '[object Array]' ? rows : [];
  for (var i = 0; i < list.length; i += 1) {
    var offenders = cnspkDetectPii_(list[i]);
    if (offenders.length > 0) {
      return {
        ok: false,
        rows: null,
        violation: {
          reason: 'pii-egress-blocked',
          surface: 'directory-csv',
          rowIndex: i,
          offendingFields: offenders
        }
      };
    }
  }
  return { ok: true, rows: list, violation: null };
}

/**
 * Interpret the raw feature-me checkbox value into a CONFIRMED consent state
 * (Req 11.6, 11.7).
 *
 * Only two values are confirmable: the exact opt-in option text (opted in) and
 * an empty cell (not opted in). Anything else — an edited option label, a
 * partially-read cell, an unexpected multi-select value — is UNCONFIRMED, and
 * an unconfirmed consent state never produces a public row.
 * @return {{confirmed: boolean, optedIn: boolean, reason: string}}
 */
function cnspkConfirmFeatureConsent_(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return { confirmed: false, optedIn: false, reason: 'consent-cell-unreadable' };
  }
  var text = String(rawValue).trim();
  if (text === '') return { confirmed: true, optedIn: false, reason: 'no-opt-in' };
  if (text === CNSPK.FEATURE_OPT.trim()) {
    return { confirmed: true, optedIn: true, reason: 'opt-in-confirmed' };
  }
  return {
    confirmed: false,
    optedIn: false,
    reason: 'consent-value-unrecognized: "' + text + '"'
  };
}

/**
 * Write one Public Directory row, but only for a CONFIRMED opt-in and only
 * after verifying the row carries none of the excluded fields (Req 11.4–11.7).
 *
 * The excluded-field check runs BEFORE any write to the public sheet — this is
 * the last gate between the private registry and a published CSV.
 * @return {{written: boolean, halted: boolean, reason: string}}
 */
function cnspkWritePublicRow_(ss, pub, submission, consent, memberNo) {
  // Req 11.7 — consent not confirmable: keep private, halt this row, record it.
  if (!consent.confirmed) {
    cnspkRecordFailureOrEscalate_(ss, {
      kind: 'public-row-halted',
      memberNo: memberNo,
      address: '',
      reason: 'consent-unconfirmed: kept private only',
      detail: consent.reason
    });
    return { written: false, halted: true, reason: 'consent-unconfirmed' };
  }

  // Req 11.5 — no opt-in, no public row. Nothing to record; this is normal.
  var row = cnspkToPublicRow_(submission);
  if (!consent.optedIn || !row) {
    return { written: false, halted: false, reason: 'not-opted-in' };
  }

  // Req 11.6 — verify the row contains none of the excluded fields (email,
  // share-with-partners) before it touches the public sheet.
  var offenders = cnspkDetectPii_(row);
  if (offenders.length > 0) {
    cnspkRecordFailureOrEscalate_(ss, {
      kind: 'public-row-halted',
      memberNo: memberNo,
      address: '',
      reason: 'excluded-field-detected: publication halted for this row',
      detail: JSON.stringify(offenders)
    });
    return { written: false, halted: true, reason: 'excluded-field-detected' };
  }

  if (!pub) {
    cnspkRecordFailureOrEscalate_(ss, {
      kind: 'public-row-halted',
      memberNo: memberNo,
      address: '',
      reason: 'public-directory-sheet-missing',
      detail: CNSPK.PUBLIC_SHEET
    });
    return { written: false, halted: true, reason: 'public-sheet-missing' };
  }

  var values = CNSPK.SAFE_COLUMNS.map(function (c) { return row[c]; });
  try {
    pub.appendRow(values);
  } catch (err) {
    cnspkRecordFailureOrEscalate_(ss, {
      kind: 'public-row-halted',
      memberNo: memberNo,
      address: '',
      reason: 'public-row-write-failed',
      detail: String(err)
    });
    return { written: false, halted: true, reason: 'write-failed' };
  }
  return { written: true, halted: false, reason: 'published' };
}

/* ==========================================================================
 * 5. DIRECTORY_CSV PUBLISH GUARD + IMMEDIATE REFRESH  (Req 11.8, 11.9, 17.2)
 * ==========================================================================
 * What Apps Script CAN do here, honestly:
 *   • Read the Public Directory and run the same guard as the pure mirror.
 *   • On a violation, pull every row out of the public sheet into a private
 *     Quarantine sheet so the published CSV serves headers only — the closest
 *     thing to "halt publication entirely" that is reachable from a script,
 *     because Apps Script has NO API for File > Publish to web (it can neither
 *     publish nor un-publish a sheet). The publish/un-publish click stays
 *     manual, and the guard's job is to make sure the bytes behind that URL
 *     are clean.
 *   • Flush pending writes and bump a revision token the website can append to
 *     the CSV URL as a cache-buster.
 *
 * What it CANNOT do:
 *   • Purge Google's published-CSV cache. Google caches a published sheet for
 *     roughly 5 minutes; the organizer cannot force that edge cache to expire.
 *     Appending the revision token usually changes the cache key and returns
 *     fresh bytes, but this is Google behaviour, not a contract. The only
 *     guaranteed hard stop for an urgent removal is to un-publish the sheet in
 *     File > Share > Publish to web, which is a manual click.
 * ========================================================================== */

/** Read the Public Directory as objects keyed by its header row. */
function cnspkReadPublicRows_(pub) {
  var lastRow = pub.getLastRow();
  var lastCol = pub.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return { headers: [], rows: [] };

  var values = pub.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var r = 1; r < values.length; r += 1) {
    var obj = {};
    var empty = true;
    for (var c = 0; c < headers.length; c += 1) {
      if (!headers[c]) continue;
      obj[headers[c]] = values[r][c];
      if (String(values[r][c]).trim() !== '') empty = false;
    }
    if (!empty) rows.push(obj);
  }
  return { headers: headers, rows: rows };
}

/**
 * Move every data row of the Public Directory into the private Quarantine
 * sheet and clear it, so the published CSV cannot serve the offending data.
 */
function cnspkQuarantinePublicSheet_(ss, pub, rows, violation) {
  var sheets = cnspkEnsureOpsSheets_(ss);
  var stamp = cnspkUtcNow_();
  rows.forEach(function (row) {
    sheets.quarantine.appendRow([stamp, violation.reason, JSON.stringify(row)]);
  });
  var lastRow = pub.getLastRow();
  if (lastRow > 1) pub.deleteRows(2, lastRow - 1);
  SpreadsheetApp.flush();
}

/**
 * Organizer-run publish check for the Directory_CSV (Req 11.8, 11.9).
 * Only the Public Directory is ever the publish source; the Private Registry
 * is never published. Halts (and quarantines) if any row carries an email
 * value or the share-with-partners flag.
 * @return {{ok: boolean, rowCount: number, violation: object|null, note: string}}
 */
function cnspkPublishDirectoryCsv() {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.openById(props.getProperty(CNSPK.PROP_SS_ID));
  var pub = ss.getSheetByName(CNSPK.PUBLIC_SHEET);

  if (!pub) {
    var missing = { reason: 'public-directory-sheet-missing', surface: 'directory-csv' };
    cnspkRecordFailureOrEscalate_(ss, {
      kind: 'csv-publish-halted',
      reason: missing.reason,
      detail: CNSPK.PUBLIC_SHEET
    });
    Logger.log('CNSPK: publish HALTED — ' + missing.reason);
    return { ok: false, rowCount: 0, violation: missing, note: 'nothing published' };
  }

  SpreadsheetApp.flush();
  var read = cnspkReadPublicRows_(pub);

  // Header-level check first: an email or partner-flag COLUMN must never exist
  // in the publish source, even with no data under it. The probe gives every
  // header a placeholder value so a keyed offender is detected by name.
  var headerProbe = {};
  read.headers.forEach(function (h) { if (h) headerProbe[h] = 'present'; });
  var headerOffenders = cnspkDetectPii_(headerProbe);

  var guard = cnspkCsvPublishGuard_(read.rows);

  if (headerOffenders.length > 0 || !guard.ok) {
    var violation = !guard.ok ? guard.violation : {
      reason: 'pii-egress-blocked',
      surface: 'directory-csv',
      rowIndex: -1,
      offendingFields: headerOffenders
    };
    cnspkQuarantinePublicSheet_(ss, pub, read.rows, violation);
    cnspkRecordFailureOrEscalate_(ss, {
      kind: 'csv-publish-halted',
      reason: violation.reason,
      detail: JSON.stringify(violation)
    });
    Logger.log(
      'CNSPK: Directory_CSV publication HALTED — offending data moved to "' +
      CNSPK.QUARANTINE_SHEET + '". ' + JSON.stringify(violation) +
      '\nUn-publish the sheet manually (File > Share > Publish to web) if the ' +
      'bad rows may already have been fetched: Google caches the CSV ~5 minutes.'
    );
    return { ok: false, rowCount: 0, violation: violation, note: 'publication halted' };
  }

  var rev = cnspkBumpDirectoryRevision_(props);
  Logger.log(
    'CNSPK: Directory_CSV guard passed — ' + guard.rows.length + ' public row(s), ' +
    'safe columns only. Revision ' + rev + '.\n' +
    'Publish source must be the "' + CNSPK.PUBLIC_SHEET + '" sheet only; never ' +
    '"Entire document" and never "' + CNSPK.RAW_SHEET_HINT + '".'
  );
  return { ok: true, rowCount: guard.rows.length, violation: null, note: 'revision ' + rev };
}

/** Revision token the site can append to the CSV URL as a cache-buster. */
function cnspkBumpDirectoryRevision_(props) {
  var rev = String(Date.now());
  try { props.setProperty(CNSPK.PROP_DIRECTORY_REV, rev); } catch (e) {}
  return rev;
}

/**
 * Organizer-triggered immediate refresh (Req 17.2).
 *
 * Run this right after deleting a member's row from the Public Directory. It
 * flushes pending writes, re-runs the publish guard over what remains, and
 * bumps the revision token so the site's next fetch uses a new URL query and
 * normally bypasses Google's cached copy.
 *
 * It does NOT rebuild the Public Directory from the Private Registry — that
 * would resurrect the row the organizer just removed.
 *
 * Honest limits: Google's published-CSV cache is ~5 minutes and is not under
 * organizer control. This function makes the refresh immediate on our side
 * (sheet state + revision token); the only guaranteed instant takedown is
 * un-publishing the sheet manually.
 */
function cnspkRefreshDirectoryNow() {
  var result = cnspkPublishDirectoryCsv();
  var props = PropertiesService.getScriptProperties();
  var rev = props.getProperty(CNSPK.PROP_DIRECTORY_REV) || '(none)';
  var message = result.ok
    ? 'CNSPK: directory refreshed. ' + result.rowCount + ' public row(s). ' +
      'Append ?rev=' + rev + ' (or &rev=) to the CSV URL to bypass the cached copy. ' +
      "Google's published-CSV cache is ~5 minutes and cannot be purged from here."
    : 'CNSPK: refresh HALTED — ' + JSON.stringify(result.violation) +
      '. Nothing is being published until this is resolved.';
  Logger.log(message);
  try { SpreadsheetApp.getUi().alert(message); } catch (e) {}
  return { ok: result.ok, revision: rev, rowCount: result.rowCount, message: message };
}

/* ==========================================================================
 * 6. ON-SUBMIT HANDLER  (the Registration_Processor)
 * ==========================================================================
 * Order of operations, and why:
 *   1. assign the number, LockService-serialized, written to the Private
 *      Registry row and verified before the counter advances (Req 9.2–9.7)
 *   2. send exactly one welcome email containing that number (Req 10.x, 16.5)
 *   3. copy safe columns to the Public Directory only for a confirmed opt-in,
 *      after the excluded-field check (Req 11.x)
 * Steps 2 and 3 never roll back the number: a member keeps their number even
 * when the email or the public row fails (Req 10.3, 10.4, 11.7).
 *
 * Apps Script compromise on "return an error indication" (Req 9.6, 9.7): a
 * spreadsheet form-submit trigger has no response channel back to the
 * submitter. The error indication is therefore (a) a failure entry in the
 * private Ops Log, (b) an organizer escalation, and (c) a thrown error so the
 * execution is marked FAILED in the Apps Script Executions view and Google
 * emails the script owner. The row stays un-numbered rather than mis-numbered.
 * ========================================================================== */
function cnspkOnFormSubmit(e) {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.openById(props.getProperty(CNSPK.PROP_SS_ID));
  var raw = ss.getSheetByName(CNSPK.RAW_SHEET_HINT);
  var pub = ss.getSheetByName(CNSPK.PUBLIC_SHEET);

  // Header lookup so we don't depend on fixed column positions.
  var headers = raw.getRange(1, 1, 1, raw.getLastColumn()).getValues()[0];
  var H = {};
  headers.forEach(function (h, i) { H[String(h).trim()] = i; });

  var rowIdx = e && e.range ? e.range.getRow() : raw.getLastRow();
  var row = raw.getRange(rowIdx, 1, 1, raw.getLastColumn()).getValues()[0];
  var get = function (title) { return H[title] != null ? String(row[H[title]] || '').trim() : ''; };
  var rawCell = function (title) { return H[title] != null ? row[H[title]] : null; };

  var name = get('Full Name') || 'member';
  var email = get('Email');                       // PRIVATE — never enters the public projection
  var role = get('Role / Career stage');
  var city = get('City');
  var interests = get('Interests');
  var github = get('GitHub');
  var linkedin = get('LinkedIn');

  // ---- 1. assign the membership number (Req 9.2–9.7) ----
  if (H['Membership No'] == null) {
    cnspkRecordFailureOrEscalate_(ss, {
      kind: 'assignment-failed',
      address: email,
      reason: 'private-registry-missing-membership-no-column',
      detail: 'row ' + rowIdx
    });
    throw new Error('CNSPK: "Membership No" column missing from ' + CNSPK.RAW_SHEET_HINT +
      ' — assignment halted, no number consumed.');
  }
  var numberCell = raw.getRange(rowIdx, H['Membership No'] + 1);

  var assignment = cnspkAssignMembershipNumber_(props, {
    writeNumber: function (value) { numberCell.setValue(value); },
    readBack: function () { return numberCell.getValue(); }
  });

  if (!assignment.ok) {
    cnspkRecordFailureOrEscalate_(ss, {
      kind: 'assignment-failed',
      memberNo: assignment.memberNo || '',
      address: email,
      reason: assignment.error,
      detail: 'private registry row ' + rowIdx + '; last assigned number retained'
    });
    throw new Error('CNSPK: membership number assignment halted (' + assignment.error + ').');
  }
  var memberNo = assignment.memberNo;
  if (assignment.reused) {
    // Re-delivered or manually re-run submission: the row was already numbered,
    // so the counter was not advanced again (Req 9.2). The welcome email is
    // separately guarded by the sent-marker, so no second email goes out.
    Logger.log('CNSPK: registry row ' + rowIdx + ' already carried ' + memberNo +
      ' — reused, no additional number consumed.');
  }

  // ---- consent state (Req 11.6, 11.7) ----
  var consent = cnspkConfirmFeatureConsent_(rawCell('Public directory'));

  // ---- 2. exactly one welcome email (Req 10.1–10.5, 16.5) ----
  // No list subscription, no scheduled follow-up: this is the only member-facing
  // send the registration performs.
  cnspkSendWelcomeEmail_(ss, props, {
    memberNo: memberNo,
    email: email,
    name: name,
    isFeatured: consent.confirmed && consent.optedIn
  });

  // ---- 3. public directory (opt-in only; safe columns only) ----
  // The projection input deliberately carries NO email and NO partner flag.
  var submission = {
    membershipNo: memberNo,
    name: name,
    role: role,
    city: city,
    interests: interests,
    github: github,
    linkedin: linkedin,
    featurePublicly: consent.confirmed && consent.optedIn
  };
  cnspkWritePublicRow_(ss, pub, submission, consent, memberNo);

  return memberNo;
}

function escapeHtml_(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
