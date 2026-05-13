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
    _seenAdminRequestIds: new Set(),
    _pendingById: {}, // actor_user_id -> { id_type, id_number, id_document_path, ... }

    async loadData() {
        try {
            const isAdmin = Store.get('role') === 'admin';
            // Admins need ID details to render approval cards — load them in
            // parallel with the notification feed so the UI paints once.
            const [res, pendingRes] = await Promise.all([
                Store.apiFetch('/api/notifications'),
                isAdmin ? Store.apiFetch('/api/admin-requests').catch(() => null) : Promise.resolve(null),
            ]);
            if (pendingRes && pendingRes.success && Array.isArray(pendingRes.data)) {
                this._pendingById = {};
                for (const u of pendingRes.data) this._pendingById[u.id] = u;
            }
            if (res.success) {
                this.renderNotifications(res.data.notifications);
                Store.set('notificationCount', res.data.unreadCount);
                Header.render();
                this._popAdminRequestToasts(res.data.notifications);
            }
        } catch (err) {
            console.error('Failed to load notifications:', err);
        }
    },

    /** Pop a transient toast for any unseen admin-request notifications. */
    _popAdminRequestToasts(notifications) {
        if (Store.get('role') !== 'admin' || typeof Toast === 'undefined') return;
        for (const n of (notifications || [])) {
            if (n.type !== 'admin_request') continue;
            if (n.is_read) continue;
            if (this._seenAdminRequestIds.has(n.id)) continue;
            this._seenAdminRequestIds.add(n.id);
            Toast.show(n.text || 'A user is requesting admin access.', {
                type: 'info',
                title: n.title || 'Admin request',
                duration: 5000,
            });
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

        const isAdmin = Store.get('role') === 'admin';
        container.innerHTML = notifications.map(n => {
            if (n.type === 'admin_request') return this._renderAdminRequestCard(n);
            const isUnread = !n.is_read;
            // Prefer the live report status (joined from reports table) over
            // the snapshot stored on the notification — the snapshot goes
            // stale the moment the report moves through workflow.
            const liveStatus = n.report_current_status || n.status;
            const clickable = isAdmin && n.report_id;
            const cardAttrs = clickable
                ? `class="notification-card notification-card--clickable ${isUnread ? 'notification-card--unread' : ''}" onclick="NotificationsPage.openReport(${n.report_id})"`
                : `class="notification-card ${isUnread ? 'notification-card--unread' : ''}"`;
            return `
                <div ${cardAttrs}>
                    <div class="notification-card__icon notification-card__icon--${liveStatus || 'pending'}">
                        ${this.getStatusIcon(liveStatus)}
                    </div>
                    <div class="notification-card__content">
                        <div class="notification-card__title">${n.title || 'Notification'}</div>
                        <div class="notification-card__text">${n.text || ''}</div>
                        <div class="notification-card__meta">
                            <span class="notification-card__time">${this.timeAgo(n.created_at)}</span>
                            ${liveStatus ? `<span class="badge badge--${liveStatus}">${this.statusLabel(liveStatus)}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

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

    openReport(reportId) {
        window.location.hash = '#/dashboard?focus=' + reportId;
    },

    _renderAdminRequestCard(n) {
        const isUnread = !n.is_read;
        // Discriminate citizen signup from admin-role upgrade. Title is set
        // server-side; we colour the badge differently for each kind.
        const isAdminUpgrade = /admin/i.test(n.title || '') && !/citizen/i.test(n.title || '');
        const badgeText = isAdminUpgrade ? 'Admin Request' : 'Citizen Signup';
        const badgeClass = isAdminUpgrade ? 'badge--rejected' : 'badge--investigating';

        // ID block — enriched from the parallel /api/admin-requests fetch.
        // If the pending row is missing (race — just approved by another tab)
        // we render the basic card so the admin can still reject.
        const pending = this._pendingById[n.actor_user_id];
        const idType = pending && pending.id_type ? pending.id_type : '';
        const idNumber = pending && pending.id_number ? pending.id_number : '';
        const idDocPath = pending && pending.id_document_path ? pending.id_document_path : '';
        const idImgUrl = idDocPath ? (Store.mediaUrl(idDocPath) || '') : '';

        const idBlock = (idType || idNumber || idImgUrl) ? `
            <div class="id-verification-block" style="margin-top:10px;padding:10px;border:1px solid var(--color-border, #e5e7eb);border-radius:8px;background:var(--color-surface, #fafafa);">
                <div style="font-size:12px;font-weight:600;margin-bottom:6px;color:var(--color-text-muted, #6b7280);">ID VERIFICATION</div>
                ${idType ? `<div style="font-size:13px;"><strong>Type:</strong> ${this._esc(idType)}</div>` : ''}
                ${idNumber ? `<div style="font-size:13px;"><strong>Number:</strong> ${this._esc(idNumber)}</div>` : ''}
                ${idImgUrl ? `
                    <div style="margin-top:8px;">
                        <img src="${this._esc(idImgUrl)}" alt="ID document"
                             style="max-width:120px;max-height:80px;border-radius:6px;border:1px solid var(--color-border, #e5e7eb);cursor:pointer;object-fit:cover;"
                             onclick="NotificationsPage.showIdImageModal('${this._esc(idImgUrl)}')">
                        <div style="font-size:11px;color:var(--color-text-muted, #6b7280);margin-top:4px;">Tap image to view full size</div>
                    </div>
                ` : '<div style="font-size:12px;color:var(--color-text-muted,#6b7280);margin-top:6px;">No ID image uploaded.</div>'}
            </div>
        ` : '';

        return `
            <div class="notification-card notification-card--admin-request ${isUnread ? 'notification-card--unread' : ''}" id="admin-req-${n.id}">
                <div class="notification-card__icon notification-card__icon--investigating">
                    <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <div class="notification-card__content">
                    <div class="notification-card__title">${n.title || 'Account review'}</div>
                    <div class="notification-card__text">${n.text || ''}</div>
                    <div class="notification-card__meta">
                        <span class="notification-card__time">${this.timeAgo(n.created_at)}</span>
                        <span class="badge ${badgeClass}">${badgeText}</span>
                    </div>
                    ${idBlock}
                    <div class="notification-card__actions">
                        <button type="button" class="btn btn--approve btn--sm" onclick="NotificationsPage.handleAdminRequest(${n.actor_user_id}, ${n.id}, 'approve')">Approve</button>
                        <button type="button" class="btn btn--reject btn--sm" onclick="NotificationsPage.handleAdminRequest(${n.actor_user_id}, ${n.id}, 'reject')">Reject</button>
                    </div>
                </div>
            </div>
        `;
    },

    /** Opens the uploaded ID image in a simple full-screen modal. */
    showIdImageModal(url) {
        const existing = document.getElementById('id-image-modal');
        if (existing) existing.remove();
        const modal = document.createElement('div');
        modal.id = 'id-image-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;cursor:pointer;';
        modal.onclick = () => modal.remove();
        modal.innerHTML = `
            <img src="${this._esc(url)}" alt="ID document"
                 style="max-width:100%;max-height:100%;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.5);">
            <button type="button"
                    style="position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.15);color:#fff;border:none;border-radius:50%;width:40px;height:40px;font-size:22px;cursor:pointer;"
                    aria-label="Close">&times;</button>
        `;
        document.body.appendChild(modal);
    },

    _esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    async handleAdminRequest(actorId, notifId, action) {
        const card = document.getElementById('admin-req-' + notifId);
        const btns = card ? card.querySelectorAll('.btn') : [];
        btns.forEach(b => { b.disabled = true; });

        try {
            const res = await Store.apiFetch(`/api/admin-requests/${actorId}/${action}`, { method: 'PUT' });
            if (res.success) {
                if (typeof Toast !== 'undefined') {
                    const wasAdminReq = res.kind === 'admin_request';
                    const msg = action === 'approve'
                        ? (wasAdminReq ? 'User promoted to admin.' : 'Citizen account approved.')
                        : (wasAdminReq ? 'Admin request rejected.' : 'Citizen signup rejected.');
                    Toast.show(msg, { type: action === 'approve' ? 'success' : 'info', duration: 3000 });
                }
                this.loadData();
            } else {
                alert(res.message || 'Failed to update review.');
                btns.forEach(b => { b.disabled = false; });
            }
        } catch (err) {
            alert('Network error. Please try again.');
            btns.forEach(b => { b.disabled = false; });
        }
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
