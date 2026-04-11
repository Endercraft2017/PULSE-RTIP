/* ============================================================
   Preferences Page
   ============================================================
   Table of Contents:
   1. State initialization
   2. Render method
   3. Toggle handlers
   4. Dark mode implementation
   ============================================================ */

const PreferencesPage = {
    prefs: {},

    init() {
        const saved = localStorage.getItem('pulse_preferences');
        this.prefs = saved ? JSON.parse(saved) : {
            notifStatusUpdates: true,
            notifHazardAlerts: true,
            notifEmergency: true,
            darkMode: false,
            compactView: false,
            autoLocation: true,
        };
    },

    render() {
        this.init();
        const p = this.prefs;

        return `
            <div class="page-padding">
                <div class="card">
                    <div class="pref-group">
                        <div class="pref-group__title">Notifications</div>
                        <div class="pref-item">
                            <div>
                                <div class="pref-item__label">Report Status Updates</div>
                                <div class="pref-item__desc">Get notified when report statuses change</div>
                            </div>
                            <div class="toggle ${p.notifStatusUpdates ? 'active' : ''}" onclick="PreferencesPage.toggle('notifStatusUpdates', this)"><div class="toggle__knob"></div></div>
                        </div>
                        <div class="pref-item">
                            <div>
                                <div class="pref-item__label">Hazard Alerts</div>
                                <div class="pref-item__desc">Receive alerts for new hazard zones</div>
                            </div>
                            <div class="toggle ${p.notifHazardAlerts ? 'active' : ''}" onclick="PreferencesPage.toggle('notifHazardAlerts', this)"><div class="toggle__knob"></div></div>
                        </div>
                        <div class="pref-item">
                            <div>
                                <div class="pref-item__label">Emergency Broadcasts</div>
                                <div class="pref-item__desc">Critical emergency alerts for your area</div>
                            </div>
                            <div class="toggle ${p.notifEmergency ? 'active' : ''}" onclick="PreferencesPage.toggle('notifEmergency', this)"><div class="toggle__knob"></div></div>
                        </div>
                    </div>
                    <div class="pref-group">
                        <div class="pref-group__title">Display</div>
                        <div class="pref-item">
                            <div>
                                <div class="pref-item__label">Dark Mode</div>
                                <div class="pref-item__desc">Switch to dark theme</div>
                            </div>
                            <div class="toggle ${p.darkMode ? 'active' : ''}" onclick="PreferencesPage.toggle('darkMode', this)"><div class="toggle__knob"></div></div>
                        </div>
                        <div class="pref-item">
                            <div>
                                <div class="pref-item__label">Compact View</div>
                                <div class="pref-item__desc">Show more items with smaller cards</div>
                            </div>
                            <div class="toggle ${p.compactView ? 'active' : ''}" onclick="PreferencesPage.toggle('compactView', this)"><div class="toggle__knob"></div></div>
                        </div>
                    </div>
                    <div class="pref-group">
                        <div class="pref-group__title">Location</div>
                        <div class="pref-item">
                            <div>
                                <div class="pref-item__label">Auto-detect Location</div>
                                <div class="pref-item__desc">Use GPS for report location</div>
                            </div>
                            <div class="toggle ${p.autoLocation ? 'active' : ''}" onclick="PreferencesPage.toggle('autoLocation', this)"><div class="toggle__knob"></div></div>
                        </div>
                    </div>
                </div>
                <button class="btn btn--primary btn--block mt-lg" onclick="PreferencesPage.save()">Save Preferences</button>
            </div>
        `;
    },

    toggle(key, el) {
        this.prefs[key] = !this.prefs[key];
        el.classList.toggle('active');

        if (key === 'darkMode') {
            this.applyDarkMode(this.prefs.darkMode);
        }
    },

    applyDarkMode(enabled) {
        if (enabled) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    },

    save() {
        localStorage.setItem('pulse_preferences', JSON.stringify(this.prefs));
        alert('Preferences saved!');
        history.back();
    },

    /** Called on app startup to apply saved dark mode */
    restoreTheme() {
        const saved = localStorage.getItem('pulse_preferences');
        if (saved) {
            const prefs = JSON.parse(saved);
            if (prefs.darkMode) {
                document.body.classList.add('dark-mode');
            }
        }
    }
};
