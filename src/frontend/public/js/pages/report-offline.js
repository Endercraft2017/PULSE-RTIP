/* ============================================================
   Report Incident (Network-Aware Modal)
   ============================================================
   Auto-opens when the device goes offline, blocking the app
   with a Title + Body report form. Submission opens the native
   SMS app pre-filled with a structured PULSE report addressed
   to the cached TextBee gateway phone.

   When connectivity returns mid-flow:
     - Empty form  -> modal auto-closes (#6)
     - Has text    -> close (X) appears + submit switches to
                      POST /api/reports (#7)

   The SMS body stays pipe-delimited so the existing TextBee
   gateway parser keeps working. The user only sees a friendly
   [SOS]/Title/Body/Location/Reporter preview.

   Table of Contents:
   1. State
   2. show / close
   3. Form rendering
   4. GPS capture
   5. SMS builder + preview builder
   6. Send via SMS / submit online
   7. Network state handling
   8. Helpers + init
   ============================================================ */

const ReportOffline = {
    /* --------------------------------------------------------
       1. State
       -------------------------------------------------------- */
    _coords: null,
    _gpsStatus: 'pending',
    _isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

    MAX_TITLE: 80,
    MAX_MESSAGE: 130,

    /* --------------------------------------------------------
       2. Show / Close
       -------------------------------------------------------- */
    show() {
        if (document.getElementById('report-offline-modal')) return;

        this.closeDetail();
        this._coords = null;
        this._gpsStatus = 'pending';
        this._isOnline = navigator.onLine;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay sos-offline-modal';
        modal.id = 'report-offline-modal';
        modal.innerHTML = this.renderForm();

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => modal.classList.add('modal-overlay--open'));

        this.captureGPS();
        this._refreshPreview();
        this._applyNetworkUI();

        // Esc only escapes when there's a close button (i.e. online).
        this._escHandler = (e) => {
            if (e.key === 'Escape' && this._isOnline) this.close();
        };
        document.addEventListener('keydown', this._escHandler);
    },

    close() {
        const modal = document.getElementById('report-offline-modal');
        if (modal) {
            modal.classList.remove('modal-overlay--open');
            setTimeout(() => modal.remove(), 200);
        }
        document.body.style.overflow = '';
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
    },

    closeDetail() {
        const existing = document.getElementById('report-offline-modal');
        if (existing) existing.remove();
    },

    /* --------------------------------------------------------
       3. Form Rendering
       -------------------------------------------------------- */
    renderForm() {
        const user = Store.get('user');
        const userName = user ? user.name : 'Unknown';
        const userPhone = user ? user.phone : '';

        return `
            <div class="sos-offline-form">
                <div class="sos-offline-form__header">
                    <div class="sos-offline-form__header-title">
                        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                        <span id="report-offline-title-label">Report Incident (Offline)</span>
                    </div>
                    <button class="modal__close" id="report-offline-close" onclick="ReportOffline.close()" aria-label="Close" style="display:none;">
                        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                <div class="sos-offline-form__body">
                    <div class="sos-offline-form__sender">
                        <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        ${this.escape(userName)} ${userPhone ? '(' + this.escape(userPhone) + ')' : ''}
                    </div>

                    <div class="sos-offline-form__section-label">Title</div>
                    <input id="report-title" class="sos-offline-form__textarea" type="text"
                           placeholder="Short summary (e.g. Fallen tree on Rizal St.)"
                           maxlength="${this.MAX_TITLE}">
                    <div class="sos-offline-form__char-count"><span id="report-title-count">0</span>/${this.MAX_TITLE}</div>

                    <div class="sos-offline-form__section-label">Body</div>
                    <textarea id="report-message" class="sos-offline-form__textarea"
                              placeholder="Describe the incident briefly..."
                              maxlength="${this.MAX_MESSAGE}" rows="3"></textarea>
                    <div class="sos-offline-form__char-count"><span id="report-message-count">0</span>/${this.MAX_MESSAGE}</div>

                    <div class="sos-offline-form__gps" id="report-gps-status">
                        <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span>Acquiring GPS location...</span>
                    </div>

                    <div class="sos-offline-form__section-label" id="report-preview-label">SMS Preview</div>
                    <pre id="report-preview" class="report-offline-preview"></pre>
                </div>

                <div class="sos-offline-form__footer">
                    <button class="btn btn--primary" id="report-send-btn" onclick="ReportOffline.submit()">
                        <svg viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                        <span id="report-send-btn-label">Send Report via SMS</span>
                    </button>
                </div>
            </div>
        `;
    },

    /* --------------------------------------------------------
       4. GPS Capture
       -------------------------------------------------------- */
    captureGPS() {
        this._gpsStatus = 'acquiring';

        if (!navigator.geolocation) {
            this._updateGPSStatus('failed', 'GPS not available on this device');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                this._coords = {
                    lat: pos.coords.latitude.toFixed(6),
                    lng: pos.coords.longitude.toFixed(6),
                };
                this._updateGPSStatus('success',
                    `Location: ${this._coords.lat}, ${this._coords.lng}`);
                this._refreshPreview();
            },
            (err) => {
                console.warn('[Report] GPS error:', err.message);
                this._updateGPSStatus('failed', 'GPS unavailable — will send without location');
                this._refreshPreview();
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
        );
    },

    _updateGPSStatus(status, text) {
        this._gpsStatus = status;
        const el = document.getElementById('report-gps-status');
        if (!el) return;

        const iconMap = {
            success: '<svg viewBox="0 0 24 24" class="sos-gps-icon--success"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            failed: '<svg viewBox="0 0 24 24" class="sos-gps-icon--failed"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        };

        el.innerHTML = (iconMap[status] || '') + `<span>${text}</span>`;
    },

    /* --------------------------------------------------------
       5. SMS Builder + Preview Builder
       --------------------------------------------------------
       The wire format stays pipe-delimited so the existing
       TextBee gateway parser keeps inserting reports into the
       DB. The preview shown to the user is the friendlier
       [SOS] / Title / Body / Location / Reporter layout.
       -------------------------------------------------------- */
    _readForm() {
        const user = Store.get('user');
        return {
            title: (document.getElementById('report-title')?.value || '').trim(),
            message: (document.getElementById('report-message')?.value || '').trim(),
            coords: this._coords,
            name: user ? user.name : 'Unknown',
            phone: user ? (user.phone || '') : '',
        };
    },

    buildSMS() {
        const f = this._readForm();
        const coords = f.coords ? `${f.coords.lat},${f.coords.lng}` : '0,0';
        // Strip pipes from user input so we don't corrupt the delimiter layout.
        const safeTitle = f.title.replace(/\|/g, '/');
        const safeMsg = f.message.replace(/\|/g, '/');
        return `REPORT|${safeTitle}|${coords}|${f.name}|${f.phone}|${safeMsg}`;
    },

    buildPreview() {
        const f = this._readForm();
        const loc = f.coords ? `${f.coords.lat}, ${f.coords.lng}` : '(unavailable)';
        return [
            '[SOS]',
            `Title: ${f.title || '(empty)'}`,
            `Body: ${f.message || '(empty)'}`,
            `Location: ${loc}`,
            `Reporter: ${f.name}`,
        ].join('\n');
    },

    _refreshPreview() {
        const el = document.getElementById('report-preview');
        if (!el) return;
        el.textContent = this.buildPreview();
    },

    /* --------------------------------------------------------
       6. Send via SMS / Submit Online
       -------------------------------------------------------- */
    submit() {
        if (this._isOnline) return this.submitOnline();
        return this.sendViaSMS();
    },

    sendViaSMS() {
        const f = this._readForm();
        if (!f.title) { alert('Please enter a title for the incident.'); return; }
        if (!f.message) { alert('Please describe the incident.'); return; }

        const gatewayPhone = localStorage.getItem('pulse_gateway_phone');
        if (!gatewayPhone) {
            alert('Gateway phone number not available. Please connect to the internet first to configure the app, then try again offline.');
            return;
        }

        const smsBody = this.buildSMS();
        const smsUri = `sms:${gatewayPhone}?body=${encodeURIComponent(smsBody)}`;

        window.open(smsUri, '_system');
        this.showConfirmation('sms');
    },

    async submitOnline() {
        const f = this._readForm();
        if (!f.title) { alert('Please enter a title for the incident.'); return; }
        if (!f.message) { alert('Please describe the incident.'); return; }

        const btn = document.getElementById('report-send-btn');
        const label = document.getElementById('report-send-btn-label');
        if (btn) btn.disabled = true;
        if (label) label.textContent = 'Submitting...';

        try {
            const formData = new FormData();
            formData.append('title', f.title);
            // Online-mode submissions through the offline modal don't have a
            // type picker; default to 'Others' so the report still passes
            // /api/reports validation. Users wanting a category can use the
            // full Report Incident page instead.
            formData.append('type', 'Others');
            formData.append('description', f.message);
            if (f.coords) {
                formData.append('latitude', f.coords.lat);
                formData.append('longitude', f.coords.lng);
            }

            const res = await Store.apiFetch('/api/reports', {
                method: 'POST',
                body: formData,
            });

            if (res && res.success) {
                this.showConfirmation('api');
            } else {
                alert((res && res.message) || 'Failed to submit report.');
                if (btn) btn.disabled = false;
                if (label) label.textContent = 'Submit Report';
            }
        } catch (err) {
            alert('Network error. Please try again.');
            if (btn) btn.disabled = false;
            if (label) label.textContent = 'Submit Report';
        }
    },

    showConfirmation(mode) {
        const body = document.querySelector('#report-offline-modal .sos-offline-form__body');
        const footer = document.querySelector('#report-offline-modal .sos-offline-form__footer');
        const closeBtn = document.getElementById('report-offline-close');
        if (closeBtn) closeBtn.style.display = '';

        const heading = mode === 'api' ? 'Report Submitted' : 'SMS Prepared';
        const para = mode === 'api'
            ? 'Your incident report has been sent to the MDRRMO team. You will receive notifications on status updates.'
            : 'Your native SMS app should have opened with the incident report pre-filled. <strong>Tap Send</strong> in your SMS app to deliver it.';
        const note = mode === 'api'
            ? ''
            : '<p class="sos-offline-form__confirmation-note">An admin will review the report once the gateway phone processes it.</p>';

        if (body) {
            body.innerHTML = `
                <div class="sos-offline-form__confirmation">
                    <div class="sos-offline-form__confirmation-icon">
                        <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </div>
                    <h3>${heading}</h3>
                    <p>${para}</p>
                    ${note}
                </div>
            `;
        }
        if (footer) {
            footer.innerHTML = `
                <button class="btn btn--primary btn--block" onclick="ReportOffline.close()">Done</button>
            `;
        }
    },

    /* --------------------------------------------------------
       7. Network State Handling
       --------------------------------------------------------
       Modal pops on offline (auth'd citizens, non-auth pages).
       When connection returns: empty form -> auto-close,
       text present -> show close + switch submit to API.
       -------------------------------------------------------- */
    _applyNetworkUI() {
        const closeBtn = document.getElementById('report-offline-close');
        const titleLabel = document.getElementById('report-offline-title-label');
        const sendLabel = document.getElementById('report-send-btn-label');
        const previewLabel = document.getElementById('report-preview-label');

        if (closeBtn) closeBtn.style.display = this._isOnline ? '' : 'none';
        if (titleLabel) titleLabel.textContent = this._isOnline ? 'Report Incident' : 'Report Incident (Offline)';
        if (sendLabel) sendLabel.textContent = this._isOnline ? 'Submit Report' : 'Send Report via SMS';
        if (previewLabel) previewLabel.style.display = this._isOnline ? 'none' : '';
        const previewBox = document.getElementById('report-preview');
        if (previewBox) previewBox.style.display = this._isOnline ? 'none' : '';
    },

    _hasFormText() {
        const t = (document.getElementById('report-title')?.value || '').trim();
        const m = (document.getElementById('report-message')?.value || '').trim();
        return !!(t || m);
    },

    _handleGoOffline() {
        this._isOnline = false;
        // Auto-open behavior removed — the global offline listener in app.js
        // now navigates to login-offline, which auto-opens the SOS form. We
        // still refresh the network UI if THIS modal is already open (user
        // tapped Report Incident manually online and connection then dropped
        // mid-flow).
        if (document.getElementById('report-offline-modal')) {
            this._applyNetworkUI();
        }
    },

    _handleGoOnline() {
        this._isOnline = true;
        if (!document.getElementById('report-offline-modal')) return;
        if (!this._hasFormText()) {
            this.close();
            return;
        }
        this._applyNetworkUI();
    },

    /* --------------------------------------------------------
       8. Helpers + Init
       -------------------------------------------------------- */
    escape(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    init() {
        document.addEventListener('input', (e) => {
            if (e.target.id === 'report-title') {
                const c = document.getElementById('report-title-count');
                if (c) c.textContent = e.target.value.length;
                this._refreshPreview();
            } else if (e.target.id === 'report-message') {
                const c = document.getElementById('report-message-count');
                if (c) c.textContent = e.target.value.length;
                this._refreshPreview();
            }
        });

        window.addEventListener('offline', () => this._handleGoOffline());
        window.addEventListener('online', () => this._handleGoOnline());
    },
};

window.ReportOffline = ReportOffline;
ReportOffline.init();
