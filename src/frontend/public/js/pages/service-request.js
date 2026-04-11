/* ============================================================
   Service Request Progress Page
   ============================================================
   Table of Contents:
   1. Render method
   2. Data loading
   3. Helper methods
   ============================================================ */

const ServiceRequestPage = {
    render() {
        setTimeout(() => this.loadData(), 0);

        return `
            <div class="page-padding">
                <div class="section-header">
                    <div class="section-header__title">Recently Updated</div>
                </div>
                <div class="card" style="padding: var(--spacing-md) var(--spacing-lg);" id="sr-list">
                    <div class="loading-state">Loading requests...</div>
                </div>
            </div>
        `;
    },

    async loadData() {
        try {
            const res = await Store.apiFetch('/api/reports');
            if (res.success) {
                const sorted = res.data.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
                this.renderList(sorted);
            }
        } catch (err) {
            console.error('Failed to load service requests:', err);
        }
    },

    renderList(reports) {
        const container = document.getElementById('sr-list');
        if (!container) return;

        if (reports.length === 0) {
            container.innerHTML = '<div class="empty-state">No service requests yet.</div>';
            return;
        }

        container.innerHTML = reports.map(r => `
            <div class="report-item">
                <div class="report-item__indicator report-item__indicator--${r.status}"></div>
                <div class="report-item__content">
                    <div class="report-item__title">${r.title}</div>
                    <div class="report-item__meta">Status: ${r.status.charAt(0).toUpperCase() + r.status.slice(1)}</div>
                    <div class="report-item__meta">Updated ${this.timeAgo(r.updated_at)}</div>
                    <div class="report-item__status"><span class="badge badge--${r.status}">${r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span></div>
                </div>
            </div>
        `).join('');
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
