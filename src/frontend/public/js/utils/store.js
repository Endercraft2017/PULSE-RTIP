/* ============================================================
   Store - Client-side state management
   ============================================================
   Table of Contents:
   1. Store class definition
   2. Initial state
   3. Authentication methods (login, logout, register)
   4. API fetch helper
   5. Token management
   ============================================================ */

/**
 * Simple reactive store for managing application state.
 * Provides get/set with subscriber notification and API integration.
 */
const Store = {
    _state: {
        user: null,
        role: null, // 'citizen' or 'admin'
        isAuthenticated: false,
        isElectron: !!(window.electronAPI && window.electronAPI.isElectron),
        notifications: [],
        notificationCount: 0
    },

    _subscribers: [],

    get(key) {
        return key ? this._state[key] : { ...this._state };
    },

    set(key, value) {
        this._state[key] = value;
        this._notify(key, value);
    },

    _notify(key, value) {
        this._subscribers.forEach(fn => fn(key, value));
    },

    subscribe(fn) {
        this._subscribers.push(fn);
        return () => {
            this._subscribers = this._subscribers.filter(s => s !== fn);
        };
    },

    /* --------------------------------------------------------
     * 3. Authentication Methods
     * -------------------------------------------------------- */

    /**
     * Authenticates user via the backend API.
     * Stores JWT token and user data on success.
     * @param {string} email
     * @param {string} password
     * @returns {Promise<object>} Result with success flag
     */
    async login(email, password) {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!data.success) {
                return { success: false, message: data.message };
            }

            this._setAuthData(data.data);
            return { success: true };
        } catch (err) {
            return { success: false, message: 'Network error. Please try again.' };
        }
    },

    /**
     * Registers a new user account via the backend API.
     * @param {object} userData - { name, email, password, phone, address }
     * @returns {Promise<object>} Result with success flag
     */
    async register(userData) {
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData),
            });

            const data = await res.json();

            if (!data.success) {
                return { success: false, message: data.message, errors: data.errors };
            }

            this._setAuthData(data.data);
            return { success: true };
        } catch (err) {
            return { success: false, message: 'Network error. Please try again.' };
        }
    },

    /**
     * Sets authentication state from API response.
     * @param {object} authData - { token, user, notificationCount }
     */
    _setAuthData(authData) {
        localStorage.setItem('pulse_token', authData.token);
        this.set('user', authData.user);
        this.set('role', authData.user.role);
        this.set('isAuthenticated', true);
        this.set('notificationCount', authData.notificationCount || 0);
    },

    /**
     * Logs out the user, clears token and state.
     */
    logout() {
        localStorage.removeItem('pulse_token');
        this.set('user', null);
        this.set('role', null);
        this.set('isAuthenticated', false);
        this.set('notificationCount', 0);
    },

    /**
     * Restores session from stored JWT token on page load.
     * @returns {Promise<boolean>} Whether session was restored
     */
    async restoreSession() {
        const token = localStorage.getItem('pulse_token');
        if (!token) return false;

        try {
            const res = await this.apiFetch('/api/users/me');
            if (res.success) {
                this.set('user', res.data);
                this.set('role', res.data.role);
                this.set('isAuthenticated', true);
                return true;
            }
        } catch (err) {
            // Token expired or invalid
        }

        localStorage.removeItem('pulse_token');
        return false;
    },

    /* --------------------------------------------------------
     * 4. API Fetch Helper
     * -------------------------------------------------------- */

    /**
     * Fetch wrapper that automatically includes the JWT Authorization header.
     * @param {string} url - API endpoint URL
     * @param {object} [options={}] - Fetch options
     * @returns {Promise<object>} Parsed JSON response
     */
    async apiFetch(url, options = {}) {
        const token = localStorage.getItem('pulse_token');
        const headers = {
            ...(options.headers || {}),
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        }

        const res = await fetch(url, { ...options, headers });

        if (res.status === 401) {
            this.logout();
            Router.navigate('login');
            throw new Error('Session expired');
        }

        return res.json();
    },

    /* --------------------------------------------------------
     * 5. Token Management
     * -------------------------------------------------------- */

    /**
     * Returns the stored JWT token.
     * @returns {string|null}
     */
    getToken() {
        return localStorage.getItem('pulse_token');
    }
};
