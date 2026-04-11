/* ============================================================
   Citizen Profile Page
   ============================================================
   Reference: reference/html-designs/profile-user/Profile User2 + User3
   Layout sections (in order):
   1. Avatar card (initial, name, barangay, date joined)
   2. Top menu: Appearance, Preferences
   3. Support section: Facebook, YouTube, X
   4. Personal Information, About Us
   5. Legal section: Report a Bug, Rate the App, Terms, Privacy
   6. Log Out
   ============================================================
   Table of Contents:
   1. Render method
   2. Sub-renderers (avatar card, menu group, social links)
   3. Action handlers
   ============================================================ */

const CitizenProfilePage = {
    /* --------------------------------------------------------
       1. Render
       -------------------------------------------------------- */
    render() {
        const user = Store.get('user') || {};

        return `
            <div class="profile-page">
                ${this.renderAvatarCard(user)}

                <div class="profile-page__group">
                    ${this.renderMenuItem({
                        icon: 'appearance',
                        label: 'Appearance',
                        onclick: "Router.navigate('preferences')"
                    })}
                    ${this.renderMenuItem({
                        icon: 'preferences',
                        label: 'Preferences',
                        onclick: "Router.navigate('preferences')"
                    })}
                </div>

                <div class="profile-page__section-label">Support</div>
                <div class="profile-page__group">
                    ${this.renderSocialLink('facebook', 'Facebook', 'https://facebook.com')}
                    ${this.renderSocialLink('youtube', 'YouTube', 'https://youtube.com')}
                    ${this.renderSocialLink('twitter', 'X (formerly Twitter)', 'https://x.com')}
                </div>

                <div class="profile-page__group">
                    ${this.renderMenuItem({
                        icon: 'user',
                        label: 'Personal Information',
                        onclick: "Router.navigate('edit-profile')"
                    })}
                    ${this.renderMenuItem({
                        icon: 'info',
                        label: 'About Us',
                        onclick: "CitizenProfilePage.showAboutUs()"
                    })}
                </div>

                <div class="profile-page__section-label">Account</div>
                <div class="profile-page__group">
                    ${this.renderMenuItem({
                        icon: 'lock',
                        label: 'Change Password',
                        onclick: "CitizenProfilePage.changePassword()"
                    })}
                    ${this.renderMenuItem({
                        icon: 'trash',
                        label: 'Delete Account',
                        onclick: "CitizenProfilePage.deleteAccount()",
                        danger: true
                    })}
                </div>

                <div class="profile-page__section-label">Legal</div>
                <div class="profile-page__group">
                    ${this.renderMenuItem({
                        icon: 'bug',
                        label: 'Report a Bug',
                        onclick: "CitizenProfilePage.reportBug()"
                    })}
                    ${this.renderMenuItem({
                        icon: 'star',
                        label: 'Rate the App',
                        onclick: "CitizenProfilePage.rateApp()"
                    })}
                    ${this.renderMenuItem({
                        icon: 'document',
                        label: 'Terms and Conditions',
                        onclick: "CitizenProfilePage.showTerms()"
                    })}
                    ${this.renderMenuItem({
                        icon: 'shield',
                        label: 'Privacy Policy',
                        onclick: "CitizenProfilePage.showPrivacy()"
                    })}
                </div>

                <button class="btn btn--danger btn--block profile-page__logout"
                        onclick="CitizenProfilePage.handleLogout()">
                    <svg viewBox="0 0 24 24">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    Log Out
                </button>
            </div>
        `;
    },

    /* --------------------------------------------------------
       2. Sub-renderers
       -------------------------------------------------------- */
    renderAvatarCard(user) {
        const avatar = user.avatar || (user.name ? user.name.charAt(0).toUpperCase() : 'U');
        const name = user.name || 'User';
        const barangay = user.address || '';
        const joinedDate = user.joined_date
            ? new Date(user.joined_date).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric'
            })
            : '';

        return `
            <div class="profile-card">
                <div class="profile-card__avatar">${this.escape(avatar)}</div>
                <div class="profile-card__name">${this.escape(name)}</div>
                <div class="profile-card__info-row">
                    <div class="profile-card__info">
                        <div class="profile-card__info-label">Barangay</div>
                        <div class="profile-card__info-value">${this.escape(barangay) || '—'}</div>
                    </div>
                    <div class="profile-card__divider"></div>
                    <div class="profile-card__info">
                        <div class="profile-card__info-label">Date Joined</div>
                        <div class="profile-card__info-value">${joinedDate || '—'}</div>
                    </div>
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

    renderSocialLink(network, label, url) {
        return `
            <a class="profile-menu-item" href="${url}" target="_blank" rel="noopener noreferrer">
                <div class="profile-menu-item__left">
                    <div class="profile-menu-item__social-icon profile-menu-item__social-icon--${network}">
                        ${this.getIcon(network)}
                    </div>
                    <span class="profile-menu-item__text">${label}</span>
                </div>
                <svg class="profile-menu-item__arrow" viewBox="0 0 24 24">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7 7 17 7 17 17"></polyline>
                </svg>
            </a>
        `;
    },

    getIcon(name) {
        const icons = {
            appearance: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>',
            preferences: '<svg viewBox="0 0 24 24"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>',
            user: '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
            info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
            bug: '<svg viewBox="0 0 24 24"><rect x="8" y="6" width="8" height="14" rx="4"></rect><path d="M19 7l-3 2"></path><path d="M5 7l3 2"></path><path d="M19 13h-3"></path><path d="M5 13h3"></path><path d="M19 19l-3-2"></path><path d="M5 19l3-2"></path><path d="M9 6V4a3 3 0 0 1 6 0v2"></path></svg>',
            star: '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
            document: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
            shield: '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
            lock: '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
            trash: '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>',
            facebook: '<svg viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>',
            youtube: '<svg viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>',
            twitter: '<svg viewBox="0 0 24 24"><path d="M4 4l11.5 16h4.5L8.5 4z"></path><path d="M4 20l7-8"></path><path d="M13 12l7-8"></path></svg>'
        };
        return icons[name] || icons.info;
    },

    /* --------------------------------------------------------
       3. Action Handlers
       -------------------------------------------------------- */
    showAboutUs() {
        alert('PULSE 911 - MDRRMO Morong, Rizal\n\nReal-time incident reporting platform for the Municipal Disaster Risk Reduction and Management Office of Morong, Rizal.\n\nVersion 0.1.0');
    },

    /**
     * Initiates password change flow.
     * Reuses the existing forgot-password recovery flow.
     */
    changePassword() {
        Router.navigate('forgot-password');
    },

    /**
     * Permanently deletes the user account after confirmation.
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
    },

    reportBug() {
        alert('Bug reporting form coming soon. For now, please contact the MDRRMO office directly.');
    },

    rateApp() {
        alert('Thank you for using PULSE 911! App store rating coming soon.');
    },

    showTerms() {
        alert('Terms and Conditions\n\nBy using PULSE 911, you agree to use this platform responsibly to report genuine emergencies and incidents in Morong, Rizal. False reports may result in account suspension.');
    },

    showPrivacy() {
        alert('Privacy Policy\n\nYour personal information is encrypted and used solely for incident reporting and emergency response purposes. We do not share your data with third parties.');
    },

    handleLogout() {
        if (confirm('Are you sure you want to log out?')) {
            Store.logout();
            Router.navigate('login');
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
