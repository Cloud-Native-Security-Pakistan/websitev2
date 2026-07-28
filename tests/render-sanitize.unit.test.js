/**
 * Unit tests for the sanitized render points (Task 7.1).
 *
 * Every place member, session, or intake data reaches the DOM runs through the
 * shared js/lib/sanitize.js wrapper. These tests render each component with
 * hostile values and assert the markup carries no executable script, no
 * event-handler attribute, and no executable URL — and that benign values still
 * render exactly as before.
 *
 * Validates: Requirements 2.4
 */
import { describe, it, expect } from 'vitest';
import { sanitizeAttribute, sanitizeURL } from '../js/lib/sanitize.js';
import { MemberCard } from '../js/MemberCard.js';
import { SessionCard } from '../js/SessionCard.js';
import { SessionDetail } from '../js/SessionDetail.js';
import { EventCard } from '../js/EventCard.js';
import { FilterPanel } from '../js/FilterPanel.js';
import { Map as MembersMap } from '../js/Map.js';

// A real <script ...> opening tag survived (escaped `&lt;script` never matches).
const SCRIPT_TAG = /<script\b/i;
// An executable URL reached an href/src.
const EXECUTABLE_URL = /(?:href|src)\s*=\s*["']?\s*(?:javascript|data|vbscript):/i;
// The components' own static handlers, written in the templates rather than
// coming from data. They are removed before the injected-handler scan.
const STATIC_HANDLERS = [
  /\sonerror="this\.src='[^']*'"/gi,
  /\sonclick="navigator\.clipboard[^"]*"/gi,
];
// Any remaining `on*=` attribute inside a real tag is data-injected.
const HANDLER_ATTR = /\son[a-z]+\s*=/i;

const PAYLOAD = '"><img src=x onerror=alert(1)><script>alert(2)</script>';
const EVIL_URL = 'javascript:alert(1)';

/**
 * Split markup into the real tags it contains. Quote-aware, so escaped payload
 * text sitting inside an attribute value is never mistaken for markup.
 */
function realTags(html) {
  const tags = [];
  let i = 0;
  while (i < html.length) {
    if (html[i] !== '<') { i++; continue; }
    let j = i + 1;
    let quote = null;
    while (j < html.length) {
      const ch = html[j];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '>') {
        break;
      }
      j++;
    }
    tags.push(html.slice(i, j + 1));
    i = j + 1;
  }
  return tags;
}

/** Tags that carry an event-handler attribute the data introduced. */
function tagsWithInjectedHandler(html) {
  return realTags(html).filter((tag) => {
    const withoutStatic = STATIC_HANDLERS.reduce((acc, re) => acc.replace(re, ''), tag);
    // Blank out quoted attribute values so handler *names* stay visible while
    // escaped text inside a value cannot masquerade as an attribute.
    const bare = withoutStatic.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
    return HANDLER_ATTR.test(bare);
  });
}

function assertInert(html) {
  expect(SCRIPT_TAG.test(html)).toBe(false);
  expect(tagsWithInjectedHandler(html)).toEqual([]);
  expect(EXECUTABLE_URL.test(html)).toBe(false);
}

describe('sanitizeAttribute — quoted-attribute context', () => {
  it('escapes the delimiters a value would need to leave its attribute', () => {
    const out = sanitizeAttribute(PAYLOAD);
    expect(out).not.toContain('"');
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    assertInert(`<img alt="${out}">`);
  });

  it('leaves a benign value readable and returns an empty string for nullish input', () => {
    expect(sanitizeAttribute('ayesha-khan')).toBe('ayesha-khan');
    expect(sanitizeAttribute(null)).toBe('');
    expect(sanitizeAttribute(undefined)).toBe('');
  });
});

describe('sanitizeURL — href/src context', () => {
  it('keeps linkable URLs unchanged', () => {
    expect(sanitizeURL('https://github.com/ayesha')).toBe('https://github.com/ayesha');
    expect(sanitizeURL('/sessions/view/?id=3')).toBe('/sessions/view/?id=3');
    expect(sanitizeURL('mailto:hello@cloudnativesecurity.pk')).toBe('mailto:hello@cloudnativesecurity.pk');
  });

  it('collapses executable and smuggled schemes to an empty value', () => {
    expect(sanitizeURL(EVIL_URL)).toBe('');
    expect(sanitizeURL('JaVaScRiPt:alert(1)')).toBe('');
    expect(sanitizeURL('  java\tscript:alert(1)')).toBe('');
    expect(sanitizeURL('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(sanitizeURL('vbscript:msgbox(1)')).toBe('');
  });

  it('escapes an ampersand so a URL cannot break out of its attribute', () => {
    expect(sanitizeURL('https://x.test/a?b=1&c=2')).toBe('https://x.test/a?b=1&amp;c=2');
    assertInert(`<a href="${sanitizeURL('https://x.test/" onclick="evil()')}">x</a>`);
  });
});

describe('MemberCard render point', () => {
  const hostile = {
    name: PAYLOAD,
    username: PAYLOAD,
    location: PAYLOAD,
    team: PAYLOAD,
    role: PAYLOAD,
    interests: [PAYLOAD],
    github: EVIL_URL,
    linkedin: EVIL_URL,
    twitter: EVIL_URL,
    link: EVIL_URL,
  };

  it('renders hostile member data inert', () => {
    assertInert(new MemberCard(hostile).render());
  });

  it('renders benign member data unchanged', () => {
    const html = new MemberCard({
      name: 'Ayesha Khan',
      username: 'ayeshak',
      location: 'Lahore',
      team: 'member',
      interests: ['Kubernetes'],
      github: 'ayeshak',
      linkedin: 'https://linkedin.com/in/ayeshak',
    }).render();

    expect(html).toContain('id="member-ayeshak"');
    expect(html).toContain('>Ayesha Khan<');
    expect(html).toContain('href="https://github.com/ayeshak"');
    expect(html).toContain('href="https://linkedin.com/in/ayeshak"');
    expect(html).toContain('aria-label="Ayesha Khan on GitHub"');
    assertInert(html);
  });
});

describe('SessionCard render point', () => {
  it('renders hostile session data inert', () => {
    const html = new SessionCard({
      id: PAYLOAD,
      title: PAYLOAD,
      description: PAYLOAD,
      topic: PAYLOAD,
      duration: PAYLOAD,
      thumbnail: EVIL_URL,
      registrationUrl: EVIL_URL,
      type: 'upcoming',
      speaker: { name: PAYLOAD, role: PAYLOAD, company: PAYLOAD, image: EVIL_URL },
    }).render();

    assertInert(html);
  });

  it('renders benign session data with its routing intact', () => {
    const html = new SessionCard({
      id: 3,
      title: 'Securing Kubernetes',
      description: 'A walkthrough.',
      date: '2025-03-04',
      duration: '45 min',
      type: 'recorded',
      topic: 'Kubernetes',
      thumbnail: 'https://img.test/a.png',
      speaker: { name: 'Ayesha Khan', role: 'Engineer', company: 'Acme', image: 'https://img.test/p.png' },
    }).render();

    expect(html).toContain('href="/sessions/view/?id=3"');
    expect(html).toContain('data-session-id="3"');
    expect(html).toContain('alt="Securing Kubernetes"');
    expect(html).toContain('src="https://img.test/a.png"');
    assertInert(html);
  });
});

describe('SessionDetail render point', () => {
  it('renders hostile session data inert, including the embed id', () => {
    const html = new SessionDetail({
      id: 1,
      title: PAYLOAD,
      description: PAYLOAD,
      summary: PAYLOAD,
      keyTakeaways: [PAYLOAD],
      transcript: [{ time: PAYLOAD, text: PAYLOAD }],
      topic: PAYLOAD,
      duration: PAYLOAD,
      type: 'recorded',
      recordingUrl: 'https://youtu.be/abc"><img src=x onerror=alert(1)>',
      thumbnail: EVIL_URL,
      registrationUrl: EVIL_URL,
      speaker: { name: PAYLOAD, role: PAYLOAD, company: PAYLOAD, image: EVIL_URL },
    }).render();

    assertInert(html);
    // Only video-id characters survive, so the crafted markup never reaches the src.
    expect(html).toMatch(/https:\/\/www\.youtube\.com\/embed\/[A-Za-z0-9_-]*\?autoplay/);
  });

  it('renders a benign recorded session with its embed and transcript', () => {
    const html = new SessionDetail({
      id: 2,
      title: 'Supply Chain 101',
      description: 'Overview copy.',
      summary: 'Short summary.',
      keyTakeaways: ['Sign your artifacts'],
      transcript: [{ time: '00:12', text: 'Welcome.' }],
      type: 'recorded',
      recordingUrl: 'https://youtu.be/dQw4w9WgXcQ',
      thumbnail: 'https://img.test/a.png',
      speaker: { name: 'Ayesha Khan', role: 'Engineer', company: 'Acme', image: 'https://img.test/p.png' },
    }).render();

    expect(html).toContain('https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1');
    expect(html).toContain('>Sign your artifacts<');
    expect(html).toContain('>00:12<');
    assertInert(html);
  });
});

describe('EventCard render point', () => {
  it('renders hostile event data inert', () => {
    assertInert(new EventCard({
      title: PAYLOAD,
      description: PAYLOAD,
      location: PAYLOAD,
      type: PAYLOAD,
      time: PAYLOAD,
      image: EVIL_URL,
      link: EVIL_URL,
      date: '2025-01-05',
    }).render());
  });

  it('renders benign event data unchanged', () => {
    const html = new EventCard({
      title: 'CNSPK Lahore Meetup',
      description: 'Talks and hallway track.',
      location: 'Lahore, Pakistan',
      type: 'Meetup',
      time: '18:00',
      image: 'https://img.test/e.png',
      link: 'https://events.test/lahore',
      date: '2025-01-05',
    }).render();

    expect(html).toContain('alt="CNSPK Lahore Meetup"');
    expect(html).toContain('href="https://events.test/lahore"');
    expect(html).toContain('>Lahore<');
    assertInert(html);
  });
});

describe('rendered images carry explicit dimensions (Requirement 5.3)', () => {
  /** Every real <img> tag in the markup, with its attribute text. */
  function imgTags(html) {
    return realTags(html).filter((tag) => /^<img\b/i.test(tag));
  }

  function assertEveryImageSized(html) {
    const imgs = imgTags(html);
    expect(imgs.length).toBeGreaterThan(0);
    imgs.forEach((tag) => {
      expect(tag).toMatch(/\swidth="\d+"/);
      expect(tag).toMatch(/\sheight="\d+"/);
      expect(tag).toMatch(/\sdecoding="async"/);
    });
  }

  const session = {
    id: 2,
    title: 'Supply Chain 101',
    description: 'Overview copy.',
    date: '2025-03-04',
    duration: '45 min',
    type: 'upcoming',
    topic: 'Kubernetes',
    thumbnail: 'https://img.test/a.png',
    registrationUrl: 'https://events.test/session',
    speaker: { name: 'Ayesha Khan', role: 'Engineer', company: 'Acme', image: 'https://img.test/p.png' },
  };

  it('sizes the SessionCard thumbnail and speaker avatar', () => {
    const html = new SessionCard(session).render();
    assertEveryImageSized(html);
    // Below the fold: the card images lazy-load.
    imgTags(html).forEach((tag) => expect(tag).toMatch(/\sloading="lazy"/));
  });

  it('sizes the SessionDetail hero and speaker portrait', () => {
    const html = new SessionDetail(session).render();
    assertEveryImageSized(html);
    // The hero is the above-the-fold image, so it is not lazy-loaded; the
    // speaker portrait below it is.
    const [hero, portrait] = imgTags(html);
    expect(hero).toContain('cnspk-sd__hero-img');
    expect(hero).not.toMatch(/\sloading="lazy"/);
    expect(portrait).toMatch(/\sloading="lazy"/);
  });

  it('sizes the EventCard image', () => {
    const html = new EventCard({
      title: 'CNSPK Lahore Meetup',
      description: 'Talks and hallway track.',
      location: 'Lahore, Pakistan',
      type: 'Meetup',
      time: '18:00',
      image: 'https://img.test/e.png',
      link: 'https://events.test/lahore',
      date: '2025-01-05',
    }).render();

    assertEveryImageSized(html);
    imgTags(html).forEach((tag) => expect(tag).toMatch(/\sloading="lazy"/));
  });

  it('sizes the labelled placeholder images used when no real asset exists', () => {
    // No thumbnail and no speaker image: both slots fall back to the manifest
    // placeholder, which still has to be sized.
    const html = new SessionDetail({ ...session, thumbnail: '', speaker: { name: 'Ayesha Khan' } }).render();
    assertEveryImageSized(html);
    expect(html).toContain('data-placeholder="true"');
  });
});

describe('SessionDetail speaker portrait honesty (Requirements 7.5, 7.6)', () => {
  it('renders a labelled placeholder rather than a fabricated avatar service URL', () => {
    const html = new SessionDetail({
      id: 4,
      title: 'Zero Trust',
      description: 'Copy.',
      type: 'upcoming',
      registrationUrl: 'https://events.test/zt',
      speaker: { name: 'Ayesha Khan', role: 'Engineer' },
    }).render();

    expect(html).not.toContain('ui-avatars.com');
    expect(html).not.toMatch(/\sonerror=/);
    expect(html).toContain('Placeholder · no photo yet');
    assertInert(html);
  });
});

describe('FilterPanel render point', () => {
  it('renders its option lists inert and unchanged for the configured values', () => {
    const html = new FilterPanel(() => {}).render();
    expect(html).toContain('<option value="Lahore">Lahore</option>');
    expect(html).toContain('<option value="member">Member</option>');
    assertInert(html);
  });
});

describe('Map popup render point', () => {
  // Minimal Leaflet stand-in: captures the popup markup the map binds.
  function capturePopups(members) {
    const popups = [];
    const markerStub = () => ({
      bindPopup(html) { popups.push(html); return this; },
      addTo() { return this; },
    });

    globalThis.L = {
      divIcon: () => ({}),
      marker: () => markerStub(),
    };

    const map = new MembersMap('map');
    map.map = { removeLayer() {} };
    // Skip the click-delegation wiring, which needs a live document.
    map._viewCardListenerSet = true;
    map.updateMarkers(members);

    delete globalThis.L;
    return popups;
  }

  it('renders a hostile member handle inert in the popup', () => {
    const [popup] = capturePopups([
      { name: PAYLOAD, username: PAYLOAD, lat: 31.5, lng: 74.35 },
    ]);
    expect(popup).toBeDefined();
    assertInert(popup);
  });

  it('keeps the View Card hook working for a benign handle', () => {
    const [popup] = capturePopups([
      { name: 'Ayesha Khan', username: 'ayeshak', lat: 31.5, lng: 74.35 },
    ]);
    expect(popup).toContain('href="#member-ayeshak"');
    expect(popup).toContain('data-view-card="ayeshak"');
    expect(popup).toContain('Ayesha Khan');
    assertInert(popup);
  });
});
