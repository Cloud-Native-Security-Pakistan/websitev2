/**
 * CNSPK · SessionDetail (v2)
 * ----------------------------------------------------------
 * The session permalink view. This is the site's moat — it
 * KEEPS, intact:
 *   - the YouTube embed / upcoming-registration hero
 *   - the AI Summary block
 *   - the Overview
 *   - the Key Takeaways list
 *   - the timestamped, AI-generated Transcript sidebar
 *   - share-to-LinkedIn, share-to-X/Twitter, and copy-link
 *
 * Only the surface is rethemed to the Electric register.
 *
 * Data contract (UNCHANGED):
 *   new SessionDetail(session).render() -> HTML string
 *   Consumes: id, title, description, summary, keyTakeaways[],
 *             transcript[{time,text}], date, duration, type,
 *             topic, recordingUrl, registrationUrl, thumbnail,
 *             speaker {name, role, company, image}
 *   Keeps the inline copy-link onclick handler and the
 *   window.location.href share URLs.
 *
 * Styles consumed from /css/tokens.css (vars only). Component
 * styling is injected once, scoped under .cnspk-session-detail.
 * ----------------------------------------------------------
 */

import { sanitize } from './utils.js';

export class SessionDetail {
    constructor(session) {
        this.session = session;
    }

    /** Component-scoped styles. Tokens come from tokens.css. Injected once. */
    injectStyles() {
        if (typeof document === 'undefined') return;
        if (document.getElementById('cnspk-session-detail-styles')) return;

        const style = document.createElement('style');
        style.id = 'cnspk-session-detail-styles';
        style.textContent = `
            .cnspk-session-detail { padding-bottom: 48px; }

            .cnspk-sd__topbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                margin-bottom: 24px;
                flex-wrap: wrap;
            }
            .cnspk-sd__back {
                display: inline-flex; align-items: center; gap: 10px;
                font-family: var(--font-mono);
                font-size: 12px;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: var(--steel);
                text-decoration: none;
                transition: color var(--dur-hover) var(--ease);
            }
            .cnspk-sd__back:hover { color: var(--lime); }
            .cnspk-sd__back-arrow {
                width: 32px; height: 32px;
                display: grid; place-items: center;
                border-radius: var(--r-pill);
                border: 1px solid var(--slate);
                transition: border-color var(--dur-hover) var(--ease), color var(--dur-hover) var(--ease);
            }
            .cnspk-sd__back:hover .cnspk-sd__back-arrow { border-color: var(--lime); color: var(--lime); }

            .cnspk-sd__share { display: flex; gap: 8px; }
            .cnspk-sd__share-btn {
                width: 40px; height: 40px;
                display: grid; place-items: center;
                border-radius: var(--r-pill);
                background: var(--charcoal);
                border: 1px solid var(--slate);
                color: var(--bone-2);
                cursor: pointer;
                transition: border-color var(--dur-hover) var(--ease),
                            color var(--dur-hover) var(--ease),
                            background var(--dur-hover) var(--ease);
            }
            .cnspk-sd__share-btn:hover { border-color: var(--lime); color: var(--lime); }
            .cnspk-sd__share-btn svg { width: 16px; height: 16px; }
            .cnspk-sd__share-btn--copied { border-color: var(--lime); color: var(--lime); background: rgba(199, 255, 62, 0.12); }

            .cnspk-sd__hero {
                position: relative;
                aspect-ratio: 16 / 9;
                border-radius: var(--r-xl);
                overflow: hidden;
                background: var(--charcoal);
                border: 1px solid var(--slate);
                box-shadow: var(--shadow-soft);
                margin-bottom: 32px;
            }
            .cnspk-sd__hero iframe { width: 100%; height: 100%; border: 0; }
            .cnspk-sd__hero-img { width: 100%; height: 100%; object-fit: cover; opacity: 0.5; }
            .cnspk-sd__hero-overlay {
                position: absolute; inset: 0;
                display: grid; place-items: center;
                padding: 24px;
            }
            .cnspk-sd__upcoming-card {
                text-align: center;
                max-width: 420px;
                padding: 28px;
                background: rgba(15, 17, 21, 0.85);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid var(--slate);
                border-radius: var(--r-lg);
            }
            .cnspk-sd__upcoming-eyebrow {
                font-family: var(--font-mono);
                font-size: 11px;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                color: var(--lime);
                margin-bottom: 8px;
            }
            .cnspk-sd__upcoming-title {
                font-family: var(--font-display);
                font-style: italic;
                font-weight: 800;
                text-transform: uppercase;
                font-size: 24px;
                letter-spacing: -0.02em;
                color: var(--bone);
                margin-bottom: 18px;
            }

            .cnspk-sd__head { margin-bottom: 40px; }
            .cnspk-sd__meta-row {
                display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
                margin-bottom: 18px;
                font-family: var(--font-mono);
                font-size: 12px;
                color: var(--steel);
                letter-spacing: 0.04em;
            }
            .cnspk-sd__topic-chip {
                font-size: 10px;
                font-weight: 500;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                padding: 5px 10px;
                border-radius: var(--r-sm);
                background: rgba(199, 255, 62, 0.15);
                color: var(--lime);
                border: 1px solid rgba(199, 255, 62, 0.25);
            }
            .cnspk-sd__title {
                font-family: var(--font-display);
                font-style: italic;
                font-weight: 800;
                text-transform: uppercase;
                font-size: clamp(30px, 5vw, 52px);
                line-height: 0.98;
                letter-spacing: -0.03em;
                color: var(--bone);
                margin-bottom: 28px;
            }
            .cnspk-sd__speaker {
                display: inline-flex; align-items: center; gap: 16px;
                padding: 14px 24px 14px 14px;
                border-radius: var(--r-lg);
                background: var(--charcoal);
                border: 1px solid var(--slate);
                transition: border-color var(--dur-hover) var(--ease);
            }
            .cnspk-sd__speaker:hover { border-color: var(--lime); }
            .cnspk-sd__speaker-img {
                width: 48px; height: 48px;
                border-radius: var(--r-pill);
                object-fit: cover;
                border: 2px solid rgba(199, 255, 62, 0.35);
            }
            .cnspk-sd__speaker-name {
                font-size: 18px;
                font-weight: 700;
                color: var(--bone);
                line-height: 1.2;
            }
            .cnspk-sd__speaker-role {
                font-family: var(--font-mono);
                font-size: 12px;
                color: var(--lime);
                letter-spacing: 0.02em;
            }

            .cnspk-sd__grid {
                display: grid;
                grid-template-columns: 2fr 1fr;
                gap: 32px;
                align-items: start;
            }
            @media (max-width: 880px) { .cnspk-sd__grid { grid-template-columns: 1fr; } }

            .cnspk-sd__main { display: flex; flex-direction: column; gap: 32px; }

            .cnspk-sd__panel {
                background: var(--charcoal);
                border: 1px solid var(--slate);
                border-radius: var(--r-lg);
                padding: 24px;
            }
            .cnspk-sd__panel--summary { border-left: 3px solid var(--lime); }

            .cnspk-sd__panel-head {
                display: flex; align-items: center; gap: 10px;
                margin-bottom: 16px;
            }
            .cnspk-sd__panel-head svg { width: 18px; height: 18px; color: var(--lime); }
            .cnspk-sd__panel-title {
                font-family: var(--font-display);
                font-style: italic;
                font-weight: 800;
                text-transform: uppercase;
                font-size: 18px;
                letter-spacing: -0.01em;
                color: var(--bone);
            }
            .cnspk-sd__panel-body {
                font-size: 15px;
                line-height: 1.65;
                color: var(--bone-2);
            }

            .cnspk-sd__section-title {
                font-family: var(--font-display);
                font-style: italic;
                font-weight: 800;
                text-transform: uppercase;
                font-size: 22px;
                letter-spacing: -0.02em;
                color: var(--bone);
                margin-bottom: 14px;
            }
            .cnspk-sd__overview {
                font-size: 16px;
                line-height: 1.7;
                color: var(--bone-2);
            }

            .cnspk-sd__takeaways { display: flex; flex-direction: column; gap: 12px; }
            .cnspk-sd__takeaway {
                display: flex; align-items: flex-start; gap: 12px;
                font-size: 15px;
                line-height: 1.6;
                color: var(--bone-2);
            }
            .cnspk-sd__takeaway-dot {
                width: 7px; height: 7px;
                border-radius: 50%;
                background: var(--lime);
                margin-top: 9px;
                flex-shrink: 0;
                box-shadow: 0 0 8px rgba(199, 255, 62, 0.5);
            }

            .cnspk-sd__transcript {
                background: var(--charcoal);
                border: 1px solid var(--slate);
                border-radius: var(--r-lg);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                height: 520px;
                position: sticky;
                top: 88px;
            }
            .cnspk-sd__transcript-head {
                display: flex; align-items: center; justify-content: space-between;
                padding: 16px 18px;
                border-bottom: 1px solid var(--slate);
                background: rgba(0, 0, 0, 0.2);
            }
            .cnspk-sd__transcript-title {
                font-family: var(--font-display);
                font-style: italic;
                font-weight: 800;
                text-transform: uppercase;
                font-size: 16px;
                letter-spacing: -0.01em;
                color: var(--bone);
            }
            .cnspk-sd__transcript-flag {
                font-family: var(--font-mono);
                font-size: 10px;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                color: var(--lime);
            }
            .cnspk-sd__transcript-body {
                flex: 1 1 auto;
                overflow-y: auto;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 6px;
                scrollbar-width: thin;
                scrollbar-color: var(--slate) transparent;
            }
            .cnspk-sd__transcript-body::-webkit-scrollbar { width: 8px; }
            .cnspk-sd__transcript-body::-webkit-scrollbar-thumb {
                background: var(--slate); border-radius: var(--r-pill);
            }
            .cnspk-sd__cue {
                padding: 10px;
                border-radius: var(--r-sm);
                cursor: pointer;
                transition: background var(--dur-hover) var(--ease);
            }
            .cnspk-sd__cue:hover { background: rgba(199, 255, 62, 0.06); }
            .cnspk-sd__cue-time {
                display: block;
                font-family: var(--font-mono);
                font-size: 11px;
                color: var(--lime);
                letter-spacing: 0.04em;
                margin-bottom: 4px;
                opacity: 0.7;
                transition: opacity var(--dur-hover) var(--ease);
            }
            .cnspk-sd__cue:hover .cnspk-sd__cue-time { opacity: 1; }
            .cnspk-sd__cue-text {
                font-size: 14px;
                line-height: 1.55;
                color: var(--steel);
                transition: color var(--dur-hover) var(--ease);
            }
            .cnspk-sd__cue:hover .cnspk-sd__cue-text { color: var(--bone-2); }
            .cnspk-sd__transcript-empty {
                text-align: center;
                padding: 40px 16px;
                color: var(--steel);
                font-size: 14px;
            }

            @media (prefers-reduced-motion: reduce) {
                .cnspk-sd__back-arrow,
                .cnspk-sd__share-btn,
                .cnspk-sd__cue { transition: none; }
            }
        `;
        document.head.appendChild(style);
    }

    render() {
        this.injectStyles();

        const { id, title, description, summary, keyTakeaways, transcript, date, duration, type, topic, recordingUrl, thumbnail, speaker } = this.session;

        const safeTitle = sanitize(title);
        const safeDesc = sanitize(description);
        const safeSummary = sanitize(summary);
        const safeTopic = sanitize(topic);
        const safeDuration = sanitize(duration);
        const safeThumb = sanitize(thumbnail);

        const sp = speaker || {};
        const safeSpeakerName = sanitize(sp.name);
        const safeSpeakerRole = sanitize(sp.role);
        const safeSpeakerCompany = sanitize(sp.company);
        const safeSpeakerImg = sanitize(sp.image);
        const speakerRoleLine = [safeSpeakerRole, safeSpeakerCompany].filter(Boolean).join(' @ ');

        const parsed = new Date(date);
        const formattedDate = isNaN(parsed.getTime())
            ? ''
            : parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        const isRecorded = type === 'recorded';
        const embedId = isRecorded && recordingUrl ? recordingUrl.split('/').pop() : null;

        // Share URLs — preserved from the original moat behaviour.
        const shareUrl = window.location.href;
        const linkedInShare = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
        const twitterShare = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out this session on "${safeTitle}" by ${sp.name || 'CNSPK'} at Cloud Native Security Pakistan!`)}&url=${encodeURIComponent(shareUrl)}`;

        const liIcon = `<svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`;
        const xIcon = `<svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
        const copyIcon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>`;
        const boltIcon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`;

        return `
            <div class="cnspk-session-detail">
                <!-- Top bar: back + share -->
                <div class="cnspk-sd__topbar">
                    <a href="/sessions/" class="cnspk-sd__back">
                        <span class="cnspk-sd__back-arrow" aria-hidden="true">←</span>
                        <span>Back to Sessions</span>
                    </a>

                    <div class="cnspk-sd__share">
                        <a href="${linkedInShare}" target="_blank" rel="noopener noreferrer" class="cnspk-sd__share-btn" aria-label="Share on LinkedIn">${liIcon}</a>
                        <a href="${twitterShare}" target="_blank" rel="noopener noreferrer" class="cnspk-sd__share-btn" aria-label="Share on X">${xIcon}</a>
                        <button type="button" class="cnspk-sd__share-btn" aria-label="Copy link" onclick="navigator.clipboard.writeText(window.location.href).then(() => { const el = this; el.classList.add('cnspk-sd__share-btn--copied'); setTimeout(() => el.classList.remove('cnspk-sd__share-btn--copied'), 2000) })">${copyIcon}</button>
                    </div>
                </div>

                <!-- Hero: embed or upcoming-registration -->
                <div class="cnspk-sd__hero">
                    ${isRecorded && embedId ? `
                        <iframe src="https://www.youtube.com/embed/${embedId}?autoplay=1&mute=1" title="${safeTitle}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                    ` : `
                        <img src="${safeThumb}" class="cnspk-sd__hero-img" alt="${safeTitle}">
                        <div class="cnspk-sd__hero-overlay">
                            <div class="cnspk-sd__upcoming-card">
                                <div class="cnspk-sd__upcoming-eyebrow">// upcoming-session</div>
                                <h3 class="cnspk-sd__upcoming-title">Registration Open</h3>
                                <a href="${sanitize(this.session.registrationUrl)}" target="_blank" rel="noopener noreferrer" class="btn-primary btn-primary--sm">Register Here</a>
                            </div>
                        </div>
                    `}
                </div>

                <!-- Title & meta -->
                <div class="cnspk-sd__head">
                    <div class="cnspk-sd__meta-row">
                        ${safeTopic ? `<span class="cnspk-sd__topic-chip">${safeTopic}</span>` : ''}
                        ${formattedDate ? `<span>${formattedDate}</span>` : ''}
                        ${safeDuration ? `<span>· ${safeDuration}</span>` : ''}
                    </div>
                    <h1 class="cnspk-sd__title">${safeTitle}</h1>

                    <div class="cnspk-sd__speaker">
                        <img src="${safeSpeakerImg}" class="cnspk-sd__speaker-img" alt="${safeSpeakerName}" loading="lazy"
                             onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(sp.name || 'CNSPK')}&background=C7FF3E&color=0F1115'">
                        <div>
                            <p class="cnspk-sd__speaker-name">${safeSpeakerName}</p>
                            ${speakerRoleLine ? `<p class="cnspk-sd__speaker-role">${speakerRoleLine}</p>` : ''}
                        </div>
                    </div>
                </div>

                <!-- Body grid -->
                <div class="cnspk-sd__grid">
                    <div class="cnspk-sd__main">
                        ${summary ? `
                        <div class="cnspk-sd__panel cnspk-sd__panel--summary">
                            <div class="cnspk-sd__panel-head">
                                ${boltIcon}
                                <h3 class="cnspk-sd__panel-title">AI Summary</h3>
                            </div>
                            <p class="cnspk-sd__panel-body">${safeSummary}</p>
                        </div>
                        ` : ''}

                        <div>
                            <h3 class="cnspk-sd__section-title">Overview</h3>
                            <p class="cnspk-sd__overview">${safeDesc}</p>
                        </div>

                        ${keyTakeaways && keyTakeaways.length > 0 ? `
                        <div>
                            <h3 class="cnspk-sd__section-title">Key Takeaways</h3>
                            <ul class="cnspk-sd__takeaways">
                                ${keyTakeaways.map(item => `
                                    <li class="cnspk-sd__takeaway">
                                        <span class="cnspk-sd__takeaway-dot" aria-hidden="true"></span>
                                        <span>${sanitize(item)}</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                        ` : ''}
                    </div>

                    <aside>
                        <div class="cnspk-sd__transcript">
                            <div class="cnspk-sd__transcript-head">
                                <h3 class="cnspk-sd__transcript-title">Transcript</h3>
                                <span class="cnspk-sd__transcript-flag">AI Generated</span>
                            </div>
                            <div class="cnspk-sd__transcript-body">
                                ${transcript && transcript.length > 0 ? transcript.map(t => `
                                    <div class="cnspk-sd__cue">
                                        <span class="cnspk-sd__cue-time">${sanitize(t.time)}</span>
                                        <p class="cnspk-sd__cue-text">${sanitize(t.text)}</p>
                                    </div>
                                `).join('') : `
                                    <div class="cnspk-sd__transcript-empty">
                                        <p>Transcript not available for this session.</p>
                                    </div>
                                `}
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        `;
    }
}
