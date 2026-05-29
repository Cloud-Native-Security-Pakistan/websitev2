/**
 * CNSPK · SessionCard (v2)
 * ----------------------------------------------------------
 * Electric-register session card: charcoal surface, lime
 * top-stripe-on-hover, card lift, mono topic/duration chips,
 * a speaker block, an italic display title, and a recording /
 * registration link.
 *
 * Data contract (UNCHANGED):
 *   new SessionCard(session).render() -> HTML string
 *   Consumes: id, title, description, date, duration, type,
 *             topic, recordingUrl, registrationUrl, thumbnail,
 *             speaker {name, role, company, image}
 *   Routing preserved:
 *     - recorded sessions wrap in <a href="/sessions/view/?id=ID">
 *     - upcoming sessions wrap in <div> with the Register CTA
 *     - keeps data-session-id="ID"
 *
 * Styles consumed from /css/tokens.css (vars only). Component
 * styling is injected once, scoped under .cnspk-session-card.
 * ----------------------------------------------------------
 */

import { sanitize } from './utils.js';

export class SessionCard {
    constructor(session) {
        this.session = session;
    }

    /** Component-scoped styles. Tokens come from tokens.css. Injected once. */
    injectStyles() {
        if (typeof document === 'undefined') return;
        if (document.getElementById('cnspk-session-card-styles')) return;

        const style = document.createElement('style');
        style.id = 'cnspk-session-card-styles';
        style.textContent = `
            .cnspk-session-card {
                display: flex;
                flex-direction: column;
                height: 100%;
                background: var(--charcoal);
                border: 1px solid var(--slate);
                border-radius: var(--r-md);
                overflow: hidden;
                position: relative;
                text-decoration: none;
                color: var(--bone);
                transition: border-color var(--dur-elevate) var(--ease),
                            transform var(--dur-elevate) var(--ease),
                            box-shadow var(--dur-elevate) var(--ease);
            }
            a.cnspk-session-card { cursor: pointer; }
            .cnspk-session-card::before {
                content: '';
                position: absolute;
                top: 0; left: 0; right: 0;
                height: 3px;
                background: var(--lime);
                transform: scaleX(0);
                transform-origin: left;
                transition: transform var(--dur-elevate) var(--ease);
                z-index: 3;
            }
            .cnspk-session-card:hover,
            .cnspk-session-card:focus-within {
                border-color: var(--lime);
                transform: translateY(-4px);
                box-shadow: var(--shadow-soft);
            }
            .cnspk-session-card:hover::before,
            .cnspk-session-card:focus-within::before { transform: scaleX(1); }

            .cnspk-session-card__media {
                position: relative;
                height: 180px;
                overflow: hidden;
            }
            .cnspk-session-card__img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 700ms var(--ease);
            }
            .cnspk-session-card:hover .cnspk-session-card__img { transform: scale(1.05); }
            .cnspk-session-card__scrim {
                position: absolute; inset: 0;
                background: linear-gradient(to top, var(--carbon) 0%, transparent 60%);
                pointer-events: none;
            }
            .cnspk-session-card__play {
                position: absolute; inset: 0;
                display: grid; place-items: center;
                opacity: 0;
                transition: opacity var(--dur-elevate) var(--ease);
            }
            .cnspk-session-card:hover .cnspk-session-card__play { opacity: 1; }
            .cnspk-session-card__play-btn {
                width: 56px; height: 56px;
                border-radius: var(--r-pill);
                background: var(--lime);
                color: var(--carbon);
                display: grid; place-items: center;
                box-shadow: 0 0 24px rgba(199, 255, 62, 0.4);
                transform: scale(0.9);
                transition: transform var(--dur-elevate) var(--ease);
            }
            .cnspk-session-card:hover .cnspk-session-card__play-btn { transform: scale(1); }
            .cnspk-session-card__play-btn svg { width: 28px; height: 28px; margin-left: 3px; }

            .cnspk-session-card__topic {
                position: absolute;
                top: 14px; left: 14px;
                font-family: var(--font-mono);
                font-size: 10px;
                font-weight: 500;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                padding: 4px 8px;
                border-radius: var(--r-sm);
                background: rgba(199, 255, 62, 0.15);
                color: var(--lime);
                border: 1px solid rgba(199, 255, 62, 0.25);
            }
            .cnspk-session-card__duration {
                position: absolute;
                top: 14px; right: 14px;
                font-family: var(--font-mono);
                font-size: 11px;
                color: var(--bone-2);
                padding: 4px 8px;
                border-radius: var(--r-sm);
                background: rgba(15, 17, 21, 0.82);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                border: 1px solid var(--slate);
            }

            .cnspk-session-card__body {
                display: flex;
                flex-direction: column;
                flex: 1 1 auto;
                padding: 24px;
            }
            .cnspk-session-card__speaker {
                display: flex; align-items: center; gap: 12px;
                margin-bottom: 16px;
            }
            .cnspk-session-card__speaker-img {
                width: 40px; height: 40px;
                border-radius: var(--r-pill);
                object-fit: cover;
                border: 2px solid rgba(199, 255, 62, 0.35);
                flex-shrink: 0;
            }
            .cnspk-session-card__speaker-name {
                font-size: 14px;
                font-weight: 600;
                color: var(--bone);
                line-height: 1.2;
            }
            .cnspk-session-card__speaker-role {
                font-family: var(--font-mono);
                font-size: 11px;
                color: var(--steel);
                letter-spacing: 0.02em;
            }

            .cnspk-session-card__title {
                font-family: var(--font-display);
                font-style: italic;
                font-weight: 800;
                font-size: 21px;
                line-height: 1.05;
                letter-spacing: -0.02em;
                text-transform: uppercase;
                color: var(--bone);
                margin-bottom: 10px;
                transition: color var(--dur-hover) var(--ease);
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
            .cnspk-session-card:hover .cnspk-session-card__title { color: var(--lime); }

            .cnspk-session-card__desc {
                font-size: 14px;
                line-height: 1.55;
                color: var(--bone-2);
                margin-bottom: 16px;
                flex: 1 1 auto;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            .cnspk-session-card__meta {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                margin-bottom: 18px;
                font-family: var(--font-mono);
                font-size: 11px;
                color: var(--steel);
                letter-spacing: 0.04em;
            }
            .cnspk-session-card__meta-date { display: inline-flex; align-items: center; gap: 6px; }
            .cnspk-session-card__meta-date svg { width: 13px; height: 13px; }
            .cnspk-session-card__status {
                padding: 3px 8px;
                border-radius: var(--r-sm);
                text-transform: uppercase;
                letter-spacing: 0.06em;
            }
            .cnspk-session-card__status--upcoming { background: rgba(245, 158, 11, 0.18); color: var(--watch); }
            .cnspk-session-card__status--available { background: rgba(199, 255, 62, 0.15); color: var(--lime); }

            .cnspk-session-card__foot {
                margin-top: auto;
                padding-top: 16px;
                border-top: 1px dashed var(--slate);
            }
            .cnspk-session-card__action {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                width: 100%;
                padding: 12px 18px;
                background: var(--lime);
                color: var(--carbon);
                font-family: var(--font-mono);
                font-weight: 700;
                font-size: 13px;
                letter-spacing: 0.04em;
                text-transform: uppercase;
                text-decoration: none;
                border-radius: var(--r-sm);
                transition: background var(--dur-hover) var(--ease);
            }
            .cnspk-session-card__action:hover,
            .cnspk-session-card:hover .cnspk-session-card__action { background: var(--lime-glow); color: var(--carbon); }

            @media (prefers-reduced-motion: reduce) {
                .cnspk-session-card,
                .cnspk-session-card__img,
                .cnspk-session-card::before,
                .cnspk-session-card__play,
                .cnspk-session-card__play-btn { transition: none; }
                .cnspk-session-card:hover { transform: none; }
                .cnspk-session-card:hover .cnspk-session-card__img { transform: none; }
            }
        `;
        document.head.appendChild(style);
    }

    render() {
        this.injectStyles();

        const { id, title, description, date, duration, type, topic, recordingUrl, registrationUrl, thumbnail, speaker } = this.session;

        const safeTitle = sanitize(title);
        const safeDesc = sanitize(description);
        const safeTopic = sanitize(topic);
        const safeDuration = sanitize(duration);
        const safeThumb = sanitize(thumbnail);

        const sp = speaker || {};
        const safeSpeakerName = sanitize(sp.name);
        const safeSpeakerRole = sanitize(sp.role);
        const safeSpeakerCompany = sanitize(sp.company);
        const safeSpeakerImg = sanitize(sp.image);

        const isUpcoming = type === 'upcoming';
        const parsed = new Date(date);
        const formattedDate = isNaN(parsed.getTime())
            ? ''
            : parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

        // Routing preserved: recorded sessions are a clickable card linking to
        // the detail view; upcoming sessions are a static div with a Register CTA.
        const cardLink = isUpcoming ? null : `/sessions/view/?id=${id}`;
        const wrapperTag = cardLink ? 'a' : 'div';
        const wrapperAttrs = cardLink ? `href="${cardLink}"` : '';

        const calIcon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`;
        const playIcon = `<svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;

        const speakerRoleLine = [safeSpeakerRole, safeSpeakerCompany].filter(Boolean).join(' @ ');

        return `
            <${wrapperTag} ${wrapperAttrs} class="cnspk-session-card" data-session-id="${id}">
                <div class="cnspk-session-card__media">
                    <img src="${safeThumb}"
                         alt="${safeTitle}"
                         class="cnspk-session-card__img"
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80'">
                    <div class="cnspk-session-card__scrim"></div>
                    ${!isUpcoming ? `
                    <div class="cnspk-session-card__play" aria-hidden="true">
                        <span class="cnspk-session-card__play-btn">${playIcon}</span>
                    </div>` : ''}
                    ${safeTopic ? `<span class="cnspk-session-card__topic">${safeTopic}</span>` : ''}
                    ${safeDuration ? `<span class="cnspk-session-card__duration">${safeDuration}</span>` : ''}
                </div>

                <div class="cnspk-session-card__body">
                    <div class="cnspk-session-card__speaker">
                        <img src="${safeSpeakerImg}"
                             alt="${safeSpeakerName}"
                             class="cnspk-session-card__speaker-img"
                             loading="lazy"
                             onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(sp.name || 'CNSPK')}&background=C7FF3E&color=0F1115'">
                        <div>
                            <p class="cnspk-session-card__speaker-name">${safeSpeakerName}</p>
                            ${speakerRoleLine ? `<p class="cnspk-session-card__speaker-role">${speakerRoleLine}</p>` : ''}
                        </div>
                    </div>

                    <h3 class="cnspk-session-card__title">${safeTitle}</h3>
                    <p class="cnspk-session-card__desc">${safeDesc}</p>

                    <div class="cnspk-session-card__meta">
                        ${formattedDate ? `<span class="cnspk-session-card__meta-date">${calIcon}${formattedDate}</span>` : '<span></span>'}
                        <span class="cnspk-session-card__status ${isUpcoming ? 'cnspk-session-card__status--upcoming' : 'cnspk-session-card__status--available'}">
                            ${isUpcoming ? 'Upcoming' : 'Available'}
                        </span>
                    </div>

                    <div class="cnspk-session-card__foot">
                        ${isUpcoming ? `
                            <a href="${sanitize(registrationUrl)}"
                               target="_blank"
                               rel="noopener noreferrer"
                               class="cnspk-session-card__action">
                                Register Now →
                            </a>
                        ` : `
                            <span class="cnspk-session-card__action">▶ Watch Recording</span>
                        `}
                    </div>
                </div>
            </${wrapperTag}>
        `;
    }
}
