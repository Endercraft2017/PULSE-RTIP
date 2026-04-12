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

    /* --------------------------------------------------------
     * 2. Render
     * -------------------------------------------------------- */
    render() {
        setTimeout(() => this.loadData(), 0);

        return `
            <div class="page-padding">
                <div class="dashboard-stats">
                    <div class="dashboard-stat">
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
                </div>

                <!-- Content area -->
                <div id="dashboard-content">
                    <div class="loading-state">Loading...</div>
                </div>
            </div>

            <div id="rejection-modal"></div>
        `;
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
                if (el('dash-pending')) el('dash-pending').textContent = s.pendingCount;
                if (el('dash-investigating')) el('dash-investigating').textContent = s.investigatingCount;
                if (el('dash-resolved')) el('dash-resolved').textContent = s.resolvedCount;
                if (el('dash-hazards')) el('dash-hazards').textContent = s.hazardsCount;
            }

            if (reportsRes.success) this.incidents = reportsRes.data;
            if (hazardsRes.success) this.hazards = hazardsRes.data;

            this.renderContent();
        } catch (err) {
            console.error('Failed to load dashboard data:', err);
        }
    },

    /* --------------------------------------------------------
     * 4. Main Tab Rendering
     * -------------------------------------------------------- */
    setMainTab(tab) {
        this.activeMainTab = tab;
        document.querySelectorAll('.dash-main-tab').forEach(t => t.classList.remove('active'));
        event.currentTarget.classList.add('active');
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
        }
    },

    /* --------------------------------------------------------
     * 5. Incidents View (with sub-filter tabs)
     * -------------------------------------------------------- */
    renderIncidentsView(searchTerm) {
        const filterRow = `
            <div class="section-header">
                <div class="section-header__title">Incidents</div>
            </div>
            <div class="dashboard-subtabs" id="dashboard-tabs">
                <button class="dashboard-subtabs__tab ${this.activeFilter === 'all' ? 'active' : ''}"
                        onclick="AdminDashboardPage.setFilter('all')">All</button>
                <button class="dashboard-subtabs__tab ${this.activeFilter === 'pending' ? 'active' : ''}"
                        onclick="AdminDashboardPage.setFilter('pending')">Pending</button>
                <button class="dashboard-subtabs__tab ${this.activeFilter === 'investigating' ? 'active' : ''}"
                        onclick="AdminDashboardPage.setFilter('investigating')">Investigating</button>
                <button class="dashboard-subtabs__tab ${this.activeFilter === 'resolved' ? 'active' : ''}"
                        onclick="AdminDashboardPage.setFilter('resolved')">Resolved</button>
            </div>
        `;

        let filtered = this.activeFilter === 'all'
            ? this.incidents
            : this.incidents.filter(i => i.status === this.activeFilter);

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
        const needsAction = incident.status === 'submitted' || incident.status === 'pending';

        return `
            <div class="incident-card" id="incident-${incident.id}">
                <div class="incident-card__header">
                    <span class="incident-card__title">${incident.title}</span>
                    <span class="badge badge--${incident.status}">${this.capitalize(incident.status)}</span>
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

                <div class="incident-card__footer">
                    <span></span>
                    <button type="button" class="incident-card__details-link" onclick="DetailModal.showIncident(${this._escAttr(JSON.stringify(incident))})">
                        Details
                        <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>

                ${needsAction ? `
                    <div class="incident-card__actions">
                        <button type="button" class="btn btn--approve" onclick="AdminDashboardPage.approveReport(${incident.id})">
                            <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            Approve
                        </button>
                        <button type="button" class="btn btn--reject" onclick="AdminDashboardPage.showRejectModal(${incident.id})">
                            <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            Reject
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
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

        const cards = this.hazards.map(h => `
            <div class="incident-card">
                <div class="incident-card__header">
                    <span class="incident-card__title">${h.title}</span>
                    ${severityBadge[h.severity] || ''}
                </div>
                <div class="incident-card__location">${h.location || ''}</div>
                <div class="incident-card__description">${h.description || ''}</div>
                <div class="incident-card__footer">
                    <span>Updated ${this.formatDate(h.updated_at)}</span>
                    <button type="button" class="incident-card__details-link" onclick="DetailModal.showHazard(${this._escAttr(JSON.stringify(h))})">
                        Details
                        <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>
            </div>
        `).join('');

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

        const cards = sorted.map(r => `
            <div class="incident-card">
                <div class="incident-card__header">
                    <span class="incident-card__title">${r.title}</span>
                    <span class="badge badge--${r.status}">${this.capitalize(r.status)}</span>
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
                <div class="incident-card__footer">
                    <span></span>
                    <button type="button" class="incident-card__details-link" onclick="DetailModal.showIncident(${this._escAttr(JSON.stringify(r))})">
                        Details
                        <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>
            </div>
        `).join('');

        return header + cards;
    },

    /* --------------------------------------------------------
     * 8. Filter + Search Handling
     * -------------------------------------------------------- */
    setFilter(filter) {
        this.activeFilter = filter;
        document.querySelectorAll('.dashboard-subtabs__tab').forEach(tab => tab.classList.remove('active'));
        event.target.classList.add('active');
        this.renderContent();
    },

    handleSearch(value) {
        this._searchTerm = value;
        this.renderContent();
    },

    /* --------------------------------------------------------
     * 9. Approve / Reject Actions
     * -------------------------------------------------------- */
    async approveReport(id) {
        const card = document.getElementById('incident-' + id);
        const btns = card ? card.querySelectorAll('.incident-card__actions .btn') : [];
        btns.forEach(b => { b.disabled = true; });

        try {
            const res = await Store.apiFetch('/api/reports/' + id + '/status', {
                method: 'PUT',
                body: JSON.stringify({ status: 'investigating' }),
            });

            if (res.success) {
                this.loadData();
            } else {
                alert(res.message || 'Failed to approve report.');
                btns.forEach(b => { b.disabled = false; });
            }
        } catch (err) {
            alert('Network error. Please try again.');
            btns.forEach(b => { b.disabled = false; });
        }
    },

    async rejectReport(id) {
        const reason = document.getElementById('reject-reason').value.trim();
        if (!reason) { alert('Please provide a reason for rejection.'); return; }

        this.closeRejectModal();

        try {
            const res = await Store.apiFetch('/api/reports/' + id + '/status', {
                method: 'PUT',
                body: JSON.stringify({ status: 'resolved' }),
            });

            if (res.success) {
                this.loadData();
            } else {
                alert(res.message || 'Failed to reject report.');
            }
        } catch (err) {
            alert('Network error. Please try again.');
        }
    },

    /* --------------------------------------------------------
     * 10. Rejection Modal
     * -------------------------------------------------------- */
    showRejectModal(id) {
        const incident = this.incidents.find(i => i.id === id);
        const title = incident ? incident.title : 'Report #' + id;

        document.getElementById('rejection-modal').innerHTML = `
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
        document.getElementById('rejection-modal').innerHTML = '';
    },

    /* --------------------------------------------------------
     * 11. Helper Methods
     * -------------------------------------------------------- */
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
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
    }
};
