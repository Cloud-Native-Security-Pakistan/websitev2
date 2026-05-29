/**
 * CNSPK · FilterPanel (v2)
 * ----------------------------------------------------------
 * Electric-register members filter bar: charcoal panel, mono
 * labels, dark inputs with a lime focus ring. City / team /
 * skill filters over the members directory.
 *
 * Data contract (UNCHANGED):
 *   new FilterPanel(onFilterChange)
 *   .render() -> HTML string
 *   .setupEventListeners()
 *
 * DOM contract preserved (the members page depends on these):
 *   - #member-count   live count target
 *   - #filter-city    <select>  (value = city name)
 *   - #filter-team    <select>  (value = team, lowercased)
 *   - #filter-skill   <input type="text">
 *   onFilterChange receives { city, team, skill }.
 *
 * Styles consumed from /css/tokens.css (vars only). Component
 * styling is injected once, scoped under .cnspk-filter-panel.
 * ----------------------------------------------------------
 */

export class FilterPanel {
    constructor(onFilterChange) {
        this.onFilterChange = onFilterChange;
        this.cities = ['Lahore', 'Karachi', 'Islamabad', 'Peshawar', 'Quetta'];
        this.teams = ['Admin', 'Mentor', 'Contributor', 'Member', 'Newbie'];
        this.skills = ['Kubernetes', 'DevSecOps', 'Cloud', 'Network', 'AI'];
    }

    /** Component-scoped styles. Tokens come from tokens.css. Injected once. */
    injectStyles() {
        if (typeof document === 'undefined') return;
        if (document.getElementById('cnspk-filter-panel-styles')) return;

        const style = document.createElement('style');
        style.id = 'cnspk-filter-panel-styles';
        style.textContent = `
            .cnspk-filter-panel {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: space-between;
                gap: 20px;
                background: var(--charcoal);
                border: 1px solid var(--slate);
                border-radius: var(--r-md);
                padding: 20px 24px;
                margin-bottom: 32px;
            }

            .cnspk-filter-panel__count {
                font-family: var(--font-mono);
                font-size: 12px;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: var(--steel);
                flex-shrink: 0;
                display: inline-flex;
                align-items: baseline;
                gap: 8px;
            }
            .cnspk-filter-panel__count strong {
                font-family: var(--font-display);
                font-style: italic;
                font-weight: 800;
                font-size: 22px;
                letter-spacing: -0.02em;
                color: var(--lime);
            }

            .cnspk-filter-panel__controls {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                flex: 1 1 auto;
                justify-content: flex-end;
            }

            .cnspk-filter-panel__field { position: relative; }

            .cnspk-filter-panel__select,
            .cnspk-filter-panel__input {
                background: var(--carbon);
                border: 1px solid var(--slate);
                border-radius: var(--r-sm);
                padding: 11px 16px;
                font-family: var(--font-mono);
                font-size: 13px;
                color: var(--bone);
                transition: border-color var(--dur-hover) var(--ease),
                            box-shadow var(--dur-hover) var(--ease);
            }
            .cnspk-filter-panel__select::placeholder,
            .cnspk-filter-panel__input::placeholder { color: var(--steel); }

            .cnspk-filter-panel__select {
                cursor: pointer;
                min-width: 150px;
                appearance: none;
                -webkit-appearance: none;
                padding-right: 38px;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
                background-repeat: no-repeat;
                background-position: right 14px center;
            }
            .cnspk-filter-panel__select option {
                background: var(--charcoal);
                color: var(--bone);
            }

            .cnspk-filter-panel__input {
                width: 100%;
                min-width: 220px;
                padding-right: 40px;
            }

            .cnspk-filter-panel__select:hover,
            .cnspk-filter-panel__input:hover { border-color: var(--steel); }

            .cnspk-filter-panel__select:focus,
            .cnspk-filter-panel__select:focus-visible,
            .cnspk-filter-panel__input:focus,
            .cnspk-filter-panel__input:focus-visible {
                outline: none;
                border-color: var(--lime);
                box-shadow: 0 0 0 3px rgba(199, 255, 62, 0.2);
            }

            .cnspk-filter-panel__search-icon {
                position: absolute;
                right: 14px;
                top: 50%;
                transform: translateY(-50%);
                color: var(--steel);
                pointer-events: none;
            }
            .cnspk-filter-panel__search-icon svg { width: 15px; height: 15px; }

            @media (max-width: 768px) {
                .cnspk-filter-panel { flex-direction: column; align-items: stretch; }
                .cnspk-filter-panel__controls { justify-content: stretch; }
                .cnspk-filter-panel__field,
                .cnspk-filter-panel__select { flex: 1 1 140px; }
            }

            @media (prefers-reduced-motion: reduce) {
                .cnspk-filter-panel__select,
                .cnspk-filter-panel__input { transition: none; }
            }
        `;
        document.head.appendChild(style);
    }

    render() {
        this.injectStyles();

        const searchIcon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>`;

        return `
            <div class="cnspk-filter-panel">
                <div class="cnspk-filter-panel__count">
                    <strong id="member-count">0</strong>
                    <span>Members Found</span>
                </div>

                <div class="cnspk-filter-panel__controls">
                    <select id="filter-city" class="cnspk-filter-panel__select" aria-label="Filter by city">
                        <option value="">All Cities</option>
                        ${this.cities.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>

                    <select id="filter-team" class="cnspk-filter-panel__select" aria-label="Filter by team">
                        <option value="">All Teams</option>
                        ${this.teams.map(t => `<option value="${t.toLowerCase()}">${t}</option>`).join('')}
                    </select>

                    <div class="cnspk-filter-panel__field">
                        <input type="text" id="filter-skill" class="cnspk-filter-panel__input"
                               placeholder="Search by skill..." aria-label="Search by skill">
                        <span class="cnspk-filter-panel__search-icon">${searchIcon}</span>
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
