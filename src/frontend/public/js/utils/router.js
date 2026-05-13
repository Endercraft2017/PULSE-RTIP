/* ============================================================
   Router - Hash-based client-side routing
   ============================================================
   Table of Contents:
   1. Route registration
   2. Navigation (with back-stack)
   3. Hash change handling
   ============================================================ */

const Router = {
    routes: {},
    currentRoute: null,
    // Nav stack tracks visited routes so the header back-button and
    // Android hardware back can pop to the previous page rather than
    // relying on browser history (Capacitor WebView history is flaky).
    _stack: [],

    /**
     * Register a route with its render function.
     */
    register(path, renderFn, options = {}) {
        this.routes[path] = { render: renderFn, options };
    },

    /**
     * Navigate to a route by updating the hash. Pushes the current
     * route onto the back-stack first (unless it'd be a consecutive
     * duplicate, and unless we're entering an auth route — login,
     * signup, forgot-password clear the stack for a fresh session).
     */
    navigate(path) {
        const authRoots = ['login', 'signup', 'forgot-password', 'login-offline'];
        if (authRoots.includes(path)) {
            this._stack = [];
        } else {
            const current = this.currentRoute;
            if (current && current !== path) {
                const top = this._stack[this._stack.length - 1];
                if (top !== current) this._stack.push(current);
            }
        }
        window.location.hash = '#/' + path;
    },

    /**
     * Pop the last route from the stack and navigate to it.
     * Returns true if a back-navigation was performed, false if
     * the stack was empty (caller may then let the OS handle it).
     */
    goBack() {
        if (!this._stack.length) return false;
        const prev = this._stack.pop();
        window.location.hash = '#/' + prev;
        return true;
    },

    /**
     * Get the current route path from the hash.
     */
    getPath() {
        const hash = window.location.hash.slice(2) || '';
        // Strip query string — pages can read params directly from window.location.hash
        const path = hash.split('?')[0];
        return path || 'login';
    },

    /**
     * Handle route changes - renders page content, header, and nav.
     *
     * U-7 hardening: the previous version threw a raw exception if any
     * page's render() crashed, which blanked the whole app on the 2nd
     * cold open whenever cached state was malformed. We now wrap each
     * step so a partial failure falls back to login instead of a white
     * screen.
     */
    handleRoute() {
        const path = this.getPath();
        const route = this.routes[path];

        if (!route) {
            this.navigate('login');
            return;
        }

        // Auth routes clear the stack regardless of how we got there
        // (direct URL, session expiry redirect, etc.).
        const authRoots = ['login', 'signup', 'forgot-password', 'login-offline'];
        if (authRoots.includes(path)) this._stack = [];

        this.currentRoute = path;
        const content = document.getElementById('app-content');
        const header = document.getElementById('app-header');
        const nav = document.getElementById('app-nav');

        if (!content) return; // DOM not ready — give up silently

        // Render page content (defensive: a single page bug shouldn't kill the shell)
        try {
            content.innerHTML = route.render();
            content.className = '';
        } catch (err) {
            try { console.error('[router] render failed for', path, err); } catch (_) {}
            // If we crashed on a non-auth route, bail to login — better than
            // a blank screen. Auth-route render failures fall through to the
            // recovery UI shown in app.js.
            if (!authRoots.includes(path)) {
                this.navigate('login');
                return;
            }
            content.innerHTML = '<div class="app-recovery"><div class="app-recovery__card">'
                + '<div class="app-recovery__title">Failed to load page</div>'
                + '<button class="btn btn--primary btn--block" onclick="window.location.reload()">Reload</button>'
                + '</div></div>';
        }

        // Handle header visibility
        try {
            if (route.options.hideHeader) {
                if (header) { header.innerHTML = ''; header.style.display = 'none'; }
                content.classList.add('no-header');
            } else if (header) {
                header.style.display = '';
                if (typeof Header !== 'undefined' && Header.render) Header.render();
            }
        } catch (_) {}

        // Handle nav visibility
        try {
            if (route.options.hideNav) {
                if (nav) { nav.innerHTML = ''; nav.style.display = 'none'; }
                content.classList.add('no-nav');
            } else if (nav) {
                nav.style.display = '';
                if (typeof Nav !== 'undefined' && Nav.render) Nav.render();
            }
        } catch (_) {}

        // Page enter animation
        try {
            content.classList.add('page-enter');
            requestAnimationFrame(() => {
                content.classList.add('page-enter-active');
                content.classList.remove('page-enter');
            });
        } catch (_) {}

        // Run page-specific init if available
        if (route.options.onMount) {
            try { route.options.onMount(); } catch (e) {
                try { console.error('[router] onMount failed for', path, e); } catch (_) {}
            }
        }
    },

    /**
     * Initialize the router - listen for hash changes.
     */
    init() {
        window.addEventListener('hashchange', () => this.handleRoute());
        this.handleRoute();
    }
};
