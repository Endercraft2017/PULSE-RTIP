/* ============================================================
   Notifications Page
   ============================================================
   Reference: citizen-notifications.html (Figma export)
   Report status updates and notification feed for both
   citizen and admin users.
   Table of Contents:
   1. Render method
   2. Data loading
   3. Mark all as read
   4. Notification card rendering
   5. Helper methods
   ============================================================ */

const NotificationsPage = {
    render() {
        setTimeout(() => this.loadData(), 0);

        const role = Store.get('role');
        const subtitle = role === 'admin'
            ? 'New reports and system updates'
            : 'Stay updated on your report statuses';

        return `
            <div class="page-padding">
                <div class="mb-lg" style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div>
                        <h2 style="margin-bottom: 4px;">Notifications</h2>
                        <p class="text-sm text-muted">${subtitle}</p>
                    </div>
                    <button type="button" class="btn btn--outline btn--sm" id="mark-read-btn"
                            onclick="NotificationsPage.markAllRead()" style="white-space:nowrap;">
                        Mark all read
                    </button>
                </div>

                <div id="notifications-list">
                    <div class="loading-state">Loading notifications...</div>
                </div>
            </div>
        `;
    },

    /* --------------------------------------------------------
     * 2. Data Loading
     * -------------------------------------------------------- */
    async loadData() {
        try {
            const res = await Store.apiFetch('/api/notifications');
            if (res.success) {
                this.renderNotifications(res.data.notifications);
                Store.set('notificationCount', res.data.unreadCount);
                Header.render();
            }
        } catch (err) {
            console.error('Failed to load notifications:', err);
        }
    },

    /* --------------------------------------------------------
     * 3. Mark All as Read
     * -------------------------------------------------------- */
    async markAllRead() {
        const btn = document.getElementById('mark-read-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Done'; }

        try {
            await Store.apiFetch('/api/notifications/read', { method: 'PUT' });
            Store.set('notificationCount', 0);
            Header.render();

            // Update visual state of cards
            document.querySelectorAll('.notification-card--unread').forEach(card => {
                card.classList.remove('notification-card--unread');
            });
        } catch (err) {
            console.error('Failed to mark as read:', err);
        }
    },

    /* --------------------------------------------------------
     * 4. Notification Card Rendering
     * -------------------------------------------------------- */
    renderNotifications(notifications) {
        const container = document.getElementById('notifications-list');
        if (!container) return;

        if (!notifications || notifications.length === 0) {
            container.innerHTML = '<div class="empty-state">No notifications yet.</div>';
            return;
        }

        container.innerHTML = notifications.map(n => {
            const isUnread = !n.is_read;
            return `
                <div class="notification-card ${isUnread ? 'notification-card--unread' : ''}">
                    <div class="notification-card__icon notification-card__icon--${n.status || 'pending'}">
                        ${this.getStatusIcon(n.status)}
                    </div>
                    <div class="notification-card__content">
                        <div class="notification-card__title">${n.title || 'Notification'}</div>
                        <div class="notification-card__text">${n.text || ''}</div>
                        <div class="notification-card__meta">
                            <span class="notification-card__time">${this.timeAgo(n.created_at)}</span>
                            ${n.status ? `<span class="badge badge--${n.status}">${this.capitalizeStatus(n.status)}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    /* --------------------------------------------------------
     * 5. Helper Methods
     * -------------------------------------------------------- */
    timeAgo(dateStr) {
        if (!dateStr) return '';
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return diffMins + ' min ago';
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return diffHours + 'h ago';
        const diffDays = Math.floor(diffHours / 24);
        return diffDays + 'd ago';
    },

    getStatusIcon(status) {
        const icons = {
            investigating: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
            resolved: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>',
            pending: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
            rejected: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
        };
        return icons[status] || icons.pending;
    },

    capitalizeStatus(status) {
        if (!status) return 'Pending';
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
};
