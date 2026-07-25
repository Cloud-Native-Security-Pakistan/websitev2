/**
 * brand-tokens — checkers for the Brand_System token set, the lime-surface rule,
 * body-text contrast, and the bare-"CNSP" acronym rule.
 *
 * Pure ES module: importable in both the browser and Node. Token values are the
 * authoritative Electric Lime set defined in `css/tokens.css` and documented in
 * `AGENT_BRIEF.md`; this module is the single computational mirror of that set,
 * so token drift shows up as a test failure rather than a design review note.
 *
 * Validates: Requirements 4.1, 4.2, 6.1, 6.5, 6.8, 6.9, 6.10
 */

/* ==========================================================
   1. Token registries (mirror of css/tokens.css)
   ========================================================== */

/**
 * The Brand_System color tokens, keyed by their CSS custom-property name
 * without the leading `--`. Values are canonical uppercase `#RRGGBB`.
 * @type {Readonly<Record<string, string>>}
 */
export const COLOR_TOKENS = Object.freeze({
  // Primary lime
  lime: '#C7FF3E',
  'lime-600': '#9BD11A',
  'lime-glow': '#E8FF8A',
  // Heritage accents (ceremonial)
  'pak-green': '#01411C',
  gold: '#C9A227',
  // Surfaces (dark-mode native)
  carbon: '#0F1115',
  charcoal: '#1A1D24',
  slate: '#2A2E37',
  steel: '#6B7280',
  bone: '#F4F1EA',
  'bone-2': '#E8E3D6',
  // Semantic
  watch: '#F59E0B',
  breach: '#F43F5E',
  signal: '#06B6D4',
});

/** The signature lime accent — dark surfaces only (Req 6.5). */
export const LIME = COLOR_TOKENS.lime;

/** The lime companion that carries lime onto light surfaces (Req 4.2, 6.9). */
export const LIME_600 = COLOR_TOKENS['lime-600'];

/** Lime-family tokens that are only legible on dark surfaces. */
const BRIGHT_LIMES = Object.freeze([COLOR_TOKENS.lime, COLOR_TOKENS['lime-glow']]);

/** The dark surface tokens: carbon, charcoal, slate (Req 6.5). */
export const DARK_SURFACE_TOKENS = Object.freeze(['carbon', 'charcoal', 'slate']);

/** The light surface tokens: bone and its subtler companion (Req 6.9). */
export const LIGHT_SURFACE_TOKENS = Object.freeze(['bone', 'bone-2']);

/** Canonical hexes of the dark surfaces. @type {readonly string[]} */
export const DARK_SURFACES = Object.freeze(DARK_SURFACE_TOKENS.map((k) => COLOR_TOKENS[k]));

/** Canonical hexes of the light surfaces. @type {readonly string[]} */
export const LIGHT_SURFACES = Object.freeze(LIGHT_SURFACE_TOKENS.map((k) => COLOR_TOKENS[k]));

/**
 * The Brand_System typography tokens (Req 6.1, 6.6, 6.7). Family stacks are
 * recorded by their primary family so copy checks stay readable.
 * @type {Readonly<Record<string, string>>}
 */
export const FONT_TOKENS = Object.freeze({
  'font-display': 'Bricolage Grotesque',
  'font-body': 'Inter',
  'font-mono': 'JetBrains Mono',
  'font-urdu': 'Noto Nastaliq Urdu',
});

/**
 * The Brand_System motion tokens (Req 6.1): durations in milliseconds and the
 * two permitted easing curves.
 * @type {Readonly<{ durations: Readonly<Record<string, number>>, easings: readonly string[] }>}
 */
export const MOTION_TOKENS = Object.freeze({
  durations: Object.freeze({
    'dur-hover': 150,
    'dur-elevate': 200,
    'dur-reveal': 400,
  }),
  easings: Object.freeze([
    'cubic-bezier(0.4, 0, 0.2, 1)',
    'cubic-bezier(0, 0, 0.2, 1)',
  ]),
});

/** Fast lookup of every canonical token hex. */
const TOKEN_HEXES = new Set(Object.values(COLOR_TOKENS));

/** Lookup of token key -> hex, tolerant of `--name` / `var(--name)` spellings. */
const TOKEN_KEYS = new Map(Object.entries(COLOR_TOKENS).map(([k, v]) => [k.toLowerCase(), v]));

/** Minimum contrast ratio for body text (Req 4.1, 6.10). */
export const BODY_CONTRAST_MIN = 4.5;

/** Minimum contrast ratio for large text and UI components (Req 4.1, 4.8). */
export const LARGE_TEXT_CONTRAST_MIN = 3;

/* ==========================================================
   2. Color parsing
   ========================================================== */

const HEX3_RE = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX6_RE = /^#([0-9a-f]{6})$/i;
const HEX8_RE = /^#([0-9a-f]{6})[0-9a-f]{2}$/i;
const RGB_RE = /^rgba?\(\s*([0-9]{1,3})\s*[,\s]\s*([0-9]{1,3})\s*[,\s]\s*([0-9]{1,3})\s*(?:[,/]\s*[0-9.%]+\s*)?\)$/i;
const VAR_RE = /^var\(\s*--([a-z0-9-]+)\s*(?:,[^)]*)?\)$/i;
const CUSTOM_PROP_RE = /^--([a-z0-9-]+)$/i;

/**
 * Normalize a color value to canonical uppercase `#RRGGBB`.
 *
 * Accepts `#RGB`, `#RRGGBB`, `#RRGGBBAA`, `rgb()`/`rgba()`, a token key
 * (`lime`, `--lime`) and `var(--lime)`. Alpha is dropped: an alpha overlay of a
 * token (e.g. `rgba(199, 255, 62, 0.10)`) is still that token's color.
 *
 * @param {string} color
 * @returns {string | null} Canonical hex, or null when the value is not a color.
 */
export function normalizeColor(color) {
  if (typeof color !== 'string') return null;
  const value = color.trim();
  if (value === '') return null;

  const varMatch = VAR_RE.exec(value) || CUSTOM_PROP_RE.exec(value);
  if (varMatch) {
    return TOKEN_KEYS.get(varMatch[1].toLowerCase()) || null;
  }

  const hex8 = HEX8_RE.exec(value);
  if (hex8) return `#${hex8[1].toUpperCase()}`;

  const hex6 = HEX6_RE.exec(value);
  if (hex6) return `#${hex6[1].toUpperCase()}`;

  const hex3 = HEX3_RE.exec(value);
  if (hex3) {
    const [, r, g, b] = hex3;
    return `#${(r + r + g + g + b + b).toUpperCase()}`;
  }

  const rgb = RGB_RE.exec(value);
  if (rgb) {
    const channels = [rgb[1], rgb[2], rgb[3]].map((c) => Number(c));
    if (channels.some((c) => !Number.isInteger(c) || c < 0 || c > 255)) return null;
    return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  }

  // A bare token key, e.g. "lime-600".
  const byKey = TOKEN_KEYS.get(value.toLowerCase());
  return byKey || null;
}

/**
 * Split a canonical hex into its 0–255 channels.
 * @param {string} hex Canonical `#RRGGBB`.
 * @returns {[number, number, number]}
 */
function channelsOf(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/* ==========================================================
   3. Token membership (Req 6.1)
   ========================================================== */

/**
 * Whether a color value is a member of the Brand_System token set.
 *
 * Any spelling of a token counts (hex, shorthand hex, `rgb()`/`rgba()` with an
 * alpha overlay, `var(--token)`, or the bare token key). Anything outside the
 * token set — including black, white, and off-brand hexes — does not.
 *
 * @param {string} color
 * @returns {boolean}
 */
export function isBrandToken(color) {
  const hex = normalizeColor(color);
  return hex !== null && TOKEN_HEXES.has(hex);
}

/**
 * The token key for a color value, or null when it is not a token.
 * @param {string} color
 * @returns {string | null}
 */
export function tokenNameOf(color) {
  const hex = normalizeColor(color);
  if (hex === null) return null;
  for (const [key, value] of Object.entries(COLOR_TOKENS)) {
    if (value === hex) return key;
  }
  return null;
}

/* ==========================================================
   4. Surfaces and the lime-surface rule (Req 4.2, 6.5, 6.9)
   ========================================================== */

/**
 * Classify a surface color as dark or light.
 *
 * Token surfaces are classified by identity (carbon/charcoal/slate are dark;
 * bone/bone-2 are light). Any other parseable color falls back to relative
 * luminance so the rule still resolves for off-token surfaces.
 *
 * @param {string} color
 * @returns {'dark' | 'light' | 'unknown'}
 */
export function classifySurface(color) {
  const hex = normalizeColor(color);
  if (hex === null) return 'unknown';
  if (DARK_SURFACES.includes(hex)) return 'dark';
  if (LIGHT_SURFACES.includes(hex)) return 'light';
  // Luminance fallback: the midpoint between the darkest light surface and the
  // lightest dark surface in the token set.
  return relativeLuminance(hex) < 0.18 ? 'dark' : 'light';
}

/**
 * Whether a lime usage obeys the lime-surface rule: `#C7FF3E` (and the brighter
 * `#E8FF8A` glow) only on dark surfaces, the `#9BD11A` companion on light.
 *
 * Returns false when either value is unparseable or when the foreground is not a
 * lime-family token — the rule can only be affirmed for lime usages.
 *
 * @param {string} limeColor
 * @param {string} surfaceColor
 * @returns {boolean}
 */
export function isLimeSurfaceValid(limeColor, surfaceColor) {
  const lime = normalizeColor(limeColor);
  const surface = classifySurface(surfaceColor);
  if (lime === null || surface === 'unknown') return false;

  if (BRIGHT_LIMES.includes(lime)) {
    // Bright lime is a dark-surface-only accent.
    return surface === 'dark';
  }

  if (lime === LIME_600) {
    // The companion is the required lime on light surfaces, and is also the
    // lime used for dark-surface details (hover, CTA offset shadow).
    return true;
  }

  return false;
}

/* ==========================================================
   5. Contrast (WCAG 2.1 relative luminance) — Req 4.1, 6.10
   ========================================================== */

/** Linearize an sRGB channel per WCAG 2.1. */
function linearize(channel8bit) {
  const c = channel8bit / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * WCAG 2.1 relative luminance of a color, in the range 0–1.
 * @param {string} color
 * @returns {number} Luminance, or NaN when the value is not a color.
 */
export function relativeLuminance(color) {
  const hex = normalizeColor(color);
  if (hex === null) return NaN;
  const [r, g, b] = channelsOf(hex).map(linearize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG 2.1 contrast ratio between two colors, in the range 1–21.
 * Symmetric in its arguments.
 * @param {string} a
 * @param {string} b
 * @returns {number} Ratio, or NaN when either value is not a color.
 */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (Number.isNaN(la) || Number.isNaN(lb)) return NaN;
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Whether the foreground/background pair meets a contrast ratio of at least 4.5:1.
 * @param {string} foreground
 * @param {string} background
 * @returns {boolean}
 */
export function meetsBodyContrast(foreground, background) {
  const ratio = contrastRatio(foreground, background);
  return Number.isNaN(ratio) ? false : ratio >= BODY_CONTRAST_MIN;
}

/**
 * Whether the pair meets 3:1 — the threshold for large text, focus indicators,
 * and meaningful graphical objects.
 * @param {string} foreground
 * @param {string} background
 * @returns {boolean}
 */
export function meetsLargeTextContrast(foreground, background) {
  const ratio = contrastRatio(foreground, background);
  return Number.isNaN(ratio) ? false : ratio >= LARGE_TEXT_CONTRAST_MIN;
}

/* ==========================================================
   6. The acronym rule (Req 6.8)
   ========================================================== */

/**
 * The standalone acronym, not preceded or followed by another word character —
 * so "CNSPK" and "CNSPK-0042" pass while a bare "CNSP" (or "CNSP." / "(CNSP)")
 * is caught. Case-insensitive: the acronym may be cased by CSS, not by markup.
 */
const BARE_ACRONYM_RE = /(?<![A-Za-z0-9_])CNSP(?![A-Za-z0-9_])/gi;

/**
 * Every occurrence of the standalone acronym "CNSP" in a piece of copy.
 * @param {string} copy
 * @returns {{ index: number, match: string }[]}
 */
export function findBareAcronym(copy) {
  if (typeof copy !== 'string' || copy === '') return [];
  const hits = [];
  const re = new RegExp(BARE_ACRONYM_RE.source, BARE_ACRONYM_RE.flags);
  let m = re.exec(copy);
  while (m !== null) {
    hits.push({ index: m.index, match: m[0] });
    m = re.exec(copy);
  }
  return hits;
}

/**
 * Whether a piece of copy is free of the standalone acronym "CNSP".
 * Non-string input carries no copy, so it is clean.
 * @param {string} copy
 * @returns {boolean}
 */
export function isAcronymClean(copy) {
  return findBareAcronym(copy).length === 0;
}
