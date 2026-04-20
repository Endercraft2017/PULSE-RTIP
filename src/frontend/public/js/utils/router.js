/* ============================================================
   Router - Hash-based client-side routing
   ============================================================
   Table of Contents:
   1. Route registration
   2. Navigation
   3. Hash change handling
   ============================================================ */

const Router = {
    routes: {},
    currentRoute: null,

    /**
     * Register a route with its render function.
     * @param {string} path - Route path (e.g., 'login', 'hazards')
     * @param {Function} renderFn - Function that returns HTML string
     * @param {Object} options - Route options (hideHeader, hideNav)
     */
    register(path, renderFn, options = {}) {
        this.routes[path] = { render: renderFn, options };
    },

    /**
     * Navigate to a route by updating the hash.
     */
    navigate(path) {
        window.location.hash = '#/' + path;
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
     */
    handleRoute() {
        const path = this.getPath();
        const route = this.routes[path];

        if (!route) {
            this.navigate('login');
            return;
        }

        this.currentRoute = path;
        const content = document.getElementById('app-content');
        const header = document.getElementById('app-header');
        const nav = document.getElementById('app-nav');

        // Render page content
        content.innerHTML = route.render();
        content.className = '';

        // Handle header visibility
        if (route.options.hideHeader) {
            header.innerHTML = '';
            header.style.display = 'none';
            content.classList.add('no-header');
        } else {
            header.style.display = '';
            Header.render();
        }

        // Handle nav visibility
        if (route.options.hideNav) {
            nav.innerHTML = '';
            nav.style.display = 'none';
            content.classList.add('no-nav');
        } else {
            nav.style.display = '';
            Nav.render();
        }

        // Page enter animation
        content.classList.add('page-enter');
        requestAnimationFrame(() => {
            content.classList.add('page-enter-active');
            content.classList.remove('page-enter');
        });

        // Run page-specific init if available
        if (route.options.onMount) {
            route.options.onMount();
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
