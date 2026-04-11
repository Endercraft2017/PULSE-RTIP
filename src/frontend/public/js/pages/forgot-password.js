/* ============================================================
   Forgot Password Page (Multi-step flow)
   ============================================================
   Reference: reference/html-designs/login/signup/Login Page{10,11,13}
   Table of Contents:
   1. Internal state
   2. Main render (step router)
   3. Step 1: Recover Password (email or phone input)
   4. Step 2: Verify Code (6-digit OTP)
   5. Step 3: Reset Password
   6. Step navigation helpers
   7. Form handlers
   ============================================================ */

const ForgotPasswordPage = {
    /* --------------------------------------------------------
       1. Internal State
       -------------------------------------------------------- */
    _state: {
        step: 1,
        form: {
            identifier: '',
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
       3. Step 1: Recover Password
       -------------------------------------------------------- */
    renderRecoverPassword() {
        return `
            <div class="login-page">
                <div class="login-page__brand">
                    <div class="login-page__logo">
                        <svg viewBox="0 0 24 24">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </div>
                    <div class="login-page__app-name">PULSE 911</div>
                </div>

                <div class="login-page__form-header">
                    <div class="login-page__form-title">Recover Password</div>
                    <div class="login-page__form-subtitle">
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

                <div class="login-page__signup">
                    <a href="#/login">&larr; Back to login</a>
                </div>

                <div class="login-page__footer">
                    &copy; 2025 Pulse &bull; MDRRMO Morong, Rizal
                </div>
            </div>
        `;
    },

    /* --------------------------------------------------------
       4. Step 2: Verify Code
       -------------------------------------------------------- */
    renderVerifyCode() {
        return `
            <div class="login-page">
                <div class="login-page__brand">
                    <div class="login-page__logo">
                        <svg viewBox="0 0 24 24">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </div>
                    <div class="login-page__app-name">PULSE 911</div>
                </div>

                <div class="login-page__form-header">
                    <div class="login-page__form-title">Verify Code</div>
                    <div class="login-page__form-subtitle">
                        Enter the verification code sent to your email or phone number to continue.
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

                <div class="login-page__signup">
                    <a href="#" onclick="event.preventDefault(); ForgotPasswordPage.goToStep(1)">&larr; Back</a>
                </div>

                <div class="login-page__footer">
                    &copy; 2025 Pulse &bull; MDRRMO Morong, Rizal
                </div>
            </div>
        `;
    },

    /* --------------------------------------------------------
       5. Step 3: Reset Password
       -------------------------------------------------------- */
    renderResetPassword() {
        return `
            <div class="login-page">
                <div class="login-page__brand">
                    <div class="login-page__logo">
                        <svg viewBox="0 0 24 24">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </div>
                    <div class="login-page__app-name">PULSE 911</div>
                </div>

                <div class="login-page__form-header">
                    <div class="login-page__form-title">Enter new password</div>
                    <div class="login-page__form-subtitle">
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

                <div class="login-page__footer">
                    &copy; 2025 Pulse &bull; MDRRMO Morong, Rizal
                </div>
            </div>
        `;
    },

    /* --------------------------------------------------------
       6. Step Navigation
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
       7. Form Handlers
       -------------------------------------------------------- */
    handleRecover(event) {
        const identifier = event.target.identifier.value.trim();
        if (!identifier) return;

        this._state.form.identifier = identifier;
        // Mock: in production, POST /api/auth/forgot-password would send the code
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

    handleVerifyCode(event) {
        const inputs = document.querySelectorAll('.otp-input');
        const code = Array.from(inputs).map(i => i.value).join('');

        if (code.length !== 6) {
            alert('Please enter the complete 6-digit code.');
            return;
        }

        this._state.form.code = code;
        // Mock: in production, POST /api/auth/verify-code would validate
        this.goToStep(3);
    },

    handleResendCode() {
        alert('A new code has been sent.');
    },

    handleResetPassword(event) {
        const form = event.target;
        const newPassword = form.newPassword.value;
        const confirmPassword = form.confirmPassword.value;

        if (newPassword !== confirmPassword) {
            alert('Passwords do not match.');
            return;
        }

        if (newPassword.length < 8) {
            alert('Password must be at least 8 characters.');
            return;
        }

        // Mock: in production, POST /api/auth/reset-password would update the password
        alert('Password changed successfully. Please log in with your new password.');
        this.resetState();
        Router.navigate('login');
    }
};
