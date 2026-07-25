/**
 * Unit tests for js/lib/map-render.js — city resolution, pin placement, and the
 * approval gate.
 *
 * Covers: both city-data shapes, exactly one pin per resolvable record, no pin
 * (and a recorded city) for empty/unresolvable cities, approval gating, and the
 * deterministic jitter staying inside its bound.
 *
 * Validates: Requirements 12.2, 12.3, 12.4
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  MAX_JITTER_DEGREES,
  buildCityIndex,
  buildPins,
  getRecordCity,
  isApprovedValue,
  isRecordApproved,
  jitterCoord,
  normalizeCityKey,
  resolveCity,
  summarizeUnresolved,
} from '../js/lib/map-render.js';

const readData = (name) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../data/${name}`, import.meta.url)), 'utf8'));

const pakistanCities = readData('pakistan-cities.json');
const cityCoords = readData('city-coords.json');

const LAHORE = { lat: 31.5204, lng: 74.3587 };

describe('normalizeCityKey', () => {
  it('lowercases, collapses whitespace, and strips a trailing country suffix', () => {
    expect(normalizeCityKey('  LAHORE  ')).toBe('lahore');
    expect(normalizeCityKey('Dera   Ghazi Khan')).toBe('dera ghazi khan');
    expect(normalizeCityKey('Karachi, Pakistan')).toBe('karachi');
    expect(normalizeCityKey('Karachi Pakistan')).toBe('karachi');
  });

  it('keeps the literal label "Pakistan" so its fallback entry still resolves', () => {
    expect(normalizeCityKey('Pakistan')).toBe('pakistan');
  });

  it('returns an empty key for empty input', () => {
    for (const value of ['', '   ', null, undefined]) {
      expect(normalizeCityKey(value)).toBe('');
    }
  });
});

describe('buildCityIndex', () => {
  it('indexes the pakistan-cities.json cities + fallbacks shape', () => {
    const index = buildCityIndex(pakistanCities);
    expect(index.lahore).toEqual(LAHORE);
    expect(index.pakistan).toEqual({ lat: 30.3753, lng: 69.3451 });
    expect(index.diaspora).toEqual({ lat: 25.2048, lng: 55.2708 });
    expect(index['dera ghazi khan']).toEqual({ lat: 30.0561, lng: 70.6345 });
  });

  it('indexes the flat city-coords.json shape and ignores `_`-prefixed keys', () => {
    const index = buildCityIndex(cityCoords);
    expect(index.lahore).toEqual(LAHORE);
    expect(index._comment).toBeUndefined();
    expect(Object.keys(index)).toHaveLength(Object.keys(cityCoords).length - 1);
  });

  it('is idempotent, so a built index can be passed back in', () => {
    const index = buildCityIndex(pakistanCities);
    expect(buildCityIndex(index)).toEqual(index);
  });

  it('returns an empty index for unusable data', () => {
    expect(buildCityIndex(null)).toEqual({});
    expect(buildCityIndex('nope')).toEqual({});
  });
});

describe('resolveCity', () => {
  it('resolves a known city from either data shape', () => {
    expect(resolveCity('Lahore', pakistanCities)).toEqual(LAHORE);
    expect(resolveCity('lahore', cityCoords)).toEqual(LAHORE);
  });

  it('resolves a decorated label by its leading segment', () => {
    expect(resolveCity('Lahore, Punjab', pakistanCities)).toEqual(LAHORE);
    expect(resolveCity('Lahore (remote)', pakistanCities)).toEqual(LAHORE);
    expect(resolveCity('Lahore / Islamabad', pakistanCities)).toEqual(LAHORE);
  });

  it('returns null for an empty or unresolvable city rather than guessing', () => {
    for (const city of ['', '   ', null, undefined, 'Atlantis', 'Springfield, IL']) {
      expect(resolveCity(city, pakistanCities)).toBeNull();
    }
  });

  it('resolves only labels present in the data, including its explicit fallbacks', () => {
    expect(resolveCity('Pakistan', pakistanCities)).toEqual({ lat: 30.3753, lng: 69.3451 });
    expect(resolveCity('Other', pakistanCities)).toEqual({ lat: 30.3753, lng: 69.3451 });
  });
});

describe('jitterCoord', () => {
  it('is deterministic and stays inside the jitter bound', () => {
    const a = jitterCoord(LAHORE.lat, 'Ayesha Khan');
    const b = jitterCoord(LAHORE.lat, 'Ayesha Khan');
    expect(a).toBe(b);
    expect(Math.abs(a - LAHORE.lat)).toBeLessThanOrEqual(MAX_JITTER_DEGREES);
  });

  it('separates distinct seeds in the same city', () => {
    expect(jitterCoord(LAHORE.lat, 'Ayesha')).not.toBe(jitterCoord(LAHORE.lat, 'Bilal'));
  });
});

describe('approval values', () => {
  it('accepts the approved spellings', () => {
    for (const value of [true, 'Yes', 'yes', 'TRUE', '1', 'approved', 'Y']) {
      expect(isApprovedValue(value)).toBe(true);
    }
  });

  it('rejects blank, missing, and negative values', () => {
    for (const value of [false, '', '   ', null, undefined, 'no', 'pending', 'rejected', 0]) {
      expect(isApprovedValue(value)).toBe(false);
    }
  });

  it('reads the approval status from any of the known field names', () => {
    expect(isRecordApproved({ Approved: 'Yes' })).toBe(true);
    expect(isRecordApproved({ approvalStatus: 'approved' })).toBe(true);
    expect(isRecordApproved({ approved: '' })).toBe(false);
    expect(isRecordApproved({})).toBe(false);
    expect(isRecordApproved({ ok: 'Yes' }, 'ok')).toBe(true);
  });
});

describe('getRecordCity', () => {
  it('reads the first present city field', () => {
    expect(getRecordCity({ city: 'Lahore' })).toBe('Lahore');
    expect(getRecordCity({ City: 'Karachi' })).toBe('Karachi');
    expect(getRecordCity({ location: 'Quetta' })).toBe('Quetta');
    expect(getRecordCity({ city: '', location: 'Quetta' })).toBe('Quetta');
    expect(getRecordCity({ town: 'Quetta' }, 'town')).toBe('Quetta');
    expect(getRecordCity({})).toBe('');
  });
});

describe('buildPins', () => {
  it('places exactly one pin per resolvable record, at that city', () => {
    const records = [
      { id: 'CNSPK-0001', name: 'Ayesha', city: 'Lahore' },
      { id: 'CNSPK-0002', name: 'Bilal', city: 'Karachi, Pakistan' },
    ];
    const { pins, unresolved, gated } = buildPins(records, pakistanCities);

    expect(pins).toHaveLength(2);
    expect(unresolved).toEqual([]);
    expect(gated).toEqual([]);
    expect(pins.map((p) => p.key)).toEqual(['CNSPK-0001', 'CNSPK-0002']);
    expect(pins[0].base).toEqual(LAHORE);
    expect(Math.abs(pins[0].lat - LAHORE.lat)).toBeLessThanOrEqual(MAX_JITTER_DEGREES);
    expect(Math.abs(pins[0].lng - LAHORE.lng)).toBeLessThanOrEqual(MAX_JITTER_DEGREES);
  });

  it('omits the pin and records the city when it is empty or unresolvable', () => {
    const records = [
      { id: 'a', name: 'Ayesha', city: 'Lahore' },
      { id: 'b', name: 'Bilal', city: '' },
      { id: 'c', name: 'Chand', city: 'Atlantis' },
    ];
    const { pins, unresolved } = buildPins(records, pakistanCities);

    expect(pins.map((p) => p.key)).toEqual(['a']);
    expect(unresolved.map((u) => [u.key, u.city])).toEqual([
      ['b', ''],
      ['c', 'Atlantis'],
    ]);
  });

  it('includes only approved records when approval gating is enabled', () => {
    const records = [
      { id: 'a', name: 'Ayesha', city: 'Lahore', Approved: 'Yes' },
      { id: 'b', name: 'Bilal', city: 'Karachi', Approved: '' },
      { id: 'c', name: 'Chand', city: 'Quetta', Approved: 'pending' },
    ];

    const gatedRun = buildPins(records, pakistanCities, { requireApproval: true });
    expect(gatedRun.pins.map((p) => p.key)).toEqual(['a']);
    expect(gatedRun.gated.map((g) => g.key)).toEqual(['b', 'c']);
    expect(gatedRun.unresolved).toEqual([]);

    const openRun = buildPins(records, pakistanCities);
    expect(openRun.pins.map((p) => p.key)).toEqual(['a', 'b', 'c']);
    expect(openRun.gated).toEqual([]);
  });

  it('keeps coordinates a record already carries, untouched', () => {
    const seed = { id: 's', name: 'Seed', location: 'Lahore', lat: 31.1, lng: 74.2 };
    const [pin] = buildPins([seed], pakistanCities).pins;
    expect(pin.lat).toBe(31.1);
    expect(pin.lng).toBe(74.2);
    expect(pin.base).toEqual({ lat: 31.1, lng: 74.2 });
  });

  it('is stable across loads', () => {
    const records = [{ id: 'a', name: 'Ayesha', city: 'Lahore' }];
    expect(buildPins(records, pakistanCities).pins).toEqual(buildPins(records, pakistanCities).pins);
  });

  it('can place pins without jitter', () => {
    const [pin] = buildPins([{ id: 'a', name: 'Ayesha', city: 'Lahore' }], pakistanCities, {
      jitter: false,
    }).pins;
    expect({ lat: pin.lat, lng: pin.lng }).toEqual(LAHORE);
  });

  it('places nothing when there is no city data', () => {
    const { pins, unresolved } = buildPins([{ id: 'a', name: 'Ayesha', city: 'Lahore' }], null);
    expect(pins).toEqual([]);
    expect(unresolved).toHaveLength(1);
  });

  it('handles empty and malformed input without throwing', () => {
    expect(buildPins([], pakistanCities)).toEqual({ pins: [], unresolved: [], gated: [] });
    expect(buildPins(null, pakistanCities).pins).toEqual([]);
    const { pins, unresolved } = buildPins([null, 'nope'], pakistanCities);
    expect(pins).toEqual([]);
    expect(unresolved).toHaveLength(2);
  });
});

describe('summarizeUnresolved', () => {
  it('dedupes with counts and labels empty cities', () => {
    const { unresolved } = buildPins(
      [
        { id: 'a', name: 'A', city: 'Atlantis' },
        { id: 'b', name: 'B', city: 'Atlantis' },
        { id: 'c', name: 'C', city: '' },
      ],
      pakistanCities
    );
    expect(summarizeUnresolved(unresolved)).toEqual([
      { city: 'Atlantis', count: 2 },
      { city: '(empty)', count: 1 },
    ]);
  });

  it('returns an empty report for no unresolved cities', () => {
    expect(summarizeUnresolved([])).toEqual([]);
    expect(summarizeUnresolved(undefined)).toEqual([]);
  });
});
