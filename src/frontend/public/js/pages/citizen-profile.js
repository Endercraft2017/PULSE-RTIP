/* ============================================================
   Citizen Profile Page
   ============================================================
   Reference: index7.html (Figma export)
   User profile with settings, preferences, and social links.
   Table of Contents:
   1. Render method
   ============================================================ */

const CitizenProfilePage = {
    render() {
        const user = Store.get('user') || {};

        return `
            <div class="profile-header">
                <div class="profile-header__avatar">${user.avatar || 'R'}</div>
                <div class="profile-header__name">${user.name || 'Ray Ban Lopez'}</div>
                <div class="profile-header__role">${user.address || 'San Pedro (Pob.)'}</div>
                <div class="profile-header__joined">Joined ${user.joined_date ? new Date(user.joined_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}</div>
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
                        <div class="profile-info-item__value">${user.name || 'Ray Ban Lopez'}</div>
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
                        <div class="profile-info-item__value">${user.email || 'rayban@email.com'}</div>
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
                        <div class="profile-info-item__value">${user.phone || '0917-123-4567'}</div>
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
                        <div class="profile-info-item__label">Barangay</div>
                        <div class="profile-info-item__value">${user.address || 'San Pedro (Pob.)'}</div>
                    </div>
                </div>
            </div>

            <div style="padding: 0 var(--spacing-lg);">
                <div class="section-header mt-lg">
                    <div class="section-header__title">Settings</div>
                </div>

                <div class="card" style="padding: 0; overflow: hidden;">
                    <div class="profile-menu-item" onclick="Router.navigate('preferences')">
                        <div class="profile-menu-item__left">
                            <svg viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="5"></circle>
                                <line x1="12" y1="1" x2="12" y2="3"></line>
                                <line x1="12" y1="21" x2="12" y2="23"></line>
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                                <line x1="1" y1="12" x2="3" y2="12"></line>
                                <line x1="21" y1="12" x2="23" y2="12"></line>
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                            </svg>
                            <span class="profile-menu-item__text">Appearance</span>
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
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                            <span class="profile-menu-item__text">About Us</span>
                        </div>
                        <svg class="profile-menu-item__arrow" viewBox="0 0 24 24">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                    <div class="profile-menu-item" onclick="Router.navigate('report-progress')">
                        <div class="profile-menu-item__left">
                            <svg viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            <span class="profile-menu-item__text">Support</span>
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
