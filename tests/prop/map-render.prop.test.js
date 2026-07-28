/**
 * Feature: cnspk-website-platform, Property 5: Map rendering places a pin
 * exactly when a city resolves, and honors approval gating.
 *
 * For any Public Directory record, the members map places exactly one pin at the
 * mapped coordinates when the record's city resolves to coordinates, and omits
 * the pin while recording the unresolved city when the city is empty or
 * unresolvable; and when approval gating is enabled, for any set of records the
 * map renders exactly those whose approval-status value is approved.
 *
 * Validates: Requirements 12.2, 12.3, 12.4
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import {
  MAX_JITTER_DEGREES,
  buildPins,
  summarizeUnresolved,
} from '../../js/lib/map-render.js';

const readData = (name) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../data/${name}`, import.meta.url)), 'utf8'));

const pakistanCities = readData('pakistan-cities.json');
const cityCoords = readData('city-coords.json');

/**
 * Independently-built expectation index per city-data source.
 *
 * Deliberately narrow: plain-letter labels only (no commas, slashes, parens) and
 * nothing containing "Pakistan", so the expected lookup key is simply the
 * lowercased, whitespace-collapsed label — computed here without calling the
 * module under test.
 */
const PLAIN_LABEL = /^[A-Za-z][A-Za-z ]*$/;

function expectationIndex(entries) {
  const index = new Map();
  for (const [label, coords] of entries) {
    if (typeof label !== 'string') continue;
    const trimmed = label.replace(/\s+/g, ' ').trim();
    if (!PLAIN_LABEL.test(trimmed) || /pakistan/i.test(trimmed)) continue;
    const lat = Number(coords && coords.lat);
    const lng = Number(coords && coords.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    // First entry wins, mirroring how the shared index is populated.
    const key = trimmed.toLowerCase();
    if (!index.has(key)) index.set(key, { lat, lng });
  }
  return index;
}

const SOURCES = [
  {
    name: 'pakistan-cities.json',
    data: pakistanCities,
    index: expectationIndex([
      ...pakistanCities.cities.map((c) => [c.name, c]),
      ...Object.entries(pakistanCities.fallbacks || {}),
    ]),
  },
  {
    name: 'city-coords.json',
    data: cityCoords,
    index: expectationIndex(
      Object.entries(cityCoords).filter(([key]) => !key.startsWith('_')),
    ),
  },
];

/** Cosmetic spellings of the same label — resolution must be case/space blind. */
const SPELLINGS = [
  (label) => label,
  (label) => label.toUpperCase(),
  (label) => `  ${label}  `,
  (label) => label.replace(/ /g, '  '),
];

/** Values `isApprovedValue` accepts, and values it must reject. */
const APPROVED_VALUES = [true, 'Yes', 'yes', 'TRUE', 'true', '1', 'Approved', 'approved'];
const UNAPPROVED_VALUES = [false, 'No', 'no', 'pending', 'rejected', 'later', '', null];

/** A city that cannot resolve: the `zzz-` prefix appears in neither data file. */
const unresolvableSpec = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
    minLength: 1,
    maxLength: 12,
  })
  .map((s) => ({ kind: 'unresolvable', city: `zzz-${s}` }));

/** No city at all. */
const emptySpec = fc
  .constantFrom('', '   ', '\t', null, undefined)
  .map((city) => ({ kind: 'empty', city }));

/** A record spec drawn against one source's real city labels. */
function recordSpecFor(source) {
  const resolvableSpec = fc
    .tuple(
      fc.constantFrom(...source.index.keys()),
      fc.integer({ min: 0, max: SPELLINGS.length - 1 }),
    )
    .map(([key, s]) => ({ kind: 'resolvable', key, city: SPELLINGS[s](key) }));

  return fc
    .tuple(
      fc.oneof(resolvableSpec, unresolvableSpec, emptySpec),
      fc.boolean(),
      fc.integer({ min: 0, max: 999 }),
    )
    .map(([citySpec, approved, pick]) => ({
      ...citySpec,
      approved,
      approvalValue: approved
        ? APPROVED_VALUES[pick % APPROVED_VALUES.length]
        : UNAPPROVED_VALUES[pick % UNAPPROVED_VALUES.length],
    }));
}

/** A full scenario: one city-data source, a record set, and the two flags. */
const scenarioArb = fc.constantFrom(...SOURCES).chain((source) =>
  fc.record({
    source: fc.constant(source),
    specs: fc.array(recordSpecFor(source), { maxLength: 12 }),
    requireApproval: fc.boolean(),
    jitter: fc.boolean(),
  }),
);

describe('Property 5: pin placement follows city resolution and approval gating', () => {
  it('places exactly one pin per resolvable record, records unresolved cities, and gates on approval', () => {
    // Sanity: the generators draw from real data, not an empty pool.
    SOURCES.forEach((source) => expect(source.index.size).toBeGreaterThan(20));

    fc.assert(
      fc.property(scenarioArb, ({ source, specs, requireApproval, jitter }) => {
        // Records carry no coordinates of their own, so placement can only come
        // from the city label.
        const records = specs.map((spec, i) => ({
          id: `r${i}`,
          name: `Member ${i}`,
          city: spec.city,
          approved: spec.approvalValue,
        }));

        const { pins, unresolved, gated } = buildPins(records, source.data, {
          requireApproval,
          approvalField: 'approved',
          cityField: 'city',
          jitter,
        });

        // Independently computed expectation.
        const gate = (spec) => !requireApproval || spec.approved;
        const resolves = (spec) => spec.kind === 'resolvable' && source.index.has(spec.key);

        const pinnedIndexes = specs
          .map((s, i) => (gate(s) && resolves(s) ? i : -1))
          .filter((i) => i >= 0);
        const unresolvedIndexes = specs
          .map((s, i) => (gate(s) && !resolves(s) ? i : -1))
          .filter((i) => i >= 0);
        const gatedIndexes = specs.map((s, i) => (gate(s) ? -1 : i)).filter((i) => i >= 0);

        // Nothing is lost: every record lands in exactly one bucket.
        expect(pins.length + unresolved.length + gated.length).toBe(records.length);

        // Exactly one pin per resolvable record, in source order, at the mapped
        // coordinates. `base` holds the exact resolved location.
        expect(pins.map((p) => p.key)).toEqual(pinnedIndexes.map((i) => `r${i}`));
        pins.forEach((pin, p) => {
          const spec = specs[pinnedIndexes[p]];
          expect(pin.base).toEqual(source.index.get(spec.key));
          // Jitter never moves a pin out of its city.
          expect(Math.abs(pin.lat - pin.base.lat)).toBeLessThanOrEqual(MAX_JITTER_DEGREES);
          expect(Math.abs(pin.lng - pin.base.lng)).toBeLessThanOrEqual(MAX_JITTER_DEGREES);
          if (!jitter) {
            expect(pin.lat).toBe(pin.base.lat);
            expect(pin.lng).toBe(pin.base.lng);
          }
        });

        // Omitted pins carry no coordinates and record their city for follow-up.
        expect(unresolved.map((u) => u.index)).toEqual(unresolvedIndexes);
        unresolved.forEach((entry, u) => {
          const spec = specs[unresolvedIndexes[u]];
          expect(entry.city).toBe(spec.city == null ? '' : String(spec.city));
          expect(entry.lat).toBeUndefined();
          expect(entry.lng).toBeUndefined();
        });
        expect(summarizeUnresolved(unresolved).reduce((sum, row) => sum + row.count, 0)).toBe(
          unresolved.length,
        );

        // Approval gating renders exactly the approved records.
        expect(gated.map((g) => g.index)).toEqual(gatedIndexes);
        if (!requireApproval) expect(gated).toHaveLength(0);
      }),
      { numRuns: 300 },
    );
  });
});
