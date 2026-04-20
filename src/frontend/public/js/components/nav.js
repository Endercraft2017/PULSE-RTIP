/* ============================================================
   Bottom Navigation Component
   ============================================================
   Table of Contents:
   1. SVG icon definitions
   2. Navigation items per role
   3. Render method
   ============================================================ */

const Nav = {
    /**
     * SVG icons for navigation items.
     */
    icons: {
        home: '<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
        dashboard: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
        emergency: '<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>',
        hazards: '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
        reports: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
        profile: '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'
    },

    /**
     * Get navigation items based on user role.
     */
    getItems() {
        const role = Store.get('role');

        if (role === 'admin') {
            return [
                { id: 'home', label: 'Home', icon: 'home' },
                { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
                { id: 'hazards', label: 'Hazards', icon: 'hazards' },
                { id: 'my-reports', label: 'Reports', icon: 'reports' },
                { id: 'profile', label: 'Profile', icon: 'profile' }
            ];
        }

        return [
            { id: 'home', label: 'Home', icon: 'home' },
            { id: 'emergency', label: 'Emergency', icon: 'emergency' },
            { id: 'hazards', label: 'Hazards', icon: 'hazards' },
            { id: 'my-reports', label: 'Reports', icon: 'reports' },
            { id: 'profile', label: 'Profile', icon: 'profile' }
        ];
    },

    render() {
        const items = this.getItems();
        const currentRoute = Router.getPath();

        document.getElementById('app-nav').innerHTML = `
            <div class="bottom-nav">
                ${items.map(item => `
                    <button class="bottom-nav__item ${currentRoute === item.id ? 'active' : ''}"
                            onclick="Router.navigate('${item.id}')"
                            aria-label="${item.label}">
                        ${this.icons[item.icon]}
                        <span>${item.label}</span>
                    </button>
                `).join('')}
            </div>
        `;
    }
};
