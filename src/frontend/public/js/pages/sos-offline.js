/* ============================================================
   SOS Offline Report
   ============================================================
   Full-screen modal for sending emergency reports via SMS
   when the device is offline. Uses the phone's native SMS app
   to send a structured PULSE911 message to the TextBee gateway.

   Table of Contents:
   1. State & config
   2. show / close
   3. Form rendering
   4. GPS capture
   5. SMS builder
   6. Send via native SMS
   7. Helpers
   ============================================================ */

const SosOffline = {
    /* --------------------------------------------------------
       1. State & Config
       -------------------------------------------------------- */
    _coords: null,
    _gpsStatus: 'pending', // pending | acquiring | success | failed

    TYPE_CODES: {
        'Flood': 'FL', 'Fire': 'FR', 'Typhoon': 'TY',
        'Infrastructure Damage': 'IN', 'Earthquake': 'EQ',
        'Landslide': 'LS', 'Others': 'OT',
    },

    SEVERITY_CODES: { 'high': '3', 'medium': '2', 'low': '1' },

    /* --------------------------------------------------------
       2. Show / Close
       -------------------------------------------------------- */
    show() {
        this.closeDetail();
        this._coords = null;
        this._gpsStatus = 'pending';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay sos-offline-modal';
        modal.id = 'sos-offline-modal';

        modal.innerHTML = this.renderForm();

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => modal.classList.add('modal-overlay--open'));

        // Start GPS capture immediately
        this.captureGPS();

        // Escape key closes
        this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
        document.addEventListener('keydown', this._escHandler);
    },

    close() {
        const modal = document.getElementById('sos-offline-modal');
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
        const existing = document.getElementById('sos-offline-modal');
        if (existing) existing.remove();
    },

    /* --------------------------------------------------------
       3. Form Rendering
       -------------------------------------------------------- */
    renderForm() {
        const user = Store.get('user');
        const userName = user ? user.name : 'Unknown';
        const userPhone = user ? user.phone : '';

        const types = ['Flood', 'Fire', 'Typhoon', 'Infrastructure Damage', 'Earthquake', 'Landslide', 'Others'];
        const typeIcons = {
            'Flood': '<path d="M12 22c-4.97 0-9-2.582-9-7v-1c0-2 1-4 3-6l6-7 6 7c2 2 3 4 3 6v1c0 4.418-4.03 7-9 7z"/>',
            'Fire': '<path d="M12 22c-4 0-8-3-8-7 0-3 2-5 3-6 0 2 1 3 3 3s3-2 3-5c4 3 7 5 7 8 0 4-4 7-8 7z"/>',
            'Typhoon': '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>',
            'Infrastructure Damage': '<path d="M1 22h22L12 2 1 22zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>',
            'Earthquake': '<path d="M12 2L2 22h20L12 2zm0 4l7.53 14H4.47L12 6z"/>',
            'Landslide': '<path d="M15 2l-4 8H7l-5 12h20L15 2z"/>',
            'Others': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
        };

        return `
            <div class="sos-offline-form">
                <div class="sos-offline-form__header">
                    <div class="sos-offline-form__header-title">
                        <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        Emergency Report (Offline)
                    </div>
                    <button class="modal__close" onclick="SosOffline.close()" aria-label="Close">
                        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                <div class="sos-offline-form__body">
                    <div class="sos-offline-form__sender">
                        <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        ${this.escape(userName)} ${userPhone ? '(' + this.escape(userPhone) + ')' : ''}
                    </div>

                    <div class="sos-offline-form__section-label">Type of Emergency</div>
                    <div class="sos-offline-form__types" id="sos-types">
                        ${types.map(t => `
                            <button type="button" class="sos-type-chip" data-type="${t}" onclick="SosOffline.selectType(this, '${t}')">
                                <svg viewBox="0 0 24 24">${typeIcons[t]}</svg>
                                <span>${t}</span>
                            </button>
                        `).join('')}
                    </div>

                    <div class="sos-offline-form__section-label">Severity</div>
                    <div class="sos-offline-form__severity" id="sos-severity">
                        <button type="button" class="sos-severity-chip sos-severity-chip--high" data-sev="high" onclick="SosOffline.selectSeverity(this, 'high')">High</button>
                        <button type="button" class="sos-severity-chip sos-severity-chip--medium" data-sev="medium" onclick="SosOffline.selectSeverity(this, 'medium')">Medium</button>
                        <button type="button" class="sos-severity-chip sos-severity-chip--low" data-sev="low" onclick="SosOffline.selectSeverity(this, 'low')">Low</button>
                    </div>

                    <div class="sos-offline-form__section-label">Message</div>
                    <textarea id="sos-message" class="sos-offline-form__textarea" placeholder="Describe the situation briefly..." maxlength="100" rows="3"></textarea>
                    <div class="sos-offline-form__char-count"><span id="sos-char-count">0</span>/100</div>

                    <div class="sos-offline-form__gps" id="sos-gps-status">
                        <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span>Acquiring GPS location...</span>
                    </div>
                </div>

                <div class="sos-offline-form__footer">
                    <button class="btn btn--outline" onclick="SosOffline.close()">Cancel</button>
                    <button class="btn btn--danger" id="sos-send-btn" onclick="SosOffline.sendViaSMS()">
                        <svg viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                        Send SOS via SMS
                    </button>
                </div>
            </div>
        `;
    },

    _selectedType: null,
    _selectedSeverity: null,

    selectType(el, type) {
        document.querySelectorAll('.sos-type-chip').forEach(c => c.classList.remove('sos-type-chip--active'));
        el.classList.add('sos-type-chip--active');
        this._selectedType = type;
    },

    selectSeverity(el, sev) {
        document.querySelectorAll('.sos-severity-chip').forEach(c => c.classList.remove('sos-severity-chip--active'));
        el.classList.add('sos-severity-chip--active');
        this._selectedSeverity = sev;
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
            },
            (err) => {
                console.warn('[SOS] GPS error:', err.message);
                this._updateGPSStatus('failed', 'GPS unavailable — will send without location');
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
        );
    },

    _updateGPSStatus(status, text) {
        this._gpsStatus = status;
        const el = document.getElementById('sos-gps-status');
        if (!el) return;

        const iconMap = {
            success: '<svg viewBox="0 0 24 24" class="sos-gps-icon--success"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            failed: '<svg viewBox="0 0 24 24" class="sos-gps-icon--failed"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        };

        el.innerHTML = (iconMap[status] || '') + `<span>${text}</span>`;
    },

    /* --------------------------------------------------------
       5. SMS Builder
       -------------------------------------------------------- */
    buildSMS() {
        const user = Store.get('user');
        const typeCode = this.TYPE_CODES[this._selectedType] || 'OT';
        const sevCode = this.SEVERITY_CODES[this._selectedSeverity] || '2';
        const coords = this._coords ? `${this._coords.lat},${this._coords.lng}` : '0,0';
        const name = user ? user.name : 'Unknown';
        const phone = user ? (user.phone || '') : '';
        const msg = (document.getElementById('sos-message')?.value || '').trim();

        return `PULSE911|${typeCode}|${sevCode}|${coords}|${name}|${phone}|${msg}`;
    },

    /* --------------------------------------------------------
       6. Send via Native SMS
       -------------------------------------------------------- */
    sendViaSMS() {
        if (!this._selectedType) {
            alert('Please select an emergency type.');
            return;
        }
        if (!this._selectedSeverity) {
            alert('Please select a severity level.');
            return;
        }

        const message = (document.getElementById('sos-message')?.value || '').trim();
        if (!message) {
            alert('Please describe the situation.');
            return;
        }

        const gatewayPhone = localStorage.getItem('pulse_gateway_phone');
        if (!gatewayPhone) {
            alert('Gateway phone number not available. Please connect to the internet first to configure the app, then try again offline.');
            return;
        }

        const smsBody = this.buildSMS();
        const smsUri = `sms:${gatewayPhone}?body=${encodeURIComponent(smsBody)}`;

        // Open native SMS app
        window.open(smsUri, '_system');

        // Show confirmation
        this.showConfirmation();
    },

    showConfirmation() {
        const body = document.querySelector('.sos-offline-form__body');
        const footer = document.querySelector('.sos-offline-form__footer');
        if (body) {
            body.innerHTML = `
                <div class="sos-offline-form__confirmation">
                    <div class="sos-offline-form__confirmation-icon">
                        <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </div>
                    <h3>SMS Prepared</h3>
                    <p>Your native SMS app should have opened with the emergency report pre-filled. <strong>Tap Send</strong> in your SMS app to deliver it.</p>
                    <p class="sos-offline-form__confirmation-note">The report will be received by MDRRMO Morong once the gateway phone processes it.</p>
                </div>
            `;
        }
        if (footer) {
            footer.innerHTML = `
                <button class="btn btn--primary btn--block" onclick="SosOffline.close()">Done</button>
            `;
        }
    },

    /* --------------------------------------------------------
       7. Helpers
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
        // Character counter for message textarea
        document.addEventListener('input', (e) => {
            if (e.target.id === 'sos-message') {
                const counter = document.getElementById('sos-char-count');
                if (counter) counter.textContent = e.target.value.length;
            }
        });
    }
};

// Initialize event listeners
SosOffline.init();
