/**
 * CNSPK · Map (v2)
 * ----------------------------------------------------------
 * Leaflet members map on CartoDB Dark Matter tiles, rethemed
 * to the Electric register: lime member markers with a glow,
 * a charcoal/lime popup, and a lime card-highlight pulse.
 *
 * Public API (UNCHANGED — pages depend on these):
 *   new Map(elementId)
 *   .init()
 *   .updateMarkers(members)        members: [{lat,lng,name,username,...}]
 *   .flyTo(lat, lng, zoom = 10)
 *   .openPopupByUsername(username)
 *
 * Added: .setCityData(cityData) / .getUnresolvedCities()
 *
 * Pin placement is decided by js/lib/map-render.js, not here: exactly one pin per
 * record whose city (or carried coordinates) resolves, no pin for an empty or
 * unresolvable city — that city is recorded instead — and, when approval gating
 * is on, only approved records at all (Requirements 12.2, 12.3, 12.4).
 *
 * Tiles preserved: CartoDB Dark Matter (dark_all).
 * Marker / popup styling is themed where Leaflet allows it.
 * ----------------------------------------------------------
 */

import { domReady, sanitize, sanitizeAttr } from './utils.js';
import { buildCityIndex, buildPins, summarizeUnresolved } from './lib/map-render.js';

export class Map {
    constructor(elementId) {
        this.elementId = elementId;
        this.map = null;
        this.markers = [];
        this.tileLayer = null;
        /** Built city index used to place records that carry a city but no coords. */
        this.cityIndex = null;
        /** Deduped report of cities that got no pin on the last render. */
        this.unresolvedCities = [];
    }

    /**
     * Supply city data (`data/pakistan-cities.json` or `data/city-coords.json`)
     * so records carrying only a city label can still be placed.
     * @param {object|Array} cityData
     */
    setCityData(cityData) {
        this.cityIndex = cityData ? buildCityIndex(cityData) : null;
        return this;
    }

    /** Cities that could not be resolved on the last render, with counts. */
    getUnresolvedCities() {
        return this.unresolvedCities.slice();
    }

    /** Inject Leaflet popup + highlight theming once. Tokens from tokens.css. */
    injectStyles() {
        if (typeof document === 'undefined') return;
        if (document.getElementById('cnspk-map-styles')) return;

        const style = document.createElement('style');
        style.id = 'cnspk-map-styles';
        style.textContent = `
            /* Lime member marker */
            .cnspk-map-marker {
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: var(--lime);
                border: 2px solid var(--carbon);
                box-shadow: 0 0 12px rgba(199, 255, 62, 0.8);
            }

            /* Dark popup surface */
            .cnspk-map .leaflet-popup-content-wrapper {
                background: var(--charcoal);
                color: var(--bone);
                border: 1px solid var(--slate);
                border-radius: var(--r-md);
                box-shadow: var(--shadow-soft);
            }
            .cnspk-map .leaflet-popup-tip {
                background: var(--charcoal);
                border: 1px solid var(--slate);
            }
            .cnspk-map .leaflet-popup-content { margin: 14px 16px; }
            .cnspk-map .leaflet-popup-close-button { color: var(--steel); }
            .cnspk-map .leaflet-popup-close-button:hover { color: var(--lime); }

            .cnspk-map-popup { text-align: center; font-family: var(--font-mono); }
            .cnspk-map-popup__name {
                display: block;
                font-family: var(--font-display);
                font-style: italic;
                font-weight: 800;
                text-transform: uppercase;
                font-size: 15px;
                letter-spacing: -0.01em;
                color: var(--lime);
                margin-bottom: 2px;
            }
            .cnspk-map-popup__handle {
                font-size: 11px;
                color: var(--steel);
                letter-spacing: 0.02em;
            }
            .cnspk-map-popup__link {
                display: inline-block;
                margin-top: 8px;
                font-size: 11px;
                color: var(--lime);
                letter-spacing: 0.04em;
                text-transform: uppercase;
                border-bottom: 1px solid rgba(199, 255, 62, 0.4);
                padding-bottom: 1px;
            }
            .cnspk-map-popup__link:hover { color: var(--lime-glow); border-bottom-color: var(--lime); }

            /* Lime card-highlight applied on "View Card" */
            .cnspk-map-highlight {
                box-shadow: 0 0 0 2px var(--lime), 0 0 24px rgba(199, 255, 62, 0.4) !important;
                border-color: var(--lime) !important;
                transition: box-shadow var(--dur-hover) var(--ease);
            }
        `;
        document.head.appendChild(style);
    }

    init() {
        if (!document.getElementById(this.elementId)) return;

        this.injectStyles();

        // Tag the container so popup theming is scoped to this map.
        const el = document.getElementById(this.elementId);
        el.classList.add('cnspk-map');

        // Pakistan coordinates
        this.map = L.map(this.elementId).setView([30.3753, 69.3451], 5);

        // Dark Matter tiles by CartoDB
        this.tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(this.map);

        // Fix issue where map might not render correctly if container was hidden
        setTimeout(() => {
            this.map.invalidateSize();
        }, 100);
    }

    /**
     * Update markers on the map.
     *
     * Placement is delegated to js/lib/map-render.js: one marker per resolvable
     * record, nothing for an unresolvable city (recorded instead), and only
     * approved records when approval gating is enabled.
     *
     * @param {Array} members
     * @param {{ requireApproval?: boolean, cityData?: object }} [options]
     */
    updateMarkers(members, options = {}) {
        // Clear existing markers
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];

        const cityIndex = options.cityData ? buildCityIndex(options.cityData) : this.cityIndex;
        const { pins, unresolved } = buildPins(members, cityIndex, {
            requireApproval: options.requireApproval === true
        });

        this.unresolvedCities = summarizeUnresolved(unresolved);
        if (this.unresolvedCities.length) {
            console.warn('[map] no pin placed for unresolved cities:',
                this.unresolvedCities.map(u => `${u.city} x${u.count}`).join(', '));
        }

        // Lime member marker
        const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="cnspk-map-marker"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });

        pins.forEach(pin => {
            const member = pin.record;
            const safeName = sanitize(member.name);
            const safeUser = sanitize(member.username);
            // Attribute context inside the popup: the href fragment and the
            // data-view-card hook the click delegate reads. Escaped from the raw
            // handle so it cannot close the attribute and add an event handler;
            // entity escaping is transparent to dataset.viewCard, so card lookup
            // is unchanged (Req 2.4).
            const attrUser = sanitizeAttr(member.username);
            const marker = L.marker([pin.lat, pin.lng], { icon: icon })
                .bindPopup(`
                    <div class="cnspk-map-popup">
                        <strong class="cnspk-map-popup__name">${safeName}</strong>
                        <span class="cnspk-map-popup__handle">@${safeUser}</span><br/>
                        <a href="#member-${attrUser}" data-view-card="${attrUser}" class="cnspk-map-popup__link view-card-link">View Card →</a>
                    </div>
                `)
                .addTo(this.map);

            // Store username for later lookup
            marker._username = member.username;
            this.markers.push(marker);
        });

        // Set up event delegation for View Card links (only once)
        if (!this._viewCardListenerSet) {
            this._viewCardListenerSet = true;
            document.getElementById(this.elementId).addEventListener('click', (e) => {
                const link = e.target.closest('[data-view-card]');
                if (link) {
                    e.preventDefault();
                    const username = link.dataset.viewCard;
                    const memberCard = document.getElementById(`member-${username}`);
                    if (memberCard) {
                        memberCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // Highlight the card briefly with the lime ring
                        memberCard.classList.add('cnspk-map-highlight');
                        setTimeout(() => {
                            memberCard.classList.remove('cnspk-map-highlight');
                        }, 2000);
                    }
                }
            });
        }
    }

    /**
     * Open popup for a specific member by username
     * @param {string} username
     */
    openPopupByUsername(username) {
        const marker = this.markers.find(m => m._username === username);
        if (marker) {
            marker.openPopup();
        }
    }

    /**
     * Fly to a specific location
     * @param {number} lat
     * @param {number} lng
     * @param {number} zoom
     */
    flyTo(lat, lng, zoom = 10) {
        if (this.map) {
            this.map.flyTo([lat, lng], zoom);
        }
    }
}
