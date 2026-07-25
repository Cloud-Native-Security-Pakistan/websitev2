/**
 * functions/api/_shared.js — shared server-side intake helper for the CNSPK
 * Cloudflare Pages Functions (`/api/hire`, `/api/sponsor`, `/api/speak`,
 * `/api/dispatch`).
 *
 * Runtime: the Cloudflare Workers runtime (V8 isolates, Web APIs only —
 * `Request`, `Response`, `fetch`, `crypto.subtle`). There are no Node built-ins
 * here: no `fs`, no `path`, no `Buffer`, and no `process.env`. Secrets arrive
 * exclusively through the `env` argument that Pages passes to the handler, so
 * nothing secret can ever reach the client bundle.
 *
 * The four route files stay thin:
 *
 *   import { handleIntake } from './_shared.js';
 *   export const onRequestPost = (context) =>
 *     handleIntake(context, {
 *       form: 'hire',
 *       requiredSecrets: ['RESEND_API_KEY', 'ORGANIZER_INBOX'],
 *       deliver: async ({ values, env }) => { ...notify organizer... },
 *     });
 *
 * Validation is NOT re-implemented here. This module imports the single source
 * of truth, `js/lib/intake-validation.js`, which is a dependency-free ES module
 * that runs unchanged in the browser, in Node under vitest, and in the Workers
 * runtime (Pages bundles the relative import at build time). Client-side
 * validation is a courtesy; this module is the gate.
 *
 * Response contract (identical for all four routes):
 *   200 { ok: true }
 *   400 { ok: false, field: "<invalid field>", message: "<reason>" }
 *   429 { ok: false, message: "rate limited" }
 *   5xx { ok: false, message: "temporary error" }
 *
 * Nothing else is ever returned to the client: no secrets, no environment
 * values, no echo of the submitted body, no internal error text.
 *
 * Validates: Requirements 15.2, 2.4
 */

import { SCHEMAS, validateSubmission } from '../../js/lib/intake-validation.js';

/* ------------------------------------------------------------------ *
 * Tunables
 * ------------------------------------------------------------------ */

/**
 * Minimum time a legitimate human needs between the form rendering and the
 * submission arriving. 3 seconds: comfortably below the fastest realistic
 * human fill (even a paste-and-submit), comfortably above a scripted POST that
 * fires immediately after fetching the page.
 *
 * There is deliberately **no maximum**. Screen-reader, switch-access, and
 * translation users routinely take minutes on a form; a maximum would lock
 * them out, so only the floor is enforced.
 */
export const MIN_FILL_MS = 3000;

/**
 * Timestamps this large are interpreted as epoch milliseconds (1e12 ms is
 * 2001-09-09), anything smaller as a client-computed elapsed duration.
 */
const EPOCH_THRESHOLD_MS = 1e12;

/**
 * Tolerance for client clock skew when `_t` is an epoch timestamp. A client
 * clock running ahead makes the elapsed time look negative; up to 5 minutes of
 * skew is treated as "unknown, allow" rather than as spam, because punishing a
 * wrong wall clock punishes a real person.
 */
export const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

/** Per-IP rate limit defaults: 5 submissions per 60s window. */
export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_MS = 60 * 1000;

/** Hard ceiling on the request body, well above the largest valid submission. */
export const MAX_BODY_BYTES = 16 * 1024;

/** Anti-spam field names shared with the client. */
export const HONEYPOT_FIELD = '_hp';
export const TIMESTAMP_FIELD = '_t';

/**
 * A rejection that must not tell an abuser which heuristic tripped. Both the
 * honeypot and the min-fill-time failure return exactly this, so the response
 * carries no signal. The distinguishing reason goes to the log instead.
 */
export const GENERIC_REJECTION = Object.freeze({
  field: 'form',
  message: 'Submission could not be accepted. Please reload the page and try again.',
});

/* ------------------------------------------------------------------ *
 * Response builders — the JSON contract
 * ------------------------------------------------------------------ */

const JSON_HEADERS = Object.freeze({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
});

/**
 * Build a JSON response with the contract's headers.
 * @param {number} status
 * @param {object} body
 * @param {Record<string, string>} [extraHeaders]
 * @returns {Response}
 */
export function jsonResponse(status, body, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...(extraHeaders || {}) },
  });
}

/** 200 { ok: true } */
export function okResponse() {
  return jsonResponse(200, { ok: true });
}

/** 400 { ok: false, field, message } */
export function fieldErrorResponse(field, message) {
  return jsonResponse(400, { ok: false, field, message });
}

/** 400 with the non-attributable anti-spam rejection body. */
export function rejectedResponse() {
  return fieldErrorResponse(GENERIC_REJECTION.field, GENERIC_REJECTION.message);
}

/** 429 { ok: false, message: "rate limited" } */
export function rateLimitedResponse(retryAfterSeconds) {
  const headers =
    Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? { 'retry-after': String(Math.ceil(retryAfterSeconds)) }
      : undefined;
  return jsonResponse(429, { ok: false, message: 'rate limited' }, headers);
}

/** 5xx { ok: false, message: "temporary error" } */
export function temporaryErrorResponse(status = 500) {
  return jsonResponse(status, { ok: false, message: 'temporary error' });
}

/* ------------------------------------------------------------------ *
 * Client identity
 * ------------------------------------------------------------------ */

/**
 * The client IP as Cloudflare sees it. `CF-Connecting-IP` is set by the edge
 * and cannot be spoofed by the client; `X-Forwarded-For` is only a local-dev
 * courtesy and its first hop is used. Falls back to a constant bucket so an
 * unknown origin is still limited rather than unlimited.
 * @param {Request} request
 * @returns {string}
 */
export function getClientIp(request) {
  const headers = request && request.headers;
  if (!headers || typeof headers.get !== 'function') return 'unknown';
  const cf = headers.get('CF-Connecting-IP');
  if (cf && cf.trim()) return cf.trim();
  const xff = headers.get('X-Forwarded-For');
  if (xff && xff.trim()) return xff.split(',')[0].trim();
  return 'unknown';
}

/* ------------------------------------------------------------------ *
 * Rate limiting — pluggable, with an honest in-isolate default
 * ------------------------------------------------------------------ */

/**
 * A rate limiter is any object shaped:
 *   { durable: boolean, check(key, now) => Promise<{ allowed, retryAfterSeconds }> }
 *
 * In-isolate limiter: a fixed window counter held in this isolate's memory.
 *
 * HONEST LIMITATION — this is NOT durable. Cloudflare runs many isolates across
 * many colos and recycles them freely, so an attacker distributing requests
 * across isolates sees the limit multiplied, and every eviction resets the
 * counters. It raises the cost of a naive flood and nothing more. Robust
 * limiting needs a shared store: bind a KV namespace as `RATE_LIMIT_KV` (see
 * `createKvRateLimiter`) or, for exact counting, a Durable Object. Until a
 * binding exists, rate limiting is best-effort by design — which is why it is
 * never the only protection (honeypot, min-fill-time, and full server-side
 * validation all run independently).
 *
 * @param {{ max?: number, windowMs?: number }} [options]
 */
export function createMemoryRateLimiter(options = {}) {
  const max = options.max ?? RATE_LIMIT_MAX;
  const windowMs = options.windowMs ?? RATE_LIMIT_WINDOW_MS;
  /** @type {Map<string, { count: number, resetAt: number }>} */
  const buckets = new Map();

  return {
    durable: false,
    kind: 'memory',
    async check(key, now = Date.now()) {
      // Opportunistic sweep so a long-lived isolate cannot grow unbounded.
      if (buckets.size > 5000) {
        for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      }
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: max - 1, durable: false };
      }
      if (bucket.count >= max) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
          durable: false,
        };
      }
      bucket.count += 1;
      return { allowed: true, remaining: max - bucket.count, durable: false };
    },
  };
}

/**
 * KV-backed limiter, used when a `RATE_LIMIT_KV` namespace is bound.
 *
 * HONEST LIMITATION — KV is eventually consistent and this read-modify-write is
 * not atomic, so concurrent bursts can under-count. It is still far better than
 * per-isolate memory because the window survives isolate churn and is shared
 * across colos after propagation. Exact counting requires a Durable Object.
 * If KV itself errors, the request is allowed through (fail-open) so a storage
 * blip cannot take intake down; the degradation is reported, never hidden.
 *
 * @param {{ get: Function, put: Function }} kv
 * @param {{ max?: number, windowMs?: number, prefix?: string }} [options]
 */
export function createKvRateLimiter(kv, options = {}) {
  const max = options.max ?? RATE_LIMIT_MAX;
  const windowMs = options.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const prefix = options.prefix ?? 'rl:intake:';
  // KV enforces a 60s minimum TTL.
  const ttlSeconds = Math.max(60, Math.ceil(windowMs / 1000));

  return {
    durable: true,
    kind: 'kv',
    async check(key, now = Date.now()) {
      const storageKey = prefix + key;
      let record = null;
      try {
        record = await kv.get(storageKey, 'json');
      } catch {
        return { allowed: true, degraded: true, durable: true };
      }

      const fresh = record && typeof record.resetAt === 'number' && record.resetAt > now;
      const next = fresh
        ? { count: record.count + 1, resetAt: record.resetAt }
        : { count: 1, resetAt: now + windowMs };

      if (fresh && record.count >= max) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.ceil((record.resetAt - now) / 1000),
          durable: true,
        };
      }

      try {
        await kv.put(storageKey, JSON.stringify(next), { expirationTtl: ttlSeconds });
      } catch {
        return { allowed: true, degraded: true, durable: true };
      }
      return { allowed: true, remaining: max - next.count, durable: true };
    },
  };
}

/** Process-wide default so repeated requests in one isolate share a window. */
const defaultMemoryLimiter = createMemoryRateLimiter();

/**
 * Pick the best available limiter for this environment: the KV-backed one when
 * a `RATE_LIMIT_KV` namespace is bound, otherwise the in-isolate default.
 * @param {Record<string, unknown>} [env]
 */
export function resolveRateLimiter(env) {
  const kv = env && env.RATE_LIMIT_KV;
  if (kv && typeof kv.get === 'function' && typeof kv.put === 'function') {
    return createKvRateLimiter(kv);
  }
  return defaultMemoryLimiter;
}

/* ------------------------------------------------------------------ *
 * Anti-spam
 * ------------------------------------------------------------------ */

/**
 * Honeypot + minimum-fill-time check.
 *
 * `_hp` is a visually hidden, `aria-hidden`, `tabindex="-1"` input that no real
 * user (including assistive-technology users) reaches; any value means a bot.
 *
 * `_t` is the render timestamp stamped by the client. It is accepted in two
 * shapes: epoch milliseconds (values ≥ 1e12) or a client-computed elapsed
 * duration in milliseconds. The elapsed form is preferred because it is immune
 * to wall-clock skew. Only a MINIMUM elapsed time is enforced — never a
 * maximum — so slow, careful, or assistive-technology-assisted fills always
 * pass.
 *
 * @param {Record<string, unknown>} payload
 * @param {{ now?: number, minFillMs?: number }} [options]
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function checkAntiSpam(payload, options = {}) {
  const now = options.now ?? Date.now();
  const minFillMs = options.minFillMs ?? MIN_FILL_MS;
  const values = payload && typeof payload === 'object' ? payload : {};

  const honeypot = values[HONEYPOT_FIELD];
  if (honeypot !== undefined && honeypot !== null && String(honeypot) !== '') {
    return { ok: false, reason: 'honeypot' };
  }

  const raw = values[TIMESTAMP_FIELD];
  // A blank string is "not sent", not "sent as zero".
  const stamp = typeof raw === 'string' ? (raw.trim() === '' ? NaN : Number(raw)) : raw;
  if (typeof stamp !== 'number' || !Number.isFinite(stamp) || stamp < 0) {
    return { ok: false, reason: 'timestamp-missing' };
  }

  let elapsed;
  if (stamp >= EPOCH_THRESHOLD_MS) {
    elapsed = now - stamp;
    // Clock running ahead: unknowable elapsed time, so allow within tolerance.
    if (elapsed < 0) {
      return elapsed >= -CLOCK_SKEW_TOLERANCE_MS
        ? { ok: true }
        : { ok: false, reason: 'timestamp-future' };
    }
  } else {
    elapsed = stamp;
  }

  if (elapsed < minFillMs) {
    return { ok: false, reason: 'too-fast' };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Secrets — env only, never echoed
 * ------------------------------------------------------------------ */

/**
 * Read a secret from the Pages environment. The `env` argument is the only
 * source: there is no `process.env` in this runtime and no bundled constant, so
 * a secret cannot leak into the client bundle.
 * @param {Record<string, unknown>} env
 * @param {string} name
 * @returns {string | undefined}
 */
export function readSecret(env, name) {
  if (!env || typeof env !== 'object') return undefined;
  const value = env[name];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/**
 * Report which of the required secrets are absent. Returns names only — never
 * values — so the result is safe to log.
 * @param {Record<string, unknown>} env
 * @param {string[]} names
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function checkSecrets(env, names) {
  const missing = (names || []).filter((name) => readSecret(env, name) === undefined);
  return { ok: missing.length === 0, missing };
}

/* ------------------------------------------------------------------ *
 * Body parsing
 * ------------------------------------------------------------------ */

/**
 * Read and parse the JSON request body under a size ceiling.
 * @param {Request} request
 * @param {{ maxBytes?: number }} [options]
 * @returns {Promise<{ ok: true, values: object } | { ok: false, reason: string }>}
 */
export async function parseJsonBody(request, options = {}) {
  const maxBytes = options.maxBytes ?? MAX_BODY_BYTES;

  const declared = Number(request.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, reason: 'body-too-large' };
  }

  let text;
  try {
    text = await request.text();
  } catch {
    return { ok: false, reason: 'body-unreadable' };
  }
  if (text.length > maxBytes) {
    return { ok: false, reason: 'body-too-large' };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'body-not-json' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'body-not-object' };
  }
  return { ok: true, values: parsed };
}

/* ------------------------------------------------------------------ *
 * Logging — reasons, never payloads
 * ------------------------------------------------------------------ */

/**
 * Default logger. Records the route, the outcome, and the reason so honeypot
 * and min-fill-time rejections stay distinguishable in logs even though the
 * response to the client is identical. It never logs field values, the request
 * body, or any secret.
 */
export const defaultLogger = {
  event(name, details) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ event: name, ...details }));
  },
};

/* ------------------------------------------------------------------ *
 * The shared request pipeline
 * ------------------------------------------------------------------ */

/**
 * Run the shared intake pipeline for one Pages Function.
 *
 * Order of operations — cheapest and most protective first:
 *   1. rate limit by IP            → 429
 *   2. parse the JSON body         → 400 (generic)
 *   3. honeypot + min-fill-time    → 400 (generic, indistinguishable)
 *   4. full schema re-validation   → 400 with the offending field
 *   5. required secrets present    → 5xx (never says which secret)
 *   6. `deliver` side effect       → 5xx on any throw or falsy `ok`
 *   7. success                     → 200 { ok: true }
 *
 * @param {{ request: Request, env?: Record<string, unknown> }} context
 *   The Pages Function context (`{ request, env }`).
 * @param {{
 *   form: string,
 *   schema?: object,
 *   requiredSecrets?: string[],
 *   deliver?: (args: { values: object, env: object, request: Request, ip: string }) => unknown,
 *   rateLimiter?: { check: Function, durable?: boolean },
 *   minFillMs?: number,
 *   now?: number,
 *   logger?: { event: Function },
 * }} options
 * @returns {Promise<Response>}
 */
export async function handleIntake(context, options) {
  const { request, env = {} } = context || {};
  const {
    form,
    schema = SCHEMAS[form],
    requiredSecrets = [],
    deliver,
    rateLimiter = resolveRateLimiter(env),
    minFillMs = MIN_FILL_MS,
    now,
    logger = defaultLogger,
  } = options || {};

  const log = (outcome, details) => {
    try {
      logger.event('intake', { form, outcome, ...(details || {}) });
    } catch {
      /* logging must never fail a request */
    }
  };

  if (!schema) {
    log('error', { reason: 'schema-missing' });
    return temporaryErrorResponse();
  }

  const ip = getClientIp(request);

  try {
    // 1. Rate limit.
    const limit = await rateLimiter.check(ip, now ?? Date.now());
    if (limit && limit.allowed === false) {
      log('rate-limited', { durable: Boolean(limit.durable) });
      return rateLimitedResponse(limit.retryAfterSeconds);
    }
    if (limit && limit.degraded) {
      log('rate-limit-degraded', { reason: 'store-unavailable' });
    }

    // 2. Body.
    const body = await parseJsonBody(request);
    if (!body.ok) {
      log('rejected', { reason: body.reason });
      return rejectedResponse();
    }

    // 3. Anti-spam. Same response either way; the reason only reaches the log.
    const antiSpam = checkAntiSpam(body.values, { now, minFillMs });
    if (!antiSpam.ok) {
      log('rejected', { reason: antiSpam.reason });
      return rejectedResponse();
    }

    // 4. Re-validate every constraint with the shared validator.
    const validation = validateSubmission(body.values, schema);
    if (!validation.valid) {
      log('invalid', { field: validation.field });
      return fieldErrorResponse(validation.field, validation.message);
    }

    // 5. Configuration. The client is told "temporary error" and nothing more.
    const secrets = checkSecrets(env, requiredSecrets);
    if (!secrets.ok) {
      log('error', { reason: 'secrets-missing', missing: secrets.missing });
      return temporaryErrorResponse();
    }

    // 6. Side effect (notification email, list append, ...).
    if (typeof deliver === 'function') {
      const result = await deliver({ values: body.values, env, request, ip });
      if (result && result.ok === false) {
        log('error', { reason: result.reason || 'deliver-failed' });
        return temporaryErrorResponse();
      }
    }

    log('accepted', {});
    return okResponse();
  } catch (error) {
    // Never surface the message: it can carry upstream detail.
    log('error', { reason: 'unhandled', name: error && error.name });
    return temporaryErrorResponse();
  }
}
