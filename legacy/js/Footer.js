export class Footer {
    init() {
        this.render();
    }

    render() {
        const footerHtml = `
            <footer class="border-t border-white/5 bg-black text-gray-400 py-12 mt-20 relative z-10 glass-panel border-x-0 border-b-0 rounded-none">
                <div class="container mx-auto px-6">
                    <div class="flex flex-col md:flex-row justify-between items-start gap-12">
                        <!-- Brand & Desc -->
                        <div class="text-center md:text-left max-w-sm">
                             <a href="/legacy/" class="inline-flex items-center gap-3 mb-6 group">
                                <div class="w-8 h-8 bg-brand-500/10 rounded flex items-center justify-center border border-brand-500/20 group-hover:border-brand-500 transition-colors">
                                    <span class="text-brand-500 font-mono font-bold">CN</span>
                                </div>
                                <span class="font-bold text-gray-100 group-hover:text-white transition-colors">
                                    Cloud Native Security Pakistan
                                </span>
                            </a>
                            <p class="text-sm font-light leading-relaxed text-gray-400 mb-6">
                                Open source community dedicated to securing the cloud native ecosystem in Pakistan. Join us to learn, share, and grow.
                            </p>
                            <div class="flex gap-4 justify-center md:justify-start">
                                <a href="mailto:hi@cloudnativesecurity.pk" class="text-sm border border-white/10 px-4 py-2 rounded-full hover:bg-white/5 hover:text-white transition-colors">
                                    hi@cloudnativesecurity.pk
                                </a>
                            </div>
                        </div>
                        
                        <!-- Links -->
                        <div class="flex gap-12 text-sm">
                            <div>
                                <h4 class="text-white font-semibold mb-4">Community</h4>
                                <ul class="space-y-2">
                                    <li><a href="/legacy/join/index.html" class="hover:text-brand-500 transition-colors">Join Us</a></li>
                                    <li><a href="/legacy/members/index.html" class="hover:text-brand-500 transition-colors">Members Directory</a></li>
                                    <li><a href="/legacy/events/index.html" class="hover:text-brand-500 transition-colors">Events & Meetups</a></li>
                                </ul>
                            </div>
                            <div>
                                <h4 class="text-white font-semibold mb-4">Connect</h4>
                                <ul class="space-y-2">
                                    <li><a href="https://community.cncf.io/cloud-native-security-pakistan/" target="_blank" class="hover:text-brand-500 transition-colors">CNCF Chapter</a></li>
                                    <li><a href="https://twitter.com/cnscpk" target="_blank" class="hover:text-brand-500 transition-colors">Twitter / X</a></li>
                                    <li><a href="https://linkedin.com/company/cloudnativesecurity-pk" target="_blank" class="hover:text-brand-500 transition-colors">LinkedIn</a></li>
                                    <li><a href="https://www.instagram.com/cnspakistan/" target="_blank" rel="noopener noreferrer" class="hover:text-brand-500 transition-colors">Instagram</a></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-600">
                        <p>&copy; ${new Date().getFullYear()} Cloud Native Security Pakistan.</p>
                        <p class="font-mono">
                            Made with <span class="text-brand-500">♥</span> by 
                            <a href="https://github.com/farhanashrafdev" target="_blank" class="hover:text-brand-500 transition-colors">farhanashrafdev</a>
                        </p>
                    </div>
                </div>
            </footer>
        `;

        const el = document.getElementById('footer');
        if (el) el.innerHTML = footerHtml;
    }
}

