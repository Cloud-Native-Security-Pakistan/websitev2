import { sanitize } from './utils.js';

export class SessionDetail {
    constructor(session) {
        this.session = session;
    }

    render() {
        const { id, title, description, summary, keyTakeaways, transcript, date, duration, type, topic, recordingUrl, thumbnail, speaker } = this.session;

        const safeTitle = sanitize(title);
        const safeDesc = sanitize(description);
        const safeSummary = sanitize(summary);

        const formattedDate = new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const isRecorded = type === 'recorded';
        const embedId = isRecorded && recordingUrl ? recordingUrl.split('/').pop() : null;

        // Mock share URLs
        const shareUrl = window.location.href;
        const linkedInShare = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
        const twitterShare = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out this session on "${safeTitle}" by ${speaker.name} at Cloud Native Security Pakistan!`)}&url=${encodeURIComponent(shareUrl)}`;

        return `
            <div class="animate-fade-in pb-12">
                <!-- Share Header -->
                <div class="flex justify-between items-center mb-6">
                    <a href="/legacy/sessions/" class="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group">
                        <span class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-all">←</span>
                        <span class="text-sm font-medium">Back to Sessions</span>
                    </a>
                    
                    <div class="flex gap-2">
                        <a href="${linkedInShare}" target="_blank" class="w-10 h-10 rounded-full bg-[#0077B5]/20 text-[#0077B5] hover:bg-[#0077B5] hover:text-white flex items-center justify-center transition-all">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        </a>
                        <a href="${twitterShare}" target="_blank" class="w-10 h-10 rounded-full bg-[#1DA1F2]/20 text-[#1DA1F2] hover:bg-[#1DA1F2] hover:text-white flex items-center justify-center transition-all">
                             <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                        </a>
                        <button onclick="navigator.clipboard.writeText(window.location.href).then(() => { const el = this; el.classList.add('text-green-500', 'bg-green-500/20'); setTimeout(() => el.classList.remove('text-green-500', 'bg-green-500/20'), 2000) })" class="w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                        </button>
                    </div>
                </div>

                <!-- Video / Hero Section -->
                <div class="relative aspect-video rounded-2xl overflow-hidden bg-dark-800 border border-white/10 shadow-2xl mb-8 group">
                     ${isRecorded && embedId ? `
                        <iframe class="w-full h-full" src="https://www.youtube.com/embed/${embedId}?autoplay=1&mute=1" title="${safeTitle}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                     ` : `
                        <img src="${sanitize(thumbnail)}" class="w-full h-full object-cover opacity-60" alt="${safeTitle}">
                        <div class="absolute inset-0 flex items-center justify-center">
                            <div class="text-center p-6 bg-dark-900/80 backdrop-blur-md rounded-xl border border-white/10 max-w-md">
                                <span class="block text-brand-500 font-bold mb-2">Upcoming Session</span>
                                <h3 class="text-xl text-white font-bold mb-4">Registration Open</h3>
                                <a href="${sanitize(this.session.registrationUrl)}" target="_blank" class="inline-block px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-lg transition-all">Register Here</a>
                            </div>
                        </div>
                     `}
                </div>

                <!-- Title & Meta -->
                <div class="mb-10">
                    <div class="flex flex-wrap items-center gap-3 mb-4">
                        <span class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-brand-500/20 text-brand-300 border border-brand-500/20">${sanitize(topic)}</span>
                        <span class="text-gray-500 text-sm">•</span>
                        <span class="text-gray-400 text-sm font-mono">${formattedDate}</span>
                        <span class="text-gray-500 text-sm">•</span>
                         <span class="text-gray-400 text-sm font-mono">${sanitize(duration)}</span>
                    </div>
                    <h1 class="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">${safeTitle}</h1>
                    
                    <!-- Speaker -->
                    <div class="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5 w-max pr-8 hover:bg-white/10 transition-colors">
                        <img src="${sanitize(speaker.image)}" class="w-12 h-12 rounded-full border-2 border-brand-500/30 object-cover" 
                             onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(speaker.name)}&background=059669&color=fff'">
                        <div>
                            <p class="text-white font-bold text-lg">${sanitize(speaker.name)}</p>
                            <p class="text-brand-500 text-sm">${sanitize(speaker.role)} @ ${sanitize(speaker.company)}</p>
                        </div>
                    </div>
                </div>

                <!-- Content Tabs -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <!-- Main Content (2 cols) -->
                    <div class="lg:col-span-2 space-y-8">
                        
                        <!-- AI Summary -->
                        ${summary ? `
                        <div class="glass-panel p-6 rounded-xl border-l-4 border-l-brand-500">
                             <div class="flex items-center gap-2 mb-4">
                                <svg class="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                <h3 class="text-lg font-bold text-white">AI Summary</h3>
                             </div>
                             <p class="text-gray-300 leading-relaxed text-sm md:text-base">${safeSummary}</p>
                        </div>
                        ` : ''}

                         <!-- Overview -->
                        <div>
                            <h3 class="text-xl font-bold text-white mb-4">Overview</h3>
                            <p class="text-gray-400 leading-relaxed text-lg">${safeDesc}</p>
                        </div>

                        <!-- Key Takeaways -->
                        ${keyTakeaways && keyTakeaways.length > 0 ? `
                        <div>
                            <h3 class="text-xl font-bold text-white mb-4">Key Takeaways</h3>
                            <ul class="space-y-3">
                                ${keyTakeaways.map(item => `
                                    <li class="flex items-start gap-3 text-gray-300">
                                        <span class="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 shrink-0"></span>
                                        <span>${sanitize(item)}</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                        ` : ''}
                    </div>

                    <!-- Sidebar (1 col) -->
                    <div class="space-y-6">
                        <!-- Transcript -->
                        <div class="glass-panel rounded-xl overflow-hidden flex flex-col h-[500px]">
                            <div class="p-4 border-b border-white/10 bg-black/20 flex justify-between items-center">
                                <h3 class="font-bold text-white">Transcript</h3>
                                <span class="text-xs text-gray-500 uppercase tracking-wider">AI Generated</span>
                            </div>
                            <div class="flex-grow overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                ${transcript && transcript.length > 0 ? transcript.map(t => `
                                    <div class="group cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                                        <span class="text-xs font-mono text-brand-500 mb-1 block opacity-60 group-hover:opacity-100">${sanitize(t.time)}</span>
                                        <p class="text-sm text-gray-400 group-hover:text-gray-200">${sanitize(t.text)}</p>
                                    </div>
                                `).join('') : `
                                    <div class="text-center py-10 text-gray-500">
                                        <p>Transcript not available for this session.</p>
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}
