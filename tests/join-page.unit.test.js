/**
 * Unit tests for the /join/ doorway picker (Task 12.2).
 *
 * Covers the rendered doorway grid (js/DoorwayCard.js over js/lib/channels.js)
 * and the shipped join/index.html markup: five doorways for the seeded config,
 * hide-only-the-empty-doorway, Code of Conduct link ahead of the first join CTA
 * in reading order, the exact "280+" member count, Discord as a live invite with
 * no coming-soon/notify-me/waitlist wording, and every primary Join control
 * resolving to the canonical /join/.
 *
 * Validates: Requirements 14.1, 14.2, 14.3, 14.5, 14.6, 18.2
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHANNELS, DOORWAY_KEYS, isCanonicalJoinHref } from '../js/lib/channels.js';
import { doorwaysGridHTML, doorwayCardHTML } from '../js/DoorwayCard.js';
import { Navbar } from '../js/Navbar.js';

const readRepoFile = (relative) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const joinHTML = readRepoFile('../join/index.html');
const navbarSource = readRepoFile('../js/Navbar.js');

/** data-doorway="key" occurrences, in render order. */
function renderedKeys(html) {
  return [...html.matchAll(/data-doorway="([a-z]+)"/g)].map((m) => m[1]);
}

describe('doorway grid rendering', () => {
  it('renders exactly five doorways in friction order for the seeded config', () => {
    const html = doorwaysGridHTML(CHANNELS);
    expect(renderedKeys(html)).toEqual([...DOORWAY_KEYS]);
    expect(renderedKeys(html)).toHaveLength(5);
    expect(html.match(/<article class="doorway-card/g)).toHaveLength(5);
  });

  it('gives every doorway a live external link in a separate browsing context', () => {
    const html = doorwaysGridHTML(CHANNELS);
    const ctas = [...html.matchAll(/<a href="([^"]+)" class="doorway-card__cta"([^>]*)>/g)];

    expect(ctas).toHaveLength(5);
    for (const [, href, attrs] of ctas) {
      expect(href).toMatch(/^https:\/\//);
      expect(attrs).toContain('target="_blank"');
      expect(attrs).toContain('rel="noopener noreferrer"');
    }
  });

  it('hides only the doorway whose configured URL is emptied', () => {
    const html = doorwaysGridHTML({ ...CHANNELS, whatsapp: '' });

    expect(renderedKeys(html)).toEqual(['cncf', 'social', 'github', 'discord']);
    expect(html).not.toContain('chat.whatsapp.com');
    // No dead link left behind for the hidden doorway.
    expect(html).not.toContain('href=""');
  });

  it('hides the Discord doorway rather than degrading it when its invite is emptied', () => {
    const html = doorwaysGridHTML({ ...CHANNELS, discord: '' });
    expect(renderedKeys(html)).toEqual(['whatsapp', 'cncf', 'social', 'github']);
    expect(html).not.toContain('discord.gg');
  });

  it('drops a doorway whose URL is not safe to link to', () => {
    expect(doorwayCardHTML({ key: 'discord', url: 'javascript:alert(1)', order: 5 })).toBe('');
  });

  it('puts each card Code of Conduct line ahead of that card join CTA', () => {
    for (const html of doorwaysGridHTML(CHANNELS).split('<article').slice(1)) {
      const cocIndex = html.indexOf('/code-of-conduct/');
      const ctaIndex = html.indexOf('class="doorway-card__cta"');
      expect(cocIndex).toBeGreaterThan(-1);
      expect(ctaIndex).toBeGreaterThan(-1);
      expect(cocIndex).toBeLessThan(ctaIndex);
    }
  });

  it('renders Discord as a live direct invite with no coming-soon state', () => {
    const html = doorwaysGridHTML(CHANNELS);
    const discordCard = html.split('<article').find((card) => card.includes('data-doorway="discord"'));

    expect(discordCard).toBeDefined();
    expect(discordCard).toContain(CHANNELS.discord);
    expect(discordCard.toLowerCase()).not.toMatch(/coming soon|notify me|notify-me|waitlist|disabled/);
    expect(discordCard).not.toContain('<input');
  });
});

describe('join/index.html', () => {
  it('links the Code of Conduct before the first join call-to-action in reading order', () => {
    const cocIndex = joinHTML.indexOf('href="/code-of-conduct/"');
    // The first join CTA on the page: the hero WhatsApp button.
    const firstJoinCta = joinHTML.indexOf('class="btn-primary"');

    expect(cocIndex).toBeGreaterThan(-1);
    expect(firstJoinCta).toBeGreaterThan(-1);
    expect(cocIndex).toBeLessThan(firstJoinCta);
    // And before any external channel link.
    expect(cocIndex).toBeLessThan(joinHTML.indexOf('https://chat.whatsapp.com'));
  });

  it('shows the member count as the exact string "280+"', () => {
    expect(joinHTML).toContain('280+');
    // No sharper unverified figure claiming a member total.
    expect(joinHTML).not.toMatch(/\b(?:28[1-9]|29\d|3\d\d)\s*(?:members|practitioners)\b/i);
  });

  it('carries no coming-soon, notify-me, or waitlist wording anywhere near Discord', () => {
    const lower = joinHTML.toLowerCase();
    expect(lower).not.toContain('coming soon');
    expect(lower).not.toContain('notify me');
    expect(lower).not.toContain('notify-me');
    expect(lower).not.toContain('waitlist');
    expect(lower).not.toContain('badge-coming-soon');
  });

  it('mounts the doorway grid from the channel config instead of hardcoding cards', () => {
    expect(joinHTML).toContain('id="doorways-grid"');
    expect(joinHTML).toContain("mountDoorwaysFromConfig('doorways-grid')");
    // The only doorway <article> markup left in the file is the no-JS fallback.
    expect(joinHTML.match(/<article class="doorway-card/g)).toHaveLength(1);
  });

  it('keeps the progression ladder and the no-spam expectations block', () => {
    for (const rank of ['Lurker', 'Newbie', 'Member', 'Contributor', 'Mentor']) {
      expect(joinHTML).toContain(`>${rank}</div>`);
    }
    expect(joinHTML).toContain('We will not auto-DM you.');
  });
});

describe('canonical Join controls', () => {
  it('points the navbar Join CTA at /join/', () => {
    expect(isCanonicalJoinHref(new Navbar().cta.path)).toBe(true);
  });

  it('renders both the desktop and mobile navbar CTAs from that one path', () => {
    expect(navbarSource.match(/href="\$\{this\.cta\.path\}"/g)).toHaveLength(2);
    // The navbar never links straight at a channel URL.
    expect(navbarSource).not.toMatch(/chat\.whatsapp\.com|community\.cncf\.io|github\.com|discord\.gg/);
  });

  it('resolves every site-wide primary Join control to the canonical /join/', () => {
    const controls = [
      { page: 'navbar', href: new Navbar().cta.path },
      { page: 'index.html', href: joinControlHref('../index.html', 'Join the Chapter') },
      { page: 'projects/index.html', href: joinControlHref('../projects/index.html', 'Join the Chapter') },
    ];

    for (const control of controls) {
      expect(isCanonicalJoinHref(control.href), `${control.page} -> ${control.href}`).toBe(true);
    }
  });
});

/**
 * The href of the anchor whose label is `label` on a page — used to check that
 * site-wide primary Join controls resolve to the canonical destination.
 */
function joinControlHref(relativePath, label) {
  const html = readRepoFile(relativePath);
  const anchors = [...html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  const match = anchors.find(([, , inner]) => inner.includes(label));
  expect(match, `no "${label}" control found in ${relativePath}`).toBeDefined();
  return match[1];
}
