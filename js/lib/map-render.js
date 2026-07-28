/**
 * map-render — resolves member cities to coordinates and decides pin placement,
 * including approval gating.
 *
 * Pure ES module: importable in both the browser and Node. This is the single
 * shared resolution implementation — `js/members-source.js` and `js/Map.js`
 * consume it instead of carrying their own geocoder.
 *
 * Rules enforced (Property 5):
 *   - A record whose city resolves to coordinates gets **exactly one** pin at
 *     that city's location (Requirement 12.2).
 *   - A record with an empty or unresolvable city gets **no** pin, and its city
 *     is recorded for follow-up — never an incorrect pin at a fallback centroid
 *     (Requirement 12.3).
 *   - When approval gating is enabled, only records whose approval-status value
 *     is approved are included at all (Requirement 12.4).
 *
 * Coordinates carry a small deterministic jitter (derived from a stable per-record
 * seed) so co-located members do not stack on a single pin, while staying at the
 * same place across loads. `pin.base` always holds the exact resolved city
 * coordinates.
 *
 * Validates: Requirements 12.2, 12.3, 12.4
 */

import { sanitizeHTML, sanitizeAttribute } from './sanitize.js';

/** Maximum absolute jitter applied to a resolved coordinate, in degrees. */
export const MAX_JITTER_DEGREES = 0.03;

/** Record fields consulted for a city label, in priority order. */
export const CITY_FIELDS = Object.freeze(['city', 'City', 'location', 'Location']);

/** Record fields consulted for an approval status, in priority order. */
export const APPROVAL_FIELDS = Object.freeze([
  'approved',
  'Approved',
  'approvalStatus',
  'approval_status',
  'Approval Status',
  'approval',
]);

/** Values that count as "approved". */
const APPROVED_PATTERN = /^(yes|true|1|approved|y|agree|agreed|consent)/i;

/** Built city indexes, keyed by the source data object so the work happens once. */
const indexCache = new WeakMap();

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/** A usable coordinate pair, or null. */
function asCoords(value) {
  if (!value || typeof value !== 'object') return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Normalize a city label into the lookup key form: lowercased, whitespace
 * collapsed, and a trailing `, Pakistan` country suffix stripped (only when a
 * city name remains, so the literal label "Pakistan" still resolves).
 *
 * @param {unknown} rawCity
 * @returns {string} The lookup key, or '' when there is no usable label.
 */
export function normalizeCityKey(rawCity) {
  if (rawCity == null) return '';
  const collapsed = String(rawCity).replace(/\s+/g, ' ').trim().toLowerCase();
  if (collapsed === '') return '';

  const withoutCountry = collapsed.replace(/,?\s*pakistan$/, '').trim();
  return withoutCountry === '' ? collapsed : withoutCountry;
}

/**
 * Build a flat `normalized city name -> { lat, lng }` index from either supported
 * data shape:
 *   - `data/pakistan-cities.json`: `{ cities: [{ name, lat, lng }], fallbacks: {} }`
 *   - `data/city-coords.json`: a flat `{ "lahore": { lat, lng } }` map
 * Keys beginning with `_` are JSON-only annotations and are ignored. Re-indexing
 * an already-built index is a no-op, so callers can pass either.
 *
 * @param {object|Array} cityData
 * @returns {Record<string, { lat: number, lng: number }>}
 */
export function buildCityIndex(cityData) {
  if (!cityData || typeof cityData !== 'object') return {};

  const cached = indexCache.get(cityData);
  if (cached) return cached;

  const index = {};
  const add = (name, coords) => {
    const key = normalizeCityKey(name);
    const value = asCoords(coords);
    if (key === '' || !value) return;
    if (!(key in index)) index[key] = value;
  };

  if (Array.isArray(cityData)) {
    cityData.forEach((c) => c && add(c.name, c));
  } else if (Array.isArray(cityData.cities)) {
    cityData.cities.forEach((c) => c && add(c.name, c));
    Object.entries(cityData.fallbacks || {}).forEach(([k, v]) => add(k, v));
  } else {
    Object.entries(cityData).forEach(([k, v]) => {
      if (k.startsWith('_')) return;
      add(k, v);
    });
  }

  indexCache.set(cityData, index);
  return index;
}

/**
 * Resolve a city label to coordinates. Returns null when the label is empty or
 * cannot be matched — callers must omit the pin rather than guess a location.
 *
 * Matching is exact on the normalized label, then on the leading segment before
 * a comma, slash, or parenthesis (so "Lahore, Punjab" and "Swat (Mingora)"
 * resolve). There is deliberately **no** national-centroid fallback: only labels
 * present in the data (including its explicit `pakistan` / `other` /
 * `diaspora` fallback keys) resolve.
 *
 * @param {unknown} city
 * @param {object|Array} cityData - Either supported data shape, or a built index.
 * @returns {{ lat: number, lng: number } | null}
 */
export function resolveCity(city, cityData) {
  const index = buildCityIndex(cityData);
  const key = normalizeCityKey(city);
  if (key === '') return null;

  if (index[key]) return { ...index[key] };

  const head = normalizeCityKey(key.split(/[,/(]/)[0]);
  if (head !== '' && index[head]) return { ...index[head] };

  return null;
}

/**
 * Deterministic sub-degree offset so members in the same city do not stack on a
 * single pin. Same seed in, same offset out, on every load.
 *
 * @param {number} value - The resolved coordinate.
 * @param {string} seed - A stable per-record seed (name, username, or id).
 * @returns {number}
 */
export function jitterCoord(value, seed) {
  if (!isFiniteNumber(value)) return value;
  const s = seed == null ? '' : String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000;
  return value + (h / 1000 - 0.5) * (MAX_JITTER_DEGREES * 2);
}

/**
 * Whether an approval-status value counts as approved.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isApprovedValue(value) {
  if (value === true) return true;
  if (value === false || value == null) return false;
  return APPROVED_PATTERN.test(String(value).trim());
}

/** First present value among the candidate fields. */
function pickField(record, fields, explicit) {
  if (explicit) return record[explicit];
  for (const field of fields) {
    if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
      return record[field];
    }
  }
  return undefined;
}

/**
 * The city label a record will be placed by.
 * @param {object} record
 * @param {string} [cityField] - Explicit field name, when the caller knows it.
 * @returns {string}
 */
export function getRecordCity(record, cityField) {
  if (!record || typeof record !== 'object') return '';
  const value = pickField(record, CITY_FIELDS, cityField);
  return value == null ? '' : String(value);
}

/**
 * Whether a record passes approval gating.
 * @param {object} record
 * @param {string} [approvalField]
 * @returns {boolean}
 */
export function isRecordApproved(record, approvalField) {
  if (!record || typeof record !== 'object') return false;
  return isApprovedValue(pickField(record, APPROVAL_FIELDS, approvalField));
}

/** A stable identity for a record, used as the pin key. */
function recordKey(record, index) {
  const candidates = [record.id, record.memberNo, record.username, record.name];
  for (const c of candidates) {
    if (c != null && String(c).trim() !== '') return String(c);
  }
  return `record-${index}`;
}

/** A stable jitter seed: prefer the display name so pins match earlier loads. */
function recordSeed(record, index) {
  const candidates = [record.name, record.username, record.memberNo, record.id];
  for (const c of candidates) {
    if (c != null && String(c).trim() !== '') return String(c);
  }
  return `record-${index}`;
}

/** Coordinates a record already carries, when both are finite numbers. */
function existingCoords(record) {
  const lat = record.lat;
  const lng = record.lng;
  return isFiniteNumber(lat) && isFiniteNumber(lng) ? { lat, lng } : null;
}

/**
 * Decide which records get a pin.
 *
 * Exactly one pin is emitted per record whose location resolves — either from
 * coordinates the record already carries, or by resolving its city label against
 * `cityData`. A record with an empty or unresolvable city yields no pin and is
 * recorded in `unresolved`. With `requireApproval`, records that are not approved
 * are excluded up front and reported in `gated`.
 *
 * @param {object[]} records
 * @param {object|Array} [cityData] - City data or a built index.
 * @param {object} [options]
 * @param {boolean} [options.requireApproval=false] - Approval gating (Req 12.4).
 * @param {string} [options.approvalField] - Explicit approval-status field name.
 * @param {string} [options.cityField] - Explicit city field name.
 * @param {boolean} [options.jitter=true] - Apply the deterministic offset.
 * @returns {{
 *   pins: Array<{ key: string, city: string, lat: number, lng: number,
 *                 base: { lat: number, lng: number }, record: object }>,
 *   unresolved: Array<{ index: number, key: string, city: string, record: object }>,
 *   gated: Array<{ index: number, key: string, city: string, record: object }>
 * }}
 */
export function buildPins(records, cityData, options = {}) {
  const {
    requireApproval = false,
    approvalField,
    cityField,
    jitter = true,
  } = options || {};

  const index = buildCityIndex(cityData);
  const list = Array.isArray(records) ? records : [];

  const pins = [];
  const unresolved = [];
  const gated = [];

  list.forEach((record, i) => {
    if (!record || typeof record !== 'object') {
      unresolved.push({ index: i, key: `record-${i}`, city: '', record });
      return;
    }

    const key = recordKey(record, i);
    const city = getRecordCity(record, cityField);

    if (requireApproval && !isRecordApproved(record, approvalField)) {
      gated.push({ index: i, key, city, record });
      return;
    }

    const carried = existingCoords(record);
    const base = carried || resolveCity(city, index);
    if (!base) {
      unresolved.push({ index: i, key, city, record });
      return;
    }

    // Records that already carry coordinates are placed exactly where they are;
    // only city-resolved coordinates get the deterministic spread.
    const seed = recordSeed(record, i);
    const placed = jitter && !carried
      ? { lat: jitterCoord(base.lat, seed), lng: jitterCoord(base.lng, seed) }
      : { lat: base.lat, lng: base.lng };

    pins.push({ key, city, lat: placed.lat, lng: placed.lng, base, record });
  });

  return { pins, unresolved, gated };
}

/**
 * Collapse an `unresolved` list into a deduped `city label -> count` report an
 * organizer can act on. Empty labels are grouped under `(empty)`.
 *
 * @param {Array<{ city: string }>} unresolved
 * @returns {Array<{ city: string, count: number }>}
 */
export function summarizeUnresolved(unresolved) {
  const counts = new Map();
  for (const entry of unresolved || []) {
    const label = entry && entry.city != null && String(entry.city).trim() !== ''
      ? String(entry.city).trim()
      : '(empty)';
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
}
/* ------------------------------------------------------------------------- *
 * Accessible directory equivalent + honest degradation states.
 *
 * A Leaflet map is not reachable by assistive technology, so the members page
 * must also carry a **non-map textual equivalent** of the same directory
 * (Requirement 4.6). It is built from the same `buildPins` decision as the pins
 * themselves, so the two can never disagree: a member with a pin is listed as
 * mapped, a member whose city did not resolve is still listed but marked as not
 * mapped, and an approval-gated member appears in neither.
 *
 * The state helper turns a load outcome into one honest message. When the
 * Directory_CSV cannot be retrieved or parsed, the map shows no live pins and
 * this reports the degradation — never a fabricated success and never a guessed
 * pin (Requirement 12.6).
 *
 * Validates: Requirements 4.6, 12.6
 * ------------------------------------------------------------------------- */

/** Columns of the textual directory, in render order. */
export const DIRECTORY_COLUMNS = Object.freeze([
  'Membership No',
  'Name',
  'Role',
  'City',
  'Interests',
  'On map',
]);

/** Label used for a member who is listed but has no pin. */
export const NOT_MAPPED_LABEL = 'Not on map — city not recognised';

/** Label used for a member who has a pin. */
export const MAPPED_LABEL = 'On map';

/** Honest copy for each load outcome. One message per state, no fabrication. */
export const DIRECTORY_STATE_MESSAGES = Object.freeze({
  ok: 'Showing the published member directory.',
  degraded:
    'The live member directory could not be loaded, so only the members bundled with the site are shown. No pins are shown for the members we could not load.',
  empty: 'No members are published in the directory yet.',
  error: 'The member directory could not be loaded, so no members are shown. Please try again later.',
});

const first = (record, fields) => {
  for (const f of fields) {
    const v = record[f];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

/** Normalize an interests value (array or delimited string) to a capped list. */
function toInterests(value) {
  const list = Array.isArray(value)
    ? value
    : String(value == null ? '' : value).split(/[,;/|]/);
  return list.map((s) => String(s).trim()).filter(Boolean).slice(0, 4);
}

/**
 * Build the textual directory rows for a member list.
 *
 * Uses the same placement decision as the map, so `mapped` on a row is exactly
 * "this member has a pin". Approval-gated members are excluded entirely, which
 * keeps the textual equivalent identical in membership to the map (Req 12.4).
 *
 * @param {object[]} records
 * @param {object|Array} [cityData]
 * @param {object} [options] - Same options as buildPins.
 * @returns {Array<{ id: string, memberNo: string, name: string, role: string,
 *                   city: string, interests: string[], mapped: boolean,
 *                   lat: number|null, lng: number|null }>}
 */
export function buildDirectoryEntries(records, cityData, options = {}) {
  const { pins, unresolved } = buildPins(records, cityData, options);

  const toEntry = (record, index, mapped, pin) => {
    const safe = record && typeof record === 'object' ? record : {};
    return {
      id: recordKey(safe, index),
      memberNo: first(safe, ['memberNo', 'Membership No', 'membershipNo', 'id']),
      name: first(safe, ['name', 'Name']) || 'Unnamed member',
      role: first(safe, ['role', 'Role']),
      city: getRecordCity(safe, options.cityField),
      interests: toInterests(safe.interests !== undefined ? safe.interests : safe.Interests),
      mapped,
      lat: mapped && pin ? pin.lat : null,
      lng: mapped && pin ? pin.lng : null,
    };
  };

  const entries = [
    ...pins.map((pin, i) => toEntry(pin.record, i, true, pin)),
    ...unresolved.map((u) => toEntry(u.record, u.index, false, null)),
  ];

  // Mapped first, then alphabetical, so the reading order is predictable.
  return entries.sort(
    (a, b) => Number(b.mapped) - Number(a.mapped) || a.name.localeCompare(b.name)
  );
}

/**
 * Render the accessible, non-map textual equivalent of the member directory as
 * an HTML table string (Requirement 4.6).
 *
 * A table (not a bare list) so screen readers announce each value with its
 * column header. Every value is sanitized on the way in, so a member row
 * carrying markup cannot inject anything (Req 2.4).
 *
 * @param {Array} entries - From buildDirectoryEntries.
 * @param {object} [options]
 * @param {string} [options.caption]
 * @param {string} [options.emptyMessage]
 * @returns {string} HTML for the directory, or an honest empty state.
 */
export function renderDirectoryHTML(entries, options = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const caption =
    options.caption || 'CNSPK member directory — text equivalent of the members map';

  if (list.length === 0) {
    const message = options.emptyMessage || DIRECTORY_STATE_MESSAGES.empty;
    return `<p class="members-directory__empty">${sanitizeHTML(message)}</p>`;
  }

  const head = DIRECTORY_COLUMNS
    .map((c) => `<th scope="col">${sanitizeHTML(c)}</th>`)
    .join('');

  const rows = list
    .map((entry) => {
      const e = entry || {};
      const mapped = e.mapped === true;
      const cells = [
        e.memberNo || '—',
        e.name || 'Unnamed member',
        e.role || '—',
        e.city || '—',
        (Array.isArray(e.interests) ? e.interests : []).join(', ') || '—',
        mapped ? MAPPED_LABEL : NOT_MAPPED_LABEL,
      ].map((v) => sanitizeHTML(v));

      return (
        `<tr data-mapped="${sanitizeAttribute(mapped ? 'yes' : 'no')}">` +
        `<th scope="row">${cells[0]}</th>` +
        cells.slice(1).map((c) => `<td>${c}</td>`).join('') +
        `</tr>`
      );
    })
    .join('');

  return (
    `<table class="members-directory__table">` +
    `<caption>${sanitizeHTML(caption)}</caption>` +
    `<thead><tr>${head}</tr></thead>` +
    `<tbody>${rows}</tbody>` +
    `</table>`
  );
}

/**
 * Turn a load outcome into exactly one honest state.
 *
 * `kind` is one of:
 *   - `error`    — nothing usable loaded (or a failure left nothing to show);
 *                  no pins, an error state is shown.
 *   - `degraded` — the live Directory_CSV failed, so only seed members are shown.
 *   - `empty`    — everything loaded, there is simply nobody to show.
 *   - `ok`       — the published directory is on screen.
 *
 * @param {object} [status]
 * @param {number} [status.memberCount=0] - Members actually available to render.
 * @param {number} [status.pinCount=0] - Pins actually placed.
 * @param {boolean} [status.seedLoaded=false] - Seed data/members.json loaded.
 * @param {boolean} [status.liveConfigured=false] - A Directory_CSV is configured.
 * @param {boolean} [status.liveOk=false] - The Directory_CSV loaded and parsed.
 * @param {string|null} [status.error=null] - Underlying failure reason, if any.
 * @returns {{ kind: 'ok'|'degraded'|'empty'|'error', message: string,
 *             detail: string|null, memberCount: number, pinCount: number }}
 */
export function describeDirectoryState(status = {}) {
  const {
    memberCount = 0,
    pinCount = 0,
    seedLoaded = false,
    liveConfigured = false,
    liveOk = false,
    error = null,
  } = status || {};

  let kind;
  if (!seedLoaded && !liveOk) kind = 'error';
  else if (memberCount === 0 && error) kind = 'error';
  else if (liveConfigured && !liveOk) kind = 'degraded';
  else if (memberCount === 0) kind = 'empty';
  else kind = 'ok';

  return {
    kind,
    message: DIRECTORY_STATE_MESSAGES[kind],
    detail: error ? String(error) : null,
    memberCount,
    pinCount,
  };
}

/**
 * Render a directory state as an inert, honest status block.
 * `ok` renders nothing, so a healthy page carries no noise.
 *
 * @param {{ kind: string, message: string }} state - From describeDirectoryState.
 * @returns {string} HTML, or '' when there is nothing to say.
 */
export function renderDirectoryStateHTML(state) {
  if (!state || state.kind === 'ok') return '';
  const role = state.kind === 'error' ? 'alert' : 'status';
  return (
    `<p class="members-directory__state members-directory__state--${sanitizeAttribute(state.kind)}" ` +
    `role="${role}">${sanitizeHTML(state.message)}</p>`
  );
}
