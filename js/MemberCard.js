/**
 * CNSPK · MemberCard (v2)
 * ----------------------------------------------------------
 * Electric-register member card: charcoal surface, lime
 * top-stripe-on-hover, card lift, a lime monogram avatar
 * tile, name, role, location, mono interest tags, and social
 * links.
 *
 * Data contract (UNCHANGED):
 *   new MemberCard(member).render() -> HTML string
 *   Consumes: name, username, location, team, interests[],
 *             github, linkedin, twitter, role, link
 *
 * Integration contract preserved (do not break):
 *   - The root element stays `<article ...>` so the members
 *     page can string-inject data-lat / data-lng / data-username.
 *   - The root keeps id="member-${username}" so Map.js can
 *     scroll-into-view and highlight the matching card.
 *   - cursor:pointer is baked into the style (the page's
 *     glass-panel -> cursor-pointer replace becomes a no-op
 *     after the retheme).
 *
 * Styles consumed from /css/tokens.css (vars only). Component
 * styling is injected once, scoped under .cnspk-member-card.
 * ----------------------------------------------------------
 */

import { sanitize } from './utils.js';

export class MemberCard {
    constructor(member) {
        this.member = member;
    }

    /**
     * Team accent class. Lime for admins; cooler mono chips for
     * the rest. Kept as a method to preserve the original shape.
     */
    getTeamColor(team) {
        const map = {
            'admin': 'cnspk-member-card__team--admin',
            'contributor': 'cnspk-member-card__team--contributor',
            'mentor': 'cnspk-member-card__team--contributor',
            'member': 'cnspk-member-card__team--member',
            'newbie': 'cnspk-member-card__team--member'
        };
        return map[team?.toLowerCase()] || 'cnspk-member-card__team--member';
    }

    /** Component-scoped styles. Tokens come from tokens.css. Injected once. */
    injectStyles() {
        if (typeof document === 'undefined') return;
        if (document.getElementById('cnspk-member-card-styles')) return;

        const style = document.createElement('style');
        style.id = 'cnspk-member-card-styles';
        style.textContent = `
            .cnspk-member-card {
                display: flex;
                flex-direction: column;
                height: 100%;
                background: var(--charcoal);
                border: 1px solid var(--slate);
                border-radius: var(--r-md);
                padding: 24px;
                position: relative;
                overflow: hidden;
                cursor: pointer;
                transition: border-color var(--dur-elevate) var(--ease),
                            transform var(--dur-elevate) var(--ease),
                            box-shadow var(--dur-elevate) var(--ease);
            }
            .cnspk-member-card::before {
                content: '';
                position: absolute;
                top: 0; left: 0; right: 0;
                height: 3px;
                background: var(--lime);
                transform: scaleX(0);
                transform-origin: left;
                transition: transform var(--dur-elevate) var(--ease);
            }
            .cnspk-member-card:hover,
            .cnspk-member-card:focus-within {
                border-color: var(--lime);
                transform: translateY(-4px);
                box-shadow: var(--shadow-soft);
            }
            .cnspk-member-card:hover::before,
            .cnspk-member-card:focus-within::before { transform: scaleX(1); }

            .cnspk-member-card__top {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 18px;
            }
            .cnspk-member-card__identity {
                display: flex; align-items: center; gap: 14px;
                min-width: 0;
            }
            .cnspk-member-card__avatar {
                width: 48px; height: 48px;
                border-radius: var(--r-pill);
                background: var(--lime);
                color: var(--carbon);
                display: grid; place-items: center;
                font-family: var(--font-display);
                font-style: italic;
                font-weight: 800;
                font-size: 18px;
                letter-spacing: -0.02em;
                flex-shrink: 0;
            }
            .cnspk-member-card__name {
                font-size: 16px;
                font-weight: 700;
                color: var(--bone);
                line-height: 1.2;
                transition: color var(--dur-hover) var(--ease);
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            }
            .cnspk-member-card:hover .cnspk-member-card__name { color: var(--lime); }
            .cnspk-member-card__handle {
                font-family: var(--font-mono);
                font-size: 11px;
                color: var(--steel);
                letter-spacing: 0.02em;
            }

            .cnspk-member-card__team {
                font-family: var(--font-mono);
                font-size: 10px;
                font-weight: 500;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                padding: 4px 8px;
                border-radius: var(--r-sm);
                border: 1px solid var(--slate);
                flex-shrink: 0;
            }
            .cnspk-member-card__team--admin {
                background: rgba(199, 255, 62, 0.15);
                color: var(--lime);
                border-color: rgba(199, 255, 62, 0.3);
            }
            .cnspk-member-card__team--contributor {
                background: rgba(201, 162, 39, 0.12);
                color: var(--gold);
                border-color: rgba(201, 162, 39, 0.3);
            }
            .cnspk-member-card__team--member {
                background: var(--slate);
                color: var(--bone-2);
            }

            .cnspk-member-card__role {
                font-size: 14px;
                font-weight: 500;
                color: var(--bone-2);
                line-height: 1.5;
                padding-left: 12px;
                border-left: 2px solid rgba(199, 255, 62, 0.4);
                margin-bottom: 12px;
            }
            .cnspk-member-card__location {
                display: flex; align-items: center; gap: 6px;
                font-family: var(--font-mono);
                font-size: 11px;
                color: var(--steel);
                letter-spacing: 0.02em;
                margin-bottom: 14px;
            }
            .cnspk-member-card__location svg { width: 13px; height: 13px; flex-shrink: 0; }

            .cnspk-member-card__tags {
                display: flex; flex-wrap: wrap; gap: 6px;
                margin-bottom: 18px;
            }
            .cnspk-member-card__tag {
                font-family: var(--font-mono);
                font-size: 10px;
                letter-spacing: 0.04em;
                padding: 3px 8px;
                border: 1px solid var(--slate);
                border-radius: var(--r-sm);
                color: var(--steel);
            }

            .cnspk-member-card__socials {
                display: flex; gap: 14px; justify-content: flex-end;
                margin-top: auto;
                padding-top: 16px;
                border-top: 1px dashed var(--slate);
            }
            .cnspk-member-card__social {
                color: var(--steel);
                transition: color var(--dur-hover) var(--ease), transform var(--dur-hover) var(--ease);
            }
            .cnspk-member-card__social:hover { color: var(--lime); transform: translateY(-2px); }
            .cnspk-member-card__social svg { width: 18px; height: 18px; }

            @media (prefers-reduced-motion: reduce) {
                .cnspk-member-card,
                .cnspk-member-card::before,
                .cnspk-member-card__social { transition: none; }
                .cnspk-member-card:hover { transform: none; }
                .cnspk-member-card__social:hover { transform: none; }
            }
        `;
        document.head.appendChild(style);
    }

    render() {
        this.injectStyles();

        const { name, username, location, team, interests, github, linkedin, twitter, role, link } = this.member;

        const safeName = sanitize(name || username);
        const safeUser = sanitize(username);
        const safeRole = sanitize(role || 'Community Member');
        const safeLocation = sanitize(location || 'Pakistan');

        // Monogram: up to two initials from the display name.
        const monogram = safeName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(w => w.charAt(0))
            .join('')
            .toUpperCase() || 'CN';

        const pinIcon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`;
        const globeIcon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>`;
        const githubIcon = `<svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>`;
        const linkedinIcon = `<svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.239-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>`;
        const xIcon = `<svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;

        const githubHref = github
            ? (github.startsWith('http') ? sanitize(github) : `https://github.com/${sanitize(github)}`)
            : '';

        const interestTags = (interests && interests.length)
            ? interests.slice(0, 3).map(i => `<span class="cnspk-member-card__tag">${sanitize(i)}</span>`).join('')
            : '';

        return `
            <article id="member-${safeUser}" class="cnspk-member-card">
                <div class="cnspk-member-card__top">
                    <div class="cnspk-member-card__identity">
                        <div class="cnspk-member-card__avatar" aria-hidden="true">${monogram}</div>
                        <div style="min-width:0">
                            <h3 class="cnspk-member-card__name">${safeName}</h3>
                            <p class="cnspk-member-card__handle">@${safeUser}</p>
                        </div>
                    </div>
                    ${team ? `<span class="cnspk-member-card__team ${this.getTeamColor(team)}">${sanitize(team)}</span>` : ''}
                </div>

                <p class="cnspk-member-card__role">${safeRole}</p>

                <div class="cnspk-member-card__location">
                    ${pinIcon}
                    <span>${safeLocation}</span>
                </div>

                ${interestTags ? `<div class="cnspk-member-card__tags">${interestTags}</div>` : ''}

                <div class="cnspk-member-card__socials">
                    ${link ? `<a href="${sanitize(link)}" target="_blank" rel="noopener noreferrer" class="cnspk-member-card__social" title="CNCF Profile" aria-label="${safeName} on CNCF Community">${globeIcon}</a>` : ''}
                    ${github ? `<a href="${githubHref}" target="_blank" rel="noopener noreferrer" class="cnspk-member-card__social" title="GitHub" aria-label="${safeName} on GitHub">${githubIcon}</a>` : ''}
                    ${linkedin ? `<a href="${sanitize(linkedin)}" target="_blank" rel="noopener noreferrer" class="cnspk-member-card__social" title="LinkedIn" aria-label="${safeName} on LinkedIn">${linkedinIcon}</a>` : ''}
                    ${twitter ? `<a href="${sanitize(twitter)}" target="_blank" rel="noopener noreferrer" class="cnspk-member-card__social" title="X / Twitter" aria-label="${safeName} on X">${xIcon}</a>` : ''}
                </div>
            </article>
        `;
    }
}
