/**
 * channels — the doorway config plus the filter that decides which /join/
 * call-to-action renders.
 *
 * Pure ES module: importable in both the browser and Node.
 *
 * Rules enforced (Property 10):
 *   - `/join/` offers exactly five doorways: whatsapp, cncf, social, github,
 *     discord (Requirement 14.1).
 *   - A doorway's call-to-action renders **iff** its configured external URL is
 *     non-empty. Missing, empty, or whitespace-only hides that doorway only and
 *     every remaining doorway with a valid URL still renders (Requirement 14.7).
 *   - Every doorway is an external link opened in a separate browsing context,
 *     so `/join/` survives in the original context (Requirement 14.4).
 *   - Discord is a live, direct invite — never coming-soon, notify-me, or
 *     otherwise disabled (Requirement 14.5).
 *
 * `CHANNELS` below is the compiled default and mirrors `data/channels.json`,
 * which is the seed the site fetches at runtime. `tests/channels.unit.test.js`
 * asserts the two never drift.
 *
 * Validates: Requirements 14.1, 14.4, 14.7
 */

/**
 * External doorway URLs. An empty value hides only that doorway.
 * @type {Readonly<Record<string, string>>}
 */
export const CHANNELS = Object.freeze({
  whatsapp: 'https://chat.whatsapp.com/F5Hf1ZwI22TK6EcV6zz4wo',
  cncf: 'https://community.cncf.io/cloud-native-security-pakistan/',
  github: 'https://github.com/Cloud-Native-Security-Pakistan/becoming-a-member',
  discord: 'https://discord.gg/wXFWN5ensp',
  linkedin: 'https://www.linkedin.com/company/cloud-native-security-pakistan',
  x: 'https://x.com/CloudSecPK',
  instagram: 'https://www.instagram.com/cloudnativesecuritypk',
});

/** The single canonical destination for every site-wide primary Join control. */
export const CANONICAL_JOIN_PATH = '/join/';

/**
 * The five doorways, in friction order. `urlKeys` lists the config keys that can
 * supply the doorway's URL, in priority order — the social doorway accepts an
 * explicit `social` value and otherwise falls back to the configured feeds.
 * @type {readonly object[]}
 */
export const DOORWAYS = Object.freeze([
  Object.freeze({
    key: 'whatsapp',
    order: 1,
    urlKeys: Object.freeze(['whatsapp']),
    label: 'WhatsApp',
    title: 'Tap In',
    cta: 'Join WhatsApp',
    friction: 'Lowest',
  }),
  Object.freeze({
    key: 'cncf',
    order: 2,
    urlKeys: Object.freeze(['cncf']),
    label: 'CNCF Chapter',
    title: 'RSVP a Session',
    cta: 'Browse Events',
    friction: 'Medium',
  }),
  Object.freeze({
    key: 'social',
    order: 3,
    urlKeys: Object.freeze(['social', 'linkedin', 'x', 'instagram']),
    label: 'Social',
    title: 'Follow the Signal',
    cta: 'Pick a feed',
    friction: 'Near-zero',
  }),
  Object.freeze({
    key: 'github',
    order: 4,
    urlKeys: Object.freeze(['github']),
    label: 'GitHub',
    title: 'Become a Member',
    cta: 'Start the request',
    friction: 'High',
  }),
  Object.freeze({
    key: 'discord',
    order: 5,
    // A live, direct invite. Never a waitlist key, never a coming-soon state.
    urlKeys: Object.freeze(['discord']),
    label: 'Discord',
    title: 'The Inner Circle',
    cta: 'Open the invite',
    friction: 'Low',
  }),
]);

/** The five doorway keys, in render order. @type {readonly string[]} */
export const DOORWAY_KEYS = Object.freeze(DOORWAYS.map((d) => d.key));

/** Config keys that feed the social doorway's secondary feed list. */
const SOCIAL_FEED_KEYS = Object.freeze(['linkedin', 'x', 'instagram']);

/**
 * A URL is renderable when it is a string with non-whitespace content.
 * @param {unknown} url
 * @returns {boolean}
 */
export function isRenderableUrl(url) {
  return typeof url === 'string' && url.trim() !== '';
}

/** Normalized (trimmed) URL, or '' when the value is not renderable. */
function normalizeUrl(url) {
  return isRenderableUrl(url) ? url.trim() : '';
}

/** Treat a non-object config as an empty config rather than throwing. */
function asConfig(channels) {
  return channels && typeof channels === 'object' ? channels : {};
}

/**
 * Resolve a doorway's external URL from a channels config.
 * @param {Record<string, unknown>} channels
 * @param {string} key - One of DOORWAY_KEYS.
 * @returns {string} The URL, or '' when the doorway has no usable URL.
 */
export function resolveDoorwayUrl(channels, key) {
  const config = asConfig(channels);
  const doorway = DOORWAYS.find((d) => d.key === key);
  if (!doorway) return '';

  for (const urlKey of doorway.urlKeys) {
    const url = normalizeUrl(config[urlKey]);
    if (url !== '') return url;
  }
  return '';
}

/**
 * Whether a doorway's call-to-action renders for this config.
 * @param {Record<string, unknown>} channels
 * @param {string} key
 * @returns {boolean}
 */
export function isDoorwayVisible(channels, key) {
  return resolveDoorwayUrl(channels, key) !== '';
}

/**
 * Secondary social feeds for the social doorway, excluding the primary URL.
 * @param {Record<string, unknown>} channels
 * @returns {{ key: string, url: string }[]}
 */
function socialFeeds(channels, primaryUrl) {
  const config = asConfig(channels);
  return SOCIAL_FEED_KEYS.map((key) => ({ key, url: normalizeUrl(config[key]) }))
    .filter((feed) => feed.url !== '' && feed.url !== primaryUrl);
}

/**
 * Return the doorways whose configured external URL is non-empty, preserving all
 * remaining valid doorways and their friction order.
 *
 * Each returned doorway is a live external link: `external: true`,
 * `target: '_blank'`, `rel: 'noopener noreferrer'`. No doorway is ever emitted in
 * a coming-soon or disabled state — an unusable doorway is simply absent.
 *
 * @param {Record<string, unknown>} [channels=CHANNELS] - Doorway key -> external URL.
 * @returns {Array<{ key: string, url: string, order: number, label: string,
 *   title: string, cta: string, friction: string, external: boolean,
 *   target: string, rel: string, feeds?: { key: string, url: string }[] }>}
 */
export function filterDoorways(channels = CHANNELS) {
  const config = asConfig(channels);

  return DOORWAYS.reduce((visible, doorway) => {
    const url = resolveDoorwayUrl(config, doorway.key);
    if (url === '') return visible;

    const entry = {
      key: doorway.key,
      url,
      order: doorway.order,
      label: doorway.label,
      title: doorway.title,
      cta: doorway.cta,
      friction: doorway.friction,
      external: true,
      target: '_blank',
      rel: 'noopener noreferrer',
    };

    if (doorway.key === 'social') {
      entry.feeds = socialFeeds(config, url);
    }

    visible.push(entry);
    return visible;
  }, []);
}

/**
 * Whether a primary Join control points at the single canonical `/join/` page.
 * Accepts the bare path, a trailing-slash-less variant, and absolute site URLs.
 * @param {unknown} href
 * @returns {boolean}
 */
export function isCanonicalJoinHref(href) {
  if (typeof href !== 'string') return false;

  const trimmed = href.trim();
  if (trimmed === '') return false;

  // Strip query/hash, then any scheme+host, and normalize the trailing slash.
  const withoutFragment = trimmed.split('#')[0].split('?')[0];
  const path = withoutFragment.replace(/^https?:\/\/[^/]+/i, '');
  const normalized = path.endsWith('/') ? path : `${path}/`;

  return normalized === CANONICAL_JOIN_PATH;
}
