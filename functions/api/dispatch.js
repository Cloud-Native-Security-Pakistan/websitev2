/**
 * functions/api/dispatch.js — `POST /api/dispatch`.
 *
 * Newsletter signup for the CNSPK Dispatch. The shared pipeline in `_shared.js`
 * handles rate limiting, anti-spam, and re-validation; the `dispatch` schema
 * requires both a `local@domain` email and an `optIn` that is literally `true`,
 * so an unchecked box can never reach this file's delivery step. That gate is
 * not bypassed or relaxed here (Requirements 19.1, 19.2).
 *
 * ANTI-AUTOMATION (Requirements 16.2, 16.3, 16.6). Accepting a signup does
 * exactly two things: store the confirmed opt-in, and mint a one-click
 * unsubscribe token that travels with the record. There is no welcome series, no
 * drip enrollment, no scheduled follow-up, and no direct message — this route is
 * the only newsletter mechanism and it only ever appends to a single list.
 *
 * STORAGE. `DISPATCH_KV` is used when bound. No list backend is provisioned
 * yet, so when it is absent the signup is forwarded to the organizer inbox
 * instead of being dropped, and the required-secret set changes to match the
 * active path. Either way a storage failure surfaces as the contract's
 * `5xx { ok: false, message: "temporary error" }`, so the person sees a retry
 * rather than a false success.
 *
 * Validates: Requirements 19.1, 16.5, 16.6
 */

import { handleIntake, readSecret } from './_shared.js';
import { sendEmail, buildSubject, buildNotificationText } from './_notify.js';
import {
  resolveDispatchStore,
  createUnsubscribeToken,
  buildUnsubscribeUrl,
  normalizeEmail,
  putSubscriber,
  DISPATCH_TOKEN_SECRET,
} from './_dispatch.js';

/**
 * Persist (or forward) one confirmed opt-in.
 * @param {{ values: object, env: object, request: Request }} args
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
export async function deliverDispatchSignup({ values, env, request }) {
  const email = normalizeEmail(values && values.email);
  if (!email) return { ok: false, reason: 'dispatch-email-missing' };

  const secret = readSecret(env, DISPATCH_TOKEN_SECRET);
  if (!secret) return { ok: false, reason: 'dispatch-token-secret-missing' };

  const token = await createUnsubscribeToken(email, secret);
  const unsubscribeUrl = buildUnsubscribeUrl({ token, env, request });
  const subscribedAt = new Date().toISOString();
  const store = resolveDispatchStore(env);

  if (store.kind === 'kv') {
    return putSubscriber({ kv: env.DISPATCH_KV, email, token, unsubscribeUrl, subscribedAt });
  }

  // Fallback: no list backend is bound, so hand the confirmed opt-in to a human
  // rather than lose it. This is a notification about a signup, not a message to
  // the subscriber — no automated mail is sent to the person who signed up.
  return sendEmail({
    env,
    subject: buildSubject('dispatch', { name: email }),
    text: buildNotificationText('dispatch', { email, optIn: true }, {
      receivedAt: subscribedAt,
      extraLines: [
        '',
        'No dispatch list backend is bound, so this confirmed opt-in must be added to the list by hand.',
        `One-click unsubscribe URL for this subscriber: ${unsubscribeUrl}`,
      ],
    }),
  });
}

export const onRequestPost = (context) =>
  handleIntake(context, {
    form: 'dispatch',
    // Whichever storage path is active decides what must be configured.
    requiredSecrets: resolveDispatchStore((context && context.env) || {}).requiredSecrets,
    deliver: deliverDispatchSignup,
  });
