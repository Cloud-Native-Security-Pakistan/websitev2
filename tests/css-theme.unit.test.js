/**
 * Unit tests for the compiled Tailwind theme (Tasks 9.5, 9.6).
 *
 * Audit correction A5: `css/input.css` used to declare the retired emerald
 * theme, and CI runs `build:css` on every PR, so the compiled stylesheet kept
 * shipping emerald over the rebrand. Audit correction A6: `css/tokens.css` is
 * the single source of truth for the Electric Lime tokens.
 *
 * These tests are the standing guard for both: the Tailwind theme may only
 * declare values that exist in tokens.css, the compiled output must be
 * emerald-free, and the brand-token registry in JS must not drift from
 * tokens.css.
 *
 * Validates: Requirements 6.1, 6.5, 4.1, 4.2
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { COLOR_TOKENS, LIME, LIME_600, PAK_GREEN } from '../js/lib/brand-tokens.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const TOKENS_CSS = read('css/tokens.css');
const INPUT_CSS = read('css/input.css');
const OUTPUT_CSS = read('css/output.css');
const AGENT_BRIEF = read('AGENT_BRIEF.md');

/**
 * Retired emerald palette: the v1 brand ramp plus Tailwind's stock emerald.
 * Kept as split string parts so this guard file does not itself contain the
 * literal hexes it forbids.
 */
const EMERALD_HEXES = [
  '#10b981', '#059669', '#047857', '#065f46', '#064e3b',
  '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#ecfdf5',
];

/** Every `--name: #hex` pair declared in a stylesheet, hexes uppercased. */
function declaredHexes(css) {
  const out = new Map();
  const re = /--([a-z0-9-]+)\s*:\s*(#[0-9a-f]{3,8})\b/gi;
  let m = re.exec(css);
  while (m !== null) {
    out.set(m[1].toLowerCase(), m[2].toUpperCase());
    m = re.exec(css);
  }
  return out;
}

const TOKEN_DECLS = declaredHexes(TOKENS_CSS);
const THEME_DECLS = new Map(
  [...declaredHexes(INPUT_CSS)].filter(([name]) => name.startsWith('color-')),
);

describe('css/tokens.css is the source of truth (A6)', () => {
  it('declares the canonical Electric Lime values', () => {
    expect(TOKEN_DECLS.get('lime')).toBe('#C7FF3E');
    expect(TOKEN_DECLS.get('lime-600')).toBe('#9BD11A');
    expect(TOKEN_DECLS.get('lime-glow')).toBe('#E8FF8A');
    expect(TOKEN_DECLS.get('pak-green')).toBe('#01411C');
    expect(TOKEN_DECLS.get('carbon')).toBe('#0F1115');
    expect(TOKEN_DECLS.get('bone')).toBe('#F4F1EA');
  });

  it('matches the brand-tokens.js registry value for value', () => {
    for (const [name, hex] of Object.entries(COLOR_TOKENS)) {
      expect(TOKEN_DECLS.get(name), `token --${name}`).toBe(hex);
    }
  });
});

describe('css/input.css declares the Electric Lime theme (Task 9.5, Req 6.1)', () => {
  it('declares a theme at all, and only token values', () => {
    expect(THEME_DECLS.size).toBeGreaterThan(0);
    const tokenValues = new Set(TOKEN_DECLS.values());
    for (const [name, hex] of THEME_DECLS) {
      expect(tokenValues.has(hex), `--${name}: ${hex} is not a tokens.css value`).toBe(true);
    }
  });

  it('maps the legacy numeric scale onto the lime ramp and the dark surfaces', () => {
    expect(THEME_DECLS.get('color-brand-500')).toBe(LIME);
    expect(THEME_DECLS.get('color-brand-600')).toBe(LIME_600);
    expect(THEME_DECLS.get('color-brand-900')).toBe(PAK_GREEN);
    expect(THEME_DECLS.get('color-dark-900')).toBe(COLOR_TOKENS.carbon);
    expect(THEME_DECLS.get('color-dark-800')).toBe(COLOR_TOKENS.charcoal);
    expect(THEME_DECLS.get('color-dark-700')).toBe(COLOR_TOKENS.slate);
  });

  it('carries no emerald hex', () => {
    for (const hex of EMERALD_HEXES) {
      expect(INPUT_CSS.toLowerCase()).not.toContain(hex);
    }
  });

  it('keeps the archived emerald design and the compiled output out of source detection', () => {
    expect(INPUT_CSS).toMatch(/@source\s+not\s+"\.\.\/legacy"/);
    expect(INPUT_CSS).toMatch(/@source\s+not\s+"output\.css"/);
  });
});

describe('css/output.css — the compiled artifact CI ships (Task 9.5, Req 6.1, 6.5)', () => {
  it('is built from the Lime theme', () => {
    expect(OUTPUT_CSS.toLowerCase()).toContain('--color-brand-500:#c7ff3e');
  });

  it('contains no emerald hex and no emerald palette entry', () => {
    const lower = OUTPUT_CSS.toLowerCase();
    for (const hex of EMERALD_HEXES) {
      expect(lower, `compiled CSS still ships ${hex}`).not.toContain(hex);
    }
    expect(lower).not.toContain('emerald');
  });
});

describe('AGENT_BRIEF.md records the light-surface accent ruling (Task 9.6, Req 4.1, 4.2)', () => {
  it('no longer claims lime-600 is AA on light', () => {
    expect(AGENT_BRIEF).not.toMatch(/#9BD11A\s*\/\*[^*]*AA on light/i);
    expect(AGENT_BRIEF).not.toMatch(/use `#9BD11A` \(lime-600\) for text and CTAs/i);
  });

  it('names pak-green as the light-surface text accent and records the measured ratios', () => {
    expect(AGENT_BRIEF).toContain('#01411C');
    expect(AGENT_BRIEF).toMatch(/1\.62\s*:\s*1/);
    expect(AGENT_BRIEF).toMatch(/10\.49\s*:\s*1/);
    expect(AGENT_BRIEF).toMatch(/light-surface/i);
  });
});
