/**
 * CNSPK · Site content config — the single source for the published
 * Member_Count and for the image manifest behind every media slot.
 * ----------------------------------------------------------
 * Same convention as membership-config.js and intake-config.js:
 * one frozen config object per concern, edited here and nowhere
 * else. Pure ES module, importable in the browser and in Node.
 *
 * 1. MEMBER_COUNT (Req 7.2, 7.3, 14.6)
 *    The figure is declared once and rendered from this file on
 *    every page that shows it. No page hardcodes it. While
 *    `isEstimate` is true the count always renders next to a
 *    visible label identifying it as an estimate.
 *
 * 2. IMAGE_MANIFEST (Req 7.4, 7.5, 7.6)
 *    Audit correction A4: there are NO real CNSPK event
 *    photographs in this workspace — `branding/` holds posters,
 *    templates, and social cards, not event photos. So every
 *    media slot resolves through this manifest: a real asset when
 *    one is listed, otherwise a visibly labelled placeholder.
 *    Dropping real photos in later is a manifest edit, not a
 *    sweep through every page and JSON file.
 *
 *    Never point a slot at stock photography. A stock image
 *    presented as a CNSPK event photograph is a fabrication.
 * ----------------------------------------------------------
 */

import { sanitizeHTML, sanitizeAttribute, sanitizeURL } from './lib/sanitize.js';

/* ==========================================================
   1. Member_Count — one figure, one source
   ========================================================== */

/**
 * The published community size.
 *
 * `display` is the exact string shown to readers. `verifiedSource` is where the
 * figure is checked against — the official CNCF chapter page. `isEstimate` stays
 * true until a fresh audit against that source replaces the figure, and while it
 * is true the count is never shown without the estimate label.
 *
 * Do not sharpen `display` to a precise number without a verified audit
 * (Req 14.6).
 *
 * @type {Readonly<{ display: string, verifiedSource: string, isEstimate: boolean }>}
 */
export const MEMBER_COUNT = Object.freeze({
  display: '280+',
  verifiedSource: 'https://community.cncf.io/cloud-native-security-pakistan/',
  isEstimate: true,
});

/** The visible label rendered beside the count while it is an estimate (Req 7.3). */
export const MEMBER_COUNT_ESTIMATE_LABEL = 'estimate';

/** The longer explanation carried as the label's accessible name / tooltip. */
export const MEMBER_COUNT_ESTIMATE_NOTE =
  `Estimate — ${MEMBER_COUNT.display} is verified against the CNSPK CNCF chapter page, not a live count.`;

/** Attribute marking a slot as rendered from this config. */
const MEMBER_COUNT_SLOT_ATTR = 'data-member-count';

/**
 * The markup for one member-count slot: the figure, an optional noun, and the
 * estimate label whenever the figure is unverified.
 *
 * @param {string} [noun] Word that follows the figure, e.g. "engineers".
 * @returns {string} HTML string.
 */
export function memberCountHTML(noun) {
  const safeNoun = sanitizeHTML(noun == null ? '' : String(noun).trim());
  const figure = `<span class="cnspk-member-count__value">${MEMBER_COUNT.display}</span>`;
  const nounPart = safeNoun === '' ? '' : ` <span class="cnspk-member-count__noun">${safeNoun}</span>`;

  if (!MEMBER_COUNT.isEstimate) return `${figure}${nounPart}`;

  const note = sanitizeAttribute(MEMBER_COUNT_ESTIMATE_NOTE);
  return (
    `${figure}${nounPart}` +
    ` <span class="cnspk-member-count__estimate" title="${note}" aria-label="${note}">` +
    `${sanitizeHTML(MEMBER_COUNT_ESTIMATE_LABEL)}</span>`
  );
}

/** Component-scoped styles for the estimate label. Injected once. */
function injectMemberCountStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('cnspk-member-count-styles')) return;

  const style = document.createElement('style');
  style.id = 'cnspk-member-count-styles';
  // bone-2 on carbon/charcoal clears 4.5:1; no lime is used, so the label is
  // safe on light surfaces too (lime text on bone fails — see brand-tokens.js).
  style.textContent = `
        .cnspk-member-count__estimate {
            display: inline-block;
            margin-left: 8px;
            padding: 2px 8px;
            font-family: var(--font-mono);
            font-size: 11px;
            font-style: normal;
            font-weight: 500;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            white-space: nowrap;
            vertical-align: middle;
            color: var(--bone-2);
            border: 1px solid var(--slate);
            border-radius: var(--r-pill);
        }
        .cnspk-member-count__estimate:where(.on-light *) { color: var(--slate); }
    `;
  document.head.appendChild(style);
}

/**
 * Render every member-count slot on the page from {@link MEMBER_COUNT}.
 *
 * A slot is any element carrying `data-member-count`; an optional
 * `data-member-count-noun` supplies the word after the figure. Slots ship empty
 * (with a `<noscript>` fallback) precisely so the figure lives in one file
 * rather than being hardcoded per page (Req 7.2).
 *
 * @param {ParentNode} [root] Defaults to `document`.
 * @returns {number} How many slots were rendered.
 */
export function mountMemberCount(root) {
  if (typeof document === 'undefined') return 0;
  injectMemberCountStyles();

  const scope = root || document;
  const slots = scope.querySelectorAll(`[${MEMBER_COUNT_SLOT_ATTR}]`);
  slots.forEach((slot) => {
    slot.innerHTML = memberCountHTML(slot.dataset.memberCountNoun);
    if (MEMBER_COUNT.isEstimate) slot.setAttribute('data-member-count-estimate', 'true');
  });
  return slots.length;
}

/* ==========================================================
   2. Image manifest — real asset or labelled placeholder
   ========================================================== */

/**
 * Real, published assets per media slot, keyed `kind` -> `slotId`.
 *
 * EMPTY BY DESIGN: no real CNSPK event photographs exist in this workspace yet
 * (audit correction A4), so every slot currently resolves to a labelled
 * placeholder. To publish a real photo, add the slot id here pointing at a
 * same-origin asset — nothing else changes.
 *
 *   events:   { '3': '/img/events/hacktoberfest-2025.jpg' }
 *   sessions: { '1': '/img/sessions/k8s-deep-dive.jpg' }
 *   speakers: { 'muhammad-farhan-ashraf': '/img/speakers/farhan.jpg' }
 *
 * @type {Readonly<Record<string, Readonly<Record<string, string>>>>}
 */
export const IMAGE_MANIFEST = Object.freeze({
  events: Object.freeze({}),
  sessions: Object.freeze({}),
  speakers: Object.freeze({}),
});

/** Brand graphic used as the placeholder mark. A real CNSPK asset, not stock. */
export const PLACEHOLDER_MARK = '/logo.png';

/** Visible placeholder labels per slot kind (Req 7.5, 7.6). */
export const PLACEHOLDER_LABELS = Object.freeze({
  events: 'Placeholder · no event photo yet',
  sessions: 'Placeholder · no session photo yet',
  speakers: 'Placeholder · no photo yet',
  default: 'Placeholder · asset pending',
});

/** What each kind's slot depicts, used to word the text alternative. */
const PLACEHOLDER_SUBJECTS = Object.freeze({
  events: 'event photograph',
  sessions: 'session image',
  speakers: 'speaker photo',
  default: 'image',
});

/**
 * Resolve one media slot to either a real asset or a labelled placeholder.
 *
 * Resolution order: the manifest entry first (so a published photo always wins),
 * then any URL carried by the data record, then the placeholder. Candidate URLs
 * pass through `sanitizeURL`, so an unsafe value degrades to the placeholder
 * rather than reaching an `src` (Req 2.4).
 *
 * @param {string} kind 'events' | 'sessions' | 'speakers'
 * @param {string|number} slotId Stable id of the slot (event id, session id, …).
 * @param {string} [dataSrc] URL carried by the data record, if any.
 * @param {string} [subject] Human label of what the slot shows, e.g. an event title.
 * @returns {{ isPlaceholder: boolean, src: string, alt: string, label?: string, slot: string }}
 */
export function resolveImageSlot(kind, slotId, dataSrc, subject) {
  const group = IMAGE_MANIFEST[kind] || {};
  const slot = `${kind}/${slotId ?? ''}`;

  const candidate = [group[String(slotId ?? '')], dataSrc]
    .map((value) => sanitizeURL(value))
    .find((value) => value !== '');

  if (candidate !== undefined) {
    return { isPlaceholder: false, src: candidate, alt: '', slot };
  }

  const noun = PLACEHOLDER_SUBJECTS[kind] || PLACEHOLDER_SUBJECTS.default;
  const about = subject == null || String(subject).trim() === '' ? '' : ` for ${String(subject).trim()}`;

  return {
    isPlaceholder: true,
    src: PLACEHOLDER_MARK,
    // Non-decorative: the alternative text has to say it is a placeholder (Req 4.4, 7.5).
    alt: `Placeholder — no CNSPK ${noun}${about} yet`,
    label: PLACEHOLDER_LABELS[kind] || PLACEHOLDER_LABELS.default,
    slot,
  };
}

/** Component-scoped placeholder styles. Injected once. */
function injectPlaceholderStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('cnspk-media-slot-styles')) return;

  const style = document.createElement('style');
  style.id = 'cnspk-media-slot-styles';
  // Typographic treatment on carbon: brand mark, grid wash, visible label.
  style.textContent = `
        .cnspk-media-slot {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            height: 100%;
            padding: 16px;
            text-align: center;
            background:
                linear-gradient(rgba(199, 255, 62, 0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(199, 255, 62, 0.05) 1px, transparent 1px),
                var(--carbon);
            background-size: 32px 32px, 32px 32px, auto;
            border-bottom: 1px dashed var(--slate);
        }
        .cnspk-media-slot__mark {
            width: 44px;
            height: 44px;
            object-fit: contain;
            opacity: 0.75;
        }
        .cnspk-media-slot__label {
            font-family: var(--font-mono);
            font-size: 11px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--bone-2);
            border: 1px dashed var(--slate);
            border-radius: var(--r-pill);
            padding: 3px 10px;
            background: rgba(15, 17, 21, 0.75);
        }
        .cnspk-media-slot--avatar {
            width: 40px;
            height: 40px;
            padding: 0;
            border-radius: var(--r-pill);
            border: 2px solid var(--slate);
            border-bottom-style: solid;
            overflow: hidden;
        }
        .cnspk-media-slot--avatar .cnspk-media-slot__mark { width: 22px; height: 22px; }
        .cnspk-media-slot--avatar .cnspk-media-slot__label {
            position: absolute;
            inset: auto 0 0 0;
            font-size: 8px;
            letter-spacing: 0.02em;
            border: 0;
            border-radius: 0;
            padding: 1px 0;
        }
    `;
  document.head.appendChild(style);
}

/**
 * Markup for a labelled placeholder slot: the brand mark with a text
 * alternative that says "placeholder", plus a visible placeholder label.
 *
 * Never renders stock imagery, a fabricated logo, or a fabricated name.
 *
 * @param {{ isPlaceholder: boolean, src: string, alt: string, label?: string, slot: string }} resolved
 *   The result of {@link resolveImageSlot}.
 * @param {{ variant?: 'media' | 'avatar', className?: string }} [options]
 * @returns {string} HTML string.
 */
export function mediaPlaceholderHTML(resolved, options = {}) {
  injectPlaceholderStyles();

  const variant = options.variant === 'avatar' ? 'avatar' : 'media';
  const extra = options.className ? ` ${sanitizeAttribute(options.className)}` : '';
  const label = sanitizeHTML(resolved.label || PLACEHOLDER_LABELS.default);

  return `
            <div class="cnspk-media-slot cnspk-media-slot--${variant}${extra}"
                 data-media-slot="${sanitizeAttribute(resolved.slot)}"
                 data-placeholder="true">
                <img class="cnspk-media-slot__mark"
                     src="${sanitizeURL(resolved.src)}"
                     alt="${sanitizeAttribute(resolved.alt)}"
                     width="44" height="44" loading="lazy" decoding="async">
                <span class="cnspk-media-slot__label">${label}</span>
            </div>`;
}
