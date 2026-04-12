/* ============================================================
   Hazard Zones Page
   ============================================================
   Reference: hazard-user/Hazard User1 (list view),
              hazard-user/Hazard User3 (map view)
   Displays active hazard zones with severity and details.
   Table of Contents:
   1. State (loaded hazards cache, view mode)
   2. Render method
   3. Data loading
   4. List view rendering
   5. Map view rendering
   6. View toggle
   7. Detail modal
   8. Helper methods
   ============================================================ */

const HazardsPage = {
    /* --------------------------------------------------------
       1. State
       -------------------------------------------------------- */
    _hazards: [],
    _view: 'list', // 'list' | 'map'

    // Approximate (x%, y%) positions of known Morong barangays on
    // morong-map.png (a static satellite crop of the municipality).
    // Values are eyeballed from the reference image and good enough
    // to place pins near the right area without a real geocoder.
    _barangayMap: {
        'morong':        { x: 32, y: 45 },
        'lagundi':       { x: 48, y: 38 },
        'san pedro':     { x: 28, y: 58 },
        'san guillermo': { x: 42, y: 30 },
        'san jose':      { x: 58, y: 42 },
        'san juan':      { x: 52, y: 52 },
        'cailero':       { x: 55, y: 28 },
        'calero':        { x: 55, y: 28 },
        'caingin':       { x: 22, y: 38 },
        'bombongan':     { x: 38, y: 48 },
        'maybancal':     { x: 62, y: 35 },
    },

    /* --------------------------------------------------------
       2. Render
       -------------------------------------------------------- */
    render() {
        setTimeout(() => this.loadData(), 0);

        const toggleLabel = this._view === 'map' ? 'Map' : 'List';
        const viewContent = this._view === 'map'
            ? `<div id="hazards-map-view"><div class="loading-state">Loading map...</div></div>`
            : `<div id="hazards-list"><div class="loading-state">Loading hazards...</div></div>`;

        return `
            <div class="page-padding">
                <div class="section-header">
                    <div class="section-header__title">
                        <svg viewBox="0 0 24 24">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        Active Hazard Zones
                    </div>
                    <button class="btn btn--outline btn--sm hazards-toggle" onclick="HazardsPage.toggleView()">${toggleLabel}</button>
                </div>

                ${viewContent}

                <div class="safety-info">
                    <div class="safety-info__header">
                        <svg viewBox="0 0 24 24">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                        Safety Information
                    </div>
                    <div class="safety-info__text">
                        Stay informed about active hazards in your area. Follow official safety instructions and be prepared to evacuate if necessary. Everyone can post incident updates and view all shared posts to stay aware and support one another.
                    </div>
                    <button class="btn btn--primary btn--block" onclick="Router.navigate('news-updates')">
                        View Community Post
                    </button>
                </div>
            </div>
        `;
    },

    /* --------------------------------------------------------
       3. Data Loading
       -------------------------------------------------------- */
    async loadData() {
        try {
            const res = await Store.apiFetch('/api/hazards');
            if (res.success) {
                this._hazards = res.data;
                this.renderCurrentView();
            }
        } catch (err) {
            console.error('Failed to load hazards:', err);
        }
    },

    renderCurrentView() {
        if (this._view === 'map') {
            this.renderHazardsMap(this._hazards);
        } else {
            this.renderHazardsList(this._hazards);
        }
    },

    /* --------------------------------------------------------
       4. List View Rendering
       -------------------------------------------------------- */
    renderHazardsList(hazards) {
        const container = document.getElementById('hazards-list');
        if (!container) return;

        if (hazards.length === 0) {
            container.innerHTML = '<div class="empty-state">No active hazard zones.</div>';
            return;
        }

        const badgeMap = { high: 'high', medium: 'warning', low: 'info' };
        const labelMap = { high: 'High', medium: 'Medium', low: 'Low' };

        container.innerHTML = hazards.map(h => `
            <div class="incident-card">
                <div class="incident-card__header">
                    <span class="incident-card__title">${this.escape(h.title)}</span>
                    <span class="badge badge--${badgeMap[h.severity] || 'info'}">${labelMap[h.severity] || h.severity}</span>
                </div>
                <div class="incident-card__location">${this.escape(h.location || '')}</div>
                <div class="incident-card__description">${this.escape(h.description || '')}</div>
                <div class="incident-card__footer">
                    <span>Updated ${this.formatDate(h.updated_at)}</span>
                    <a href="#" class="incident-card__details-link"
                       onclick="event.preventDefault(); HazardsPage.openDetail(${h.id})">
                        Details
                        <svg viewBox="0 0 24 24">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </a>
                </div>
            </div>
        `).join('');
    },

    /* --------------------------------------------------------
       5. Map View Rendering
       -------------------------------------------------------- */
    renderHazardsMap(hazards) {
        const container = document.getElementById('hazards-map-view');
        if (!container) return;

        const severityClass = {
            high: 'hazard-map__marker--high',
            medium: 'hazard-map__marker--medium',
            low: 'hazard-map__marker--low'
        };

        // Build markers for hazards whose location matches a known barangay
        const markers = hazards.map(h => {
            const pos = this.lookupPosition(h.location);
            if (!pos) return null;
            const cls = severityClass[h.severity] || 'hazard-map__marker--medium';
            return `
                <button type="button"
                        class="hazard-map__marker ${cls}"
                        style="left: ${pos.x}%; top: ${pos.y}%;"
                        title="${this.escape(h.title)} — ${this.escape(h.location)}"
                        onclick="HazardsPage.openDetail(${h.id})">
                    <span class="hazard-map__marker-dot"></span>
                </button>
            `;
        }).filter(Boolean).join('');

        // Hazards that couldn't be placed on the map fall back to a chip list
        const unplaced = hazards.filter(h => !this.lookupPosition(h.location));

        container.innerHTML = `
            <div class="hazard-map">
                <div class="hazard-map__image">
                    <img src="public/assets/images/morong-map.png" alt="Morong, Rizal satellite map">
                    ${markers}
                </div>
                <div class="hazard-map__legend">
                    <span class="hazard-map__legend-item"><span class="hazard-map__dot hazard-map__dot--high"></span>High</span>
                    <span class="hazard-map__legend-item"><span class="hazard-map__dot hazard-map__dot--medium"></span>Medium</span>
                    <span class="hazard-map__legend-item"><span class="hazard-map__dot hazard-map__dot--low"></span>Low</span>
                    <span class="hazard-map__count">${hazards.length} active</span>
                </div>
                ${unplaced.length > 0 ? `
                    <div class="hazard-map__unplaced">
                        <div class="hazard-map__unplaced-label">Other active hazards</div>
                        ${unplaced.map(h => `
                            <button type="button" class="hazard-map__chip" onclick="HazardsPage.openDetail(${h.id})">
                                ${this.escape(h.title)} — ${this.escape(h.location || 'Location unknown')}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    lookupPosition(location) {
        if (!location) return null;
        const key = String(location).toLowerCase();
        // Match the first barangay name that appears in the location string
        for (const name in this._barangayMap) {
            if (key.includes(name)) return this._barangayMap[name];
        }
        return null;
    },

    /* --------------------------------------------------------
       6. View Toggle
       -------------------------------------------------------- */
    toggleView() {
        this._view = this._view === 'map' ? 'list' : 'map';
        // Re-render the entire page content to swap toggle label + view container
        const app = document.getElementById('app-content');
        if (app) {
            app.innerHTML = this.render();
            // render() schedules loadData which calls renderCurrentView;
            // but we already have cached hazards — render immediately too
            // so the switch feels instant even before the API resolves.
            setTimeout(() => this.renderCurrentView(), 0);
        }
    },

    /* --------------------------------------------------------
       7. Detail Modal
       -------------------------------------------------------- */
    openDetail(hazardId) {
        const hazard = this._hazards.find(h => h.id === hazardId);
        if (!hazard) return;
        DetailModal.showHazard(hazard);
    },

    /* --------------------------------------------------------
       8. Helper Methods
       -------------------------------------------------------- */
    getSafetyTips(hazardTitle) {
        const title = (hazardTitle || '').toLowerCase();
        if (title.includes('flood')) {
            return [
                'Move to higher ground immediately if water rises.',
                'Avoid walking or driving through flood waters.',
                'Disconnect electrical appliances if safe to do so.',
                'Listen to local radio or official MDRRMO announcements.'
            ];
        }
        if (title.includes('fire')) {
            return [
                'Evacuate the area immediately if instructed.',
                'Stay low to avoid smoke inhalation.',
                'Do not use elevators during a fire emergency.',
                'Call BFP Morong or emergency hotlines if you spot the fire.'
            ];
        }
        if (title.includes('landslide')) {
            return [
                'Move away from steep slopes immediately.',
                'Watch for cracks in ground or tilting trees.',
                'Listen for unusual sounds like rumbling.',
                'Have an evacuation plan ready.'
            ];
        }
        if (title.includes('typhoon') || title.includes('storm')) {
            return [
                'Stay indoors and away from windows.',
                'Prepare emergency supplies (water, food, flashlight).',
                'Charge mobile devices and have backup power ready.',
                'Follow PAGASA advisories and MDRRMO instructions.'
            ];
        }
        if (title.includes('earthquake')) {
            return [
                'Drop, Cover, and Hold On during shaking.',
                'Stay away from windows and heavy furniture.',
                'After shaking, check for injuries and damage.',
                'Be prepared for aftershocks.'
            ];
        }
        return [
            'Follow official MDRRMO instructions and advisories.',
            'Keep emergency contacts handy.',
            'Stay informed through trusted local sources.',
            'Have an emergency kit ready.'
        ];
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    },

    escape(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
};
