/**
 * Unit tests for the accessible directory equivalent and the honest degradation
 * states in js/lib/map-render.js, plus the load-status reporting in
 * js/members-source.js.
 *
 * Covers: the textual directory listing the same members as the map (mapped and
 * unmapped alike, gated members in neither), markup in a member row being
 * escaped, and the CSV-unreachable path falling back to the seed file with a
 * degraded state instead of a wrong pin.
 *
 * Validates: Requirements 4.6, 12.6
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DIRECTORY_COLUMNS,
  DIRECTORY_STATE_MESSAGES,
  MAPPED_LABEL,
  NOT_MAPPED_LABEL,
  buildDirectoryEntries,
  describeDirectoryState,
  renderDirectoryHTML,
  renderDirectoryStateHTML,
} from '../js/lib/map-render.js';

const readData = (name) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../data/${name}`, import.meta.url)), 'utf8'));

const pakistanCities = readData('pakistan-cities.json');

const MEMBERS = [
  { id: 'CNSPK-0001', memberNo: 'CNSPK-0001', name: 'Ayesha Khan', role: 'AppSec', city: 'Lahore', interests: ['k8s', 'supply chain'] },
  { id: 'CNSPK-0002', memberNo: 'CNSPK-0002', name: 'Bilal Ahmed', role: 'SRE', city: 'Atlantis', interests: 'runtime;policy' },
];

describe('buildDirectoryEntries', () => {
  it('lists every member, marking which ones got a pin', () => {
    const entries = buildDirectoryEntries(MEMBERS, pakistanCities);

    expect(entries).toHaveLength(2);
    expect(entries.map((e) => [e.name, e.mapped])).toEqual([
      ['Ayesha Khan', true],
      ['Bilal Ahmed', false],
    ]);
    expect(entries[0].lat).toBeCloseTo(31.5204, 1);
    expect(entries[1].lat).toBeNull();
    expect(entries[1].lng).toBeNull();
  });

  it('normalizes interests from a delimited string or an array', () => {
    const entries = buildDirectoryEntries(MEMBERS, pakistanCities);
    expect(entries[0].interests).toEqual(['k8s', 'supply chain']);
    expect(entries[1].interests).toEqual(['runtime', 'policy']);
  });

  it('excludes approval-gated members, so the text matches the map exactly', () => {
    const records = [
      { id: 'a', name: 'Ayesha', city: 'Lahore', approved: 'Yes' },
      { id: 'b', name: 'Bilal', city: 'Karachi', approved: '' },
      { id: 'c', name: 'Chand', city: 'Atlantis', approved: 'Yes' },
    ];
    const entries = buildDirectoryEntries(records, pakistanCities, {
      requireApproval: true,
      approvalField: 'approved',
    });

    expect(entries.map((e) => e.name)).toEqual(['Ayesha', 'Chand']);
    expect(entries.map((e) => e.mapped)).toEqual([true, false]);
  });

  it('handles an empty or malformed list without throwing', () => {
    expect(buildDirectoryEntries([], pakistanCities)).toEqual([]);
    expect(buildDirectoryEntries(null, pakistanCities)).toEqual([]);
    expect(buildDirectoryEntries([null], pakistanCities)[0].name).toBe('Unnamed member');
  });
});

describe('renderDirectoryHTML', () => {
  it('renders a captioned table with a header cell per column and a row per member', () => {
    const html = renderDirectoryHTML(buildDirectoryEntries(MEMBERS, pakistanCities));

    expect(html).toContain('<caption>');
    for (const column of DIRECTORY_COLUMNS) {
      expect(html).toContain(`<th scope="col">${column}</th>`);
    }
    expect(html).toContain('<th scope="row">CNSPK-0001</th>');
    expect(html).toContain('Ayesha Khan');
    expect(html.match(/<tr data-mapped=/g)).toHaveLength(2);
  });

  it('marks an unmapped member honestly rather than dropping or misplacing them', () => {
    const html = renderDirectoryHTML(buildDirectoryEntries(MEMBERS, pakistanCities));
    expect(html).toContain(MAPPED_LABEL);
    expect(html).toContain(NOT_MAPPED_LABEL);
    expect(html).toContain('data-mapped="no"');
  });

  it('escapes markup carried by a member value', () => {
    const html = renderDirectoryHTML(
      buildDirectoryEntries(
        [{ id: 'x', name: '<img src=x onerror=alert(1)>', city: 'Lahore' }],
        pakistanCities
      )
    );

    // The guarantee is about executable constructs, not about the literal text
    // `onerror` — the escaped payload keeps that substring, harmlessly, as data.
    // So assert what actually matters: the injected value contributes no tag and
    // no live attribute.
    const rendered = html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>'));
    const tags = rendered.match(/<[a-z/!]/gi) || [];
    const allowed = /^<\/?(tbody|tr|td|th)\b/i;

    // Every tag inside the rendered rows is one the renderer itself emitted;
    // nothing was parsed out of the member value.
    for (const match of rendered.match(/<[^>]*>/g) || []) {
      expect(match).toMatch(allowed);
    }
    expect(tags.length).toBeGreaterThan(0);
    expect(rendered).not.toMatch(/<img/i);

    // No event-handler attribute anywhere in the output — the only `on…=` text
    // present is inside an escaped value, never in attribute position.
    expect(html.replace(/&lt;[^&]*&gt;/g, '')).not.toMatch(/\son[a-z]+\s*=/i);

    // And the value is still shown to the reader, as inert text.
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('renders an honest empty state for no entries', () => {
    expect(renderDirectoryHTML([])).toContain(DIRECTORY_STATE_MESSAGES.empty);
    expect(renderDirectoryHTML([], { emptyMessage: 'Nothing loaded.' })).toContain('Nothing loaded.');
    expect(renderDirectoryHTML(null)).toContain('members-directory__empty');
  });
});

describe('describeDirectoryState', () => {
  it('reports ok when the directory loaded and has members', () => {
    const state = describeDirectoryState({
      memberCount: 2,
      pinCount: 1,
      seedLoaded: true,
      liveConfigured: true,
      liveOk: true,
    });
    expect(state.kind).toBe('ok');
    expect(renderDirectoryStateHTML(state)).toBe('');
  });

  it('reports degraded when the CSV was configured but did not load', () => {
    const state = describeDirectoryState({
      memberCount: 5,
      pinCount: 5,
      seedLoaded: true,
      liveConfigured: true,
      liveOk: false,
      error: 'directory CSV unreachable: 500',
    });
    expect(state.kind).toBe('degraded');
    expect(state.detail).toContain('unreachable');

    const html = renderDirectoryStateHTML(state);
    expect(html).toContain('role="status"');
    expect(html).toContain('only the members bundled with the site are shown');
  });

  it('reports empty when everything loaded but nobody is published', () => {
    const state = describeDirectoryState({ memberCount: 0, seedLoaded: true });
    expect(state.kind).toBe('empty');
    expect(renderDirectoryStateHTML(state)).toContain('role="status"');
  });

  it('reports error when nothing could be loaded', () => {
    const state = describeDirectoryState({ seedLoaded: false, liveOk: false, error: 'offline' });
    expect(state.kind).toBe('error');
    expect(renderDirectoryStateHTML(state)).toContain('role="alert"');
    expect(state.message).toBe(DIRECTORY_STATE_MESSAGES.error);
  });

  it('never claims success when a failure left nothing to show', () => {
    const state = describeDirectoryState({
      memberCount: 0,
      seedLoaded: true,
      liveConfigured: true,
      liveOk: false,
      error: 'directory CSV unparseable',
    });
    expect(state.kind).toBe('error');
  });

  it('defaults to an error state for a missing status', () => {
    expect(describeDirectoryState().kind).toBe('error');
    expect(describeDirectoryState(null).kind).toBe('error');
  });
});

describe('members-source honest degradation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  /** Serve the repo's real data files; fail anything else. */
  const fetchFromDisk = (overrides = {}) =>
    vi.fn(async (url) => {
      const name = String(url).split('/').pop();
      if (name in overrides) return overrides[name];
      try {
        const body = readFileSync(fileURLToPath(new URL(`../data/${name}`, import.meta.url)), 'utf8');
        return { ok: true, json: async () => JSON.parse(body), text: async () => body };
      } catch {
        return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
      }
    });

  it('returns the seed members and an ok state when no live CSV is configured', async () => {
    vi.stubGlobal('fetch', fetchFromDisk());
    const { getAllMembers, getDirectoryStatus } = await import('../js/members-source.js');

    const members = await getAllMembers();
    const status = getDirectoryStatus();

    expect(members.length).toBeGreaterThan(0);
    expect(status.seedLoaded).toBe(true);
    expect(status.liveConfigured).toBe(false);
    expect(describeDirectoryState({ ...status, memberCount: members.length }).kind).toBe('ok');
  });

  it('falls back to the seed file and reports degraded when the CSV is unreachable', async () => {
    vi.resetModules();
    vi.doMock('../js/membership-config.js', () => ({
      MEMBERSHIP: {
        enabled: true,
        sheetCsvUrl: 'https://example.invalid/directory.csv',
        sheetColumns: { membershipNo: 'Membership No', name: 'Name', role: 'Role', city: 'City', interests: 'Interests', github: 'GitHub', linkedin: 'LinkedIn' },
        requireApproval: false,
        maxLiveMembers: 2000,
      },
    }));
    vi.stubGlobal(
      'fetch',
      fetchFromDisk({ 'directory.csv': { ok: false, status: 503, text: async () => '' } })
    );

    const { getAllMembers, getDirectoryStatus } = await import('../js/members-source.js');
    const seed = JSON.parse(
      readFileSync(fileURLToPath(new URL('../data/members.json', import.meta.url)), 'utf8')
    );

    const members = await getAllMembers();
    const status = getDirectoryStatus();

    // Seed members only — no live rows, and nothing invented for them.
    expect(members).toHaveLength(seed.length);
    expect(status.liveConfigured).toBe(true);
    expect(status.liveAttempted).toBe(true);
    expect(status.liveOk).toBe(false);
    expect(status.liveCount).toBe(0);
    expect(status.error).toMatch(/unreachable/i);

    const state = describeDirectoryState({ ...status, memberCount: members.length });
    expect(state.kind).toBe('degraded');

    vi.doUnmock('../js/membership-config.js');
  });

  it('reports an error state when even the seed file cannot be loaded', async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => '' })));

    const { getAllMembers, getDirectoryStatus } = await import('../js/members-source.js');
    const members = await getAllMembers();
    const status = getDirectoryStatus();

    expect(members).toEqual([]);
    expect(status.seedLoaded).toBe(false);
    expect(describeDirectoryState({ ...status, memberCount: 0 }).kind).toBe('error');
  });
});
