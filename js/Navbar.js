/**
 * CNSPK · Navbar (v2)
 * ----------------------------------------------------------
 * Sticky glass nav with the lime hex shield + italic display
 * wordmark on the left, mono uppercase route links and a
 * single canonical CTA on the right.
 *
 * Critical: the "Join" CTA always points at /join/ — the
 * doorway picker. Never link the navbar straight to GitHub,
 * WhatsApp, or the CNCF chapter. See JOIN_STRATEGY.md §2.
 *
 * Usage:
 *   <div id="navbar"></div>
 *   <script type="module">
 *     import { Navbar } from '/js/Navbar.js';
 *     new Navbar().init();
 *   </script>
 *
 * Styles consumed from /css/tokens.css:
 *   .brand-shield, .btn-primary, .glass-panel, font/colour vars
 * ----------------------------------------------------------
 */

export class Navbar {
    constructor() {
        this.navItems = [
            { name: 'About', path: '/about/' },
            { name: 'Events', path: '/events/' },
            { name: 'Sessions', path: '/sessions/' },
            { name: 'Members', path: '/members/' },
            { name: 'Team', path: '/team/' },
            { name: 'Brand', path: '/brand/' }
        ];
        this.cta = { name: 'Join →', path: '/join/' };
    }

    init() {
        this.injectStyles();
        this.render();
        this.bindMobileMenu();
        this.bindScrollState();
    }

    /** Component-scoped styles. Tokens come from tokens.css. */
    injectStyles() {
        if (document.getElementById('cnspk-navbar-styles')) return;

        const style = document.createElement('style');
        style.id = 'cnspk-navbar-styles';
        style.textContent = `
            .cnspk-nav {
                position: sticky;
                top: 0;
                z-index: 50;
                background: rgba(15, 17, 21, 0.85);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border-bottom: 1px solid var(--slate);
                transition: border-color var(--dur-hover) var(--ease),
                            box-shadow var(--dur-hover) var(--ease);
            }
            .cnspk-nav[data-scrolled="true"] {
                border-bottom-color: rgba(199, 255, 62, 0.25);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
            }

            .cnspk-nav__inner {
                max-width: 1280px;
                margin: 0 auto;
                padding: 14px 32px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 24px;
            }

            .cnspk-nav__brand {
                display: inline-flex;
                align-items: center;
                gap: 12px;
                font-family: var(--font-display);
                font-style: italic;
                font-weight: 800;
                font-size: 18px;
                letter-spacing: -0.02em;
                color: var(--bone);
                text-transform: uppercase;
                text-decoration: none;
                transition: color var(--dur-hover) var(--ease);
            }
            .cnspk-nav__brand:hover { color: var(--bone); }
            .cnspk-nav__brand:hover .brand-shield { background: var(--lime-glow); }
            .cnspk-nav__brand .brand-shield { transition: background var(--dur-hover) var(--ease); }

            .cnspk-nav__links {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .cnspk-nav__link {
                color: var(--steel);
                font-family: var(--font-mono);
                font-size: 12px;
                font-weight: 500;
                letter-spacing: 0.06em;
                padding: 8px 14px;
                border-radius: var(--r-sm);
                text-transform: uppercase;
                text-decoration: none;
                transition: color var(--dur-hover) var(--ease),
                            background var(--dur-hover) var(--ease);
            }
            .cnspk-nav__link:hover {
                color: var(--bone);
                background: var(--charcoal);
            }
            .cnspk-nav__link[aria-current="page"] {
                color: var(--lime);
            }
            .cnspk-nav__link[aria-current="page"]:hover {
                color: var(--lime-glow);
                background: var(--charcoal);
            }

            .cnspk-nav__cta {
                margin-left: 12px;
                padding: 10px 18px;
                font-size: 13px;
                box-shadow: 4px 4px 0 0 var(--charcoal), 4px 4px 0 1px var(--lime-600);
            }
            .cnspk-nav__cta:hover,
            .cnspk-nav__cta:focus-visible {
                box-shadow: 6px 6px 0 0 var(--charcoal), 6px 6px 0 1px var(--lime-600);
            }

            /* mobile toggle */
            .cnspk-nav__toggle {
                display: none;
                width: 40px;
                height: 40px;
                align-items: center;
                justify-content: center;
                color: var(--bone);
                background: transparent;
                border: 1px solid var(--slate);
                border-radius: var(--r-sm);
                cursor: pointer;
                transition: border-color var(--dur-hover) var(--ease),
                            color var(--dur-hover) var(--ease);
            }
            .cnspk-nav__toggle:hover { border-color: var(--lime); color: var(--lime); }
            .cnspk-nav__toggle svg { width: 20px; height: 20px; }
            .cnspk-nav__toggle .icon-close { display: none; }
            .cnspk-nav__toggle[aria-expanded="true"] .icon-open { display: none; }
            .cnspk-nav__toggle[aria-expanded="true"] .icon-close { display: block; }

            /* mobile slide-in panel */
            .cnspk-nav__panel {
                display: none;
                position: fixed;
                top: 64px;
                left: 0;
                right: 0;
                background: rgba(15, 17, 21, 0.97);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border-top: 1px solid var(--slate);
                border-bottom: 1px solid var(--slate);
                padding: 24px 32px 32px;
                transform: translateY(-12px);
                opacity: 0;
                pointer-events: none;
                transition: transform var(--dur-elevate) var(--ease),
                            opacity var(--dur-elevate) var(--ease);
                z-index: 49;
            }
            .cnspk-nav__panel[data-open="true"] {
                transform: translateY(0);
                opacity: 1;
                pointer-events: auto;
            }

            .cnspk-nav__panel-list {
                display: flex;
                flex-direction: column;
                gap: 4px;
                margin-bottom: 20px;
            }

            .cnspk-nav__panel-link {
                display: block;
                padding: 14px 16px;
                color: var(--bone-2);
                font-family: var(--font-mono);
                font-size: 13px;
                font-weight: 500;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                text-decoration: none;
                border-radius: var(--r-sm);
                border: 1px solid transparent;
                transition: color var(--dur-hover) var(--ease),
                            border-color var(--dur-hover) var(--ease),
                            background var(--dur-hover) var(--ease);
            }
            .cnspk-nav__panel-link:hover {
                color: var(--bone);
                border-color: var(--slate);
                background: var(--charcoal);
            }
            .cnspk-nav__panel-link[aria-current="page"] {
                color: var(--lime);
                border-color: rgba(199, 255, 62, 0.25);
                background: rgba(199, 255, 62, 0.06);
            }

            .cnspk-nav__panel-cta {
                width: 100%;
                justify-content: center;
            }

            @media (max-width: 768px) {
                .cnspk-nav__inner { padding: 12px 20px; }
                .cnspk-nav__links { display: none; }
                .cnspk-nav__toggle { display: inline-flex; }
                .cnspk-nav__panel { display: block; }
            }

            @media (prefers-reduced-motion: reduce) {
                .cnspk-nav__panel { transition: none; }
            }
        `;
        document.head.appendChild(style);
    }

    /** True when the visitor is currently on a route. */
    isActive(path) {
        const current = window.location.pathname;
        if (path === '/') {
            return current === '/' || current === '/index.html';
        }
        // Normalise trailing slash, then test prefix on segment boundary
        const normalised = path.endsWith('/') ? path : path + '/';
        return current === normalised
            || current === path
            || current.startsWith(normalised);
    }

    /** Build a single link cell. Mode is "desktop" or "mobile". */
    linkHTML(item, mode) {
        const cls = mode === 'mobile' ? 'cnspk-nav__panel-link' : 'cnspk-nav__link';
        const active = this.isActive(item.path) ? ' aria-current="page"' : '';
        return `<a href="${item.path}" class="${cls}"${active}>${item.name}</a>`;
    }

    render() {
        const mount = document.getElementById('navbar');
        if (!mount) return;

        const desktopLinks = this.navItems.map(i => this.linkHTML(i, 'desktop')).join('');
        const mobileLinks = this.navItems.map(i => this.linkHTML(i, 'mobile')).join('');

        mount.innerHTML = `
            <nav class="cnspk-nav" id="cnspk-nav" aria-label="Primary">
                <div class="cnspk-nav__inner">
                    <a href="/" class="cnspk-nav__brand" aria-label="CNSPK — home">
                        <span class="brand-shield" aria-hidden="true">CN</span>
                        <span>CNSPK</span>
                    </a>

                    <div class="cnspk-nav__links" role="menubar">
                        ${desktopLinks}
                        <a href="${this.cta.path}" class="btn-primary cnspk-nav__cta">${this.cta.name}</a>
                    </div>

                    <button
                        class="cnspk-nav__toggle"
                        id="cnspk-nav-toggle"
                        type="button"
                        aria-controls="cnspk-nav-panel"
                        aria-expanded="false"
                        aria-label="Toggle navigation menu"
                    >
                        <svg class="icon-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                        <svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div class="cnspk-nav__panel" id="cnspk-nav-panel" data-open="false">
                    <div class="cnspk-nav__panel-list">
                        ${mobileLinks}
                    </div>
                    <a href="${this.cta.path}" class="btn-primary cnspk-nav__panel-cta">${this.cta.name}</a>
                </div>
            </nav>
        `;
    }

    bindMobileMenu() {
        const toggle = document.getElementById('cnspk-nav-toggle');
        const panel = document.getElementById('cnspk-nav-panel');
        if (!toggle || !panel) return;

        const setOpen = (open) => {
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            panel.setAttribute('data-open', open ? 'true' : 'false');
        };

        toggle.addEventListener('click', () => {
            const open = toggle.getAttribute('aria-expanded') !== 'true';
            setOpen(open);
        });

        // Close when a route link is followed
        panel.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', () => setOpen(false));
        });

        // Close on Esc
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
                setOpen(false);
                toggle.focus();
            }
        });

        // Close when the viewport leaves mobile range
        const mq = window.matchMedia('(min-width: 769px)');
        const onChange = (e) => { if (e.matches) setOpen(false); };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
    }

    bindScrollState() {
        const nav = document.getElementById('cnspk-nav');
        if (!nav) return;
        const update = () => {
            nav.setAttribute('data-scrolled', window.scrollY > 8 ? 'true' : 'false');
        };
        update();
        window.addEventListener('scroll', update, { passive: true });
    }
}
