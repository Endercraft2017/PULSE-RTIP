/* ============================================================
   Forgot Password Page (Multi-step flow)
   ============================================================
   Reference: reference/html-designs/login/signup/Login Page{10,11,13}
   Uses the same .auth-screen layout as login/signup for a
   consistent green-banner header and footer.
   Table of Contents:
   1. Internal state
   2. Main render (step router)
   3. Shared header/footer helpers
   4. Step 1: Recover Password (email or phone input)
   5. Step 2: Verify Code (6-digit OTP)
   6. Step 3: Reset Password
   7. Step navigation helpers
   8. Form handlers
   ============================================================ */

const ForgotPasswordPage = {
    /* --------------------------------------------------------
       1. Internal State
       -------------------------------------------------------- */
    _state: {
        step: 1,
        form: {
            identifier: '',     // what the user typed (email or phone)
            phone: '',          // actual phone used for SMS (from backend lookup)
            maskedPhone: '',    // masked form for UI display
            code: '',
            newPassword: '',
            confirmPassword: ''
        }
    },

    /* --------------------------------------------------------
       2. Main Render
       -------------------------------------------------------- */
    render() {
        switch (this._state.step) {
            case 1: return this.renderRecoverPassword();
            case 2: return this.renderVerifyCode();
            case 3: return this.renderResetPassword();
            default:
                this._state.step = 1;
                return this.renderRecoverPassword();
        }
    },

    /* --------------------------------------------------------
       3. Shared header/footer (matches login + signup)
       -------------------------------------------------------- */
    _authHeader() {
        return `
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
        `;
    },

    _authFooter() {
        return `
            <div class="auth-screen__footer">
                <span>&copy; 2025 Pulse &bull; MDRRMO Morong, Rizal</span>
            </div>
        `;
    },

    /* --------------------------------------------------------
       SMS gateway hint — surfaces the gateway phone number so
       offline users know where to text from. Reads cached value
       from localStorage and fetches if missing.
       -------------------------------------------------------- */
    _renderSmsHint() {
        const cached = localStorage.getItem('pulse_gateway_phone') || '';
        const display = cached ? this._escape(cached) : 'Loading...';
        const href = cached ? `tel:${cached}` : '#';
        // Trigger a fetch if we don't have the number cached yet
        if (!cached && window.Store && typeof Store.apiFetch === 'function') {
            setTimeout(() => {
                Store.apiFetch('/api/sms/gateway-phone').then(res => {
                    if (res && res.success && res.data && res.data.phone) {
                        localStorage.setItem('pulse_gateway_phone', res.data.phone);
                        const span = document.getElementById('auth-sms-phone-fp');
                        if (span) {
                            span.textContent = res.data.phone;
                            const link = span.closest('a');
                            if (link) link.setAttribute('href', `tel:${res.data.phone}`);
                        }
                    }
                }).catch(() => { /* offline / non-critical */ });
            }, 0);
        }
        return `
            <div class="login-page__info-box mt-md" style="display:flex;align-items:flex-start;gap:8px;">
                <svg viewBox="0 0 24 24" aria-hidden="true"
                     style="width:18px;height:18px;flex-shrink:0;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;margin-top:2px;">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                <div>
                    <strong>Need help signing up offline?</strong>
                    Text our SMS gateway at
                    <a href="${href}"><strong><span id="auth-sms-phone-fp">${display}</span></strong></a>.
                    We'll guide you through it.
                </div>
            </div>
        `;
    },

    /* --------------------------------------------------------
       4. Step 1: Recover Password
       -------------------------------------------------------- */
    renderRecoverPassword() {
        // Bind conditional phone formatter once the DOM is ready
        setTimeout(() => {
            const el = document.getElementById('recover-id');
            if (el && window.PhoneFormat) PhoneFormat.bindConditional(el);
        }, 0);
        return `
            <div class="auth-screen">
                ${this._authHeader()}

                <div class="auth-screen__body">
                    <div class="auth-screen__form-header">
                        <div class="auth-screen__form-title">Recover Password</div>
                        <div class="auth-screen__form-subtitle">
                            Enter your email or phone number to receive a verification code for password recovery.
                        </div>
                    </div>

                    <form onsubmit="event.preventDefault(); ForgotPasswordPage.handleRecover(event)">
                        <div class="input-group">
                            <label class="input-group__label" for="recover-id">Email or Phone number</label>
                            <input class="input-group__field" type="text" id="recover-id" name="identifier"
                                   placeholder="Email or phone number"
                                   value="${this._state.form.identifier}" required>
                        </div>

                        <button type="submit" class="btn btn--primary btn--block">Send Code</button>
                    </form>

                    ${this._renderSmsHint()}

                    <div class="auth-screen__signup">
                        <a href="#/login" onclick="event.preventDefault(); Router.navigate('login')">&larr; Back to login</a>
                    </div>
                </div>

                ${this._authFooter()}
            </div>
        `;
    },

    /* --------------------------------------------------------
       5. Step 2: Verify Code
       -------------------------------------------------------- */
    renderVerifyCode() {
        const masked = this._state.form.maskedPhone || this._state.form.phone || 'your phone';
        return `
            <div class="auth-screen">
                ${this._authHeader()}

                <div class="auth-screen__body">
                    <div class="auth-screen__form-header">
                        <div class="auth-screen__form-title">Verify Code</div>
                        <div class="auth-screen__form-subtitle">
                            We sent a 6-digit verification code via SMS to
                            <strong>${this._escape(masked)}</strong>.
                            Enter it below to continue.
                        </div>
                    </div>

                    <form onsubmit="event.preventDefault(); ForgotPasswordPage.handleVerifyCode(event)">
                        <div class="otp-input-group" id="otp-group">
                            ${Array.from({ length: 6 }).map((_, i) => `
                                <input type="text" inputmode="numeric" pattern="[0-9]*"
                                       class="otp-input" maxlength="1" data-index="${i}"
                                       oninput="ForgotPasswordPage.handleOtpInput(event, ${i})"
                                       onkeydown="ForgotPasswordPage.handleOtpKeydown(event, ${i})">
                            `).join('')}
                        </div>

                        <button type="submit" class="btn btn--primary btn--block mt-lg">Verify</button>
                        <button type="button" class="btn btn--outline btn--block mt-md"
                                onclick="ForgotPasswordPage.handleResendCode()">Resend Code</button>
                    </form>

                    <div class="auth-screen__signup">
                        <a href="#" onclick="event.preventDefault(); ForgotPasswordPage.goToStep(1)">&larr; Back</a>
                    </div>
                </div>

                ${this._authFooter()}
            </div>
        `;
    },

    /* --------------------------------------------------------
       6. Step 3: Reset Password
       -------------------------------------------------------- */
    renderResetPassword() {
        return `
            <div class="auth-screen">
                ${this._authHeader()}

                <div class="auth-screen__body">
                    <div class="auth-screen__form-header">
                        <div class="auth-screen__form-title">Enter new password</div>
                        <div class="auth-screen__form-subtitle">
                            Enter and confirm your new password to complete the reset process.
                        </div>
                    </div>

                    <form onsubmit="event.preventDefault(); ForgotPasswordPage.handleResetPassword(event)">
                        <div class="input-group">
                            <label class="input-group__label" for="new-password">New password</label>
                            <input class="input-group__field" type="password" id="new-password" name="newPassword"
                                   placeholder="&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;"
                                   minlength="8" required>
                            <div class="input-group__hint">* Must be at least 8 characters</div>
                        </div>

                        <div class="input-group">
                            <label class="input-group__label" for="confirm-new-password">Confirm new password</label>
                            <input class="input-group__field" type="password" id="confirm-new-password" name="confirmPassword"
                                   placeholder="&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;"
                                   minlength="8" required>
                        </div>

                        <button type="submit" class="btn btn--primary btn--block">Change Password</button>
                    </form>
                </div>

                ${this._authFooter()}
            </div>
        `;
    },

    /* --------------------------------------------------------
       7. Step Navigation
       -------------------------------------------------------- */
    goToStep(step) {
        this._state.step = step;
        document.getElementById('app-content').innerHTML = this.render();
    },

    resetState() {
        this._state = {
            step: 1,
            form: { identifier: '', code: '', newPassword: '', confirmPassword: '' }
        };
    },

    /* --------------------------------------------------------
       8. Form Handlers
       -------------------------------------------------------- */
    async handleRecover(event) {
        const form = event.target;
        const identifier = form.identifier.value.trim();
        if (!identifier) return;

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending code...'; }

        const result = await Store.forgotPassword(identifier);

        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send Code'; }

        if (!result.success) {
            this._toast(result.message || 'Couldn\'t send the verification code. Please try again.');
            return;
        }

        this._state.form.identifier = identifier;
        this._state.form.phone = result.phone || '';
        this._state.form.maskedPhone = result.maskedPhone || '';

        if (result.devCode) {
            console.warn('[forgot-password] dev OTP code:', result.devCode);
        }

        this.goToStep(2);
    },

    handleOtpInput(event, index) {
        const input = event.target;
        const value = input.value.replace(/[^0-9]/g, '');
        input.value = value;

        if (value && index < 5) {
            const next = document.querySelector(`.otp-input[data-index="${index + 1}"]`);
            if (next) next.focus();
        }
    },

    handleOtpKeydown(event, index) {
        if (event.key === 'Backspace' && !event.target.value && index > 0) {
            const prev = document.querySelector(`.otp-input[data-index="${index - 1}"]`);
            if (prev) prev.focus();
        }
    },

    async handleVerifyCode(event) {
        const inputs = document.querySelectorAll('.otp-input');
        const code = Array.from(inputs).map(i => i.value).join('');

        if (code.length !== 6) {
            this._toast('Please enter the full 6-digit code from the SMS.', 'info');
            return;
        }

        const submitBtn = event.target.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Verifying...'; }

        const result = await Store.verifyOtp(this._state.form.phone, code, 'reset');

        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Verify'; }

        if (!result.success) {
            this._toast(result.message || 'That code didn\'t match. Please try again.');
            inputs.forEach(i => { i.value = ''; });
            inputs[0] && inputs[0].focus();
            return;
        }

        this._state.form.code = code;
        this.goToStep(3);
    },

    async handleResendCode() {
        // Re-send by calling forgot-password again with the same identifier
        const result = await Store.forgotPassword(this._state.form.identifier);
        if (!result.success) {
            this._toast(result.message || 'Couldn\'t resend the code. Please try again.');
            return;
        }
        if (result.devCode) console.warn('[forgot-password] dev OTP code:', result.devCode);
        this._toast('A fresh 6-digit code has been sent via SMS.', 'success');
    },

    /** Shared toast helper with alert fallback if Toast isn't loaded */
    _toast(msg, type = 'error') {
        if (window.Toast) Toast.show(msg, { type, duration: 5000 });
        else alert(msg);
    },

    async handleResetPassword(event) {
        const form = event.target;
        const newPassword = form.newPassword.value;
        const confirmPassword = form.confirmPassword.value;

        if (newPassword !== confirmPassword) {
            this._toast('The two passwords you entered don\'t match. Please retype them.');
            return;
        }

        if (newPassword.length < 8) {
            this._toast('Your new password is too short — it needs to be at least 8 characters.');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Updating...'; }

        const result = await Store.resetPassword(this._state.form.phone, newPassword);

        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Change Password'; }

        if (!result.success) {
            this._toast(result.message || 'Couldn\'t reset your password. Please try again.');
            return;
        }

        alert('Password changed successfully. Please log in with your new password.');
        this.resetState();
        Router.navigate('login');
    },

    /** HTML-escape for safe interpolation into the verify-code subtitle */
    _escape(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
};
