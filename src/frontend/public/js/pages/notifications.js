/* ============================================================
   Notifications Page
   ============================================================
   Reference: index10.html (Figma export)
   Report status updates and notification feed.
   Table of Contents:
   1. Render method
   2. Data loading
   3. Helper methods
   ============================================================ */

const NotificationsPage = {
    render() {
        setTimeout(() => this.loadData(), 0);

        return `
            <div class="page-padding">
                <div class="mb-lg">
                    <h2 style="margin-bottom: 4px;">Notifications</h2>
                    <p class="text-sm text-muted">Stay updated on your report statuses</p>
                </div>

                <div id="notifications-list">
                    <div class="loading-state">Loading notifications...</div>
                </div>
            </div>
        `;
    },

    async loadData() {
        try {
            const res = await Store.apiFetch('/api/notifications');
            if (res.success) {
                this.renderNotifications(res.data.notifications);
                Store.set('notificationCount', res.data.unreadCount);
            }
        } catch (err) {
            console.error('Failed to load notifications:', err);
        }
    },

    renderNotifications(notifications) {
        const container = document.getElementById('notifications-list');
        if (!container) return;

        if (notifications.length === 0) {
            container.innerHTML = '<div class="empty-state">No notifications yet.</div>';
            return;
        }

        container.innerHTML = notifications.map(n => `
            <div class="notification-card">
                <div class="notification-card__icon notification-card__icon--${n.status || 'pending'}">
                    ${this.getStatusIcon(n.status)}
                </div>
                <div class="notification-card__content">
                    <div class="notification-card__title">${n.title}</div>
                    <div class="notification-card__text">${n.text || ''}</div>
                    <div class="notification-card__meta">
                        <span class="notification-card__time">${this.timeAgo(n.created_at)}</span>
                        <span class="badge badge--${n.status || 'pending'}">${this.capitalizeStatus(n.status)}</span>
                    </div>
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
        if (diffMins < 60) return `${diffMins} min ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    },

    getStatusIcon(status) {
        const icons = {
            investigating: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
            resolved: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>',
            pending: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'
        };
        return icons[status] || icons.pending;
    },

    capitalizeStatus(status) {
        if (!status) return 'Pending';
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
};
