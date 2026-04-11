/* ============================================================
   Hazard Zones Page
   ============================================================
   Reference: index2.html / hazard-user/* (Figma exports)
   Displays active hazard zones with severity and details.
   Table of Contents:
   1. State (loaded hazards cache)
   2. Render method
   3. Data loading
   4. Card rendering
   5. Detail modal
   6. Helper methods
   ============================================================ */

const HazardsPage = {
    /* --------------------------------------------------------
       1. State
       -------------------------------------------------------- */
    _hazards: [],

    /* --------------------------------------------------------
       2. Render
       -------------------------------------------------------- */
    render() {
        setTimeout(() => this.loadData(), 0);

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
                    <button class="btn btn--outline btn--sm">List</button>
                </div>

                <div id="hazards-list">
                    <div class="loading-state">Loading hazards...</div>
                </div>

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
                this.renderHazardsList(res.data);
            }
        } catch (err) {
            console.error('Failed to load hazards:', err);
        }
    },

    /* --------------------------------------------------------
       4. Card Rendering
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
       5. Detail Modal
       -------------------------------------------------------- */
    openDetail(hazardId) {
        const hazard = this._hazards.find(h => h.id === hazardId);
        if (!hazard) return;

        const badgeMap = { high: 'high', medium: 'warning', low: 'info' };
        const labelMap = { high: 'High', medium: 'Medium', low: 'Low' };
        const severityClass = badgeMap[hazard.severity] || 'info';
        const severityLabel = labelMap[hazard.severity] || hazard.severity;

        const safetyTips = this.getSafetyTips(hazard.title);

        // Remove any existing modal
        this.closeDetail();

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'hazard-detail-modal';
        modal.onclick = (e) => {
            if (e.target === modal) this.closeDetail();
        };

        modal.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
                <div class="modal__header">
                    <div>
                        <h3 class="modal__title" id="modal-title">${this.escape(hazard.title)}</h3>
                        <span class="badge badge--${severityClass}">${severityLabel}</span>
                    </div>
                    <button class="modal__close" onclick="HazardsPage.closeDetail()" aria-label="Close">
                        <svg viewBox="0 0 24 24">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div class="modal__body">
                    ${hazard.location ? `
                        <div class="modal__section">
                            <div class="modal__section-label">
                                <svg viewBox="0 0 24 24">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                    <circle cx="12" cy="10" r="3"></circle>
                                </svg>
                                Location
                            </div>
                            <div class="modal__section-text">${this.escape(hazard.location)}</div>
                        </div>
                    ` : ''}

                    ${hazard.description ? `
                        <div class="modal__section">
                            <div class="modal__section-label">
                                <svg viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                                Description
                            </div>
                            <div class="modal__section-text">${this.escape(hazard.description)}</div>
                        </div>
                    ` : ''}

                    <div class="modal__section">
                        <div class="modal__section-label">
                            <svg viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            Last Updated
                        </div>
                        <div class="modal__section-text">${this.formatDate(hazard.updated_at)}</div>
                    </div>

                    ${safetyTips.length > 0 ? `
                        <div class="modal__section">
                            <div class="modal__section-label">
                                <svg viewBox="0 0 24 24">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                </svg>
                                Safety Recommendations
                            </div>
                            <ul class="modal__tips">
                                ${safetyTips.map(tip => `<li>${tip}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>

                <div class="modal__footer">
                    <button class="btn btn--outline" onclick="HazardsPage.closeDetail()">Close</button>
                    <button class="btn btn--primary" onclick="Router.navigate('emergency'); HazardsPage.closeDetail()">
                        Emergency Hotlines
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        // Trigger entry animation on next frame
        requestAnimationFrame(() => modal.classList.add('modal-overlay--open'));

        // Close on Escape key
        this._escHandler = (e) => {
            if (e.key === 'Escape') this.closeDetail();
        };
        document.addEventListener('keydown', this._escHandler);
    },

    closeDetail() {
        const modal = document.getElementById('hazard-detail-modal');
        if (modal) {
            modal.classList.remove('modal-overlay--open');
            setTimeout(() => modal.remove(), 200);
        }
        document.body.style.overflow = '';
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
    },

    /* --------------------------------------------------------
       6. Helper Methods
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
