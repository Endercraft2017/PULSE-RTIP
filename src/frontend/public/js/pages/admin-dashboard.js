/* ============================================================
   Admin Dashboard Page (MDRRMO Dashboard)
   ============================================================
   Reference: reference/html-designs/Dashboard admin{1-6}
   Layout:
   1. Stats row (Pending / Investigating / Resolved / Hazards)
   2. Search bar
   3. Main tab strip (Incidents / Hazards / Reports)
   4. Sub-filter tabs (All / Pending / Investigating / Resolved)
   5. Content list with approval actions
   Table of Contents:
   1. State
   2. Render method
   3. Data loading
   4. Main tab rendering (Incidents / Hazards / Reports)
   5. Incident list + card rendering
   6. Hazards list rendering
   7. Reports list rendering
   8. Filter + search handling
   9. Approve / Reject actions
   10. Rejection modal
   11. Helper methods
   ============================================================ */

const AdminDashboardPage = {
    /* --------------------------------------------------------
     * 1. State
     * -------------------------------------------------------- */
    activeMainTab: 'incidents',
    activeFilter: 'all',
    incidents: [],
    hazards: [],
    binReports: [],
    binHazards: [],

    /* --------------------------------------------------------
     * 2. Render
     * -------------------------------------------------------- */
    render() {
        setTimeout(() => this.loadData(), 0);

        return `
            <div class="page-padding">
                <div class="dashboard-stats">
                    <div class="dashboard-stat dashboard-stat--clickable" onclick="AdminDashboardPage.setFilter('pending')" role="button" tabindex="0">
                        <span class="stat-card__notif-badge" id="dash-pending-badge" hidden>0</span>
                        <div class="dashboard-stat__label">Pending</div>
                        <div class="dashboard-stat__value" id="dash-pending" style="color: var(--color-warning);">--</div>
                    </div>
                    <div class="dashboard-stat">
                        <div class="dashboard-stat__label">Investigating</div>
                        <div class="dashboard-stat__value" id="dash-investigating" style="color: var(--color-info);">--</div>
                    </div>
                    <div class="dashboard-stat">
                        <div class="dashboard-stat__label">Resolved</div>
                        <div class="dashboard-stat__value" id="dash-resolved" style="color: var(--color-success);">--</div>
                    </div>
                    <div class="dashboard-stat">
                        <div class="dashboard-stat__label">Hazards</div>
                        <div class="dashboard-stat__value" id="dash-hazards" style="color: var(--color-danger);">--</div>
                    </div>
                </div>

                <div class="search-bar">
                    <svg viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input type="text" placeholder="Search incidents..." id="dashboard-search"
                           oninput="AdminDashboardPage.handleSearch(this.value)">
                </div>

                <!-- Main tab strip: Hazards / Reports / Incidents -->
                <div class="dash-main-tabs">
                    <button type="button" class="dash-main-tab ${this.activeMainTab === 'hazards' ? 'active' : ''}"
                            onclick="AdminDashboardPage.setMainTab('hazards')">
                        <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        Hazards
                    </button>
                    <button type="button" class="dash-main-tab ${this.activeMainTab === 'reports' ? 'active' : ''}"
                            onclick="AdminDashboardPage.setMainTab('reports')">
                        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        Reports
                    </button>
                    <button type="button" class="dash-main-tab ${this.activeMainTab === 'incidents' ? 'active' : ''}"
                            onclick="AdminDashboardPage.setMainTab('incidents')">
                        <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                        Incidents
                    </button>
                    <button type="button" class="dash-main-tab ${this.activeMainTab === 'sms' ? 'active' : ''}"
                            onclick="AdminDashboardPage.setMainTab('sms')">
                        <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        SMS
                    </button>
                    <button type="button" class="dash-main-tab ${this.activeMainTab === 'bin' ? 'active' : ''}"
                            onclick="AdminDashboardPage.setMainTab('bin')">
                        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path></svg>
                        Bin
                    </button>
                </div>

                <!-- Content area -->
                <div id="dashboard-content">
                    <div class="loading-state">Loading...</div>
                </div>
            </div>
        `;
    },

    _ensureRejectionContainer() {
        // Body-mount so the modal is never clipped by a parent transform/
        // overflow on app-content (same fix as the post-detail modal).
        let container = document.getElementById('rejection-modal');
        if (!container || container.parentElement !== document.body) {
            if (container) container.remove();
            container = document.createElement('div');
            container.id = 'rejection-modal';
            document.body.appendChild(container);
        }
        return container;
    },

    /* --------------------------------------------------------
     * 3. Data Loading
     * -------------------------------------------------------- */
    async loadData() {
        try {
            const [statsRes, reportsRes, hazardsRes] = await Promise.all([
                Store.apiFetch('/api/dashboard/stats'),
                Store.apiFetch('/api/reports'),
                Store.apiFetch('/api/hazards'),
            ]);

            if (statsRes.success) {
                const s = statsRes.data;
                const el = (id) => document.getElementById(id);
                const pendingCount = Number(s.pendingCount) || 0;
                if (el('dash-pending')) el('dash-pending').textContent = pendingCount;
                if (el('dash-investigating')) el('dash-investigating').textContent = s.investigatingCount;
                if (el('dash-resolved')) el('dash-resolved').textContent = s.resolvedCount;
                if (el('dash-hazards')) el('dash-hazards').textContent = s.hazardsCount;
                const badge = el('dash-pending-badge');
                if (badge) {
                    if (pendingCount > 0) {
                        badge.textContent = pendingCount > 99 ? '99+' : pendingCount;
                        badge.hidden = false;
                    } else {
                        badge.hidden = true;
                    }
                }
            }

            if (reportsRes.success) this.incidents = reportsRes.data;
            if (hazardsRes.success) this.hazards = hazardsRes.data;

            // Honor #/dashboard?filter=<name> and ?focus=<id>
            const params = this._readQueryParams();
            const focusId = parseInt(params.get('focus'), 10);
            const filter = params.get('filter');
            if (focusId || filter) {
                this.activeMainTab = 'incidents';
                if (filter) {
                    this.activeFilter = filter;
                } else if (focusId) {
                    this.activeFilter = 'all';
                }
            }

            this.renderContent();

            if (Number.isFinite(focusId)) setTimeout(() => this._focusCard(focusId), 60);
            if (filter) this._clearQueryParams();
        } catch (err) {
            console.error('Failed to load dashboard data:', err);
        }
    },

    _readFocusParam() {
        const v = parseInt(this._readQueryParams().get('focus'), 10);
        return Number.isFinite(v) ? v : null;
    },

    _readQueryParams() {
        const hash = window.location.hash || '';
        const qIdx = hash.indexOf('?');
        return new URLSearchParams(qIdx === -1 ? '' : hash.slice(qIdx + 1));
    },

    _clearQueryParams() {
        const hash = window.location.hash || '';
        const cleaned = hash.split('?')[0];
        if (cleaned !== hash) history.replaceState(null, '', cleaned);
    },

    _focusCard(id) {
        const el = document.getElementById('incident-' + id);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('incident-card--highlight');
        setTimeout(() => el.classList.remove('incident-card--highlight'), 3000);
        // Clean the focus param so refresh doesn't re-trigger
        const hash = window.location.hash || '';
        const cleaned = hash.split('?')[0];
        if (cleaned !== hash) {
            history.replaceState(null, '', cleaned);
        }
    },

    /* --------------------------------------------------------
     * 4. Main Tab Rendering
     * -------------------------------------------------------- */
    setMainTab(tab, ev) {
        this.activeMainTab = tab;
        document.querySelectorAll('.dash-main-tab').forEach(t => t.classList.remove('active'));
        // Prefer the explicitly-passed event; fall back to global; final
        // fallback is the matching button in the DOM.
        const e = ev || (typeof event !== 'undefined' ? event : null);
        const btn = (e && e.currentTarget) || document.querySelector(`.dash-main-tab[data-tab="${tab}"]`);
        if (btn) btn.classList.add('active');
        this.renderContent();
    },

    renderContent() {
        const container = document.getElementById('dashboard-content');
        if (!container) return;

        switch (this.activeMainTab) {
            case 'incidents':
                container.innerHTML = this.renderIncidentsView();
                break;
            case 'hazards':
                container.innerHTML = this.renderHazardsView();
                break;
            case 'reports':
                container.innerHTML = this.renderReportsView();
                break;
            case 'sms':
                container.innerHTML = '<div class="loading-state">Loading SMS reports...</div>';
                this.loadSmsReports();
                break;
            case 'bin':
                container.innerHTML = '<div class="loading-state">Loading bin...</div>';
                this.loadBin();
                break;
        }
    },

    /* --------------------------------------------------------
     * 5. Incidents View (with sub-filter tabs)
     * -------------------------------------------------------- */
    renderIncidentsView(searchTerm) {
        const submittedLikeAll = ['submitted', 'pending'];
        const pendingCount = this.incidents.filter(i => submittedLikeAll.includes(i.status)).length;
        const pendingConfCount = this.incidents.filter(i => i.status === 'pending_confirmation').length;
        const filterRow = `
            <div class="section-header">
                <div class="section-header__title">Incidents</div>
            </div>
            <div class="dashboard-subtabs dashboard-subtabs--scroll" id="dashboard-tabs">
                <button class="dashboard-subtabs__tab ${this.activeFilter === 'all' ? 'active' : ''}"
                        onclick="AdminDashboardPage.setFilter('all')">All</button>
                <button class="dashboard-subtabs__tab ${this.activeFilter === 'pending' ? 'active' : ''}"
                        onclick="AdminDashboardPage.setFilter('pending')">Pending${pendingCount > 0 ? ` <span class="dashboard-subtabs__count">${pendingCount}</span>` : ''}</button>
                <button class="dashboard-subtabs__tab ${this.activeFilter === 'investigating' ? 'active' : ''}"
                        onclick="AdminDashboardPage.setFilter('investigating')">Investigating</button>
                <button class="dashboard-subtabs__tab ${this.activeFilter === 'in_progress' ? 'active' : ''}"
                        onclick="AdminDashboardPage.setFilter('in_progress')">In Progress</button>
                <button class="dashboard-subtabs__tab ${this.activeFilter === 'pending_confirmation' ? 'active' : ''}"
                        onclick="AdminDashboardPage.setFilter('pending_confirmation')">Pending Confirmation</button>
                <button class="dashboard-subtabs__tab ${this.activeFilter === 'resolved' ? 'active' : ''}"
                        onclick="AdminDashboardPage.setFilter('resolved')">Resolved</button>
                <button class="dashboard-subtabs__tab ${this.activeFilter === 'rejected' ? 'active' : ''}"
                        onclick="AdminDashboardPage.setFilter('rejected')">Rejected</button>
                <button class="dashboard-subtabs__tab ${this.activeFilter === 'cancelled' ? 'active' : ''}"
                        onclick="AdminDashboardPage.setFilter('cancelled')">Cancelled</button>
            </div>
        `;

        const submittedLike = ['submitted', 'pending'];
        // The "Investigating" tab mirrors the dashboard's Investigating stat
        // tile, which sums the whole active-work band (investigating +
        // in_progress + pending_confirmation) — see Report.getStats. Without
        // this, admins saw e.g. "Investigating: 3" on the tile but an empty
        // tab when all three were actually in_progress. The dedicated
        // In Progress / Pending Confirmation tabs still drill down strictly.
        const investigatingBand = ['investigating', 'in_progress', 'pending_confirmation'];
        let filtered;
        if (this.activeFilter === 'all') {
            filtered = this.incidents;
        } else if (this.activeFilter === 'pending') {
            filtered = this.incidents.filter(i => submittedLike.includes(i.status));
        } else if (this.activeFilter === 'investigating') {
            filtered = this.incidents.filter(i => investigatingBand.includes(i.status));
        } else {
            filtered = this.incidents.filter(i => i.status === this.activeFilter);
        }

        if (searchTerm || this._searchTerm) {
            const term = (searchTerm || this._searchTerm).toLowerCase();
            filtered = filtered.filter(i =>
                i.title.toLowerCase().includes(term) ||
                i.type.toLowerCase().includes(term) ||
                (i.location && i.location.toLowerCase().includes(term))
            );
        }

        if (filtered.length === 0) {
            return filterRow + '<div class="empty-state">No incidents found.</div>';
        }

        return filterRow + filtered.map(i => this.renderIncidentCard(i)).join('');
    },

    renderIncidentCard(incident) {
        const terminal = ['resolved', 'rejected', 'cancelled'];
        const showActions = !terminal.includes(incident.status);
        const isTerminal = terminal.includes(incident.status);
        // A-6: serialise once and reuse for both the card-level click and the
        // inline "Details" button — keeps payloads in sync.
        const incidentAttr = this._escAttr(JSON.stringify(incident));

        return `
            <div class="incident-card incident-card--clickable" id="incident-${incident.id}"
                 onclick="DetailModal.showIncident(${incidentAttr})">
                <div class="incident-card__header">
                    <span class="incident-card__title">${incident.title}</span>
                    <span class="badge badge--${incident.status}">${this.statusLabel(incident.status)}</span>
                </div>
                <span class="badge badge--type" style="margin-bottom: 8px; display: inline-flex;">${incident.type}</span>

                ${incident.description ? '<div class="incident-card__description">' + incident.description + '</div>' : ''}

                <div class="incident-card__submitter">
                    <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    Reported by ${incident.submitted_by_name || 'Unknown'}
                </div>

                <div class="card__meta">
                    <div class="card__meta-item">
                        <svg viewBox="0 0 24 24">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        ${incident.location || 'Unknown location'}
                    </div>
                    <div class="card__meta-item">
                        <svg viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        ${this.timeAgo(incident.created_at)}
                    </div>
                </div>

                <div class="incident-card__footer" onclick="event.stopPropagation()">
                    <button type="button" class="btn btn--outline btn--sm" onclick="event.stopPropagation(); AdminDashboardPage.promoteToPost(${incident.id})">
                        Promote to Post
                    </button>
                    <button type="button" class="incident-card__details-link" onclick="event.stopPropagation(); DetailModal.showIncident(${incidentAttr})">
                        Details
                        <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>

                ${showActions ? this._renderStatusActions(incident) : ''}
                ${isTerminal ? `
                <div class="incident-card__actions" onclick="event.stopPropagation()">
                    <button type="button" class="btn btn--reject btn--sm" onclick="event.stopPropagation(); AdminDashboardPage.confirmDeleteIncident(${incident.id})">Delete</button>
                </div>
                ` : ''}
            </div>
        `;
    },

    _renderStatusActions(incident) {
        const s = incident.status;
        const transitions = {
            submitted: ['investigating', 'rejected'],
            pending: ['investigating', 'rejected'],
            investigating: ['in_progress', 'rejected'],
            in_progress: ['pending_confirmation'],
            pending_confirmation: ['resolved', 'in_progress'],
        };
        const options = transitions[s] || [];
        const meta = {
            investigating: { label: 'Investigate', cls: 'btn--info' },
            in_progress: { label: 'Mark In Progress', cls: 'btn--primary' },
            pending_confirmation: { label: 'Await Confirmation', cls: 'btn--warning' },
            resolved: { label: 'Resolve', cls: 'btn--approve' },
            rejected: { label: 'Reject', cls: 'btn--reject' },
        };

        const buttons = options.map(opt => {
            const m = meta[opt];
            if (opt === 'rejected') {
                return `<button type="button" class="btn ${m.cls}" onclick="event.stopPropagation(); AdminDashboardPage.showRejectModal(${incident.id})">${m.label}</button>`;
            }
            return `<button type="button" class="btn ${m.cls}" onclick="event.stopPropagation(); AdminDashboardPage.requestStatusChange(${incident.id}, '${opt}')">${m.label}</button>`;
        }).join('');

        // A-6: actions row swallows clicks so card-level click handler
        // doesn't re-open the detail modal when an admin taps an action.
        return `<div class="incident-card__actions" onclick="event.stopPropagation()">${buttons}</div>`;
    },

    /* --------------------------------------------------------
     * 6. Hazards View
     * -------------------------------------------------------- */
    renderHazardsView() {
        const header = `
            <div class="section-header">
                <div class="section-header__title">Active Hazard Zones</div>
            </div>
        `;

        if (this.hazards.length === 0) {
            return header + '<div class="empty-state">No active hazards.</div>';
        }

        const severityBadge = {
            high: '<span class="badge badge--high">High</span>',
            medium: '<span class="badge badge--warning">Medium</span>',
            low: '<span class="badge badge--info">Low</span>',
        };

        const cards = this.hazards.map(h => {
            const hAttr = this._escAttr(JSON.stringify(h));
            return `
            <div class="incident-card incident-card--clickable" onclick="DetailModal.showHazard(${hAttr})">
                <div class="incident-card__header">
                    <span class="incident-card__title">${h.title}</span>
                    ${severityBadge[h.severity] || ''}
                </div>
                <div class="incident-card__location">${h.location || ''}</div>
                <div class="incident-card__description">${h.description || ''}</div>
                <div class="incident-card__footer" onclick="event.stopPropagation()">
                    <span>Updated ${this.formatDate(h.updated_at)}</span>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <button type="button" class="btn btn--reject btn--sm" onclick="event.stopPropagation(); AdminDashboardPage.confirmDeleteHazard(${h.id})">Delete</button>
                        <button type="button" class="incident-card__details-link" onclick="event.stopPropagation(); DetailModal.showHazard(${hAttr})">
                            Details
                            <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;}).join('');

        return header + cards;
    },

    /* --------------------------------------------------------
     * 7. Reports View (summary by status)
     * -------------------------------------------------------- */
    renderReportsView() {
        const header = `
            <div class="section-header">
                <div class="section-header__title">All Reports</div>
            </div>
        `;

        if (this.incidents.length === 0) {
            return header + '<div class="empty-state">No reports found.</div>';
        }

        const sorted = [...this.incidents].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

        const cards = sorted.map(r => {
            const rAttr = this._escAttr(JSON.stringify(r));
            return `
            <div class="incident-card incident-card--clickable" onclick="DetailModal.showIncident(${rAttr})">
                <div class="incident-card__header">
                    <span class="incident-card__title">${r.title}</span>
                    <span class="badge badge--${r.status}">${this.statusLabel(r.status)}</span>
                </div>
                <span class="badge badge--type" style="margin-bottom: 6px; display: inline-flex;">${r.type}</span>
                <div class="incident-card__submitter">
                    <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    ${r.submitted_by_name || 'Unknown'}
                </div>
                <div class="card__meta">
                    <div class="card__meta-item">
                        <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        ${r.location || 'Unknown'}
                    </div>
                    <div class="card__meta-item">
                        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        ${this.timeAgo(r.created_at)}
                    </div>
                </div>
                <div class="incident-card__footer" onclick="event.stopPropagation()">
                    <button type="button" class="btn btn--outline btn--sm" onclick="event.stopPropagation(); AdminDashboardPage.promoteToPost(${r.id})">
                        Promote to Post
                    </button>
                    <button type="button" class="incident-card__details-link" onclick="event.stopPropagation(); DetailModal.showIncident(${rAttr})">
                        Details
                        <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>
            </div>
        `;}).join('');

        return header + cards;
    },

    /* --------------------------------------------------------
     * 8. Filter + Search Handling
     * -------------------------------------------------------- */
    setFilter(filter) {
        this.activeFilter = filter;
        // The active class is rebuilt on the next renderContent() pass via
        // the template literal's `${this.activeFilter === '...' ? 'active' : ''}`
        // checks — no need to read from a global event here.
        this.renderContent();
    },

    handleSearch(value) {
        this._searchTerm = value;
        this.renderContent();
    },

    /* --------------------------------------------------------
     * 9. Approve / Reject Actions
     * -------------------------------------------------------- */

    /**
     * Entry point used by the per-card buttons. For non-trivial
     * transitions (especially `resolved`) we open the note modal so the
     * admin can record who responded and how it was handled — that note
     * becomes part of the report_event row the citizen sees in their
     * Processing History. Pass-through transitions (investigating,
     * in_progress, pending_confirmation) still allow an optional note.
     */
    requestStatusChange(id, status) {
        const promptMap = {
            investigating: { title: 'Mark as Investigating', placeholder: 'Optional: who is responding, ETA, etc.', required: false },
            in_progress: { title: 'Mark as In Progress', placeholder: 'Optional: team dispatched, actions in motion.', required: false },
            pending_confirmation: { title: 'Await Citizen Confirmation', placeholder: 'Optional: what was done, what to confirm.', required: false },
            resolved: { title: 'Resolve Report', placeholder: 'Required: who responded and how it was resolved (this is shown to the citizen).', required: true },
        };
        const cfg = promptMap[status];
        if (!cfg) {
            return this.changeStatus(id, status, '');
        }
        this.showStatusNoteModal(id, status, cfg);
    },

    showStatusNoteModal(id, status, cfg) {
        const incident = this.incidents.find(i => i.id === id);
        const title = incident ? incident.title : 'Report #' + id;
        this._ensureRejectionContainer().innerHTML = `
            <div class="modal-overlay modal-overlay--centered" onclick="if(event.target===this) AdminDashboardPage.closeRejectModal()">
                <div class="modal">
                    <div class="modal__title">${cfg.title}</div>
                    <div class="modal__desc">"${title}"</div>
                    <div class="form-group">
                        <div class="form-group__label">Resolution Note ${cfg.required ? '<span class="form-group__required">*</span>' : '<span style="color:var(--color-gray-400);font-weight:400;">(optional)</span>'}</div>
                        <textarea class="form-input" id="status-note" placeholder="${cfg.placeholder}" style="min-height:90px;"></textarea>
                    </div>
                    <div class="modal__actions">
                        <button type="button" class="btn btn--outline" onclick="AdminDashboardPage.closeRejectModal()">Cancel</button>
                        <button type="button" class="btn btn--primary" onclick="AdminDashboardPage.submitStatusNote(${id}, '${status}', ${cfg.required ? 'true' : 'false'})">Confirm</button>
                    </div>
                </div>
            </div>
        `;
        setTimeout(() => { const t = document.getElementById('status-note'); if (t) t.focus(); }, 50);
    },

    async submitStatusNote(id, status, required) {
        const note = (document.getElementById('status-note') || {}).value || '';
        if (required && !note.trim()) {
            alert('A note is required when resolving a report.');
            return;
        }
        this.closeRejectModal();
        await this.changeStatus(id, status, note.trim());
    },

    async changeStatus(id, status, note = '') {
        const card = document.getElementById('incident-' + id);
        const btns = card ? card.querySelectorAll('.incident-card__actions .btn') : [];
        btns.forEach(b => { b.disabled = true; });

        try {
            const res = await Store.apiFetch('/api/reports/' + id + '/status', {
                method: 'PUT',
                body: JSON.stringify({ status, note: note || undefined }),
            });

            if (res.success) {
                this.loadData();
            } else {
                alert(res.message || 'Failed to update status.');
                btns.forEach(b => { b.disabled = false; });
            }
        } catch (err) {
            alert('Network error. Please try again.');
            btns.forEach(b => { b.disabled = false; });
        }
    },

    /* --------------------------------------------------------
     * 9b. Delete (terminal-status incidents and hazards)
     * -------------------------------------------------------- */
    async confirmDeleteIncident(id) {
        if (!confirm('Delete this report? This cannot be undone.')) return;
        try {
            const res = await Store.apiFetch('/api/reports/' + id, { method: 'DELETE' });
            if (res.success) {
                if (window.Toast) Toast.show('Report deleted.', { type: 'success', duration: 2500 });
                this.loadData();
            } else {
                alert(res.message || 'Failed to delete report.');
            }
        } catch (err) {
            alert('Network error. Please try again.');
        }
    },

    async confirmDeleteHazard(id) {
        if (!confirm('Delete this hazard? This cannot be undone.')) return;
        try {
            const res = await Store.apiFetch('/api/hazards/' + id, { method: 'DELETE' });
            if (res.success) {
                if (window.Toast) Toast.show('Hazard deleted.', { type: 'success', duration: 2500 });
                this.loadData();
            } else {
                alert(res.message || 'Failed to delete hazard.');
            }
        } catch (err) {
            alert('Network error. Please try again.');
        }
    },

    async rejectReport(id) {
        const reason = document.getElementById('reject-reason').value.trim();
        if (!reason) { alert('Please provide a reason for rejection.'); return; }

        // Pass the rejection reason through as the report_event note so
        // the citizen sees it in Processing History.
        this.closeRejectModal();
        await this.changeStatus(id, 'rejected', reason);
    },

    /* --------------------------------------------------------
     * 10. Rejection Modal
     * -------------------------------------------------------- */
    showRejectModal(id) {
        const incident = this.incidents.find(i => i.id === id);
        const title = incident ? incident.title : 'Report #' + id;

        this._ensureRejectionContainer().innerHTML = `
            <div class="modal-overlay modal-overlay--centered" onclick="if(event.target===this) AdminDashboardPage.closeRejectModal()">
                <div class="modal">
                    <div class="modal__title">Reject Report</div>
                    <div class="modal__desc">Please provide a reason for rejecting "${title}". The citizen will be notified.</div>
                    <div class="form-group">
                        <div class="form-group__label">Reason for Rejection <span class="form-group__required">*</span></div>
                        <textarea class="form-input" id="reject-reason" placeholder="Explain why this report is being rejected..." style="min-height:80px;"></textarea>
                    </div>
                    <div class="modal__actions">
                        <button type="button" class="btn btn--outline" onclick="AdminDashboardPage.closeRejectModal()">Cancel</button>
                        <button type="button" class="btn btn--danger" onclick="AdminDashboardPage.rejectReport(${id})">Reject Report</button>
                    </div>
                </div>
            </div>
        `;
    },

    closeRejectModal() {
        this._ensureRejectionContainer().innerHTML = '';
    },

    /* --------------------------------------------------------
     * 11. Helper Methods
     * -------------------------------------------------------- */
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    statusLabel(status) {
        const map = {
            submitted: 'Submitted',
            pending: 'Pending',
            investigating: 'Investigating',
            in_progress: 'In Progress',
            pending_confirmation: 'Pending Confirmation',
            resolved: 'Resolved',
            rejected: 'Rejected',
            cancelled: 'Cancelled',
        };
        return map[status] || this.capitalize(status || '');
    },

    timeAgo(dateStr) {
        if (!dateStr) return '';
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return diffMins + 'm ago';
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return diffHours + 'h ago';
        const diffDays = Math.floor(diffHours / 24);
        return diffDays + 'd ago';
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });
    },

    _escAttr(str) {
        return str.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
    },

    escape(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    /* --------------------------------------------------------
     * SMS Reports View
     * -------------------------------------------------------- */
    async loadSmsReports() {
        try {
            const res = await Store.apiFetch('/api/sms-reports');
            if (res.success) {
                this.renderSmsView(res.data);
            }
        } catch (err) {
            const container = document.getElementById('dashboard-content');
            if (container) container.innerHTML = '<div class="empty-state">Failed to load SMS reports.</div>';
        }
    },

    renderSmsView(reports) {
        const container = document.getElementById('dashboard-content');
        if (!container) return;

        const pending = reports.filter(r => r.status === 'pending');
        const others = reports.filter(r => r.status !== 'pending');

        if (reports.length === 0) {
            container.innerHTML = `
                <div class="section-header">
                    <div class="section-header__title">SMS Reports</div>
                </div>
                <div class="empty-state">No offline SMS reports received yet.</div>
            `;
            return;
        }

        const severityBadge = { high: 'high', medium: 'warning', low: 'info' };

        const renderCard = (r) => {
            const badge = severityBadge[r.severity] || 'info';
            const locationLink = (r.latitude && r.longitude && r.latitude !== 0)
                ? `<a href="https://www.google.com/maps?q=${r.latitude},${r.longitude}" target="_blank" rel="noopener">${r.latitude}, ${r.longitude}</a>`
                : 'No GPS data';

            const actions = r.status === 'pending' ? `
                <div class="incident-card__actions">
                    <button class="btn btn--primary btn--sm" onclick="AdminDashboardPage.convertSmsReport(${r.id})">Convert to Report</button>
                    <button class="btn btn--outline btn--sm" onclick="AdminDashboardPage.dismissSmsReport(${r.id})">Dismiss</button>
                </div>
            ` : `<span class="badge badge--${r.status === 'converted' ? 'success' : 'default'}">${r.status}</span>`;

            const sourceBadge = r.source_type === 'report'
                ? '<span class="badge badge--info">Report</span>'
                : '<span class="badge badge--high">SOS</span>';

            return `
                <div class="incident-card">
                    <div class="incident-card__header">
                        <span class="incident-card__title">${this.escape(r.type || 'Emergency')}</span>
                        <span class="badge badge--${badge}">${r.severity || 'medium'}</span>
                        <span class="badge badge--sms">SMS</span>
                        ${sourceBadge}
                    </div>
                    <div class="incident-card__submitter">
                        <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        ${this.escape(r.sender_name || 'Unknown')} (${this.escape(r.sender_phone || 'N/A')})
                    </div>
                    <div class="incident-card__location">
                        <svg viewBox="0 0 24 24" style="width:14px;height:14px;vertical-align:middle;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        ${locationLink}
                    </div>
                    <div class="incident-card__description">${this.escape(r.message || '')}</div>
                    <div class="incident-card__footer">
                        <span>Received ${this.formatDate(r.received_at || r.created_at)}</span>
                    </div>
                    ${actions}
                </div>
            `;
        };

        container.innerHTML = `
            <div class="section-header">
                <div class="section-header__title">SMS Reports</div>
                <span class="badge badge--high">${pending.length} pending</span>
            </div>
            ${pending.map(renderCard).join('')}
            ${others.length > 0 ? `
                <div class="section-header" style="margin-top: var(--spacing-lg)">
                    <div class="section-header__title">Processed</div>
                </div>
                ${others.map(renderCard).join('')}
            ` : ''}
        `;
    },

    async convertSmsReport(id) {
        if (!confirm('Convert this SMS report to an incident report?')) return;
        try {
            const res = await Store.apiFetch(`/api/sms-reports/${id}/convert`, { method: 'POST' });
            if (res.success) {
                this.loadSmsReports();
            }
        } catch (err) {
            alert('Failed to convert report.');
        }
    },

    async dismissSmsReport(id) {
        if (!confirm('Dismiss this SMS report?')) return;
        try {
            const res = await Store.apiFetch(`/api/sms-reports/${id}/dismiss`, { method: 'POST' });
            if (res.success) {
                this.loadSmsReports();
            }
        } catch (err) {
            alert('Failed to dismiss report.');
        }
    },

    /* --------------------------------------------------------
     * Promote to Community Post (A-14)
     * -------------------------------------------------------- */
    async promoteToPost(id) {
        try {
            const res = await Store.apiFetch('/api/reports/' + id + '/promote-to-post', { method: 'POST' });
            if (res.success) {
                this._toast('Promoted to community post.');
                return;
            }
            // The server returns 409 + success:false when already promoted.
            if (res.message && res.message.toLowerCase().includes('already')) {
                this._toast('Already posted — view in News Updates.');
                return;
            }
            this._toast(res.message || 'Failed to promote report.');
        } catch (err) {
            this._toast('Network error. Please try again.');
        }
    },

    _toast(message) {
        let host = document.getElementById('admin-toast-host');
        if (!host) {
            host = document.createElement('div');
            host.id = 'admin-toast-host';
            host.style.position = 'fixed';
            host.style.bottom = '24px';
            host.style.left = '50%';
            host.style.transform = 'translateX(-50%)';
            host.style.zIndex = '9999';
            document.body.appendChild(host);
        }
        const el = document.createElement('div');
        el.className = 'admin-toast';
        el.textContent = message;
        host.appendChild(el);
        setTimeout(() => { el.classList.add('admin-toast--leaving'); }, 2400);
        setTimeout(() => { el.remove(); }, 2800);
    },

    /* --------------------------------------------------------
     * 12. Recycle Bin (soft-deleted reports + hazards)
     * -------------------------------------------------------- */

    /**
     * Fetches both bin endpoints in parallel and renders the combined view.
     */
    async loadBin() {
        try {
            const [reportsRes, hazardsRes] = await Promise.all([
                Store.apiFetch('/api/reports/bin'),
                Store.apiFetch('/api/hazards/bin'),
            ]);
            this.binReports = (reportsRes && reportsRes.success) ? reportsRes.data : [];
            this.binHazards = (hazardsRes && hazardsRes.success) ? hazardsRes.data : [];
            this.renderBinView();
        } catch (err) {
            const container = document.getElementById('dashboard-content');
            if (container) container.innerHTML = '<div class="empty-state">Failed to load bin.</div>';
        }
    },

    renderBinView() {
        const container = document.getElementById('dashboard-content');
        if (!container) return;

        const totalCount = this.binReports.length + this.binHazards.length;
        if (totalCount === 0) {
            container.innerHTML = `
                <div class="section-header">
                    <div class="section-header__title">Recycle Bin</div>
                </div>
                <div class="empty-state">The bin is empty.</div>
            `;
            return;
        }

        // Reports section
        const reportsSection = `
            <div class="section-header">
                <div class="section-header__title">Deleted Reports</div>
                <span class="badge badge--default">${this.binReports.length}</span>
            </div>
            ${this.binReports.length === 0
                ? '<div class="empty-state">No deleted reports.</div>'
                : this.binReports.map(r => this._renderBinReportCard(r)).join('')}
        `;

        // Hazards section
        const hazardsSection = `
            <div class="section-header" style="margin-top: var(--spacing-lg)">
                <div class="section-header__title">Deleted Hazards</div>
                <span class="badge badge--default">${this.binHazards.length}</span>
            </div>
            ${this.binHazards.length === 0
                ? '<div class="empty-state">No deleted hazards.</div>'
                : this.binHazards.map(h => this._renderBinHazardCard(h)).join('')}
        `;

        container.innerHTML = `
            <div class="section-header">
                <div class="section-header__title">Recycle Bin</div>
            </div>
            <div class="incident-card__description" style="margin-bottom: var(--spacing-md)">
                Items here are hidden from citizens and dashboards. Restore them to put them back, or permanently delete to free space.
            </div>
            ${reportsSection}
            ${hazardsSection}
        `;
    },

    _renderBinReportCard(r) {
        return `
            <div class="incident-card" id="bin-report-${r.id}">
                <div class="incident-card__header">
                    <span class="incident-card__title">${this.escape(r.title)}</span>
                    <span class="badge badge--${r.status}">${this.statusLabel(r.status)}</span>
                </div>
                <span class="badge badge--type" style="margin-bottom: 6px; display: inline-flex;">${this.escape(r.type || '')}</span>
                ${r.description ? `<div class="incident-card__description">${this.escape(r.description)}</div>` : ''}
                <div class="incident-card__submitter">
                    <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    Reported by ${this.escape(r.submitted_by_name || 'Unknown')}
                </div>
                <div class="card__meta">
                    <div class="card__meta-item">
                        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        Deleted ${this.formatDate(r.deleted_at)}
                    </div>
                </div>
                <div class="incident-card__actions">
                    <button type="button" class="btn btn--outline btn--sm" onclick="AdminDashboardPage.restoreBinReport(${r.id})">Restore</button>
                    <button type="button" class="btn btn--reject btn--sm" onclick="AdminDashboardPage.permanentDeleteBinReport(${r.id})">Delete Permanently</button>
                </div>
            </div>
        `;
    },

    _renderBinHazardCard(h) {
        const severityBadge = {
            high: '<span class="badge badge--high">High</span>',
            medium: '<span class="badge badge--warning">Medium</span>',
            low: '<span class="badge badge--info">Low</span>',
        };
        return `
            <div class="incident-card" id="bin-hazard-${h.id}">
                <div class="incident-card__header">
                    <span class="incident-card__title">${this.escape(h.title)}</span>
                    ${severityBadge[h.severity] || ''}
                </div>
                ${h.location ? `<div class="incident-card__location">${this.escape(h.location)}</div>` : ''}
                ${h.description ? `<div class="incident-card__description">${this.escape(h.description)}</div>` : ''}
                <div class="card__meta">
                    <div class="card__meta-item">
                        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        Deleted ${this.formatDate(h.deleted_at)}
                    </div>
                </div>
                <div class="incident-card__actions">
                    <button type="button" class="btn btn--outline btn--sm" onclick="AdminDashboardPage.restoreBinHazard(${h.id})">Restore</button>
                    <button type="button" class="btn btn--reject btn--sm" onclick="AdminDashboardPage.permanentDeleteBinHazard(${h.id})">Delete Permanently</button>
                </div>
            </div>
        `;
    },

    async restoreBinReport(id) {
        try {
            const res = await Store.apiFetch('/api/reports/' + id + '/restore', { method: 'PUT' });
            if (res && res.success) {
                if (window.Toast) Toast.show('Report restored.', { type: 'success', duration: 2500 });
                // Refresh main lists + bin so the restored item reappears.
                this.loadData();
                this.loadBin();
            } else {
                alert((res && res.message) || 'Failed to restore report.');
            }
        } catch (err) {
            alert('Network error. Please try again.');
        }
    },

    async permanentDeleteBinReport(id) {
        if (!confirm('Permanently delete this report? This cannot be undone.')) return;
        try {
            const res = await Store.apiFetch('/api/reports/' + id + '/permanent', { method: 'DELETE' });
            if (res && res.success) {
                if (window.Toast) Toast.show('Report permanently deleted.', { type: 'success', duration: 2500 });
                this.binReports = this.binReports.filter(r => r.id !== id);
                this.renderBinView();
            } else {
                alert((res && res.message) || 'Failed to permanently delete report.');
            }
        } catch (err) {
            alert('Network error. Please try again.');
        }
    },

    async restoreBinHazard(id) {
        try {
            const res = await Store.apiFetch('/api/hazards/' + id + '/restore', { method: 'PUT' });
            if (res && res.success) {
                if (window.Toast) Toast.show('Hazard restored.', { type: 'success', duration: 2500 });
                this.loadData();
                this.loadBin();
            } else {
                alert((res && res.message) || 'Failed to restore hazard.');
            }
        } catch (err) {
            alert('Network error. Please try again.');
        }
    },

    async permanentDeleteBinHazard(id) {
        if (!confirm('Permanently delete this hazard? This cannot be undone.')) return;
        try {
            const res = await Store.apiFetch('/api/hazards/' + id + '/permanent', { method: 'DELETE' });
            if (res && res.success) {
                if (window.Toast) Toast.show('Hazard permanently deleted.', { type: 'success', duration: 2500 });
                this.binHazards = this.binHazards.filter(h => h.id !== id);
                this.renderBinView();
            } else {
                alert((res && res.message) || 'Failed to permanently delete hazard.');
            }
        } catch (err) {
            alert('Network error. Please try again.');
        }
    }
};
