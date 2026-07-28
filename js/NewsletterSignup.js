/**
 * CNSPK · NewsletterSignup (Task 12.7)
 * ----------------------------------------------------------
 * The dispatch signup surface. One email field, one opt-in
 * control that starts UNSELECTED, the one-click unsubscribe
 * statement sitting next to that control, and the field-level
 * error regions `js/intake-client.js` writes into.
 *
 * This module owns markup only. Validation, the `local@domain`
 * check, error rendering that preserves the entered value, the
 * `_hp` / `_t` anti-spam fields, and the visibly labelled
 * `mailto:` / coming-soon fallback all come from
 * `initIntakeForm()` — there is no second copy of any of it here.
 *
 * Contracts held here:
 *   - The opt-in checkbox ships without `checked`, so no email is
 *     ever captured through a pre-selected control (Req 19.1).
 *   - The one-click unsubscribe statement is rendered adjacent to
 *     that control, not buried in a footer (Req 19.1).
 *   - Every field has a bound <label> and a matching
 *     `data-intake-error-for` region so an error is announced next
 *     to the control that caused it (Req 19.2).
 *   - No cadence, drip, or sequence copy: the dispatch is a single
 *     human-written note, opt-in, one click out (JOIN_STRATEGY §8).
 *
 * Pure string renderer + a browser mount, same split as
 * `js/DoorwayCard.js`, so the markup is testable in Node.
 *
 * Validates: Requirements 19.1, 19.2, 19.3
 * ----------------------------------------------------------
 */

import { initIntakeForm } from './intake-client.js';

/** The one-click unsubscribe promise, rendered beside the opt-in control. */
export const UNSUBSCRIBE_STATEMENT =
  'Every issue carries a one-click unsubscribe link. One click removes you — no reply, no form, no reason needed.';

/** What the opt-in actually consents to. Kept honest: no cadence is promised. */
export const OPT_IN_LABEL =
  'Yes — email me the CNSPK Dispatch. One human-written note at a time, nothing automated.';

/**
 * The dispatch signup form markup.
 *
 * @param {{ idPrefix?: string, heading?: string }} [options]
 * @param {string} [options.idPrefix='dispatch'] - Prefix for control ids, so more
 *   than one signup can sit on a page without colliding.
 * @returns {string} HTML string for a `<form data-intake="dispatch">`.
 */
export function newsletterSignupHTML(options = {}) {
  const prefix = typeof options.idPrefix === 'string' && options.idPrefix !== '' ? options.idPrefix : 'dispatch';
  const emailId = `${prefix}-email`;
  const optInId = `${prefix}-optin`;

  return `<form class="signup-form" data-intake="dispatch" novalidate>
    <div class="signup-form__row">
        <label class="field-label" for="${emailId}">Your email</label>
        <input class="field-input" type="email" id="${emailId}" name="email"
            autocomplete="email" spellcheck="false" placeholder="you@yourdomain.dev"
            aria-describedby="${prefix}-email-hint">
        <p class="field-hint" id="${prefix}-email-hint">Format: local@domain. Used for the Dispatch and nothing else.</p>
        <p class="field-error" data-intake-error-for="email" role="alert"></p>
    </div>

    <div class="signup-form__optin">
        <input class="field-check" type="checkbox" id="${optInId}" name="optIn">
        <label class="field-check-label" for="${optInId}">${OPT_IN_LABEL}</label>
        <p class="field-note" data-unsubscribe-statement>${UNSUBSCRIBE_STATEMENT}</p>
        <p class="field-error" data-intake-error-for="optIn" role="alert"></p>
    </div>

    <button type="submit" class="btn-primary btn-primary--sm">Subscribe</button>

    <p class="field-error" data-intake-error role="alert"></p>
    <p class="field-success" data-intake-success role="status" hidden></p>
</form>`;
}

/**
 * Render the signup into a DOM node and wire it to `/api/dispatch` — or to the
 * labelled fallback when no dispatch backend is configured.
 *
 * @param {Element|string} target - Element, or element id, to render into.
 * @param {object} [options] - Passed through to `initIntakeForm` (endpoints,
 *   mailto, fetchImpl, onResult) plus `idPrefix` for the markup.
 * @returns {object|null} The intake controller, or null when the node is absent.
 */
export function mountNewsletterSignup(target, options = {}) {
  const el = typeof target === 'string'
    ? (typeof document !== 'undefined' ? document.getElementById(target) : null)
    : target;
  if (!el) return null;

  el.innerHTML = newsletterSignupHTML(options);
  const form = el.querySelector('form[data-intake="dispatch"]');
  if (!form) return null;

  return initIntakeForm({ ...options, form, kind: 'dispatch' });
}
