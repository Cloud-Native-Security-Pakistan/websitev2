/**
 * functions/api/sponsor.js — `POST /api/sponsor`.
 *
 * A sponsorship or partnership enquiry. Identical shape to `/api/hire`: the
 * shared pipeline in `_shared.js` does the rate limiting, anti-spam, and full
 * server-side re-validation against the `sponsor` schema, and this file only
 * routes an accepted submission to the organizer inbox via Resend.
 *
 * Validates: Requirements 15.1, 15.2, 15.3
 */

import { handleIntake } from './_shared.js';
import { notifyOrganizer, NOTIFY_REQUIRED_SECRETS } from './_notify.js';

export const onRequestPost = (context) =>
  handleIntake(context, {
    form: 'sponsor',
    requiredSecrets: NOTIFY_REQUIRED_SECRETS,
    deliver: ({ values, env }) => notifyOrganizer({ form: 'sponsor', values, env }),
  });
