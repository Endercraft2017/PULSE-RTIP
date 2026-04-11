/* ============================================================
   Preferences Page
   ============================================================
   App behavior preferences (notifications, location).
   Theme/text size moved to the dedicated Appearance page.
   Table of Contents:
   1. State initialization
   2. Render method
   3. Toggle handlers
   4. Save handler
   ============================================================ */

const PreferencesPage = {
    prefs: {},

    /* --------------------------------------------------------
       1. State initialization
       -------------------------------------------------------- */
    init() {
        const saved = localStorage.getItem('pulse_preferences');
        this.prefs = saved ? JSON.parse(saved) : {
            notifStatusUpdates: true,
            notifHazardAlerts: true,
            notifEmergency: true,
            autoLocation: true,
        };
    },

    /* --------------------------------------------------------
       2. Render
       -------------------------------------------------------- */
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

    /* --------------------------------------------------------
       3. Toggle Handlers
       -------------------------------------------------------- */
    toggle(key, el) {
        this.prefs[key] = !this.prefs[key];
        el.classList.toggle('active');
    },

    /* --------------------------------------------------------
       4. Save Handler
       -------------------------------------------------------- */
    save() {
        localStorage.setItem('pulse_preferences', JSON.stringify(this.prefs));
        alert('Preferences saved!');
        history.back();
    },

    /**
     * Compatibility shim — retained because app.js calls it on startup.
     * Theme restoration now lives in AppearancePage.restoreAppearance().
     */
    restoreTheme() {
        // No-op: theme handled by AppearancePage
    }
};
