/* ============================================================
   Citizen Home Page
   ============================================================
   Reference: index2.html / index5.html (Figma export)
   Shows welcome card, report CTA, weather widget, hazard info,
   active hazard alerts, and stats for citizens.
   Table of Contents:
   1. Render method
   2. Data loading
   3. Weather widget render
   4. Hazard info render
   5. Alert card render
   ============================================================ */

const CitizenHomePage = {
    render() {
        const user = Store.get('user');
        const userName = user ? user.name : 'Citizen';
        const today = new Date();
        const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

        setTimeout(() => this.loadData(), 0);

        return `
            <div class="page-padding">
                <div class="welcome-card">
                    <div class="welcome-card__title">Welcome, ${userName}!</div>
                    <div class="welcome-card__text">
                        Stay informed about hazards in your area and report incidents to help your community.
                    </div>
                </div>

                <!-- Offline SOS Button (hidden when online) -->
                <div class="sos-btn-container" id="sos-btn-container" style="display:none;">
                    <button class="btn btn--danger btn--block sos-btn" onclick="SosOffline.show()">
                        <svg viewBox="0 0 24 24">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span>SOS Emergency Report</span>
                        <small>Send via SMS (works offline)</small>
                    </button>
                </div>

                <!-- Report New Incident CTA -->
                <div class="report-cta" onclick="Router.navigate('report-incident')">
                    <div class="report-cta__icon">
                        <svg viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="12" y1="18" x2="12" y2="12"></line>
                            <line x1="9" y1="15" x2="15" y2="15"></line>
                        </svg>
                    </div>
                    <div class="report-cta__content">
                        <div class="report-cta__title">Report New Incident</div>
                        <div class="report-cta__desc">Submit a report with photos, video, and GPS location</div>
                    </div>
                    <div class="report-cta__arrow">
                        <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                </div>

                <!-- Weather Widget -->
                <div class="weather-widget">
                    <div class="weather-widget__header">
                        <div>
                            <div class="weather-widget__location">Morong, Rizal</div>
                            <div class="weather-widget__date">${dateStr}</div>
                        </div>
                        <div class="weather-widget__icon">
                            <svg viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="4"></circle>
                                <path d="M12 2v2"></path><path d="M12 20v2"></path>
                                <path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path>
                                <path d="M2 12h2"></path><path d="M20 12h2"></path>
                                <path d="m17.66 6.34 1.41-1.41"></path><path d="m4.93 19.07 1.41-1.41"></path>
                            </svg>
                        </div>
                    </div>
                    <div class="weather-widget__main">
                        <div>
                            <div class="weather-widget__temp">32<span class="weather-widget__temp-unit">&deg;C</span></div>
                        </div>
                        <div>
                            <div class="weather-widget__condition">Partly Cloudy</div>
                            <div style="font-size:0.7rem;opacity:0.65;">Feels like 36&deg;C</div>
                        </div>
                    </div>
                    <div class="weather-widget__details">
                        <div class="weather-detail">
                            <div class="weather-detail__value">78%</div>
                            <div class="weather-detail__label">Humidity</div>
                        </div>
                        <div class="weather-detail">
                            <div class="weather-detail__value">12 km/h</div>
                            <div class="weather-detail__label">Wind</div>
                        </div>
                        <div class="weather-detail">
                            <div class="weather-detail__value">65%</div>
                            <div class="weather-detail__label">Rain Chance</div>
                        </div>
                    </div>
                </div>

                <!-- 5-Day Forecast -->
                <div class="section-header">
                    <div class="section-header__title">
                        <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        5-Day Forecast
                    </div>
                </div>
                ${this.renderForecast()}

                <!-- Hazard Information -->
                <div class="section-header mt-lg">
                    <div class="section-header__title">
                        <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        Hazard Information
                    </div>
                </div>
                <div class="hazard-info-grid">
                    <div class="hazard-info-card">
                        <div class="hazard-info-card__header">
                            <div class="hazard-info-card__icon hazard-info-card__icon--flood">
                                <svg viewBox="0 0 24 24"><path d="M2 15c6.667-6 13.333 0 20-6"></path><path d="M2 19c6.667-6 13.333 0 20-6"></path></svg>
                            </div>
                            <div class="hazard-info-card__title">Flood Risk</div>
                        </div>
                        <div class="hazard-info-card__value" style="color:var(--color-warning);">Moderate</div>
                        <div class="hazard-info-card__desc">River level at 15.2m</div>
                    </div>
                    <div class="hazard-info-card">
                        <div class="hazard-info-card__header">
                            <div class="hazard-info-card__icon hazard-info-card__icon--typhoon">
                                <svg viewBox="0 0 24 24"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2.5 2.5 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"></path></svg>
                            </div>
                            <div class="hazard-info-card__title">Typhoon</div>
                        </div>
                        <div class="hazard-info-card__value" style="color:var(--color-success);">No Signal</div>
                        <div class="hazard-info-card__desc">No active typhoon</div>
                    </div>
                    <div class="hazard-info-card">
                        <div class="hazard-info-card__header">
                            <div class="hazard-info-card__icon hazard-info-card__icon--rain">
                                <svg viewBox="0 0 24 24"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="8" y1="20" x2="8.01" y2="20"></line><line x1="12" y1="18" x2="12.01" y2="18"></line><line x1="12" y1="22" x2="12.01" y2="22"></line></svg>
                            </div>
                            <div class="hazard-info-card__title">Rainfall</div>
                        </div>
                        <div class="hazard-info-card__value" style="color:var(--color-info);">Heavy</div>
                        <div class="hazard-info-card__desc">42mm expected today</div>
                    </div>
                    <div class="hazard-info-card">
                        <div class="hazard-info-card__header">
                            <div class="hazard-info-card__icon hazard-info-card__icon--heat">
                                <svg viewBox="0 0 24 24"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg>
                            </div>
                            <div class="hazard-info-card__title">Heat Index</div>
                        </div>
                        <div class="hazard-info-card__value" style="color:var(--color-danger);">41&deg;C</div>
                        <div class="hazard-info-card__desc">Danger level</div>
                    </div>
                </div>

                <!-- Active Hazard Alerts -->
                <div class="section-header mt-lg">
                    <div class="section-header__title">
                        <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        Active Hazard Alerts
                    </div>
                    <a href="#/hazards" class="text-sm" style="color:var(--color-primary);font-weight:600;">View all</a>
                </div>

                <div id="hazard-alerts-list">
                    <div class="loading-state">Loading alerts...</div>
                </div>

                <div class="stats-grid mt-lg">
                    <div class="stat-card">
                        <div class="stat-card__icon stat-card__icon--pending">
                            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        </div>
                        <div class="stat-card__number" id="stat-pending">--</div>
                        <div class="stat-card__label">Pending</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card__icon stat-card__icon--resolved">
                            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                        <div class="stat-card__number" id="stat-resolved">--</div>
                        <div class="stat-card__label">Resolved</div>
                    </div>
                </div>
            </div>
        `;
    },

    renderForecast() {
        const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const today = new Date().getDay();
        const sunIcon = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m17.66 6.34 1.41-1.41"></path><path d="m4.93 19.07 1.41-1.41"></path></svg>';
        const rainIcon = '<svg viewBox="0 0 24 24"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="8" y1="20" x2="8.01" y2="20"></line><line x1="12" y1="18" x2="12.01" y2="18"></line><line x1="12" y1="22" x2="12.01" y2="22"></line><line x1="16" y1="16" x2="16.01" y2="16"></line><line x1="16" y1="20" x2="16.01" y2="20"></line></svg>';
        const cloudIcon = '<svg viewBox="0 0 24 24"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>';

        const forecast = [
            { day: 'Today', icon: sunIcon, high: 32, low: 25 },
            { day: days[(today+1)%7], icon: rainIcon, high: 29, low: 24 },
            { day: days[(today+2)%7], icon: rainIcon, high: 28, low: 23 },
            { day: days[(today+3)%7], icon: cloudIcon, high: 30, low: 24 },
            { day: days[(today+4)%7], icon: sunIcon, high: 33, low: 26 },
        ];

        return '<div class="forecast-row mb-lg">' + forecast.map((f, i) => `
            <div class="forecast-item ${i === 0 ? 'forecast-item--active' : ''}">
                <div class="forecast-item__day">${f.day}</div>
                <div class="forecast-item__icon">${f.icon}</div>
                <div class="forecast-item__temp">${f.high}&deg;</div>
                <div class="forecast-item__range">${f.low}&deg;</div>
            </div>
        `).join('') + '</div>';
    },

    async loadData() {
        // Offline detection — show/hide SOS button
        this._updateOfflineUI();
        window.addEventListener('online', () => this._updateOfflineUI());
        window.addEventListener('offline', () => this._updateOfflineUI());

        try {
            const [hazardsRes, reportsRes] = await Promise.all([
                Store.apiFetch('/api/hazards'),
                Store.apiFetch('/api/reports'),
            ]);

            if (hazardsRes.success) {
                this.renderHazards(hazardsRes.data);
            }

            if (reportsRes.success) {
                const reports = reportsRes.data;
                const pending = reports.filter(r => r.status === 'pending' || r.status === 'submitted').length;
                const resolved = reports.filter(r => r.status === 'resolved').length;
                const pendingEl = document.getElementById('stat-pending');
                const resolvedEl = document.getElementById('stat-resolved');
                if (pendingEl) pendingEl.textContent = pending;
                if (resolvedEl) resolvedEl.textContent = resolved;
            }

            // Cache the gateway phone number while we have internet
            this._cacheGatewayPhone();
        } catch (err) {
            console.error('Failed to load home data:', err);
        }
    },

    _updateOfflineUI() {
        const btn = document.getElementById('sos-btn-container');
        if (btn) btn.style.display = navigator.onLine ? 'none' : 'block';
    },

    async _cacheGatewayPhone() {
        try {
            const res = await Store.apiFetch('/api/sms/gateway-phone');
            if (res.success && res.data && res.data.phone) {
                localStorage.setItem('pulse_gateway_phone', res.data.phone);
            }
        } catch (e) {
            // Non-critical — may already be cached
        }
    },

    renderHazards(hazards) {
        const container = document.getElementById('hazard-alerts-list');
        if (!container) return;

        if (hazards.length === 0) {
            container.innerHTML = '<div class="empty-state">No active hazard alerts.</div>';
            return;
        }

        container.innerHTML = hazards.map(h => this.renderAlertCard(h)).join('');
    },

    renderAlertCard(hazard) {
        const severityBadge = {
            high: '<span class="badge badge--high">High</span>',
            medium: '<span class="badge badge--warning">Medium</span>',
            low: '<span class="badge badge--info">Low</span>',
        };

        return `
            <div class="alert-card">
                <div class="alert-card__indicator alert-card__indicator--${hazard.severity}"></div>
                <div class="alert-card__content">
                    <div class="alert-card__header">
                        <span class="alert-card__title">${hazard.title}</span>
                        ${severityBadge[hazard.severity] || ''}
                    </div>
                    <div class="alert-card__location">${hazard.location || ''}</div>
                    <div class="alert-card__description">${hazard.description || ''}</div>
                </div>
            </div>
        `;
    }
};
