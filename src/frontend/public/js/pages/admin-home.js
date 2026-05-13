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
                        Hazard Alerts
                    </div>
                    <a href="#/dashboard" class="text-sm" style="color: var(--color-primary); font-weight: 600;"
                       onclick="event.preventDefault(); window.location.hash='#/dashboard'; setTimeout(() => { if (window.AdminDashboardPage) AdminDashboardPage.setMainTab && document.querySelector('.dash-main-tab[onclick*=hazards]')?.click(); }, 100);">View on Dashboard</a>
                </div>

                <button type="button" class="btn btn--primary btn--block mb-md"
                        onclick="AdminHomePage.openCreateHazardModal()" style="display:flex;align-items:center;justify-content:center;gap:8px;">
                    <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Confirm New Hazard
                </button>

                <div class="section-hint" style="font-size: var(--font-size-xs); color: var(--color-gray-500); padding: var(--spacing-sm) var(--spacing-md); background: var(--color-gray-50); border-radius: var(--radius-md); margin-bottom: var(--spacing-md);">
                    <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:middle;margin-right:4px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    Confirmed hazards are broadcast via SMS + push and listed in the Dashboard's Hazards tab.
                </div>

                <!-- A-3: mirror the citizen-home community newsfeed so admins
                     see the same 3 latest posts on their landing page. -->
                <div class="section-header mt-lg newsfeed-section">
                    <div class="section-header__title">
                        <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        Community
                    </div>
                    <a href="#/news-updates" class="text-sm" style="color:var(--color-primary);font-weight:600;"
                       onclick="event.preventDefault(); Router.navigate('news-updates')">See all</a>
                </div>
                <div id="home-newsfeed">
                    <div class="loading-state">Loading posts...</div>
                </div>

            </div>
        `;
    },

    openPendingTab() {
        window.location.hash = '#/dashboard?filter=pending';
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
    /**
     * Opens the modal pre-filled with an existing hazard so the admin can
     * correct typos / update details. Submits a PUT (no SMS rebroadcast).
     */
    async openEditHazardModal(hazardId) {
        try {
            const list = (this._cachedHazards && this._cachedHazards.length)
                ? this._cachedHazards
                : (await Store.apiFetch('/api/hazards')).data || [];
            const hazard = list.find(h => Number(h.id) === Number(hazardId));
            if (!hazard) {
                if (window.Toast) Toast.show('Hazard not found.', { type: 'error' });
                return;
            }
            this.openCreateHazardModal(hazard);
        } catch (err) {
            if (window.Toast) Toast.show('Failed to open hazard for editing.', { type: 'error' });
        }
    },

    openCreateHazardModal(prefill) {
        this.closeCreateHazardModal();
        this._editingHazardId = (prefill && prefill.id) || null;
        const isEdit = !!this._editingHazardId;

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
                        <h3 class="modal__title" style="margin-bottom: 2px;">${isEdit ? 'Edit Alert / Announcement' : 'Confirm Alert / Announcement'}</h3>
                        <div style="font-size: var(--font-size-xs); color: var(--color-gray-500);">
                            ${isEdit
                                ? 'Editing this alert updates the saved record only — no new SMS or push notifications are sent.'
                                : 'On confirm, the selected audience gets an SMS + push notification with your details and (for hazards) safety tips.'}
                        </div>
                    </div>
                    <button type="button" class="modal__close" onclick="AdminHomePage.closeCreateHazardModal()" aria-label="Close">
                        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <form id="create-hazard-form" onsubmit="event.preventDefault(); AdminHomePage.submitHazard(event)"
                      style="padding: var(--spacing-lg); overflow-y: auto; flex: 1;">

                    <div class="input-group">
                        <label class="input-group__label">Category <span style="color:var(--color-danger)">*</span></label>
                        <div class="category-chips" id="ch-category-chips">
                            <button type="button" class="category-chip selected" data-category="hazard" onclick="AdminHomePage._selectCategory('hazard', this)">Hazard</button>
                            <button type="button" class="category-chip" data-category="announcement" onclick="AdminHomePage._selectCategory('announcement', this)">Announcement</button>
                        </div>
                        <div class="input-group__hint">Hazard = localized safety alert (flood/fire/etc). Announcement = wider advisory (e.g. class suspension).</div>
                    </div>

                    <div class="input-group">
                        <label class="input-group__label" for="ch-title">Title <span style="color:var(--color-danger)">*</span></label>
                        <input class="input-group__field" type="text" id="ch-title" required
                               placeholder="e.g. Flood Warning, Fire Alert, Class Suspension">
                        <div class="input-group__hint">For hazards, use a clear type keyword (Flood / Fire / Landslide / Typhoon / Earthquake) so the SMS includes the right safety tips.</div>
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
                                  placeholder="Details about the hazard / announcement (water level, affected areas, suspended classes, etc.)"></textarea>
                    </div>

                    <div class="input-group">
                        <label class="input-group__label">Audience <span style="color:var(--color-danger)">*</span></label>
                        <div class="category-chips" id="ch-audience-chips">
                            <button type="button" class="category-chip selected" data-audience="all" onclick="AdminHomePage._selectAudience('all', this)">Everyone</button>
                            <button type="button" class="category-chip" data-audience="barangay" onclick="AdminHomePage._selectAudience('barangay', this)">Specific barangay(s)</button>
                        </div>
                        <div id="ch-barangay-list" style="display:none; margin-top: var(--spacing-sm); padding: var(--spacing-sm); border: 1px solid var(--color-gray-200); border-radius: 8px;">
                            <!-- populated in openCreateHazardModal() -->
                        </div>
                        <div class="input-group__hint">"Everyone" targets all citizens. "Specific barangay(s)" only notifies residents (and pre-login devices tagged) in the chosen barangays.</div>
                    </div>

                    <div class="input-group">
                        <label style="display:flex; align-items:center; gap: var(--spacing-sm); cursor: pointer;">
                            <input type="checkbox" id="ch-sound" checked>
                            <span>Play alert sound on user's phone</span>
                        </label>
                        <div class="input-group__hint">Recommended for hazards and urgent announcements. Uses the device's default notification sound.</div>
                    </div>
                </form>

                <div style="padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg); border-top: 1px solid var(--color-gray-100); display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);">
                    <button type="button" class="btn btn--outline" onclick="AdminHomePage.closeCreateHazardModal()">Cancel</button>
                    <button type="submit" form="create-hazard-form" class="btn btn--primary" id="ch-submit">${isEdit ? 'Save Changes' : 'Confirm & Broadcast'}</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        this._selectedSeverity = (prefill && prefill.severity) || 'medium';
        this._selectedCategory = (prefill && prefill.category) || 'hazard';
        this._selectedAudience = (prefill && prefill.audience_type) || 'all';

        // Populate the per-barangay checklist from the canonical list.
        const list = document.getElementById('ch-barangay-list');
        const barangays = (window.MorongBarangays || []);
        if (list && barangays.length) {
            list.innerHTML = barangays.map(b => `
                <label style="display:flex; align-items:center; gap:8px; padding: 4px 0; font-size: var(--font-size-sm); cursor: pointer;">
                    <input type="checkbox" class="ch-barangay-check" value="${b}">
                    <span>${b}</span>
                </label>
            `).join('');
        }

        this._chEscHandler = (e) => { if (e.key === 'Escape') AdminHomePage.closeCreateHazardModal(); };
        document.addEventListener('keydown', this._chEscHandler);

        // Sync chip selection state to whatever was selected/prefilled
        const setChip = (containerId, attr, value) => {
            document.querySelectorAll(`#${containerId} .category-chip`).forEach(c => {
                c.classList.toggle('selected', c.getAttribute(attr) === value);
            });
        };
        setChip('ch-category-chips', 'data-category', this._selectedCategory);
        setChip('ch-severity-chips', 'data-severity', this._selectedSeverity);
        setChip('ch-audience-chips', 'data-audience', this._selectedAudience);

        // Prefill the rest of the form when editing
        if (prefill) {
            const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
            set('ch-title', prefill.title);
            set('ch-location', prefill.location || '');
            set('ch-desc', prefill.description || '');
            set('ch-lat', prefill.latitude != null ? prefill.latitude : '');
            set('ch-lng', prefill.longitude != null ? prefill.longitude : '');
            const sound = document.getElementById('ch-sound');
            if (sound) sound.checked = prefill.sound_enabled === undefined ? true : !!prefill.sound_enabled;
            if (this._selectedAudience === 'barangay') {
                const blist = document.getElementById('ch-barangay-list');
                if (blist) blist.style.display = '';
                let chosen = [];
                try {
                    chosen = typeof prefill.audience_barangays === 'string'
                        ? JSON.parse(prefill.audience_barangays || '[]')
                        : (prefill.audience_barangays || []);
                } catch (_) { chosen = []; }
                const set2 = new Set(chosen);
                document.querySelectorAll('.ch-barangay-check').forEach(cb => { cb.checked = set2.has(cb.value); });
            }
        }

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

    _selectCategory(value, el) {
        this._selectedCategory = value;
        document.querySelectorAll('#ch-category-chips .category-chip').forEach(c => c.classList.remove('selected'));
        if (el) el.classList.add('selected');
    },

    _selectAudience(value, el) {
        this._selectedAudience = value;
        document.querySelectorAll('#ch-audience-chips .category-chip').forEach(c => c.classList.remove('selected'));
        if (el) el.classList.add('selected');
        const list = document.getElementById('ch-barangay-list');
        if (list) list.style.display = value === 'barangay' ? 'block' : 'none';
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
            async (pos) => {
                document.getElementById('ch-lat').value = pos.coords.latitude.toFixed(6);
                document.getElementById('ch-lng').value = pos.coords.longitude.toFixed(6);

                // Best-effort: auto-fill the Location text field from a
                // public Nominatim reverse-geocode call (client-side).
                // Skip silently if anything fails — admin can still type.
                const locEl = document.getElementById('ch-location');
                if (locEl && !locEl.value.trim()) {
                    try {
                        const url = 'https://nominatim.openstreetmap.org/reverse'
                            + `?format=jsonv2&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
                            + '&zoom=17&addressdetails=1&accept-language=en';
                        const res = await fetch(url, {
                            headers: { 'Accept': 'application/json' }
                        });
                        if (res.ok) {
                            const data = await res.json();
                            const a = data.address || {};
                            const barangay = a.suburb || a.neighbourhood || a.village || a.hamlet || a.quarter;
                            const city = a.town || a.city || a.municipality || a.county;
                            const state = a.state || a.region;
                            const parts = [barangay, city, state].filter(Boolean);
                            if (parts.length) locEl.value = parts.join(', ');
                        }
                    } catch (_) { /* best-effort */ }
                }

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

        if (!title) { toast('Title is required.'); return; }

        const category = this._selectedCategory || 'hazard';
        const audience_type = this._selectedAudience || 'all';
        const sound_enabled = !!(document.getElementById('ch-sound') || {}).checked;

        let audience_barangays = [];
        if (audience_type === 'barangay') {
            audience_barangays = Array.from(document.querySelectorAll('.ch-barangay-check'))
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            if (audience_barangays.length === 0) {
                toast('Select at least one barangay, or switch audience to "Everyone".');
                return;
            }
        }

        // Validate coordinates: both must be present together (or both empty)
        const body = {
            title, severity,
            location: location || undefined,
            description: description || undefined,
            category,
            audience_type,
            audience_barangays: audience_type === 'barangay' ? audience_barangays : undefined,
            sound_enabled,
        };
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

        const isEdit = !!this._editingHazardId;
        const btn = document.getElementById('ch-submit');
        const defaultLabel = isEdit ? 'Save Changes' : 'Confirm & Broadcast';
        const busyLabel = isEdit ? 'Saving...' : 'Broadcasting...';
        if (btn) { btn.disabled = true; btn.textContent = busyLabel; }

        try {
            const url = isEdit ? `/api/hazards/${this._editingHazardId}` : '/api/hazards';
            const res = await Store.apiFetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                body: JSON.stringify(body),
            });

            if (btn) { btn.disabled = false; btn.textContent = defaultLabel; }

            if (!res.success) {
                toast(res.message || (isEdit ? "Couldn't save changes. Please try again." : "Couldn't confirm the hazard. Please try again."));
                return;
            }

            this.closeCreateHazardModal();
            if (isEdit) {
                toast('Changes saved. (No new SMS or push was sent.)', 'success');
            } else {
                const label = category === 'announcement' ? 'Announcement' : 'Hazard';
                const scope = audience_type === 'barangay'
                    ? `${audience_barangays.length} barangay(s)`
                    : 'all citizens';
                toast(`${label} confirmed. SMS + push dispatched to ${scope}.`, 'success');
            }
            // Reload hazard list + stats
            this.loadData();
        } catch (err) {
            if (btn) { btn.disabled = false; btn.textContent = defaultLabel; }
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
        // Hazard list no longer rendered on admin home (#9) — admin sees them
        // on the Dashboard's Hazards tab instead. We still pre-load the cache
        // here so openEditHazardModal can resolve a hazard by id without an
        // extra round trip when triggered from elsewhere.
        try {
            const hazardsRes = await Store.apiFetch('/api/hazards');
            if (hazardsRes.success) this._cachedHazards = hazardsRes.data;
        } catch (err) {
            console.error('Failed to load hazards cache:', err);
        }

        // A-3: load the same 3 latest community posts the citizens see.
        this._loadNewsfeed();
    },

    /**
     * Mirrors CitizenHomePage._loadNewsfeed — fetched independently so a
     * posts outage doesn't block the rest of the admin dashboard. Reuses
     * CitizenHomePage.renderNewsfeedCard so the card style stays in sync.
     */
    async _loadNewsfeed() {
        const container = document.getElementById('home-newsfeed');
        if (!container) return;
        try {
            const res = await Store.apiFetch('/api/posts?limit=3');
            if (!res.success || !Array.isArray(res.data) || res.data.length === 0) {
                container.innerHTML = '<div class="empty-state">No community posts yet.</div>';
                return;
            }
            // Top-level `const CitizenHomePage` from a classic script lives in
            // the script-record lexical env, NOT on window — so the bare name
            // resolves but `window.CitizenHomePage` is always undefined. Same
            // quirk fixed earlier for PhoneFormat/Store/Toast.
            const renderer = (typeof CitizenHomePage !== 'undefined' && CitizenHomePage.renderNewsfeedCard)
                ? CitizenHomePage.renderNewsfeedCard.bind(CitizenHomePage)
                : null;
            if (!renderer) {
                container.innerHTML = '<div class="empty-state">Newsfeed unavailable.</div>';
                return;
            }
            container.innerHTML = res.data.slice(0, 3).map(p => renderer(p)).join('');
        } catch (err) {
            container.innerHTML = '<div class="empty-state">Unable to load posts.</div>';
        }
    }
};
