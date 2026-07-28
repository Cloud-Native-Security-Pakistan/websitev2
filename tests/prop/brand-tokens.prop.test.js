/**
 * Feature: cnspk-website-platform, Property 8: Color usage stays within tokens
 * and obeys the lime-surface rule, and the acronym is never bare "CNSP".
 *
 * For any color value used in the site's styles or markup, the value is a member
 * of the Brand_System token set; for any element rendering the `#C7FF3E` lime,
 * that element resolves to a dark (carbon/charcoal/slate) surface, and lime used
 * as text on a light surface is rejected in favour of the light-surface text
 * accent (pak-green) — lime on light is permitted only as non-text decoration;
 * all body text meets a contrast ratio of at least 4.5:1 against its background;
 * and for any rendered copy, the standalone acronym "CNSP" does not appear.
 *
 * Validates: Requirements 4.1, 4.2, 6.1, 6.5, 6.8, 6.9, 6.10
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  BODY_CONTRAST_MIN,
  COLOR_TOKENS,
  DARK_SURFACES,
  LIGHT_SURFACES,
  LIGHT_SURFACE_TEXT_ACCENT,
  LIME,
  LIME_600,
  LIME_USAGE,
  contrastRatio,
  findBareAcronym,
  isAcronymClean,
  isBrandToken,
  isLimeSurfaceValid,
  meetsBodyContrast,
  normalizeColor,
} from '../../js/lib/brand-tokens.js';

/** The canonical token hexes — the expectation set for token membership. */
const TOKEN_HEXES = new Set(Object.values(COLOR_TOKENS));
const TOKEN_KEYS = Object.keys(COLOR_TOKENS);

/** The lime family: signature lime, its glow, and the darker companion. */
const LIME_FAMILY = [LIME, COLOR_TOKENS['lime-glow'], LIME_600];

/** Non-lime foregrounds — the lime-surface rule can only be affirmed for lime. */
const NON_LIME = [COLOR_TOKENS.bone, COLOR_TOKENS.gold, LIGHT_SURFACE_TEXT_ACCENT, '#123456'];

const hex2 = (n) => n.toString(16).padStart(2, '0');
const hexOf = (r, g, b) => `#${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase();

/** A channel triple, biased so token colors come up often. */
const channelsArb = fc.oneof(
  fc.constantFrom(...TOKEN_HEXES).map((hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]),
  fc.tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
  ),
);

/**
 * A color value in one of the accepted spellings, paired with the canonical hex
 * it must normalize to — computed here by construction, not by the module.
 */
const spelledColorArb = fc
  .tuple(channelsArb, fc.integer({ min: 0, max: 4 }), fc.integer({ min: 0, max: 255 }))
  .map(([[r, g, b], spelling, alpha]) => {
    const hex = hexOf(r, g, b);
    switch (spelling) {
      case 0:
        return { value: hex, hex };
      case 1:
        return { value: `${hex}${hex2(alpha).toUpperCase()}`, hex };
      case 2:
        return { value: `rgb(${r}, ${g}, ${b})`, hex };
      case 3:
        return { value: `rgba(${r}, ${g}, ${b}, ${(alpha / 255).toFixed(2)})`, hex };
      default:
        return { value: hex.toLowerCase(), hex };
    }
  });

/** A `#RGB` shorthand, with the expansion computed independently. */
const shorthandColorArb = fc
  .tuple(
    fc.constantFrom(...'0123456789abcdef'.split('')),
    fc.constantFrom(...'0123456789abcdef'.split('')),
    fc.constantFrom(...'0123456789abcdef'.split('')),
  )
  .map(([r, g, b]) => ({
    value: `#${r}${g}${b}`,
    hex: `#${r}${r}${g}${g}${b}${b}`.toUpperCase(),
  }));

/** A token referenced by key, `--key`, or `var(--key)`. */
const tokenSpellingArb = fc
  .tuple(fc.constantFrom(...TOKEN_KEYS), fc.integer({ min: 0, max: 3 }))
  .map(([key, spelling]) => {
    const hex = COLOR_TOKENS[key];
    const spellings = [key, key.toUpperCase(), `--${key}`, `var(--${key}, #000000)`];
    return { value: spellings[spelling], hex };
  });

/** A value that is not a color at all — the `zz` prefix is no token key. */
const nonColorArb = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-'.split('')), {
    minLength: 1,
    maxLength: 10,
  })
  .map((s) => `zz${s}`);

/**
 * Copy fragments, each classified by construction: `bare` fragments carry
 * exactly one standalone "CNSP"; `clean` fragments carry none — including the
 * cases that must never be flagged ("CNSPK", "CNSPK-0042", "cnspk-shield.png").
 */
const CLEAN_FRAGMENTS = [
  'CNSPK',
  'CNSPK-0042',
  'cnspk-shield.png',
  'Cloud Native Security Pakistan',
  'join CNSPK today',
  'CNSPKK',
  'ACNSPZ',
  'kubectl apply -f pakistan.yaml',
  '',
];
const BARE_FRAGMENTS = ['CNSP', 'CNSP.', '(CNSP)', 'the CNSP way', 'cnsp', 'CNSP-0042'];

const fragmentArb = fc.oneof(
  fc.constantFrom(...CLEAN_FRAGMENTS).map((text) => ({ text, bare: 0 })),
  fc.constantFrom(...BARE_FRAGMENTS).map((text) => ({ text, bare: 1 })),
);

describe('Property 8: token membership, the lime-surface rule, contrast, and the acronym rule', () => {
  it('accepts exactly token colors, keeps lime text off light surfaces, matches the 4.5:1 body threshold, and flags only a standalone "CNSP"', () => {
    fc.assert(
      fc.property(
        fc.record({
          spelled: spelledColorArb,
          shorthand: shorthandColorArb,
          token: tokenSpellingArb,
          nonColor: nonColorArb,
          lime: fc.constantFrom(...LIME_FAMILY),
          nonLime: fc.constantFrom(...NON_LIME),
          darkSurface: fc.constantFrom(...DARK_SURFACES),
          lightSurface: fc.constantFrom(...LIGHT_SURFACES),
          usage: fc.constantFrom(LIME_USAGE.TEXT, LIME_USAGE.DECORATION),
          foreground: spelledColorArb,
          background: spelledColorArb,
          fragments: fc.array(fragmentArb, { minLength: 1, maxLength: 6 }),
        }),
        (input) => {
          // --- Token membership: true iff the normalized value is a token -----
          for (const candidate of [input.spelled, input.shorthand, input.token]) {
            expect(normalizeColor(candidate.value)).toBe(candidate.hex);
            expect(isBrandToken(candidate.value)).toBe(TOKEN_HEXES.has(candidate.hex));
          }
          expect(normalizeColor(input.nonColor)).toBeNull();
          expect(isBrandToken(input.nonColor)).toBe(false);

          // --- The lime-surface rule -----------------------------------------
          // Lime text belongs on dark surfaces, for either usage.
          expect(isLimeSurfaceValid(input.lime, input.darkSurface, input.usage)).toBe(true);
          expect(isLimeSurfaceValid(input.lime, input.darkSurface)).toBe(true);

          // On a light surface, lime is decoration-only. The whole family fails
          // as text — including the #9BD11A companion, which reaches only
          // 1.62:1 on bone. The light-surface text accent is pak-green.
          expect(isLimeSurfaceValid(input.lime, input.lightSurface, LIME_USAGE.TEXT)).toBe(false);
          expect(isLimeSurfaceValid(input.lime, input.lightSurface)).toBe(false);
          expect(isLimeSurfaceValid(input.lime, input.lightSurface, LIME_USAGE.DECORATION)).toBe(
            true,
          );
          expect(meetsBodyContrast(input.lime, input.lightSurface)).toBe(false);
          expect(meetsBodyContrast(LIGHT_SURFACE_TEXT_ACCENT, input.lightSurface)).toBe(true);
          expect(meetsBodyContrast(COLOR_TOKENS.bone, input.darkSurface)).toBe(true);

          // A non-lime foreground never satisfies the lime rule.
          expect(isLimeSurfaceValid(input.nonLime, input.darkSurface, input.usage)).toBe(false);

          // --- Body contrast: the checker agrees with the measured ratio ------
          const ratio = contrastRatio(input.foreground.value, input.background.value);
          expect(ratio).toBeGreaterThanOrEqual(1);
          expect(ratio).toBeLessThanOrEqual(21);
          expect(ratio).toBeCloseTo(
            contrastRatio(input.background.value, input.foreground.value),
            10,
          );
          expect(meetsBodyContrast(input.foreground.value, input.background.value)).toBe(
            ratio >= BODY_CONTRAST_MIN,
          );

          // --- The acronym rule ----------------------------------------------
          // Fragments are joined with a non-word separator, so no bare acronym
          // can be manufactured across a boundary.
          const copy = input.fragments.map((f) => f.text).join(' | ');
          const expectedBare = input.fragments.reduce((sum, f) => sum + f.bare, 0);
          expect(findBareAcronym(copy)).toHaveLength(expectedBare);
          expect(isAcronymClean(copy)).toBe(expectedBare === 0);

          // "CNSPK" and its derivatives are never the violation.
          const cleanCopy = input.fragments
            .filter((f) => f.bare === 0)
            .map((f) => f.text)
            .join(' | ');
          expect(isAcronymClean(cleanCopy)).toBe(true);
          expect(isAcronymClean('CNSPK-0042 cnspk-shield.png CNSPK')).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });
});
