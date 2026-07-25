/**
 * CNSPK · DoorwayCard (v2)
 * ----------------------------------------------------------
 * Renders the `/join/` doorway picker from `js/lib/channels.js`.
 *
 * The doorway list, its friction order, its URLs, and the
 * hide-when-empty rule all live in channels.js — this module only
 * turns `filterDoorways()` output into markup. It never owns a
 * doorway list of its own and never re-implements URL filtering.
 *
 * Pure ES module with a string-returning renderer, so the same code
 * runs in the browser and under vitest in Node:
 *
 *   doorwaysGridHTML(channels)  -> HTML string for the 5-card grid
 *   doorwayCardHTML(doorway)    -> HTML string for one card
 *   mountDoorways(el, channels) -> renders into a DOM node (browser)
 *
 * Contracts held here:
 *   - Exactly the doorways channels.js reports as visible render, in
 *     friction order (Req 14.1). A doorway with an empty/unsafe URL is
 *     absent, never a dead link (Req 14.7).
 *   - Every doorway CTA is an external link carrying target="_blank"
 *     rel="noopener noreferrer", so `/join/` survives in the original
 *     browsing context (Req 14.4).
 *   - Discord renders as a live, direct invite. No coming-soon badge,
 *     no notify-me field, no disabled state (Req 14.5).
 *   - Each card's Code of Conduct line precedes that card's join CTA in
 *     reading order (Req 14.3).
 *
 * Styles are consumed from the `/join/` page's style block
 * (.doorway-card*, .doorways-grid) which owns the grid placement.
 *
 * Validates: Requirements 14.1, 14.3, 14.4, 14.5, 14.7
 * ----------------------------------------------------------
 */

import { CHANNELS, filterDoorways } from './lib/channels.js';
import { sanitizeAttribute, sanitizeURL } from './lib/sanitize.js';

/** Canonical Code of Conduct route. */
export const COC_PATH = '/code-of-conduct/';

/**
 * Per-doorway page copy. Approved copy from JOIN_STRATEGY.md §9, with the
 * Discord card updated: the server is live, so it is a direct invite.
 * Keyed by the doorway keys channels.js owns.
 */
const COPY = Object.freeze({
  whatsapp: Object.freeze({
    body: 'The casual room. ~280 members, daily chatter, weekly questions. Mute any time. '
        + 'No DMs from strangers — ask in the room first.',
    coc: 'House rules in the',
  }),
  cncf: Object.freeze({
    body: 'See the community before you join it. RSVP via our official CNCF chapter page. '
        + 'Free. Pakistani-time. Recordings posted after.',
    coc: 'By attending you agree to the',
  }),
  social: Object.freeze({
    body: 'Read-only. Long-form on LinkedIn. Quick takes on X. Tool Tuesday on Instagram. '
        + 'Twice a week, max. Zero DM sales.',
    coc: 'House rules in the',
  }),
  github: Object.freeze({
    body: 'The formal lane. Get on the members map, earn the badge, unlock Contributor and '
        + 'Mentor ranks. One issue → Newbie team → PR or form → Member.',
    coc: 'Membership terms in the',
  }),
  discord: Object.freeze({
    body: 'The deep technical home: threaded, searchable, channel-organised. The doors are '
        + 'open — the invite drops you straight in.',
    coc: 'House rules in the',
  }),
});

/** Display labels for the social doorway's secondary feeds. */
const FEED_LABELS = Object.freeze({
  linkedin: 'LinkedIn',
  x: 'X',
  instagram: 'Instagram',
});

/** Two-digit card number, e.g. 1 -> "01". */
function cardNumber(order) {
  return String(order).padStart(2, '0');
}

/** The CSS modifier for a doorway key. */
function variant(key) {
  return `doorway-card--${key}`;
}

/** Secondary feed links for the social doorway, or '' when there are none. */
function feedsHTML(feeds) {
  const links = (feeds || [])
    .map((feed) => ({ label: FEED_LABELS[feed.key] || feed.key, url: sanitizeURL(feed.url) }))
    .filter((feed) => feed.url !== '')
    .map((feed) => `<a href="${feed.url}" target="_blank" rel="noopener noreferrer">${feed.label}</a>`);

  if (links.length === 0) return '';
  return `\n                        <p class="doorway-card__feeds">${links.join(' · ')}</p>`;
}

/**
 * One doorway card. Returns '' when the doorway carries no safe URL, so an
 * unusable doorway is absent rather than rendered as a dead link (Req 14.7).
 *
 * @param {{ key: string, url: string, order: number, label: string, title: string,
 *   cta: string, friction: string, target: string, rel: string,
 *   feeds?: { key: string, url: string }[] }} doorway - A filterDoorways() entry.
 * @returns {string} HTML string.
 */
export function doorwayCardHTML(doorway) {
  if (!doorway || typeof doorway !== 'object') return '';

  const href = sanitizeURL(doorway.url);
  if (href === '') return '';

  const key = sanitizeAttribute(doorway.key);
  const copy = COPY[doorway.key] || { body: '', coc: 'House rules in the' };
  const target = sanitizeAttribute(doorway.target || '_blank');
  const rel = sanitizeAttribute(doorway.rel || 'noopener noreferrer');

  return `
                    <article class="doorway-card ${variant(key)}" data-doorway="${key}">
                        <div class="doorway-card__topline">
                            <span class="doorway-card__eyebrow">// ${cardNumber(doorway.order)} · ${sanitizeAttribute(doorway.label).toLowerCase()}</span>
                            <span class="doorway-card__friction">Friction: ${sanitizeAttribute(doorway.friction)}</span>
                        </div>
                        <h3 class="doorway-card__title">${sanitizeAttribute(doorway.title)}</h3>
                        <p class="doorway-card__body">${copy.body}</p>
                        <p class="doorway-card__coc">${copy.coc} <a href="${COC_PATH}">Code of Conduct</a>.</p>
                        <a href="${href}" class="doorway-card__cta" target="${target}" rel="${rel}">
                            ${sanitizeAttribute(doorway.cta)}
                            <span aria-hidden="true">→</span>
                            <span class="sr-only">(opens in a new tab)</span>
                        </a>${feedsHTML(doorway.feeds)}
                    </article>`;
}

/**
 * The whole doorway grid, in the friction order channels.js defines.
 *
 * @param {Record<string, unknown>} [channels=CHANNELS] - Doorway key -> URL config.
 * @returns {string} HTML string containing one <article> per visible doorway.
 */
export function doorwaysGridHTML(channels = CHANNELS) {
  return filterDoorways(channels)
    .map((doorway) => doorwayCardHTML(doorway))
    .filter((html) => html !== '')
    .join('\n');
}

/**
 * Render the grid into a DOM node. Browser-only helper; no-ops without a node.
 *
 * @param {Element|string} target - Element or element id to render into.
 * @param {Record<string, unknown>} [channels=CHANNELS]
 * @returns {number} How many doorways were rendered.
 */
export function mountDoorways(target, channels = CHANNELS) {
  const el = typeof target === 'string'
    ? (typeof document !== 'undefined' ? document.getElementById(target) : null)
    : target;
  if (!el) return 0;

  const doorways = filterDoorways(channels);
  el.innerHTML = doorwaysGridHTML(channels);
  return doorways.length;
}

/**
 * Load `data/channels.json` and render the grid, falling back to the compiled
 * CHANNELS default if the fetch fails so the doorways never disappear.
 *
 * @param {Element|string} target
 * @param {string} [url='/data/channels.json']
 * @returns {Promise<number>} How many doorways were rendered.
 */
export async function mountDoorwaysFromConfig(target, url = '/data/channels.json') {
  let channels = CHANNELS;

  try {
    const response = await fetch(url);
    if (response.ok) {
      const seed = await response.json();
      if (seed && typeof seed === 'object') channels = seed;
    }
  } catch {
    // Offline or blocked — the compiled default is the same seed.
  }

  return mountDoorways(target, channels);
}
