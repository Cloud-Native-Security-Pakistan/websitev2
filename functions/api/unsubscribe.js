/**
 * functions/api/unsubscribe.js — `GET /api/unsubscribe?token=…`.
 *
 * The one-click unsubscribe required by Requirement 16.6: a single link in every
 * dispatch, no login, no confirmation form, no "are you sure", no reason survey.
 * Following the link removes the subscriber and returns a plain confirmation.
 *
 * The token is an HMAC-signed carrier of the email (see `_dispatch.js`), so the
 * link is verifiable without storing a per-user secret, and a tampered or
 * re-signed token is rejected. Because the token is unguessable, a valid link is
 * sufficient authorization; a wrong link removes nothing.
 *
 * Responses are plain text, because a person clicking a mail link should get a
 * readable sentence rather than JSON. Nothing about the environment, the storage
 * backend, or any secret appears in any response — a failure says only that it
 * failed. The removed address is echoed back to the person who already knows it,
 * and only after their own signed token proved they hold the link.
 *
 * Validates: Requirements 16.6, 19.1
 */

import { readSecret } from './_shared.js';
import { sendEmail } from './_notify.js';
import {
  verifyUnsubscribeToken,
  hasDispatchKv,
  deleteSubscriber,
  DISPATCH_TOKEN_SECRET,
} from './_dispatch.js';

const TEXT_HEADERS = Object.freeze({
  'content-type': 'text/plain; charset=utf-8',
  'cache-control': 'no-store',
});

/**
 * @param {number} status
 * @param {string} body
 * @returns {Response}
 */
function textResponse(status, body) {
  return new Response(`${body}\n`, { status, headers: { ...TEXT_HEADERS } });
}

export const INVALID_LINK_MESSAGE =
  'This unsubscribe link is not valid or has expired. Reply to any CNSPK Dispatch email and a human will remove you.';

export const TEMPORARY_ERROR_MESSAGE =
  'Temporary error. Your unsubscribe request was not completed. Please try the link again shortly.';

/**
 * @param {{ request: Request, env?: Record<string, unknown> }} context
 * @returns {Promise<Response>}
 */
export async function onRequestGet(context) {
  const { request, env = {} } = context || {};

  let token = null;
  try {
    token = new URL(request.url).searchParams.get('token');
  } catch {
    token = null;
  }

  const secret = readSecret(env, DISPATCH_TOKEN_SECRET);
  if (!secret) {
    // Misconfiguration, not the visitor's fault: say nothing about which piece.
    return textResponse(500, TEMPORARY_ERROR_MESSAGE);
  }

  const verified = await verifyUnsubscribeToken(token, secret);
  if (!verified.ok) {
    // Malformed, missing, and forged tokens are answered identically.
    return textResponse(400, INVALID_LINK_MESSAGE);
  }

  const email = verified.email;

  if (hasDispatchKv(env)) {
    const removed = await deleteSubscriber({ kv: env.DISPATCH_KV, email });
    if (!removed.ok) {
      return textResponse(500, TEMPORARY_ERROR_MESSAGE);
    }
  } else {
    // No list backend is bound yet, so the removal is handed to a human. If that
    // hand-off cannot be made, the request is reported as failed rather than
    // confirmed — never claim someone was removed when they were not.
    const notified = await sendEmail({
      env,
      subject: '[CNSPK] Dispatch unsubscribe request',
      text: [
        'A verified one-click unsubscribe link was used.',
        '',
        `Remove this address from the dispatch list: ${email}`,
        `Requested: ${new Date().toISOString()}`,
        '',
        'No dispatch list backend is bound, so this removal must be applied by hand.',
      ].join('\n'),
    });
    if (!notified.ok) {
      return textResponse(500, TEMPORARY_ERROR_MESSAGE);
    }
  }

  return textResponse(
    200,
    [
      'You have been unsubscribed from the CNSPK Dispatch.',
      '',
      `Address removed: ${email}`,
      'No further dispatch emails will be sent to this address. You can sign up again at any time at https://cloudnativesecurity.pk/dispatch/.',
    ].join('\n'),
  );
}
