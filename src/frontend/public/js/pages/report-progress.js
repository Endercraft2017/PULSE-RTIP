/* ============================================================
   Report Progress Page
   ============================================================
   Table of Contents:
   1. Render method
   2. Data loading
   3. Helper methods
   ============================================================ */

const ReportProgressPage = {
    render() {
        setTimeout(() => this.loadData(), 0);

        return `
            <div class="page-padding">
                <div class="progress-summary" id="progress-stats">
                    <div class="progress-stat progress-stat--pending">
                        <div class="progress-stat__value" id="rp-pending">--</div>
                        <div class="progress-stat__label">Pending</div>
                    </div>
                    <div class="progress-stat progress-stat--investigating">
                        <div class="progress-stat__value" id="rp-investigating">--</div>
                        <div class="progress-stat__label">Investigating</div>
                    </div>
                    <div class="progress-stat progress-stat--resolved">
                        <div class="progress-stat__value" id="rp-resolved">--</div>
                        <div class="progress-stat__label">Resolved</div>
                    </div>
                    <div class="progress-stat progress-stat--total">
                        <div class="progress-stat__value" id="rp-total">--</div>
                        <div class="progress-stat__label">Total Reports</div>
                    </div>
                </div>

                <div class="card mb-lg" id="progress-bars">
                    <div class="progress-bar-container">
                        <div class="progress-bar-label"><span>Resolution Rate</span><span id="rp-res-pct">--%</span></div>
                        <div class="progress-bar"><div class="progress-bar__fill" id="rp-res-bar" style="width: 0%; background: var(--color-success);"></div></div>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar-label"><span>Response Rate</span><span id="rp-resp-pct">--%</span></div>
                        <div class="progress-bar"><div class="progress-bar__fill" id="rp-resp-bar" style="width: 0%; background: var(--color-info);"></div></div>
                    </div>
                </div>

                <div class="section-header">
                    <div class="section-header__title">Recent Reports</div>
                </div>
                <div class="card" style="padding: var(--spacing-md) var(--spacing-lg);" id="rp-reports-list">
                    <div class="loading-state">Loading reports...</div>
                </div>
            </div>
        `;
    },

    async loadData() {
        try {
            const isAdmin = Store.get('role') === 'admin';
            const endpoints = [Store.apiFetch('/api/reports')];
            if (isAdmin) endpoints.push(Store.apiFetch('/api/dashboard/stats'));

            const results = await Promise.all(endpoints);
            const reports = results[0].success ? results[0].data : [];

            let pending, investigating, resolved, total;

            if (isAdmin && results[1] && results[1].success) {
                const s = results[1].data;
                pending = s.pendingCount;
                investigating = s.investigatingCount;
                resolved = s.resolvedCount;
                total = pending + investigating + resolved;
            } else {
                pending = reports.filter(r => r.status === 'pending' || r.status === 'submitted').length;
                investigating = reports.filter(r => r.status === 'investigating').length;
                resolved = reports.filter(r => r.status === 'resolved').length;
                total = reports.length;
            }

            this.updateStats(pending, investigating, resolved, total);
            this.renderReports(reports.slice(0, 5));
        } catch (err) {
            console.error('Failed to load report progress:', err);
        }
    },

    updateStats(pending, investigating, resolved, total) {
        const el = (id) => document.getElementById(id);
        if (el('rp-pending')) el('rp-pending').textContent = pending;
        if (el('rp-investigating')) el('rp-investigating').textContent = investigating;
        if (el('rp-resolved')) el('rp-resolved').textContent = resolved;
        if (el('rp-total')) el('rp-total').textContent = total;

        const resPct = total > 0 ? Math.round((resolved / total) * 100) : 0;
        const respPct = total > 0 ? Math.round(((investigating + resolved) / total) * 100) : 0;

        if (el('rp-res-pct')) el('rp-res-pct').textContent = resPct + '%';
        if (el('rp-resp-pct')) el('rp-resp-pct').textContent = respPct + '%';
        if (el('rp-res-bar')) el('rp-res-bar').style.width = resPct + '%';
        if (el('rp-resp-bar')) el('rp-resp-bar').style.width = respPct + '%';
    },

    renderReports(reports) {
        const container = document.getElementById('rp-reports-list');
        if (!container) return;

        if (reports.length === 0) {
            container.innerHTML = '<div class="empty-state">No reports yet.</div>';
            return;
        }

        container.innerHTML = reports.map(r => `
            <div class="report-item">
                <div class="report-item__indicator report-item__indicator--${r.status}"></div>
                <div class="report-item__content">
                    <div class="report-item__title">${r.title}</div>
                    <div class="report-item__meta">${r.location || 'Unknown location'}</div>
                    <div class="report-item__status"><span class="badge badge--${r.status}">${r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span></div>
                </div>
            </div>
        `).join('');
    }
};
