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
                    <button class="filter-tabs__tab ${this.activeFilter === 'pending_confirmation' ? 'active' : ''}"
                            onclick="MyReportsPage.setFilter('pending_confirmation')">Pending Confirmation</button>
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
        } else {
            // Strict per-status matching so the badge on the card always
            // matches the tab label.
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
                        ${report.images.map(img => `<div class="incident-card__image" style="background-image: url('${Store.mediaUrl(img.file_path)}')"></div>`).join('')}
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

                ${this._renderOwnerActions(report)}
            </div>
        `;
    },

    _renderOwnerActions(report) {
        const user = (typeof Store !== 'undefined' && Store.get) ? Store.get('user') : null;
        const isOwner = !!(user && report.submitted_by && user.id === report.submitted_by);
        const isAdmin = (typeof Store !== 'undefined' && Store.get) && Store.get('role') === 'admin';
        // Admins manage status from the dashboard — don't show citizen
        // edit/cancel actions on their view of the same shared list.
        if (isAdmin || !isOwner) return '';

        const editable = this._canCancel(report); // same window: submitted/pending/investigating
        if (!editable) return '';

        return `
            <div class="incident-card__actions">
                <button type="button" class="btn btn--outline btn--sm" onclick="MyReportsPage.openEditModal(${report.id})">Edit</button>
                <button type="button" class="btn btn--outline btn--sm" onclick="MyReportsPage.cancelReport(${report.id})">Cancel Report</button>
            </div>
        `;
    },

    openInDashboard(reportId) {
        window.location.hash = '#/dashboard?focus=' + reportId;
    },

    _canCancel(report) {
        return ['submitted', 'pending', 'investigating'].includes(report.status);
    },

    /* --------------------------------------------------------
     * Edit Report Modal (citizen)
     * -------------------------------------------------------- */
    openEditModal(reportId) {
        const report = this.reports.find(r => r.id === reportId);
        if (!report) return;

        let container = document.getElementById('report-edit-modal-container');
        if (!container || container.parentElement !== document.body) {
            if (container) container.remove();
            container = document.createElement('div');
            container.id = 'report-edit-modal-container';
            document.body.appendChild(container);
        }

        const types = ['Flood', 'Fire', 'Infrastructure Damage', 'Earthquake', 'Landslide', 'Typhoon', 'Others'];
        const typeOptions = types.map(t =>
            `<option value="${t}" ${t === report.type ? 'selected' : ''}>${t}</option>`
        ).join('');

        container.innerHTML = `
            <div class="modal-overlay modal-overlay--centered" onclick="if(event.target===this) MyReportsPage.closeEditModal()">
                <div class="modal report-edit-modal">
                    <button type="button" class="post-detail-modal__close" onclick="MyReportsPage.closeEditModal()" aria-label="Close">
                        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    <div class="modal__title">Edit Report</div>
                    <form id="report-edit-form" onsubmit="event.preventDefault(); MyReportsPage.submitEdit(${report.id})">
                        <div class="input-group">
                            <label class="input-group__label" for="re-title">Title</label>
                            <input class="input-group__field" type="text" id="re-title" required value="${this.escape(report.title || '')}">
                        </div>
                        <div class="input-group">
                            <label class="input-group__label" for="re-type">Type</label>
                            <select class="input-group__field" id="re-type" required>${typeOptions}</select>
                        </div>
                        <div class="input-group">
                            <label class="input-group__label" for="re-location">Location</label>
                            <input class="input-group__field" type="text" id="re-location" value="${this.escape(report.location || '')}">
                        </div>
                        <div class="input-group">
                            <label class="input-group__label" for="re-desc">Description</label>
                            <textarea class="input-group__field" id="re-desc" rows="4">${this.escape(report.description || '')}</textarea>
                        </div>
                        <div class="modal__actions" style="margin-top: var(--spacing-lg); display:grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);">
                            <button type="button" class="btn btn--outline" onclick="MyReportsPage.closeEditModal()">Cancel</button>
                            <button type="submit" class="btn btn--primary" id="re-submit">Save Changes</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.style.overflow = 'hidden';
        setTimeout(() => { const t = document.getElementById('re-title'); if (t) t.focus(); }, 100);
    },

    closeEditModal() {
        const container = document.getElementById('report-edit-modal-container');
        if (container) container.remove();
        document.body.style.overflow = '';
    },

    async submitEdit(reportId) {
        const title = document.getElementById('re-title').value.trim();
        const type = document.getElementById('re-type').value;
        const location = document.getElementById('re-location').value.trim();
        const description = document.getElementById('re-desc').value.trim();

        if (!title) {
            if (window.Toast) Toast.show('Title is required.', { type: 'error' });
            else alert('Title is required.');
            return;
        }

        const btn = document.getElementById('re-submit');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

        try {
            const res = await Store.apiFetch('/api/reports/' + reportId, {
                method: 'PUT',
                body: JSON.stringify({ title, type, location, description }),
            });
            if (!res.success) {
                if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
                if (window.Toast) Toast.show(res.message || 'Failed to save changes.', { type: 'error' });
                else alert(res.message || 'Failed to save changes.');
                return;
            }
            this.closeEditModal();
            if (window.Toast) Toast.show('Report updated.', { type: 'success', duration: 2500 });
            this.loadData();
        } catch (err) {
            if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
            if (window.Toast) Toast.show('Network error. Please try again.', { type: 'error' });
            else alert('Network error. Please try again.');
        }
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
        // Repaint the whole tab strip so the `active` class is applied via
        // the render template — avoids relying on the global `event`, which
        // is undefined under strict mode and on programmatic invocations.
        const container = document.getElementById('app-content');
        if (container) {
            container.innerHTML = this.render();
        } else {
            this.renderReportsList();
        }
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
        return date.toLocaleDateString('en-PH', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            timeZone: 'Asia/Manila',
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
