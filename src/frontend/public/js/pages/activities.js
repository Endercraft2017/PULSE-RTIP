/* ============================================================
   Activities Page
   ============================================================
   Table of Contents:
   1. Render method
   2. Data loading
   3. Helper methods
   ============================================================ */

const ActivitiesPage = {
    render() {
        setTimeout(() => this.loadData(), 0);

        return `
            <div class="page-padding">
                <div class="section-header">
                    <div class="section-header__title">Recent Activity</div>
                </div>
                <div class="card" style="padding: var(--spacing-md) var(--spacing-lg);" id="activities-list">
                    <div class="loading-state">Loading activities...</div>
                </div>
            </div>
        `;
    },

    async loadData() {
        try {
            const [reportsRes, hazardsRes, notifsRes] = await Promise.all([
                Store.apiFetch('/api/reports'),
                Store.apiFetch('/api/hazards'),
                Store.apiFetch('/api/notifications'),
            ]);

            const activities = [];

            if (reportsRes.success) {
                reportsRes.data.forEach(r => {
                    activities.push({
                        type: 'report',
                        text: Store.get('role') === 'admin'
                            ? `Reviewed report <strong>${r.title}</strong>`
                            : `Submitted report <strong>${r.title}</strong>`,
                        status: r.status,
                        time: r.updated_at || r.created_at,
                    });
                });
            }

            if (hazardsRes.success && Store.get('role') === 'admin') {
                hazardsRes.data.forEach(h => {
                    activities.push({
                        type: 'hazard',
                        text: `Created hazard alert <strong>${h.title}</strong>`,
                        time: h.created_at,
                    });
                });
            }

            if (notifsRes.success) {
                const notifs = notifsRes.data.notifications || notifsRes.data;
                if (Array.isArray(notifs)) {
                    notifs.forEach(n => {
                        activities.push({
                            type: 'status',
                            text: `<strong>${n.title}</strong> - ${n.text || ''}`,
                            status: n.status,
                            time: n.created_at,
                        });
                    });
                }
            }

            activities.sort((a, b) => new Date(b.time) - new Date(a.time));
            this.renderActivities(activities.slice(0, 15));
        } catch (err) {
            console.error('Failed to load activities:', err);
        }
    },

    renderActivities(activities) {
        const container = document.getElementById('activities-list');
        if (!container) return;

        if (activities.length === 0) {
            container.innerHTML = '<div class="empty-state">No recent activity.</div>';
            return;
        }

        const iconMap = {
            status: { cls: 'activity-item__icon--status', svg: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>' },
            hazard: { cls: 'activity-item__icon--hazard', svg: '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>' },
            report: { cls: 'activity-item__icon--report', svg: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>' },
        };

        container.innerHTML = activities.map(a => {
            const icon = iconMap[a.type] || iconMap.report;
            return `
                <div class="activity-item">
                    <div class="activity-item__icon ${icon.cls}">${icon.svg}</div>
                    <div class="activity-item__content">
                        <div class="activity-item__text">${a.text}</div>
                        <div class="activity-item__time">${this.timeAgo(a.time)}</div>
                    </div>
                </div>
            `;
        }).join('');
    },

    timeAgo(dateStr) {
        if (!dateStr) return '';
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return diffMins + ' min ago';
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return diffHours + ' hour' + (diffHours > 1 ? 's' : '') + ' ago';
        const diffDays = Math.floor(diffHours / 24);
        return diffDays + ' day' + (diffDays > 1 ? 's' : '') + ' ago';
    }
};
