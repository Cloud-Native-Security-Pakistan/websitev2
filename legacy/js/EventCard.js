import { sanitize } from './utils.js';

export class EventCard {
    constructor(event) {
        this.event = event;
    }

    render() {
        const { title, date, time, location, type, description, image, link } = this.event;

        const safeTitle = sanitize(title);
        const safeDesc = sanitize(description);
        const safeLoc = sanitize(location);
        const safeDate = sanitize(date);

        const isPast = new Date(date) < new Date();

        return `
            <article class="glass-panel rounded-xl overflow-hidden group hover:border-brand-500/30 transition-all duration-300 flex flex-col h-full hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.2)]">
                <!-- Image Container -->
                <div class="relative h-56 overflow-hidden">
                    <img src="${sanitize(image)}" 
                         alt="${safeTitle}" 
                         class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${isPast ? 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100' : ''}"
                         loading="lazy"
                         onerror="this.src='https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80'">
                    
                    <div class="absolute inset-0 bg-gradient-to-t from-dark-900 via-transparent to-transparent opacity-80"></div>
                    
                    <!-- Date Badge -->
                    <div class="absolute top-4 right-4 bg-dark-900/80 backdrop-blur border border-white/10 px-3 py-1.5 rounded-lg flex flex-col items-center min-w-[60px]">
                        <span class="text-xs text-brand-500 font-bold uppercase tracking-wider">${new Date(date).toLocaleString('default', { month: 'short' })}</span>
                        <span class="text-xl font-bold text-white font-mono leading-none">${new Date(date).getDate()}</span>
                    </div>

                    <!-- Type Badge -->
                    <div class="absolute top-4 left-4">
                        <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md ${type === 'physical' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/20' : 'bg-purple-500/20 text-purple-300 border border-purple-500/20'}">
                            ${sanitize(type)}
                        </span>
                    </div>
                </div>

                <!-- Content -->
                <div class="p-6 flex flex-col flex-grow relative">
                    <h3 class="text-xl font-bold text-white mb-3 group-hover:text-brand-500 transition-colors leading-tight">
                        ${safeTitle}
                    </h3>

                    <div class="flex items-center gap-2 mb-4 text-gray-400 text-sm">
                        <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        <span class="truncate font-light">${safeLoc}</span>
                         <span class="mx-2 text-gray-700">•</span>
                        <span class="font-mono text-xs">${sanitize(time)}</span>
                    </div>

                    <p class="text-gray-400 text-sm mb-6 line-clamp-3 font-light leading-relaxed flex-grow">
                        ${safeDesc}
                    </p>

                    <div class="mt-auto pt-4 border-t border-white/5">
                        <a href="${sanitize(link)}" 
                           target="_blank" 
                           rel="noopener noreferrer"
                           class="flex items-center justify-between w-full group/btn">
                            <span class="text-sm font-medium ${isPast ? 'text-gray-500 group-hover/btn:text-gray-300' : 'text-brand-500 group-hover/btn:text-brand-400'} transition-colors">
                                ${isPast ? 'View Details' : 'Register Now'}
                            </span>
                            <span class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover/btn:bg-brand-500 group-hover/btn:text-white transition-all transform group-hover/btn:-rotate-45">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                            </span>
                        </a>
                    </div>
                </div>
            </article>
        `;
    }
}

