/**
 * functions/api/_dispatch.js — subscriber storage and unsubscribe tokens for
 * the CNSPK Dispatch newsletter, shared by `/api/dispatch` (signup) and
 * `/api/unsubscribe` (one-click removal).
 *
 * ANTI-AUTOMATION BOUNDARY (Requirements 16.2, 16.3, 16.6). Dispatch is a
 * single opt-in announcement list and nothing else. This module can append a
 * subscriber, remove a subscriber, and confirm a signup to the organizer. It
 * deliberately provides no sequencing, no scheduling, no welcome-series, and no
 * direct-message path — there is nothing here to enroll anyone in a funnel with.
 *
 * STORAGE IS PLUGGABLE BY NECESSITY. No list backend is provisioned yet, so:
 *   - if a `DISPATCH_KV` namespace is bound, subscribers are stored there,
 *     keyed by the lowercased email;
 *   - otherwise the signup is forwarded to the organizer inbox so a confirmed
 *     opt-in is never silently dropped while the backend is pending.
 * Both paths report failure to the caller, which becomes an opaque 5xx and a
 * client-visible retry — a signup either lands somewhere or the person is told.
 *
 * UNSUBSCRIBE TOKENS are HMAC-SHA-256 over the normalized email with
 * `UNSUBSCRIBE_SECRET`, via `crypto.subtle`. The token carries the email, so no
 * per-user secret is stored and a token stays verifiable even if the record is
 * gone. Rotating `UNSUBSCRIBE_SECRET` invalidates every outstanding link.
 *
 * Validates: Requirements 19.1, 16.5, 16.6
 */

import { readSecret } from './_shared.js';

/** KV key prefix for subscriber records. */
export const SUBSCRIBER_PREFIX = 'dispatch:sub:';

/** Public route that serves one-click unsubscribe. */
export const UNSUBSCRIBE_PATH = '/api/unsubscribe';

/** Canonical site origin, used when neither `SITE_ORIGIN` nor a request is available. */
export const CANONICAL_ORIGIN = 'https://cloudnativesecurity.pk';

/** Secret required on every dispatch path: without it no token can be issued. */
export const DISPATCH_TOKEN_SECRET = 'UNSUBSCRIBE_SECRET';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/* ------------------------------------------------------------------ *
 * Email normalization and keys
 * ------------------------------------------------------------------ */

/**
 * Lowercase and trim so `A@B.com` and `a@b.com` are one subscriber, and so a
 * signup and a later unsubscribe agree on the key and the signed value.
 * @param {unknown} email
 * @returns {string}
 */
export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * KV key for a subscriber.
 * @param {string} email
 * @returns {string}
 */
export function subscriberKey(email) {
  return SUBSCRIBER_PREFIX + normalizeEmail(email);
}

/* ------------------------------------------------------------------ *
 * base64url — no Buffer in this runtime
 * ------------------------------------------------------------------ */

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value) {
  const base64 = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded); // throws on malformed input; callers guard
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* ------------------------------------------------------------------ *
 * Tokens
 * ------------------------------------------------------------------ */

async function hmacSha256(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return new Uint8Array(signature);
}

/** Length-independent, value-constant comparison. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Mint a one-click unsubscribe token: `base64url(email).base64url(hmac(email))`.
 * The email travels in the token so a single GET can identify the subscriber;
 * the HMAC is what makes it unforgeable.
 * @param {string} email
 * @param {string} secret
 * @returns {Promise<string>}
 */
export async function createUnsubscribeToken(email, secret) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error('createUnsubscribeToken: an email is required');
  if (!secret) throw new Error('createUnsubscribeToken: a signing secret is required');
  const signature = await hmacSha256(secret, normalized);
  return `${bytesToBase64Url(encoder.encode(normalized))}.${bytesToBase64Url(signature)}`;
}

/**
 * Verify a token and recover the email it authorizes.
 * @param {unknown} token
 * @param {string} secret
 * @returns {Promise<{ ok: true, email: string } | { ok: false, reason: string }>}
 */
export async function verifyUnsubscribeToken(token, secret) {
  if (typeof token !== 'string' || token.trim() === '') {
    return { ok: false, reason: 'token-missing' };
  }
  if (!secret) return { ok: false, reason: 'secret-missing' };

  const parts = token.trim().split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: 'token-malformed' };
  }

  let email;
  let provided;
  try {
    email = decoder.decode(base64UrlToBytes(parts[0]));
    provided = base64UrlToBytes(parts[1]);
  } catch {
    return { ok: false, reason: 'token-malformed' };
  }

  const normalized = normalizeEmail(email);
  if (!normalized || normalized !== email) {
    // A token whose payload is not already normalized was not minted by us.
    return { ok: false, reason: 'token-malformed' };
  }

  const expected = await hmacSha256(secret, normalized);
  if (!timingSafeEqual(expected, provided)) {
    return { ok: false, reason: 'token-invalid' };
  }
  return { ok: true, email: normalized };
}

/**
 * Absolute one-click unsubscribe URL. `SITE_ORIGIN` wins when set (so preview
 * deployments can be pinned to production), otherwise the request's own origin,
 * otherwise the canonical apex.
 * @param {{ token: string, env?: object, request?: Request }} args
 * @returns {string}
 */
export function buildUnsubscribeUrl({ token, env, request }) {
  let origin = readSecret(env, 'SITE_ORIGIN');
  if (!origin && request && typeof request.url === 'string') {
    try {
      origin = new URL(request.url).origin;
    } catch {
      origin = undefined;
    }
  }
  const base = (origin || CANONICAL_ORIGIN).replace(/\/+$/, '');
  return `${base}${UNSUBSCRIBE_PATH}?token=${encodeURIComponent(token)}`;
}

/* ------------------------------------------------------------------ *
 * Storage selection
 * ------------------------------------------------------------------ */

/**
 * Is a usable `DISPATCH_KV` namespace bound?
 * @param {object} env
 * @returns {boolean}
 */
export function hasDispatchKv(env) {
  const kv = env && env.DISPATCH_KV;
  return Boolean(kv && typeof kv.get === 'function' && typeof kv.put === 'function');
}

/**
 * Which storage path is active, and therefore which secrets the route must
 * require before it accepts a submission.
 * @param {object} env
 * @returns {{ kind: 'kv' | 'notify', requiredSecrets: string[] }}
 */
export function resolveDispatchStore(env) {
  if (hasDispatchKv(env)) {
    return { kind: 'kv', requiredSecrets: [DISPATCH_TOKEN_SECRET] };
  }
  return {
    kind: 'notify',
    requiredSecrets: ['RESEND_API_KEY', 'ORGANIZER_INBOX', DISPATCH_TOKEN_SECRET],
  };
}

/* ------------------------------------------------------------------ *
 * Subscriber records
 * ------------------------------------------------------------------ */

/**
 * Build the stored subscriber record. `optIn: true` is recorded explicitly
 * because the opt-in is the legal basis for every later send, and the
 * unsubscribe URL is stored with the record so removal never depends on
 * regenerating a link.
 * @param {{ email: string, token: string, unsubscribeUrl: string, subscribedAt: string }} args
 */
export function buildSubscriberRecord({ email, token, unsubscribeUrl, subscribedAt }) {
  return {
    email: normalizeEmail(email),
    optIn: true,
    source: 'dispatch-form',
    subscribedAt,
    unsubscribeToken: token,
    unsubscribeUrl,
  };
}

/**
 * Append a confirmed opt-in subscriber to the KV list. Re-subscribing is
 * idempotent: the original `subscribedAt` is preserved so the consent date
 * stays truthful, and the token is refreshed only if it is absent.
 *
 * @param {{ kv: object, email: string, token: string, unsubscribeUrl: string, subscribedAt: string }} args
 * @returns {Promise<{ ok: true, created: boolean } | { ok: false, reason: string }>}
 */
export async function putSubscriber({ kv, email, token, unsubscribeUrl, subscribedAt }) {
  const key = subscriberKey(email);

  let existing = null;
  try {
    existing = await kv.get(key, 'json');
  } catch {
    // A read failure is not fatal: worst case we rewrite the record.
    existing = null;
  }

  const record = buildSubscriberRecord({
    email,
    token,
    unsubscribeUrl,
    subscribedAt: (existing && typeof existing.subscribedAt === 'string' && existing.subscribedAt) || subscribedAt,
  });

  try {
    await kv.put(key, JSON.stringify(record));
  } catch {
    return { ok: false, reason: 'dispatch-store-write-failed' };
  }
  return { ok: true, created: !existing };
}

/**
 * Remove a subscriber. Absence is success: unsubscribing twice, or
 * unsubscribing an address that was never stored, must both confirm rather than
 * error, because the person's intent is satisfied either way.
 *
 * @param {{ kv: object, email: string }} args
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
export async function deleteSubscriber({ kv, email }) {
  if (!kv || typeof kv.delete !== 'function') {
    return { ok: false, reason: 'dispatch-store-no-delete' };
  }
  try {
    await kv.delete(subscriberKey(email));
  } catch {
    return { ok: false, reason: 'dispatch-store-delete-failed' };
  }
  return { ok: true };
}
