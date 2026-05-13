/* ============================================================
   Navigation Component
   ============================================================
   - Bottom bar with 5 quick-access items (inside #app-nav).
   - Hamburger-triggered side drawer (appended to <body>) with the
     full grouped menu mirroring the desktop sidebar shell.
   ============================================================ */

const Nav = {
    icons: {
        home:        '<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
        dashboard:   '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
        emergency:   '<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
        hazards:     '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        reports:     '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
        news:        '<svg viewBox="0 0 24 24"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/></svg>',
        bell:        '<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
        analytics:   '<svg viewBox="0 0 24 24"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
        settings:    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
        shield:      '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        profile:     '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        user:        '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="5"/><path d="M3 21v-1a7 7 0 0 1 14 0v1"/></svg>',
        sun:         '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
        activity:    '<svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
        clock:       '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        clipboard:   '<svg viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>',
        plus:        '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        phone:       '<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    },

    /* Quick-access items shown in the mobile bottom bar (5 max).
       CSS hides this whole bar at >=768px (desktop). */
    getQuickItems() {
        const role = Store.get('role');
        if (role === 'admin') {
            return [
                { route: 'home',       label: 'Home',      icon: 'home' },
                { route: 'dashboard',  label: 'Dashboard', icon: 'dashboard' },
                { route: 'hazards',    label: 'Hazards',   icon: 'hazards' },
                { route: 'my-reports', label: 'Reports',   icon: 'reports' },
                { route: 'profile',    label: 'Profile',   icon: 'profile' },
            ];
        }
        return [
            { route: 'home',       label: 'Home',      icon: 'home' },
            { route: 'emergency',  label: 'Emergency', icon: 'emergency' },
            { route: 'hazards',    label: 'Hazards',   icon: 'hazards' },
            { route: 'my-reports', label: 'Reports',   icon: 'reports' },
            { route: 'profile',    label: 'Profile',   icon: 'profile' },
        ];
    },

    /* Full grouped menu for the hamburger drawer. Mirrors desktop.html. */
    _groupsForRole: {
        admin: [
            { label: 'Main', items: [
                { route: 'home',              label: 'Home',             icon: 'home' },
                { route: 'dashboard',         label: 'MDRRMO Dashboard', icon: 'dashboard' },
                { route: 'hazards',           label: 'Hazards',          icon: 'hazards' },
                { route: 'my-reports',        label: 'Reports',          icon: 'reports' },
                { route: 'news-updates',      label: 'News & Updates',   icon: 'news' },
                { route: 'notifications',     label: 'Notifications',    icon: 'bell' },
            ]},
            { label: 'Admin', items: [
                { route: 'admin-analytics',   label: 'Analytics',        icon: 'analytics' },
                { route: 'admin-settings',    label: 'Settings',         icon: 'settings' },
                { route: 'admin-audit-log',   label: 'Audit Log',        icon: 'shield' },
            ]},
            { label: 'Profile', items: [
                { route: 'profile',           label: 'Profile',          icon: 'profile' },
                { route: 'personal-info',     label: 'Personal Info',    icon: 'user' },
                { route: 'preferences',       label: 'Preferences',      icon: 'settings' },
                { route: 'appearance',        label: 'Appearance',       icon: 'sun' },
            ]},
            { label: 'Activity', items: [
                { route: 'activities',        label: 'Activities',       icon: 'activity' },
                { route: 'report-progress',   label: 'Report Progress',  icon: 'clock' },
                { route: 'service-request',   label: 'Service Request',  icon: 'clipboard' },
            ]},
        ],
        citizen: [
            { label: 'Main', items: [
                { route: 'home',              label: 'Home',             icon: 'home' },
                { route: 'emergency',         label: 'Emergency',        icon: 'phone' },
                { route: 'hazards',           label: 'Hazards',          icon: 'hazards' },
                { route: 'my-reports',        label: 'My Reports',       icon: 'reports' },
                { route: 'news-updates',      label: 'News & Updates',   icon: 'news' },
                { route: 'notifications',     label: 'Notifications',    icon: 'bell' },
            ]},
            { label: 'Report', items: [
                { route: 'report-incident',   label: 'Report Incident',  icon: 'plus' },
            ]},
            { label: 'Profile', items: [
                { route: 'profile',           label: 'Profile',          icon: 'profile' },
                { route: 'personal-info',     label: 'Personal Info',    icon: 'user' },
                { route: 'preferences',       label: 'Preferences',      icon: 'settings' },
                { route: 'appearance',        label: 'Appearance',       icon: 'sun' },
            ]},
        ],
    },

    getGroups() {
        const role = Store.get('role');
        return this._groupsForRole[role] || this._groupsForRole.citizen;
    },

    render() {
        const currentRoute = Router.getPath();
        const items = this.getQuickItems();
        const groups = this.getGroups();

        // 1) Mobile bottom bar inside #app-nav. Hidden on desktop via CSS.
        document.getElementById('app-nav').innerHTML = `
            <div class="bottom-nav">
                ${items.map(item => `
                    <button class="bottom-nav__item ${currentRoute === item.route ? 'active' : ''}"
                            onclick="Router.navigate('${item.route}')"
                            aria-label="${item.label}">
                        ${this.icons[item.icon] || ''}
                        <span>${item.label}</span>
                    </button>
                `).join('')}
            </div>
        `;

        // 2) Side drawer appended to <body> so position:fixed escapes #app-nav.
        const groupsHtml = groups.map(group => `
            <div class="side-drawer__group">
                <div class="side-drawer__label">${group.label}</div>
                ${group.items.map(item => `
                    <button type="button"
                            class="side-drawer__item ${currentRoute === item.route ? 'is-active' : ''}"
                            onclick="Nav.navigate('${item.route}')">
                        ${this.icons[item.icon] || ''}
                        <span>${item.label}</span>
                    </button>
                `).join('')}
            </div>
        `).join('');

        let drawer = document.getElementById('side-drawer');
        if (!drawer) {
            drawer = document.createElement('div');
            drawer.id = 'side-drawer';
            drawer.className = 'side-drawer';
            drawer.setAttribute('aria-hidden', 'true');
            document.body.appendChild(drawer);
        }
        drawer.innerHTML = `
            <div class="side-drawer__backdrop" onclick="Nav.closeDrawer()"></div>
            <aside class="side-drawer__panel" role="navigation" aria-label="Main menu">
                <div class="side-drawer__brand">PULSE 911</div>
                ${groupsHtml}
            </aside>
        `;
    },

    openDrawer() {
        const el = document.getElementById('side-drawer');
        if (el) {
            el.classList.add('is-open');
            el.setAttribute('aria-hidden', 'false');
            document.body.classList.add('drawer-open');
        }
    },

    closeDrawer() {
        const el = document.getElementById('side-drawer');
        if (el) {
            el.classList.remove('is-open');
            el.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('drawer-open');
        }
    },

    navigate(route) {
        this.closeDrawer();
        Router.navigate(route);
    },
};
