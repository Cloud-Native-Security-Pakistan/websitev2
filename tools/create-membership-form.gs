/**
 * CNSPK — Membership Registry generator (Google Apps Script)
 * ==========================================================
 * Builds the full CNSPK membership form, a PRIVATE responses
 * sheet, a PUBLIC directory sheet (safe columns only), and an
 * on-submit trigger that:
 *    • assigns each member a membership number (CNSPK-0001…)
 *    • emails them their number + a welcome
 *    • copies ONLY public-safe fields to the public directory
 *      IF they opted into being featured.
 *
 * Privacy model — IMPORTANT:
 *    The raw responses sheet holds email + the partner-sharing
 *    flag and is NEVER published. Only the "Public Directory"
 *    sheet (no email, only opted-in members) is published as CSV
 *    and read by the website map.
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
 * ==========================================================
 */

// ---- Shared constants (keep in sync with MembershipForm.js) ----
var CNSPK = {
  FORM_TITLE: 'CNSPK Membership — Join the Chapter',
  PUBLIC_SHEET: 'Public Directory',
  RAW_SHEET_HINT: 'Form Responses 1',
  MEMBER_PREFIX: 'CNSPK-',
  MEMBER_PAD: 4,                       // CNSPK-0001
  FEATURE_OPT: 'Yes — feature me on the CNSPK website and members map',
  SHARE_OPT: 'Yes — CNSPK may share my details with partner organizations for hiring and internships',
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
  pub.appendRow(['Membership No', 'Name', 'Role', 'City', 'Interests', 'GitHub', 'LinkedIn']);
  pub.setFrozenRows(1);

  // ---------- 5. Persist the item->title map for the trigger ----------
  // The trigger reads e.values by column index; we store the seed counter.
  var props = PropertiesService.getScriptProperties();
  props.setProperty('cnspk_last_no', '0');
  props.setProperty('cnspk_ss_id', ss.getId());

  // ---------- 6. Install the on-submit trigger ----------
  // Remove any old trigger for this handler first (idempotent).
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'cnspkOnФormSubmit' ||
        t.getHandlerFunction() === 'cnspkOnFormSubmit') {
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
  L.push('======================================================================');
  Logger.log(L.join('\n'));

  try {
    SpreadsheetApp.getUi().alert('CNSPK membership form created. Open View > Logs to copy the config block.');
  } catch (e) {}

  return L.join('\n');
}

/**
 * Runs automatically on every form submission (installed by setupCnspkMembership).
 * - assigns the next membership number
 * - writes it back to the raw row
 * - emails the member
 * - if they opted into the public directory, copies safe columns to the
 *   "Public Directory" sheet (NO email, NO partner-share flag)
 */
function cnspkOnFormSubmit(e) {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.openById(props.getProperty('cnspk_ss_id'));
  var raw = ss.getSheetByName(CNSPK.RAW_SHEET_HINT);
  var pub = ss.getSheetByName(CNSPK.PUBLIC_SHEET);

  // Header lookup so we don't depend on fixed column positions.
  var headers = raw.getRange(1, 1, 1, raw.getLastColumn()).getValues()[0];
  var H = {};
  headers.forEach(function (h, i) { H[String(h).trim()] = i; });

  var rowIdx = e.range ? e.range.getRow() : raw.getLastRow();
  var row = raw.getRange(rowIdx, 1, 1, raw.getLastColumn()).getValues()[0];
  var get = function (title) { return H[title] != null ? String(row[H[title]] || '').trim() : ''; };

  // ---- assign membership number ----
  var next = parseInt(props.getProperty('cnspk_last_no') || '0', 10) + 1;
  props.setProperty('cnspk_last_no', String(next));
  var memberNo = CNSPK.MEMBER_PREFIX + ('0000000' + next).slice(-CNSPK.MEMBER_PAD);

  if (H['Membership No'] != null) {
    raw.getRange(rowIdx, H['Membership No'] + 1).setValue(memberNo);
  }

  var name = get('Full Name') || 'member';
  var email = get('Email');
  var role = get('Role / Career stage');
  var city = get('City');
  var interests = get('Interests');
  var github = get('GitHub');
  var linkedin = get('LinkedIn');
  var featuredRaw = get('Public directory');
  var isFeatured = featuredRaw.indexOf('Yes') === 0 || featuredRaw === CNSPK.FEATURE_OPT;

  // ---- email the member their number ----
  if (email) {
    try {
      MailApp.sendEmail({
        to: email,
        subject: 'Welcome to CNSPK — your membership number is ' + memberNo,
        htmlBody:
          '<div style="font-family:Inter,Arial,sans-serif;color:#0F1115;line-height:1.6">' +
          '<p>Salaam ' + escapeHtml_(name.split(' ')[0]) + ',</p>' +
          '<p>You are now a registered member of <strong>Cloud Native Security Pakistan</strong>.</p>' +
          '<p style="font-size:20px"><strong>Membership No: ' +
          '<span style="color:#0a8a45">' + memberNo + '</span></strong></p>' +
          '<p>' + (isFeatured
            ? 'You opted to be featured — your pin will appear on the public members map shortly.'
            : 'You chose to stay a private member. You can ask to be featured any time.') +
          '</p>' +
          '<p>Read the CVE. Drink the chai.<br>— The CNSPK organizers</p>' +
          '<p style="font-family:monospace;color:#6B7280;font-size:12px">kubectl apply -f pakistan.yaml</p>' +
          '</div>'
      });
    } catch (err) {
      Logger.log('Email failed for ' + email + ': ' + err);
    }
  }

  // ---- public directory (opt-in only; safe columns only) ----
  if (isFeatured && pub) {
    pub.appendRow([memberNo, name, role, city, interests, github, linkedin]);
  }
}

function escapeHtml_(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
