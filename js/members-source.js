/**
 * CNSPK · Members data source
 * ----------------------------------------------------------
 * Single entry point the members page calls to get the full
 * member list = seed members (data/members.json) + live
 * Google-Sheet submissions (geocoded by city).
 *
 * Resilient by design:
 *   - Sheet not configured / unreachable / malformed  → seed members only.
 *   - A live row with no usable city  → dropped (never a broken pin).
 *   - Dedupe: a live row matching a seed username/name is skipped.
 *
 * No third-party libraries. Plain fetch + a tiny CSV parser.
 * ----------------------------------------------------------
 */

import { MEMBERSHIP } from './membership-config.js';

const truthy = (v) => /^(yes|true|1|approved|y|agree|agreed|consent)/i.test(String(v ?? '').trim());

/** Minimal RFC-4180-ish CSV parser (handles quotes, commas, newlines in fields). */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else { field += c; }
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length && r.some(c => c.trim() !== ''));
}

/** Normalise a city string and look up coordinates. Accepts either the
 *  pakistan-cities.json shape ({cities:[...], fallbacks:{...}}) or the legacy
 *  flat city-coords.json map. Free-typed cities fall back to the national centroid. */
function geocodeCity(rawCity, cityData) {
  // Build a flat lowercase lookup once.
  const map = cityData.__flat || (cityData.__flat = (() => {
    const m = {};
    if (Array.isArray(cityData.cities)) {
      cityData.cities.forEach(c => { if (c && c.name) m[c.name.toLowerCase()] = { lat: c.lat, lng: c.lng }; });
      Object.entries(cityData.fallbacks || {}).forEach(([k, v]) => { m[k.toLowerCase()] = v; });
    } else {
      Object.entries(cityData).forEach(([k, v]) => { if (k[0] !== '_') m[k.toLowerCase()] = v; });
    }
    return m;
  })());

  if (!rawCity) return map['pakistan'];
  const key = String(rawCity).toLowerCase().replace(/,?\s*pakistan\s*$/i, '').trim();
  return map[key]
    || map[key.split(/[,/(]/)[0].trim()]
    || map['other']
    || map['pakistan'];
}

/** Add a tiny deterministic jitter so members in the same city don't stack exactly. */
function jitter(value, seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 1000;
  return value + (h / 1000 - 0.5) * 0.06; // ±~0.03 deg, a few km
}

async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

/** Fetch + map the live Google-Sheet rows into member objects. */
async function loadLiveMembers(cityCoords) {
  const cfg = MEMBERSHIP;
  if (!cfg.enabled || !cfg.sheetCsvUrl) return [];

  let text;
  try {
    const res = await fetch(cfg.sheetCsvUrl);
    if (!res.ok) throw new Error(`sheet -> ${res.status}`);
    text = await res.text();
  } catch (err) {
    console.warn('[members] live sheet unreachable, using seed members only:', err.message);
    return [];
  }

  const rows = parseCSV(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim());
  const col = cfg.sheetColumns;
  const idx = (name) => headers.indexOf(name);

  const iMemberNo = idx(col.membershipNo), iName = idx(col.name), iRole = idx(col.role),
        iCity = idx(col.city), iInterests = idx(col.interests),
        iGithub = idx(col.github), iLinkedin = idx(col.linkedin),
        iApproved = idx('Approved');

  const out = [];
  for (let r = 1; r < rows.length && out.length < cfg.maxLiveMembers; r++) {
    const row = rows[r];
    const get = (i) => (i >= 0 && i < row.length ? row[i].trim() : '');

    const name = get(iName);
    if (!name) continue;

    // The public sheet is already opt-in only, but honour manual approval if enabled.
    if (cfg.requireApproval && (iApproved < 0 || !truthy(get(iApproved)))) continue;

    const rawCity = get(iCity);
    const coords = geocodeCity(rawCity, cityCoords);
    if (!coords) continue;

    const interests = get(iInterests)
      .split(/[,;/|]/).map(s => s.trim()).filter(Boolean).slice(0, 4);

    const memberNo = get(iMemberNo);
    const username = (get(iGithub).split('/').filter(Boolean).pop() || name)
      .toLowerCase().replace(/[^a-z0-9-]/g, '');

    out.push({
      id: memberNo || `live-${r}`,
      memberNo,
      name,
      username,
      location: rawCity || 'Pakistan',
      team: 'member',
      role: get(iRole) || 'Community Member',
      interests,
      github: get(iGithub) || undefined,
      linkedin: get(iLinkedin) || undefined,
      lat: jitter(coords.lat, name),
      lng: jitter(coords.lng, name),
      _source: 'live'
    });
  }
  return out;
}

/**
 * The public API the members page calls.
 * Returns the merged, deduped member list.
 */
export async function getAllMembers() {
  let seed = [];
  let cityData = {};

  try {
    [seed, cityData] = await Promise.all([
      loadJSON('../data/members.json'),
      loadJSON('../data/pakistan-cities.json').catch(() => loadJSON('../data/city-coords.json'))
    ]);
  } catch (err) {
    console.error('[members] failed to load seed data:', err.message);
    // Last-ditch: try just the seed members
    try { seed = await loadJSON('../data/members.json'); } catch { seed = []; }
  }

  let live = [];
  try {
    live = await loadLiveMembers(cityData);
  } catch (err) {
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
