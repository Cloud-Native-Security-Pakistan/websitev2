/**
 * Feature: cnspk-website-platform, Property 10: Doorways render exactly for
 * configured channels; join links are canonical.
 *
 * For any channels configuration, the `/join/` page renders a doorway
 * call-to-action if and only if that doorway's external URL is non-empty, and
 * continues to render all remaining doorways with valid URLs in friction order;
 * and for any primary join control across the site, the destination equals the
 * `/join/` canonical URL.
 *
 * Validates: Requirements 14.2, 14.3, 14.7, 18.2
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  CANONICAL_JOIN_PATH,
  CHANNELS,
  DOORWAYS,
  DOORWAY_KEYS,
  filterDoorways,
  isCanonicalJoinHref,
  isDoorwayVisible,
  isRenderableUrl,
  resolveDoorwayUrl,
} from '../../js/lib/channels.js';

/** Every config key a doorway can read from. */
const CONFIG_KEYS = ['whatsapp', 'cncf', 'social', 'github', 'discord', 'linkedin', 'x', 'instagram'];

/**
 * The URL-key fallback chains, restated here independently of the module: the
 * social doorway resolves through `social` -> `linkedin` -> `x` -> `instagram`.
 */
const URL_KEYS = {
  whatsapp: ['whatsapp'],
  cncf: ['cncf'],
  social: ['social', 'linkedin', 'x', 'instagram'],
  github: ['github'],
  discord: ['discord'],
};

/** How a key can appear in a generated config. */
const VALUE_SHAPES = [
  { kind: 'url', value: 'https://example.test/doorway' },
  { kind: 'url', value: '  https://example.test/padded  ' },
  { kind: 'empty', value: '' },
  { kind: 'empty', value: '   ' },
  { kind: 'empty', value: '\t\n' },
  { kind: 'missing', value: undefined },
  { kind: 'empty', value: null },
  { kind: 'empty', value: 42 },
  { kind: 'empty', value: {} },
];

/** A config where each key is independently a real URL, blank, or absent. */
const configArb = fc
  .tuple(
    ...CONFIG_KEYS.map(() => fc.integer({ min: 0, max: VALUE_SHAPES.length - 1 })),
    fc.boolean(),
  )
  .map((picks) => {
    const distinct = picks[picks.length - 1];
    const config = {};
    CONFIG_KEYS.forEach((key, i) => {
      const shape = VALUE_SHAPES[picks[i]];
      if (shape.kind === 'missing') return;
      // Distinct URLs per key so the fallback chain's *choice* is observable.
      config[key] =
        shape.kind === 'url' && distinct ? `https://example.test/${key}` : shape.value;
    });
    return config;
  });

/** Independent expectation of a doorway's resolved URL. */
function expectedUrl(config, key) {
  for (const urlKey of URL_KEYS[key]) {
    const raw = config[urlKey];
    if (typeof raw === 'string' && raw.trim() !== '') return raw.trim();
  }
  return '';
}

/** A canonical join href in one of its accepted spellings. */
const canonicalHrefArb = fc
  .tuple(
    fc.constantFrom('', 'https://cloudnativesecurity.pk', 'http://www.cloudnativesecurity.pk'),
    fc.constantFrom('/join/', '/join'),
    fc.constantFrom('', '?ref=nav', '#doorways', '?utm=x#doorways'),
    fc.constantFrom('', ' '),
  )
  .map(([host, path, suffix, pad]) => `${pad}${host}${path}${suffix}${pad}`);

/** An href that is not the canonical join destination. */
const nonCanonicalHrefArb = fc.constantFrom(
  '/',
  '/joins/',
  '/join-us/',
  '/join/extra/',
  '/members/',
  '/code-of-conduct/',
  'join/',
  'https://cloudnativesecurity.pk/joinx',
  'mailto:hello@cloudnativesecurity.pk',
  '',
  '   ',
);

/**
 * Values that are not a channels config at all. `undefined` is deliberately
 * excluded: `filterDoorways()` treats a missing argument as "use the compiled
 * default config", which is asserted separately below.
 */
const nonObjectConfigArb = fc.constantFrom(null, 42, true, 'not-a-config');

describe('Property 10: doorway rendering follows the config, and join links are canonical', () => {
  it('emits a doorway iff its resolved URL is non-empty, preserves friction order, and accepts only canonical join hrefs', () => {
    fc.assert(
      fc.property(
        configArb,
        canonicalHrefArb,
        nonCanonicalHrefArb,
        nonObjectConfigArb,
        (config, canonicalHref, otherHref, nonObjectConfig) => {
          const doorways = filterDoorways(config);

          // A doorway is emitted iff its resolved URL is non-empty.
          DOORWAY_KEYS.forEach((key) => {
            const url = expectedUrl(config, key);
            expect(resolveDoorwayUrl(config, key)).toBe(url);
            expect(isDoorwayVisible(config, key)).toBe(url !== '');
            const entry = doorways.find((d) => d.key === key);
            if (url === '') {
              expect(entry).toBeUndefined();
            } else {
              expect(entry).toBeDefined();
              expect(entry.url).toBe(url);
              // Every doorway is a live external link, never a disabled state.
              expect(entry.external).toBe(true);
              expect(entry.target).toBe('_blank');
              expect(entry.rel).toBe('noopener noreferrer');
              expect(isRenderableUrl(entry.url)).toBe(true);
            }
          });

          // All remaining valid doorways still render, in friction order.
          const expectedKeys = DOORWAY_KEYS.filter((key) => expectedUrl(config, key) !== '');
          expect(doorways.map((d) => d.key)).toEqual(expectedKeys);
          const orders = doorways.map((d) => d.order);
          expect(orders).toEqual([...orders].sort((a, b) => a - b));
          expect(orders).toEqual(
            expectedKeys.map((key) => DOORWAYS.find((d) => d.key === key).order),
          );

          // A non-object config hides every doorway rather than throwing.
          expect(filterDoorways(nonObjectConfig)).toEqual([]);
          DOORWAY_KEYS.forEach((key) => {
            expect(resolveDoorwayUrl(nonObjectConfig, key)).toBe('');
            expect(isDoorwayVisible(nonObjectConfig, key)).toBe(false);
          });
          // An unknown doorway key never resolves.
          expect(resolveDoorwayUrl(config, 'not-a-doorway')).toBe('');

          // Join controls point at the single canonical destination.
          expect(isCanonicalJoinHref(canonicalHref)).toBe(true);
          expect(isCanonicalJoinHref(otherHref)).toBe(false);
          expect(isCanonicalJoinHref(CANONICAL_JOIN_PATH)).toBe(true);
          [null, undefined, 42, [], {}].forEach((notAnHref) => {
            expect(isCanonicalJoinHref(notAnHref)).toBe(false);
          });

          // The compiled default config renders the full five-doorway set, and
          // a missing argument falls back to exactly that default.
          expect(filterDoorways(CHANNELS).map((d) => d.key)).toEqual([...DOORWAY_KEYS]);
          expect(filterDoorways()).toEqual(filterDoorways(CHANNELS));
          expect(filterDoorways(undefined)).toEqual(filterDoorways(CHANNELS));
        },
      ),
      { numRuns: 300 },
    );
  });
});
