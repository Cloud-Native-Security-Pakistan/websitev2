/**
 * Unit tests for the shared intake client (Task 12.1).
 *
 * Covers the pure contract: submit-target selection per form, payload shapes
 * including the `_hp` honeypot and `_t` render timestamp, the JSON response
 * contract (200 / 400 / 429 / 5xx / network failure), value preservation on
 * every error path, and the labeled `mailto:` fallback when an endpoint is
 * unconfigured. The network boundary is supplied via `fetchImpl` so the real
 * client code runs end to end without a server.
 *
 * Validates: Requirements 15.2, 19.3
 */
import { describe, it, expect } from 'vitest';
import {
  INTAKE_STATES,
  INTAKE_MESSAGES,
  INTAKE_KINDS,
  INTAKE_FORMS,
  resolveIntakeTarget,
  validateIntake,
  buildPayload,
  interpretResponse,
  buildMailtoHref,
  submitIntake,
} from '../js/intake-client.js';
import { INTAKE_ENDPOINTS, INTAKE_FALLBACK_EMAILS } from '../js/intake-config.js';

const ENDPOINTS = { hire: '/api/hire', sponsor: '/api/sponsor', speak: '/api/speak', dispatch: '/api/dispatch' };

const HIRE_VALUES = {
  name: 'Ayesha Khan',
  email: 'ayesha@example.pk',
  org: 'Systems Limited',
  role_sought: 'Platform security engineer',
  message: 'We are hiring two engineers in Lahore.',
};

/** Minimal fetch double: records the call and replays a canned response. */
function stubFetch(status, body, calls = []) {
  return {
    calls,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { status, json: async () => body };
    },
  };
}

describe('intake config — four routes, empty means fallback', () => {
  it('ships the four documented keys', () => {
    expect(Object.keys(INTAKE_ENDPOINTS)).toEqual(['hire', 'sponsor', 'speak', 'dispatch']);
    expect(INTAKE_KINDS).toEqual(['hire', 'sponsor', 'speak', 'dispatch']);
  });

  it('pairs every form with a fallback address and the documented route', () => {
    for (const kind of INTAKE_KINDS) {
      expect(INTAKE_FALLBACK_EMAILS[kind]).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(INTAKE_FORMS[kind].route).toBe(`/api/${kind}`);
    }
  });

  it('ships every form pointed at its real backend route, so direct submit is the primary path', () => {
    // mailto: is the labeled last resort, never the shipped default.
    for (const kind of INTAKE_KINDS) {
      expect(INTAKE_ENDPOINTS[kind]).toBe(`/api/${kind}`);
      expect(resolveIntakeTarget(kind)).toEqual({
        mode: 'endpoint',
        target: `/api/${kind}`,
        isFallback: false,
      });
    }
  });
});

describe('resolveIntakeTarget — endpoint or labeled fallback (Req 15.2, 19.3)', () => {
  it('uses the configured endpoint for each form', () => {
    for (const kind of INTAKE_KINDS) {
      const target = resolveIntakeTarget(kind, { endpoints: ENDPOINTS });
      expect(target).toEqual({ mode: 'endpoint', target: `/api/${kind}`, isFallback: false });
    }
  });

  it('falls back to a labeled mailto when that form has no endpoint', () => {
    const target = resolveIntakeTarget('dispatch', { endpoints: { ...ENDPOINTS, dispatch: '' } });
    expect(target.mode).toBe('mailto');
    expect(target.isFallback).toBe(true);
    expect(target.target).toBe(`mailto:${INTAKE_FALLBACK_EMAILS.dispatch}`);
    expect(target.label).toBeTruthy();
  });

  it('falls back to a labeled coming-soon state with no address at all', () => {
    const target = resolveIntakeTarget('speak', { endpoints: {}, mailto: '' });
    expect(target.mode).toBe('coming-soon');
    expect(target.isFallback).toBe(true);
    expect(target.label).toMatch(/coming soon/i);
    expect(target.target).toBeUndefined();
  });

  it('rejects an unknown form kind loudly', () => {
    expect(() => resolveIntakeTarget('newsletter')).toThrow(/unknown intake kind/i);
  });
});

describe('buildPayload — documented shapes plus anti-spam fields', () => {
  it('builds the hire payload with _hp empty and _t set', () => {
    const payload = buildPayload('hire', HIRE_VALUES, { renderedAt: 1700000000000 });
    expect(payload).toEqual({ ...HIRE_VALUES, _hp: '', _t: 1700000000000 });
  });

  it('omits an unfilled optional field and keeps a filled one', () => {
    const base = { name: 'A', email: 'a@b.pk', talk_title: 'eBPF 101', abstract: 'Tracing.' };
    expect(buildPayload('speak', { ...base, links: '' }, { now: () => 1 })).toEqual({
      ...base,
      _hp: '',
      _t: 1,
    });
    expect(buildPayload('speak', { ...base, links: 'https://example.pk/talk' }, { now: () => 1 }).links).toBe(
      'https://example.pk/talk',
    );
  });

  it('defaults the dispatch opt-in to false and never drops it', () => {
    expect(buildPayload('dispatch', { email: 'a@b.pk' }, { now: () => 5 })).toEqual({
      email: 'a@b.pk',
      optIn: false,
      _hp: '',
      _t: 5,
    });
    expect(buildPayload('dispatch', { email: 'a@b.pk', optIn: true }, { now: () => 5 }).optIn).toBe(true);
  });

  it('carries a filled honeypot through so the server can reject it', () => {
    const payload = buildPayload('hire', HIRE_VALUES, { honeypot: 'bot', now: () => 7 });
    expect(payload._hp).toBe('bot');
  });

  it('never mutates the supplied values', () => {
    const values = { ...HIRE_VALUES };
    buildPayload('hire', values, { now: () => 1 });
    expect(values).toEqual(HIRE_VALUES);
  });
});

describe('interpretResponse — the JSON response contract', () => {
  it('treats only 200 { ok: true } as success', () => {
    const result = interpretResponse(200, { ok: true });
    expect(result.state).toBe(INTAKE_STATES.SUCCESS);
    expect(result.ok).toBe(true);
  });

  it('never fabricates success from a 200 that does not confirm ok', () => {
    for (const body of [{}, { ok: false }, { ok: 'true' }, null]) {
      const result = interpretResponse(200, body);
      expect(result.ok).toBe(false);
      expect(result.state).not.toBe(INTAKE_STATES.SUCCESS);
      expect(result.canRetry).toBe(true);
    }
  });

  it('maps 400 to a field-level error with the offending field', () => {
    const result = interpretResponse(400, { ok: false, field: 'email', message: 'Enter a valid email address.' });
    expect(result.state).toBe(INTAKE_STATES.FIELD_ERROR);
    expect(result.field).toBe('email');
    expect(result.message).toBe('Enter a valid email address.');
  });

  it('maps 429 to a retryable rate-limited state', () => {
    const result = interpretResponse(429, { ok: false, message: 'rate limited' });
    expect(result.state).toBe(INTAKE_STATES.RATE_LIMITED);
    expect(result.canRetry).toBe(true);
  });

  it('maps 5xx to a retryable temporary error', () => {
    for (const status of [500, 502, 503]) {
      const result = interpretResponse(status, { ok: false, message: 'temporary error' });
      expect(result.state).toBe(INTAKE_STATES.SERVER_ERROR);
      expect(result.canRetry).toBe(true);
    }
  });

  it('falls back to its own copy when the server sends no message', () => {
    expect(interpretResponse(429, { ok: false }).message).toBe(INTAKE_MESSAGES.RATE_LIMITED);
    expect(interpretResponse(503, {}).message).toBe(INTAKE_MESSAGES.SERVER_ERROR);
  });

  it('replaces the contract status tokens with actionable copy', () => {
    // The backend sends "rate limited" / "temporary error" as contract text.
    expect(interpretResponse(429, { ok: false, message: 'rate limited' }).message).toBe(
      INTAKE_MESSAGES.RATE_LIMITED,
    );
    expect(interpretResponse(500, { ok: false, message: 'temporary error' }).message).toBe(
      INTAKE_MESSAGES.SERVER_ERROR,
    );
  });

  it('keeps the anti-spam rejection body as a form-level field error', () => {
    // The server returns field "form" for honeypot / min-fill-time rejections.
    const result = interpretResponse(400, {
      ok: false,
      field: 'form',
      message: 'Submission could not be accepted. Please reload the page and try again.',
    });
    expect(result.state).toBe(INTAKE_STATES.FIELD_ERROR);
    expect(result.field).toBe('form');
    expect(result.message).toMatch(/reload the page/i);
  });
});

describe('buildMailtoHref — a real route out, prefilled', () => {
  it('prefills subject and the entered values', () => {
    const href = buildMailtoHref('hire', HIRE_VALUES, INTAKE_FALLBACK_EMAILS.hire);
    expect(href.startsWith(`mailto:${INTAKE_FALLBACK_EMAILS.hire}?`)).toBe(true);
    expect(href).toContain('subject=');
    expect(decodeURIComponent(href)).toContain('name: Ayesha Khan');
  });

  it('accepts a mailto: prefixed target and an empty form', () => {
    const href = buildMailtoHref('dispatch', {}, 'mailto:hi@cloudnativesecurity.pk');
    expect(href.startsWith('mailto:hi@cloudnativesecurity.pk?')).toBe(true);
    expect(href).not.toContain('body=');
  });

  it('returns an empty href with no usable address', () => {
    expect(buildMailtoHref('hire', HIRE_VALUES, '')).toBe('');
  });
});

describe('submitIntake — posts, interprets, and preserves entered values', () => {
  it('posts JSON to the configured route and reports success', async () => {
    const { fetchImpl, calls } = stubFetch(200, { ok: true });
    const result = await submitIntake('hire', HIRE_VALUES, {
      endpoints: ENDPOINTS,
      fetchImpl,
      renderedAt: 1700000000000,
    });

    expect(result.state).toBe(INTAKE_STATES.SUCCESS);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/hire');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(calls[0].init.body)).toEqual({ ...HIRE_VALUES, _hp: '', _t: 1700000000000 });
  });

  it('rejects client-side without hitting the network and names the field', async () => {
    const { fetchImpl, calls } = stubFetch(200, { ok: true });
    const values = { ...HIRE_VALUES, email: 'not-an-email' };
    const result = await submitIntake('hire', values, { endpoints: ENDPOINTS, fetchImpl });

    expect(result.state).toBe(INTAKE_STATES.FIELD_ERROR);
    expect(result.field).toBe('email');
    expect(result.source).toBe('client');
    expect(calls).toHaveLength(0);
    expect(result.values).toEqual(values);
  });

  it('mirrors the validator: dispatch needs a selected opt-in', async () => {
    const { fetchImpl, calls } = stubFetch(200, { ok: true });
    const result = await submitIntake('dispatch', { email: 'a@b.pk', optIn: false }, {
      endpoints: ENDPOINTS,
      fetchImpl,
    });
    expect(result.state).toBe(INTAKE_STATES.FIELD_ERROR);
    expect(result.field).toBe('optIn');
    expect(calls).toHaveLength(0);
    expect(validateIntake('dispatch', { email: 'a@b.pk', optIn: true }).valid).toBe(true);
  });

  it('surfaces a server field error and preserves every entered value', async () => {
    const { fetchImpl } = stubFetch(400, { ok: false, field: 'org', message: 'Organization looks off.' });
    const result = await submitIntake('hire', HIRE_VALUES, { endpoints: ENDPOINTS, fetchImpl });

    expect(result.state).toBe(INTAKE_STATES.FIELD_ERROR);
    expect(result.field).toBe('org');
    expect(result.ok).toBe(false);
    expect(result.values).toEqual(HIRE_VALUES);
  });

  it('offers a retry on 429 and on 5xx, values intact', async () => {
    for (const status of [429, 500]) {
      const { fetchImpl } = stubFetch(status, { ok: false, message: 'later' });
      const result = await submitIntake('sponsor', {
        name: 'Bilal',
        email: 'bilal@example.pk',
        org: 'Acme',
        sponsorship_interest: 'Venue',
        message: 'Happy to host.',
      }, { endpoints: ENDPOINTS, fetchImpl });

      expect(result.ok).toBe(false);
      expect(result.canRetry).toBe(true);
      expect(result.values.email).toBe('bilal@example.pk');
    }
  });

  it('surfaces an honest error when the network fails', async () => {
    const result = await submitIntake('hire', HIRE_VALUES, {
      endpoints: ENDPOINTS,
      fetchImpl: async () => {
        throw new TypeError('Failed to fetch');
      },
    });

    expect(result.state).toBe(INTAKE_STATES.NETWORK_ERROR);
    expect(result.ok).toBe(false);
    expect(result.canRetry).toBe(true);
    expect(result.values).toEqual(HIRE_VALUES);
  });

  it('does not claim success when the response body is unparseable', async () => {
    const result = await submitIntake('hire', HIRE_VALUES, {
      endpoints: ENDPOINTS,
      fetchImpl: async () => ({
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.state).toBe(INTAKE_STATES.SERVER_ERROR);
  });

  it('returns the labeled mailto fallback instead of posting when unconfigured', async () => {
    const { fetchImpl, calls } = stubFetch(200, { ok: true });
    const result = await submitIntake('speak', {
      name: 'Sara',
      email: 'sara@example.pk',
      talk_title: 'Falco in production',
      abstract: 'Runtime detection.',
    }, { endpoints: { ...ENDPOINTS, speak: '' }, fetchImpl });

    expect(result.state).toBe(INTAKE_STATES.FALLBACK);
    expect(result.mode).toBe('mailto');
    expect(result.label).toBeTruthy();
    expect(result.mailtoHref).toContain(`mailto:${INTAKE_FALLBACK_EMAILS.speak}`);
    expect(calls).toHaveLength(0);
  });

  it('hands back the labeled fallback when a configured route is not deployed', async () => {
    for (const status of [404, 405]) {
      const { fetchImpl } = stubFetch(status, { message: 'Not found' });
      const result = await submitIntake('hire', HIRE_VALUES, { endpoints: ENDPOINTS, fetchImpl });

      expect(result.state).toBe(INTAKE_STATES.FALLBACK);
      expect(result.mode).toBe('mailto');
      expect(result.label).toBeTruthy();
      expect(result.mailtoHref).toContain(`mailto:${INTAKE_FALLBACK_EMAILS.hire}`);
      expect(result.values).toEqual(HIRE_VALUES);
    }
  });

  it('returns the coming-soon fallback with no mailto href', async () => {
    const result = await submitIntake('dispatch', { email: 'a@b.pk', optIn: true }, {
      endpoints: {},
      mailto: '',
    });
    expect(result.state).toBe(INTAKE_STATES.FALLBACK);
    expect(result.mode).toBe('coming-soon');
    expect(result.mailtoHref).toBeUndefined();
    expect(result.label).toMatch(/coming soon/i);
  });
});
