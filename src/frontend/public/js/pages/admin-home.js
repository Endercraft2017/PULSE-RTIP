/* ============================================================
   Admin Home Page
   ============================================================
   Reference: index5.html (Figma export)
   Admin welcome page with active hazard alerts and statistics.
   Table of Contents:
   1. Render method
   2. Data loading
   3. Helper methods
   ============================================================ */

const AdminHomePage = {
    render() {
        const user = Store.get('user');
        const userName = user ? user.name : 'MDRRMO Admin';

        setTimeout(() => this.loadData(), 0);

        return `
            <div class="page-padding">
                <div class="welcome-card">
                    <div class="welcome-card__title">Welcome, ${userName}!</div>
                    <div class="welcome-card__text">
                        Manage and respond to incident reports from the community.
                    </div>
                </div>

                ${this.renderAppDownload()}

                <div class="section-header">
                    <div class="section-header__title">
                        <svg viewBox="0 0 24 24">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        Active Hazard Alerts
                    </div>
                    <a href="#/hazards" class="text-sm" style="color: var(--color-primary); font-weight: 600;">View all</a>
                </div>

                <div id="hazard-alerts-list">
                    <div class="loading-state">Loading alerts...</div>
                </div>

                <div class="stats-grid mt-lg">
                    <div class="stat-card">
                        <div class="stat-card__icon stat-card__icon--pending">
                            <svg viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                        </div>
                        <div class="stat-card__number" id="stat-pending">--</div>
                        <div class="stat-card__label">Pending</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card__icon stat-card__icon--resolved">
                            <svg viewBox="0 0 24 24">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                        <div class="stat-card__number" id="stat-resolved">--</div>
                        <div class="stat-card__label">Resolved</div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Small "Get the mobile app" banner. Hidden inside the Capacitor APK.
     */
    renderAppDownload() {
        if (Store.get('isNativeApp')) return '';
        return `
            <a class="app-download-card" href="/downloads/" target="_blank" rel="noopener">
                <div class="app-download-card__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                        <line x1="12" y1="18" x2="12.01" y2="18"></line>
                    </svg>
                </div>
                <div class="app-download-card__content">
                    <div class="app-download-card__title">Get the Pulse 911 app</div>
                    <div class="app-download-card__desc">Faster access + offline SOS reporting</div>
                </div>
                <div class="app-download-card__cta">
                    Install
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>
            </a>
        `;
    },

    async loadData() {
        try {
            const [hazardsRes, statsRes] = await Promise.all([
                Store.apiFetch('/api/hazards'),
                Store.apiFetch('/api/dashboard/stats'),
            ]);

            if (hazardsRes.success) {
                CitizenHomePage.renderHazards(hazardsRes.data);
            }

            if (statsRes.success) {
                const pendingEl = document.getElementById('stat-pending');
                const resolvedEl = document.getElementById('stat-resolved');
                if (pendingEl) pendingEl.textContent = statsRes.data.pendingCount;
                if (resolvedEl) resolvedEl.textContent = statsRes.data.resolvedCount;
            }
        } catch (err) {
            console.error('Failed to load admin home data:', err);
        }
    }
};
