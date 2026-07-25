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

/* ----------------------------------------------------------
   Measured contrast ratios — the light-surface accent ruling
   ----------------------------------------------------------
   Computed with `contrastRatio()` below (WCAG 2.1 relative
   luminance) from the canonical token hexes:

     lime      #C7FF3E on carbon  #0F1115 → 16.02 : 1   AAA
     lime-600  #9BD11A on carbon  #0F1115 → 10.37 : 1   AAA
     lime      #C7FF3E on bone    #F4F1EA →  1.05 : 1   fail
     lime-600  #9BD11A on bone    #F4F1EA →  1.62 : 1   fail
     lime-600  #9BD11A on bone-2  #E8E3D6 →  1.42 : 1   fail
     pak-green #01411C on bone    #F4F1EA → 10.49 : 1   AAA
     pak-green #01411C on bone-2  #E8E3D6 →  9.24 : 1   AAA
     bone      #F4F1EA on carbon  #0F1115 → 16.75 : 1   AAA

   AGENT_BRIEF.md describes lime-600 as "AA on light". That
   line is WRONG: at 1.62:1 it is nowhere near the 4.5:1 body
   minimum, and 1.62:1 also fails the 3:1 large-text/UI floor.
   `css/tokens.css` carries the same incorrect note beside
   `--lime-600` ("AA on bone/light") and should be corrected
   there too.

   STAKEHOLDER RULING (task 9.6): pak-green #01411C is the
   light-surface / Embassy text accent. Lime and lime-600 are
   permitted on light surfaces only as non-text graphical
   decoration (rules, glows, fills, chart strokes) — never for
   words a reader has to read. The two cases are kept
   distinguishable in code via LIME_USAGE below rather than
   collapsed into a single boolean.
   ---------------------------------------------------------- */

/** The signature lime accent — dark surfaces only (Req 6.5). */
export const LIME = COLOR_TOKENS.lime;

/**
 * The darker lime companion. Legible as text on dark surfaces (10.37:1 on
 * carbon); on light surfaces it is decoration only (1.62:1 on bone) (Req 4.2, 6.9).
 */
export const LIME_600 = COLOR_TOKENS['lime-600'];

/** Ceremonial heritage green, and the light-surface text accent (task 9.6). */
export const PAK_GREEN = COLOR_TOKENS['pak-green'];

/**
 * The ruled text accent for light / Embassy surfaces: pak-green, 10.49:1 on
 * bone and 9.24:1 on bone-2 (Req 4.1, 6.8).
 */
export const LIGHT_SURFACE_TEXT_ACCENT = PAK_GREEN;

/** The measured ratios above, machine-readable for tests and the brand book. */
export const MEASURED_CONTRAST = Object.freeze({
  'lime-on-carbon': 16.02,
  'lime-600-on-carbon': 10.37,
  'lime-on-bone': 1.05,
  'lime-600-on-bone': 1.62,
  'lime-600-on-bone-2': 1.42,
  'pak-green-on-bone': 10.49,
  'pak-green-on-bone-2': 9.24,
  'bone-on-carbon': 16.75,
});

/**
 * How a color is being used. Text has to be read, so it carries the contrast
 * obligation; decoration is non-text graphics and does not.
 * @type {Readonly<{ TEXT: 'text', DECORATION: 'decoration' }>}
 */
export const LIME_USAGE = Object.freeze({ TEXT: 'text', DECORATION: 'decoration' });

/** Lime-family tokens that are only legible on dark surfaces. */
const BRIGHT_LIMES = Object.freeze([COLOR_TOKENS.lime, COLOR_TOKENS['lime-glow']]);

/** Every lime-family token. */
const LIME_FAMILY = Object.freeze([...BRIGHT_LIMES, COLOR_TOKENS['lime-600']]);

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
 * Whether a lime-family color may be used as TEXT on a surface.
 *
 * The whole lime family — `#C7FF3E`, `#E8FF8A`, and the `#9BD11A` companion — is
 * dark-surface-only for text. On light surfaces no lime clears 4.5:1 (the
 * companion manages 1.62:1 on bone), so light-surface text accents use
 * `LIGHT_SURFACE_TEXT_ACCENT` (pak-green) instead.
 *
 * @param {string} limeColor
 * @param {string} surfaceColor
 * @returns {boolean}
 */
export function isLimeTextValid(limeColor, surfaceColor) {
  const lime = normalizeColor(limeColor);
  const surface = classifySurface(surfaceColor);
  if (lime === null || surface === 'unknown') return false;
  if (!LIME_FAMILY.includes(lime)) return false;
  return surface === 'dark';
}

/**
 * Whether a lime-family color may be used as non-text DECORATION on a surface —
 * rules, glows, fills, chart strokes, and other graphics that carry no words.
 *
 * Lime decoration is allowed on light surfaces: the ruling restricts lime on
 * light to exactly this case, so it stays expressible rather than blanket-denied.
 *
 * @param {string} limeColor
 * @param {string} surfaceColor
 * @returns {boolean}
 */
export function isLimeDecorationValid(limeColor, surfaceColor) {
  const lime = normalizeColor(limeColor);
  const surface = classifySurface(surfaceColor);
  if (lime === null || surface === 'unknown') return false;
  return LIME_FAMILY.includes(lime);
}

/**
 * Whether a lime usage obeys the lime-surface rule for a given usage.
 *
 * Defaults to `LIME_USAGE.TEXT`, the obligation-carrying case: lime text is
 * dark-surface-only, so lime-600 as text on bone now fails rather than
 * reporting the old false pass. Pass `LIME_USAGE.DECORATION` for non-text
 * graphics, which lime may carry on light surfaces too.
 *
 * Returns false when either value is unparseable, when the foreground is not a
 * lime-family token, or when the usage is not a known usage — the rule can only
 * be affirmed for lime usages.
 *
 * @param {string} limeColor
 * @param {string} surfaceColor
 * @param {'text' | 'decoration'} [usage] Defaults to text.
 * @returns {boolean}
 */
export function isLimeSurfaceValid(limeColor, surfaceColor, usage = LIME_USAGE.TEXT) {
  if (usage === LIME_USAGE.DECORATION) return isLimeDecorationValid(limeColor, surfaceColor);
  if (usage === LIME_USAGE.TEXT) return isLimeTextValid(limeColor, surfaceColor);
  return false;
}

/**
 * The full verdict for a lime usage, so callers can report *why* rather than
 * just pass/fail.
 *
 * @param {string} limeColor
 * @param {string} surfaceColor
 * @param {'text' | 'decoration'} [usage]
 * @returns {{ allowed: boolean, usage: string, surface: 'dark' | 'light' | 'unknown', ratio: number, reason: string }}
 */
export function evaluateLimeUsage(limeColor, surfaceColor, usage = LIME_USAGE.TEXT) {
  const surface = classifySurface(surfaceColor);
  const ratio = contrastRatio(limeColor, surfaceColor);
  const allowed = isLimeSurfaceValid(limeColor, surfaceColor, usage);
  let reason;
  if (usage !== LIME_USAGE.TEXT && usage !== LIME_USAGE.DECORATION) {
    reason = `unknown usage "${usage}"`;
  } else if (normalizeColor(limeColor) === null || surface === 'unknown') {
    reason = 'unparseable color or surface';
  } else if (!LIME_FAMILY.includes(normalizeColor(limeColor))) {
    reason = 'foreground is not a lime-family token';
  } else if (allowed) {
    reason = usage === LIME_USAGE.TEXT
      ? `lime text on a ${surface} surface`
      : `lime decoration carries no text obligation on a ${surface} surface`;
  } else {
    reason = `lime text on a light surface never reaches ${BODY_CONTRAST_MIN}:1 — use the light-surface text accent ${LIGHT_SURFACE_TEXT_ACCENT}`;
  }
  return { allowed, usage, surface, ratio, reason };
}

/**
 * Whether a color is the ruled light-surface text accent (pak-green).
 * @param {string} color
 * @returns {boolean}
 */
export function isLightSurfaceTextAccent(color) {
  return normalizeColor(color) === LIGHT_SURFACE_TEXT_ACCENT;
}

/**
 * The text accent to use on a surface: lime on dark, pak-green on light.
 * @param {string} surfaceColor
 * @returns {string | null} A token hex, or null for an unclassifiable surface.
 */
export function textAccentForSurface(surfaceColor) {
  const surface = classifySurface(surfaceColor);
  if (surface === 'dark') return LIME;
  if (surface === 'light') return LIGHT_SURFACE_TEXT_ACCENT;
  return null;
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
