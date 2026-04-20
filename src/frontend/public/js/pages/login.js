/* ============================================================
   Login Page
   ============================================================
   Reference: reference/html-designs/Login Page/login_page.html
   Layout:
   1. Green gradient header with logo + PULSE 911 / MDRRMO
   2. White body card with form title/subtitle
   3. Email + password + remember/forgot + submit
   4. Features strip (green light bg)
   5. Sign up link + footer
   ============================================================ */

const LoginPage = {
    render() {
        if (LoginPage._isNativeApp()) {
            setTimeout(() => LoginPage._checkServer(), 0);
        }

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

                <div class="auth-screen__body">
                    <div class="auth-screen__form-header">
                        <div class="auth-screen__form-title">Log in</div>
                        <div class="auth-screen__form-subtitle">Access your Pulse account</div>
                    </div>

                    <form id="login-form" onsubmit="event.preventDefault(); LoginPage.handleLogin(event)">
                        <div class="input-group">
                            <label class="input-group__label" for="login-email">Email</label>
                            <div class="input-with-icon">
                                <svg class="input-with-icon__icon" viewBox="0 0 24 24">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                    <polyline points="22,6 12,13 2,6"></polyline>
                                </svg>
                                <input class="input-group__field input-group__field--icon"
                                       type="email" id="login-email" name="email"
                                       placeholder="your.email@example.com" required autocomplete="email">
                            </div>
                        </div>

                        <div class="input-group">
                            <label class="input-group__label" for="login-password">Password</label>
                            <div class="input-with-icon">
                                <svg class="input-with-icon__icon" viewBox="0 0 24 24">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                                <input class="input-group__field input-group__field--icon"
                                       type="password" id="login-password" name="password"
                                       placeholder="••••••••" required autocomplete="current-password">
                                <button type="button" class="input-with-icon__toggle" onclick="LoginPage.togglePassword(this)" aria-label="Show password">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div class="auth-screen__options">
                            <label class="auth-screen__remember">
                                <input type="checkbox" name="remember">
                                <span>Remember me</span>
                            </label>
                            <a href="#/forgot-password" class="auth-screen__forgot">Forgot password?</a>
                        </div>

                        <button type="submit" class="btn btn--primary btn--block auth-screen__submit">
                            <span>Log in</span>
                            <svg viewBox="0 0 24 24">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                        </button>
                    </form>

                    <div class="auth-screen__features">
                        <div class="auth-screen__feature">
                            <svg viewBox="0 0 24 24">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                            </svg>
                            Fast emergency response
                        </div>
                        <div class="auth-screen__feature">
                            <svg viewBox="0 0 24 24">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            Secure ID verification
                        </div>
                    </div>

                    <div class="auth-screen__signup">
                        Don't have an account?
                        <a href="#/signup" onclick="event.preventDefault(); Router.navigate('signup')">Create</a>
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

    togglePassword(btn) {
        const input = btn.parentElement.querySelector('input');
        input.type = input.type === 'password' ? 'text' : 'password';
    },

    async _checkServer() {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);
            const res = await fetch('/api/health', { signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) throw new Error('server not ok');
        } catch (err) {
            Router.navigate('login-offline');
        }
    },

    async handleLogin(event) {
        event.preventDefault();
        const form = event.target;
        const email = form.email.value;
        const password = form.password.value;
        if (!email || !password) return;

        const submitBtn = form.querySelector('button[type="submit"]');
        const label = submitBtn.querySelector('span');
        submitBtn.disabled = true;
        if (label) label.textContent = 'Logging in...';

        try {
            const result = await Store.login(email, password);

            if (!result.success) {
                submitBtn.disabled = false;
                if (label) label.textContent = 'Log in';
                const msg = result.message || 'Incorrect email or password. Check for typos, or tap "Forgot password?" to reset.';
                if (window.Toast) Toast.show(msg, { type: 'error', duration: 6000 });
                else alert(msg);
                return;
            }

            Router.navigate('home');
        } catch (err) {
            // Network error — only fall back to offline screen on native app
            if (LoginPage._isNativeApp()) {
                Router.navigate('login-offline');
            } else {
                submitBtn.disabled = false;
                if (label) label.textContent = 'Log in';
                const msg = 'Can\'t reach the server. Check your internet connection and try again.';
                if (window.Toast) Toast.show(msg, { type: 'error', duration: 6000 });
                else alert(msg);
            }
        }
    }
};
