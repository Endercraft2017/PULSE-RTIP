/* ============================================================
   Admin Preferences Page
   ============================================================
   Admin-only variant of Preferences. Drops citizen-specific
   toggles (auto-detect location, report-status updates) and
   adds admin workflow notifications (new signups, new reports,
   hazard broadcast delivery receipts).
   Table of Contents:
   1. State initialization
   2. Render method
   3. Toggle / save handlers
   ============================================================ */

const AdminPreferencesPage = {
    prefs: {},

    /* --------------------------------------------------------
       1. State initialization
       -------------------------------------------------------- */
    init() {
        const saved = localStorage.getItem('pulse_admin_preferences');
        this.prefs = saved ? JSON.parse(saved) : {
            notifNewSignups: true,
            notifNewReport: true,
            notifBroadcastDelivery: true,
            notifHazardAlerts: true,
            notifEmergency: true,
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
                        <div class="pref-group__title">Admin Notifications</div>
                        <div class="pref-item">
                            <div>
                                <div class="pref-item__label">New Citizen Signups</div>
                                <div class="pref-item__desc">Alert when a new citizen account needs review</div>
                            </div>
                            <div class="toggle ${p.notifNewSignups ? 'active' : ''}" onclick="AdminPreferencesPage.toggle('notifNewSignups', this)"><div class="toggle__knob"></div></div>
                        </div>
                        <div class="pref-item">
                            <div>
                                <div class="pref-item__label">New Incident Reports</div>
                                <div class="pref-item__desc">Alert when a citizen files a new incident report</div>
                            </div>
                            <div class="toggle ${p.notifNewReport ? 'active' : ''}" onclick="AdminPreferencesPage.toggle('notifNewReport', this)"><div class="toggle__knob"></div></div>
                        </div>
                        <div class="pref-item">
                            <div>
                                <div class="pref-item__label">Hazard Broadcast Delivery</div>
                                <div class="pref-item__desc">Receive SMS delivery reports after broadcasting</div>
                            </div>
                            <div class="toggle ${p.notifBroadcastDelivery ? 'active' : ''}" onclick="AdminPreferencesPage.toggle('notifBroadcastDelivery', this)"><div class="toggle__knob"></div></div>
                        </div>
                    </div>
                    <div class="pref-group">
                        <div class="pref-group__title">General</div>
                        <div class="pref-item">
                            <div>
                                <div class="pref-item__label">Hazard Alerts</div>
                                <div class="pref-item__desc">Receive alerts for new hazard zones</div>
                            </div>
                            <div class="toggle ${p.notifHazardAlerts ? 'active' : ''}" onclick="AdminPreferencesPage.toggle('notifHazardAlerts', this)"><div class="toggle__knob"></div></div>
                        </div>
                        <div class="pref-item">
                            <div>
                                <div class="pref-item__label">Emergency Broadcasts</div>
                                <div class="pref-item__desc">Critical emergency alerts for your area</div>
                            </div>
                            <div class="toggle ${p.notifEmergency ? 'active' : ''}" onclick="AdminPreferencesPage.toggle('notifEmergency', this)"><div class="toggle__knob"></div></div>
                        </div>
                    </div>
                </div>
                <button class="btn btn--primary btn--block mt-lg" onclick="AdminPreferencesPage.save()">Save Preferences</button>
            </div>
        `;
    },

    /* --------------------------------------------------------
       3. Toggle / Save
       -------------------------------------------------------- */
    toggle(key, el) {
        this.prefs[key] = !this.prefs[key];
        el.classList.toggle('active');
    },

    save() {
        localStorage.setItem('pulse_admin_preferences', JSON.stringify(this.prefs));
        alert('Preferences saved!');
        history.back();
    },
};
