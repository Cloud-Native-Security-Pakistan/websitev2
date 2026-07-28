/**
 * Feature: cnspk-website-platform, Property 11: Content surfaces show items only
 * when their backing data qualifies; intake submits to the configured backend or
 * a labeled fallback.
 *
 * For any project record, a repository link is rendered if and only if the
 * project links to a published repository (otherwise a visible "not yet public"
 * status label and no link); for any win record, the wins feed renders it if and
 * only if it carries attribution to a named person, team, or linked artifact
 * (otherwise it is excluded, with an empty state when none qualify); and for any
 * sub-ask or dispatch intake configuration, the form's submit target is the
 * configured backend endpoint when present and a clearly labeled
 * `mailto:`/coming-soon fallback otherwise.
 *
 * Validates: Requirements 7.7, 19.4, 19.5, 15.2, 19.3
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  NOT_YET_PUBLIC_LABEL,
  SUBMIT_FALLBACK_LABELS,
  SUBMIT_MODES,
  WINS_EMPTY_LABEL,
  projectRepoRule,
  selectAttributedWins,
  selectSubmitTarget,
  winIsAttributed,
} from '../../js/lib/content-rules.js';

/* ---------------------------------------------------------------------------
   (a) Project repo links
   --------------------------------------------------------------------------- */

/** Repo URL candidates, each classified by construction. */
const REPO_VALUES = [
  { value: 'https://github.com/Cloud-Native-Security-Pakistan/websitev2', absolute: true },
  { value: '  http://git.example.test/cnspk/labs  ', absolute: true },
  { value: 'https://gitlab.example.test/a/b?x=1#y', absolute: true },
  // Real-looking but not a resolvable absolute http(s) URL.
  { value: 'github.com/Cloud-Native-Security-Pakistan/x', absolute: false },
  { value: '/projects/internal', absolute: false },
  { value: 'ftp://files.example.test/repo.zip', absolute: false },
  // Placeholder tokens the module must never treat as a real value.
  { value: '#', absolute: false },
  { value: 'TBD', absolute: false },
  { value: 'coming-soon', absolute: false },
  { value: 'n/a', absolute: false },
  { value: '-', absolute: false },
  { value: '', absolute: false },
  { value: '   ', absolute: false },
  { value: undefined, absolute: false },
];

const REPO_KEYS = ['repoUrl', 'repositoryUrl', 'repository', 'repo', 'url'];

/** Publication flags: absent, explicitly published, or explicitly unpublished. */
const PUBLICATION_FLAGS = [
  { flags: {}, explicitlyUnpublished: false },
  { flags: { published: true }, explicitlyUnpublished: false },
  { flags: { isPublic: true }, explicitlyUnpublished: false },
  { flags: { published: false }, explicitlyUnpublished: true },
  { flags: { isPublished: false }, explicitlyUnpublished: true },
  { flags: { isPublic: false }, explicitlyUnpublished: true },
  { flags: { repoPublished: false }, explicitlyUnpublished: true },
];

const projectArb = fc
  .tuple(
    fc.constantFrom(...REPO_VALUES),
    fc.constantFrom(...REPO_KEYS),
    fc.constantFrom(...PUBLICATION_FLAGS),
  )
  .map(([repo, key, publication]) => ({
    repo,
    project: {
      name: 'A project',
      ...publication.flags,
      ...(repo.value === undefined ? {} : { [key]: repo.value }),
    },
    expectLink: repo.absolute && !publication.explicitlyUnpublished,
  }));

/* ---------------------------------------------------------------------------
   (b) Wins attribution
   --------------------------------------------------------------------------- */

const PERSON_KEYS = ['member', 'person', 'name', 'author', 'username', 'handle'];
const TEAM_KEYS = ['team', 'org', 'organization', 'group'];
const ARTIFACT_KEYS = ['url', 'link', 'artifact', 'artifactUrl', 'proofUrl'];

/** Named values vs the placeholder tokens that must not count as attribution. */
const NAME_VALUES = [
  { value: 'Ayesha Khan', real: true },
  { value: '  CNSPK Labs crew  ', real: true },
  { value: 'anonymous', real: false },
  { value: 'n/a', real: false },
  { value: 'TBD', real: false },
  { value: 'unknown', real: false },
  { value: '#', real: false },
  { value: '', real: false },
  { value: undefined, real: false },
];

const ARTIFACT_VALUES = [
  { value: 'https://cncf.io/reports/cnspk', absolute: true },
  { value: ' http://blog.example.test/win ', absolute: true },
  { value: '#', absolute: false },
  { value: 'coming-soon', absolute: false },
  { value: '/wins/local', absolute: false },
  { value: 'not a url', absolute: false },
  { value: '', absolute: false },
  { value: undefined, absolute: false },
];

const winArb = fc
  .tuple(
    fc.constantFrom(...NAME_VALUES),
    fc.constantFrom(...PERSON_KEYS),
    fc.constantFrom(...NAME_VALUES),
    fc.constantFrom(...TEAM_KEYS),
    fc.constantFrom(...ARTIFACT_VALUES),
    fc.constantFrom(...ARTIFACT_KEYS),
  )
  .map(([person, personKey, team, teamKey, artifact, artifactKey]) => ({
    win: {
      title: 'A win',
      ...(person.value === undefined ? {} : { [personKey]: person.value }),
      ...(team.value === undefined ? {} : { [teamKey]: team.value }),
      ...(artifact.value === undefined ? {} : { [artifactKey]: artifact.value }),
    },
    expectRender: person.real || team.real || artifact.absolute,
  }));

/* ---------------------------------------------------------------------------
   (c) Intake submit target
   --------------------------------------------------------------------------- */

/**
 * Endpoint-slot candidates: `isEndpoint` marks a real backend (same-origin path
 * or absolute http(s) URL); `address` marks a value that is not a backend but is
 * still a usable fallback address.
 */
const ENDPOINT_VALUES = [
  { value: '/api/hire', isEndpoint: true, address: null },
  { value: '  /api/dispatch  ', isEndpoint: true, address: null },
  { value: 'https://forms.example.test/f/1', isEndpoint: true, address: null },
  { value: 'http://forms.example.test/f/2', isEndpoint: true, address: null },
  { value: 'mailto:desk@cnspk.test', isEndpoint: false, address: 'desk@cnspk.test' },
  { value: 'desk@cnspk.test', isEndpoint: false, address: 'desk@cnspk.test' },
  { value: '#', isEndpoint: false, address: null },
  { value: 'TBD', isEndpoint: false, address: null },
  { value: 'coming-soon', isEndpoint: false, address: null },
  { value: 'n/a', isEndpoint: false, address: null },
  { value: 'anonymous', isEndpoint: false, address: null },
  { value: '', isEndpoint: false, address: null },
  { value: '   ', isEndpoint: false, address: null },
  { value: undefined, isEndpoint: false, address: null },
];

const ENDPOINT_KEYS = ['endpoint', 'endpointUrl', 'url'];

const MAILTO_VALUES = [
  { value: 'hello@cnspk.test', address: 'hello@cnspk.test' },
  { value: '  mailto:hi@cnspk.test  ', address: 'hi@cnspk.test' },
  { value: 'not-an-email', address: null },
  { value: 'anonymous', address: null },
  { value: 'n/a', address: null },
  { value: '#', address: null },
  { value: '', address: null },
  { value: undefined, address: null },
];

const MAILTO_KEYS = ['mailto', 'email', 'fallbackEmail'];

const intakeArb = fc
  .tuple(
    fc.constantFrom(...ENDPOINT_VALUES),
    fc.constantFrom(...ENDPOINT_KEYS),
    fc.constantFrom(...MAILTO_VALUES),
    fc.constantFrom(...MAILTO_KEYS),
  )
  .map(([endpoint, endpointKey, mailto, mailtoKey]) => {
    const config = {
      ...(endpoint.value === undefined ? {} : { [endpointKey]: endpoint.value }),
      ...(mailto.value === undefined ? {} : { [mailtoKey]: mailto.value }),
    };

    // The endpoint slot only feeds the address fallback under the `endpoint` key.
    const endpointAddress = endpointKey === 'endpoint' ? endpoint.address : null;
    const address = mailto.address || endpointAddress;

    let expected;
    if (endpoint.isEndpoint) {
      expected = { mode: SUBMIT_MODES.ENDPOINT, target: String(endpoint.value).trim() };
    } else if (address) {
      expected = { mode: SUBMIT_MODES.MAILTO, target: `mailto:${address}` };
    } else {
      expected = { mode: SUBMIT_MODES.COMING_SOON, target: undefined };
    }

    return { config, expected };
  });

describe('Property 11: content surfaces qualify their data, and intake picks a real target', () => {
  it('links only published repos, renders only attributed wins, and selects the endpoint or a labeled fallback', () => {
    fc.assert(
      fc.property(
        projectArb,
        fc.array(winArb, { maxLength: 8 }),
        intakeArb,
        fc.constantFrom(null, undefined, 42, 'not-a-config'),
        (project, wins, intake, nonObject) => {
          // --- (a) A repo link iff the repo is a published absolute URL -------
          const rule = projectRepoRule(project.project);
          expect(rule.showLink).toBe(project.expectLink);
          if (project.expectLink) {
            expect(rule.url).toBe(String(project.repo.value).trim());
            expect(rule.statusLabel).toBeUndefined();
          } else {
            expect(rule.url).toBeUndefined();
            expect(rule.statusLabel).toBe(NOT_YET_PUBLIC_LABEL);
          }
          // A record with no data at all is never linked.
          expect(projectRepoRule(nonObject)).toEqual({
            showLink: false,
            statusLabel: NOT_YET_PUBLIC_LABEL,
          });

          // --- (b) A win renders iff it carries attribution -------------------
          wins.forEach((entry) => {
            expect(winIsAttributed(entry.win)).toBe(entry.expectRender);
          });

          const list = wins.map((entry) => entry.win);
          const expectedVisible = wins.filter((entry) => entry.expectRender).map((e) => e.win);
          const selected = selectAttributedWins(list);

          // Source order is preserved, and the empty state appears iff nothing
          // qualifies.
          expect(selected.wins).toEqual(expectedVisible);
          expect(selected.isEmpty).toBe(expectedVisible.length === 0);
          if (selected.isEmpty) {
            expect(selected.wins).toEqual([]);
            expect(selected.emptyStateLabel).toBe(WINS_EMPTY_LABEL);
          } else {
            expect(selected.emptyStateLabel).toBeUndefined();
          }
          expect(selectAttributedWins(nonObject).isEmpty).toBe(true);

          // --- (c) The submit target is real, or a labeled fallback -----------
          const target = selectSubmitTarget(intake.config);
          expect(target.mode).toBe(intake.expected.mode);
          expect(target.target).toBe(intake.expected.target);

          const isFallbackMode =
            target.mode === SUBMIT_MODES.MAILTO || target.mode === SUBMIT_MODES.COMING_SOON;
          expect(target.isFallback).toBe(isFallbackMode);
          if (isFallbackMode) {
            expect(target.label).toBe(SUBMIT_FALLBACK_LABELS[target.mode]);
            expect(target.label).toBeTruthy();
          } else {
            expect(target.label).toBeUndefined();
          }

          // No config at all is the labeled coming-soon state, never a silent
          // broken submit.
          const noConfig = selectSubmitTarget(nonObject);
          expect(noConfig.mode).toBe(SUBMIT_MODES.COMING_SOON);
          expect(noConfig.isFallback).toBe(true);
          expect(noConfig.label).toBe(SUBMIT_FALLBACK_LABELS[SUBMIT_MODES.COMING_SOON]);
        },
      ),
      { numRuns: 300 },
    );
  });
});
