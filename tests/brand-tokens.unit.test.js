/**
 * Unit tests for the brand token registry, the lime-surface rule, body-text
 * contrast, and the bare-"CNSP" acronym rule (Task 9.1).
 *
 * Concrete examples: token spellings, lime on dark vs light surfaces, known
 * WCAG contrast pairs, and acronym boundaries ("CNSPK" must never be flagged).
 *
 * Validates: Requirements 4.1, 4.2, 6.1, 6.5, 6.8, 6.9, 6.10
 */
import { describe, it, expect } from 'vitest';
import {
  COLOR_TOKENS,
  LIME,
  LIME_600,
  PAK_GREEN,
  LIGHT_SURFACE_TEXT_ACCENT,
  LIME_USAGE,
  MEASURED_CONTRAST,
  DARK_SURFACES,
  LIGHT_SURFACES,
  BODY_CONTRAST_MIN,
  LARGE_TEXT_CONTRAST_MIN,
  isLimeTextValid,
  isLimeDecorationValid,
  evaluateLimeUsage,
  isLightSurfaceTextAccent,
  textAccentForSurface,
  normalizeColor,
  isBrandToken,
  tokenNameOf,
  classifySurface,
  isLimeSurfaceValid,
  relativeLuminance,
  contrastRatio,
  meetsBodyContrast,
  isAcronymClean,
  findBareAcronym,
} from '../js/lib/brand-tokens.js';

describe('token registry mirrors css/tokens.css (Req 6.1)', () => {
  it('carries the authoritative Electric Lime values', () => {
    expect(LIME).toBe('#C7FF3E');
    expect(LIME_600).toBe('#9BD11A');
    expect(COLOR_TOKENS['lime-glow']).toBe('#E8FF8A');
    expect(COLOR_TOKENS.carbon).toBe('#0F1115');
    expect(COLOR_TOKENS.charcoal).toBe('#1A1D24');
    expect(COLOR_TOKENS.slate).toBe('#2A2E37');
    expect(COLOR_TOKENS.bone).toBe('#F4F1EA');
    expect(COLOR_TOKENS['pak-green']).toBe('#01411C');
    expect(COLOR_TOKENS.gold).toBe('#C9A227');
  });

  it('classifies carbon/charcoal/slate as dark and bone/bone-2 as light', () => {
    expect(DARK_SURFACES).toEqual(['#0F1115', '#1A1D24', '#2A2E37']);
    expect(LIGHT_SURFACES).toEqual(['#F4F1EA', '#E8E3D6']);
    for (const hex of DARK_SURFACES) expect(classifySurface(hex)).toBe('dark');
    for (const hex of LIGHT_SURFACES) expect(classifySurface(hex)).toBe('light');
    expect(classifySurface('not-a-color')).toBe('unknown');
  });
});

describe('isBrandToken — token membership (Req 6.1)', () => {
  it('accepts every spelling of a token', () => {
    expect(isBrandToken('#C7FF3E')).toBe(true);
    expect(isBrandToken('#c7ff3e')).toBe(true);
    expect(isBrandToken('  #C7FF3E  ')).toBe(true);
    expect(isBrandToken('var(--lime)')).toBe(true);
    expect(isBrandToken('--lime-600')).toBe(true);
    expect(isBrandToken('bone-2')).toBe(true);
    expect(isBrandToken('rgb(199, 255, 62)')).toBe(true);
    // Alpha overlay of a token is still that token's color.
    expect(isBrandToken('rgba(199, 255, 62, 0.10)')).toBe(true);
    expect(isBrandToken('rgba(15, 17, 21, 0.85)')).toBe(true);
  });

  it('rejects off-token colors and non-colors', () => {
    expect(isBrandToken('#FF00FF')).toBe(false);
    expect(isBrandToken('#000000')).toBe(false);
    expect(isBrandToken('#FFFFFF')).toBe(false);
    expect(isBrandToken('rebeccapurple')).toBe(false);
    expect(isBrandToken('var(--not-a-token)')).toBe(false);
    expect(isBrandToken('')).toBe(false);
    expect(isBrandToken(null)).toBe(false);
    expect(isBrandToken(undefined)).toBe(false);
  });

  it('normalizes and names tokens', () => {
    expect(normalizeColor('#c7f')).toBe('#CC77FF');
    expect(normalizeColor('#C7FF3E80')).toBe('#C7FF3E');
    expect(tokenNameOf('var(--charcoal)')).toBe('charcoal');
    expect(tokenNameOf('#FF00FF')).toBeNull();
  });
});

describe('isLimeSurfaceValid — the lime-surface rule (Req 4.2, 6.5, 6.9)', () => {
  it('allows #C7FF3E on every dark surface', () => {
    for (const surface of DARK_SURFACES) {
      expect(isLimeSurfaceValid(LIME, surface)).toBe(true);
    }
  });

  it('forbids #C7FF3E on light surfaces', () => {
    for (const surface of LIGHT_SURFACES) {
      expect(isLimeSurfaceValid(LIME, surface)).toBe(false);
    }
    expect(isLimeSurfaceValid('var(--lime)', 'var(--bone)')).toBe(false);
    expect(isLimeSurfaceValid(COLOR_TOKENS['lime-glow'], COLOR_TOKENS.bone)).toBe(false);
  });

  // Task 9.6 ruling: this assertion used to expect `true` for #9BD11A as text
  // on bone. That was the false pass the audit caught — #9BD11A on bone is
  // 1.62:1, so lime text on a light surface must now fail.
  it('rejects the #9BD11A companion as text on light surfaces, keeps it on dark', () => {
    for (const surface of LIGHT_SURFACES) {
      expect(isLimeSurfaceValid(LIME_600, surface)).toBe(false);
    }
    expect(isLimeSurfaceValid(LIME_600, COLOR_TOKENS.charcoal)).toBe(true);
    expect(isLimeSurfaceValid(LIME_600, COLOR_TOKENS.carbon)).toBe(true);
  });

  it('affirms nothing for non-lime foregrounds or unparseable surfaces', () => {
    expect(isLimeSurfaceValid('#FF00FF', COLOR_TOKENS.carbon)).toBe(false);
    expect(isLimeSurfaceValid(COLOR_TOKENS.gold, COLOR_TOKENS.carbon)).toBe(false);
    expect(isLimeSurfaceValid(LIME, 'not-a-color')).toBe(false);
  });
});

describe('contrast — WCAG relative luminance (Req 4.1, 6.10)', () => {
  it('computes known luminance and ratio bounds', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 10);
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 6);
    expect(contrastRatio(COLOR_TOKENS.bone, COLOR_TOKENS.bone)).toBeCloseTo(1, 10);
    // Symmetric in its arguments.
    expect(contrastRatio(COLOR_TOKENS.bone, COLOR_TOKENS.carbon)).toBeCloseTo(
      contrastRatio(COLOR_TOKENS.carbon, COLOR_TOKENS.bone),
      10,
    );
    expect(contrastRatio('#FF00FF', 'not-a-color')).toBeNaN();
  });

  it('passes bone body text on the dark surfaces', () => {
    for (const surface of DARK_SURFACES) {
      expect(meetsBodyContrast(COLOR_TOKENS.bone, surface)).toBe(true);
      expect(contrastRatio(COLOR_TOKENS.bone, surface)).toBeGreaterThanOrEqual(BODY_CONTRAST_MIN);
    }
  });

  it('fails lime body text on bone and steel body text on carbon', () => {
    expect(meetsBodyContrast(LIME, COLOR_TOKENS.bone)).toBe(false);
    expect(meetsBodyContrast(COLOR_TOKENS.steel, COLOR_TOKENS.carbon)).toBe(false);
    expect(meetsBodyContrast('not-a-color', COLOR_TOKENS.carbon)).toBe(false);
  });
});

describe('light-surface text accent — the task 9.6 ruling (Req 4.1, 4.2, 6.5, 6.8)', () => {
  it('names pak-green as the light-surface text accent and passes body contrast on bone', () => {
    expect(LIGHT_SURFACE_TEXT_ACCENT).toBe(PAK_GREEN);
    expect(PAK_GREEN).toBe('#01411C');
    expect(isLightSurfaceTextAccent('var(--pak-green)')).toBe(true);
    expect(isLightSurfaceTextAccent(LIME_600)).toBe(false);

    for (const surface of LIGHT_SURFACES) {
      expect(meetsBodyContrast(LIGHT_SURFACE_TEXT_ACCENT, surface)).toBe(true);
    }
    // AAA territory, not a marginal pass.
    expect(contrastRatio(PAK_GREEN, COLOR_TOKENS.bone)).toBeGreaterThan(7);
    expect(contrastRatio(PAK_GREEN, COLOR_TOKENS.bone)).toBeCloseTo(
      MEASURED_CONTRAST['pak-green-on-bone'], 1,
    );
  });

  it('fails lime-600 as text on bone — the false pass the audit caught', () => {
    expect(isLimeTextValid(LIME_600, COLOR_TOKENS.bone)).toBe(false);
    expect(meetsBodyContrast(LIME_600, COLOR_TOKENS.bone)).toBe(false);
    // It fails even the 3:1 large-text / UI floor, so "AA on light" is wrong.
    expect(contrastRatio(LIME_600, COLOR_TOKENS.bone)).toBeLessThan(LARGE_TEXT_CONTRAST_MIN);
    expect(contrastRatio(LIME_600, COLOR_TOKENS.bone)).toBeCloseTo(
      MEASURED_CONTRAST['lime-600-on-bone'], 1,
    );
    expect(evaluateLimeUsage(LIME_600, COLOR_TOKENS.bone).reason).toContain(
      LIGHT_SURFACE_TEXT_ACCENT,
    );
  });

  it('passes lime as text on carbon', () => {
    expect(isLimeTextValid(LIME, COLOR_TOKENS.carbon)).toBe(true);
    expect(meetsBodyContrast(LIME, COLOR_TOKENS.carbon)).toBe(true);
    expect(contrastRatio(LIME, COLOR_TOKENS.carbon)).toBeCloseTo(
      MEASURED_CONTRAST['lime-on-carbon'], 1,
    );
    expect(textAccentForSurface(COLOR_TOKENS.carbon)).toBe(LIME);
    expect(textAccentForSurface(COLOR_TOKENS.bone)).toBe(LIGHT_SURFACE_TEXT_ACCENT);
    expect(textAccentForSurface('not-a-color')).toBeNull();
  });

  it('keeps lime-as-decoration-on-light expressible and allowed', () => {
    for (const surface of LIGHT_SURFACES) {
      expect(isLimeDecorationValid(LIME, surface)).toBe(true);
      expect(isLimeDecorationValid(LIME_600, surface)).toBe(true);
      expect(isLimeSurfaceValid(LIME_600, surface, LIME_USAGE.DECORATION)).toBe(true);
      // Text and decoration stay distinguishable, not one collapsed boolean.
      expect(isLimeSurfaceValid(LIME_600, surface, LIME_USAGE.TEXT)).toBe(false);
    }
    expect(isLimeDecorationValid(COLOR_TOKENS.gold, COLOR_TOKENS.bone)).toBe(false);
    expect(isLimeSurfaceValid(LIME, COLOR_TOKENS.bone, 'engraving')).toBe(false);

    const verdict = evaluateLimeUsage(LIME, COLOR_TOKENS.bone, LIME_USAGE.DECORATION);
    expect(verdict.allowed).toBe(true);
    expect(verdict.surface).toBe('light');
    expect(verdict.usage).toBe(LIME_USAGE.DECORATION);
  });
});

describe('isAcronymClean — "CNSPK" never bare "CNSP" (Req 6.8)', () => {
  it('passes copy that always uses CNSPK', () => {
    expect(isAcronymClean('CNSPK runs cloud native security meetups.')).toBe(true);
    expect(isAcronymClean('Member CNSPK-0042 joined the CNSPK Lahore chapter.')).toBe(true);
    expect(isAcronymClean('cnspk-shield.png')).toBe(true);
    expect(isAcronymClean('')).toBe(true);
    expect(isAcronymClean(null)).toBe(true);
  });

  it('flags the standalone acronym in any position or casing', () => {
    expect(isAcronymClean('Welcome to CNSP')).toBe(false);
    expect(isAcronymClean('CNSP is the old name.')).toBe(false);
    expect(isAcronymClean('the community (CNSP) meets monthly')).toBe(false);
    expect(isAcronymClean('cnsp')).toBe(false);
    expect(isAcronymClean('CNSP-Lahore')).toBe(false);
  });

  it('reports every occurrence with its index', () => {
    const hits = findBareAcronym('CNSPK and CNSP and CNSP');
    expect(hits).toHaveLength(2);
    expect(hits[0].index).toBe(10);
    expect(hits[1].index).toBe(19);
  });
});
