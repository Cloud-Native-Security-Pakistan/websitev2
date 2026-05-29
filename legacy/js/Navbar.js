export class Navbar {
    constructor() {
        this.navItems = [
            { name: 'Home', path: '/legacy/' },
            { name: 'Members', path: '/legacy/members/' },
            { name: 'Events', path: '/legacy/events/' },
            { name: 'Sessions', path: '/legacy/sessions/' },
            { name: 'Team', path: '/legacy/team/' },
            { name: 'Projects', path: '/legacy/projects/' },
            { name: 'Hire Experts', path: '/legacy/consultants/' },
            { name: 'Join Us', path: '/legacy/join/', isCta: true }
        ];
    }

    init() {
        this.render();
        this.addScrollListener();
        this.handleMobileMenu();
    }

    render() {
        const currentPath = window.location.pathname;
        const isHome = currentPath === '/legacy/' || currentPath.endsWith('/legacy/index.html');

        const navHtml = `
            <nav class="fixed top-0 left-0 w-full z-50 transition-all duration-300 glass-nav" id="main-nav">
                <div class="container mx-auto px-6 h-20 flex items-center justify-between">
                    <a href="/legacy/" class="flex items-center gap-3 group">
                        <div class="w-10 h-10 bg-brand-500/20 rounded flex items-center justify-center border border-brand-500/30 group-hover:border-brand-500 transition-colors">
                            <span class="text-brand-500 font-mono font-bold text-xl">CN</span>
                        </div>
                        <span class="font-bold text-lg tracking-tight text-gray-100 group-hover:text-white transition-colors">
                            Cloud Native <span class="text-brand-500">Security</span> Pakistan
                        </span>
                    </a>

                    <div class="hidden md:flex items-center gap-8">
                        ${this.navItems.map(item => {
            const isActive = item.path === '/'
                ? isHome
                : currentPath.includes(item.path.replace(/^\//, ''));

            if (item.isCta) {
                return `
                                    <a href="${item.path}" 
                                       class="px-5 py-2.5 bg-white text-black font-semibold rounded hover:bg-gray-200 transition-colors">
                                        ${item.name}
                                    </a>
                                `;
            }

            return `
                                <a href="${item.path}" 
                                   class="text-sm font-medium transition-colors ${isActive ? 'text-brand-500' : 'text-gray-400 hover:text-white'}">
                                    ${item.name}
                                </a>
                            `;
        }).join('')}
                    </div>

                    <button class="md:hidden text-gray-300 hover:text-white" id="mobile-toggle" aria-label="Toggle menu">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"></path>
                        </svg>
                    </button>
                </div>

                <div class="md:hidden hidden absolute top-20 left-0 w-full glass-nav border-t border-white/5 p-6 flex flex-col gap-4" id="mobile-menu">
                     ${this.navItems.map(item => `
                        <a href="${item.path}" 
                           class="block text-lg font-medium py-2 ${item.isCta ? 'text-brand-500' : 'text-gray-300 hover:text-white'}">
                            ${item.name}
                        </a>
                    `).join('')}
                </div>
            </nav>
        `;

        document.getElementById('navbar').innerHTML = navHtml;
    }

    addScrollListener() {
        const nav = document.getElementById('main-nav');
        if (!nav) return;
        window.addEventListener('scroll', () => {
            if (window.scrollY > 20) {
                nav.classList.add('shadow-lg');
            } else {
                nav.classList.remove('shadow-lg');
            }
        });
    }

    handleMobileMenu() {
        const btn = document.getElementById('mobile-toggle');
        const menu = document.getElementById('mobile-menu');

        btn?.addEventListener('click', () => {
            menu.classList.toggle('hidden');
        });
    }
}
