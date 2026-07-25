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
 * Honesty model (Requirements 15.2, 19.3):
 *   An EMPTY value means that form has no backend. It does not
 *   render a submit button that goes nowhere — `intake-client.js`
 *   renders a visibly labeled `mailto:` fallback instead, or a
 *   labeled coming-soon notice when there is no fallback address
 *   either. Never a broken submission.
 *
 * Nothing secret belongs here: this file ships to the browser.
 * API keys and list credentials live in the host's environment
 * variables and are read only inside the functions.
 * ----------------------------------------------------------
 */

/**
 * Backend route per intake form. Empty string => that form falls back.
 * @type {Readonly<Record<'hire'|'sponsor'|'speak'|'dispatch', string>>}
 */
export const INTAKE_ENDPOINTS = Object.freeze({
  hire: '',
  sponsor: '',
  speak: '',
  dispatch: '',
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
