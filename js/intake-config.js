/**
 * CNSPK · Intake endpoints config
 * ----------------------------------------------------------
 * THE ONLY FILE YOU EDIT to turn the sub-ask and dispatch
 * forms on. Same convention as membership-config.js: one
 * config object, edited once after the backend is deployed.
 *
 * The four routes are served by the site's own serverless
 * functions (files under `functions/api/`), so they are
 * same-origin paths — no CORS, no third-party form vendor:
 *
 *   /api/hire      · recruiter / hiring intake      (/hire/)
 *   /api/sponsor   · sponsor & partner intake       (/sponsor/)
 *   /api/speak     · speaker / CFP intake           (/speak/, /cfp/)
 *   /api/dispatch  · dispatch newsletter opt-in     (/dispatch/)
 *
 * Direct submission is the PRIMARY path. The four handlers ship
 * in this repo under `functions/api/`, so they deploy with the
 * site and the routes below are live wherever the site is live.
 *
 * Honesty model (Requirements 15.2, 19.3):
 *   An EMPTY value means that form has no backend. It does not
 *   render a submit button that goes nowhere — `intake-client.js`
 *   renders a visibly labeled `mailto:` fallback instead, or a
 *   labeled coming-soon notice when there is no fallback address
 *   either. Never a broken submission. `mailto:` is the last
 *   resort, always visibly labeled — never the primary path.
 *
 * Nothing secret belongs here: this file ships to the browser.
 * API keys and list credentials live in the host's environment
 * variables and are read only inside the functions.
 * ----------------------------------------------------------
 */

/**
 * Backend route per intake form — the real, same-origin routes served by
 * `functions/api/*`. Forms POST here directly.
 *
 * Empty a value ONLY to deliberately take that one form off its backend; it
 * then renders the labeled `mailto:` fallback instead of a live submit.
 * @type {Readonly<Record<'hire'|'sponsor'|'speak'|'dispatch', string>>}
 */
export const INTAKE_ENDPOINTS = Object.freeze({
  hire: '/api/hire',
  sponsor: '/api/sponsor',
  speak: '/api/speak',
  dispatch: '/api/dispatch',
});

/**
 * Labeled `mailto:` fallback address per form, used only while the matching
 * INTAKE_ENDPOINTS value is empty. Clear an address to get the coming-soon
 * label instead of an email fallback.
 * @type {Readonly<Record<'hire'|'sponsor'|'speak'|'dispatch', string>>}
 */
export const INTAKE_FALLBACK_EMAILS = Object.freeze({
  hire: 'hire@cloudnativesecurity.pk',
  sponsor: 'hi@cloudnativesecurity.pk',
  speak: 'hi@cloudnativesecurity.pk',
  dispatch: 'hi@cloudnativesecurity.pk',
});
