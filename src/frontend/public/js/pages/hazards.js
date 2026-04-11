/* ============================================================
   Hazard Zones Page
   ============================================================
   Reference: index2.html (Figma export)
   Displays active hazard zones with severity and details.
   Table of Contents:
   1. Render method
   2. Data loading
   3. Helper methods
   ============================================================ */

const HazardsPage = {
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

    async loadData() {
        try {
            const res = await Store.apiFetch('/api/hazards');
            if (res.success) {
                this.renderHazardsList(res.data);
            }
        } catch (err) {
            console.error('Failed to load hazards:', err);
        }
    },

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
                    <span class="incident-card__title">${h.title}</span>
                    <span class="badge badge--${badgeMap[h.severity] || 'info'}">${labelMap[h.severity] || h.severity}</span>
                </div>
                <div class="incident-card__location">${h.location || ''}</div>
                <div class="incident-card__description">${h.description || ''}</div>
                <div class="incident-card__footer">
                    <span>Updated ${this.formatDate(h.updated_at)}</span>
                    <span class="incident-card__details-link">
                        Details
                        <svg viewBox="0 0 24 24">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </span>
                </div>
            </div>
        `).join('');
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
    }
};
