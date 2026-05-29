/**
 * CNSPK · Footer (v2)
 * ----------------------------------------------------------
 * Four-column dark footer with brand block, two route
 * columns (Chapter, Programs), and social Connect column.
 * Bottom bar carries the copyright and a mono command line.
 *
 * Hard rules (per AGENT_BRIEF.md):
 *   - No fabricated sponsor logos, partner names, or testimonials.
 *   - Real social URLs only. Placeholder links carry a TODO.
 *   - All external links open in a new tab with rel="noopener noreferrer".
 *
 * Usage:
 *   <div id="footer"></div>
 *   <script type="module">
 *     import { Footer } from '/js/Footer.js';
 *     new Footer().init();
 *   </script>
 *
 * Styles consumed from /css/tokens.css:
 *   .brand-shield, font/colour vars
 * ----------------------------------------------------------
 */

export class Footer {
    constructor() {
        this.chapter = [
            { name: 'About', href: '/about/' },
            { name: 'Members', href: '/members/' },
            { name: 'Team', href: '/team/' },
            { name: 'Speakers', href: '/speakers/' },
            { name: 'Projects', href: '/projects/' },
            { name: 'Brand', href: '/brand/' }
        ];

        this.programs = [
            { name: 'Events', href: '/events/' },
            { name: 'Sessions', href: '/sessions/' },
            { name: 'Labs', href: '/labs/' },
            { name: 'CFP', href: '/cfp/' },
            { name: 'Dispatch', href: '/dispatch/' },
            { name: 'Wins', href: '/wins/' },
            { name: 'Code of Conduct', href: '/code-of-conduct/' }
        ];

        // Connect column. All links verified live. Discord points at the /join/
        // page (where the "coming soon" doorway lives) until the server launches —
        // never a dead "#" anchor.
        this.connect = [
            // TODO: swap to the real Discord invite when the server launches (JOIN_STRATEGY §5).
            { name: 'Discord', href: '/join/', external: false },
            // Verified against the official CNCF group page (ocgroups.dev/cncf/group/sxcyqt9).
            { name: 'LinkedIn', href: 'https://www.linkedin.com/company/cloud-native-security-pakistan', external: true },
            { name: 'X / Twitter', href: 'https://x.com/CloudSecPK', external: true },
            { name: 'GitHub', href: 'https://github.com/Cloud-Native-Security-Pakistan', external: true },
            { name: 'Instagram', href: 'https://www.instagram.com/cloudnativesecuritypk', external: true }
        ];
    }

    init() {
        this.injectStyles();
        this.render();
    }

    injectStyles() {
        if (document.getElementById('cnspk-footer-styles')) return;

        const style = document.createElement('style');
        style.id = 'cnspk-footer-styles';
        style.textContent = `
            .cnspk-footer {
                background: var(--carbon);
                color: var(--bone-2);
                border-top: 1px solid var(--slate);
                margin-top: 80px;
            }

            .cnspk-footer__inner {
                max-width: 1280px;
                margin: 0 auto;
                padding: 80px 32px 32px;
            }

            .cnspk-footer__grid {
                display: grid;
                grid-template-columns: 1.6fr 1fr 1fr 1fr;
                gap: 48px;
                padding-bottom: 56px;
                border-bottom: 1px solid var(--slate);
            }

            .cnspk-footer__brand {
                display: flex;
                flex-direction: column;
                gap: 16px;
                max-width: 360px;
            }

            .cnspk-footer__wordmark {
                display: inline-flex;
                align-items: center;
                gap: 12px;
                font-family: var(--font-display);
                font-style: italic;
                font-weight: 800;
                font-size: 22px;
                letter-spacing: -0.02em;
                color: var(--bone);
                text-transform: uppercase;
                text-decoration: none;
            }
            .cnspk-footer__wordmark:hover { color: var(--bone); }

            .cnspk-footer__subline {
                font-family: var(--font-mono);
                font-size: 11px;
                color: var(--steel);
                letter-spacing: 0.12em;
                text-transform: uppercase;
            }

            .cnspk-footer__tagline {
                font-size: 14px;
                color: var(--bone-2);
                line-height: 1.6;
                max-width: 340px;
            }

            .cnspk-footer__urdu {
                font-family: var(--font-urdu);
                font-size: 22px;
                color: var(--gold);
                direction: rtl;
                text-align: right;
                line-height: 2.2;
                opacity: 0.7;
                margin-top: 8px;
                max-width: 340px;
            }

            .cnspk-footer__col-title {
                font-family: var(--font-mono);
                font-size: 11px;
                color: var(--lime);
                letter-spacing: 0.12em;
                text-transform: uppercase;
                margin-bottom: 20px;
            }

            .cnspk-footer__list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .cnspk-footer__link {
                font-family: var(--font-body);
                font-size: 14px;
                color: var(--bone-2);
                text-decoration: none;
                transition: color var(--dur-hover) var(--ease);
            }
            .cnspk-footer__link:hover { color: var(--lime); }

            .cnspk-footer__bottom {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                padding-top: 32px;
                flex-wrap: wrap;
            }

            .cnspk-footer__copy {
                font-size: 12px;
                color: var(--steel);
                line-height: 1.6;
            }

            .cnspk-footer__cmd {
                font-family: var(--font-mono);
                font-size: 12px;
                color: var(--lime);
                opacity: 0.85;
                letter-spacing: 0.02em;
            }

            @media (max-width: 880px) {
                .cnspk-footer__grid {
                    grid-template-columns: 1fr 1fr;
                    gap: 40px;
                }
                .cnspk-footer__brand {
                    grid-column: 1 / -1;
                    max-width: none;
                }
            }

            @media (max-width: 540px) {
                .cnspk-footer__inner { padding: 56px 20px 24px; }
                .cnspk-footer__grid {
                    grid-template-columns: 1fr;
                    gap: 32px;
                    padding-bottom: 40px;
                }
                .cnspk-footer__bottom { flex-direction: column; align-items: flex-start; }
            }
        `;
        document.head.appendChild(style);
    }

    /** Build a list-item link. */
    linkHTML(item) {
        if (item.external) {
            return `<li><a class="cnspk-footer__link" href="${item.href}" target="_blank" rel="noopener noreferrer">${item.name}</a></li>`;
        }
        return `<li><a class="cnspk-footer__link" href="${item.href}">${item.name}</a></li>`;
    }

    render() {
        const mount = document.getElementById('footer');
        if (!mount) return;

        const chapterLinks = this.chapter.map(i => this.linkHTML(i)).join('');
        const programLinks = this.programs.map(i => this.linkHTML(i)).join('');
        const connectLinks = this.connect.map(i => this.linkHTML(i)).join('');

        const year = new Date().getFullYear();

        mount.innerHTML = `
            <footer class="cnspk-footer" role="contentinfo">
                <div class="cnspk-footer__inner">
                    <div class="cnspk-footer__grid">
                        <!-- Brand block -->
                        <div class="cnspk-footer__brand">
                            <a href="/" class="cnspk-footer__wordmark" aria-label="CNSPK — home">
                                <span class="brand-shield" aria-hidden="true">CN</span>
                                <span>CNSPK</span>
                            </a>
                            <div class="cnspk-footer__subline">Cloud Native Security Pakistan</div>
                            <p class="cnspk-footer__tagline">
                                A community of cloud-native security practitioners in Pakistan.
                                Independent. Run by engineers.
                            </p>
                            <p class="cnspk-footer__urdu" lang="ur" dir="rtl">کلاؤڈ نیٹو سیکیورٹی پاکستان</p>
                        </div>

                        <!-- Chapter -->
                        <nav aria-label="Chapter">
                            <div class="cnspk-footer__col-title">// chapter</div>
                            <ul class="cnspk-footer__list">${chapterLinks}</ul>
                        </nav>

                        <!-- Programs -->
                        <nav aria-label="Programs">
                            <div class="cnspk-footer__col-title">// programs</div>
                            <ul class="cnspk-footer__list">${programLinks}</ul>
                        </nav>

                        <!-- Connect -->
                        <nav aria-label="Connect">
                            <div class="cnspk-footer__col-title">// connect</div>
                            <ul class="cnspk-footer__list">${connectLinks}</ul>
                        </nav>
                    </div>

                    <div class="cnspk-footer__bottom">
                        <p class="cnspk-footer__copy">
                            &copy; ${year} Cloud Native Security Pakistan
                            &middot; Independent community
                            &middot; CNCF-affiliated
                        </p>
                        <code class="cnspk-footer__cmd" aria-label="signature">
                            $ ./made-with-bharosa --in=Lahore --by=community
                        </code>
                    </div>
                </div>
            </footer>
        `;
    }
}
