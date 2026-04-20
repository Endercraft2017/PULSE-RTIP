/* ============================================================
   Signup Page (Multi-step flow)
   ============================================================
   Reference: reference/html-designs/login/signup/Login Page{1,4,6,8,9}
   Table of Contents:
   1. Internal state
   2. Main render (step router)
   3. Step 1: Create Account (name, email, phone, passwords, terms)
   4. Step 2: Select Role (citizen | admin)
   5. Step 3: ID Verification (citizen flow / admin flow)
   6. Step 4: Verification Success
   7. Step navigation helpers
   8. Form handlers
   ============================================================ */

const SignupPage = {
    /* --------------------------------------------------------
       1. Internal State
       -------------------------------------------------------- */
    _state: {
        step: 1,
        form: {
            name: '',
            email: '',
            phone: '',
            password: '',
            confirmPassword: '',
            agreeTerms: false,
            otpCode: '',
            otpVerified: false,
            role: null, // 'citizen' or 'admin'
            idType: '',
            idNumber: '',
            idFileName: ''
        }
    },

    /* --------------------------------------------------------
       2. Main Render
       -------------------------------------------------------- */
    render() {
        switch (this._state.step) {
            case 1: return this.renderCreateAccount();
            case 2: return this.renderPhoneOtp();
            case 3: return this.renderSelectRole();
            case 4: return this.renderIdVerification();
            case 5: return this.renderSuccess();
            default:
                this._state.step = 1;
                return this.renderCreateAccount();
        }
    },

    /* --------------------------------------------------------
       3. Step 1: Create Account
       -------------------------------------------------------- */
    renderCreateAccount() {
        const f = this._state.form;
        // Bind phone formatter once the DOM has the input element
        setTimeout(() => this._bindPhoneFormatter(), 0);
        return `
            <div class="auth-screen">
                ${this._authHeader()}

                <div class="auth-screen__body">
                    <div class="auth-screen__form-header">
                        <div class="auth-screen__form-title">Create account</div>
                        <div class="auth-screen__form-subtitle">Sign up to get started</div>
                    </div>

                    <form id="signup-form" onsubmit="event.preventDefault(); SignupPage.handleCreateAccount(event)">
                        <div class="input-group">
                            <label class="input-group__label" for="signup-name">Full name</label>
                            <input class="input-group__field" type="text" id="signup-name" name="name"
                                   placeholder="Juan Dela Cruz" value="${f.name}" required>
                        </div>

                        <div class="input-group">
                            <label class="input-group__label" for="signup-email">Email</label>
                            <input class="input-group__field" type="email" id="signup-email" name="email"
                                   placeholder="juan@example.com" value="${f.email}" required>
                        </div>

                        <div class="input-group">
                            <label class="input-group__label" for="signup-phone">Phone number</label>
                            <input class="input-group__field" type="tel" id="signup-phone" name="phone"
                                   placeholder="0917-123-4567" inputmode="numeric"
                                   value="${f.phone}">
                        </div>

                        <div class="input-group">
                            <label class="input-group__label" for="signup-password">Enter Password</label>
                            <input class="input-group__field" type="password" id="signup-password" name="password"
                                   placeholder="&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;"
                                   minlength="8" required>
                            <div class="input-group__hint">* Must be at least 8 characters</div>
                        </div>

                        <div class="input-group">
                            <label class="input-group__label" for="signup-confirm">Confirm Password</label>
                            <input class="input-group__field" type="password" id="signup-confirm" name="confirmPassword"
                                   placeholder="&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;"
                                   minlength="8" required>
                        </div>

                        <label class="login-page__terms">
                            <input type="checkbox" name="agreeTerms" ${f.agreeTerms ? 'checked' : ''} required>
                            I agree with the <a href="#" onclick="event.preventDefault(); TermsModal.show('terms')">Terms &amp; Conditions</a>
                        </label>

                        <button type="submit" class="btn btn--primary btn--block mt-lg">Create account</button>
                    </form>

                    <div class="auth-screen__signup">
                        Already have an account?
                        <a href="#/login" onclick="event.preventDefault(); Router.navigate('login')">Log in</a>
                    </div>
                </div>

                ${this._authFooter()}
            </div>
        `;
    },

    /* --------------------------------------------------------
       3b. Step 2: SMS OTP verification
       -------------------------------------------------------- */
    renderPhoneOtp() {
        const f = this._state.form;
        // Mask middle digits: 0917*****89
        const masked = f.phone
            ? f.phone.replace(/^(\+?\d{2,4})(.*)(\d{2})$/, (_, a, mid, b) => a + '*'.repeat(Math.max(0, mid.length)) + b)
            : '';

        return `
            <div class="auth-screen">
                ${this._authHeader()}

                <div class="auth-screen__body">
                    <div class="auth-screen__form-header">
                        <div class="auth-screen__form-title">Verify your phone</div>
                        <div class="auth-screen__form-subtitle">
                            We sent a 6-digit verification code via SMS to
                            <strong>${this.escape(masked || f.phone)}</strong>.
                            Enter it below to continue.
                        </div>
                    </div>

                    <form id="otp-form" onsubmit="event.preventDefault(); SignupPage.handleVerifyOtp(event)">
                        <div class="otp-input-group" id="signup-otp-group">
                            ${Array.from({ length: 6 }).map((_, i) => `
                                <input type="text" inputmode="numeric" pattern="[0-9]*"
                                       class="otp-input" maxlength="1" data-index="${i}"
                                       oninput="SignupPage.handleOtpInput(event, ${i})"
                                       onkeydown="SignupPage.handleOtpKeydown(event, ${i})">
                            `).join('')}
                        </div>

                        <button type="submit" class="btn btn--primary btn--block mt-lg">Verify</button>

                        <div class="auth-screen__signup mt-md" style="text-align:center;">
                            Didn't get the code?
                            <a href="#" onclick="event.preventDefault(); SignupPage.handleResendOtp(event)">Resend</a>
                        </div>

                        <div class="login-page__nav-buttons mt-lg">
                            <button type="button" class="btn btn--outline" onclick="SignupPage.goToStep(1)">Back</button>
                            <span></span>
                        </div>
                    </form>
                </div>

                ${this._authFooter()}
            </div>
        `;
    },

    handleOtpInput(event, index) {
        const input = event.target;
        input.value = input.value.replace(/[^0-9]/g, '');
        if (input.value && index < 5) {
            const next = document.querySelector(`#signup-otp-group .otp-input[data-index="${index + 1}"]`);
            if (next) next.focus();
        }
    },

    handleOtpKeydown(event, index) {
        if (event.key === 'Backspace' && !event.target.value && index > 0) {
            const prev = document.querySelector(`#signup-otp-group .otp-input[data-index="${index - 1}"]`);
            if (prev) prev.focus();
        }
    },

    async handleVerifyOtp(event) {
        const inputs = document.querySelectorAll('#signup-otp-group .otp-input');
        const code = Array.from(inputs).map(i => i.value).join('');

        if (code.length !== 6) {
            alert('Please enter the complete 6-digit code.');
            return;
        }

        const submitBtn = event.target.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Verifying...'; }

        const f = this._state.form;
        const result = await Store.verifyOtp(f.phone, code, 'signup');

        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Verify'; }

        if (!result.success) {
            alert(result.message || 'Invalid code. Please try again.');
            // Clear the inputs to let them retype
            inputs.forEach(i => { i.value = ''; });
            inputs[0] && inputs[0].focus();
            return;
        }

        f.otpCode = code;
        f.otpVerified = true;
        this.goToStep(3);
    },

    async handleResendOtp(event) {
        const link = event.target;
        const original = link.textContent;
        link.textContent = 'Sending...';
        link.style.pointerEvents = 'none';

        const result = await Store.sendOtp(this._state.form.phone, 'signup');

        link.textContent = original;
        link.style.pointerEvents = '';

        if (!result.success) {
            alert(result.message || 'Unable to resend code.');
            return;
        }
        alert('A new code has been sent.');
        if (result.devCode) console.warn('[signup] dev OTP code:', result.devCode);
    },

    /* --------------------------------------------------------
       4. Step 3: Select Role
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

    renderSelectRole() {
        const role = this._state.form.role;
        return `
            <div class="auth-screen">
                ${this._authHeader()}

                <div class="auth-screen__body">
                    <div class="auth-screen__form-header">
                        <div class="auth-screen__form-title">Select Your Role</div>
                        <div class="auth-screen__form-subtitle">Choose your account type to continue</div>
                    </div>

                    <div class="role-cards">
                        <button type="button" class="role-card ${role === 'citizen' ? 'role-card--active' : ''}"
                                onclick="SignupPage.selectRole('citizen', this)">
                            <div class="role-card__icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                            </div>
                            <div class="role-card__title">Citizen of Morong</div>
                            <div class="role-card__desc">Report incidents and access emergency services as a resident</div>
                        </button>

                        <button type="button" class="role-card ${role === 'admin' ? 'role-card--active' : ''}"
                                onclick="SignupPage.selectRole('admin', this)">
                            <div class="role-card__icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                </svg>
                            </div>
                            <div class="role-card__title">MDRRMO Admin</div>
                            <div class="role-card__desc">Manage incidents and coordinate emergency response operations</div>
                        </button>
                    </div>

                    <div class="login-page__info-box">
                        Your role determines your access level and available features in the system.
                    </div>

                    <div class="login-page__nav-buttons">
                        <button type="button" class="btn btn--outline" onclick="SignupPage.goToStep(1)">Back</button>
                        <button type="button" class="btn btn--primary"
                                ${!role ? 'disabled' : ''}
                                onclick="SignupPage.goToStep(4)">Continue</button>
                    </div>
                </div>

                ${this._authFooter()}
            </div>
        `;
    },

    /* --------------------------------------------------------
       5. Step 3: ID Verification
       -------------------------------------------------------- */
    renderIdVerification() {
        const f = this._state.form;
        const isAdmin = f.role === 'admin';
        const subtitle = isAdmin
            ? 'Verify your MDRRMO credentials'
            : 'Verify your identity to continue';
        const infoText = isAdmin
            ? 'Official IDs: Government-issued IDs for MDRRMO personnel. Your credentials will be verified by the system.'
            : 'Accepted IDs: Government-issued IDs for Morong, Rizal residents. Your information is encrypted and secure.';

        const idOptions = isAdmin
            ? ['MDRRMO Employee ID', 'Government Service Card', 'PRC ID', 'Other Government ID']
            : ['Philippine Passport', 'Driver\'s License', 'National ID (PhilSys)', 'UMID', 'Postal ID', 'Voter\'s ID', 'Senior Citizen ID'];

        return `
            <div class="auth-screen">
                ${this._authHeader()}

                <div class="auth-screen__body">
                    <div class="auth-screen__form-header">
                        <div class="auth-screen__form-title">ID Verification</div>
                        <div class="auth-screen__form-subtitle">${subtitle}</div>
                    </div>

                    <form id="verify-form" onsubmit="event.preventDefault(); SignupPage.handleVerifyId(event)">
                        <div class="input-group">
                            <label class="input-group__label" for="id-type">Select ID Type</label>
                            <select class="input-group__field" id="id-type" name="idType" required>
                                <option value="">Choose your ID type</option>
                                ${idOptions.map(opt => `
                                    <option value="${opt}" ${f.idType === opt ? 'selected' : ''}>${opt}</option>
                                `).join('')}
                            </select>
                        </div>

                        <div class="input-group">
                            <label class="input-group__label" for="id-number">ID Number</label>
                            <input class="input-group__field" type="text" id="id-number" name="idNumber"
                                   placeholder="Enter your ID number" value="${f.idNumber}" required>
                        </div>

                        <div class="input-group">
                            <label class="input-group__label">Upload ID</label>
                            <label class="file-upload" for="id-file">
                                <svg viewBox="0 0 24 24">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                                <span class="file-upload__text">
                                    ${f.idFileName || 'Tap to upload photo of your ID'}
                                </span>
                                <input type="file" id="id-file" name="idFile" accept="image/*"
                                       onchange="SignupPage.handleFileSelect(event)" hidden>
                            </label>
                        </div>

                        <div class="login-page__info-box">${infoText}</div>

                        <div class="login-page__nav-buttons">
                            <button type="button" class="btn btn--outline" onclick="SignupPage.goToStep(3)">Back</button>
                            <button type="submit" class="btn btn--primary">Verify</button>
                        </div>
                    </form>
                </div>

                ${this._authFooter()}
            </div>
        `;
    },

    /* --------------------------------------------------------
       6. Step 4: Verification Success
       -------------------------------------------------------- */
    renderSuccess() {
        // Auto-redirect after rendering
        setTimeout(() => this.finalizeSignup(), 1500);

        return `
            <div class="auth-screen">
                ${this._authHeader()}

                <div class="auth-screen__body">
                    <div class="auth-screen__form-header">
                        <div class="auth-screen__form-title">ID Verification</div>
                        <div class="auth-screen__form-subtitle">Verify your identity to continue</div>
                    </div>

                    <div class="success-state">
                        <div class="success-state__icon">
                            <svg viewBox="0 0 24 24">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                        <div class="success-state__title">Verification Successful</div>
                        <div class="success-state__text">Your identity has been verified. Redirecting...</div>
                    </div>
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
        this._bindPhoneFormatter();
    },

    /** Attaches live PH phone formatting to the phone field if present */
    _bindPhoneFormatter() {
        const el = document.getElementById('signup-phone');
        if (el && window.PhoneFormat) PhoneFormat.bind(el);
    },

    selectRole(role, el) {
        this._state.form.role = role;
        document.querySelectorAll('.role-card').forEach(card => {
            card.classList.remove('role-card--active');
        });
        if (el) el.classList.add('role-card--active');
        // Enable continue button
        const continueBtn = document.querySelector('.login-page__nav-buttons .btn--primary');
        if (continueBtn) continueBtn.disabled = false;
    },

    resetState() {
        this._state = {
            step: 1,
            form: {
                name: '', email: '', phone: '',
                password: '', confirmPassword: '',
                agreeTerms: false,
                otpCode: '', otpVerified: false,
                role: null,
                idType: '', idNumber: '', idFileName: ''
            }
        };
    },

    /* --------------------------------------------------------
       8. Form Handlers
       -------------------------------------------------------- */
    async handleCreateAccount(event) {
        const f = this._state.form;

        // NOTE: do NOT use `form.name` — it conflicts with HTMLFormElement.name.
        // Use getElementById / form.elements[name] for safety.
        f.name = document.getElementById('signup-name').value.trim();
        f.email = document.getElementById('signup-email').value.trim();
        const newPhone = document.getElementById('signup-phone').value.trim();
        f.password = document.getElementById('signup-password').value;
        f.confirmPassword = document.getElementById('signup-confirm').value;
        const termsEl = document.querySelector('#signup-form input[name="agreeTerms"]');
        f.agreeTerms = termsEl ? termsEl.checked : false;

        const toast = (msg, type = 'error') => {
            if (window.Toast) Toast.show(msg, { type, duration: 5000 });
            else alert(msg);
        };

        if (!f.name) {
            toast('Please enter your full name.');
            document.getElementById('signup-name').focus();
            return;
        }

        if (!newPhone) {
            toast('Please enter your phone number — we\'ll send a 6-digit SMS code to verify it.');
            document.getElementById('signup-phone').focus();
            return;
        }

        // Strict PH mobile format check — fail fast before server round-trip
        if (!window.PhoneFormat || !PhoneFormat.isValid(newPhone)) {
            toast('That doesn\'t look like a valid Philippine mobile number. Expected format: 0917-123-4567 (11 digits starting with 09).');
            document.getElementById('signup-phone').focus();
            return;
        }

        if (f.password !== f.confirmPassword) {
            toast('The two passwords you entered don\'t match. Please retype them.');
            document.getElementById('signup-confirm').focus();
            return;
        }

        if (f.password.length < 8) {
            toast('Your password is too short — it needs to be at least 8 characters.');
            document.getElementById('signup-password').focus();
            return;
        }

        if (!f.agreeTerms) {
            toast('You must accept the Terms & Conditions to create an account.');
            return;
        }

        // Reset OTP state if the user changed the phone number
        if (newPhone !== f.phone) {
            f.otpVerified = false;
            f.otpCode = '';
        }
        f.phone = newPhone;

        // If phone is already verified (user went back and came forward), skip OTP
        if (f.otpVerified) {
            this.goToStep(3);
            return;
        }

        // Send SMS OTP and advance to verification step
        const submitBtn = event.target.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending code...'; }

        const result = await Store.sendOtp(f.phone, 'signup');

        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create account'; }

        if (!result.success) {
            toast(result.message || 'Couldn\'t send the verification code. Please try again in a moment.');
            return;
        }

        // Dev-mode fallback: TextBee not configured, code returned in response
        if (result.devCode) {
            console.warn('[signup] dev OTP code:', result.devCode);
        }

        this.goToStep(2);
    },

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this._state.form.idFileName = file.name;
            const textEl = document.querySelector('.file-upload__text');
            if (textEl) textEl.textContent = file.name;
        }
    },

    handleVerifyId(event) {
        const f = this._state.form;

        const idTypeEl = document.getElementById('id-type');
        const idNumberEl = document.getElementById('id-number');
        f.idType = idTypeEl ? idTypeEl.value : '';
        f.idNumber = idNumberEl ? idNumberEl.value.trim() : '';

        if (!f.idType || !f.idNumber) {
            alert('Please fill in all required fields.');
            return;
        }

        // Show success state (UI mock for MVP — real verification would happen server-side)
        this.goToStep(5);
    },

    async finalizeSignup() {
        const f = this._state.form;
        const result = await Store.register({
            name: f.name,
            email: f.email,
            password: f.password,
            phone: f.phone || undefined,
            role: f.role
        });

        if (!result.success) {
            const detail = result.errors && result.errors.length
                ? '\n\n' + result.errors.map(e => `• ${e.field}: ${e.message}`).join('\n')
                : '';
            alert((result.message || 'Registration failed. Please try again.') + detail);
            this.goToStep(1);
            return;
        }

        // Admin signups are queued — show toast, return to login.
        if (result.adminRequest === 'pending') {
            this.resetState();
            Router.navigate('login');
            setTimeout(() => {
                Toast.show(
                    result.message || 'Your admin request has been submitted for approval.',
                    { type: 'success', title: 'Request submitted', duration: 4500 }
                );
            }, 100);
            return;
        }

        this.resetState();
        Router.navigate('home');
    },

    escape(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
};
