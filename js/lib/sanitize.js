/**
 * sanitize — DOMPurify wrapper applied wherever member/session/intake values
 * are inserted into the DOM (MemberCard, SessionCard, SessionDetail, map popups).
 *
 * Pure ES module: importable in both the browser and Node.
 *
 * Two execution paths, one contract:
 *   - Browser: when DOMPurify is loaded from the CDN, it is used with a safe
 *     allowlist that keeps light formatting tags but strips every executable
 *     script and every event-handler (`on*`) attribute.
 *   - Node / no-DOM (e.g. vitest): DOMPurify is unavailable, so the pure
 *     fallback runs instead. It removes executable blocks outright and then
 *     HTML-escapes everything that remains, so no tag — and therefore no
 *     script element and no event-handler attribute — can ever reach the DOM.
 *     This pure path is what the property suite exercises in Node.
 *
 * Both paths guarantee Property 7: the sanitized value yields DOM content with
 * no executable script and no event-handler attributes.
 *
 * Validates: Requirement 2.4
 */

// Light formatting tags kept by the browser (DOMPurify) path. Mirrors the
// allowlist the site has always used so rendered copy is unchanged.
const ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'span', 'div', 'ul', 'li'];
const ALLOWED_ATTR = ['href', 'target', 'class', 'rel'];

// Tags whose very presence is executable or framing risk. Removed content-and-all
// in the pure fallback before escaping.
const EXECUTABLE_BLOCK = /<(script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\/\1\s*>/gi;
// Any stray opening/closing executable tag left after block removal.
const EXECUTABLE_TAG = /<\/?(script|style|iframe|object|embed|noscript|template)\b[^>]*>/gi;

/**
 * Resolve a usable DOMPurify instance if one is present in the host
 * environment, otherwise null. Guarded so the module imports cleanly in Node.
 * @returns {{ sanitize: Function } | null}
 */
function getDOMPurify() {
  if (typeof window !== 'undefined' && window.DOMPurify) return window.DOMPurify;
  if (typeof globalThis !== 'undefined' && globalThis.DOMPurify) return globalThis.DOMPurify;
  return null;
}

/**
 * Pure, DOM-free fallback. Strips executable blocks then HTML-escapes the
 * remainder. After this runs the output contains no `<` or `>` characters, so
 * it cannot be parsed into any element — guaranteeing no script and no
 * event-handler attribute regardless of the input.
 * @param {string} input
 * @returns {string}
 */
function pureSanitize(input) {
  const stripped = input
    .replace(EXECUTABLE_BLOCK, '')
    .replace(EXECUTABLE_TAG, '');

  return stripped
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitize a string value, stripping executable script and event-handler
 * attributes, before it is inserted into the page.
 *
 * @param {string} dirty - The untrusted value (member/session/intake data).
 * @returns {string} A value safe to insert into the DOM.
 */
export function sanitizeHTML(dirty) {
  if (dirty === null || dirty === undefined) return '';
  const value = String(dirty);
  if (value === '') return '';

  const purifier = getDOMPurify();
  if (purifier) {
    // DOMPurify removes <script> and every on* handler by default; the
    // allowlists keep the value conservative.
    return purifier.sanitize(value, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
    });
  }

  return pureSanitize(value);
}
/* ------------------------------------------------------------------------- *
 * Attribute- and URL-context companions to sanitizeHTML.
 *
 * sanitizeHTML() is the text/markup-context wrapper. Two other contexts appear
 * at the site's render points and need their own handling, because a value that
 * is inert as text can still be executable when it lands inside an attribute:
 *
 *   1. Quoted attribute values (`alt="…"`, `data-username="…"`, `id="…"`).
 *      A value containing a double quote can close the attribute early and add
 *      an `on*` event-handler attribute of its own. sanitizeAttribute() escapes
 *      the delimiters so the value can never leave its attribute.
 *   2. URL attribute values (`href="…"`, `src="…"`). Escaping alone does not
 *      help against `javascript:` / `data:` / `vbscript:` URLs, which execute
 *      on activation. sanitizeURL() allows only safe schemes and relative URLs,
 *      then escapes what remains.
 *
 * Both take the RAW value (never the output of sanitizeHTML) so entities are
 * escaped exactly once and benign values render identically to before.
 *
 * Validates: Requirement 2.4
 * ------------------------------------------------------------------------- */

// Schemes that execute or can carry markup when navigated to.
const UNSAFE_SCHEME = /^(?:javascript|vbscript|data|blob|file):/i;
// Any explicit scheme at the start of a URL, e.g. `https:`, `mailto:`.
const EXPLICIT_SCHEME = /^([a-z][a-z0-9+.-]*):/i;
// Schemes the site links to.
const ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel'];
// Control characters and whitespace used to smuggle `java\0script:` past checks.
const URL_NOISE = /[\u0000-\u0020\u007f-\u009f\u200b-\u200f\u2028\u2029]/g;

/**
 * Escape a raw value for insertion inside a quoted HTML attribute.
 *
 * The escaping is entity-based, so the HTML parser hands the original string
 * back to `getAttribute`/`dataset` — attribute-driven behaviour (filtering by
 * `data-topic`, card lookup by `data-username`) is unchanged.
 *
 * @param {*} value - Raw untrusted value.
 * @returns {string} A value that cannot escape its attribute.
 */
export function sanitizeAttribute(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/`/g, '&#096;');
}

/**
 * Sanitize a raw value destined for an `href`/`src` attribute.
 *
 * Returns '' for anything that is not an allowed absolute scheme or a relative
 * URL, so an executable `javascript:` link renders as an inert empty href
 * instead of running. The surviving value is attribute-escaped.
 *
 * @param {*} value - Raw untrusted URL.
 * @returns {string} A safe URL, or '' when the value is not safe to link to.
 */
export function sanitizeURL(value) {
  if (value === null || value === undefined) return '';

  const raw = String(value).trim();
  if (raw === '') return '';

  // Strip characters that only exist to break up a scheme before testing it.
  const probe = raw.replace(URL_NOISE, '');
  if (UNSAFE_SCHEME.test(probe)) return '';

  const scheme = probe.match(EXPLICIT_SCHEME);
  if (scheme && !ALLOWED_SCHEMES.includes(scheme[1].toLowerCase())) return '';

  // Keep the value as authored (minus control characters); only the scheme
  // check needed the de-noised copy.
  return sanitizeAttribute(raw.replace(/[\u0000-\u001f\u007f]/g, ''));
}
