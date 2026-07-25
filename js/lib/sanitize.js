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
