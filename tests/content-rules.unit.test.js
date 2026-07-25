/**
 * Unit tests for the content-honesty rules and intake submit-target selection
 * (Task 11.2).
 *
 * Concrete examples: published vs "not yet public" project cards (including the
 * three real unlinked cards on /projects/), win attribution by person, team, or
 * linked artifact, the wins empty state, and endpoint / mailto / coming-soon
 * submit targets.
 *
 * Validates: Requirements 7.7, 19.4, 19.5, 15.2
 */
import { describe, it, expect } from 'vitest';
import {
  NOT_YET_PUBLIC_LABEL,
  WINS_EMPTY_LABEL,
  SUBMIT_MODES,
  projectRepoRule,
  winIsAttributed,
  selectAttributedWins,
  selectSubmitTarget,
} from '../js/lib/content-rules.js';

describe('projectRepoRule — repo link iff published repository (Req 7.7)', () => {
  it('links a project with a published repository URL', () => {
    const result = projectRepoRule({
      name: 'CNSPK Website',
      repoUrl: 'https://github.com/Cloud-Native-Security-Pakistan/cloudnativesecurity.pk-website',
    });
    expect(result.showLink).toBe(true);
    expect(result.url).toBe(
      'https://github.com/Cloud-Native-Security-Pakistan/cloudnativesecurity.pk-website',
    );
    expect(result.statusLabel).toBeUndefined();
  });

  it.each([
    ['CTF Challenges', { name: 'CTF Challenges' }],
    ['Community Bot', { name: 'Community Bot', repoUrl: '' }],
    ['The Dispatch', { name: 'The Dispatch', repoUrl: '   ' }],
  ])('labels %s as not yet public with no link', (_name, project) => {
    const result = projectRepoRule(project);
    expect(result.showLink).toBe(false);
    expect(result.statusLabel).toBe(NOT_YET_PUBLIC_LABEL);
    expect(result.url).toBeUndefined();
  });

  it('rejects placeholder and non-absolute repo values', () => {
    for (const repoUrl of ['#', 'TBD', 'coming-soon', 'github.com/x/y', '/projects/']) {
      expect(projectRepoRule({ repoUrl }).showLink).toBe(false);
    }
  });

  it('keeps a card unlinked when publication is explicitly false', () => {
    const result = projectRepoRule({
      repoUrl: 'https://github.com/Cloud-Native-Security-Pakistan/ctf-challenges',
      published: false,
    });
    expect(result.showLink).toBe(false);
    expect(result.statusLabel).toBe(NOT_YET_PUBLIC_LABEL);
  });

  it('treats a missing/invalid project record as not yet public', () => {
    expect(projectRepoRule(undefined).showLink).toBe(false);
    expect(projectRepoRule(null).statusLabel).toBe(NOT_YET_PUBLIC_LABEL);
  });
});

describe('winIsAttributed — render iff attributed (Req 19.4)', () => {
  it('accepts a named person', () => {
    expect(winIsAttributed({ member: 'Ayesha Khan', title: 'PR merged upstream' })).toBe(true);
  });

  it('accepts a named team', () => {
    expect(winIsAttributed({ team: 'CNSPK Labs', title: 'Workshop shipped' })).toBe(true);
  });

  it('accepts a linked artifact', () => {
    expect(winIsAttributed({ url: 'https://github.com/kubernetes/kubernetes/pull/1' })).toBe(true);
  });

  it('rejects a win with no attribution at all', () => {
    expect(winIsAttributed({ title: 'Something shipped', date: '2025-01-01' })).toBe(false);
  });

  it('rejects placeholder attribution and non-resolvable artifact links', () => {
    expect(winIsAttributed({ member: '  ', url: '#' })).toBe(false);
    expect(winIsAttributed({ member: 'anonymous' })).toBe(false);
    expect(winIsAttributed({ team: 'TBD', url: 'not-a-url' })).toBe(false);
    expect(winIsAttributed(undefined)).toBe(false);
  });
});

describe('selectAttributedWins — empty state when nothing qualifies (Req 19.5)', () => {
  it('keeps only attributed wins, in source order', () => {
    const wins = [
      { member: 'Ayesha Khan', title: 'Talk accepted' },
      { title: 'Unattributed' },
      { url: 'https://github.com/falcosecurity/falco/pull/2' },
    ];
    const result = selectAttributedWins(wins);
    expect(result.isEmpty).toBe(false);
    expect(result.wins).toEqual([wins[0], wins[2]]);
    expect(result.emptyStateLabel).toBeUndefined();
  });

  it('signals an empty state for an empty or fully unattributed list', () => {
    for (const input of [[], [{ title: 'x' }, { member: '' }], undefined]) {
      const result = selectAttributedWins(input);
      expect(result.isEmpty).toBe(true);
      expect(result.wins).toEqual([]);
      expect(result.emptyStateLabel).toBe(WINS_EMPTY_LABEL);
    }
  });
});

describe('selectSubmitTarget — configured backend or labeled fallback (Req 15.2)', () => {
  it('submits to a configured same-origin function route', () => {
    const result = selectSubmitTarget({ endpoint: '/api/hire', mailto: 'hello@cloudnativesecurity.pk' });
    expect(result).toEqual({ mode: SUBMIT_MODES.ENDPOINT, target: '/api/hire', isFallback: false });
  });

  it('submits to a configured absolute endpoint', () => {
    const result = selectSubmitTarget({ endpoint: 'https://cloudnativesecurity.pk/api/dispatch' });
    expect(result.mode).toBe('endpoint');
    expect(result.target).toBe('https://cloudnativesecurity.pk/api/dispatch');
    expect(result.isFallback).toBe(false);
  });

  it('falls back to a labeled mailto target when no endpoint is configured', () => {
    const result = selectSubmitTarget({ endpoint: '', mailto: 'hello@cloudnativesecurity.pk' });
    expect(result.mode).toBe('mailto');
    expect(result.target).toBe('mailto:hello@cloudnativesecurity.pk');
    expect(result.isFallback).toBe(true);
    expect(result.label).toMatch(/backend/i);
  });

  it('accepts a mailto: prefixed fallback value without double-prefixing', () => {
    const result = selectSubmitTarget({ mailto: 'mailto:hello@cloudnativesecurity.pk' });
    expect(result.target).toBe('mailto:hello@cloudnativesecurity.pk');
  });

  it('never treats a mailto value as a backend endpoint', () => {
    const result = selectSubmitTarget({ endpoint: 'mailto:hello@cloudnativesecurity.pk' });
    expect(result.mode).toBe('mailto');
    expect(result.isFallback).toBe(true);
  });

  it('falls back to a labeled coming-soon state with no target', () => {
    for (const config of [{}, { endpoint: '   ', mailto: 'nope' }, undefined]) {
      const result = selectSubmitTarget(config);
      expect(result.mode).toBe('coming-soon');
      expect(result.target).toBeUndefined();
      expect(result.isFallback).toBe(true);
      expect(result.label).toMatch(/coming soon/i);
    }
  });
});
