import { domReady } from './utils.js';

export class Map {
    constructor(elementId) {
        this.elementId = elementId;
        this.map = null;
        this.markers = [];
        this.tileLayer = null;
    }

    init() {
        if (!document.getElementById(this.elementId)) return;

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
     * Update markers on the map
     * @param {Array} members 
     */
    updateMarkers(members) {
        // Clear existing markers
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];

        // Custom Icon
        const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style='background-color: #00ff00; width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 10px #00ff00; border: 2px solid #000;'></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });

        members.forEach(member => {
            if (member.lat && member.lng) {
                const marker = L.marker([member.lat, member.lng], { icon: icon })
                    .bindPopup(`
                        <div class="font-mono text-center">
                            <strong class="text-green-600 block mb-1">${member.name}</strong>
                            <span class="text-xs text-gray-600">@${member.username}</span><br/>
                            <a href="#member-${member.username}" data-view-card="${member.username}" class="text-xs text-blue-500 hover:underline mt-1 inline-block view-card-link">View Card</a>
                        </div>
                    `)
                    .addTo(this.map);

                // Store username for later lookup
                marker._username = member.username;
                this.markers.push(marker);
            }
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
                        // Highlight the card briefly
                        memberCard.classList.add('ring-2', 'ring-green-500');
                        setTimeout(() => {
                            memberCard.classList.remove('ring-2', 'ring-green-500');
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
