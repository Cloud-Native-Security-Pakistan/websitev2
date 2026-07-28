/**
 * CNSPK · Members data source
 * ----------------------------------------------------------
 * Single entry point the members page calls to get the full
 * member list = seed members (data/members.json) + live
 * Google-Sheet submissions (geocoded by city).
 *
 * Resilient by design:
 *   - Sheet not configured / unreachable / malformed  → seed members only.
 *   - A live row with no usable city  → dropped (never a broken pin) and its
 *     city recorded for follow-up via getUnresolvedCities().
 *   - Dedupe: a live row matching a seed username/name is skipped.
 *
 * City resolution, the approval gate, and the deterministic pin spread all live
 * in js/lib/map-render.js — this module only shapes rows into records.
 *
 * No third-party libraries. Plain fetch + the shared RFC-4180 CSV parser.
 * ----------------------------------------------------------
 */

import { MEMBERSHIP } from './membership-config.js';
import { parseCSVRows } from './lib/csv.js';
import { buildPins, summarizeUnresolved } from './lib/map-render.js';

/**
 * Cities that could not be resolved to coordinates on the last load, deduped
 * with counts. Those members get no pin (never a guessed one) and land here so
 * an organizer can follow up and extend the city data.
 * @type {Array<{ city: string, count: number }>}
 */
let unresolvedCities = [];

/** Read the unresolved-city report from the last load (Requirement 12.3). */
export function getUnresolvedCities() {
  return unresolvedCities.slice();
}

/** City data loaded on the last call, so the map can resolve cities too. */
let cityDataCache = null;

/** The city data (pakistan-cities.json, or the city-coords.json fallback). */
export function getCityData() {
  return cityDataCache;
}

/**
 * Outcome of the last load, so the page can surface an honest state instead of
 * a silent failure (Requirement 12.6). `liveConfigured && !liveOk` is the
 * degraded case: the Directory_CSV was unreachable or unparseable, the map
 * carries seed pins only, and nothing is guessed for the rows we never saw.
 */
const freshStatus = () => ({
  seedLoaded: false,
  seedCount: 0,
  cityDataLoaded: false,
  liveConfigured: false,
  liveAttempted: false,
  liveOk: false,
  liveCount: 0,
  error: null,
});

let loadStatus = freshStatus();

/** Read the load outcome of the last getAllMembers() call. */
export function getDirectoryStatus() {
  return { ...loadStatus };
}

/**
 * Parse a published CSV into the non-empty rows the loader expects.
 * Delegates the RFC-4180 work (quotes, commas, newlines in fields) to the shared
 * js/lib/csv.js module, then drops blank rows as the inline parser used to.
 */
function parseCSV(text) {
  return parseCSVRows(text).filter(r => r.length && r.some(c => c.trim() !== ''));
}

async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

/** Fetch + map the live Google-Sheet rows into member objects. */
async function loadLiveMembers(cityCoords) {
  const cfg = MEMBERSHIP;
  loadStatus.liveConfigured = Boolean(cfg.enabled && cfg.sheetCsvUrl);
  if (!loadStatus.liveConfigured) return [];

  loadStatus.liveAttempted = true;

  let text;
  try {
    const res = await fetch(cfg.sheetCsvUrl);
    if (!res.ok) throw new Error(`sheet -> ${res.status}`);
    text = await res.text();
  } catch (err) {
    // Honest degradation: the map keeps the seed pins, shows no live pins, and
    // the page surfaces the failure rather than inventing locations (Req 12.6).
    loadStatus.error = `directory CSV unreachable: ${err.message}`;
    console.warn('[members] live sheet unreachable, using seed members only:', err.message);
    return [];
  }

  let rows;
  try {
    rows = parseCSV(text);
  } catch (err) {
    loadStatus.error = `directory CSV unparseable: ${err.message}`;
    console.warn('[members] live sheet could not be parsed, using seed members only:', err.message);
    return [];
  }

  loadStatus.liveOk = true;
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim());
  const col = cfg.sheetColumns;
  const idx = (name) => headers.indexOf(name);

  const iMemberNo = idx(col.membershipNo), iName = idx(col.name), iRole = idx(col.role),
        iCity = idx(col.city), iInterests = idx(col.interests),
        iGithub = idx(col.github), iLinkedin = idx(col.linkedin),
        iApproved = idx('Approved');

  // Map rows to coordinate-less records first; js/lib/map-render.js owns the
  // city resolution, the approval gate, and the unresolved-city bookkeeping.
  const records = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (i) => (i >= 0 && i < row.length ? row[i].trim() : '');

    const name = get(iName);
    if (!name) continue;

    const rawCity = get(iCity);
    const interests = get(iInterests)
      .split(/[,;/|]/).map(s => s.trim()).filter(Boolean).slice(0, 4);

    const memberNo = get(iMemberNo);
    const username = (get(iGithub).split('/').filter(Boolean).pop() || name)
      .toLowerCase().replace(/[^a-z0-9-]/g, '');

    records.push({
      id: memberNo || `live-${r}`,
      memberNo,
      name,
      username,
      city: rawCity,
      location: rawCity || 'Pakistan',
      team: 'member',
      role: get(iRole) || 'Community Member',
      interests,
      github: get(iGithub) || undefined,
      linkedin: get(iLinkedin) || undefined,
      // The public sheet is already opt-in only; honour manual approval if enabled.
      approved: iApproved >= 0 ? get(iApproved) : '',
      _source: 'live'
    });
  }

  const { pins, unresolved } = buildPins(records, cityCoords, {
    requireApproval: cfg.requireApproval,
    approvalField: 'approved',
    cityField: 'city'
  });

  unresolvedCities = summarizeUnresolved(unresolved);
  if (unresolvedCities.length) {
    console.warn('[members] cities without coordinates (no pin placed):',
      unresolvedCities.map(u => `${u.city} x${u.count}`).join(', '));
  }

  const placed = pins
    .slice(0, cfg.maxLiveMembers)
    .map(pin => ({ ...pin.record, lat: pin.lat, lng: pin.lng }));

  loadStatus.liveCount = placed.length;
  return placed;
}

/**
 * The public API the members page calls.
 * Returns the merged, deduped member list.
 */
export async function getAllMembers() {
  let seed = [];
  let cityData = {};
  unresolvedCities = [];
  loadStatus = freshStatus();

  try {
    [seed, cityData] = await Promise.all([
      loadJSON('../data/members.json'),
      loadJSON('../data/pakistan-cities.json').catch(() => loadJSON('../data/city-coords.json'))
    ]);
    loadStatus.seedLoaded = true;
  } catch (err) {
    loadStatus.error = `seed data failed: ${err.message}`;
    console.error('[members] failed to load seed data:', err.message);
    // Last-ditch: try just the seed members
    try {
      seed = await loadJSON('../data/members.json');
      loadStatus.seedLoaded = true;
    } catch {
      seed = [];
    }
  }

  seed = Array.isArray(seed) ? seed : [];
  loadStatus.seedCount = seed.length;

  cityDataCache = cityData && typeof cityData === 'object' ? cityData : null;
  loadStatus.cityDataLoaded = cityDataCache !== null && Object.keys(cityDataCache).length > 0;

  let live = [];
  try {
    live = await loadLiveMembers(cityData);
  } catch (err) {
    loadStatus.error = loadStatus.error || `live load failed: ${err.message}`;
    console.warn('[members] live load failed, seed only:', err.message);
  }

  // Dedupe live rows that match a seed member by username or name.
  const seen = new Set(
    seed.flatMap(m => [m.username, m.name].filter(Boolean).map(s => s.toLowerCase()))
  );
  const dedupedLive = live.filter(m => {
    const u = (m.username || '').toLowerCase();
    const n = (m.name || '').toLowerCase();
    if (seen.has(u) || seen.has(n)) return false;
    seen.add(u); seen.add(n);
    return true;
  });

  return [...seed, ...dedupedLive];
}
