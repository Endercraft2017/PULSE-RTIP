/* ============================================================
   Detail Modal — shared full-detail view for incidents & hazards
   ============================================================
   Usage:
     DetailModal.showIncident(incidentObj)
     DetailModal.showHazard(hazardObj)
   ============================================================ */

const DetailModal = {

    /* --------------------------------------------------------
     * Show incident detail
     * -------------------------------------------------------- */
    showIncident(data) {
        if (typeof data === 'string') data = JSON.parse(data);

        const statusMap = {
            pending: { label: 'Pending', cls: 'pending' },
            submitted: { label: 'Submitted', cls: 'submitted' },
            investigating: { label: 'Investigating', cls: 'investigating' },
            in_progress: { label: 'In Progress', cls: 'in_progress' },
            pending_confirmation: { label: 'Pending Confirmation', cls: 'pending_confirmation' },
            resolved: { label: 'Resolved', cls: 'resolved' },
            rejected: { label: 'Rejected', cls: 'rejected' },
            cancelled: { label: 'Cancelled', cls: 'cancelled' },
        };
        const st = statusMap[data.status] || statusMap.pending;

        this._open(`
            <div class="detail-modal__badge-row">
                <span class="badge badge--type">${this._esc(data.type)}</span>
                <span class="badge badge--${st.cls}">${st.label}</span>
            </div>

            <h2 class="detail-modal__title">${this._esc(data.title)}</h2>

            ${data.description ? '<p class="detail-modal__desc">' + this._esc(data.description) + '</p>' : ''}

            <div class="detail-modal__meta-grid">
                <div class="detail-modal__meta-item">
                    <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    <div>
                        <div class="detail-modal__meta-label">Location</div>
                        <div class="detail-modal__meta-value">${this._esc(data.location || 'Not specified')}</div>
                    </div>
                </div>
                <div class="detail-modal__meta-item">
                    <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    <div>
                        <div class="detail-modal__meta-label">Reported by</div>
                        <div class="detail-modal__meta-value">${this._esc(data.submitted_by_name || 'Unknown')}</div>
                    </div>
                </div>
                <div class="detail-modal__meta-item">
                    <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <div>
                        <div class="detail-modal__meta-label">Submitted</div>
                        <div class="detail-modal__meta-value">${this._formatDate(data.created_at)}</div>
                    </div>
                </div>
                <div class="detail-modal__meta-item">
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <div>
                        <div class="detail-modal__meta-label">Last updated</div>
                        <div class="detail-modal__meta-value">${this._formatDate(data.updated_at || data.created_at)}</div>
                    </div>
                </div>
            </div>

            ${data.latitude && data.longitude ? `
                <div class="detail-modal__coords">
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v4m0 12v4M2 12h4m12 0h4"></path></svg>
                    GPS: ${data.latitude}, ${data.longitude}
                </div>
            ` : ''}
        `);
    },

    /* --------------------------------------------------------
     * Show hazard detail
     * -------------------------------------------------------- */
    showHazard(data) {
        if (typeof data === 'string') data = JSON.parse(data);

        const severityMap = {
            high:   { label: 'High',   cls: 'high' },
            medium: { label: 'Medium', cls: 'warning' },
            low:    { label: 'Low',    cls: 'info' },
        };
        const sv = severityMap[data.severity] || severityMap.medium;

        this._open(`
            <div class="detail-modal__badge-row">
                <span class="badge badge--${sv.cls}">${sv.label} Severity</span>
            </div>

            <h2 class="detail-modal__title">${this._esc(data.title)}</h2>

            ${data.description ? '<p class="detail-modal__desc">' + this._esc(data.description) + '</p>' : ''}

            <div class="detail-modal__meta-grid">
                <div class="detail-modal__meta-item">
                    <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    <div>
                        <div class="detail-modal__meta-label">Location</div>
                        <div class="detail-modal__meta-value">${this._esc(data.location || 'Not specified')}</div>
                    </div>
                </div>
                <div class="detail-modal__meta-item">
                    <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <div>
                        <div class="detail-modal__meta-label">Created</div>
                        <div class="detail-modal__meta-value">${this._formatDate(data.created_at)}</div>
                    </div>
                </div>
                <div class="detail-modal__meta-item">
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <div>
                        <div class="detail-modal__meta-label">Last updated</div>
                        <div class="detail-modal__meta-value">${this._formatDate(data.updated_at)}</div>
                    </div>
                </div>
            </div>

            ${data.affected_barangays ? `
                <div class="detail-modal__section">
                    <div class="detail-modal__section-title">Affected Areas</div>
                    <div class="detail-modal__section-text">${this._esc(data.affected_barangays)}</div>
                </div>
            ` : ''}

            <div class="detail-modal__section">
                <div class="detail-modal__section-title">Safety Advisory</div>
                <div class="detail-modal__section-text">
                    Stay informed about active hazards in your area. Follow official safety instructions and be prepared to evacuate if necessary.
                </div>
            </div>
        `);
    },

    /* --------------------------------------------------------
     * Core open / close
     * -------------------------------------------------------- */
    _open(bodyHtml) {
        let container = document.getElementById('detail-modal-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'detail-modal-container';
            document.body.appendChild(container);
        }

        container.innerHTML = `
            <div class="modal-overlay modal-overlay--centered" onclick="if(event.target===this) DetailModal.close()">
                <div class="modal detail-modal">
                    <button type="button" class="detail-modal__close" onclick="DetailModal.close()" aria-label="Close">
                        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    <div class="detail-modal__body">
                        ${bodyHtml}
                    </div>
                    <div class="detail-modal__footer">
                        <button type="button" class="btn btn--primary btn--block" onclick="DetailModal.close()">Close</button>
                    </div>
                </div>
            </div>
        `;
        document.body.style.overflow = 'hidden';
    },

    close() {
        const container = document.getElementById('detail-modal-container');
        if (container) container.innerHTML = '';
        document.body.style.overflow = '';
    },

    /* --------------------------------------------------------
     * Helpers
     * -------------------------------------------------------- */
    _esc(str) {
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    _formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    },
};

window.DetailModal = DetailModal;
