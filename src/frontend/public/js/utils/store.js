/* ============================================================
   Store - Client-side state management
   ============================================================
   Table of Contents:
   0. API base URL config
   1. Store class definition
   2. Initial state
   3. Authentication methods (login, logout, register)
   4. API fetch helper
   5. Token management
   ============================================================ */

/* --------------------------------------------------------
 * 0. API Base URL
 * --------------------------------------------------------
 * When running inside Capacitor (mobile app), API calls
 * must target the remote server. On the web, relative
 * paths hit the same origin.
 * -------------------------------------------------------- */
const API_BASE = (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
    ? 'https://pulse.afkcube.com'
    : '';

/* --------------------------------------------------------
 * PH Phone Number Formatter
 * --------------------------------------------------------
 * Canonical format: 09XX-XXX-XXXX (11 digits).
 * Handles +63 / 63 prefixes and normalizes to the local
 * 0-prefixed form. Safe to call on every keystroke.
 * -------------------------------------------------------- */
const PhoneFormat = {
    /**
     * Canonicalizes any plausible input into strict PH mobile digits.
     * Returns '' if the input can't be normalized into a valid 11-digit
     * 09xxxxxxxxx form.
     *
     * Accepts:
     *   - 09xxxxxxxxx          (11 digits, already correct)
     *   - 9xxxxxxxxx           (10 digits — prepend leading 0)
     *   - 639xxxxxxxxx         (12 digits — drop country code)
     *   - +639xxxxxxxxx        (13 chars with + — drop country code)
     *   - Anything with formatting (spaces, dashes, parens) — stripped
     */
    normalize(raw) {
        if (!raw) return '';
        let digits = String(raw).replace(/\D/g, '');

        // International prefix 63 -> local 0
        if (digits.startsWith('63') && digits.length === 12) {
            digits = '0' + digits.slice(2);
        }
        // Missing leading 0 (user typed "9171234567")
        else if (digits.length === 10 && digits.startsWith('9')) {
            digits = '0' + digits;
        }

        return digits;
    },

    /**
     * Validates that a phone number is a plausible Philippine mobile
     * number (starts with 09, exactly 11 digits). Accepts any input
     * format — compares digits only, and accepts 10-digit numbers
     * missing the leading 0 (very common in practice).
     * @param {string} raw
     * @returns {boolean}
     */
    isValid(raw) {
        return /^09\d{9}$/.test(this.normalize(raw));
    },

    /** Normalizes raw input into "09XX-XXX-XXXX". Truncates at 11 digits. */
    format(raw) {
        if (!raw) return '';
        let digits = String(raw).replace(/\D/g, '');

        // +63 / 63 international prefix -> 0 local prefix
        if (digits.startsWith('63') && digits.length >= 11) {
            digits = '0' + digits.slice(2);
        }
        // If the user has typed exactly 10 digits starting with 9, they
        // almost certainly dropped the leading 0 — prepend it.
        else if (digits.length === 10 && digits.startsWith('9')) {
            digits = '0' + digits;
        }

        // Cap at 11 digits (standard PH mobile length)
        digits = digits.slice(0, 11);

        if (digits.length <= 4) return digits;
        if (digits.length <= 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
        return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
    },

    /**
     * Attaches live formatting to an input element. Preserves cursor
     * position by counting digits, not characters.
     * @param {HTMLInputElement} input
     */
    bind(input) {
        if (!input || input._phoneBound) return;
        input._phoneBound = true;

        const reformat = () => {
            const el = input;
            const prev = el.value;
            const cursor = el.selectionStart || 0;
            // Count digits before cursor so we can reposition after formatting
            const digitsBefore = prev.slice(0, cursor).replace(/\D/g, '').length;

            const formatted = PhoneFormat.format(prev);
            if (formatted === prev) return;

            el.value = formatted;

            // Walk formatted string, find the index where we've passed `digitsBefore` digits
            let seen = 0;
            let newCursor = formatted.length;
            for (let i = 0; i < formatted.length; i++) {
                if (/\d/.test(formatted[i])) {
                    seen++;
                    if (seen === digitsBefore) { newCursor = i + 1; break; }
                }
            }
            try { el.setSelectionRange(newCursor, newCursor); } catch (e) {}
        };

        input.addEventListener('input', reformat);
        // Run once on bind so pre-filled values get formatted too
        if (input.value) reformat();
    },

    /**
     * Variant that only activates when the input looks like a phone
     * (starts with a digit or "+"). Used for ambiguous fields like
     * forgot-password's "email or phone" field.
     */
    bindConditional(input) {
        if (!input || input._phoneCondBound) return;
        input._phoneCondBound = true;

        input.addEventListener('input', () => {
            const v = input.value.trim();
            if (!v) return;
            const first = v[0];
            // Only format if it looks like a phone (digit or +)
            if (first === '+' || /\d/.test(first)) {
                const cursor = input.selectionStart || 0;
                const digitsBefore = v.slice(0, cursor).replace(/\D/g, '').length;
                const formatted = PhoneFormat.format(v);
                if (formatted !== v) {
                    input.value = formatted;
                    let seen = 0, newCursor = formatted.length;
                    for (let i = 0; i < formatted.length; i++) {
                        if (/\d/.test(formatted[i])) {
                            seen++;
                            if (seen === digitsBefore) { newCursor = i + 1; break; }
                        }
                    }
                    try { input.setSelectionRange(newCursor, newCursor); } catch (e) {}
                }
            }
        });
    }
};

// Expose globally for pages that check `window.PhoneFormat`. In classic
// (non-module) <script> tags, top-level `const` bindings don't attach
// to window — direct name references work, but `window.X` returns
// undefined. Explicit assignment keeps both paths valid.
window.PhoneFormat = PhoneFormat;

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
        isNativeApp: !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()),
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
            const res = await fetch(API_BASE + '/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!data.success) {
                return { success: false, code: data.code, message: data.message };
            }

            this._setAuthData(data.data);
            return { success: true };
        } catch (err) {
            return { success: false, message: 'Network error. Please try again.' };
        }
    },

    /**
     * Sends a 6-digit SMS OTP to the given phone number.
     * Used during signup for phone verification.
     * @param {string} phone - Phone number in PH format
     * @param {string} [purpose='signup']
     * @returns {Promise<object>} { success, message, devCode? }
     */
    async sendOtp(phone, purpose = 'signup') {
        try {
            const res = await fetch(API_BASE + '/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, purpose }),
            });
            return await res.json();
        } catch (err) {
            return { success: false, message: 'Network error. Please try again.' };
        }
    },

    /**
     * Verifies an OTP code submitted by the user.
     * @param {string} phone
     * @param {string} code - 6-digit code
     * @param {string} [purpose='signup']
     * @returns {Promise<object>} { success, message }
     */
    async verifyOtp(phone, code, purpose = 'signup') {
        try {
            const res = await fetch(API_BASE + '/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, code, purpose }),
            });
            return await res.json();
        } catch (err) {
            return { success: false, message: 'Network error. Please try again.' };
        }
    },

    /**
     * Preflight check for a new phone number — validates format and
     * availability BEFORE an OTP is sent so we don't waste an SMS
     * on an obviously-invalid or already-taken number.
     * @param {string} phone
     * @returns {Promise<object>} { success, available, reason?, message? }
     */
    async checkPhoneAvailable(phone) {
        try {
            return await this.apiFetch('/api/users/me/phone/check', {
                method: 'POST',
                body: JSON.stringify({ phone }),
            });
        } catch (err) {
            return { success: false, message: 'Network error. Please try again.' };
        }
    },

    /**
     * Sends an SMS OTP to a new phone number (for the currently
     * authenticated user who wants to change their phone).
     * @param {string} phone
     * @returns {Promise<object>} { success, maskedPhone, message, devCode? }
     */
    async sendPhoneChangeOtp(phone) {
        try {
            return await this.apiFetch('/api/users/me/phone/send-otp', {
                method: 'POST',
                body: JSON.stringify({ phone }),
            });
        } catch (err) {
            return { success: false, message: 'Network error. Please try again.' };
        }
    },

    /**
     * Verifies the OTP and commits the phone change on the server.
     * @param {string} phone
     * @param {string} code - 6-digit OTP
     * @returns {Promise<object>} { success, data? }
     */
    async updatePhone(phone, code) {
        try {
            return await this.apiFetch('/api/users/me/phone', {
                method: 'PUT',
                body: JSON.stringify({ phone, code }),
            });
        } catch (err) {
            return { success: false, message: 'Network error. Please try again.' };
        }
    },

    /**
     * Changes the password of the currently authenticated user.
     * Requires the current password as proof. Does not log the user out.
     * @param {string} currentPassword
     * @param {string} newPassword
     * @returns {Promise<object>} { success, message }
     */
    async changePassword(currentPassword, newPassword) {
        try {
            const res = await this.apiFetch('/api/users/me/password', {
                method: 'PUT',
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            return res;
        } catch (err) {
            return { success: false, message: 'Network error. Please try again.' };
        }
    },

    /**
     * Initiates password reset — finds the user by email or phone and
     * dispatches an SMS OTP to their registered phone number.
     * @param {string} identifier - Email or phone
     * @returns {Promise<object>} { success, phone, maskedPhone, message, devCode? }
     */
    async forgotPassword(identifier) {
        try {
            const res = await fetch(API_BASE + '/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier }),
            });
            return await res.json();
        } catch (err) {
            return { success: false, message: 'Network error. Please try again.' };
        }
    },

    /**
     * Sets a new password after the user has verified their phone via OTP.
     * @param {string} phone
     * @param {string} newPassword
     * @returns {Promise<object>} { success, message }
     */
    async resetPassword(phone, newPassword) {
        try {
            const res = await fetch(API_BASE + '/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, newPassword }),
            });
            return await res.json();
        } catch (err) {
            return { success: false, message: 'Network error. Please try again.' };
        }
    },

    /**
     * Registers a new user account via the backend API.
     * @param {object} userData - { name, email, password, phone, address, idType, idNumber, idFile? }
     * @returns {Promise<object>} Result with success flag
     *
     * If `userData.idFile` is a File/Blob, we send multipart/form-data so the
     * server can persist the uploaded ID image. Otherwise JSON.
     */
    async register(userData) {
        try {
            const hasFile = userData && userData.idFile &&
                (typeof File !== 'undefined' && userData.idFile instanceof File ||
                 typeof Blob !== 'undefined' && userData.idFile instanceof Blob);

            let fetchOpts;
            if (hasFile) {
                const fd = new FormData();
                Object.keys(userData).forEach(k => {
                    if (k === 'idFile') return;
                    if (userData[k] === undefined || userData[k] === null) return;
                    fd.append(k, userData[k]);
                });
                fd.append('idFile', userData.idFile);
                // No Content-Type header — the browser sets the multipart boundary
                fetchOpts = { method: 'POST', body: fd };
            } else {
                fetchOpts = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData),
                };
            }

            const res = await fetch(API_BASE + '/api/auth/register', fetchOpts);

            // Try to parse the body as JSON; if the server crashed and
            // returned HTML (e.g. uncaught error -> Express default 500),
            // res.json() throws and we'd previously surface that as a
            // generic "Network error". Fall back to text + status so the
            // user sees something actionable.
            let data;
            try {
                data = await res.json();
            } catch (_) {
                let bodyText = '';
                try { bodyText = await res.text(); } catch (__) {}
                const snippet = bodyText && !/^\s*</.test(bodyText)
                    ? ` (${bodyText.slice(0, 120)})`
                    : '';
                return {
                    success: false,
                    message: `Server error ${res.status}${snippet}. Please try again or contact MDRRMO admin.`,
                };
            }

            if (!data.success) {
                return { success: false, message: data.message, errors: data.errors };
            }

            // Every signup now returns `pending: true` — the user cannot
            // log in until an admin approves, so no auth state is stored.
            if (data.pending) {
                return { success: true, pending: true, kind: data.kind, message: data.message };
            }

            // Legacy path kept for backward-compat with older server builds
            // that still auto-login citizen signups.
            if (data.data) {
                this._setAuthData(data.data);
            }
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
     *
     * U-7 fix: previously a 401 inside apiFetch called Store.logout()
     * AND Router.navigate('login') BEFORE Router.init() had wired up
     * the hashchange listener — leaving the app stuck on a blank
     * white screen on the second cold open. We now do a token-only
     * fetch here (no auto-redirect on 401), swallow every failure,
     * and let app.js's init() decide where to send the user.
     * @returns {Promise<boolean>} Whether session was restored
     */
    async restoreSession() {
        let token = null;
        try { token = localStorage.getItem('pulse_token'); } catch (_) { /* storage corrupted */ }
        if (!token) return false;

        try {
            const headers = {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json',
            };
            const res = await fetch(API_BASE + '/api/users/me', { headers });

            // 401 / 403 -> token expired or invalid; clear and bail without
            // touching Router (which may not be ready yet on a cold open).
            if (res.status === 401 || res.status === 403) {
                try { localStorage.removeItem('pulse_token'); } catch (_) {}
                return false;
            }

            // Any other non-2xx -> network/server hiccup. DO NOT clear the
            // token — a transient blip shouldn't log the user out. Just
            // fall through to login this once.
            if (!res.ok) return false;

            const data = await res.json();
            if (data && data.success && data.data) {
                this.set('user', data.data);
                this.set('role', data.data.role);
                this.set('isAuthenticated', true);
                return true;
            }
        } catch (err) {
            // Network unreachable, JSON parse error, etc. Keep the token
            // (it may still be valid once we're back online) and just
            // proceed to login — never let restoreSession throw.
        }

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

        const res = await fetch(API_BASE + url, { ...options, headers });

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
    },

    /* --------------------------------------------------------
     * 6. Media URL Resolver
     * -------------------------------------------------------- */

    /**
     * Resolves a backend-supplied media path (image/video) into a URL the
     * WebView can load. On native (Capacitor) the page origin is
     * https://localhost, so a bare /uploads/... would 404 — we prefix the
     * remote API origin in that case. Bare filenames are routed through the
     * legacy /uploads/ mount.
     */
    mediaUrl(raw) {
        if (!raw) return null;
        const s = String(raw);
        if (s.startsWith('http://') || s.startsWith('https://')) return s;
        const path = s.startsWith('/') ? s : '/uploads/' + s;
        return API_BASE + path;
    }
};

// See note above — expose on window so `window.Store` works too.
window.Store = Store;
