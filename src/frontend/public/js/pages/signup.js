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
            case 2: return this.renderSelectRole();
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
                </div>

                <div class="login-page__form-header">
                    <div class="login-page__form-title">Create account</div>
                    <div class="login-page__form-subtitle">Sign up to get started</div>
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
                               placeholder="+63 912 345 6789" value="${f.phone}">
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

                <div class="login-page__signup">
                    Already have an account? <a href="#/login">Log in</a>
                </div>

                <div class="login-page__footer">
                    &copy; 2025 Pulse &bull; MDRRMO Morong, Rizal
                </div>
            </div>
        `;
    },

    /* --------------------------------------------------------
       4. Step 2: Select Role
       -------------------------------------------------------- */
    renderSelectRole() {
        const role = this._state.form.role;
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
                    <div class="login-page__form-title">Select Your Role</div>
                    <div class="login-page__form-subtitle">Choose your account type to continue</div>
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
                            onclick="SignupPage.goToStep(3)">Continue</button>
                </div>

                <div class="login-page__footer">
                    &copy; 2025 Pulse &bull; MDRRMO Morong, Rizal
                </div>
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
                    <div class="login-page__form-title">ID Verification</div>
                    <div class="login-page__form-subtitle">${subtitle}</div>
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

                <div class="login-page__footer">
                    &copy; 2025 Pulse &bull; MDRRMO Morong, Rizal
                </div>
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
                    <div class="login-page__form-title">ID Verification</div>
                    <div class="login-page__form-subtitle">Verify your identity to continue</div>
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

                <div class="login-page__footer">
                    &copy; 2025 Pulse &bull; MDRRMO Morong, Rizal
                </div>
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
                agreeTerms: false, role: null,
                idType: '', idNumber: '', idFileName: ''
            }
        };
    },

    /* --------------------------------------------------------
       8. Form Handlers
       -------------------------------------------------------- */
    handleCreateAccount(event) {
        const f = this._state.form;

        // NOTE: do NOT use `form.name` — it conflicts with HTMLFormElement.name.
        // Use getElementById / form.elements[name] for safety.
        f.name = document.getElementById('signup-name').value.trim();
        f.email = document.getElementById('signup-email').value.trim();
        f.phone = document.getElementById('signup-phone').value.trim();
        f.password = document.getElementById('signup-password').value;
        f.confirmPassword = document.getElementById('signup-confirm').value;
        const termsEl = document.querySelector('#signup-form input[name="agreeTerms"]');
        f.agreeTerms = termsEl ? termsEl.checked : false;

        if (!f.name) {
            alert('Please enter your full name.');
            return;
        }

        if (f.password !== f.confirmPassword) {
            alert('Passwords do not match.');
            return;
        }

        if (f.password.length < 8) {
            alert('Password must be at least 8 characters.');
            return;
        }

        if (!f.agreeTerms) {
            alert('You must agree to the Terms & Conditions.');
            return;
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
        this.goToStep(4);
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

        if (result.success) {
            this.resetState();
            Router.navigate(f.role === 'admin' ? 'admin-home' : 'citizen-home');
        } else {
            alert(result.message || 'Registration failed. Please try again.');
            this.goToStep(1);
        }
    }
};
