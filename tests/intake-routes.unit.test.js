/**
 * Unit tests for the intake Pages Functions (Tasks 12.4 and 12.5):
 * `functions/api/hire.js`, `sponsor.js`, `speak.js`, `dispatch.js`, and the
 * one-click `unsubscribe.js`.
 *
 * Everything is exercised through the real handlers with a stubbed `fetch` and a
 * stubbed `env`, so the shared pipeline, the schema re-validation, the Resend
 * transport, and the KV storage path all run for real — only the network and the
 * KV binding are substituted.
 *
 * Each request uses a distinct client IP because the default rate limiter is a
 * process-wide in-isolate counter; per-IP isolation is covered in
 * `intake-shared.unit.test.js` and is not the subject here.
 *
 * Validates: Requirements 15.1, 15.2, 15.3, 19.1, 16.5, 16.6
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { onRequestPost as hirePost } from '../functions/api/hire.js';
import { onRequestPost as sponsorPost } from '../functions/api/sponsor.js';
import { onRequestPost as speakPost } from '../functions/api/speak.js';
import { onRequestPost as dispatchPost } from '../functions/api/dispatch.js';
import { onRequestGet as unsubscribeGet } from '../functions/api/unsubscribe.js';
import { RESEND_ENDPOINT, DEFAULT_NOTIFY_FROM } from '../functions/api/_notify.js';
import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  subscriberKey,
} from '../functions/api/_dispatch.js';
import { MIN_FILL_MS } from '../functions/api/_shared.js';

/** Values that must never appear in any response body. */
const API_KEY = 're_live_do_not_leak_me';
const ORGANIZER = 'ops-secret-inbox@example.com';
const TOKEN_SECRET = 'unsubscribe_signing_secret_value';

function notifyEnv(overrides = {}) {
  return {
    RESEND_API_KEY: API_KEY,
    ORGANIZER_INBOX: ORGANIZER,
    NOTIFY_FROM: 'CNSPK <noreply@cloudnativesecurity.pk>',
    ...overrides,
  };
}

function dispatchEnv(overrides = {}) {
  return { ...notifyEnv(), UNSUBSCRIBE_SECRET: TOKEN_SECRET, ...overrides };
}

/** Distinct IP per request so the shared in-isolate limiter never interferes. */
let ipCounter = 0;
function nextIp() {
  ipCounter += 1;
  return `203.0.113.${(ipCounter % 200) + 20}`;
}

function postRequest(route, body) {
  return new Request(`https://cloudnativesecurity.pk/api/${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': nextIp() },
    body: JSON.stringify(body),
  });
}

function getRequest(query = '') {
  return new Request(`https://cloudnativesecurity.pk/api/unsubscribe${query}`, {
    method: 'GET',
    headers: { 'CF-Connecting-IP': nextIp() },
  });
}

/** Anti-spam fields a real client stamps: empty honeypot, slow enough fill. */
const antiSpam = { _hp: '', _t: MIN_FILL_MS + 750 };

const SUBASK_ROUTES = [
  {
    route: 'hire',
    handler: hirePost,
    payload: {
      name: 'Ayesha Khan',
      email: 'ayesha@example.com',
      org: 'Acme Bank',
      role_sought: 'Cloud Security Engineer',
      message: 'We are hiring two DevSecOps engineers in Lahore.',
      ...antiSpam,
    },
    expectInBody: ['Role sought: Cloud Security Engineer', 'Hire request'],
  },
  {
    route: 'sponsor',
    handler: sponsorPost,
    payload: {
      name: 'Bilal Ahmed',
      email: 'bilal@example.com',
      org: 'Northwind Cloud',
      sponsorship_interest: 'Venue for the Lahore meetup',
      message: 'We can host 120 people and cover catering.',
      ...antiSpam,
    },
    expectInBody: ['Sponsorship interest: Venue for the Lahore meetup', 'Sponsorship enquiry'],
  },
  {
    route: 'speak',
    handler: speakPost,
    payload: {
      name: 'Sana Iqbal',
      email: 'sana@example.com',
      talk_title: 'Falco rules that survive production',
      abstract: 'Lessons from tuning runtime detection on a 200-node cluster.',
      ...antiSpam,
    },
    expectInBody: ['Talk title: Falco rules that survive production', 'Speaker proposal'],
  },
];

/** An in-memory stand-in for a Cloudflare KV namespace binding. */
function fakeKv(initial = {}) {
  const store = new Map(Object.entries(initial));
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
    async delete(key) {
      store.delete(key);
    },
  };
}

/** A `fetch` stub that records calls and returns a chosen status. */
function fetchStub(status = 200) {
  return vi.fn(async () => ({ ok: status >= 200 && status < 300, status, text: async () => 'upstream detail' }));
}

let fetchMock;

beforeEach(() => {
  fetchMock = fetchStub(200);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The JSON body sent to Resend on the nth call. */
function sentPayload(call = 0) {
  return JSON.parse(fetchMock.mock.calls[call][1].body);
}

describe.each(SUBASK_ROUTES)('/api/$route', ({ route, handler, payload, expectInBody }) => {
  it('accepts a valid submission and notifies the organizer inbox', async () => {
    const res = await handler({ request: postRequest(route, payload), env: notifyEnv() });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(RESEND_ENDPOINT);
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe(`Bearer ${API_KEY}`);

    const sent = sentPayload();
    expect(sent.to).toEqual([ORGANIZER]);
    expect(sent.reply_to).toBe(payload.email);
    for (const fragment of expectInBody) {
      expect(`${sent.subject}\n${sent.text}`).toContain(fragment);
    }
    // Anti-spam plumbing is never forwarded to a human.
    expect(sent.text).not.toContain('_hp');
    expect(sent.text).not.toContain('_t:');
  });

  it('falls back to the default verified sender when NOTIFY_FROM is unset', async () => {
    const env = notifyEnv();
    delete env.NOTIFY_FROM;
    const res = await handler({ request: postRequest(route, payload), env });
    expect(res.status).toBe(200);
    expect(sentPayload().from).toBe(DEFAULT_NOTIFY_FROM);
  });

  it.each(['RESEND_API_KEY', 'ORGANIZER_INBOX'])(
    'returns an opaque temporary error when %s is unset, without attempting a send',
    async (secretName) => {
      const env = notifyEnv();
      delete env[secretName];

      const res = await handler({ request: postRequest(route, payload), env });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ ok: false, message: 'temporary error' });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('returns a temporary error when the email API rejects the send', async () => {
    fetchMock = fetchStub(422);
    vi.stubGlobal('fetch', fetchMock);

    const res = await handler({ request: postRequest(route, payload), env: notifyEnv() });
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(JSON.parse(text)).toEqual({ ok: false, message: 'temporary error' });
    expect(text).not.toContain('upstream detail');
    expect(text).not.toContain('422');
  });

  it('returns a temporary error when the email API is unreachable', async () => {
    fetchMock = vi.fn(async () => {
      throw new Error(`connect ECONNREFUSED with Bearer ${API_KEY}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await handler({ request: postRequest(route, payload), env: notifyEnv() });
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain(API_KEY);
  });

  it('rejects an invalid field server-side and never sends', async () => {
    const res = await handler({
      request: postRequest(route, { ...payload, email: 'not-an-email' }),
      env: notifyEnv(),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.field).toBe('email');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('/api/dispatch', () => {
  const signup = { email: 'Reader@Example.com', optIn: true, ...antiSpam };

  it('rejects a signup without the opt-in selected, on the optIn field', async () => {
    const kv = fakeKv();
    const res = await dispatchPost({
      request: postRequest('dispatch', { ...signup, optIn: false }),
      env: dispatchEnv({ DISPATCH_KV: kv }),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).field).toBe('optIn');
    expect(kv.store.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a missing opt-in and a malformed email alike, without storing anything', async () => {
    const kv = fakeKv();
    const env = dispatchEnv({ DISPATCH_KV: kv });

    const noOptIn = await dispatchPost({
      request: postRequest('dispatch', { email: 'reader@example.com', ...antiSpam }),
      env,
    });
    expect(noOptIn.status).toBe(400);
    expect((await noOptIn.json()).field).toBe('optIn');

    const badEmail = await dispatchPost({
      request: postRequest('dispatch', { email: 'reader-at-example', optIn: true, ...antiSpam }),
      env,
    });
    expect(badEmail.status).toBe(400);
    expect((await badEmail.json()).field).toBe('email');

    expect(kv.store.size).toBe(0);
  });

  it('appends the subscriber to KV keyed by the lowercased email', async () => {
    const kv = fakeKv();
    const res = await dispatchPost({
      request: postRequest('dispatch', signup),
      env: dispatchEnv({ DISPATCH_KV: kv }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const key = subscriberKey('reader@example.com');
    expect([...kv.store.keys()]).toEqual([key]);

    const record = JSON.parse(kv.store.get(key));
    expect(record.email).toBe('reader@example.com');
    expect(record.optIn).toBe(true);
    expect(Number.isNaN(Date.parse(record.subscribedAt))).toBe(false);
    expect(record.unsubscribeUrl).toContain('/api/unsubscribe?token=');

    // The stored token is a real, verifiable one-click token for this address.
    await expect(verifyUnsubscribeToken(record.unsubscribeToken, TOKEN_SECRET)).resolves.toEqual({
      ok: true,
      email: 'reader@example.com',
    });

    // KV storage sends no email at all: no welcome, no confirmation, no drip.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is idempotent on re-signup and preserves the original consent date', async () => {
    const kv = fakeKv();
    const env = dispatchEnv({ DISPATCH_KV: kv });

    await dispatchPost({ request: postRequest('dispatch', signup), env });
    const first = JSON.parse(kv.store.get(subscriberKey('reader@example.com')));

    await dispatchPost({ request: postRequest('dispatch', signup), env });
    const second = JSON.parse(kv.store.get(subscriberKey('reader@example.com')));

    expect(kv.store.size).toBe(1);
    expect(second.subscribedAt).toBe(first.subscribedAt);
  });

  it('returns a temporary error when the store write fails, so nothing is silently dropped', async () => {
    const brokenKv = {
      get: async () => null,
      put: async () => {
        throw new Error('kv unavailable');
      },
      delete: async () => {},
    };

    const res = await dispatchPost({
      request: postRequest('dispatch', signup),
      env: dispatchEnv({ DISPATCH_KV: brokenKv }),
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, message: 'temporary error' });
  });

  it('forwards the signup to the organizer inbox when no list backend is bound', async () => {
    const res = await dispatchPost({
      request: postRequest('dispatch', signup),
      env: dispatchEnv(),
    });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const sent = sentPayload();
    expect(sent.to).toEqual([ORGANIZER]);
    expect(sent.text).toContain('reader@example.com');
    expect(sent.text).toContain('/api/unsubscribe?token=');
    // The notification goes to the organizer, never to the subscriber.
    expect(sent.to).not.toContain('reader@example.com');
  });

  it('requires the unsubscribe signing secret before accepting a signup', async () => {
    for (const env of [dispatchEnv({ UNSUBSCRIBE_SECRET: undefined }), dispatchEnv({ UNSUBSCRIBE_SECRET: undefined, DISPATCH_KV: fakeKv() })]) {
      const res = await dispatchPost({ request: postRequest('dispatch', signup), env });
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ ok: false, message: 'temporary error' });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires the email credentials on the notify fallback path', async () => {
    const env = dispatchEnv();
    delete env.RESEND_API_KEY;
    const res = await dispatchPost({ request: postRequest('dispatch', signup), env });
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('/api/unsubscribe', () => {
  async function seededKv(email = 'reader@example.com') {
    const token = await createUnsubscribeToken(email, TOKEN_SECRET);
    const kv = fakeKv({
      [subscriberKey(email)]: JSON.stringify({ email, optIn: true, unsubscribeToken: token }),
    });
    return { kv, token };
  }

  it('removes the subscriber for a valid token and confirms in plain text', async () => {
    const { kv, token } = await seededKv();

    const res = await unsubscribeGet({
      request: getRequest(`?token=${encodeURIComponent(token)}`),
      env: dispatchEnv({ DISPATCH_KV: kv }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/plain/);
    const text = await res.text();
    expect(text).toContain('unsubscribed');
    expect(text).toContain('reader@example.com');
    expect(kv.store.size).toBe(0);
  });

  it('confirms again when the subscriber is already gone', async () => {
    const token = await createUnsubscribeToken('reader@example.com', TOKEN_SECRET);
    const kv = fakeKv();

    const res = await unsubscribeGet({
      request: getRequest(`?token=${encodeURIComponent(token)}`),
      env: dispatchEnv({ DISPATCH_KV: kv }),
    });

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('unsubscribed');
  });

  it('rejects a tampered token and leaves the subscriber in place', async () => {
    const { kv, token } = await seededKv();
    const [payload, signature] = token.split('.');
    const forgedEmailPayload = `${btoa('attacker@example.com').replace(/=+$/, '')}.${signature}`;

    const tampered = [
      `${payload}.${signature.slice(0, -2)}AA`, // resigned body
      forgedEmailPayload, // swapped email, original signature
      `${payload}`, // signature stripped
      'not-a-token',
      '',
    ];

    for (const candidate of tampered) {
      const res = await unsubscribeGet({
        request: getRequest(`?token=${encodeURIComponent(candidate)}`),
        env: dispatchEnv({ DISPATCH_KV: kv }),
      });
      expect(res.status).toBe(400);
      expect(await res.text()).toContain('not valid');
    }

    expect(kv.store.size).toBe(1);
  });

  it('rejects a request with no token at all', async () => {
    const { kv } = await seededKv();
    const res = await unsubscribeGet({ request: getRequest(), env: dispatchEnv({ DISPATCH_KV: kv }) });
    expect(res.status).toBe(400);
    expect(kv.store.size).toBe(1);
  });

  it('reports a temporary error when the signing secret is unset', async () => {
    const { kv, token } = await seededKv();
    const env = dispatchEnv({ DISPATCH_KV: kv });
    delete env.UNSUBSCRIBE_SECRET;

    const res = await unsubscribeGet({
      request: getRequest(`?token=${encodeURIComponent(token)}`),
      env,
    });

    expect(res.status).toBe(500);
    expect(await res.text()).toContain('Temporary error');
    expect(kv.store.size).toBe(1);
  });

  it('hands the removal to a human when no list backend is bound', async () => {
    const token = await createUnsubscribeToken('reader@example.com', TOKEN_SECRET);

    const res = await unsubscribeGet({
      request: getRequest(`?token=${encodeURIComponent(token)}`),
      env: dispatchEnv(),
    });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = sentPayload();
    expect(sent.to).toEqual([ORGANIZER]);
    expect(sent.text).toContain('reader@example.com');
  });

  it('does not claim success when the hand-off itself fails', async () => {
    fetchMock = fetchStub(500);
    vi.stubGlobal('fetch', fetchMock);
    const token = await createUnsubscribeToken('reader@example.com', TOKEN_SECRET);

    const res = await unsubscribeGet({
      request: getRequest(`?token=${encodeURIComponent(token)}`),
      env: dispatchEnv(),
    });

    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('unsubscribed');
  });
});

describe('no response ever carries a secret', () => {
  it('keeps credentials, env var names, and upstream detail out of every body', async () => {
    const kv = fakeKv();
    const env = dispatchEnv({ DISPATCH_KV: kv });
    const validToken = await createUnsubscribeToken('reader@example.com', TOKEN_SECRET);

    const failing = fetchStub(503);
    vi.stubGlobal('fetch', failing);

    const responses = await Promise.all([
      hirePost({ request: postRequest('hire', SUBASK_ROUTES[0].payload), env: notifyEnv() }),
      hirePost({ request: postRequest('hire', SUBASK_ROUTES[0].payload), env: {} }),
      sponsorPost({ request: postRequest('sponsor', SUBASK_ROUTES[1].payload), env: notifyEnv() }),
      speakPost({
        request: postRequest('speak', { ...SUBASK_ROUTES[2].payload, email: 'bad' }),
        env: notifyEnv(),
      }),
      dispatchPost({ request: postRequest('dispatch', { email: 'reader@example.com', optIn: true, ...antiSpam }), env }),
      dispatchPost({ request: postRequest('dispatch', { email: 'reader@example.com', optIn: false, ...antiSpam }), env }),
      unsubscribeGet({ request: getRequest(`?token=${encodeURIComponent(validToken)}`), env }),
      unsubscribeGet({ request: getRequest('?token=forged'), env }),
    ]);

    for (const res of responses) {
      const text = await res.text();
      for (const forbidden of [
        API_KEY,
        ORGANIZER,
        TOKEN_SECRET,
        'RESEND_API_KEY',
        'ORGANIZER_INBOX',
        'UNSUBSCRIBE_SECRET',
        'DISPATCH_KV',
        'upstream detail',
        'Bearer',
      ]) {
        expect(text).not.toContain(forbidden);
      }
    }
  });
});
