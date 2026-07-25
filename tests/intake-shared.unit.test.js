/**
 * Unit tests for the shared server-side intake helper (Task 12.3),
 * `functions/api/_shared.js`.
 *
 * Covers the JSON response contract, per-IP rate limiting (in-isolate and
 * KV-backed), the honeypot / minimum-fill-time anti-spam checks, secrets read
 * only from `env`, and the full request pipeline including the guarantee that
 * responses never echo secrets or the submitted body.
 *
 * Validates: Requirements 15.2, 2.4
 */
import { describe, it, expect } from 'vitest';
import {
  MIN_FILL_MS,
  RATE_LIMIT_MAX,
  MAX_BODY_BYTES,
  GENERIC_REJECTION,
  jsonResponse,
  okResponse,
  fieldErrorResponse,
  rateLimitedResponse,
  temporaryErrorResponse,
  getClientIp,
  createMemoryRateLimiter,
  createKvRateLimiter,
  resolveRateLimiter,
  checkAntiSpam,
  readSecret,
  checkSecrets,
  parseJsonBody,
  handleIntake,
} from '../functions/api/_shared.js';

/** A valid /api/hire payload, filled slowly enough to pass the time gate. */
function hirePayload(overrides = {}) {
  return {
    name: 'Ayesha Khan',
    email: 'ayesha@example.com',
    org: 'Acme Bank',
    role_sought: 'Cloud Security Engineer',
    message: 'We are hiring two DevSecOps engineers in Lahore.',
    _hp: '',
    _t: MIN_FILL_MS + 500, // client-computed elapsed ms
    ...overrides,
  };
}

function postRequest(body, { ip = '203.0.113.7', raw } = {}) {
  const text = raw !== undefined ? raw : JSON.stringify(body);
  return new Request('https://cloudnativesecurity.pk/api/hire', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip },
    body: text,
  });
}

/** An in-memory stand-in for a Cloudflare KV namespace binding. */
function fakeKv() {
  const store = new Map();
  return {
    store,
    async get(key, type) {
      const value = store.get(key);
      if (value === undefined) return null;
      return type === 'json' ? JSON.parse(value) : value;
    },
    async put(key, value) {
      store.set(key, value);
    },
  };
}

describe('response contract', () => {
  it('returns 200 { ok: true } with no-store JSON headers', async () => {
    const res = okResponse();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns 400 { ok: false, field, message }', async () => {
    const res = fieldErrorResponse('email', 'Enter a valid email address (local@domain).');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      field: 'email',
      message: 'Enter a valid email address (local@domain).',
    });
  });

  it('returns 429 { ok: false, message: "rate limited" } with Retry-After', async () => {
    const res = rateLimitedResponse(42);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('42');
    expect(await res.json()).toEqual({ ok: false, message: 'rate limited' });
  });

  it('returns 5xx { ok: false, message: "temporary error" }', async () => {
    const res = temporaryErrorResponse(503);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, message: 'temporary error' });
  });

  it('serializes an arbitrary body as JSON', async () => {
    expect(await jsonResponse(200, { a: 1 }).json()).toEqual({ a: 1 });
  });
});

describe('getClientIp', () => {
  it('prefers the edge-set CF-Connecting-IP header', () => {
    expect(getClientIp(postRequest(hirePayload(), { ip: '198.51.100.4' }))).toBe('198.51.100.4');
  });

  it('falls back to the first X-Forwarded-For hop', () => {
    const request = new Request('https://x/api/hire', {
      method: 'POST',
      headers: { 'X-Forwarded-For': '203.0.113.9, 70.41.3.18' },
    });
    expect(getClientIp(request)).toBe('203.0.113.9');
  });

  it('buckets an unidentifiable client rather than exempting it', () => {
    expect(getClientIp(new Request('https://x/api/hire'))).toBe('unknown');
    expect(getClientIp(undefined)).toBe('unknown');
  });
});

describe('createMemoryRateLimiter', () => {
  it('allows up to the max per window then blocks with a retry hint', async () => {
    const limiter = createMemoryRateLimiter({ max: 3, windowMs: 60000 });
    const now = 1_700_000_000_000;
    for (let i = 0; i < 3; i += 1) {
      expect((await limiter.check('ip', now + i)).allowed).toBe(true);
    }
    const blocked = await limiter.check('ip', now + 10);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('keys per IP so one abuser does not block everyone', async () => {
    const limiter = createMemoryRateLimiter({ max: 1, windowMs: 60000 });
    expect((await limiter.check('a', 0)).allowed).toBe(true);
    expect((await limiter.check('a', 1)).allowed).toBe(false);
    expect((await limiter.check('b', 1)).allowed).toBe(true);
  });

  it('resets once the window elapses', async () => {
    const limiter = createMemoryRateLimiter({ max: 1, windowMs: 1000 });
    expect((await limiter.check('ip', 0)).allowed).toBe(true);
    expect((await limiter.check('ip', 500)).allowed).toBe(false);
    expect((await limiter.check('ip', 1001)).allowed).toBe(true);
  });

  it('reports itself as non-durable (per-isolate only)', () => {
    expect(createMemoryRateLimiter().durable).toBe(false);
  });
});

describe('createKvRateLimiter', () => {
  it('counts across limiter instances through the shared store', async () => {
    const kv = fakeKv();
    const now = 1_700_000_000_000;
    const first = createKvRateLimiter(kv, { max: 2, windowMs: 60000 });
    const second = createKvRateLimiter(kv, { max: 2, windowMs: 60000 });
    expect((await first.check('ip', now)).allowed).toBe(true);
    expect((await second.check('ip', now + 1)).allowed).toBe(true);
    const blocked = await second.check('ip', now + 2);
    expect(blocked.allowed).toBe(false);
    expect(blocked.durable).toBe(true);
  });

  it('fails open and reports degradation when the store errors', async () => {
    const brokenKv = {
      get: async () => {
        throw new Error('kv down');
      },
      put: async () => {},
    };
    const limiter = createKvRateLimiter(brokenKv, { max: 1 });
    const result = await limiter.check('ip', 0);
    expect(result.allowed).toBe(true);
    expect(result.degraded).toBe(true);
  });

  it('is selected by resolveRateLimiter only when a KV binding exists', () => {
    expect(resolveRateLimiter({ RATE_LIMIT_KV: fakeKv() }).kind).toBe('kv');
    expect(resolveRateLimiter({}).kind).toBe('memory');
    expect(resolveRateLimiter(undefined).durable).toBe(false);
  });
});

describe('checkAntiSpam', () => {
  it('accepts an empty honeypot with enough elapsed time', () => {
    expect(checkAntiSpam({ _hp: '', _t: MIN_FILL_MS })).toEqual({ ok: true });
  });

  it('accepts a missing honeypot field', () => {
    expect(checkAntiSpam({ _t: MIN_FILL_MS + 1 }).ok).toBe(true);
  });

  it('rejects a filled honeypot', () => {
    expect(checkAntiSpam({ _hp: 'https://spam.example', _t: 60000 })).toEqual({
      ok: false,
      reason: 'honeypot',
    });
  });

  it('rejects a submission faster than the minimum fill time', () => {
    expect(checkAntiSpam({ _hp: '', _t: MIN_FILL_MS - 1 })).toEqual({
      ok: false,
      reason: 'too-fast',
    });
    expect(checkAntiSpam({ _hp: '', _t: 0 }).reason).toBe('too-fast');
  });

  it('enforces no maximum, so slow assistive-technology fills still pass', () => {
    const now = 1_700_000_000_000;
    const renderedTwoHoursAgo = now - 2 * 60 * 60 * 1000;
    expect(checkAntiSpam({ _hp: '', _t: renderedTwoHoursAgo }, { now }).ok).toBe(true);
    expect(checkAntiSpam({ _hp: '', _t: 45 * 60 * 1000 }, { now }).ok).toBe(true);
  });

  it('reads an epoch millisecond timestamp against the server clock', () => {
    const now = 1_700_000_000_000;
    expect(checkAntiSpam({ _t: now - (MIN_FILL_MS + 10) }, { now }).ok).toBe(true);
    expect(checkAntiSpam({ _t: now - 100 }, { now })).toEqual({ ok: false, reason: 'too-fast' });
  });

  it('tolerates a modestly fast client clock but not an absurd one', () => {
    const now = 1_700_000_000_000;
    expect(checkAntiSpam({ _t: now + 60_000 }, { now }).ok).toBe(true);
    expect(checkAntiSpam({ _t: now + 24 * 60 * 60 * 1000 }, { now })).toEqual({
      ok: false,
      reason: 'timestamp-future',
    });
  });

  it('accepts a numeric string timestamp and rejects unusable ones', () => {
    expect(checkAntiSpam({ _t: String(MIN_FILL_MS + 5) }).ok).toBe(true);
    for (const _t of [undefined, null, '', 'soon', NaN, -1, {}]) {
      expect(checkAntiSpam({ _t }).reason).toBe('timestamp-missing');
    }
    expect(checkAntiSpam(undefined).reason).toBe('timestamp-missing');
  });

  it('honors a caller-supplied minimum threshold', () => {
    expect(checkAntiSpam({ _t: 800 }, { minFillMs: 500 }).ok).toBe(true);
    expect(checkAntiSpam({ _t: 800 }, { minFillMs: 1000 }).reason).toBe('too-fast');
  });
});

describe('secrets', () => {
  it('reads only from the supplied env object', () => {
    expect(readSecret({ RESEND_API_KEY: 're_live_x' }, 'RESEND_API_KEY')).toBe('re_live_x');
    expect(readSecret({}, 'RESEND_API_KEY')).toBeUndefined();
    expect(readSecret(undefined, 'RESEND_API_KEY')).toBeUndefined();
  });

  it('treats blank values as unset', () => {
    expect(readSecret({ RESEND_API_KEY: '   ' }, 'RESEND_API_KEY')).toBeUndefined();
  });

  it('reports missing names only, never values', () => {
    const result = checkSecrets({ A: 'set' }, ['A', 'B']);
    expect(result).toEqual({ ok: false, missing: ['B'] });
    expect(checkSecrets({ A: 'set' }, [])).toEqual({ ok: true, missing: [] });
  });
});

describe('parseJsonBody', () => {
  it('parses a JSON object body', async () => {
    const result = await parseJsonBody(postRequest({ a: 1 }));
    expect(result).toEqual({ ok: true, values: { a: 1 } });
  });

  it('rejects malformed JSON, non-objects, and oversized bodies', async () => {
    expect((await parseJsonBody(postRequest(null, { raw: '{oops' }))).reason).toBe('body-not-json');
    expect((await parseJsonBody(postRequest([1, 2]))).reason).toBe('body-not-object');
    expect((await parseJsonBody(postRequest(null, { raw: 'null' }))).reason).toBe('body-not-object');
    const huge = JSON.stringify({ message: 'x'.repeat(MAX_BODY_BYTES + 10) });
    expect((await parseJsonBody(postRequest(null, { raw: huge }))).reason).toBe('body-too-large');
  });
});

describe('handleIntake pipeline', () => {
  const silentLogger = { events: [], event(name, details) { this.events.push({ name, ...details }); } };
  const newLogger = () => ({ events: [], event(name, details) { this.events.push({ name, ...details }); } });

  it('accepts a valid submission and invokes the delivery hook once', async () => {
    const calls = [];
    const res = await handleIntake(
      { request: postRequest(hirePayload()), env: { RESEND_API_KEY: 're_x' } },
      {
        form: 'hire',
        requiredSecrets: ['RESEND_API_KEY'],
        deliver: async (args) => {
          calls.push(args);
        },
        rateLimiter: createMemoryRateLimiter(),
        logger: newLogger(),
      },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].values.email).toBe('ayesha@example.com');
    expect(calls[0].ip).toBe('203.0.113.7');
  });

  it('re-validates every constraint server-side even when the client skipped it', async () => {
    const cases = [
      [hirePayload({ email: 'not-an-email' }), 'email'],
      [hirePayload({ name: '' }), 'name'],
      [hirePayload({ org: 'x'.repeat(201) }), 'org'],
      [hirePayload({ message: 'x'.repeat(1001) }), 'message'],
      [hirePayload({ role_sought: undefined }), 'role_sought'],
    ];
    for (const [payload, field] of cases) {
      const res = await handleIntake(
        { request: postRequest(payload), env: {} },
        { form: 'hire', rateLimiter: createMemoryRateLimiter(), logger: newLogger() },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.field).toBe(field);
      expect(typeof body.message).toBe('string');
    }
  });

  it('requires the dispatch opt-in to be selected', async () => {
    const base = { email: 'reader@example.com', _hp: '', _t: MIN_FILL_MS + 100 };
    const rejected = await handleIntake(
      { request: postRequest({ ...base, optIn: false }), env: {} },
      { form: 'dispatch', rateLimiter: createMemoryRateLimiter(), logger: newLogger() },
    );
    expect(rejected.status).toBe(400);
    expect((await rejected.json()).field).toBe('optIn');

    const accepted = await handleIntake(
      { request: postRequest({ ...base, optIn: true }), env: {} },
      { form: 'dispatch', rateLimiter: createMemoryRateLimiter(), logger: newLogger() },
    );
    expect(accepted.status).toBe(200);
  });

  it('rejects honeypot and too-fast submissions identically but logs them distinctly', async () => {
    const honeypotLog = newLogger();
    const fastLog = newLogger();
    const honeypot = await handleIntake(
      { request: postRequest(hirePayload({ _hp: 'bot' })), env: {} },
      { form: 'hire', rateLimiter: createMemoryRateLimiter(), logger: honeypotLog },
    );
    const tooFast = await handleIntake(
      { request: postRequest(hirePayload({ _t: 10 })), env: {} },
      { form: 'hire', rateLimiter: createMemoryRateLimiter(), logger: fastLog },
    );

    expect(honeypot.status).toBe(400);
    expect(tooFast.status).toBe(400);
    const honeypotBody = await honeypot.json();
    expect(honeypotBody).toEqual(await tooFast.json());
    expect(honeypotBody.field).toBe(GENERIC_REJECTION.field);

    expect(honeypotLog.events.some((e) => e.reason === 'honeypot')).toBe(true);
    expect(fastLog.events.some((e) => e.reason === 'too-fast')).toBe(true);
  });

  it('never runs the delivery hook for a rejected submission', async () => {
    let delivered = 0;
    await handleIntake(
      { request: postRequest(hirePayload({ _hp: 'bot' })), env: {} },
      {
        form: 'hire',
        deliver: () => {
          delivered += 1;
        },
        rateLimiter: createMemoryRateLimiter(),
        logger: newLogger(),
      },
    );
    expect(delivered).toBe(0);
  });

  it('rate limits a flood from one IP with 429', async () => {
    const rateLimiter = createMemoryRateLimiter({ max: RATE_LIMIT_MAX, windowMs: 60000 });
    const opts = { form: 'hire', rateLimiter, logger: newLogger() };
    for (let i = 0; i < RATE_LIMIT_MAX; i += 1) {
      const res = await handleIntake({ request: postRequest(hirePayload()), env: {} }, opts);
      expect(res.status).toBe(200);
    }
    const limited = await handleIntake({ request: postRequest(hirePayload()), env: {} }, opts);
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ ok: false, message: 'rate limited' });

    const otherIp = await handleIntake(
      { request: postRequest(hirePayload(), { ip: '198.51.100.99' }), env: {} },
      opts,
    );
    expect(otherIp.status).toBe(200);
  });

  it('returns a temporary error, with no detail, when a required secret is unset', async () => {
    const logger = newLogger();
    const res = await handleIntake(
      { request: postRequest(hirePayload()), env: {} },
      {
        form: 'hire',
        requiredSecrets: ['RESEND_API_KEY'],
        rateLimiter: createMemoryRateLimiter(),
        logger,
      },
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, message: 'temporary error' });
    expect(logger.events.some((e) => e.reason === 'secrets-missing')).toBe(true);
  });

  it('returns a temporary error when delivery throws or reports failure', async () => {
    const thrown = await handleIntake(
      { request: postRequest(hirePayload()), env: {} },
      {
        form: 'hire',
        deliver: () => {
          throw new Error('resend 500: key re_live_secret');
        },
        rateLimiter: createMemoryRateLimiter(),
        logger: newLogger(),
      },
    );
    expect(thrown.status).toBe(500);
    expect(await thrown.text()).toBe(JSON.stringify({ ok: false, message: 'temporary error' }));

    const reported = await handleIntake(
      { request: postRequest(hirePayload()), env: {} },
      {
        form: 'hire',
        deliver: async () => ({ ok: false, reason: 'upstream-503' }),
        rateLimiter: createMemoryRateLimiter(),
        logger: newLogger(),
      },
    );
    expect(reported.status).toBe(500);
  });

  it('never echoes secrets or submitted values in any response body', async () => {
    const env = { RESEND_API_KEY: 're_live_supersecret', ORGANIZER_INBOX: 'ops@example.com' };
    const payload = hirePayload({ message: 'confidential hiring plan' });
    const responses = await Promise.all([
      handleIntake(
        { request: postRequest(payload), env },
        { form: 'hire', rateLimiter: createMemoryRateLimiter(), logger: silentLogger },
      ),
      handleIntake(
        { request: postRequest(hirePayload({ email: 'bad', message: 'confidential hiring plan' })), env },
        { form: 'hire', rateLimiter: createMemoryRateLimiter(), logger: silentLogger },
      ),
      handleIntake(
        { request: postRequest(payload), env },
        {
          form: 'hire',
          rateLimiter: { check: async () => ({ allowed: false, retryAfterSeconds: 30 }) },
          logger: silentLogger,
        },
      ),
      handleIntake(
        { request: postRequest(payload), env: {} },
        {
          form: 'hire',
          requiredSecrets: ['RESEND_API_KEY'],
          rateLimiter: createMemoryRateLimiter(),
          logger: silentLogger,
        },
      ),
    ]);
    for (const res of responses) {
      const text = await res.text();
      expect(text).not.toContain('re_live_supersecret');
      expect(text).not.toContain('ops@example.com');
      expect(text).not.toContain('confidential hiring plan');
      expect(text).not.toContain('RESEND_API_KEY');
    }
  });

  it('rejects an unreadable body without leaking the reason to the client', async () => {
    const res = await handleIntake(
      { request: postRequest(null, { raw: '{not json' }), env: {} },
      { form: 'hire', rateLimiter: createMemoryRateLimiter(), logger: newLogger() },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      field: GENERIC_REJECTION.field,
      message: GENERIC_REJECTION.message,
    });
  });

  it('fails safe with a temporary error for an unknown form', async () => {
    const res = await handleIntake(
      { request: postRequest(hirePayload()), env: {} },
      { form: 'nope', rateLimiter: createMemoryRateLimiter(), logger: newLogger() },
    );
    expect(res.status).toBe(500);
  });
});
