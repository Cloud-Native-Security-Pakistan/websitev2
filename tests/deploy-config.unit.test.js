/**
 * Unit tests for the deploy configuration (Tasks 16.1, 16.2).
 *
 * These parse the real root-level `_headers`, `_redirects`, and `404.html` as
 * text — no server, no network — and assert the security-and-routing posture the
 * spec requires. They are the static counterpart to task 16.4's live-response
 * test: if these fail, the deployed headers cannot be correct either.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 1.3, 1.5
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rootFile = (name) => fileURLToPath(new URL(`../${name}`, import.meta.url));
const read = (name) => readFileSync(rootFile(name), 'utf8');

const headersText = read('_headers');
const redirectsText = read('_redirects');

/**
 * Parse a Cloudflare Pages `_headers` file into { pattern: { header: value } }.
 * Lines starting with `#` are comments; a line with no leading whitespace is a
 * path pattern; indented `Name: value` lines belong to the preceding pattern.
 */
function parseHeaders(text) {
  const rules = {};
  let current = null;

  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;

    const isIndented = /^\s/.test(rawLine);
    const line = rawLine.trim();

    if (!isIndented) {
      current = line;
      rules[current] = rules[current] || {};
      continue;
    }

    const idx = line.indexOf(':');
    if (idx === -1 || current === null) continue;
    rules[current][line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }

  return rules;
}

/**
 * Parse a Cloudflare Pages `_redirects` file into
 * [{ source, destination, code }]. Comments and blank lines are skipped.
 */
function parseRedirects(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [source, destination, code] = line.split(/\s+/);
      return { source, destination, code: code ? Number(code) : 302 };
    });
}

/** Split a CSP string into { directive: [sources] }. */
function parseCSP(csp) {
  const directives = {};
  for (const part of csp.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    directives[tokens[0]] = tokens.slice(1);
  }
  return directives;
}

const headerRules = parseHeaders(headersText);
const globalHeaders = headerRules['/*'];

describe('_headers — parse shape', () => {
  it('declares a rule for every route (/*)', () => {
    expect(globalHeaders).toBeDefined();
  });
});

describe('_headers — transport security (Requirement 2.2)', () => {
  it('sends Strict-Transport-Security with max-age >= 31536000', () => {
    const hsts = globalHeaders['Strict-Transport-Security'];
    expect(hsts).toBeDefined();

    const match = /max-age\s*=\s*(\d+)/i.exec(hsts);
    expect(match).not.toBeNull();
    expect(Number(match[1])).toBeGreaterThanOrEqual(31536000);
  });

  it('includes subdomains in the HSTS policy', () => {
    expect(globalHeaders['Strict-Transport-Security'].toLowerCase())
      .toContain('includesubdomains');
  });
});

describe('_headers — nosniff, referrer, frame protection (Requirement 2.3)', () => {
  it('sends X-Content-Type-Options: nosniff', () => {
    expect(globalHeaders['X-Content-Type-Options']).toBe('nosniff');
  });

  it('sends a Referrer-Policy', () => {
    expect(globalHeaders['Referrer-Policy']).toBeTruthy();
  });

  it('sends frame protection as both X-Frame-Options and CSP frame-ancestors', () => {
    expect(globalHeaders['X-Frame-Options']).toBe('DENY');
    expect(parseCSP(globalHeaders['Content-Security-Policy'])['frame-ancestors'])
      .toEqual(["'none'"]);
  });
});

describe('_headers — Content-Security-Policy (Requirement 2.1)', () => {
  const csp = globalHeaders['Content-Security-Policy'];
  const directives = parseCSP(csp);

  it('declares a CSP', () => {
    expect(csp).toBeTruthy();
  });

  it('locks the default source to self', () => {
    expect(directives['default-src']).toEqual(["'self'"]);
  });

  it('allowlists no wildcard host in script-src', () => {
    const scriptSrc = directives['script-src'];
    expect(scriptSrc).toBeDefined();

    for (const source of scriptSrc) {
      // Keyword sources ('self', 'unsafe-inline', ...) are not hosts.
      if (source.startsWith("'")) continue;
      expect(source).not.toContain('*');
    }
  });

  it('allowlists the origins the site actually loads', () => {
    const scriptSrc = directives['script-src'].join(' ');
    expect(scriptSrc).toContain('https://cdn.tailwindcss.com'); // Tailwind CDN
    expect(scriptSrc).toContain('https://cdn.jsdelivr.net');    // DOMPurify
    expect(scriptSrc).toContain('https://unpkg.com');           // Leaflet JS

    expect(directives['style-src'].join(' ')).toContain('https://fonts.googleapis.com');
    expect(directives['font-src'].join(' ')).toContain('https://fonts.gstatic.com');

    const imgSrc = directives['img-src'].join(' ');
    expect(imgSrc).toContain('https://unpkg.com');                  // Leaflet marker images
    expect(imgSrc).toContain('https://*.basemaps.cartocdn.com');     // map tiles

    // Published Directory_CSV host, and the same-origin /api/* fetches.
    const connectSrc = directives['connect-src'];
    expect(connectSrc.join(' ')).toContain('https://docs.google.com');
    expect(connectSrc).toContain("'self'");

    // Google Forms POST target for the membership form.
    expect(directives['form-action'].join(' ')).toContain('https://docs.google.com');
  });

  it('forbids plugin content and foreign base URIs', () => {
    expect(directives['object-src']).toEqual(["'none'"]);
    expect(directives['base-uri']).toEqual(["'self'"]);
  });
});

describe('_redirects — www to apex (Requirement 1.3)', () => {
  const rules = parseRedirects(redirectsText);

  it('declares a www rule', () => {
    expect(rules.some((rule) => rule.source.includes('www.cloudnativesecurity.pk')))
      .toBe(true);
  });

  it('redirects www to the apex with a 308 that preserves the path', () => {
    const rule = rules.find((r) => r.source.includes('www.cloudnativesecurity.pk'));

    expect(rule.code).toBe(308);
    expect(rule.source.endsWith('/*')).toBe(true);
    expect(rule.destination).toBe('https://cloudnativesecurity.pk/:splat');
  });

  it('leaves HTTP to HTTPS to Cloudflare rather than declaring it here', () => {
    // Exactly one mechanism owns each redirect: "Always Use HTTPS" owns this one.
    expect(redirectsText).toMatch(/Always Use HTTPS/i);
    expect(parseRedirects(redirectsText).some((r) => r.source.startsWith('http://')))
      .toBe(false);
  });
});

describe('404.html — branded not-found page (Requirement 1.5)', () => {
  it('exists at the project root', () => {
    expect(existsSync(rootFile('404.html'))).toBe(true);
  });

  const html = read('404.html');

  it('links the design tokens stylesheet', () => {
    expect(html).toContain('/css/tokens.css');
  });

  it('contains a working link back to the home page', () => {
    expect(html).toMatch(/href="\/"/);
  });

  it('mounts the shared Navbar and Footer components', () => {
    expect(html).toContain('/js/Navbar.js');
    expect(html).toContain('/js/Footer.js');
  });

  it('uses semantic landmarks and a single top-level heading', () => {
    expect(html).toContain('<main>');
    expect((html.match(/<h1\b/g) || []).length).toBe(1);
  });
});
