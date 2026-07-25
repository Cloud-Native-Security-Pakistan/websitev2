/**
 * functions/api/hire.js — `POST /api/hire`.
 *
 * A hiring request from an employer. The whole request pipeline (per-IP rate
 * limit, body size and JSON parse, honeypot + minimum-fill-time, full
 * server-side re-validation against the shared `hire` schema, required-secret
 * check, response contract) lives in `_shared.js`; this file only says which
 * form it is and where an accepted submission goes.
 *
 * Delivery is one structured plain-text notification to the organizer inbox via
 * Resend, with the requester as `Reply-To`. A failed send returns
 * `{ ok: false }` so the caller receives the contract's opaque
 * `5xx { ok: false, message: "temporary error" }` and can retry — the client is
 * never told a lost submission succeeded.
 *
 * Validates: Requirements 15.1, 15.2, 15.3
 */

import { handleIntake } from './_shared.js';
import { notifyOrganizer, NOTIFY_REQUIRED_SECRETS } from './_notify.js';

export const onRequestPost = (context) =>
  handleIntake(context, {
    form: 'hire',
    requiredSecrets: NOTIFY_REQUIRED_SECRETS,
    deliver: ({ values, env }) => notifyOrganizer({ form: 'hire', values, env }),
  });
