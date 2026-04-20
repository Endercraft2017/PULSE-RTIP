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
                        onclick: "Router.navigate('edit-profile')"
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

        if (next !== confirm) {
            alert('New passwords do not match.');
            return;
        }

        if (next.length < 8) {
            alert('New password must be at least 8 characters.');
            return;
        }

        if (current === next) {
            alert('New password must be different from your current password.');
            return;
        }

        const btn = document.getElementById('cp-submit');
        if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }

        const result = await Store.changePassword(current, next);

        if (btn) { btn.disabled = false; btn.textContent = 'Update'; }

        if (!result.success) {
            alert(result.message || 'Failed to change password.');
            return;
        }

        this._closeChangePasswordModal();
        alert('Password updated successfully.');
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
