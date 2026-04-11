/* ============================================================
   Admin Dashboard Page (MDRRMO Dashboard)
   ============================================================
   Reference: index4.html (Figma export)
   Incident management dashboard with status summary, search,
   and report approval/rejection actions.
   Table of Contents:
   1. State
   2. Render method
   3. Data loading
   4. Incident list rendering
   5. Filter handling
   6. Search handling
   7. Approve / Reject actions
   8. Rejection modal
   9. Helper methods
   ============================================================ */

const AdminDashboardPage = {
    activeFilter: 'all',
    incidents: [],

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

                <div id="dashboard-incidents">
                    <div class="loading-state">Loading incidents...</div>
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
            const [statsRes, reportsRes] = await Promise.all([
                Store.apiFetch('/api/dashboard/stats'),
                Store.apiFetch('/api/reports'),
            ]);

            if (statsRes.success) {
                const s = statsRes.data;
                const el = (id) => document.getElementById(id);
                if (el('dash-pending')) el('dash-pending').textContent = s.pendingCount;
                if (el('dash-investigating')) el('dash-investigating').textContent = s.investigatingCount;
                if (el('dash-resolved')) el('dash-resolved').textContent = s.resolvedCount;
                if (el('dash-hazards')) el('dash-hazards').textContent = s.hazardsCount;
            }

            if (reportsRes.success) {
                this.incidents = reportsRes.data;
                this.renderIncidentsList();
            }
        } catch (err) {
            console.error('Failed to load dashboard data:', err);
        }
    },

    /* --------------------------------------------------------
     * 4. Incident List Rendering
     * -------------------------------------------------------- */
    renderIncidentsList(searchTerm) {
        let filtered = this.activeFilter === 'all'
            ? this.incidents
            : this.incidents.filter(i => i.status === this.activeFilter);

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(i =>
                i.title.toLowerCase().includes(term) ||
                i.type.toLowerCase().includes(term) ||
                (i.location && i.location.toLowerCase().includes(term))
            );
        }

        const container = document.getElementById('dashboard-incidents');
        if (!container) return;

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state">No incidents found.</div>';
            return;
        }

        container.innerHTML = filtered.map(incident => this.renderIncidentCard(incident)).join('');
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

                ${incident.description ? `<div class="incident-card__description">${incident.description}</div>` : ''}

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

                ${incident.images && incident.images.length > 0 ? `
                    <div style="display:flex;gap:6px;margin-top:var(--spacing-sm);flex-wrap:wrap;">
                        ${incident.images.map(img => `<div style="width:48px;height:48px;border-radius:6px;background:var(--color-gray-200);overflow:hidden;"><img src="${img.file_path}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;width:100%;height:100%;\\' ><svg viewBox=\\'0 0 24 24\\' style=\\'width:16px;height:16px;fill:none;stroke:var(--color-gray-400);stroke-width:2;\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\'/><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'/><polyline points=\\'21 15 16 10 5 21\\'/></svg></div>'"></div>`).join('')}
                    </div>
                ` : ''}

                ${needsAction ? `
                    <div class="incident-card__actions">
                        <button class="btn btn--approve" onclick="AdminDashboardPage.approveReport(${incident.id})">
                            <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            Approve
                        </button>
                        <button class="btn btn--reject" onclick="AdminDashboardPage.showRejectModal(${incident.id})">
                            <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            Reject
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    /* --------------------------------------------------------
     * 5. Filter Handling
     * -------------------------------------------------------- */
    setFilter(filter) {
        this.activeFilter = filter;
        this.renderIncidentsList();
        document.querySelectorAll('.dashboard-subtabs__tab').forEach(tab => tab.classList.remove('active'));
        event.target.classList.add('active');
    },

    /* --------------------------------------------------------
     * 6. Search Handling
     * -------------------------------------------------------- */
    handleSearch(value) {
        this.renderIncidentsList(value);
    },

    /* --------------------------------------------------------
     * 7. Approve / Reject Actions
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
     * 8. Rejection Modal
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
                        <button class="btn btn--outline" onclick="AdminDashboardPage.closeRejectModal()">Cancel</button>
                        <button class="btn btn--danger" onclick="AdminDashboardPage.rejectReport(${id})">
                            Reject Report
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    closeRejectModal() {
        document.getElementById('rejection-modal').innerHTML = '';
    },

    /* --------------------------------------------------------
     * 9. Helper Methods
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
    }
};
