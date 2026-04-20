/* ============================================================
   Login Offline Fallback
   ============================================================
   Reference: reference/html-designs/failure-fallback login page
   Shown when the server is unreachable. User can continue into
   a limited offline mode (SOS + offline features only).
   ============================================================ */

const LoginOfflinePage = {
    render() {
        // Only the native APK should ever land here; redirect web users back to login.
        if (!LoginOfflinePage._isNativeApp()) {
            setTimeout(() => Router.navigate('login'), 0);
            return '';
        }
        setTimeout(() => LoginOfflinePage._recheck(), 0);

        return `
            <div class="auth-screen">
                <div class="auth-screen__header">
                    <div class="auth-screen__brand">
                        <div class="auth-screen__brand-icon">
                            <img src="public/assets/icons/logo-login.png" alt="PULSE 911">
                        </div>
                        <div class="auth-screen__brand-text">
                            <div class="auth-screen__brand-name">PULSE 911</div>
                            <div class="auth-screen__brand-org">MDRRMO</div>
                        </div>
                    </div>
                    <div class="auth-screen__header-sub">Morong Disaster Risk Reduction and Management Office</div>
                </div>

                <div class="auth-screen__body auth-screen__body--center">
                    <div class="offline-card">
                        <div class="offline-card__icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24">
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                                <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
                                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
                                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                                <line x1="12" y1="20" x2="12.01" y2="20"></line>
                            </svg>
                        </div>
                        <div class="offline-card__title">Uh oh! No internet connection</div>
                        <div class="offline-card__subtitle">You can still use the App in offline mode</div>
                        <button type="button" class="offline-card__cta" onclick="LoginOfflinePage.continueOffline()">
                            Continue to Offline Mode
                        </button>
                        <button type="button" class="offline-card__retry" onclick="LoginOfflinePage.retry()">
                            Retry connection
                        </button>
                    </div>
                </div>

                <div class="auth-screen__footer">
                    <span>&copy; 2025 Pulse &bull; MDRRMO Morong, Rizal</span>
                </div>
            </div>
        `;
    },

    _isNativeApp() {
        return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    },

    async _recheck() {
        // Quietly try again every 10s; if server comes back, return to login
        if (this._timer) return;
        this._timer = setInterval(async () => {
            if (Router.currentRoute !== 'login-offline') {
                clearInterval(this._timer);
                this._timer = null;
                return;
            }
            try {
                const c = new AbortController();
                const t = setTimeout(() => c.abort(), 3000);
                const r = await fetch('/api/health', { signal: c.signal });
                clearTimeout(t);
                if (r.ok) {
                    clearInterval(this._timer);
                    this._timer = null;
                    Router.navigate('login');
                }
            } catch (_) { /* still offline */ }
        }, 10000);
    },

    async retry() {
        const btn = event.target;
        btn.disabled = true;
        btn.textContent = 'Checking...';
        try {
            const c = new AbortController();
            const t = setTimeout(() => c.abort(), 4000);
            const r = await fetch('/api/health', { signal: c.signal });
            clearTimeout(t);
            if (r.ok) { Router.navigate('login'); return; }
        } catch (_) {}
        btn.disabled = false;
        btn.textContent = 'Retry connection';
        alert('Still offline. You can continue in offline mode.');
    },

    continueOffline() {
        if (typeof SosOffline !== 'undefined' && SosOffline.open) {
            SosOffline.open();
        } else {
            alert('Offline mode: emergency SMS is the only available feature when disconnected.');
        }
    }
};
