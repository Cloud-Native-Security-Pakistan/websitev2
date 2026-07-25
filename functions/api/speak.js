/**
 * functions/api/speak.js — `POST /api/speak`.
 *
 * A speaker proposal (talk title plus abstract). Same thin shape as the other
 * sub-ask routes: `_shared.js` owns the pipeline and the response contract, the
 * `speak` schema owns the field rules, and delivery is one structured
 * notification to the organizer inbox via Resend.
 *
 * Validates: Requirements 15.1, 15.2, 15.3
 */

import { handleIntake } from './_shared.js';
import { notifyOrganizer, NOTIFY_REQUIRED_SECRETS } from './_notify.js';

export const onRequestPost = (context) =>
  handleIntake(context, {
    form: 'speak',
    requiredSecrets: NOTIFY_REQUIRED_SECRETS,
    deliver: ({ values, env }) => notifyOrganizer({ form: 'speak', values, env }),
  });
