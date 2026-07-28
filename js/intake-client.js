/**
 * intake-client — the one submit client every sub-ask (/hire, /sponsor,
 * /speak, /cfp) and dispatch newsletter form uses.
 *
 * It does four things and nothing else:
 *   1. Validates client-side through the SAME schemas the backend re-checks
 *      (`js/lib/intake-validation.js`) — a courtesy, never the gate.
 *   2. POSTs JSON to the configured same-origin `/api/*` route.
 *   3. Interprets the JSON response contract honestly:
 *        200 { ok: true }                        -> success
 *        400 { ok: false, field, message }       -> field-level error
 *        429 { ok: false, message }              -> rate limited, retry
 *        5xx { ok: false, message }              -> temporary, retry
 *        404 / 405 (route not deployed)          -> labeled fallback, not a dead end
 *        network failure / unparseable body      -> honest error, retry
 *      Success is NEVER fabricated: only `200` with `ok: true` succeeds, and
 *      every error path preserves the values already entered.
 *   4. Renders the visibly labeled `mailto:` / coming-soon fallback when the
 *      endpoint is unconfigured, instead of a submit button that goes nowhere.
 *      Direct submission to `/api/*` is the primary path; `mailto:` is only ever
 *      the labeled last resort.
 *
 * Submit-target selection is delegated to `selectSubmitTarget()` in
 * `js/lib/content-rules.js`; the field rules to `validateSubmission()`. This
 * module adds no second copy of either.
 *
 * Split by design: everything above `initIntakeForm` is pure and importable in
 * Node (that is what the tests exercise); only the form controller touches the
 * DOM, and only from inside its functions, so importing this module in Node is
 * safe.
 *
 * Anti-spam fields travel with every payload: `_hp` (honeypot, must arrive
 * empty) and `_t` (render timestamp, for the server's minimum-fill-time check).
 *
 * Validates: Requirements 15.2, 19.3
 */

import { validateSubmission } from './lib/intake-validation.js';
import { selectSubmitTarget, SUBMIT_MODES } from './lib/content-rules.js';
import { INTAKE_ENDPOINTS, INTAKE_FALLBACK_EMAILS } from './intake-config.js';

/** Outcome states returned by {@link submitIntake}. */
export const INTAKE_STATES = Object.freeze({
  SUCCESS: 'success',
  FIELD_ERROR: 'field-error',
  RATE_LIMITED: 'rate-limited',
  SERVER_ERROR: 'server-error',
  NETWORK_ERROR: 'network-error',
  FALLBACK: 'fallback',
});

/** Copy used when the backend sends no message of its own. */
export const INTAKE_MESSAGES = Object.freeze({
  SUCCESS: 'Thanks — your message is in. We read everything.',
  FIELD_ERROR: 'Please check the highlighted field.',
  RATE_LIMITED: 'Too many attempts just now. Wait a moment and try again.',
  SERVER_ERROR: 'Something went wrong on our side. Your details are still here — try again.',
  NETWORK_ERROR: 'Could not reach the server. Your details are still here — try again.',
  UNEXPECTED: 'The server did not confirm your submission. Your details are still here — try again.',
});

/**
 * The four intake forms. `fields` is the payload shape from the design;
 * `booleanFields` are opt-in controls that always travel (default `false`).
 * `schema` names the shared validator schema that gates the same fields.
 */
export const INTAKE_FORMS = Object.freeze({
  hire: Object.freeze({
    kind: 'hire',
    schema: 'hire',
    route: '/api/hire',
    fields: Object.freeze(['name', 'email', 'org', 'role_sought', 'message']),
    booleanFields: Object.freeze([]),
    subject: 'Hiring enquiry — CNSPK',
  }),
  sponsor: Object.freeze({
    kind: 'sponsor',
    schema: 'sponsor',
    route: '/api/sponsor',
    fields: Object.freeze(['name', 'email', 'org', 'sponsorship_interest', 'message']),
    booleanFields: Object.freeze([]),
    subject: 'Sponsorship enquiry — CNSPK',
  }),
  speak: Object.freeze({
    kind: 'speak',
    schema: 'speak',
    route: '/api/speak',
    fields: Object.freeze(['name', 'email', 'talk_title', 'abstract', 'links']),
    booleanFields: Object.freeze([]),
    subject: 'Talk proposal — CNSPK',
  }),
  dispatch: Object.freeze({
    kind: 'dispatch',
    schema: 'dispatch',
    route: '/api/dispatch',
    fields: Object.freeze(['email']),
    booleanFields: Object.freeze(['optIn']),
    subject: 'Dispatch signup — CNSPK',
  }),
});

/** The four intake form kinds. @type {readonly string[]} */
export const INTAKE_KINDS = Object.freeze(Object.keys(INTAKE_FORMS));

/**
 * Resolve a form descriptor, throwing on an unknown kind so a typo fails loudly
 * at wiring time rather than silently posting nowhere.
 * @param {string} kind
 * @returns {object}
 */
export function getIntakeForm(kind) {
  const form = INTAKE_FORMS[kind];
  if (!form) {
    throw new Error(`intake-client: unknown intake kind "${kind}". Expected one of ${INTAKE_KINDS.join(', ')}.`);
  }
  return form;
}

/**
 * Select the submit target for a form: the configured endpoint, else a labeled
 * `mailto:`, else a labeled coming-soon state.
 *
 * @param {string} kind
 * @param {{ endpoints?: Record<string, string>, mailto?: string }} [options]
 * @returns {{ mode: string, target?: string, isFallback: boolean, label?: string }}
 */
export function resolveIntakeTarget(kind, options = {}) {
  getIntakeForm(kind);
  const endpoints = options.endpoints ?? INTAKE_ENDPOINTS;
  const mailto = options.mailto ?? INTAKE_FALLBACK_EMAILS[kind];
  return selectSubmitTarget({ endpoint: endpoints?.[kind], mailto });
}

/**
 * Client-side validation against the shared schema. Never mutates `values`.
 * @param {string} kind
 * @param {Record<string, unknown>} values
 * @returns {{ valid: boolean, field?: string, message?: string }}
 */
export function validateIntake(kind, values) {
  return validateSubmission(values, getIntakeForm(kind).schema);
}

/**
 * Build the wire payload for a form kind: only that form's fields, plus the
 * `_hp` honeypot (submitted empty) and the `_t` render timestamp.
 *
 * Text fields are omitted when they carry no value, so an optional field like
 * `links` simply does not travel. Opt-in controls always travel and default to
 * `false`, matching the dispatch contract.
 *
 * @param {string} kind
 * @param {Record<string, unknown>} values
 * @param {{ honeypot?: unknown, renderedAt?: number, now?: () => number }} [options]
 * @returns {Record<string, unknown>}
 */
export function buildPayload(kind, values, options = {}) {
  const form = getIntakeForm(kind);
  const supplied = values && typeof values === 'object' ? values : {};
  const payload = {};

  for (const field of form.fields) {
    const value = supplied[field];
    if (value === undefined || value === null) continue;
    const text = typeof value === 'string' ? value : String(value);
    if (text === '') continue;
    payload[field] = text;
  }

  for (const field of form.booleanFields) {
    payload[field] = supplied[field] === true;
  }

  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const renderedAt = Number(options.renderedAt);

  // Honeypot must reach the server empty; a bot that fills it is rejected there.
  payload._hp = options.honeypot === undefined || options.honeypot === null ? '' : String(options.honeypot);
  // Render timestamp for the server's minimum-fill-time check.
  payload._t = Number.isFinite(renderedAt) ? renderedAt : now();

  return payload;
}

/**
 * Contract tokens the backend sends as machine-readable status text ("rate
 * limited", "temporary error"). They are not user-facing copy, so the client
 * substitutes its own message with the retry guidance attached.
 */
const CONTRACT_TOKENS = new Set(['rate limited', 'rate-limited', 'temporary error', 'temporary-error']);

/** The server's message when it carries information a person can act on. */
function readableMessage(body) {
  const value = typeof body.message === 'string' ? body.message.trim() : '';
  if (value === '' || CONTRACT_TOKENS.has(value.toLowerCase())) return undefined;
  return value;
}

/**
 * Interpret an HTTP status + parsed JSON body against the intake response
 * contract. Pure, so the contract is testable without a network.
 *
 * Anything that is not an explicit `200 { ok: true }` is an error — including a
 * `200` with a missing or falsey `ok`, which is treated as unconfirmed rather
 * than as success.
 *
 * @param {number} status
 * @param {unknown} body
 * @returns {{ state: string, ok: boolean, message: string, field?: string, canRetry: boolean, status: number }}
 */
export function interpretResponse(status, body) {
  const payload = body && typeof body === 'object' ? body : {};
  const message = readableMessage(payload);

  if (status === 200 && payload.ok === true) {
    return {
      state: INTAKE_STATES.SUCCESS,
      ok: true,
      message: message ?? INTAKE_MESSAGES.SUCCESS,
      canRetry: false,
      status,
    };
  }

  if (status === 400) {
    const field = typeof payload.field === 'string' && payload.field.trim() !== '' ? payload.field.trim() : undefined;
    return {
      state: INTAKE_STATES.FIELD_ERROR,
      ok: false,
      field,
      message: message ?? INTAKE_MESSAGES.FIELD_ERROR,
      // A field error is fixed by editing the value, not by resubmitting as-is.
      canRetry: false,
      status,
    };
  }

  if (status === 429) {
    return {
      state: INTAKE_STATES.RATE_LIMITED,
      ok: false,
      message: message ?? INTAKE_MESSAGES.RATE_LIMITED,
      canRetry: true,
      status,
    };
  }

  if (status >= 500) {
    return {
      state: INTAKE_STATES.SERVER_ERROR,
      ok: false,
      message: message ?? INTAKE_MESSAGES.SERVER_ERROR,
      canRetry: true,
      status,
    };
  }

  // Any other status, or a 200 that never confirmed `ok: true`.
  return {
    state: INTAKE_STATES.SERVER_ERROR,
    ok: false,
    message: message ?? INTAKE_MESSAGES.UNEXPECTED,
    canRetry: true,
    status,
  };
}

/**
 * Build the labeled `mailto:` fallback href, prefilled with whatever the person
 * already typed so the fallback is a real route out, not a dead end.
 *
 * @param {string} kind
 * @param {Record<string, unknown>} values
 * @param {string} target - A `mailto:address` or bare address.
 * @returns {string}
 */
export function buildMailtoHref(kind, values, target) {
  const form = getIntakeForm(kind);
  const supplied = values && typeof values === 'object' ? values : {};
  const address = String(target ?? '').replace(/^mailto:/i, '').trim();
  if (address === '') return '';

  const lines = [];
  for (const field of [...form.fields, ...form.booleanFields]) {
    const value = supplied[field];
    if (value === undefined || value === null || value === '') continue;
    lines.push(`${field}: ${typeof value === 'string' ? value : String(value)}`);
  }

  const query = [`subject=${encodeURIComponent(form.subject)}`];
  if (lines.length > 0) query.push(`body=${encodeURIComponent(lines.join('\n'))}`);

  return `mailto:${address}?${query.join('&')}`;
}

/**
 * Submit an intake form.
 *
 * Order of operations: resolve the target (so an unconfigured endpoint returns a
 * labeled fallback instead of attempting a POST), validate client-side, POST
 * JSON, then interpret the response. Every returned result carries the entered
 * `values` back untouched so the caller can preserve them.
 *
 * @param {string} kind - 'hire' | 'sponsor' | 'speak' | 'dispatch'
 * @param {Record<string, unknown>} values
 * @param {{
 *   endpoints?: Record<string, string>,
 *   mailto?: string,
 *   honeypot?: unknown,
 *   renderedAt?: number,
 *   now?: () => number,
 *   fetchImpl?: typeof fetch,
 *   signal?: AbortSignal
 * }} [options]
 * @returns {Promise<object>} The outcome; `state` is one of INTAKE_STATES.
 */
export async function submitIntake(kind, values, options = {}) {
  const form = getIntakeForm(kind);
  const supplied = values && typeof values === 'object' ? values : {};

  const target = resolveIntakeTarget(kind, options);
  if (target.mode !== SUBMIT_MODES.ENDPOINT) {
    return {
      state: INTAKE_STATES.FALLBACK,
      ok: false,
      mode: target.mode,
      target: target.target,
      label: target.label,
      mailtoHref: target.mode === SUBMIT_MODES.MAILTO ? buildMailtoHref(kind, supplied, target.target) : undefined,
      message: target.label,
      canRetry: false,
      values: supplied,
    };
  }

  const validation = validateIntake(kind, supplied);
  if (!validation.valid) {
    return {
      state: INTAKE_STATES.FIELD_ERROR,
      ok: false,
      field: validation.field,
      message: validation.message,
      source: 'client',
      canRetry: false,
      values: supplied,
    };
  }

  const payload = buildPayload(kind, supplied, options);
  const doFetch = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!doFetch) {
    return {
      state: INTAKE_STATES.NETWORK_ERROR,
      ok: false,
      message: INTAKE_MESSAGES.NETWORK_ERROR,
      canRetry: true,
      values: supplied,
    };
  }

  let response;
  try {
    response = await doFetch(target.target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: options.signal,
    });
  } catch (error) {
    // Offline, DNS failure, aborted request: an honest error, never a success.
    return {
      state: INTAKE_STATES.NETWORK_ERROR,
      ok: false,
      message: INTAKE_MESSAGES.NETWORK_ERROR,
      error: error instanceof Error ? error.message : String(error),
      canRetry: true,
      values: supplied,
    };
  }

  // A body that will not parse leaves the outcome unconfirmed, so it is judged
  // by status alone rather than assumed good.
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  const status = Number(response.status);

  // Configured, but the route is not there (404) or rejects the method (405):
  // the endpoint is the primary path, so this should not happen — when it does,
  // hand back the labeled fallback rather than a dead end.
  if (status === 404 || status === 405) {
    const escape = resolveIntakeTarget(kind, { ...options, endpoints: {} });
    return {
      state: INTAKE_STATES.FALLBACK,
      ok: false,
      mode: escape.mode,
      target: escape.target,
      label: escape.label,
      mailtoHref:
        escape.mode === SUBMIT_MODES.MAILTO ? buildMailtoHref(kind, supplied, escape.target) : undefined,
      message: escape.label,
      canRetry: false,
      kind: form.kind,
      endpoint: target.target,
      status,
      values: supplied,
    };
  }

  const result = interpretResponse(status, body);
  return { ...result, kind: form.kind, endpoint: target.target, values: supplied };
}

/* ------------------------------------------------------------------------- *
 * Browser form controller — the only part of this module that touches the DOM.
 * Everything above stays pure so the contract is testable in Node.
 * ------------------------------------------------------------------------- */

const STYLE_ID = 'cnspk-intake-client-styles';

/** Hide the honeypot from people (and assistive tech) but not from bots. */
function injectStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .cnspk-intake__hp {
      position: absolute !important; width: 1px; height: 1px;
      padding: 0; margin: -1px; overflow: hidden;
      clip: rect(0 0 0 0); white-space: nowrap; border: 0;
    }
    .cnspk-intake__fallback {
      margin-top: 16px; padding: 16px; border: 1px dashed var(--slate, #3a3f47);
      border-radius: var(--r-sm, 6px); background: var(--carbon, #16181d);
    }
    .cnspk-intake__fallback-label {
      font-family: var(--font-mono, monospace); font-size: 12px;
      color: var(--bone-2, #c9ccd1); line-height: 1.6; margin: 0 0 12px;
    }
    .cnspk-intake__error { color: var(--breach, #ff5f56); font-family: var(--font-mono, monospace); font-size: 12px; }
    .cnspk-intake__success { color: var(--lime, #c7ff3e); font-family: var(--font-mono, monospace); font-size: 13px; }
  `;
  document.head.appendChild(style);
}

/** Accept an element, an id, or a selector. */
function resolveElement(ref) {
  if (!ref) return null;
  if (typeof ref !== 'string') return ref;
  if (typeof document === 'undefined') return null;
  return /^[#.[]/.test(ref) ? document.querySelector(ref) : document.getElementById(ref);
}

/** The named control for a field, or null when the form has no such control. */
function controlFor(formEl, name) {
  const control = formEl.elements ? formEl.elements[name] : null;
  return control || null;
}

/**
 * Read the current values out of a form. Reads only — the controls are never
 * written to, which is what preserves entered values across an error.
 * @param {HTMLFormElement} formEl
 * @param {string} kind
 * @returns {Record<string, unknown>}
 */
export function readFormValues(formEl, kind) {
  const form = getIntakeForm(kind);
  const values = {};

  for (const field of form.fields) {
    const control = controlFor(formEl, field);
    if (!control) continue;
    values[field] = typeof control.value === 'string' ? control.value.trim() : '';
  }

  for (const field of form.booleanFields) {
    const control = controlFor(formEl, field);
    values[field] = control ? control.checked === true : false;
  }

  return values;
}

/** Ensure the hidden `_hp` honeypot and `_t` timestamp inputs exist. */
function ensureAntiSpamFields(formEl, renderedAt) {
  let honeypot = controlFor(formEl, '_hp');
  if (!honeypot) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cnspk-intake__hp';
    wrapper.setAttribute('aria-hidden', 'true');
    honeypot = document.createElement('input');
    honeypot.type = 'text';
    honeypot.name = '_hp';
    honeypot.tabIndex = -1;
    honeypot.autocomplete = 'off';
    wrapper.appendChild(honeypot);
    formEl.appendChild(wrapper);
  }

  let stamp = controlFor(formEl, '_t');
  if (!stamp) {
    stamp = document.createElement('input');
    stamp.type = 'hidden';
    stamp.name = '_t';
    formEl.appendChild(stamp);
  }
  stamp.value = String(renderedAt);

  return { honeypot, stamp };
}

/** Clear any previous error marks without touching a single entered value. */
function clearErrors(formEl) {
  for (const marked of formEl.querySelectorAll('[aria-invalid="true"]')) {
    marked.removeAttribute('aria-invalid');
  }
  for (const region of formEl.querySelectorAll('[data-intake-error-for]')) {
    region.textContent = '';
  }
  const general = formEl.querySelector('[data-intake-error]');
  if (general) general.textContent = '';
}

/** The general (non-field) error region, created on demand. */
function generalErrorRegion(formEl) {
  let region = formEl.querySelector('[data-intake-error]');
  if (!region) {
    region = document.createElement('p');
    region.setAttribute('data-intake-error', '');
    region.className = 'cnspk-intake__error';
    region.setAttribute('role', 'alert');
    formEl.appendChild(region);
  }
  if (!region.getAttribute('role')) region.setAttribute('role', 'alert');
  return region;
}

/** Render a field-level error next to its control and move focus there. */
function renderFieldError(formEl, field, message) {
  const scoped = field ? formEl.querySelector(`[data-intake-error-for="${field}"]`) : null;
  (scoped || generalErrorRegion(formEl)).textContent = message;

  const control = field ? controlFor(formEl, field) : null;
  if (control) {
    control.setAttribute('aria-invalid', 'true');
    if (typeof control.focus === 'function') control.focus();
  }
}

/** Render the visible success state. */
function renderSuccess(formEl, message) {
  let region = formEl.querySelector('[data-intake-success]');
  if (!region) {
    region = document.createElement('p');
    region.setAttribute('data-intake-success', '');
    region.className = 'cnspk-intake__success';
    region.setAttribute('role', 'status');
    formEl.appendChild(region);
  }
  region.textContent = message;
  region.hidden = false;
}

/** Hide the success region (a new attempt is in flight). */
function hideSuccess(formEl) {
  const region = formEl.querySelector('[data-intake-success]');
  if (region) {
    region.textContent = '';
    region.hidden = true;
  }
}

/**
 * Render the labeled fallback in place of a submit that would go nowhere: the
 * status label is always visible, and for `mailto:` a real prefilled email link
 * replaces the submit button.
 */
function renderFallback(formEl, kind, target) {
  let mount = formEl.querySelector('[data-intake-fallback]');
  if (!mount) {
    mount = document.createElement('div');
    mount.setAttribute('data-intake-fallback', '');
    formEl.appendChild(mount);
  }
  mount.className = 'cnspk-intake__fallback';
  mount.textContent = '';

  const label = document.createElement('p');
  label.className = 'cnspk-intake__fallback-label';
  label.textContent = target.label ?? '';
  mount.appendChild(label);

  let link = null;
  if (target.mode === SUBMIT_MODES.MAILTO) {
    link = document.createElement('a');
    link.className = 'btn-primary';
    link.setAttribute('data-intake-mailto', '');
    link.href = buildMailtoHref(kind, readFormValues(formEl, kind), target.target);
    link.textContent = 'Send by email instead';
    mount.appendChild(link);

    // Keep the prefill in step with what is typed, so nothing is retyped.
    formEl.addEventListener('input', () => {
      link.href = buildMailtoHref(kind, readFormValues(formEl, kind), target.target);
    });
  }

  const submit = formEl.querySelector('[type="submit"]');
  if (submit) {
    submit.disabled = true;
    submit.setAttribute('aria-disabled', 'true');
    submit.hidden = true;
  }

  return link;
}

/**
 * Wire an intake form to its backend, or to its labeled fallback.
 *
 * Expected markup (all optional except the controls themselves):
 *   <form data-intake="hire">
 *     <input name="name"> <p data-intake-error-for="name"></p>
 *     ... <button type="submit">Send</button>
 *     <p data-intake-error></p> <p data-intake-success hidden></p>
 *   </form>
 * The `_hp` honeypot and `_t` timestamp inputs are added automatically.
 *
 * @param {{
 *   form: HTMLFormElement|string,
 *   kind?: string,
 *   endpoints?: Record<string, string>,
 *   mailto?: string,
 *   fetchImpl?: typeof fetch,
 *   now?: () => number,
 *   onResult?: (result: object) => void
 * }} options
 * @returns {object|null} A controller, or null when the form is not in the page.
 */
export function initIntakeForm(options = {}) {
  const formEl = resolveElement(options.form);
  if (!formEl) return null;

  const kind = options.kind ?? formEl.dataset?.intake;
  const form = getIntakeForm(kind);
  const now = typeof options.now === 'function' ? options.now : () => Date.now();

  injectStyles();

  let renderedAt = now();
  const { honeypot } = ensureAntiSpamFields(formEl, renderedAt);
  formEl.setAttribute('novalidate', '');

  const target = resolveIntakeTarget(kind, options);
  formEl.dataset.intakeMode = target.mode;

  if (target.isFallback) {
    renderFallback(formEl, kind, target);
    // No endpoint: nothing is posted, so the submit event is inert rather than
    // pretending to send.
    formEl.addEventListener('submit', (event) => event.preventDefault());
    return { element: formEl, kind: form.kind, target, submit: async () => null };
  }

  const submitButton = formEl.querySelector('[type="submit"]');
  let busy = false;

  async function submit() {
    if (busy) return null;
    busy = true;
    clearErrors(formEl);
    hideSuccess(formEl);
    if (submitButton) {
      submitButton.disabled = true;
      formEl.dataset.intakeBusy = 'true';
    }

    const values = readFormValues(formEl, kind);
    let result;
    try {
      result = await submitIntake(kind, values, {
        endpoints: options.endpoints,
        mailto: options.mailto,
        fetchImpl: options.fetchImpl,
        honeypot: honeypot ? honeypot.value : '',
        renderedAt,
        now,
      });
    } finally {
      busy = false;
      if (submitButton) {
        submitButton.disabled = false;
        delete formEl.dataset.intakeBusy;
      }
    }

    formEl.dataset.intakeState = result.state;

    if (result.state === INTAKE_STATES.SUCCESS) {
      renderSuccess(formEl, result.message);
      formEl.reset();
      // A fresh form gets a fresh fill-time baseline.
      renderedAt = now();
      ensureAntiSpamFields(formEl, renderedAt);
    } else if (result.state === INTAKE_STATES.FIELD_ERROR) {
      // Values are untouched: the person edits one field and resubmits.
      renderFieldError(formEl, result.field, result.message);
    } else if (result.state === INTAKE_STATES.FALLBACK) {
      // The route answered 404/405: offer the labeled escape hatch, prefilled
      // with what was typed, instead of a submit button that goes nowhere.
      renderFallback(formEl, kind, { mode: result.mode, target: result.target, label: result.label });
    } else {
      generalErrorRegion(formEl).textContent = result.message;
      if (submitButton && result.canRetry) submitButton.disabled = false;
    }

    if (typeof options.onResult === 'function') options.onResult(result);
    return result;
  }

  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    submit();
  });

  return {
    element: formEl,
    kind: form.kind,
    target,
    submit,
    readValues: () => readFormValues(formEl, kind),
    get renderedAt() {
      return renderedAt;
    },
  };
}
