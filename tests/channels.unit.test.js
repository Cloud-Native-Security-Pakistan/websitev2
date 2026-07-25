/**
 * Unit tests for js/lib/channels.js — the /join/ doorway config and filter.
 *
 * Covers: exactly five doorways, render-iff-non-empty URL, remaining doorways
 * preserved, external-link attributes, Discord as a live direct invite, and
 * parity between the compiled CHANNELS default and the data/channels.json seed.
 *
 * Validates: Requirements 14.1, 14.4, 14.5, 14.7
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CHANNELS,
  DOORWAY_KEYS,
  CANONICAL_JOIN_PATH,
  filterDoorways,
  isDoorwayVisible,
  isRenderableUrl,
  resolveDoorwayUrl,
  isCanonicalJoinHref,
} from '../js/lib/channels.js';

const seedPath = fileURLToPath(new URL('../data/channels.json', import.meta.url));
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));

describe('CHANNELS config', () => {
  it('mirrors the data/channels.json seed', () => {
    const seedUrls = Object.fromEntries(
      // `_`-prefixed keys are JSON-only annotations.
      Object.entries(seed).filter(([key]) => !key.startsWith('_'))
    );
    expect(seedUrls).toEqual({ ...CHANNELS });
  });

  it('seeds WhatsApp, CNCF, GitHub, Discord, and the socials with non-empty URLs', () => {
    for (const key of ['whatsapp', 'cncf', 'github', 'discord', 'linkedin', 'x', 'instagram']) {
      expect(isRenderableUrl(CHANNELS[key])).toBe(true);
    }
  });

  it('points Discord at the live invite', () => {
    expect(CHANNELS.discord).toBe('https://discord.gg/wXFWN5ensp');
  });
});

describe('filterDoorways', () => {
  it('renders exactly the five doorways for the seeded config', () => {
    const doorways = filterDoorways(CHANNELS);
    expect(doorways.map((d) => d.key)).toEqual(['whatsapp', 'cncf', 'social', 'github', 'discord']);
    expect(DOORWAY_KEYS).toHaveLength(5);
  });

  it('defaults to the seeded CHANNELS config', () => {
    expect(filterDoorways()).toEqual(filterDoorways(CHANNELS));
  });

  it('opens every doorway in a separate browsing context', () => {
    for (const doorway of filterDoorways(CHANNELS)) {
      expect(doorway.external).toBe(true);
      expect(doorway.target).toBe('_blank');
      expect(doorway.rel).toBe('noopener noreferrer');
      expect(isRenderableUrl(doorway.url)).toBe(true);
    }
  });

  it('never emits a coming-soon or disabled state for Discord', () => {
    const discord = filterDoorways(CHANNELS).find((d) => d.key === 'discord');
    expect(discord).toBeDefined();
    expect(discord.url).toBe(CHANNELS.discord);
    expect(JSON.stringify(discord).toLowerCase()).not.toMatch(/coming soon|notify|waitlist|disabled/);
  });

  it('hides only the doorway whose URL is empty', () => {
    const doorways = filterDoorways({ ...CHANNELS, whatsapp: '' });
    expect(doorways.map((d) => d.key)).toEqual(['cncf', 'social', 'github', 'discord']);
  });

  it('hides a doorway whose URL is missing or whitespace-only', () => {
    const withoutGithub = { ...CHANNELS };
    delete withoutGithub.github;
    expect(filterDoorways(withoutGithub).map((d) => d.key)).not.toContain('github');
    expect(filterDoorways({ ...CHANNELS, cncf: '   ' }).map((d) => d.key)).not.toContain('cncf');
  });

  it('renders no doorways for an empty or invalid config', () => {
    expect(filterDoorways({})).toEqual([]);
    expect(filterDoorways(null)).toEqual([]);
    expect(filterDoorways('nope')).toEqual([]);
  });

  it('trims the emitted URL', () => {
    const [whatsapp] = filterDoorways({ whatsapp: '  https://chat.whatsapp.com/x  ' });
    expect(whatsapp.url).toBe('https://chat.whatsapp.com/x');
  });

  it('falls back through the configured feeds for the social doorway', () => {
    const social = filterDoorways({ x: 'https://x.com/CloudSecPK' }).find((d) => d.key === 'social');
    expect(social.url).toBe('https://x.com/CloudSecPK');
    expect(social.feeds).toEqual([]);

    const seeded = filterDoorways(CHANNELS).find((d) => d.key === 'social');
    expect(seeded.url).toBe(CHANNELS.linkedin);
    expect(seeded.feeds.map((f) => f.key)).toEqual(['x', 'instagram']);
  });

  it('hides the social doorway when every feed is empty', () => {
    expect(isDoorwayVisible({ linkedin: '', x: '', instagram: '' }, 'social')).toBe(false);
  });
});

describe('resolveDoorwayUrl', () => {
  it('returns the configured URL for a known doorway', () => {
    expect(resolveDoorwayUrl(CHANNELS, 'discord')).toBe(CHANNELS.discord);
  });

  it('returns an empty string for an unknown doorway', () => {
    expect(resolveDoorwayUrl(CHANNELS, 'telegram')).toBe('');
  });
});

describe('isCanonicalJoinHref', () => {
  it('accepts the canonical join destination and its equivalents', () => {
    expect(CANONICAL_JOIN_PATH).toBe('/join/');
    for (const href of ['/join/', '/join', 'https://cloudnativesecurity.pk/join/', '/join/?src=nav']) {
      expect(isCanonicalJoinHref(href)).toBe(true);
    }
  });

  it('rejects non-canonical join targets', () => {
    for (const href of ['#', '', '/members/', '/join/discord-waitlist/', null]) {
      expect(isCanonicalJoinHref(href)).toBe(false);
    }
  });
});
