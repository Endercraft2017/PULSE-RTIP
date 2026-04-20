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
    Router.register('preferences', () => PreferencesPage.render(), {});
    Router.register('appearance', () => AppearancePage.render(), {});
    Router.register('activities', () => ActivitiesPage.render(), {});

    /* --------------------------------------------------------
       2. Auth + Role Guard
       -------------------------------------------------------- */
    const adminOnlyRoutes = ['admin-home', 'admin-dashboard', 'admin-profile', 'dashboard'];
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
        PreferencesPage.restoreTheme();
        AppearancePage.restoreAppearance();
        const restored = await Store.restoreSession();

        if (restored) {
            const path = Router.getPath();
            const authRoutes = ['login', 'login-offline', 'signup', 'forgot-password'];
            if (authRoutes.includes(path) || !path) {
                const role = Store.get('role');
                Router.navigate('home');
                return;
            }
        }

        Router.init();
    }

    init();
})();
