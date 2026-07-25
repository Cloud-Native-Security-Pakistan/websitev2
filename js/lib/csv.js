/**
 * csv — RFC-4180-style CSV serialize/parse for Public Directory safe-column values.
 *
 * Pure ES module: importable in both the browser and Node. This is the single
 * shared CSV implementation — `members-source.js` consumes `parseCSVRows` from
 * here instead of carrying its own inline parser.
 *
 * RFC-4180 rules implemented:
 *   - Fields are comma-separated; records are newline-separated.
 *   - A field is quoted with double quotes when it contains a comma, a double
 *     quote, a carriage return, or a line feed.
 *   - A literal double quote inside a quoted field is escaped by doubling it ("").
 *   - Commas and newlines inside a quoted field are preserved verbatim.
 *   - A bare CR, LF, or CRLF outside quotes terminates a record.
 *
 * Validates: Requirements 12.1, 12.5
 */

/**
 * Escape a single value for CSV output, quoting only when required.
 * @param {*} value
 * @returns {string}
 */
function escapeField(value) {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * Derive a stable column order from a list of records: every key in order of
 * first appearance across the records.
 * @param {object[]} records
 * @returns {string[]}
 */
function deriveColumns(records) {
  const seen = new Set();
  const cols = [];
  for (const rec of records) {
    if (!rec) continue;
    for (const key of Object.keys(rec)) {
      if (!seen.has(key)) { seen.add(key); cols.push(key); }
    }
  }
  return cols;
}

/**
 * Serialize records to RFC-4180-style CSV, correctly quoting values containing
 * commas, double quotes, and newlines. The first line is the header row.
 *
 * No trailing newline is emitted, so that a record whose final field is empty
 * round-trips losslessly (a trailing newline is indistinguishable from an extra
 * empty record).
 *
 * @param {object[]} records
 * @param {string[]} [columns] - Optional explicit column order. Defaults to the
 *   union of keys across all records, in order of first appearance.
 * @returns {string}
 */
export function serializeCSV(records, columns) {
  const recs = Array.isArray(records) ? records : [];
  const cols = columns && columns.length ? columns.slice() : deriveColumns(recs);

  const lines = [];
  lines.push(cols.map(escapeField).join(','));
  for (const rec of recs) {
    lines.push(cols.map((c) => escapeField(rec ? rec[c] : '')).join(','));
  }
  return lines.join('\n');
}

/**
 * Low-level RFC-4180 parser: parse CSV text into an array of raw rows (each row
 * an array of field strings). Field values are preserved verbatim — no trimming.
 *
 * The final record is always flushed (content after the last record terminator,
 * even an empty field, is a record), which is what makes the round-trip with
 * `serializeCSV` lossless. Empty input yields no rows.
 *
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCSVRows(text) {
  const rows = [];
  if (text == null || text === '') return rows;

  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }

    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    if (c === '\r') {
      row.push(field); rows.push(row); row = []; field = '';
      i += text[i + 1] === '\n' ? 2 : 1;
      continue;
    }

    field += c; i++;
  }

  // Flush the trailing field/record (no terminator after the last record).
  row.push(field);
  rows.push(row);
  return rows;
}

/**
 * Parse RFC-4180-style CSV text back into records (objects keyed by the header
 * row). No filtering and no trimming, so the result round-trips with
 * `serializeCSV` field-by-field.
 *
 * @param {string} text
 * @returns {object[]}
 */
export function parseCSV(text) {
  const rows = parseCSVRows(text);
  if (rows.length === 0) return [];

  const headers = rows[0];
  const records = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rec = {};
    for (let c = 0; c < headers.length; c++) {
      rec[headers[c]] = c < row.length ? row[c] : '';
    }
    records.push(rec);
  }
  return records;
}
