/* ============================================================
   Login Page
   ============================================================
   Reference: index11.html (Figma export)
   Table of Contents:
   1. Render method
   2. Event handlers
   ============================================================ */

const LoginPage = {
    render() {
        return `
            <div class="login-page">
                <div class="login-page__brand">
                    <div class="login-page__logo">
                        <svg viewBox="0 0 24 24">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </div>
                    <div class="login-page__app-name">PULSE 911</div>
                    <div class="login-page__org">MDRRMO</div>
                    <div class="login-page__org-full">Morong Disaster Risk Reduction and Management Office</div>
                </div>

                <div class="login-page__form-header">
                    <div class="login-page__form-title">Log in</div>
                    <div class="login-page__form-subtitle">Access your Pulse account</div>
                </div>

                <form id="login-form" onsubmit="event.preventDefault(); LoginPage.handleLogin(event)">
                    <div class="input-group">
                        <label class="input-group__label" for="login-email">Email</label>
                        <input class="input-group__field"
                               type="email"
                               id="login-email"
                               name="email"
                               placeholder="your.email@example.com"
                               required
                               autocomplete="email">
                    </div>

                    <div class="input-group">
                        <label class="input-group__label" for="login-password">Password</label>
                        <input class="input-group__field"
                               type="password"
                               id="login-password"
                               name="password"
                               placeholder="&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;"
                               required
                               autocomplete="current-password">
                    </div>

                    <div class="login-page__options">
                        <label class="login-page__remember">
                            <input type="checkbox" name="remember">
                            Remember me
                        </label>
                        <a href="#/forgot-password" class="login-page__forgot">Forgot password?</a>
                    </div>

                    <button type="submit" class="btn btn--primary btn--block">Log in</button>
                </form>

                <div class="login-page__features">
                    <div class="login-page__feature">
                        <svg viewBox="0 0 24 24">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                        </svg>
                        Fast emergency response
                    </div>
                    <div class="login-page__feature">
                        <svg viewBox="0 0 24 24">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        Secure ID verification
                    </div>
                </div>

                <div class="login-page__signup">
                    Don't have an account? <a href="#/signup" onclick="event.preventDefault(); Router.navigate('signup')">Create</a>
                </div>

                <div class="login-page__footer">
                    &copy; 2025 Pulse &bull; MDRRMO Morong, Rizal
                </div>
            </div>
        `;
    },

    async handleLogin(event) {
        event.preventDefault();
        const form = event.target;
        const email = form.email.value;
        const password = form.password.value;

        if (!email || !password) return;

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';

        const result = await Store.login(email, password);

        if (!result.success) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Log in';
            alert(result.message || 'Login failed. Please check your credentials.');
            return;
        }

        const role = Store.get('role');
        if (role === 'admin') {
            Router.navigate('admin-home');
        } else {
            Router.navigate('citizen-home');
        }
    }
};
