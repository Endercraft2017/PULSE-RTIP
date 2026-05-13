/* ============================================================
   Header Component
   ============================================================
   Table of Contents:
   1. Render method
   2. Title mapping
   3. Back-button helper
   ============================================================ */

const Header = {
    // Routes where the header should NOT render a back button —
    // these are "root" landing pages for a given role / auth flow.
    _rootRoutes: [
        'citizen-home', 'admin-home',
        'login', 'signup', 'forgot-password', 'login-offline',
        'home'
    ],

    /**
     * Map route paths to header titles.
     */
    getTitleForRoute(route) {
        const role = Store.get('role');
        const titles = {
            'home': 'MDRRMO Incident Reporter',
            'profile': 'Profile',
            'dashboard': 'MDRRMO Dashboard',
            'citizen-home': 'MDRRMO Incident Reporter',
            'hazards': 'Hazard Zones',
            'my-reports': 'My Reports',
            'emergency': 'Emergency',
            'citizen-profile': 'Profile',
            'notifications': 'MDRRMO Incident Reporter',
            'admin-home': 'MDRRMO Incident Reporter',
            'admin-dashboard': 'MDRRMO Dashboard',
            'admin-profile': 'Profile',
            'report-incident': 'Report Incident',
            'news-updates': 'News & Updates',
            'personal-info': 'Personal Information',
            'edit-profile': 'Edit Profile',
            'report-progress': 'Report Progress',
            'service-request': 'Service Request Progress',
            'preferences': 'Preferences',
            'appearance': 'Appearance',
            'activities': 'Activities'
        };
        return titles[route] || 'PULSE 911';
    },

    render() {
        const route = Router.getPath();
        const title = this.getTitleForRoute(route);
        const count = Store.get('notificationCount') || 0;
        const showBack = !this._rootRoutes.includes(route);

        const backBtn = showBack ? `
            <button type="button" class="header__back" onclick="Router.goBack()" aria-label="Back">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
            </button>
        ` : '';

        document.getElementById('app-header').innerHTML = `
            <div class="header">
                <div class="header__left">
                    ${backBtn}
                    <span class="header__title">${title}</span>
                </div>
                <div class="header__actions">
                    <button class="header__notification-btn" onclick="Router.navigate('notifications')" aria-label="Notifications">
                        <svg viewBox="0 0 24 24">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        </svg>
                        ${count > 0 ? `<span class="header__badge">${count}</span>` : ''}
                    </button>
                </div>
            </div>
        `;
    }
};
