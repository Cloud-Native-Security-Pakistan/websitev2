/**
 * Unit tests for the sub-ask and dispatch surfaces (Tasks 12.6, 12.7).
 *
 * Covers the five shipped pages — /hire/, /sponsor/, /speak/, /cfp/, /dispatch/ —
 * and the dispatch signup markup in js/NewsletterSignup.js:
 *   - each form declares the right `data-intake` kind and carries a named input
 *     plus a `data-intake-error-for` region for every field in that form's
 *     validation schema, with a real submit button;
 *   - each page states an explicit response expectation and its no-spam terms;
 *   - /hire/ and /sponsor/ render in the Embassy register, /speak/, /cfp/ and
 *     /dispatch/ in Workshop;
 *   - the dispatch opt-in ships unselected with the one-click unsubscribe
 *     statement beside it;
 *   - no lime-family color is used as text on a light/bone surface (lime-600 on
 *     bone measures 1.62:1 — the ruling recorded in js/lib/brand-tokens.js);
 *   - "280+" is the only membership figure, and no engagement-bait copy ships.
 *
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4, 19.1, 19.2, 19.3
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SCHEMAS } from '../js/lib/intake-validation.js';
import { INTAKE_FORMS } from '../js/intake-client.js';
import { newsletterSignupHTML, UNSUBSCRIBE_STATEMENT } from '../js/NewsletterSignup.js';
import {
  contrastRatio,
  normalizeColor,
  LIGHT_SURFACES,
  BODY_CONTRAST_MIN,
  isAcronymClean,
} from '../js/lib/brand-tokens.js';

const readRepoFile = (relative) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/**
 * The five surfaces. `formSource` is where the form markup actually lives:
 * dispatch renders its form from js/NewsletterSignup.js, the rest ship it inline.
 */
const PAGES = [
  { route: '/hire/', file: '../hire/index.html', kind: 'hire', register: 'embassy' },
  { route: '/sponsor/', file: '../sponsor/index.html', kind: 'sponsor', register: 'embassy' },
  { route: '/speak/', file: '../speak/index.html', kind: 'speak', register: 'workshop' },
  { route: '/cfp/', file: '../cfp/index.html', kind: 'speak', register: 'workshop' },
  {
    route: '/dispatch/',
    file: '../dispatch/index.html',
    kind: 'dispatch',
    register: 'workshop',
    formSource: () => newsletterSignupHTML(),
  },
];

const html = new Map(PAGES.map((page) => [page.route, readRepoFile(page.file)]));

/** The markup that holds the form for a page. */
const formMarkup = (page) => (page.formSource ? page.formSource() : html.get(page.route));

/** Strip tags, scripts, and styles so copy checks read what a visitor reads. */
function visibleText(source) {
  return source
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

describe.each(PAGES)('$route intake form', (page) => {
  const schema = SCHEMAS[INTAKE_FORMS[page.kind].schema];

  it(`declares data-intake="${page.kind}"`, () => {
    expect(formMarkup(page)).toContain(`data-intake="${page.kind}"`);
  });

  it('carries a named input and an error region for every schema field', () => {
    const markup = formMarkup(page);
    for (const field of schema.fields) {
      expect(markup, `${page.route} missing input name="${field.id}"`).toContain(`name="${field.id}"`);
      expect(markup, `${page.route} missing error region for "${field.id}"`).toContain(
        `data-intake-error-for="${field.id}"`,
      );
    }
  });

  it('binds a <label> to every field control', () => {
    const markup = formMarkup(page);
    const ids = [...markup.matchAll(/<(?:input|textarea)[^>]*\bname="([a-zA-Z_]+)"[^>]*>/g)]
      .map((match) => /\bid="([^"]+)"/.exec(match[0]))
      .filter((idMatch) => idMatch !== null)
      .map((idMatch) => idMatch[1]);

    expect(ids.length).toBe(schema.fields.length);
    for (const id of ids) {
      expect(markup, `${page.route} has no <label for="${id}">`).toContain(`for="${id}"`);
    }
  });

  it('offers a submit button plus the general error and success regions', () => {
    const markup = formMarkup(page);
    expect(markup).toMatch(/<button[^>]*type="submit"/);
    expect(markup).toContain('data-intake-error');
    expect(markup).toContain('data-intake-success');
  });

  it('delegates submission to the shared intake client', () => {
    const source = html.get(page.route);
    expect(source).toMatch(/from '\/js\/(intake-client|NewsletterSignup)\.js'/);
    // No hand-rolled submit path: the client owns fetch, validation, and fallback.
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/action="mailto:/);
  });
});

describe.each(PAGES)('$route content and register', (page) => {
  it(`renders in the ${page.register} register`, () => {
    expect(html.get(page.route)).toMatch(
      new RegExp(`<body[^>]*data-register="${page.register}"`),
    );
  });

  it('states an explicit response expectation', () => {
    const source = html.get(page.route);
    expect(source).toContain('data-response-expectation');
    expect(visibleText(source)).toMatch(/\b\d+\s*working days\b/);
  });

  it('states the no-spam terms for its audience', () => {
    const source = html.get(page.route);
    expect(source).toContain('data-no-spam-terms');
    expect(visibleText(source)).toMatch(/mailing list|unsubscribe|drip/i);
  });

  it('keeps the page shape convention', () => {
    const source = html.get(page.route);
    expect(source).toContain('http-equiv="Content-Security-Policy"');
    expect(source).toContain('<link rel="stylesheet" href="/css/tokens.css">');
    expect(source).toContain('<div id="navbar"></div>');
    expect(source).toContain('<div id="footer"></div>');
    expect(source).toContain('<main>');
    // tokens.css is linked before any page-specific style block.
    expect(source.indexOf('/css/tokens.css')).toBeLessThan(source.indexOf('<style>'));
  });

  it('never skips a heading level', () => {
    const levels = [...html.get(page.route).matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1], `heading jump at index ${i} on ${page.route}`).toBeLessThanOrEqual(1);
    }
  });
});

describe('/hire/ and /sponsor/ carry the Embassy audience copy', () => {
  it('explains how a role is posted and refuses a candidate database', () => {
    const text = visibleText(html.get('/hire/'));
    expect(text).toMatch(/how you post a role/i);
    expect(text).toMatch(/no cv database/i);
    expect(text).toMatch(/no member email addresses/i);
  });

  it('states what sponsorship is and that logo-spam is not for sale', () => {
    const text = visibleText(html.get('/sponsor/'));
    expect(text).toMatch(/what sponsorship actually is/i);
    expect(text).toMatch(/pure logo-spam is not for sale/i);
    expect(text).toMatch(/no attendee or member data/i);
  });

  it('lists no sponsor names or logos while none are agreed', () => {
    const source = html.get('/sponsor/');
    expect(source).toMatch(/sponsors · none listed/);
    expect(source).not.toMatch(/<img[^>]*sponsor/i);
  });
});

describe('/speak/ and /cfp/ state the CFP review SLA', () => {
  for (const route of ['/speak/', '/cfp/']) {
    it(`${route} publishes acknowledge / review / decision windows`, () => {
      const text = visibleText(html.get(route));
      expect(text).toMatch(/3 working days/);
      expect(text).toMatch(/7 days/);
      expect(text).toMatch(/10 days/);
    });
  }
});

describe('/dispatch/ signup (Requirements 19.1, 19.2, 19.3)', () => {
  const signup = newsletterSignupHTML();

  it('mounts the NewsletterSignup component rather than a bespoke form', () => {
    const source = html.get('/dispatch/');
    expect(source).toContain('id="dispatch-signup"');
    expect(source).toContain("mountNewsletterSignup('dispatch-signup')");
    // The page itself ships no form markup that could drift from the component.
    expect(source).not.toMatch(/<form/);
  });

  it('ships the opt-in control unselected', () => {
    const optIn = /<input[^>]*name="optIn"[^>]*>/.exec(signup);
    expect(optIn).not.toBeNull();
    expect(optIn[0]).toContain('type="checkbox"');
    expect(optIn[0]).not.toMatch(/\bchecked\b/);
  });

  it('places a one-click unsubscribe statement adjacent to the opt-in', () => {
    const block = /<div class="signup-form__optin">([\s\S]*?)<\/div>/.exec(signup);
    expect(block).not.toBeNull();
    expect(block[1]).toContain('name="optIn"');
    expect(block[1]).toContain('data-unsubscribe-statement');
    expect(block[1]).toContain(UNSUBSCRIBE_STATEMENT);
    expect(UNSUBSCRIBE_STATEMENT).toMatch(/one-click unsubscribe/i);
    expect(UNSUBSCRIBE_STATEMENT).toMatch(/one click/i);
    // The statement follows the control it belongs to in reading order.
    expect(block[1].indexOf('name="optIn"')).toBeLessThan(block[1].indexOf('data-unsubscribe-statement'));
  });

  it('asks for the email in local@domain form with its own error region', () => {
    expect(signup).toMatch(/<input[^>]*type="email"[^>]*name="email"/);
    expect(signup).toContain('data-intake-error-for="email"');
    expect(signup).toContain('data-intake-error-for="optIn"');
    expect(visibleText(signup)).toMatch(/local@domain/);
  });

  it('promises no cadence it cannot keep', () => {
    const text = visibleText(html.get('/dispatch/'));
    expect(text).toMatch(/do not promise a cadence/i);
    expect(text).not.toMatch(/every monday|weekly newsletter/i);
  });
});

describe('brand rules: lime is never text on a light surface', () => {
  const LIME_TEXT = /var\(\s*--lime(?:-600|-glow)?\s*\)|#c7ff3e|#9bd11a|#e8ff8a/i;

  /** The opaque light grounds a page may paint: bone, bone-2, white. */
  const LIGHT_GROUNDS = new Set([...LIGHT_SURFACES, '#FFFFFF']);

  /** Flatten a page's <style> blocks into { selector, body } rules. */
  function cssRules(source) {
    const blocks = [...source.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
    const flattened = blocks
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      // Drop at-rule wrappers so their inner rules parse as ordinary rules.
      .replace(/@(?:media|supports|keyframes)[^{]*\{/g, ' ');

    return [...flattened.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
      selector: m[1].trim().replace(/\s+/g, ' '),
      body: m[2],
    }));
  }

  /** The `color:` value of a rule, normalized to a hex, or null. */
  function colorOf(rule) {
    const match = /(?:^|;|\s)color\s*:\s*([^;}]+)/.exec(rule.body);
    return match ? normalizeColor(match[1].trim()) : null;
  }

  /**
   * The opaque light surface a rule paints, or null.
   *
   * Only a solid bone/white ground counts. Gradients, images, and translucent
   * tints (e.g. `rgba(199, 255, 62, 0.08)` over carbon) are not resolvable text
   * backgrounds, so they are not treated as light surfaces.
   */
  function backgroundOf(rule) {
    const match = /(?:^|;|\s)background(?:-color)?\s*:\s*([^;}]+)/.exec(rule.body);
    if (!match) return null;
    const value = match[1].trim();
    if (/gradient|url\(|rgba\(|transparent/i.test(value)) return null;

    const hex = normalizeColor(value);
    if (hex === null) return null;
    return LIGHT_GROUNDS.has(hex) ? hex : null;
  }

  for (const page of PAGES) {
    it(`${page.route} uses an accessible text color on every light surface`, () => {
      const rules = cssRules(html.get(page.route));
      const lightRules = rules.filter((rule) => backgroundOf(rule) !== null);
      const lightSelectors = lightRules.map((rule) => rule.selector);

      for (const light of lightRules) {
        const family = rules.filter(
          (rule) => rule.selector === light.selector || rule.selector.startsWith(`${light.selector} `),
        );

        for (const rule of family) {
          const declared = /(?:^|;|\s)color\s*:\s*([^;}]+)/.exec(rule.body);
          if (!declared) continue;

          // Hard rule: no lime-family value as text on a light surface.
          expect(
            LIME_TEXT.test(declared[1]),
            `${page.route}: "${rule.selector}" sets a lime text color on the light surface "${light.selector}"`,
          ).toBe(false);

          const color = colorOf(rule);
          if (color === null) continue;
          expect(
            contrastRatio(color, backgroundOf(light)),
            `${page.route}: "${rule.selector}" (${color}) on ${backgroundOf(light)}`,
          ).toBeGreaterThanOrEqual(BODY_CONTRAST_MIN);
        }
      }

      // Sanity: the parser found the light surfaces it was meant to check.
      if (['/hire/', '/sponsor/', '/cfp/'].includes(page.route)) {
        expect(lightSelectors.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('content honesty and anti-automation copy', () => {
  const BANNED = [/excited to announce/i, /limited spots/i, /last chance/i, /\bleverag(?:e|es|ed|ing)\b/i];

  for (const page of PAGES) {
    it(`${page.route} ships no engagement-bait or fake-scarcity copy`, () => {
      const text = visibleText(html.get(page.route));
      for (const phrase of BANNED) {
        expect(phrase.test(text), `${page.route} contains ${phrase}`).toBe(false);
      }
    });

    it(`${page.route} quotes no membership figure other than "280+"`, () => {
      const text = visibleText(html.get(page.route));
      const figures = [...text.matchAll(/(\d[\d,]*)\s*\+?\s*(?:members|practitioners|attendees|people)\b/gi)];
      for (const [match, value] of figures) {
        expect(value, `${page.route}: "${match.trim()}"`).toBe('280');
      }
      if (/280/.test(text)) expect(text).toContain('280+');
    });

    it(`${page.route} writes the acronym as CNSPK`, () => {
      expect(isAcronymClean(visibleText(html.get(page.route)))).toBe(true);
    });

    it(`${page.route} routes joining to the canonical /join/`, () => {
      const source = html.get(page.route);
      const joinHrefs = [...source.matchAll(/href="([^"]*join[^"]*)"/gi)].map((m) => m[1]);
      for (const href of joinHrefs) {
        expect(href, `${page.route} -> ${href}`).toBe('/join/');
      }
      expect(source).not.toMatch(/chat\.whatsapp\.com|become-a-member/);
    });
  }
});
