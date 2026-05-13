/* ============================================================
   App - Main application entry point
   ============================================================
   Table of Contents:
   1. Route registration
   2. Auth guard
   3. Session restore and initialization
   ============================================================ */

(function () {
    'use strict';

    /* --------------------------------------------------------
       1. Route Registration
       -------------------------------------------------------- */

    // Auth pages (no header, no nav)
    Router.register('login', () => LoginPage.render(), {
        hideHeader: true,
        hideNav: true
    });
    Router.register('login-offline', () => LoginOfflinePage.render(), {
        hideHeader: true,
        hideNav: true
    });
    Router.register('signup', () => SignupPage.render(), {
        hideHeader: true,
        hideNav: true
    });
    Router.register('forgot-password', () => ForgotPasswordPage.render(), {
        hideHeader: true,
        hideNav: true
    });

    // Citizen pages
    Router.register('citizen-home', () => CitizenHomePage.render(), {});
    Router.register('hazards', () => HazardsPage.render(), {});
    Router.register('my-reports', () => MyReportsPage.render(), {});
    Router.register('emergency', () => EmergencyPage.render(), {});
    Router.register('citizen-profile', () => CitizenProfilePage.render(), {});
    Router.register('notifications', () => NotificationsPage.render(), {});

    // Admin pages
    Router.register('admin-home', () => AdminHomePage.render(), {});
    Router.register('admin-dashboard', () => AdminDashboardPage.render(), {});
    Router.register('admin-profile', () => AdminProfilePage.render(), {});
    Router.register('admin-settings', () => AdminSettingsPage.render(), {});
    Router.register('admin-analytics', () => AdminAnalyticsPage.render(), { auth: true, adminOnly: true });
    Router.register('admin-audit-log', () => AdminAuditLogPage.render(), { auth: true, adminOnly: true });

    // Unified aliases — pick page by role at render time so the URL
    // stays clean (#/home, #/profile, #/dashboard) for both roles.
    Router.register('home', () => {
        return Store.get('role') === 'admin'
            ? AdminHomePage.render()
            : CitizenHomePage.render();
    }, {});
    Router.register('profile', () => {
        return Store.get('role') === 'admin'
            ? AdminProfilePage.render()
            : CitizenProfilePage.render();
    }, {});
    Router.register('dashboard', () => AdminDashboardPage.render(), {});

    // Citizen-only pages
    Router.register('report-incident', () => ReportIncidentPage.render(), {});

    // Shared: News & Updates
    Router.register('news-updates', () => NewsUpdatesPage.render(), {});

    // Profile sub-pages (shared by citizen and admin)
    Router.register('personal-info', () => PersonalInfoPage.render(), {});
    Router.register('edit-profile', () => EditProfilePage.render(), {});
    Router.register('report-progress', () => ReportProgressPage.render(), {});
    Router.register('service-request', () => ServiceRequestPage.render(), {});
    // Preferences page picks admin vs citizen variant at render time so
    // admins don't see citizen-only toggles (auto-location, status-update
    // notifications) that don't apply to their role.
    Router.register('preferences', () => {
        return Store.get('role') === 'admin'
            ? AdminPreferencesPage.render()
            : PreferencesPage.render();
    }, {});
    Router.register('appearance', () => AppearancePage.render(), {});
    Router.register('activities', () => ActivitiesPage.render(), {});

    /* --------------------------------------------------------
       2. Auth + Role Guard
       -------------------------------------------------------- */
    const adminOnlyRoutes = ['admin-home', 'admin-dashboard', 'admin-profile', 'admin-settings', 'admin-analytics', 'admin-audit-log', 'dashboard'];
    const citizenOnlyRoutes = ['citizen-home', 'citizen-profile', 'report-incident', 'emergency'];

    const originalHandleRoute = Router.handleRoute.bind(Router);
    Router.handleRoute = function () {
        const path = this.getPath();
        const publicRoutes = ['login', 'login-offline', 'signup', 'forgot-password'];

        if (!publicRoutes.includes(path) && !Store.get('isAuthenticated')) {
            this.navigate('login');
            return;
        }

        // Role-based access control: citizens can't hit admin-only pages
        // even via direct URL manipulation, and admins don't need to see
        // citizen-specific flows (emergency, report-incident, etc.)
        const role = Store.get('role');
        if (role === 'citizen' && adminOnlyRoutes.includes(path)) {
            this.navigate('home');
            return;
        }
        if (role === 'admin' && citizenOnlyRoutes.includes(path)) {
            this.navigate('home');
            return;
        }

        originalHandleRoute();
    };

    /* --------------------------------------------------------
       3. Session Restore and Initialization
       --------------------------------------------------------
       Attempts to restore a previous session from stored JWT.
       If valid, navigates to the appropriate home page.
       Otherwise, shows the login page.
       -------------------------------------------------------- */
    async function init() {
        try { PreferencesPage.restoreTheme(); } catch (_) {}
        try { AppearancePage.restoreAppearance(); } catch (_) {}

        // Cache the TextBee gateway phone for offline SOS — endpoint is public
        // (no auth) and fire-and-forget so it can't block boot. Without this,
        // a user who opens the app offline first never gets a chance to cache
        // the number and the SOS form fails with "Gateway phone not available".
        try {
            const base = (typeof API_BASE !== 'undefined') ? API_BASE : '';
            fetch(base + '/api/sms/gateway-phone', { cache: 'no-store' })
                .then(r => (r && r.ok) ? r.json() : null)
                .then(j => {
                    if (j && j.success && j.data && j.data.phone) {
                        try { localStorage.setItem('pulse_gateway_phone', j.data.phone); } catch (_) {}
                    }
                })
                .catch(() => { /* offline / network — keep whatever's already cached */ });
        } catch (_) {}

        let restored = false;
        try {
            restored = await Store.restoreSession();
        } catch (_) {
            // restoreSession is now defensive but keep the catch as a
            // belt-and-braces guard — we never want bootstrap to abort.
            restored = false;
        }

        // Push notifications (U-7/A-4): register device token with FCM so
        // hazard + announcement broadcasts reach the user even without SMS.
        // MUST run before the restored-session early-return below — otherwise
        // every reopen with a cached JWT skips push registration and the
        // device's FCM token never reaches the server.
        try { fetch('https://pulse.afkcube.com/api/_beacon/app-bootstrap-reached-push', { method: 'GET', cache: 'no-store' }); } catch (_) {}
        try {
            if (window.PushSetup && typeof PushSetup.init === 'function') {
                try { fetch('https://pulse.afkcube.com/api/_beacon/calling-pushsetup-init', { method: 'GET', cache: 'no-store' }); } catch (_) {}
                PushSetup.init();
            } else {
                try { fetch('https://pulse.afkcube.com/api/_beacon/pushsetup-missing', { method: 'GET', cache: 'no-store' }); } catch (_) {}
            }
        } catch (_) {
            try { fetch('https://pulse.afkcube.com/api/_beacon/pushsetup-init-threw', { method: 'GET', cache: 'no-store' }); } catch (_) {}
        }

        // If a session was restored but the current hash points at an auth
        // route (or is empty — Capacitor cold-starts with no hash), set the
        // hash to /home BEFORE Router.init() so handleRoute() renders the
        // home page on first paint. Previously this branch called
        // navigate('home') and early-returned, skipping Router.init() — which
        // left the hashchange listener unwired and the WebView stuck on a
        // blank screen on the 2nd cold open.
        if (restored) {
            const path = Router.getPath();
            const authRoutes = ['login', 'login-offline', 'signup', 'forgot-password'];
            if (authRoutes.includes(path) || !path) {
                window.location.hash = '#/home';
            }
        }

        Router.init();

        // Passive network watcher — when the device drops offline mid-session,
        // route the user to login-offline (which auto-opens the SOS-via-SMS
        // form). When connection comes back, reload so the boot flow restores
        // their session and they land back on home without typing credentials.
        // Auth pages are exempt — those have their own offline handling and
        // we don't want to re-trigger mid signup/forgot-password flows.
        const _AUTH_ROUTES = ['login', 'login-offline', 'signup', 'forgot-password'];
        window.addEventListener('offline', () => {
            try {
                const path = Router.getPath();
                if (_AUTH_ROUTES.includes(path)) return;
                Router.navigate('login-offline');
            } catch (_) {}
        });
        window.addEventListener('online', () => {
            try {
                if (Router.getPath() !== 'login-offline') return;
                // Don't yank the user out mid-SMS — let them finish first;
                // login-offline._recheck() will pick it up after they close.
                if (document.getElementById('sos-offline-modal')) return;
                window.location.reload();
            } catch (_) {}
        });
        // Boot-time check: if the WebView fired neither event because the
        // device was already offline when init() ran, route there directly.
        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                const path = Router.getPath();
                if (!_AUTH_ROUTES.includes(path)) Router.navigate('login-offline');
            }
        } catch (_) {}

        // Capacitor hardware back-button: pop our in-app nav stack first,
        // and only let the OS close the app once the stack is empty.
        // Dynamic import so plain-browser builds (without @capacitor/app
        // installed) silently no-op.
        try {
            if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function'
                && window.Capacitor.isNativePlatform()) {
                import('@capacitor/app').then(({ App }) => {
                    App.addListener('backButton', () => {
                        const moved = Router.goBack();
                        if (!moved) App.exitApp();
                    });
                }).catch(() => { /* plugin missing — web build, ignore */ });
            }
        } catch (_) { /* no Capacitor — web build, ignore */ }
    }

    /* --------------------------------------------------------
       U-7: Recovery UI
       --------------------------------------------------------
       Capacitor sometimes restores a stale WebView state (cached
       HTML + corrupted localStorage) on a 2nd cold open, which can
       throw inside init() before any UI is painted — leaving the
       user on a blank white screen with no escape but reinstall.

       Wrap init() so any exception swaps the white screen for a
       recovery card with two paths out: reload the app, or wipe
       app data (clears localStorage + sessionStorage + caches).
       -------------------------------------------------------- */
    function showRecoveryUI(err) {
        try { console.error('[init] fatal error', err); } catch (_) {}
        const root = document.getElementById('app-content') || document.body;
        if (!root) return;
        try {
            root.innerHTML = ''
                + '<div class="app-recovery">'
                +   '<div class="app-recovery__card">'
                +     '<div class="app-recovery__title">Something went wrong</div>'
                +     '<div class="app-recovery__msg">PULSE 911 had trouble starting. '
                +     'Try reloading the app. If the problem persists, clear app data.</div>'
                +     '<button class="btn btn--primary btn--block" onclick="window.location.reload()">Tap to reload</button>'
                +     '<button class="btn btn--outline btn--block" style="margin-top:12px" '
                +     'onclick="(function(){try{localStorage.clear();sessionStorage.clear();}catch(e){}'
                +     'if(window.caches&&caches.keys){caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k);});}).finally(function(){window.location.reload();});}'
                +     'else{window.location.reload();}})()">Clear app data &amp; reload</button>'
                +   '</div>'
                + '</div>';
            const header = document.getElementById('app-header');
            const nav = document.getElementById('app-nav');
            if (header) header.style.display = 'none';
            if (nav) nav.style.display = 'none';
        } catch (_) {
            // Even the recovery UI failed — fall back to a plain alert + reload.
            try { window.alert('PULSE 911 failed to start. The app will reload.'); } catch (e) {}
            try { window.location.reload(); } catch (e) {}
        }
    }

    /**
     * Hard-reset for users stuck in a bad state. Exposed on window so the
     * citizen/admin profile pages can wire a "Clear app data" button to it.
     */
    window.PulseAppReset = function () {
        try { localStorage.clear(); } catch (_) {}
        try { sessionStorage.clear(); } catch (_) {}
        const finish = () => { try { window.location.reload(); } catch (e) {} };
        try {
            if (window.caches && caches.keys) {
                caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))).finally(finish);
            } else {
                finish();
            }
        } catch (_) { finish(); }
    };

    // Catch top-level errors that fire after init() resolves but before
    // the user has a chance to interact (rare, but possible during the
    // post-init Capacitor plugin import).
    window.addEventListener('error', function (e) {
        if (!Router.currentRoute && document.getElementById('app-content') &&
            !document.getElementById('app-content').children.length) {
            showRecoveryUI(e && e.error);
        }
    });

    init().catch(showRecoveryUI);
})();
