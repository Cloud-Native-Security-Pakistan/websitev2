export class FilterPanel {
    constructor(onFilterChange) {
        this.onFilterChange = onFilterChange;
        this.cities = ['Lahore', 'Karachi', 'Islamabad', 'Peshawar', 'Quetta'];
        this.teams = ['Admin', 'Mentor', 'Contributor', 'Member', 'Newbie'];
        this.skills = ['Kubernetes', 'DevSecOps', 'Cloud', 'Network', 'AI'];
    }

    render() {
        return `
            <div class="glass-panel p-6 rounded-xl mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
                <!-- Count -->
                <div class="text-white font-medium flex-shrink-0">
                    <span id="member-count" class="text-brand-500 font-bold text-xl">0</span> Members Found
                </div>

                <!-- Filters -->
                <div class="flex flex-wrap gap-4 flex-grow justify-end">
                    <!-- City -->
                    <select id="filter-city" class="bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors cursor-pointer appearance-none min-w-[140px]">
                        <option value="">All Cities</option>
                        ${this.cities.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>

                    <!-- Team -->
                    <select id="filter-team" class="bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors cursor-pointer appearance-none min-w-[140px]">
                        <option value="">All Teams</option>
                        ${this.teams.map(t => `<option value="${t.toLowerCase()}">${t}</option>`).join('')}
                    </select>

                    <!-- Skill -->
                    <div class="relative">
                        <input type="text" id="filter-skill" placeholder="Search by skill..." 
                               class="bg-black/30 border border-white/10 rounded-lg pl-4 pr-10 py-2.5 text-sm text-gray-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors w-full md:w-64">
                        <div class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        const filters = {
            city: document.getElementById('filter-city'),
            team: document.getElementById('filter-team'),
            skill: document.getElementById('filter-skill')
        };

        if (!filters.city || !filters.team || !filters.skill) return;

        const handleChange = () => {
            const values = {
                city: filters.city.value,
                team: filters.team.value,
                skill: filters.skill.value
            };
            this.onFilterChange(values);
        };

        filters.city.addEventListener('change', handleChange);
        filters.team.addEventListener('change', handleChange);
        filters.skill.addEventListener('input', handleChange);
    }
}

