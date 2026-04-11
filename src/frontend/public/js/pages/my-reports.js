/* ============================================================
   My Reports Page
   ============================================================
   Reference: index3.html / index6.html / index8.html (Figma export)
   Displays user-submitted incident reports with filter tabs.
   Table of Contents:
   1. State
   2. Render method
   3. Data loading
   4. Filter handling
   ============================================================ */

const MyReportsPage = {
    activeFilter: 'all',
    reports: [],

    render() {
        setTimeout(() => this.loadData(), 0);

        return `
            <div class="page-padding">
                <div class="filter-tabs" id="report-filters">
                    <button class="filter-tabs__tab ${this.activeFilter === 'all' ? 'active' : ''}"
                            onclick="MyReportsPage.setFilter('all')">All</button>
                    <button class="filter-tabs__tab ${this.activeFilter === 'submitted' ? 'active' : ''}"
                            onclick="MyReportsPage.setFilter('submitted')">Submitted</button>
                    <button class="filter-tabs__tab ${this.activeFilter === 'under-review' ? 'active' : ''}"
                            onclick="MyReportsPage.setFilter('under-review')">Under Review</button>
                </div>

                <div id="reports-list">
                    <div class="loading-state">Loading reports...</div>
                </div>
            </div>
        `;
    },

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

    renderReportsList() {
        const filtered = this.activeFilter === 'all'
            ? this.reports
            : this.reports.filter(r => r.status === this.activeFilter);

        const container = document.getElementById('reports-list');
        if (!container) return;

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state">No reports found.</div>';
            return;
        }

        container.innerHTML = filtered.map(report => `
            <div class="incident-card">
                <div class="incident-card__header">
                    <span class="incident-card__title">${report.title}</span>
                    <span class="badge badge--type">${report.type}</span>
                </div>
                <div class="incident-card__description">
                    ${report.description || ''}
                </div>
                ${report.images && report.images.length > 0 ? `
                    <div class="incident-card__images">
                        ${report.images.map(img => `<div class="incident-card__image" style="background-image: url('${img.file_path}')"></div>`).join('')}
                    </div>
                ` : ''}
                <div class="card__meta">
                    <div class="card__meta-item">
                        <svg viewBox="0 0 24 24">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        ${report.location || 'Unknown location'}
                    </div>
                    <div class="card__meta-item">
                        <svg viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        ${this.formatDate(report.created_at)}
                    </div>
                    <div class="card__meta-item">
                        <svg viewBox="0 0 24 24">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        ${report.submitted_by_name || 'Unknown'}
                    </div>
                </div>
            </div>
        `).join('');
    },

    setFilter(filter) {
        this.activeFilter = filter;
        this.renderReportsList();
        document.querySelectorAll('.filter-tabs__tab').forEach(tab => {
            tab.classList.remove('active');
        });
        event.target.classList.add('active');
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }
};
