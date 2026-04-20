/* ============================================================
   Personal Information Sub-page
   ============================================================
   Reference: reference/html-designs/profile-user/Profile User
   Sub-page reached from the citizen profile screen.
   Contains:
   1. Edit Information   -> navigates to edit-profile form
   2. Change Password    -> reuses forgot-password recovery flow
   3. Delete Account     -> destructive action with double confirm
   ============================================================
   Table of Contents:
   1. Render method
   2. Action handlers
   ============================================================ */

const PersonalInfoPage = {
    /* --------------------------------------------------------
       1. Render
       -------------------------------------------------------- */
    render() {
        return `
            <div class="profile-page">
                <div class="profile-page__group">
                    ${this.renderMenuItem({
                        icon: 'edit',
                        label: 'Edit Information',
                        onclick: "PersonalInfoPage.editInformation()"
                    })}
                    ${this.renderMenuItem({
                        icon: 'lock',
                        label: 'Change Password',
                        onclick: "PersonalInfoPage.changePassword()"
                    })}
                    ${this.renderMenuItem({
                        icon: 'trash',
                        label: 'Delete Account',
                        onclick: "PersonalInfoPage.deleteAccount()",
                        danger: true
                    })}
                </div>
            </div>
        `;
    },

    renderMenuItem({ icon, label, onclick, danger = false }) {
        const dangerClass = danger ? ' profile-menu-item--danger' : '';
        return `
            <button class="profile-menu-item${dangerClass}" onclick="${onclick}">
                <div class="profile-menu-item__left">
                    ${this.getIcon(icon)}
                    <span class="profile-menu-item__text">${label}</span>
                </div>
                <svg class="profile-menu-item__arrow" viewBox="0 0 24 24">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </button>
        `;
    },

    getIcon(name) {
        const icons = {
            edit: '<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
            lock: '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
            trash: '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>'
        };
        return icons[name] || '';
    },

    /* --------------------------------------------------------
       2. Action Handlers
       -------------------------------------------------------- */

    /**
     * Initiates password change flow.
     * Opens an in-page modal for editing the user's profile fields.
     * Avoids the full-page navigation to /edit-profile so the user
     * stays anchored on the Personal Info screen.
     */
    editInformation() {
        this._openEditInfoModal();
    },

    _openEditInfoModal() {
        this._closeEditInfoModal();
        const user = Store.get('user') || {};

        const esc = (s) => String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        const modal = document.createElement('div');
        modal.id = 'edit-info-modal';
        modal.className = 'modal-overlay modal-overlay--centered';
        modal.onclick = (e) => {
            if (e.target === modal) this._closeEditInfoModal();
        };

        modal.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true" aria-labelledby="ei-title" style="max-width: 460px;">
                <div class="modal__header">
                    <h3 class="modal__title" id="ei-title">Edit Information</h3>
                    <button class="modal__close" type="button"
                            onclick="PersonalInfoPage._closeEditInfoModal()" aria-label="Close">
                        <svg viewBox="0 0 24 24">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <form class="modal__body" id="edit-info-form"
                      onsubmit="event.preventDefault(); PersonalInfoPage._submitEditInfo(event)">
                    <div class="input-group">
                        <label class="input-group__label" for="ei-name">Full name</label>
                        <input class="input-group__field" type="text" id="ei-name"
                               value="${esc(user.name)}" required>
                    </div>
                    <div class="input-group">
                        <label class="input-group__label" for="ei-email">Email</label>
                        <input class="input-group__field" type="email" id="ei-email"
                               value="${esc(user.email)}" disabled>
                        <div class="input-group__hint">Email cannot be changed. Contact MDRRMO support if needed.</div>
                    </div>
                    <div class="input-group">
                        <label class="input-group__label" for="ei-phone">Phone number</label>
                        <input class="input-group__field" type="tel" id="ei-phone"
                               inputmode="numeric" placeholder="0917-123-4567"
                               value="${esc(user.phone)}">
                    </div>
                    <div class="input-group">
                        <label class="input-group__label" for="ei-address">Address / Barangay</label>
                        <input class="input-group__field" type="text" id="ei-address"
                               value="${esc(user.address)}">
                    </div>
                    <div class="modal__footer" style="grid-template-columns: 1fr 1fr;">
                        <button type="button" class="btn btn--outline"
                                onclick="PersonalInfoPage._closeEditInfoModal()">Cancel</button>
                        <button type="submit" class="btn btn--primary" id="ei-submit">Save Changes</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => modal.classList.add('modal-overlay--open'));

        this._eiEscHandler = (e) => {
            if (e.key === 'Escape') this._closeEditInfoModal();
        };
        document.addEventListener('keydown', this._eiEscHandler);

        // Live-format the phone input
        setTimeout(() => {
            const phoneEl = document.getElementById('ei-phone');
            if (phoneEl && window.PhoneFormat) PhoneFormat.bind(phoneEl);
            const nameEl = document.getElementById('ei-name');
            if (nameEl) nameEl.focus();
        }, 100);
    },

    _closeEditInfoModal() {
        const modal = document.getElementById('edit-info-modal');
        if (modal) {
            modal.classList.remove('modal-overlay--open');
            setTimeout(() => modal.remove(), 200);
        }
        document.body.style.overflow = '';
        if (this._eiEscHandler) {
            document.removeEventListener('keydown', this._eiEscHandler);
            this._eiEscHandler = null;
        }
    },

    async _submitEditInfo(event) {
        const name = document.getElementById('ei-name').value.trim();
        const phone = document.getElementById('ei-phone').value.trim();
        const address = document.getElementById('ei-address').value.trim();

        const toast = (msg, type = 'error') => {
            if (window.Toast) Toast.show(msg, { type, duration: 5000 });
            else alert(msg);
        };

        if (!name) {
            toast('Full name is required — please enter it before saving.');
            document.getElementById('ei-name').focus();
            return;
        }

        const current = Store.get('user') || {};

        // Compare digits-only so formatting differences don't trigger OTP
        const digits = (s) => String(s || '').replace(/\D/g, '');
        const phoneChanged = phone && digits(phone) !== digits(current.phone);

        const btn = document.getElementById('ei-submit');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

        // If the phone changed, validate format + availability FIRST
        // (before sending an SMS) then save name/address and proceed
        // to the OTP verification step.
        if (phoneChanged) {
            // Step 1: client-side format check — fail fast, no server call
            if (!window.PhoneFormat || !PhoneFormat.isValid(phone)) {
                if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
                toast('That doesn\'t look like a valid Philippine mobile number. Expected format: 0917-123-4567 (11 digits starting with 09).');
                document.getElementById('ei-phone').focus();
                return;
            }

            // Step 2: server preflight check — duplicate / same-as-current
            const avail = await Store.checkPhoneAvailable(phone);
            if (!avail.available) {
                if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
                toast(avail.message || 'This phone number can\'t be used.');
                return;
            }

            // Step 3: save name/address if they changed (non-blocking)
            if (name !== current.name || address !== (current.address || '')) {
                try {
                    const res = await Store.apiFetch('/api/users/me', {
                        method: 'PUT',
                        body: JSON.stringify({ name, address }),
                    });
                    if (res.success) {
                        Store.set('user', Object.assign({}, current, res.data || { name, address }));
                    }
                } catch (e) { /* non-fatal — continue to phone flow */ }
            }

            // Step 4: send the OTP
            const otpRes = await Store.sendPhoneChangeOtp(phone);
            if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }

            if (!otpRes.success) {
                toast(otpRes.message || 'Couldn\'t send the verification code. Please try again in a moment.');
                return;
            }

            if (otpRes.devCode) console.warn('[edit-info] dev OTP code:', otpRes.devCode);

            this._pendingPhone = phone;
            this._pendingMaskedPhone = otpRes.maskedPhone || phone;
            this._renderOtpStep();
            return;
        }

        // No phone change — straight-through update
        try {
            const res = await Store.apiFetch('/api/users/me', {
                method: 'PUT',
                body: JSON.stringify({ name, phone, address }),
            });

            if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }

            if (!res.success) {
                toast(res.message || 'Couldn\'t save your profile. Please try again.');
                return;
            }

            Store.set('user', Object.assign({}, current, res.data || { name, phone, address }));
            this._closeEditInfoModal();
            toast('Profile updated successfully.', 'success');
        } catch (err) {
            if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
            toast('Network error — check your connection and try again.');
        }
    },

    /**
     * Swaps the Edit Information modal into a "Verify new phone number"
     * OTP step. Only rendered when the user changes their phone number.
     */
    _renderOtpStep() {
        const modal = document.getElementById('edit-info-modal');
        if (!modal) return;
        const body = modal.querySelector('.modal');
        if (!body) return;

        const masked = this._pendingMaskedPhone || this._pendingPhone || 'your new number';

        body.innerHTML = `
            <div class="modal__header">
                <h3 class="modal__title">Verify new phone</h3>
                <button class="modal__close" type="button"
                        onclick="PersonalInfoPage._closeEditInfoModal()" aria-label="Close">
                    <svg viewBox="0 0 24 24">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <form class="modal__body" id="ei-otp-form"
                  onsubmit="event.preventDefault(); PersonalInfoPage._submitPhoneOtp(event)">
                <p style="margin:0 0 var(--spacing-lg);color:var(--color-gray-600);font-size:var(--font-size-sm);line-height:1.5;">
                    We sent a 6-digit verification code via SMS to
                    <strong>${this._escapeHtml(masked)}</strong>.
                    Enter it below to confirm this phone number.
                </p>

                <div class="otp-input-group" id="ei-otp-group">
                    ${Array.from({ length: 6 }).map((_, i) => `
                        <input type="text" inputmode="numeric" pattern="[0-9]*"
                               class="otp-input" maxlength="1" data-index="${i}"
                               oninput="PersonalInfoPage._otpInput(event, ${i})"
                               onkeydown="PersonalInfoPage._otpKeydown(event, ${i})">
                    `).join('')}
                </div>

                <div style="text-align:center;font-size:var(--font-size-xs);color:var(--color-gray-500);margin-top:var(--spacing-md);">
                    Didn't get the code?
                    <a href="#" onclick="event.preventDefault(); PersonalInfoPage._resendPhoneOtp(event)">Resend</a>
                </div>

                <div class="modal__footer" style="grid-template-columns: 1fr 1fr;">
                    <button type="button" class="btn btn--outline"
                            onclick="PersonalInfoPage._closeEditInfoModal()">Cancel</button>
                    <button type="submit" class="btn btn--primary" id="ei-otp-submit">Verify</button>
                </div>
            </form>
        `;

        // Focus first OTP input
        setTimeout(() => {
            const first = body.querySelector('.otp-input');
            if (first) first.focus();
        }, 50);
    },

    _otpInput(event, index) {
        const input = event.target;
        input.value = input.value.replace(/\D/g, '');
        if (input.value && index < 5) {
            const next = document.querySelector(`#ei-otp-group .otp-input[data-index="${index + 1}"]`);
            if (next) next.focus();
        }
    },

    _otpKeydown(event, index) {
        if (event.key === 'Backspace' && !event.target.value && index > 0) {
            const prev = document.querySelector(`#ei-otp-group .otp-input[data-index="${index - 1}"]`);
            if (prev) prev.focus();
        }
    },

    /** Shared toast helper for personal-info flows */
    _piToast(msg, type = 'error') {
        if (window.Toast) Toast.show(msg, { type, duration: 5000 });
        else alert(msg);
    },

    async _resendPhoneOtp(event) {
        const link = event.target;
        const original = link.textContent;
        link.textContent = 'Sending...';
        link.style.pointerEvents = 'none';

        const result = await Store.sendPhoneChangeOtp(this._pendingPhone);

        link.textContent = original;
        link.style.pointerEvents = '';

        if (!result.success) {
            this._piToast(result.message || 'Couldn\'t resend the code. Please try again.');
            return;
        }
        if (result.devCode) console.warn('[edit-info] dev OTP code:', result.devCode);
        this._piToast('A fresh 6-digit code has been sent via SMS.', 'success');
    },

    async _submitPhoneOtp(event) {
        const inputs = document.querySelectorAll('#ei-otp-group .otp-input');
        const code = Array.from(inputs).map(i => i.value).join('');

        if (code.length !== 6) {
            this._piToast('Please enter the full 6-digit code from the SMS.', 'info');
            return;
        }

        const btn = document.getElementById('ei-otp-submit');
        if (btn) { btn.disabled = true; btn.textContent = 'Verifying...'; }

        const result = await Store.updatePhone(this._pendingPhone, code);

        if (btn) { btn.disabled = false; btn.textContent = 'Verify'; }

        if (!result.success) {
            this._piToast(result.message || 'That code didn\'t match. Please try again.');
            inputs.forEach(i => { i.value = ''; });
            inputs[0] && inputs[0].focus();
            return;
        }

        const current = Store.get('user') || {};
        Store.set('user', Object.assign({}, current, result.data || { phone: this._pendingPhone }));

        this._pendingPhone = null;
        this._pendingMaskedPhone = null;
        this._closeEditInfoModal();
        this._piToast('Phone number updated successfully.', 'success');
    },

    _escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

     /**
     * Opens an in-page modal so the logged-in user can change their
     * password without losing their session. The forgot-password OTP
     * flow is reserved for locked-out users on the login screen.
     */
    changePassword() {
        this._openChangePasswordModal();
    },

    _openChangePasswordModal() {
        this._closeChangePasswordModal();

        const modal = document.createElement('div');
        modal.id = 'change-password-modal';
        modal.className = 'modal-overlay modal-overlay--centered';
        modal.onclick = (e) => {
            if (e.target === modal) this._closeChangePasswordModal();
        };

        modal.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true" aria-labelledby="cp-title" style="max-width: 460px;">
                <div class="modal__header">
                    <h3 class="modal__title" id="cp-title">Change Password</h3>
                    <button class="modal__close" type="button"
                            onclick="PersonalInfoPage._closeChangePasswordModal()" aria-label="Close">
                        <svg viewBox="0 0 24 24">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <form class="modal__body" id="change-password-form"
                      onsubmit="event.preventDefault(); PersonalInfoPage._submitChangePassword(event)">
                    <div class="input-group">
                        <label class="input-group__label" for="cp-current">Current password</label>
                        <input class="input-group__field" type="password" id="cp-current"
                               autocomplete="current-password" required>
                    </div>
                    <div class="input-group">
                        <label class="input-group__label" for="cp-new">New password</label>
                        <input class="input-group__field" type="password" id="cp-new"
                               autocomplete="new-password" minlength="8" required>
                        <div class="input-group__hint">* Must be at least 8 characters</div>
                    </div>
                    <div class="input-group">
                        <label class="input-group__label" for="cp-confirm">Confirm new password</label>
                        <input class="input-group__field" type="password" id="cp-confirm"
                               autocomplete="new-password" minlength="8" required>
                    </div>
                    <div class="modal__footer" style="grid-template-columns: 1fr 1fr;">
                        <button type="button" class="btn btn--outline"
                                onclick="PersonalInfoPage._closeChangePasswordModal()">Cancel</button>
                        <button type="submit" class="btn btn--primary" id="cp-submit">Update</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => modal.classList.add('modal-overlay--open'));

        // Escape key closes the modal
        this._cpEscHandler = (e) => {
            if (e.key === 'Escape') this._closeChangePasswordModal();
        };
        document.addEventListener('keydown', this._cpEscHandler);

        // Focus the first field
        setTimeout(() => {
            const firstInput = document.getElementById('cp-current');
            if (firstInput) firstInput.focus();
        }, 100);
    },

    _closeChangePasswordModal() {
        const modal = document.getElementById('change-password-modal');
        if (modal) {
            modal.classList.remove('modal-overlay--open');
            setTimeout(() => modal.remove(), 200);
        }
        document.body.style.overflow = '';
        if (this._cpEscHandler) {
            document.removeEventListener('keydown', this._cpEscHandler);
            this._cpEscHandler = null;
        }
    },

    async _submitChangePassword(event) {
        const current = document.getElementById('cp-current').value;
        const next = document.getElementById('cp-new').value;
        const confirm = document.getElementById('cp-confirm').value;

        const toast = (msg, type = 'error') => {
            if (window.Toast) Toast.show(msg, { type, duration: 5000 });
            else alert(msg);
        };

        if (next !== confirm) {
            toast('The two new passwords don\'t match. Please retype them.');
            return;
        }

        if (next.length < 8) {
            toast('Your new password is too short — it needs to be at least 8 characters.');
            return;
        }

        if (current === next) {
            toast('Your new password must be different from your current one.');
            return;
        }

        const btn = document.getElementById('cp-submit');
        if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }

        const result = await Store.changePassword(current, next);

        if (btn) { btn.disabled = false; btn.textContent = 'Update'; }

        if (!result.success) {
            toast(result.message || 'Couldn\'t change your password. Please try again.');
            return;
        }

        this._closeChangePasswordModal();
        toast('Password updated successfully.', 'success');
    },

    /**
     * Permanently deletes the user account after double confirmation.
     * Calls DELETE /api/users/me when the backend exposes it.
     */
    async deleteAccount() {
        const confirmed = confirm(
            'Delete your account?\n\n' +
            'This action is permanent. All your reports, notifications, and personal data will be removed and cannot be recovered.\n\n' +
            'Are you sure you want to continue?'
        );
        if (!confirmed) return;

        const verify = prompt('Type DELETE to confirm permanent account deletion:');
        if (verify !== 'DELETE') {
            alert('Account deletion cancelled.');
            return;
        }

        try {
            const res = await Store.apiFetch('/api/users/me', { method: 'DELETE' });
            if (res && res.success) {
                alert('Your account has been deleted.');
                Store.logout();
                Router.navigate('login');
            } else {
                alert((res && res.message) || 'Account deletion is not yet available. Please contact MDRRMO support.');
            }
        } catch (err) {
            alert('Account deletion is not yet available. Please contact MDRRMO support.');
        }
    }
};
