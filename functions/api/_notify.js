/**
 * functions/api/_notify.js — organizer notification transport for the CNSPK
 * intake Pages Functions.
 *
 * Runtime: the Cloudflare Workers runtime. Only Web APIs are used (`fetch`,
 * `TextEncoder`), there are no Node built-ins, and every credential arrives
 * through the `env` argument that Pages hands the handler.
 *
 * The transport is Resend's HTTP API (`POST https://api.resend.com/emails`),
 * chosen in the design for its free tier. Two rules are absolute:
 *
 *   1. Nothing from the upstream response — status text, body, error id — is
 *      ever returned to the client. A failure is reported to the caller as
 *      `{ ok: false, reason }`, which `handleIntake` turns into the contract's
 *      opaque `5xx { ok: false, message: "temporary error" }`.
 *   2. The API key exists only in the outbound `Authorization` header. It is
 *      never logged, never echoed, never included in a `reason`.
 *
 * Notifications are plain text, not HTML: submitted values are attacker-
 * controlled, and a text/plain body cannot be turned into markup or a link by
 * the content of a field.
 *
 * Validates: Requirements 15.1, 15.2, 15.3
 */

import { readSecret } from './_shared.js';
import { SCHEMAS } from '../../js/lib/intake-validation.js';

/** Resend's transactional send endpoint. */
export const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * Secrets every notification-backed route needs. `NOTIFY_FROM` is deliberately
 * NOT required: Resend needs a verified sender, and the verified domain address
 * is configuration rather than a credential, so a documented default keeps a
 * fresh deployment working while still being overridable per environment.
 */
export const NOTIFY_REQUIRED_SECRETS = Object.freeze(['RESEND_API_KEY', 'ORGANIZER_INBOX']);

/** Fallback sender used when `NOTIFY_FROM` is unset. Must be a verified domain. */
export const DEFAULT_NOTIFY_FROM = 'CNSPK Website <noreply@cloudnativesecurity.pk>';

/** Anti-spam plumbing fields that must never appear in a notification. */
const INTERNAL_FIELDS = new Set(['_hp', '_t']);

/** Human labels for the schema field ids, so organizers read prose not keys. */
const FIELD_LABELS = Object.freeze({
  name: 'Name',
  email: 'Email',
  org: 'Organization',
  role_sought: 'Role sought',
  sponsorship_interest: 'Sponsorship interest',
  talk_title: 'Talk title',
  abstract: 'Abstract',
  links: 'Links',
  message: 'Message',
});

/** Subject prefix per route, so inbox rules can sort without parsing bodies. */
const FORM_SUBJECTS = Object.freeze({
  hire: 'Hire request',
  sponsor: 'Sponsorship enquiry',
  speak: 'Speaker proposal',
  dispatch: 'Dispatch signup',
});

/** Collapse whitespace and clamp, so a field cannot bloat or break a subject. */
function toSubjectFragment(value, maxLength = 120) {
  if (typeof value !== 'string') return '';
  const collapsed = value.replace(/\s+/g, ' ').trim();
  return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength - 1)}…` : collapsed;
}

/**
 * Build the notification subject: route intent plus the most identifying value
 * available (organization, else submitter name).
 * @param {string} form
 * @param {Record<string, unknown>} values
 * @returns {string}
 */
export function buildSubject(form, values = {}) {
  const intent = FORM_SUBJECTS[form] || 'Website intake';
  const who = toSubjectFragment(values.org) || toSubjectFragment(values.name);
  return who ? `[CNSPK] ${intent} — ${who}` : `[CNSPK] ${intent}`;
}

/**
 * Render the plain-text notification body from the form's own schema, so a
 * field added to the schema shows up here without a second edit. Internal
 * anti-spam fields are excluded and unknown keys are ignored entirely — the
 * body carries only declared fields.
 * @param {string} form
 * @param {Record<string, unknown>} values
 * @param {{ receivedAt?: string, extraLines?: string[] }} [options]
 * @returns {string}
 */
export function buildNotificationText(form, values = {}, options = {}) {
  const schema = SCHEMAS[form];
  const fields = schema && Array.isArray(schema.fields) ? schema.fields : [];
  const lines = [`Route: /api/${form}`, `Received: ${options.receivedAt || new Date().toISOString()}`, ''];

  for (const field of fields) {
    if (INTERNAL_FIELDS.has(field.id)) continue;
    const raw = values[field.id];
    if (raw === undefined || raw === null || raw === '') continue;
    const label = FIELD_LABELS[field.id] || field.id;
    const value = typeof raw === 'boolean' ? (raw ? 'yes' : 'no') : String(raw);
    // Free text keeps its line breaks; single-line values stay on one line.
    lines.push(value.includes('\n') ? `${label}:\n${value}` : `${label}: ${value}`);
  }

  for (const extra of options.extraLines || []) lines.push(extra);
  lines.push('', 'Sent by the CNSPK website intake function. Reply to reach the requester.');
  return lines.join('\n');
}

/**
 * POST one plain-text email through Resend.
 *
 * @param {{
 *   env: Record<string, unknown>,
 *   subject: string,
 *   text: string,
 *   replyTo?: string,
 *   to?: string,
 *   fetchImpl?: typeof fetch,
 * }} args
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 *   `reason` is a short internal token safe to log: it never contains the key,
 *   the recipient, or any upstream response text.
 */
export async function sendEmail({ env, subject, text, replyTo, to, fetchImpl }) {
  const apiKey = readSecret(env, 'RESEND_API_KEY');
  const recipient = to || readSecret(env, 'ORGANIZER_INBOX');
  const from = readSecret(env, 'NOTIFY_FROM') || DEFAULT_NOTIFY_FROM;

  // Defence in depth: `handleIntake` already gated on the required secrets, but
  // a misconfigured caller must fail closed rather than send nowhere.
  if (!apiKey || !recipient) {
    return { ok: false, reason: 'notify-not-configured' };
  }

  const payload = { from, to: [recipient], subject, text };
  if (replyTo) payload.reply_to = replyTo;

  const doFetch = typeof fetchImpl === 'function' ? fetchImpl : globalThis.fetch;
  if (typeof doFetch !== 'function') {
    return { ok: false, reason: 'notify-no-transport' };
  }

  let response;
  try {
    response = await doFetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // The thrown error can quote the request (headers included) — never surface it.
    return { ok: false, reason: 'notify-network-error' };
  }

  const status = Number(response && response.status);
  if (!Number.isFinite(status) || status < 200 || status >= 300) {
    return { ok: false, reason: `notify-http-${Number.isFinite(status) ? status : 'unknown'}` };
  }
  return { ok: true };
}

/**
 * The `deliver` hook shared by `/api/hire`, `/api/sponsor`, and `/api/speak`:
 * one structured plain-text notification to the organizer inbox, with the
 * submitter's address as `Reply-To` so a human answers a human.
 *
 * @param {{ form: string, values: object, env: object, fetchImpl?: typeof fetch, now?: () => Date }} args
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
export async function notifyOrganizer({ form, values, env, fetchImpl, now }) {
  const receivedAt = (typeof now === 'function' ? now() : new Date()).toISOString();
  return sendEmail({
    env,
    subject: buildSubject(form, values),
    text: buildNotificationText(form, values, { receivedAt }),
    replyTo: typeof values.email === 'string' ? values.email : undefined,
    fetchImpl,
  });
}
