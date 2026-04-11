/* ============================================================
   Admin Profile Page
   ============================================================
   Reference: index1.html (Figma export)
   Admin user profile with personal info and activity sections.
   Table of Contents:
   1. Render method
   ============================================================ */

const AdminProfilePage = {
    render() {
        const user = Store.get('user') || {};

        return `
            <div class="profile-header">
                <div class="profile-header__avatar">${user.avatar || 'M'}</div>
                <div class="profile-header__name">${user.name || 'MDRRMO Admin'}</div>
                <div class="profile-header__role">Administrator</div>
            </div>

            <div class="profile-section">
                <div class="profile-section__header">
                    <h3 class="profile-section__title">Personal Information</h3>
                    <button class="btn btn--outline btn--sm" onclick="Router.navigate('edit-profile')">Edit</button>
                </div>

                <div class="profile-info-item">
                    <div class="profile-info-item__icon">
                        <svg viewBox="0 0 24 24">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    </div>
                    <div>
                        <div class="profile-info-item__label">Full Name</div>
                        <div class="profile-info-item__value">${user.name || 'MDRRMO Admin'}</div>
                    </div>
                </div>

                <div class="profile-info-item">
                    <div class="profile-info-item__icon">
                        <svg viewBox="0 0 24 24">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                    </div>
                    <div>
                        <div class="profile-info-item__label">Email</div>
                        <div class="profile-info-item__value">${user.email || 'admin@mdrrmo.gov'}</div>
                    </div>
                </div>

                <div class="profile-info-item">
                    <div class="profile-info-item__icon">
                        <svg viewBox="0 0 24 24">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </div>
                    <div>
                        <div class="profile-info-item__label">Phone Number</div>
                        <div class="profile-info-item__value">${user.phone || '987-654-3210'}</div>
                    </div>
                </div>

                <div class="profile-info-item">
                    <div class="profile-info-item__icon">
                        <svg viewBox="0 0 24 24">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </div>
                    <div>
                        <div class="profile-info-item__label">Address</div>
                        <div class="profile-info-item__value">${user.address || 'MDRRMO Office'}</div>
                    </div>
                </div>
            </div>

            <div style="padding: 0 var(--spacing-lg);">
                <div class="section-header mt-lg">
                    <div class="section-header__title">Activity</div>
                </div>

                <div class="card" style="padding: 0; overflow: hidden;">
                    <div class="profile-menu-item" onclick="Router.navigate('report-progress')">
                        <div class="profile-menu-item__left">
                            <svg viewBox="0 0 24 24">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            <span class="profile-menu-item__text">Report Progress</span>
                        </div>
                        <svg class="profile-menu-item__arrow" viewBox="0 0 24 24">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                    <div class="profile-menu-item" onclick="Router.navigate('service-request')">
                        <div class="profile-menu-item__left">
                            <svg viewBox="0 0 24 24">
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                            </svg>
                            <span class="profile-menu-item__text">Service Request Progress</span>
                        </div>
                        <svg class="profile-menu-item__arrow" viewBox="0 0 24 24">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                    <div class="profile-menu-item" onclick="Router.navigate('preferences')">
                        <div class="profile-menu-item__left">
                            <svg viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                            <span class="profile-menu-item__text">Preferences</span>
                        </div>
                        <svg class="profile-menu-item__arrow" viewBox="0 0 24 24">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                    <div class="profile-menu-item" onclick="Router.navigate('activities')">
                        <div class="profile-menu-item__left">
                            <svg viewBox="0 0 24 24">
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                            </svg>
                            <span class="profile-menu-item__text">Activities</span>
                        </div>
                        <svg class="profile-menu-item__arrow" viewBox="0 0 24 24">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                </div>

                <button class="btn btn--danger btn--block mt-xl" onclick="Store.logout(); Router.navigate('login');">
                    Log Out
                </button>

                <div style="height: 24px;"></div>
            </div>
        `;
    }
};
