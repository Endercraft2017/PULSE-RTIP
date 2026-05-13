/* ============================================================
   Signup Page (Multi-step flow)
   ============================================================
   Reference: reference/html-designs/login/signup/Login Page{1,4,6,8,9}
   Table of Contents:
   1. Internal state
   2. Main render (step router)
   3. Step 1: Create Account (name, email, phone, barangay, passwords, terms)
   4. Step 2: Phone OTP verification
   5. Step 3: ID Verification
   6. Step 4: Verification Success
   7. Step navigation helpers
   8. Form handlers

   Role selection was removed (U-10): every new signup is a citizen.
   Admin accounts are provisioned exclusively via the server-side CLI.
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
            barangay: '',
            password: '',
            confirmPassword: '',
            agreeTerms: false,
            otpCode: '',
            otpVerified: false,
            idType: '',
            idNumber: '',
            idFileName: '',
            idFile: null // File object — attached to FormData at register time
        }
    },

    /* --------------------------------------------------------
       2. Main Render
       -------------------------------------------------------- */
    render() {
        switch (this._state.step) {
            case 1: return this.renderCreateAccount();
            case 2: return this.renderPhoneOtp();
            case 3: return this.renderIdVerification();
            case 4: return this.renderSuccess();
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

        const barangays = (window.MorongBarangays || []);
        const barangayOptions = barangays.map(b => `
            <option value="${b}" ${f.barangay === b ? 'selected' : ''}>${b}</option>
        `).join('');

        return `
            <div class="auth-screen">
                ${this._authHeader()}

                <div class="auth-screen__body">
                    <div class="auth-screen__form-header">
                        <div class="auth-screen__form-title">Create account</div>
                        <div class="auth-screen__form-subtitle">Step 1 of 4 &bull; Sign up to get started</div>
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
                            <label class="input-group__label" for="signup-barangay">Barangay</label>
                            <select class="input-group__field" id="signup-barangay" name="barangay" required>
                                <option value="">Select your barangay</option>
                                ${barangayOptions}
                            </select>
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

                    ${this._renderSmsHint()}

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
       4. Step 2: SMS OTP verification
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
                            Step 2 of 4 &bull; We sent a 6-digit verification code via SMS to
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
        // Skip the old "Select Role" step — jump straight to ID verification.
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
       Header / footer partials
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
        const display = cached ? this.escape(cached) : 'Loading...';
        const href = cached ? `tel:${cached}` : '#';
        if (!cached && window.Store && typeof Store.apiFetch === 'function') {
            setTimeout(() => {
                Store.apiFetch('/api/sms/gateway-phone').then(res => {
                    if (res && res.success && res.data && res.data.phone) {
                        localStorage.setItem('pulse_gateway_phone', res.data.phone);
                        const span = document.getElementById('auth-sms-phone-su');
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
                    <a href="${href}"><strong><span id="auth-sms-phone-su">${display}</span></strong></a>.
                    We'll guide you through it.
                </div>
            </div>
        `;
    },

    /* --------------------------------------------------------
       5. Step 3: ID Verification
       -------------------------------------------------------- */
    renderIdVerification() {
        const f = this._state.form;
        // Citizen-only signup flow: the old admin-branch copy was removed
        // along with the role-select step.
        const subtitle = 'Step 3 of 4 • Verify your identity to continue';
        const infoText = 'Accepted IDs: Government-issued IDs for Morong, Rizal residents. Your information is encrypted and secure.';

        const idOptions = ['Philippine Passport', 'Driver\'s License', 'National ID (PhilSys)', 'UMID', 'Postal ID', 'Voter\'s ID', 'Senior Citizen ID'];

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
                            <button type="button" class="btn btn--outline" onclick="SignupPage.goToStep(2)">Back</button>
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
        // Auto-run registration after rendering; the finalize step will
        // swap this screen for the "pending review" screen on success.
        setTimeout(() => this.finalizeSignup(), 1200);

        return `
            <div class="auth-screen">
                ${this._authHeader()}

                <div class="auth-screen__body">
                    <div class="auth-screen__form-header">
                        <div class="auth-screen__form-title">ID Verification</div>
                        <div class="auth-screen__form-subtitle">Step 4 of 4 &bull; Submitting your application</div>
                    </div>

                    <div class="success-state">
                        <div class="success-state__icon">
                            <svg viewBox="0 0 24 24">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                        <div class="success-state__title">Verification Successful</div>
                        <div class="success-state__text">Submitting your account for review...</div>
                    </div>
                </div>

                ${this._authFooter()}
            </div>
        `;
    },

    renderPendingReview(message) {
        const body = message || 'Thanks! Your account is pending MDRRMO admin review. You\'ll be notified by SMS and email when reviewed.';
        return `
            <div class="auth-screen">
                ${this._authHeader()}

                <div class="auth-screen__body">
                    <div class="auth-screen__form-header">
                        <div class="auth-screen__form-title">Account pending review</div>
                        <div class="auth-screen__form-subtitle">Almost there!</div>
                    </div>

                    <div class="success-state">
                        <div class="success-state__icon">
                            <svg viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                        </div>
                        <div class="success-state__title">Submitted for approval</div>
                        <div class="success-state__text">${this.escape(body)}</div>
                    </div>

                    <div class="login-page__info-box">
                        An MDRRMO admin will review your application. You will receive an SMS
                        and email at the address you signed up with once a decision is made.
                    </div>

                    <button type="button" class="btn btn--primary btn--block mt-lg"
                            onclick="SignupPage.resetState(); Router.navigate('login')">
                        Back to log in
                    </button>
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

    resetState() {
        this._state = {
            step: 1,
            form: {
                name: '', email: '', phone: '', barangay: '',
                password: '', confirmPassword: '',
                agreeTerms: false,
                otpCode: '', otpVerified: false,
                idType: '', idNumber: '', idFileName: '', idFile: null
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
        const barangayEl = document.getElementById('signup-barangay');
        f.barangay = barangayEl ? barangayEl.value : '';
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

        if (!f.barangay) {
            toast('Please select your barangay so MDRRMO can route alerts that apply to your area.');
            if (barangayEl) barangayEl.focus();
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
            // 5MB cap mirrors server-side config.upload.maxFileSize
            if (file.size > 5 * 1024 * 1024) {
                alert('ID image is too large. Maximum size is 5MB.');
                event.target.value = '';
                return;
            }
            if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
                alert('ID image must be a PNG, JPG, or WEBP file.');
                event.target.value = '';
                return;
            }
            this._state.form.idFile = file;
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

        if (!f.idFile) {
            alert('Please upload a photo of your ID.');
            return;
        }

        this.goToStep(4);
    },

    async finalizeSignup() {
        const f = this._state.form;
        const result = await Store.register({
            name: f.name,
            email: f.email,
            password: f.password,
            phone: f.phone || undefined,
            barangay: f.barangay || undefined,
            // Explicitly pin role — server forces 'citizen' anyway, but being
            // explicit makes the client intent obvious and prevents a stray
            // admin-role request from ever leaving this form.
            role: 'citizen',
            idType: f.idType,
            idNumber: f.idNumber,
            idFile: f.idFile || undefined
        });

        if (!result.success) {
            const detail = result.errors && result.errors.length
                ? '\n\n' + result.errors.map(e => `• ${e.field}: ${e.message}`).join('\n')
                : '';
            alert((result.message || 'Registration failed. Please try again.') + detail);
            // Bounce back to the ID step if the failure is about the ID —
            // users shouldn't have to re-enter everything from step 1.
            const isIdError = result.message && /\bID\b/.test(result.message);
            this.goToStep(isIdError ? 3 : 1);
            return;
        }

        // Every signup — citizen or admin — is now pending review.
        // Show the pending-review screen; the user taps "Back to log in"
        // when they're ready and cannot sign in until an admin approves.
        const appContent = document.getElementById('app-content');
        if (appContent) {
            appContent.innerHTML = this.renderPendingReview(result.message);
        }
        if (typeof Toast !== 'undefined') {
            Toast.show(
                result.message || 'Your account is pending MDRRMO admin review.',
                { type: 'success', title: 'Submitted for approval', duration: 5000 }
            );
        }
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
