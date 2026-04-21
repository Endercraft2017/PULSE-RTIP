/* ============================================================
   Admin Home Page
   ============================================================
   Reference: index5.html (Figma export)
   Admin welcome page with active hazard alerts and statistics.
   Table of Contents:
   1. Render method
   2. Data loading
   3. Helper methods
   ============================================================ */

const AdminHomePage = {
    render() {
        const user = Store.get('user');
        const userName = user ? user.name : 'MDRRMO Admin';

        setTimeout(() => this.loadData(), 0);

        return `
            <div class="page-padding">
                <div class="welcome-card">
                    <div class="welcome-card__title">Welcome, ${userName}!</div>
                    <div class="welcome-card__text">
                        Manage and respond to incident reports from the community.
                    </div>
                </div>

                ${this.renderAppDownload()}

                <div class="section-header">
                    <div class="section-header__title">
                        <svg viewBox="0 0 24 24">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        Active Hazard Alerts
                    </div>
                    <a href="#/hazards" class="text-sm" style="color: var(--color-primary); font-weight: 600;">View all</a>
                </div>

                <button type="button" class="btn btn--primary btn--block mb-md"
                        onclick="AdminHomePage.openCreateHazardModal()" style="display:flex;align-items:center;justify-content:center;gap:8px;">
                    <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Confirm New Hazard
                </button>

                <div id="hazard-alerts-list">
                    <div class="loading-state">Loading alerts...</div>
                </div>

                <div class="stats-grid mt-lg">
                    <div class="stat-card">
                        <div class="stat-card__icon stat-card__icon--pending">
                            <svg viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                        </div>
                        <div class="stat-card__number" id="stat-pending">--</div>
                        <div class="stat-card__label">Pending</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card__icon stat-card__icon--resolved">
                            <svg viewBox="0 0 24 24">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                        <div class="stat-card__number" id="stat-resolved">--</div>
                        <div class="stat-card__label">Resolved</div>
                    </div>
                </div>
            </div>
        `;
    },

    /* --------------------------------------------------------
       Confirm / Create Hazard Modal
       -------------------------------------------------------- */

    /**
     * Opens an in-page modal for the admin to confirm a new hazard.
     * On submit, POSTs to /api/hazards — the backend then broadcasts
     * the emergency SMS (with coordinates + safety tips) to every
     * registered user (citizens and admins).
     */
    openCreateHazardModal() {
        this.closeCreateHazardModal();

        const modal = document.createElement('div');
        modal.id = 'create-hazard-modal';
        modal.className = 'modal-overlay modal-overlay--centered';
        modal.onclick = (e) => {
            if (e.target === modal) AdminHomePage.closeCreateHazardModal();
        };

        modal.innerHTML = `
            <div class="modal" style="max-width: 480px; padding: 0; display: flex; flex-direction: column; max-height: 90dvh;">
                <div style="padding: var(--spacing-xl) var(--spacing-lg) var(--spacing-md); border-bottom: 1px solid var(--color-gray-100); display:flex; align-items: flex-start; justify-content: space-between; gap: var(--spacing-md);">
                    <div>
                        <h3 class="modal__title" style="margin-bottom: 2px;">Confirm Hazard Alert</h3>
                        <div style="font-size: var(--font-size-xs); color: var(--color-gray-500);">
                            Once you confirm, every registered user will receive an emergency SMS with your coordinates, description, and safety tips.
                        </div>
                    </div>
                    <button type="button" class="modal__close" onclick="AdminHomePage.closeCreateHazardModal()" aria-label="Close">
                        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <form id="create-hazard-form" onsubmit="event.preventDefault(); AdminHomePage.submitHazard(event)"
                      style="padding: var(--spacing-lg); overflow-y: auto; flex: 1;">

                    <div class="input-group">
                        <label class="input-group__label" for="ch-title">Hazard title <span style="color:var(--color-danger)">*</span></label>
                        <input class="input-group__field" type="text" id="ch-title" required
                               placeholder="e.g. Flood Warning, Fire Alert, Landslide Risk">
                        <div class="input-group__hint">Use a clear type keyword (Flood / Fire / Landslide / Typhoon / Earthquake) so the SMS includes the right safety tips.</div>
                    </div>

                    <div class="input-group">
                        <label class="input-group__label">Severity <span style="color:var(--color-danger)">*</span></label>
                        <div class="category-chips" id="ch-severity-chips">
                            <button type="button" class="category-chip" data-severity="low" onclick="AdminHomePage._selectSeverity('low', this)">Low</button>
                            <button type="button" class="category-chip selected" data-severity="medium" onclick="AdminHomePage._selectSeverity('medium', this)">Medium</button>
                            <button type="button" class="category-chip" data-severity="high" onclick="AdminHomePage._selectSeverity('high', this)">High</button>
                        </div>
                    </div>

                    <div class="input-group">
                        <label class="input-group__label" for="ch-location">Location (text)</label>
                        <input class="input-group__field" type="text" id="ch-location"
                               placeholder="e.g. Brgy. Lagundi, Morong, Rizal">
                    </div>

                    <div class="input-group">
                        <label class="input-group__label">GPS coordinates</label>
                        <div style="display:flex; gap: var(--spacing-sm);">
                            <input class="input-group__field" type="number" step="any" id="ch-lat"
                                   placeholder="Latitude"   style="flex:1;" min="-90" max="90">
                            <input class="input-group__field" type="number" step="any" id="ch-lng"
                                   placeholder="Longitude"  style="flex:1;" min="-180" max="180">
                        </div>
                        <button type="button" class="btn btn--outline btn--sm mt-sm"
                                onclick="AdminHomePage._useCurrentLocation(this)"
                                style="display:flex;align-items:center;gap:6px;">
                            <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            Use my current location
                        </button>
                        <div class="input-group__hint">Included in the SMS as GPS + a tap-to-open Google Maps link.</div>
                    </div>

                    <div class="input-group">
                        <label class="input-group__label" for="ch-desc">Description</label>
                        <textarea class="input-group__field" id="ch-desc" rows="3"
                                  placeholder="Details about the hazard (current water level, affected areas, etc.)"></textarea>
                    </div>
                </form>

                <div style="padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg); border-top: 1px solid var(--color-gray-100); display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);">
                    <button type="button" class="btn btn--outline" onclick="AdminHomePage.closeCreateHazardModal()">Cancel</button>
                    <button type="submit" form="create-hazard-form" class="btn btn--primary" id="ch-submit">Confirm & Broadcast</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        this._selectedSeverity = 'medium';

        this._chEscHandler = (e) => { if (e.key === 'Escape') AdminHomePage.closeCreateHazardModal(); };
        document.addEventListener('keydown', this._chEscHandler);

        setTimeout(() => { const t = document.getElementById('ch-title'); if (t) t.focus(); }, 100);
    },

    closeCreateHazardModal() {
        const modal = document.getElementById('create-hazard-modal');
        if (modal) modal.remove();
        document.body.style.overflow = '';
        if (this._chEscHandler) {
            document.removeEventListener('keydown', this._chEscHandler);
            this._chEscHandler = null;
        }
    },

    _selectSeverity(value, el) {
        this._selectedSeverity = value;
        document.querySelectorAll('#ch-severity-chips .category-chip').forEach(c => c.classList.remove('selected'));
        if (el) el.classList.add('selected');
    },

    _useCurrentLocation(btn) {
        if (!navigator.geolocation) {
            if (window.Toast) Toast.show('Your browser doesn\'t support GPS. Please enter coordinates manually.', { type: 'error' });
            else alert('Your browser doesn\'t support GPS. Please enter coordinates manually.');
            return;
        }
        const original = btn.textContent;
        btn.disabled = true;
        btn.innerHTML = 'Locating...';

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                document.getElementById('ch-lat').value = pos.coords.latitude.toFixed(6);
                document.getElementById('ch-lng').value = pos.coords.longitude.toFixed(6);
                btn.disabled = false;
                btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> Use my current location';
            },
            (err) => {
                btn.disabled = false;
                btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> Use my current location';
                const msg = err.code === err.PERMISSION_DENIED
                    ? 'Location permission denied. Enter coordinates manually, or allow location access in your browser.'
                    : 'Couldn\'t get your location. Enter coordinates manually.';
                if (window.Toast) Toast.show(msg, { type: 'error' });
                else alert(msg);
            },
            { timeout: 10000, enableHighAccuracy: true }
        );
    },

    async submitHazard() {
        const toast = (msg, type = 'error') => {
            if (window.Toast) Toast.show(msg, { type, duration: 5000 });
            else alert(msg);
        };

        const title = document.getElementById('ch-title').value.trim();
        const severity = this._selectedSeverity || 'medium';
        const location = document.getElementById('ch-location').value.trim();
        const description = document.getElementById('ch-desc').value.trim();
        const latRaw = document.getElementById('ch-lat').value.trim();
        const lngRaw = document.getElementById('ch-lng').value.trim();

        if (!title) { toast('Hazard title is required.'); return; }

        // Validate coordinates: both must be present together (or both empty)
        const body = { title, severity, location: location || undefined, description: description || undefined };
        if (latRaw || lngRaw) {
            const lat = parseFloat(latRaw);
            const lng = parseFloat(lngRaw);
            if (Number.isNaN(lat) || Number.isNaN(lng)) {
                toast('Both latitude and longitude must be numbers, or leave both empty.');
                return;
            }
            if (lat < -90 || lat > 90)   { toast('Latitude must be between -90 and 90.'); return; }
            if (lng < -180 || lng > 180) { toast('Longitude must be between -180 and 180.'); return; }
            body.latitude = lat;
            body.longitude = lng;
        }

        const btn = document.getElementById('ch-submit');
        if (btn) { btn.disabled = true; btn.textContent = 'Broadcasting...'; }

        try {
            const res = await Store.apiFetch('/api/hazards', {
                method: 'POST',
                body: JSON.stringify(body),
            });

            if (btn) { btn.disabled = false; btn.textContent = 'Confirm & Broadcast'; }

            if (!res.success) {
                toast(res.message || 'Couldn\'t confirm the hazard. Please try again.');
                return;
            }

            this.closeCreateHazardModal();
            toast('Hazard confirmed. SMS alert dispatched to all registered users.', 'success');
            // Reload hazard list + stats
            this.loadData();
        } catch (err) {
            if (btn) { btn.disabled = false; btn.textContent = 'Confirm & Broadcast'; }
            toast('Network error — please try again.');
        }
    },

    /**
     * Small "Get the mobile app" banner. Hidden inside the Capacitor APK.
     */
    renderAppDownload() {
        if (Store.get('isNativeApp')) return '';
        return `
            <a class="app-download-card" href="/downloads/" target="_blank" rel="noopener">
                <div class="app-download-card__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                        <line x1="12" y1="18" x2="12.01" y2="18"></line>
                    </svg>
                </div>
                <div class="app-download-card__content">
                    <div class="app-download-card__title">Get the Pulse 911 app</div>
                    <div class="app-download-card__desc">Faster access + offline SOS reporting</div>
                </div>
                <div class="app-download-card__cta">
                    Install
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>
            </a>
        `;
    },

    async loadData() {
        try {
            const [hazardsRes, statsRes] = await Promise.all([
                Store.apiFetch('/api/hazards'),
                Store.apiFetch('/api/dashboard/stats'),
            ]);

            if (hazardsRes.success) {
                CitizenHomePage.renderHazards(hazardsRes.data);
            }

            if (statsRes.success) {
                const pendingEl = document.getElementById('stat-pending');
                const resolvedEl = document.getElementById('stat-resolved');
                if (pendingEl) pendingEl.textContent = statsRes.data.pendingCount;
                if (resolvedEl) resolvedEl.textContent = statsRes.data.resolvedCount;
            }
        } catch (err) {
            console.error('Failed to load admin home data:', err);
        }
    }
};
