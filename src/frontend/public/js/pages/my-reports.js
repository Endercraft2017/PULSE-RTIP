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
                <div id="featured-report">
                    <div class="loading-state">Loading reports...</div>
                </div>

                <div class="filter-tabs" id="report-filters">
                    <button class="filter-tabs__tab ${this.activeFilter === 'all' ? 'active' : ''}"
                            onclick="MyReportsPage.setFilter('all')">All</button>
                    <button class="filter-tabs__tab ${this.activeFilter === 'submitted' ? 'active' : ''}"
                            onclick="MyReportsPage.setFilter('submitted')">Submitted</button>
                    <button class="filter-tabs__tab ${this.activeFilter === 'investigating' ? 'active' : ''}"
                            onclick="MyReportsPage.setFilter('investigating')">Under Review</button>
                    <button class="filter-tabs__tab ${this.activeFilter === 'resolved' ? 'active' : ''}"
                            onclick="MyReportsPage.setFilter('resolved')">Resolved</button>
                    <button class="filter-tabs__tab ${this.activeFilter === 'rejected' ? 'active' : ''}"
                            onclick="MyReportsPage.setFilter('rejected')">Rejected</button>
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
                this.renderFeatured();
                this.renderReportsList();
            }
        } catch (err) {
            console.error('Failed to load reports:', err);
        }
    },

    /* --------------------------------------------------------
     * 4. Featured Report Card
     * -------------------------------------------------------- */
    renderFeatured() {
        const container = document.getElementById('featured-report');
        if (!container) return;

        const latest = this.reports.length > 0
            ? [...this.reports].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
            : null;

        if (!latest) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <div class="featured-report-card" onclick="DetailModal.showIncident(${this._escAttr(JSON.stringify(latest))})">
                <div class="featured-report-card__header">
                    <span class="incident-card__title">${this.escape(latest.title)}</span>
                    <span class="badge badge--${latest.status}">${this.statusLabel(latest.status)}</span>
                </div>
                <span class="badge badge--type">${this.escape(latest.type)}</span>
                <div class="featured-report-card__desc">${this.escape(latest.description || '')}</div>
                ${latest.images && latest.images.length > 0 ? `
                    <div class="incident-card__images" style="margin-top:var(--spacing-sm);">
                        ${latest.images.map(img => `<div class="incident-card__image" style="background-image: url('${img.file_path}')"></div>`).join('')}
                    </div>
                ` : ''}
                <div class="card__meta">
                    <div class="card__meta-item">
                        <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        ${this.escape(latest.location || 'Unknown')}
                    </div>
                    <div class="card__meta-item">
                        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        ${this.formatDate(latest.created_at)}
                    </div>
                    <div class="card__meta-item">
                        <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        ${this.escape(latest.submitted_by_name || 'Unknown')}
                    </div>
                </div>
            </div>
        `;
    },

    /* --------------------------------------------------------
     * 5. Report List Rendering
     * -------------------------------------------------------- */
    renderReportsList() {
        const container = document.getElementById('reports-list');
        if (!container) return;

        let filtered;
        if (this.activeFilter === 'all') {
            filtered = this.reports;
        } else if (this.activeFilter === 'submitted') {
            filtered = this.reports.filter(r => r.status === 'submitted' || r.status === 'pending');
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
        return `
            <div class="incident-card">
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
        `;
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
            investigating: 'Under Review',
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
