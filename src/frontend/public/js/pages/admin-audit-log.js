/* ============================================================
   Admin Audit Log Page
   ============================================================
   Paginated list of privileged admin actions (approvals,
   rejections, status changes, hazard creation, user deletion,
   SMS settings changes). Read-only — the log is append-only.
   ============================================================ */

const AdminAuditLogPage = {
    /* ----- State ----- */
    entries: [],
    total: 0,
    limit: 50,
    offset: 0,
    expanded: {},   // id -> bool, tracks which `details` blobs are expanded

    /* ----- Render ----- */
    render() {
        setTimeout(() => this.loadData(), 0);

        return `
            <style>
                .audit-log__table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: var(--font-size-sm);
                }
                .audit-log__table th,
                .audit-log__table td {
                    text-align: left;
                    padding: 10px 8px;
                    border-bottom: 1px solid var(--color-gray-100);
                    vertical-align: top;
                }
                .audit-log__table th {
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: var(--color-gray-500);
                    background: var(--color-gray-100);
                }
                .audit-log__row:hover { background: var(--color-gray-100); }
                .audit-log__details {
                    font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
                    font-size: 11px;
                    white-space: pre-wrap;
                    word-break: break-word;
                    margin-top: 6px;
                    padding: 8px;
                    background: var(--color-gray-100);
                    border-radius: 4px;
                    color: var(--color-gray-700);
                }
                .audit-log__pager {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: var(--spacing-sm);
                    margin-top: var(--spacing-md);
                }
                .audit-log__role {
                    font-size: 10px;
                    padding: 1px 6px;
                    border-radius: 4px;
                    background: var(--color-gray-200);
                    color: var(--color-gray-700);
                    margin-left: 4px;
                    vertical-align: middle;
                }
                .audit-log__role--admin {
                    background: var(--color-primary);
                    color: white;
                }
                .audit-log__action-chip {
                    display: inline-block;
                    font-size: 11px;
                    font-weight: 600;
                    padding: 2px 8px;
                    border-radius: 4px;
                    background: var(--color-gray-200);
                    color: var(--color-gray-700);
                }
                .audit-log__action-chip--destructive {
                    background: #FEE2E2;
                    color: #B91C1C;
                }
                .audit-log__action-chip--positive {
                    background: #DCFCE7;
                    color: #15803D;
                }
            </style>
            <div class="page-padding">
                <div class="welcome-card">
                    <div class="welcome-card__title">Audit Log</div>
                    <div class="welcome-card__text">
                        Append-only record of privileged admin actions. Useful for
                        MDRRMO leadership review and dispute resolution.
                    </div>
                </div>

                <div class="card">
                    <div class="section-header" style="padding: 0 0 var(--spacing-md) 0;">
                        <div class="section-header__title">Recent Activity</div>
                        <span id="audit-log-status" class="text-sm" style="color: var(--color-gray-500);">Loading…</span>
                    </div>
                    <div id="audit-log-body">
                        <div class="loading-state">Loading audit log…</div>
                    </div>
                </div>
            </div>
        `;
    },

    /* ----- Data ----- */
    async loadData() {
        this.setStatus('Loading…');
        try {
            const qs = `?limit=${this.limit}&offset=${this.offset}`;
            const res = await Store.apiFetch('/api/admin/audit-log' + qs);
            if (!res.success) {
                this.renderError(res.message || 'Failed to load audit log.');
                return;
            }
            this.entries = Array.isArray(res.data) ? res.data : [];
            this.total = (res.pagination && res.pagination.total) || this.entries.length;
            this.setStatus(`${this.total} entries`);
            this.renderTable();
        } catch (err) {
            this.renderError('Network error — check your connection.');
        }
    },

    renderError(msg) {
        const body = document.getElementById('audit-log-body');
        if (body) body.innerHTML = `<div class="text-sm" style="color: var(--color-danger);">${this.escape(msg)}</div>`;
        this.setStatus('Error');
    },

    renderTable() {
        const body = document.getElementById('audit-log-body');
        if (!body) return;

        if (this.entries.length === 0) {
            body.innerHTML = `<div class="text-sm" style="color: var(--color-gray-500); padding: var(--spacing-md) 0;">No audit entries yet.</div>`;
            return;
        }

        const rows = this.entries.map(e => this.renderRow(e)).join('');
        const from = this.offset + 1;
        const to = Math.min(this.offset + this.entries.length, this.total);
        const hasPrev = this.offset > 0;
        const hasNext = (this.offset + this.entries.length) < this.total;

        body.innerHTML = `
            <div style="overflow-x: auto;">
                <table class="audit-log__table">
                    <thead>
                        <tr>
                            <th style="width: 160px;">When</th>
                            <th style="width: 200px;">Actor</th>
                            <th style="width: 160px;">Action</th>
                            <th>Target</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <div class="audit-log__pager">
                <div style="color: var(--color-gray-500); font-size: var(--font-size-sm);">
                    Showing ${from}–${to} of ${this.total}
                </div>
                <div style="display: flex; gap: var(--spacing-sm);">
                    <button type="button" class="btn btn--outline btn--sm"
                            ${hasPrev ? '' : 'disabled'}
                            onclick="AdminAuditLogPage.prev()">Previous</button>
                    <button type="button" class="btn btn--outline btn--sm"
                            ${hasNext ? '' : 'disabled'}
                            onclick="AdminAuditLogPage.next()">Next</button>
                </div>
            </div>
        `;
    },

    renderRow(e) {
        const when = this.formatPhDate(e.created_at);
        const actorName = this.escape(e.actor_name || 'Unknown');
        const actorRole = e.actor_role || '';
        const roleChip = actorRole
            ? `<span class="audit-log__role ${actorRole === 'admin' ? 'audit-log__role--admin' : ''}">${this.escape(actorRole)}</span>`
            : '';
        const actionCls = this.actionClass(e.action);
        const actionLabel = this.escape(this.humanAction(e.action));
        const targetSummary = this.escape(this.targetSummary(e));
        const detailsStr = this.formatDetails(e.details);
        const expanded = !!this.expanded[e.id];
        const toggleLabel = expanded ? 'Hide details' : 'Show details';
        const detailsBlock = detailsStr
            ? (expanded
                ? `<div class="audit-log__details">${this.escape(detailsStr)}</div>
                   <button type="button" class="btn btn--outline btn--sm" style="margin-top: 6px;" onclick="AdminAuditLogPage.toggleDetails(${e.id})">${toggleLabel}</button>`
                : `<button type="button" class="btn btn--outline btn--sm" onclick="AdminAuditLogPage.toggleDetails(${e.id})">${toggleLabel}</button>`)
            : '';

        return `
            <tr class="audit-log__row">
                <td style="color: var(--color-gray-600);">${this.escape(when)}</td>
                <td>${actorName}${roleChip}</td>
                <td><span class="audit-log__action-chip ${actionCls}">${actionLabel}</span></td>
                <td>
                    <div>${targetSummary}</div>
                    ${detailsBlock}
                </td>
            </tr>
        `;
    },

    /* ----- Pagination ----- */
    prev() {
        if (this.offset === 0) return;
        this.offset = Math.max(0, this.offset - this.limit);
        this.expanded = {};
        this.loadData();
    },

    next() {
        if ((this.offset + this.entries.length) >= this.total) return;
        this.offset += this.limit;
        this.expanded = {};
        this.loadData();
    },

    toggleDetails(id) {
        this.expanded[id] = !this.expanded[id];
        this.renderTable();
    },

    /* ----- Helpers ----- */
    setStatus(text) {
        const el = document.getElementById('audit-log-status');
        if (el) el.textContent = text;
    },

    humanAction(action) {
        const map = {
            user_approved: 'User approved',
            user_rejected: 'User rejected',
            user_deleted: 'User deleted',
            self_delete: 'Self deleted',
            hazard_created: 'Hazard created',
            report_status_changed: 'Report status changed',
            sms_settings_updated: 'SMS settings updated',
        };
        return map[action] || action;
    },

    actionClass(action) {
        if (action === 'user_rejected' || action === 'user_deleted' || action === 'self_delete') {
            return 'audit-log__action-chip--destructive';
        }
        if (action === 'user_approved' || action === 'hazard_created') {
            return 'audit-log__action-chip--positive';
        }
        return '';
    },

    targetSummary(e) {
        const d = e.details || {};
        if (e.target_type === 'user' && (d.name || d.email)) {
            return `${d.name || ''}${d.email ? ' <' + d.email + '>' : ''}`.trim();
        }
        if (e.target_type === 'hazard' && d.title) {
            return `${d.title}${d.severity ? ' (' + d.severity + ')' : ''}`;
        }
        if (e.target_type === 'report' && (d.title || d.from || d.to)) {
            const titlePart = d.title ? d.title + ' — ' : '';
            const transition = (d.from || d.to)
                ? `${(d.from || '—').replace(/_/g, ' ')} → ${(d.to || '—').replace(/_/g, ' ')}`
                : '';
            return `${titlePart}${transition}`.trim();
        }
        if (e.target_type === 'app_setting') {
            return 'SMS gateway';
        }
        if (e.target_type && e.target_id) return `${e.target_type} #${e.target_id}`;
        return e.target_type || '—';
    },

    formatDetails(details) {
        if (details == null) return '';
        if (typeof details === 'string') return details;
        try { return JSON.stringify(details, null, 2); }
        catch (_) { return String(details); }
    },

    formatPhDate(s) {
        if (!s) return '—';
        const d = new Date(s);
        if (isNaN(d.getTime())) return String(s);
        // PH locale, 24h display for dispatcher-style clarity.
        return d.toLocaleString('en-PH', {
            year: 'numeric', month: 'short', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false,
            timeZone: 'Asia/Manila',
        });
    },

    escape(v) {
        if (v === null || v === undefined) return '';
        return String(v)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },
};

window.AdminAuditLogPage = AdminAuditLogPage;
