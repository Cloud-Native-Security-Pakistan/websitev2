/**
 * CNSPK · BlogCard (v2)
 * ----------------------------------------------------------
 * Electric-register blog/news card. The WHOLE card is a single
 * clickable external link to the source article: a charcoal
 * surface with a lime top-stripe-on-hover, a -4px lift, a lime
 * category chip, a mono date · read-time meta line, an italic
 * display title, a summary, mono tag chips, and a "Read on …"
 * source line.
 *
 * Data contract (consumes data/posts.json, UNCHANGED):
 *   new BlogCard(post).render() -> HTML string
 *   Fields: title, date (YYYY-MM-DD), category, readTime,
 *           summary, source, sourceUrl, tags[]
 *
 * Security: this card writes external data into attribute and
 * href contexts, so it does NOT use sanitize() (DOMPurify does
 * not escape quotes). Every interpolated text value goes through
 * escapeAttr() and the href goes through safeUrl() — both from
 * utils.js — which is the correct behaviour for these contexts.
 *
 * Styles consumed from /css/tokens.css (vars only). Component
 * styling is injected once, scoped under .cnspk-blog-card,
 * matching the EventCard/Navbar/Footer convention.
 * ----------------------------------------------------------
 */

import { escapeAttr, safeUrl } from './utils.js';

export class BlogCard {
    constructor(post) {
        this.post = post;
    }

    /** Component-scoped styles. Tokens come from tokens.css. Injected once. */
    injectStyles() {
        if (typeof document === 'undefined') return;
        if (document.getElementById('cnspk-blog-card-styles')) return;

        const style = document.createElement('style');
        style.id = 'cnspk-blog-card-styles';
        style.textContent = `
            .cnspk-blog-card__frame {
                display: flex;
                height: 100%;
            }

            .cnspk-blog-card {
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
                position: relative;
                padding: 28px;
                background: var(--charcoal);
                border: 1px solid var(--slate);
                border-radius: var(--r-md);
                overflow: hidden;
                text-decoration: none;
                color: inherit;
                transition: border-color var(--dur-elevate) var(--ease),
                            transform var(--dur-elevate) var(--ease),
                            box-shadow var(--dur-elevate) var(--ease);
            }
            .cnspk-blog-card::before {
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
            .cnspk-blog-card:hover,
            .cnspk-blog-card:focus-visible {
                border-color: var(--lime);
                transform: translateY(-4px);
                box-shadow: var(--shadow-soft);
            }
            .cnspk-blog-card:hover::before,
            .cnspk-blog-card:focus-visible::before { transform: scaleX(1); }

            .cnspk-blog-card__top {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                flex-wrap: wrap;
                margin-bottom: 18px;
            }
            .cnspk-blog-card__category {
                font-family: var(--font-mono);
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                color: var(--lime);
                background: rgba(199, 255, 62, 0.12);
                border: 1px solid rgba(199, 255, 62, 0.25);
                padding: 5px 10px;
                border-radius: var(--r-pill);
            }
            .cnspk-blog-card__meta {
                font-family: var(--font-mono);
                font-size: 11px;
                letter-spacing: 0.04em;
                color: var(--steel);
                white-space: nowrap;
            }

            .cnspk-blog-card__title {
                font-family: var(--font-display);
                font-style: italic;
                font-weight: 800;
                font-size: 22px;
                line-height: 1.06;
                letter-spacing: -0.02em;
                text-transform: uppercase;
                color: var(--bone);
                margin-bottom: 14px;
                transition: color var(--dur-hover) var(--ease);
            }
            .cnspk-blog-card:hover .cnspk-blog-card__title,
            .cnspk-blog-card:focus-visible .cnspk-blog-card__title { color: var(--lime); }

            .cnspk-blog-card__summary {
                font-size: 14px;
                line-height: 1.6;
                color: var(--bone-2);
                margin-bottom: 20px;
                flex: 1 1 auto;
                display: -webkit-box;
                -webkit-line-clamp: 4;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            .cnspk-blog-card__tags {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 20px;
            }
            .cnspk-blog-card__tag {
                font-family: var(--font-mono);
                font-size: 10px;
                font-weight: 500;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: var(--bone-2);
                background: var(--slate);
                padding: 4px 8px;
                border-radius: var(--r-sm);
            }

            .cnspk-blog-card__source {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-top: auto;
                padding-top: 16px;
                border-top: 1px dashed var(--slate);
                font-family: var(--font-mono);
                font-size: 11px;
                font-weight: 500;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: var(--lime);
                transition: gap var(--dur-hover) var(--ease),
                            color var(--dur-hover) var(--ease);
            }
            .cnspk-blog-card__source-arrow { flex-shrink: 0; }
            .cnspk-blog-card:hover .cnspk-blog-card__source,
            .cnspk-blog-card:focus-visible .cnspk-blog-card__source { gap: 12px; color: var(--lime-glow); }

            @media (prefers-reduced-motion: reduce) {
                .cnspk-blog-card,
                .cnspk-blog-card::before,
                .cnspk-blog-card__title,
                .cnspk-blog-card__source { transition: none; }
                .cnspk-blog-card:hover,
                .cnspk-blog-card:focus-visible { transform: none; }
                .cnspk-blog-card:hover::before,
                .cnspk-blog-card:focus-visible::before { transform: scaleX(0); }
            }
        `;
        document.head.appendChild(style);
    }

    render() {
        this.injectStyles();

        const { title, date, category, readTime, summary, source, sourceUrl, tags } = this.post;

        // Attribute/href-context output ONLY — escapeAttr() + safeUrl(), never sanitize().
        const safeTitle = escapeAttr(title);
        const safeCategory = escapeAttr(category);
        const safeReadTime = escapeAttr(readTime);
        const safeSummary = escapeAttr(summary);
        const safeSource = escapeAttr(source);
        const href = safeUrl(sourceUrl);

        // Guarded human-readable date.
        const parsed = new Date(date);
        const validDate = !isNaN(parsed.getTime());
        const formattedDate = validDate
            ? escapeAttr(parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }))
            : '';

        // Mono meta line: "<date> · <readTime>" — either part may be missing.
        const metaLine = [formattedDate, safeReadTime].filter(Boolean).join(' · ');

        const tagsHtml = Array.isArray(tags)
            ? tags
                .filter(Boolean)
                .map(tag => `<span class="cnspk-blog-card__tag">${escapeAttr(tag)}</span>`)
                .join('')
            : '';

        // Build the accessible label as plain text, then escape the whole thing once.
        const ariaLabel = escapeAttr(
            `Read '${title || 'this article'}' on ${source || 'the source'} (opens in a new tab)`
        );

        return `
            <article class="cnspk-blog-card__frame">
                <a class="cnspk-blog-card"
                   href="${href}"
                   target="_blank"
                   rel="noopener noreferrer"
                   aria-label="${ariaLabel}">
                    <div class="cnspk-blog-card__top">
                        ${safeCategory ? `<span class="cnspk-blog-card__category">${safeCategory}</span>` : ''}
                        ${metaLine ? `<span class="cnspk-blog-card__meta">${metaLine}</span>` : ''}
                    </div>

                    <h3 class="cnspk-blog-card__title">${safeTitle}</h3>

                    ${safeSummary ? `<p class="cnspk-blog-card__summary">${safeSummary}</p>` : ''}

                    ${tagsHtml ? `<div class="cnspk-blog-card__tags">${tagsHtml}</div>` : ''}

                    <span class="cnspk-blog-card__source">
                        <span>Read on ${safeSource || 'source'}</span>
                        <span class="cnspk-blog-card__source-arrow" aria-hidden="true">&rarr;</span>
                    </span>
                </a>
            </article>
        `;
    }
}
