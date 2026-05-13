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

        // A-1: report photos uploaded by the citizen. ReportImage rows
        // sometimes carry the full "/uploads/..." path (newer rows) and
        // sometimes a bare filename (legacy / migrated SMS imports).
        // Store.mediaUrl handles both shapes and prefixes the remote API
        // origin when running natively (so /uploads/... doesn't 404 against
        // the Capacitor https://localhost shell).
        const images = Array.isArray(data.images) ? data.images : [];
        const mediaHtml = images.length ? `
            <div class="detail-modal__media-grid">
                ${images.map(img => {
                    const url = Store.mediaUrl(img.file_path || img.url || img);
                    if (!url) return '';
                    return `<a href="${url}" target="_blank" rel="noopener" class="detail-modal__media-item">
                        <img src="${url}" alt="Report photo" loading="lazy"
                             onerror="this.parentElement.style.display='none'">
                    </a>`;
                }).join('')}
            </div>
        ` : '';

        // A-2: when admin marks the report resolved, surface the latest
        // resolution note prominently at the top so the citizen sees who
        // responded and how it was handled without scrolling the timeline.
        // Slot stays empty until _loadHistory fills it in from the events
        // feed (or stays hidden if the event has no note).
        const resolutionBanner = (data.status === 'resolved')
            ? `<div id="detail-modal-resolution-slot">
                   ${data.resolution_note ? `<div class="detail-modal__resolution">
                       <div class="detail-modal__resolution-label">Resolved by MDRRMO</div>
                       <div class="detail-modal__resolution-note">${this._esc(data.resolution_note)}</div>
                   </div>` : ''}
               </div>`
            : '';

        this._open(`
            <div class="detail-modal__badge-row">
                <span class="badge badge--type">${this._esc(data.type)}</span>
                <span class="badge badge--${st.cls}">${st.label}</span>
            </div>

            <h2 class="detail-modal__title">${this._esc(data.title)}</h2>

            ${resolutionBanner}

            ${data.description ? '<p class="detail-modal__desc">' + this._esc(data.description) + '</p>' : ''}

            ${mediaHtml}

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

            <div class="detail-modal__section" id="detail-modal-history">
                <div class="detail-modal__section-title">Processing History</div>
                <div class="detail-modal__section-text" id="detail-modal-history-body"
                     style="font-size: var(--font-size-sm); color: var(--color-gray-600);">
                    Loading history…
                </div>
            </div>
        `);

        // Fetch events lazily so we don't block the modal's first paint.
        if (data && data.id) this._loadHistory(data.id);
    },

    /**
     * Pulls /api/reports/:id/events and renders a chronological list. If
     * the current user can't view the report's history (403) the section
     * is hidden rather than shown empty.
     */
    async _loadHistory(reportId) {
        const body = document.getElementById('detail-modal-history-body');
        if (!body) return;
        try {
            const res = await Store.apiFetch(`/api/reports/${reportId}/events`);
            if (!res || !res.success) {
                const section = document.getElementById('detail-modal-history');
                if (section) section.style.display = 'none';
                return;
            }
            const events = Array.isArray(res.data) ? res.data : [];
            if (events.length === 0) {
                body.innerHTML = '<em style="color: var(--color-gray-500);">No status changes yet.</em>';
                return;
            }
            body.innerHTML = events.map(ev => this._renderEvent(ev)).join('');

            // A-2: hoist the most recent resolution note (if any) into
            // the placeholder slot above the description so citizens see
            // it first. The banner stays empty unless an actual note exists.
            const slot = document.getElementById('detail-modal-resolution-slot');
            if (slot && !slot.innerHTML.trim()) {
                const lastResolved = [...events].reverse().find(e =>
                    e.to_status === 'resolved' && e.note && e.note.trim()
                );
                if (lastResolved) {
                    const actor = this._esc(lastResolved.actor_name || 'MDRRMO');
                    slot.innerHTML = `
                        <div class="detail-modal__resolution">
                            <div class="detail-modal__resolution-label">Resolved by ${actor}</div>
                            <div class="detail-modal__resolution-note">${this._esc(lastResolved.note)}</div>
                        </div>
                    `;
                }
            }
        } catch (_) {
            const section = document.getElementById('detail-modal-history');
            if (section) section.style.display = 'none';
        }
    },

    _renderEvent(ev) {
        const actor = this._esc(ev.actor_name || 'Someone');
        const from = this._esc((ev.from_status || '').replace(/_/g, ' ') || '—');
        const to   = this._esc((ev.to_status   || '').replace(/_/g, ' ') || '—');
        const when = this._formatDate(ev.created_at);
        const note = ev.note ? `<div style="margin-top:2px; color: var(--color-gray-500);"><em>${this._esc(ev.note)}</em></div>` : '';
        return `
            <div style="padding: 6px 0; border-bottom: 1px solid var(--color-gray-100);">
                <strong>${actor}</strong> changed status from <strong>${from}</strong> &rarr; <strong>${to}</strong>
                <div style="font-size: var(--font-size-xs); color: var(--color-gray-400);">${when}</div>
                ${note}
            </div>
        `;
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

            ${data.latitude != null && data.longitude != null ? (() => {
                const lat = Number(data.latitude).toFixed(5);
                const lng = Number(data.longitude).toFixed(5);
                return `
                    <div class="detail-modal__section">
                        <div class="detail-modal__section-title">GPS Location</div>
                        ${data.resolved_address ? `
                            <div class="detail-modal__section-text" style="margin-bottom: 6px;">
                                ${this._esc(data.resolved_address)}
                            </div>
                        ` : ''}
                        <div class="detail-modal__section-text" style="font-family: ui-monospace, monospace; font-size: var(--font-size-xs); color: var(--color-gray-500);">
                            ${lat}, ${lng}
                        </div>
                        <a href="https://maps.google.com/?q=${lat},${lng}" target="_blank" rel="noopener"
                           class="btn btn--outline btn--sm mt-sm" style="display:inline-flex;align-items:center;gap:6px;">
                            <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            Open in Google Maps
                        </a>
                        <div style="font-size: var(--font-size-xs); color: var(--color-gray-400); margin-top: 8px;">
                            Area resolved via OpenStreetMap.
                        </div>
                    </div>
                `;
            })() : ''}

            ${data.affected_barangays ? `
                <div class="detail-modal__section">
                    <div class="detail-modal__section-title">Affected Areas</div>
                    <div class="detail-modal__section-text">${this._esc(data.affected_barangays)}</div>
                </div>
            ` : ''}

            <div class="detail-modal__section">
                <div class="detail-modal__section-title">Safety Tips</div>
                <ul class="detail-modal__tips">
                    ${this._getTipsFor(data.title).map(t => `<li>${this._esc(t)}</li>`).join('')}
                </ul>
            </div>
        `);
    },

    /**
     * Shared safety-tip lookup used by the hazard detail modal. Mirrors
     * the backend services/hazard/tips.js list so the SMS body and the
     * in-app detail view show identical guidance.
     */
    _getTipsFor(hazardTitle) {
        const t = (hazardTitle || '').toLowerCase();
        if (t.includes('flood')) return [
            'Move to higher ground immediately if water rises.',
            'Avoid walking or driving through flood waters.',
            'Disconnect electrical appliances if safe to do so.',
            'Listen to MDRRMO Morong announcements.',
        ];
        if (t.includes('fire')) return [
            'Evacuate the area immediately if instructed.',
            'Stay low to avoid smoke inhalation.',
            'Do not use elevators during a fire emergency.',
            'Call BFP Morong or 911.',
        ];
        if (t.includes('landslide')) return [
            'Move away from steep slopes immediately.',
            'Watch for cracks in the ground or tilting trees.',
            'Listen for rumbling sounds.',
            'Have an evacuation plan ready.',
        ];
        if (t.includes('typhoon') || t.includes('bagyo') || t.includes('storm')) return [
            'Stay indoors and away from windows.',
            'Prepare emergency supplies (water, food, flashlight).',
            'Charge mobile devices and have backup power ready.',
            'Follow PAGASA advisories and MDRRMO instructions.',
        ];
        if (t.includes('earthquake') || t.includes('lindol')) return [
            'Drop, Cover, and Hold On during shaking.',
            'Stay away from windows and heavy furniture.',
            'After shaking, check for injuries and damage.',
            'Be prepared for aftershocks.',
        ];
        if (t.includes('tsunami')) return [
            'Move to high ground or inland immediately.',
            'Do not wait for an official warning if you feel strong shaking near the coast.',
            'Stay away from the coast until authorities declare it safe.',
        ];
        if (t.includes('volcan') || t.includes('ash')) return [
            'Evacuate if in the danger zone.',
            'Wear a dust mask or cover mouth with damp cloth.',
            'Stay indoors with windows closed if ashfall is likely.',
            'Protect eyes with goggles if outside.',
        ];
        return [
            'Follow official MDRRMO instructions and advisories.',
            'Keep emergency contacts handy.',
            'Stay informed through trusted local sources.',
            'Have an emergency kit ready.',
        ];
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
        // Backend timestamps are UTC — pin to Asia/Manila so users in
        // other timezones (or on devices with wrong clocks) still see PH time.
        return d.toLocaleDateString('en-PH', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
            timeZone: 'Asia/Manila',
        });
    },
};

window.DetailModal = DetailModal;
