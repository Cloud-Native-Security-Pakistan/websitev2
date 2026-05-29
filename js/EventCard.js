/**
 * CNSPK · EventCard (v2)
 * ----------------------------------------------------------
 * Electric-register event card: charcoal surface, lime
 * top-stripe-on-hover, card lift, mono city/type tag chips,
 * an italic display title, and a dashed-border meta row.
 *
 * Data contract (UNCHANGED):
 *   new EventCard(event).render() -> HTML string
 *   Consumes: title, date, time, location, type, description,
 *             image, link  (from data/events.json)
 *
 * Security: all interpolated data is passed through the
 * DOMPurify-backed sanitize() helper, exactly as before.
 *
 * Styles consumed from /css/tokens.css (vars only). Component
 * styling is injected once, scoped under .cnspk-event-card,
 * matching the Navbar/Footer convention.
 * ----------------------------------------------------------
 */

import { sanitize } from './utils.js';

export class EventCard {
    constructor(event) {
        this.event = event;
    }

    /** Component-scoped styles. Tokens come from tokens.css. Injected once. */
    injectStyles() {
        if (typeof document === 'undefined') return;
        if (document.getElementById('cnspk-event-card-styles')) return;

        const style = document.createElement('style');
        style.id = 'cnspk-event-card-styles';
        style.textContent = `
            .cnspk-event-card {
                display: flex;
                flex-direction: column;
                height: 100%;
                background: var(--charcoal);
                border: 1px solid var(--slate);
                border-radius: var(--r-md);
                overflow: hidden;
                position: relative;
                transition: border-color var(--dur-elevate) var(--ease),
                            transform var(--dur-elevate) var(--ease),
                            box-shadow var(--dur-elevate) var(--ease);
            }
            .cnspk-event-card::before {
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
            .cnspk-event-card:hover,
            .cnspk-event-card:focus-within {
                border-color: var(--lime);
                transform: translateY(-4px);
                box-shadow: var(--shadow-soft);
            }
            .cnspk-event-card:hover::before,
            .cnspk-event-card:focus-within::before { transform: scaleX(1); }

            .cnspk-event-card__media {
                position: relative;
                height: 200px;
                overflow: hidden;
            }
            .cnspk-event-card__img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 700ms var(--ease), filter var(--dur-elevate) var(--ease);
            }
            .cnspk-event-card:hover .cnspk-event-card__img { transform: scale(1.05); }
            .cnspk-event-card__img--past { filter: grayscale(1); opacity: 0.55; }
            .cnspk-event-card:hover .cnspk-event-card__img--past { filter: grayscale(0); opacity: 1; }

            .cnspk-event-card__scrim {
                position: absolute; inset: 0;
                background: linear-gradient(to top, var(--carbon) 0%, transparent 55%);
                pointer-events: none;
            }
            .cnspk-event-card__date-badge {
                position: absolute;
                top: 14px; right: 14px;
                display: flex; flex-direction: column; align-items: center;
                min-width: 56px;
                padding: 6px 10px;
                background: rgba(15, 17, 21, 0.82);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                border: 1px solid var(--slate);
                border-radius: var(--r-md);
            }
            .cnspk-event-card__date-month {
                font-family: var(--font-mono);
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                color: var(--lime);
            }
            .cnspk-event-card__date-day {
                font-family: var(--font-display);
                font-style: italic;
                font-weight: 800;
                font-size: 22px;
                line-height: 1;
                color: var(--bone);
            }

            .cnspk-event-card__body {
                display: flex;
                flex-direction: column;
                flex: 1 1 auto;
                padding: 24px;
            }
            .cnspk-event-card__tags {
                display: flex; gap: 8px; flex-wrap: wrap;
                margin-bottom: 16px;
            }
            .cnspk-event-card__tag {
                font-family: var(--font-mono);
                font-size: 10px;
                font-weight: 500;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                padding: 4px 8px;
                border-radius: var(--r-sm);
            }
            .cnspk-event-card__tag--city { background: rgba(199, 255, 62, 0.15); color: var(--lime); }
            .cnspk-event-card__tag--type { background: var(--slate); color: var(--bone-2); }

            .cnspk-event-card__title {
                font-family: var(--font-display);
                font-style: italic;
                font-weight: 800;
                font-size: 24px;
                line-height: 1.04;
                letter-spacing: -0.02em;
                text-transform: uppercase;
                color: var(--bone);
                margin-bottom: 12px;
                transition: color var(--dur-hover) var(--ease);
            }
            .cnspk-event-card:hover .cnspk-event-card__title { color: var(--lime); }

            .cnspk-event-card__desc {
                font-size: 14px;
                line-height: 1.55;
                color: var(--bone-2);
                margin-bottom: 20px;
                flex: 1 1 auto;
                display: -webkit-box;
                -webkit-line-clamp: 3;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            .cnspk-event-card__meta {
                display: flex;
                align-items: center;
                gap: 14px;
                flex-wrap: wrap;
                margin-top: auto;
                padding-top: 16px;
                border-top: 1px dashed var(--slate);
                font-family: var(--font-mono);
                font-size: 11px;
                letter-spacing: 0.04em;
                color: var(--steel);
            }
            .cnspk-event-card__meta-item {
                display: inline-flex; align-items: center; gap: 6px;
                min-width: 0;
            }
            .cnspk-event-card__meta-item svg { width: 13px; height: 13px; flex-shrink: 0; }
            .cnspk-event-card__meta-item span {
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            }
            .cnspk-event-card__meta strong { color: var(--bone); font-weight: 600; }

            .cnspk-event-card__cta {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                margin-left: auto;
                font-family: var(--font-mono);
                font-size: 11px;
                font-weight: 500;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: var(--lime);
                transition: gap var(--dur-hover) var(--ease), color var(--dur-hover) var(--ease);
            }
            .cnspk-event-card__cta--past { color: var(--steel); }
            .cnspk-event-card:hover .cnspk-event-card__cta { gap: 12px; color: var(--lime-glow); }
            .cnspk-event-card:hover .cnspk-event-card__cta--past { color: var(--bone); }
            .cnspk-event-card__cta svg { width: 14px; height: 14px; }

            @media (prefers-reduced-motion: reduce) {
                .cnspk-event-card,
                .cnspk-event-card__img,
                .cnspk-event-card::before,
                .cnspk-event-card__cta { transition: none; }
                .cnspk-event-card:hover { transform: none; }
                .cnspk-event-card:hover .cnspk-event-card__img { transform: none; }
            }
        `;
        document.head.appendChild(style);
    }

    render() {
        this.injectStyles();

        const { title, date, time, location, type, description, image, link } = this.event;

        const safeTitle = sanitize(title);
        const safeDesc = sanitize(description);
        const safeLoc = sanitize(location);
        const safeType = sanitize(type);
        const safeTime = sanitize(time);
        const safeLink = sanitize(link);
        const safeImage = sanitize(image);

        // City chip derived from the real location field ("Lahore, Pakistan" -> "Lahore").
        const city = location ? sanitize(String(location).split(',')[0].trim()) : '';

        const parsed = new Date(date);
        const validDate = !isNaN(parsed.getTime());
        const isPast = validDate && parsed < new Date();
        const month = validDate ? parsed.toLocaleString('default', { month: 'short' }) : '';
        const day = validDate ? parsed.getDate() : '';
        const fullDate = validDate
            ? parsed.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
            : safeTitle ? '' : '';

        const pinIcon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`;
        const arrowIcon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>`;

        return `
            <article class="cnspk-event-card">
                <div class="cnspk-event-card__media">
                    <img src="${safeImage}"
                         alt="${safeTitle}"
                         class="cnspk-event-card__img ${isPast ? 'cnspk-event-card__img--past' : ''}"
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80'">
                    <div class="cnspk-event-card__scrim"></div>
                    ${validDate ? `
                    <div class="cnspk-event-card__date-badge" aria-hidden="true">
                        <span class="cnspk-event-card__date-month">${month}</span>
                        <span class="cnspk-event-card__date-day">${day}</span>
                    </div>` : ''}
                </div>

                <div class="cnspk-event-card__body">
                    <div class="cnspk-event-card__tags">
                        ${city ? `<span class="cnspk-event-card__tag cnspk-event-card__tag--city">${city}</span>` : ''}
                        ${safeType ? `<span class="cnspk-event-card__tag cnspk-event-card__tag--type">${safeType}</span>` : ''}
                    </div>

                    <h3 class="cnspk-event-card__title">${safeTitle}</h3>

                    <p class="cnspk-event-card__desc">${safeDesc}</p>

                    <div class="cnspk-event-card__meta">
                        ${safeLoc ? `
                        <span class="cnspk-event-card__meta-item">
                            ${pinIcon}
                            <span>${safeLoc}</span>
                        </span>` : ''}
                        ${safeTime ? `<span class="cnspk-event-card__meta-item"><span>${safeTime}</span></span>` : ''}
                        ${fullDate ? `<span class="cnspk-event-card__meta-item"><span>${fullDate}</span></span>` : ''}
                        <a href="${safeLink}"
                           target="_blank"
                           rel="noopener noreferrer"
                           class="cnspk-event-card__cta ${isPast ? 'cnspk-event-card__cta--past' : ''}"
                           aria-label="${isPast ? 'View details for' : 'Register for'} ${safeTitle}">
                            <span>${isPast ? 'View details' : 'Register'}</span>
                            ${arrowIcon}
                        </a>
                    </div>
                </div>
            </article>
        `;
    }
}
