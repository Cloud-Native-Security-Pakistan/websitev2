/**
 * content-rules — content-honesty rules for project repo links and wins
 * attribution, plus intake submit-target selection.
 *
 * Pure ES module: importable in both the browser and Node.
 *
 * Guiding rule: honesty over fabrication. A surface shows an item only when the
 * backing data qualifies, and a form only advertises a submit target that
 * actually works:
 *   - a project renders a repository link iff it links to a published
 *     repository, otherwise no link plus a visible "not yet public" label;
 *   - a win renders iff it carries attribution to a named person, a named team,
 *     or a linked artifact, otherwise it is excluded (empty state when none
 *     qualify);
 *   - an intake form submits to the configured backend endpoint when one is
 *     present, otherwise it falls back to a clearly labeled `mailto:` or
 *     coming-soon state. Forms submit directly to a real backend; `mailto:` is a
 *     last-resort fallback the caller MUST label visibly.
 *
 * Validates: Requirements 7.7, 19.4, 19.5, 15.2
 */

/** Visible status label for a project with no published repository. */
export const NOT_YET_PUBLIC_LABEL = 'Not yet public';

/** Visible empty-state label for the wins feed when no win qualifies. */
export const WINS_EMPTY_LABEL = 'No attributable wins yet';

/** Submit-target modes returned by {@link selectSubmitTarget}. */
export const SUBMIT_MODES = Object.freeze({
  ENDPOINT: 'endpoint',
  MAILTO: 'mailto',
  COMING_SOON: 'coming-soon',
});

/** Visible labels the caller must render for each fallback mode. */
export const SUBMIT_FALLBACK_LABELS = Object.freeze({
  [SUBMIT_MODES.MAILTO]: 'No intake backend configured — opens your email client',
  [SUBMIT_MODES.COMING_SOON]: 'Coming soon — submissions are not open yet',
});

/**
 * Placeholder tokens that stand in for missing content. They are never treated
 * as a real value, so a card or feed item cannot qualify on a stub.
 */
const PLACEHOLDER_TOKENS = new Set([
  '',
  '-',
  '--',
  '—',
  '#',
  'tbd',
  'tba',
  'todo',
  'n/a',
  'na',
  'none',
  'null',
  'undefined',
  'unknown',
  'anonymous',
  'placeholder',
  'coming soon',
  'coming-soon',
  'not yet public',
]);

/**
 * A usable text value: a string that carries content rather than a placeholder.
 * @param {unknown} value
 * @returns {boolean}
 */
function isRealText(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed === '') return false;
  return !PLACEHOLDER_TOKENS.has(trimmed.toLowerCase());
}

/**
 * A resolvable absolute `http(s)` URL — the only shape allowed to become a
 * rendered link. Placeholder strings and relative fragments are rejected.
 * @param {unknown} value
 * @returns {boolean}
 */
function isAbsoluteHttpUrl(value) {
  if (!isRealText(value)) return false;
  try {
    const url = new URL(value.trim());
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.host !== '';
  } catch {
    return false;
  }
}

/** First candidate key holding a real text value, else undefined. */
function pickText(record, keys) {
  for (const key of keys) {
    if (isRealText(record[key])) return record[key].trim();
  }
  return undefined;
}

/**
 * Explicit "this repository is not published" signal. Any of the publication
 * flags set to a falsey-but-present value keeps the card unlinked even when a
 * URL is present, so an in-progress repo is never advertised as live.
 * @param {object} project
 * @returns {boolean}
 */
function isExplicitlyUnpublished(project) {
  const flags = ['published', 'isPublished', 'public', 'isPublic', 'repoPublished'];
  return flags.some((flag) => project[flag] === false);
}

/**
 * Decide a project's repo-link rendering: a link iff it points to a published
 * repository, otherwise a "not yet public" status label and no link.
 *
 * Accepted repository keys: `repoUrl`, `repositoryUrl`, `repository`, `repo`,
 * `url`. A repository counts as published when its URL is an absolute `http(s)`
 * URL and no publication flag is explicitly `false`.
 *
 * @param {object} project
 * @returns {{ showLink: boolean, url?: string, statusLabel?: string }}
 */
export function projectRepoRule(project) {
  const record = project && typeof project === 'object' ? project : {};

  const repoUrl = pickText(record, ['repoUrl', 'repositoryUrl', 'repository', 'repo', 'url']);
  const published = isAbsoluteHttpUrl(repoUrl) && !isExplicitlyUnpublished(record);

  if (!published) {
    return { showLink: false, statusLabel: NOT_YET_PUBLIC_LABEL };
  }

  return { showLink: true, url: repoUrl };
}

/**
 * Decide whether a win renders: only when attributed to a named person, a named
 * team, or a linked artifact.
 *
 * Accepted person keys: `member`, `person`, `name`, `author`, `username`,
 * `handle`. Accepted team keys: `team`, `org`, `organization`, `group`.
 * Accepted artifact keys: `url`, `link`, `artifact`, `artifactUrl`, `proofUrl`
 * (must be an absolute `http(s)` URL).
 *
 * @param {object} win
 * @returns {boolean}
 */
export function winIsAttributed(win) {
  const record = win && typeof win === 'object' ? win : {};

  const person = pickText(record, ['member', 'person', 'name', 'author', 'username', 'handle']);
  if (person !== undefined) return true;

  const team = pickText(record, ['team', 'org', 'organization', 'group']);
  if (team !== undefined) return true;

  const artifact = pickText(record, ['url', 'link', 'artifact', 'artifactUrl', 'proofUrl']);
  return isAbsoluteHttpUrl(artifact);
}

/**
 * Project a wins list onto what the feed may render: the attributed wins in
 * source order, plus an empty-state signal when nothing qualifies.
 *
 * @param {object[]} wins
 * @returns {{ wins: object[], isEmpty: boolean, emptyStateLabel?: string }}
 */
export function selectAttributedWins(wins) {
  const list = Array.isArray(wins) ? wins : [];
  const visible = list.filter((win) => winIsAttributed(win));

  if (visible.length === 0) {
    return { wins: [], isEmpty: true, emptyStateLabel: WINS_EMPTY_LABEL };
  }

  return { wins: visible, isEmpty: false };
}

/**
 * A configured backend endpoint: a non-empty absolute `http(s)` URL or a
 * same-origin path such as `/api/hire`. A `mailto:` value is not a backend.
 * @param {unknown} value
 * @returns {boolean}
 */
function isConfiguredEndpoint(value) {
  if (!isRealText(value)) return false;
  const trimmed = value.trim();
  if (trimmed.startsWith('/')) return true;
  return isAbsoluteHttpUrl(trimmed);
}

/**
 * Normalize a mailto fallback value to a `mailto:` target, or undefined when the
 * value is not a usable address.
 * @param {unknown} value
 * @returns {string | undefined}
 */
function toMailtoTarget(value) {
  if (!isRealText(value)) return undefined;
  const trimmed = value.trim();
  const address = trimmed.toLowerCase().startsWith('mailto:') ? trimmed.slice('mailto:'.length) : trimmed;
  // Pragmatic `local@domain` shape — the same check the intake validator uses.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return undefined;
  return `mailto:${address}`;
}

/**
 * Select an intake form's submit target: the configured endpoint when present,
 * otherwise a clearly labeled `mailto:`/coming-soon fallback.
 *
 * `isFallback` is true for both fallback modes so the caller renders `label`
 * visibly rather than presenting a broken submission.
 *
 * @param {{ endpoint?: string, mailto?: string }} config
 * @returns {{ mode: 'endpoint' | 'mailto' | 'coming-soon', target?: string, isFallback: boolean, label?: string }}
 */
export function selectSubmitTarget(config) {
  const settings = config && typeof config === 'object' ? config : {};

  const endpoint = [settings.endpoint, settings.endpointUrl, settings.url].find((candidate) =>
    isConfiguredEndpoint(candidate),
  );
  if (endpoint !== undefined) {
    return { mode: SUBMIT_MODES.ENDPOINT, target: endpoint.trim(), isFallback: false };
  }

  // A `mailto:` value in the endpoint slot is not a backend, but it is still a
  // usable fallback address, so it is considered here rather than discarded.
  const mailto = [settings.mailto, settings.email, settings.fallbackEmail, settings.endpoint]
    .map((candidate) => toMailtoTarget(candidate))
    .find((candidate) => candidate !== undefined);
  if (mailto !== undefined) {
    return {
      mode: SUBMIT_MODES.MAILTO,
      target: mailto,
      isFallback: true,
      label: SUBMIT_FALLBACK_LABELS[SUBMIT_MODES.MAILTO],
    };
  }

  return {
    mode: SUBMIT_MODES.COMING_SOON,
    isFallback: true,
    label: SUBMIT_FALLBACK_LABELS[SUBMIT_MODES.COMING_SOON],
  };
}
