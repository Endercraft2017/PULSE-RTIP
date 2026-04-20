/* ============================================================
   My Reports Page (Citizen)
   ============================================================
   Reference: reference/html-designs/Reports user{1-9}
   Layout:
   1. Featured/latest report card at top
   2. Filter tabs: All / Submitted / Under Review / Resolved / Rejected
   3. Report cards with status, type, description, location,
      date, reporter, images, and Details link
   4. "No reports found." empty state
   Table of Contents:
   1. State
   2. Render method
   3. Data loading
   4. Featured card
   5. Tab & list rendering
   6. Report card rendering
   7. Filter handling
   8. Helpers
   ============================================================ */

const MyReportsPage = {
    /* --------------------------------------------------------
     * 1. State
     * -------------------------------------------------------- */
    activeFilter: 'all',
    reports: [],

    /* --------------------------------------------------------
     * 2. Render
     * -------------------------------------------------------- */
    render() {
        setTimeout(() => this.loadData(), 0);

        return `
            <div class="page-padding">
                <div class="filter-tabs filter-tabs--scroll" id="report-filters">
                    <button class="filter-tabs__tab ${this.activeFilter === 'all' ? 'active' : ''}"
                            onclick="MyReportsPage.setFilter('all')">All</button>
                    <button class="filter-tabs__tab ${this.activeFilter === 'submitted' ? 'active' : ''}"
                            onclick="MyReportsPage.setFilter('submitted')">Submitted</button>
                    <button class="filter-tabs__tab ${this.activeFilter === 'investigating' ? 'active' : ''}"
                            onclick="MyReportsPage.setFilter('investigating')">Investigating</button>
                    <button class="filter-tabs__tab ${this.activeFilter === 'in_progress' ? 'active' : ''}"
                            onclick="MyReportsPage.setFilter('in_progress')">In Progress</button>
                    <button class="filter-tabs__tab ${this.activeFilter === 'resolved' ? 'active' : ''}"
                            onclick="MyReportsPage.setFilter('resolved')">Resolved</button>
                    <button class="filter-tabs__tab ${this.activeFilter === 'rejected' ? 'active' : ''}"
                            onclick="MyReportsPage.setFilter('rejected')">Rejected</button>
                    <button class="filter-tabs__tab ${this.activeFilter === 'cancelled' ? 'active' : ''}"
                            onclick="MyReportsPage.setFilter('cancelled')">Cancelled</button>
                </div>

                <div id="reports-list"></div>
            </div>
        `;
    },

    /* --------------------------------------------------------
     * 3. Data Loading
     * -------------------------------------------------------- */
    async loadData() {
        try {
            const res = await Store.apiFetch('/api/reports');
            if (res.success) {
                this.reports = res.data;
                this.renderReportsList();
            }
        } catch (err) {
            console.error('Failed to load reports:', err);
        }
    },

    /* --------------------------------------------------------
     * 4. Report List Rendering
     * -------------------------------------------------------- */
    renderReportsList() {
        const container = document.getElementById('reports-list');
        if (!container) return;

        let filtered;
        if (this.activeFilter === 'all') {
            filtered = this.reports;
        } else if (this.activeFilter === 'submitted') {
            filtered = this.reports.filter(r => r.status === 'submitted' || r.status === 'pending');
        } else if (this.activeFilter === 'in_progress') {
            filtered = this.reports.filter(r => r.status === 'in_progress' || r.status === 'pending_confirmation');
        } else {
            filtered = this.reports.filter(r => r.status === this.activeFilter);
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state">No reports found.</div>';
            return;
        }

        container.innerHTML = filtered.map(r => this.renderCard(r)).join('');
    },

    /* --------------------------------------------------------
     * 6. Report Card
     * -------------------------------------------------------- */
    renderCard(report) {
        const isAdmin = Store.get('role') === 'admin';
        const bodyAttrs = isAdmin
            ? `class="incident-card__body incident-card__body--clickable" onclick="MyReportsPage.openInDashboard(${report.id})"`
            : 'class="incident-card__body"';
        return `
            <div class="incident-card">
                <div ${bodyAttrs}>
                <div class="incident-card__header">
                    <span class="incident-card__title">${this.escape(report.title)}</span>
                    <span class="badge badge--${report.status}">${this.statusLabel(report.status)}</span>
                </div>
                <span class="badge badge--type" style="margin-bottom:6px;display:inline-flex;">${this.escape(report.type)}</span>
                <div class="incident-card__description">${this.escape(report.description || '')}</div>

                ${report.images && report.images.length > 0 ? `
                    <div class="incident-card__images">
                        ${report.images.map(img => `<div class="incident-card__image" style="background-image: url('${img.file_path}')"></div>`).join('')}
                    </div>
                ` : ''}

                <div class="card__meta">
                    <div class="card__meta-item">
                        <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        ${this.escape(report.location || 'Unknown location')}
                    </div>
                    <div class="card__meta-item">
                        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        ${this.formatDate(report.created_at)}
                    </div>
                    <div class="card__meta-item">
                        <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        ${this.escape(report.submitted_by_name || 'Unknown')}
                    </div>
                </div>

                <div class="incident-card__footer">
                    <span></span>
                    <button type="button" class="incident-card__details-link" onclick="event.stopPropagation(); DetailModal.showIncident(${this._escAttr(JSON.stringify(report))})">
                        Details
                        <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>
                </div>

                ${this._canCancel(report) ? `
                    <div class="incident-card__actions">
                        <button type="button" class="btn btn--outline btn--sm" onclick="MyReportsPage.cancelReport(${report.id})">Cancel Report</button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    openInDashboard(reportId) {
        window.location.hash = '#/dashboard?focus=' + reportId;
    },

    _canCancel(report) {
        return ['submitted', 'pending', 'investigating'].includes(report.status);
    },

    async cancelReport(id) {
        if (!confirm('Cancel this report? You cannot undo this.')) return;
        try {
            const res = await Store.apiFetch('/api/reports/' + id + '/status', {
                method: 'PUT',
                body: JSON.stringify({ status: 'cancelled' }),
            });
            if (res.success) {
                this.loadData();
            } else {
                alert(res.message || 'Failed to cancel report.');
            }
        } catch (err) {
            alert('Network error. Please try again.');
        }
    },

    /* --------------------------------------------------------
     * 7. Filter Handling
     * -------------------------------------------------------- */
    setFilter(filter) {
        this.activeFilter = filter;
        document.querySelectorAll('.filter-tabs__tab').forEach(t => t.classList.remove('active'));
        event.target.classList.add('active');
        this.renderReportsList();
    },

    /* --------------------------------------------------------
     * 8. Helpers
     * -------------------------------------------------------- */
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
        return map[status] || (status ? status.charAt(0).toUpperCase() + status.slice(1) : '');
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });
    },

    escape(str) {
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    _escAttr(str) {
        return str.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
    },
};
