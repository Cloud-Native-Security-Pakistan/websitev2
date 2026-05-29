import { sanitize } from './utils.js';

export class MemberCard {
    constructor(member) {
        this.member = member;
    }

    getTeamColor(team) {
        // Simplified neon colors for glass theme
        const colors = {
            'newbie': 'text-green-400 border-green-500/30 bg-green-500/10',
            'member': 'text-blue-400 border-blue-500/30 bg-blue-500/10',
            'contributor': 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
            'admin': 'text-brand-500 border-brand-500/50 bg-brand-500/10'
        };
        return colors[team?.toLowerCase()] || 'text-gray-400 border-gray-500/30 bg-gray-500/10';
    }

    render() {
        const { name, username, location, team, interests, github, linkedin, twitter, role, link } = this.member;

        const safeName = sanitize(name || username);
        const safeRole = sanitize(role || 'Community Member');
        const safeLocation = sanitize(location || 'Pakistan');
        const safeInterests = interests ? sanitize(interests.slice(0, 3).join(' • ')) : '';

        return `
            <article id="member-${sanitize(username)}" class="glass-panel p-6 rounded-xl hover:border-brand-500/40 transition-all duration-300 group hover:-translate-y-1">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex items-center gap-4">
                        <!-- Avatar Placeholder with Initials -->
                        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500/20 to-brand-900/20 border border-brand-500/30 flex items-center justify-center text-brand-500 font-bold font-mono text-lg">
                            ${safeName.substring(0, 2).toUpperCase()}
                        </div>
                        
                        <div>
                            <h3 class="text-white font-bold text-lg leading-tight group-hover:text-brand-500 transition-colors">
                                ${safeName}
                            </h3>
                            <p class="text-gray-500 text-xs font-mono">@${sanitize(username)}</p>
                        </div>
                    </div>

                    ${team ? `
                        <span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${this.getTeamColor(team)}">
                            ${sanitize(team)}
                        </span>
                    ` : ''}
                </div>
                
                <div class="space-y-3 mb-6">
                    <p class="text-gray-300 text-sm font-medium border-l-2 border-brand-500/30 pl-3">
                        ${safeRole}
                    </p>
                    
                    <div class="flex items-center gap-2 text-gray-500 text-xs font-mono">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        ${safeLocation}
                    </div>

                    ${safeInterests ? `
                        <div class="flex flex-wrap gap-1.5">
                            ${interests.slice(0, 3).map(i => `
                                <span class="text-[10px] px-1.5 py-0.5 bg-white/5 rounded text-gray-400 border border-white/5">
                                    ${sanitize(i)}
                                </span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>

                <div class="flex gap-3 pt-4 border-t border-white/5 justify-end">
                    ${link ? `
                        <a href="${sanitize(link)}" target="_blank" class="text-gray-500 hover:text-white transition-colors" title="CNCF Profile">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
                        </a>
                    ` : ''}
                    ${github ? `
                        <a href="${github.startsWith('http') ? sanitize(github) : `https://github.com/${sanitize(github)}`}" target="_blank" class="text-gray-500 hover:text-white transition-colors" title="GitHub Profile">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                        </a>
                    ` : ''}
                    ${linkedin ? `
                        <a href="${sanitize(linkedin)}" target="_blank" class="text-gray-500 hover:text-white transition-colors">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.239-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                        </a>
                    ` : ''}
                </div>
            </article>
        `;
    }
}

