/* ============================================================
   Push Notifications Setup (FCM via Capacitor)
   ============================================================
   Table of Contents:
   1. init               - Request permission, register, wire listeners
   2. _registerToken     - POST the token to /api/push-tokens
   3. claimAfterLogin    - Attach the cached token to the user post-login
   4. _watchAuthClaim    - Auto-claim when Store flips to authenticated

   U-7 / A-4: registers the device with FCM BEFORE the user logs in
   (token goes in as "unclaimed"), caches it in localStorage, and re-POSTs
   /api/push-tokens/claim once auth lights up. Silently no-ops when not
   running inside Capacitor (plain browser preview).
   ============================================================ */

(function () {
    'use strict';

    // IIFE-level beacon: confirms push.js loaded and ran at all.
    try { fetch('https://pulse.afkcube.com/api/_beacon/iife-loaded', { method: 'GET', cache: 'no-store' }); } catch (_) {}

    // Evaluate lazily — when push.js's IIFE runs, the Capacitor bridge
    // might not yet have populated window.Capacitor.isNativePlatform.
    // Resolving at call-time avoids a stale '' base that would send fetches
    // to https://localhost (Capacitor's local server) instead of the backend.
    function resolveApiBase() {
        return (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform())
            ? 'https://pulse.afkcube.com'
            : '';
    }
    const TOKEN_CACHE_KEY = 'pulse_device_push_token';

    const PushSetup = {
        _initialized: false,
        _lastToken: null,

        /**
         * Request permission, register with FCM, and wire listeners. Safe to
         * call multiple times — subsequent calls are no-ops.
         */
        async init() {
            const beacon = (s) => { try { fetch(resolveApiBase() + '/api/_beacon/' + s, { method: 'GET', cache: 'no-store' }); } catch (_) {} };
            beacon('init-entered');
            if (this._initialized) { beacon('already-initialized'); return; }
            if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) {
                // Browser / desktop preview — nothing to register.
                beacon('not-native');
                this._watchAuthClaim();
                return;
            }
            beacon('native-confirmed');

            // The frontend is loaded via plain <script> tags (no bundler), so a
            // bare-module ESM import like `import('@capacitor/push-notifications')`
            // will fail at runtime — the webview cannot resolve the specifier.
            // Inside the APK Capacitor exposes the plugin on the global bridge
            // instead: window.Capacitor.Plugins.PushNotifications. Use that
            // directly. This is what made push_tokens stay empty even after
            // hundreds of logins — the dynamic import threw, the catch
            // returned, and we never reached PN.register().
            let PN = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications) || null;
            if (!PN) {
                beacon('plugin-not-on-bridge');
                // Last resort: try the ESM specifier in case a future bundled
                // build supports it. Don't rely on this in production.
                try {
                    PN = (await import('@capacitor/push-notifications')).PushNotifications;
                } catch (e) {
                    beacon('esm-import-failed');
                    console.warn('[push] PushNotifications plugin unavailable on Capacitor.Plugins and ESM import failed:', e && e.message);
                    return;
                }
            }
            if (!PN) {
                beacon('plugin-still-null');
                console.warn('[push] PushNotifications plugin not found on window.Capacitor.Plugins');
                return;
            }
            beacon('plugin-found');

            try {
                // Listeners MUST be attached BEFORE register(). On Android the
                // 'registration' event fires synchronously-fast — if the listener
                // is attached after, it's missed and no token reaches the server.
                PN.addListener('registration', (token) => {
                    beacon('listener-fired');
                    this._lastToken = token.value;
                    try { localStorage.setItem(TOKEN_CACHE_KEY, token.value); } catch (_) {}
                    this._registerToken(token.value);
                });

                PN.addListener('registrationError', (err) => {
                    beacon('registration-error');
                    console.warn('[push] registration error', err && err.error);
                });

                PN.addListener('pushNotificationReceived', (notif) => {
                    console.log('[push] received', notif);
                    // FOREGROUND DELIVERY FIX: when the app is open, FCM does
                    // not draw a system tray notification — it just hands the
                    // payload to this listener. Without explicitly scheduling
                    // a LocalNotification, an admin tap on "Send alert" while
                    // the user is reading the app produces zero feedback.
                    try {
                        const LN = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
                        if (LN && typeof LN.schedule === 'function') {
                            const title = (notif && notif.title) || 'PULSE 911';
                            const body = (notif && notif.body) || (notif && notif.data && notif.data.body) || '';
                            LN.schedule({
                                notifications: [{
                                    id: Math.floor(Math.random() * 2_000_000_000),
                                    title,
                                    body,
                                    channelId: 'pulse-911-alerts',
                                    extra: notif && notif.data,
                                }],
                            }).catch((e) => console.warn('[push] LocalNotification.schedule failed:', e && e.message));
                        }
                    } catch (lnErr) {
                        console.warn('[push] foreground LN dispatch error:', lnErr && lnErr.message);
                    }
                });

                PN.addListener('pushNotificationActionPerformed', (notif) => {
                    console.log('[push] tapped', notif);
                });

                beacon('listeners-attached');
                const perm = await PN.requestPermissions();
                beacon('perm-' + (perm && perm.receive ? perm.receive : 'unknown'));
                if (perm.receive !== 'granted') {
                    console.warn('[push] permission not granted:', perm.receive);
                    return;
                }
                await PN.register();
                beacon('register-called');

                // U-7c: MIUI/OEM autostart prompt. Fires once per device,
                // immediately after permission is granted, while the user
                // already understands they just opted into notifications —
                // a separate "go fix your phone settings" prompt later
                // would feel arbitrary and get dismissed without action.
                if (window.DeviceReadiness && typeof DeviceReadiness.ensureOnce === 'function') {
                    DeviceReadiness.ensureOnce();
                }

                // U-5a: Android 8+ requires a registered channel with HIGH
                // importance for the notification sound to play. The id MUST
                // match the FCM payload's android.notification.channelId
                // (see src/backend/services/push/fcm.js → 'pulse-911-alerts').
                // createChannel is idempotent — safe to call every boot.
                try {
                    if (typeof PN.createChannel === 'function') {
                        await PN.createChannel({
                            id: 'pulse-911-alerts',
                            name: 'PULSE 911 Alerts',
                            description: 'Hazard warnings, announcements, and report updates',
                            importance: 5,      // IMPORTANCE_HIGH
                            sound: 'default',   // device default tone
                            visibility: 1,      // PUBLIC
                            lights: true,
                            vibration: true,
                        });
                    }
                } catch (chErr) {
                    console.warn('[push] createChannel failed:', chErr && chErr.message);
                }

                this._initialized = true;
                this._watchAuthClaim();
            } catch (e) {
                console.warn('[push] init failed:', e.message);
            }
        },

        /**
         * POST the token to /api/push-tokens. If a JWT is in localStorage,
         * include it so the server associates the token with the user.
         * Otherwise it registers as unclaimed (pre-login).
         */
        async _registerToken(token) {
            try {
                const user = (window.Store && Store.get && Store.get('user')) || null;
                const jwt = (window.Store && Store.getToken && Store.getToken()) || localStorage.getItem('pulse_token');
                await fetch(resolveApiBase() + '/api/push-tokens', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(jwt ? { 'Authorization': `Bearer ${jwt}` } : {}),
                    },
                    body: JSON.stringify({
                        token,
                        platform: 'android',
                        barangay: (user && user.barangay) || null,
                    }),
                });
            } catch (e) {
                console.warn('[push] register failed:', e && e.message);
            }
        },

        /**
         * Attach the cached device token to the user after login. Safe to
         * call even when no token has been registered yet (it no-ops).
         */
        async claimAfterLogin() {
            const tok = this._lastToken || (() => {
                try { return localStorage.getItem(TOKEN_CACHE_KEY); } catch (_) { return null; }
            })();
            if (!tok) return;
            try {
                await Store.apiFetch('/api/push-tokens/claim', {
                    method: 'POST',
                    body: JSON.stringify({ token: tok }),
                });
            } catch (_) {
                // non-fatal — next app open will retry
            }
        },

        /**
         * Subscribe to Store so we auto-claim whenever auth flips to true.
         * Since login.js is write-frozen, this is the cleanest hook point.
         */
        _watchAuthClaim() {
            if (!window.Store || !Store.subscribe || this._authWatcher) return;
            this._authWatcher = Store.subscribe((key, value) => {
                if (key === 'isAuthenticated' && value === true) {
                    this.claimAfterLogin();
                }
            });
        },
    };

    window.PushSetup = PushSetup;
})();
