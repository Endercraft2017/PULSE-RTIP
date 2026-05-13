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

                ${this.renderAppDownload ? this.renderAppDownload() : ''}

                <!-- Offline SOS + Report Buttons (hidden when online) -->
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
                    <button class="btn btn--primary btn--block sos-btn" onclick="ReportOffline.show()" style="margin-top: var(--spacing-sm, 8px);">
                        <svg viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="12" y1="18" x2="12" y2="12"></line>
                            <line x1="9" y1="15" x2="15" y2="15"></line>
                        </svg>
                        <span>Report Incident (offline)</span>
                        <small>Non-emergency report via SMS</small>
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

                <!-- Community newsfeed (U-4): 3 latest posts. Clicking a card
                     navigates to News & Updates; the full detail modal lives
                     there. -->
                <div class="section-header mt-lg newsfeed-section">
                    <div class="section-header__title">
                        <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        Community
                    </div>
                    <a href="#/news-updates" class="text-sm" style="color:var(--color-primary);font-weight:600;"
                       onclick="event.preventDefault(); Router.navigate('news-updates')">See all</a>
                </div>
                <div id="home-newsfeed">
                    <div class="loading-state">Loading posts...</div>
                </div>
            </div>
        `;
    },

    /**
     * Small "Get the mobile app" banner shown only on the web.
     * Hidden automatically inside the Capacitor APK since they're
     * already using it.
     */
    renderAppDownload() {
        if (Store.get('isNativeApp')) return '';
        return `
            <a class="app-download-card" href="/downloads/" target="_blank" rel="noopener">
                <div class="app-download-card__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                        <line x1="12" y1="18" x2="12.01" y2="18"></line>
                    </svg>
                </div>
                <div class="app-download-card__content">
                    <div class="app-download-card__title">Get the Pulse 911 app</div>
                    <div class="app-download-card__desc">Faster access + offline SOS reporting</div>
                </div>
                <div class="app-download-card__cta">
                    Install
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>
            </a>
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

        // Hazards get cache-fallback so the alert list still appears offline
        const hazardsResult = await HazardCache.fetch();
        this.renderHazards(hazardsResult.data, hazardsResult.fromCache, hazardsResult.cachedAt);

        // Cache the gateway phone number while we have internet
        try {
            this._cacheGatewayPhone();
        } catch (err) {
            console.error('Failed to cache gateway phone:', err);
        }

        // Community newsfeed (U-4) — load independently so a posts outage
        // doesn't block the rest of the dashboard.
        this._loadNewsfeed();
    },

    async _loadNewsfeed() {
        const container = document.getElementById('home-newsfeed');
        if (!container) return;
        try {
            const res = await Store.apiFetch('/api/posts?limit=3');
            if (!res.success || !Array.isArray(res.data) || res.data.length === 0) {
                container.innerHTML = '<div class="empty-state">No community posts yet.</div>';
                return;
            }
            container.innerHTML = res.data.slice(0, 3).map(p => this.renderNewsfeedCard(p)).join('');
        } catch (err) {
            container.innerHTML = '<div class="empty-state">Unable to load posts.</div>';
        }
    },

    renderNewsfeedCard(post) {
        const authorName = post.author_name || 'Citizen';
        const initial = (post.author_avatar || authorName.charAt(0) || 'U').toString().charAt(0);
        const when = post.created_at ? this._formatManilaDateTime(post.created_at) : '';
        const currentUser = (typeof Store !== 'undefined' && Store.get) ? Store.get('user') : null;
        const isOwner = !!(currentUser && post.user_id && currentUser.id === post.user_id);

        const imgUrl = Store.mediaUrl(post.image_path);
        const videoUrl = Store.mediaUrl(post.video_path);

        const title = this._esc(post.title || '');
        const content = this._esc(post.content || '');
        const loc = post.location ? this._esc(post.location) : '';

        // Provenance badges — promoted-from-report or reposted-from-X
        let provenance = '';
        if (post.promoted_from_report_id) {
            provenance = `<div class="newsfeed-card__provenance">📋 Promoted from incident report #${post.promoted_from_report_id}</div>`;
        } else if (post.reposted_from_post_id && post.reposted_from_author_name) {
            provenance = `<div class="newsfeed-card__provenance">🔁 Reposted from <strong>${this._esc(post.reposted_from_author_name)}</strong></div>`;
        }

        // Card opens the full post detail in the News & Updates modal.
        return `
            <div class="newsfeed-card newsfeed-card--full newsfeed-card--clickable"
                 onclick="CitizenHomePage.openPostDetail(${post.id})"
                 role="button" tabindex="0">
                <div class="newsfeed-card__header">
                    <div class="newsfeed-card__avatar">${this._esc(initial)}</div>
                    <div class="newsfeed-card__meta">
                        <div class="newsfeed-card__author">${this._esc(authorName)}</div>
                        <div class="newsfeed-card__time">${this._esc(when)}${loc ? ' · 📍 ' + loc : ''}</div>
                    </div>
                </div>
                ${provenance}
                ${title ? `<div class="newsfeed-card__title">${title}</div>` : ''}
                ${content ? `<div class="newsfeed-card__content">${content}</div>` : ''}
                ${videoUrl ? `<div class="newsfeed-card__media"><video controls preload="metadata" src="${videoUrl}" onclick="event.stopPropagation()"></video></div>`
                  : imgUrl ? `<div class="newsfeed-card__media"><img src="${imgUrl}" alt="" loading="lazy" onerror="this.style.opacity='0.4';this.alt='Image unavailable';this.onerror=null;"></div>` : ''}
                ${isOwner ? `
                    <div class="newsfeed-card__actions" onclick="event.stopPropagation()">
                        <button type="button" class="newsfeed-card__action-btn"
                                onclick="event.stopPropagation(); CitizenHomePage.openPostEdit(${post.id})"
                                title="Edit post">
                            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            Edit
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    openPostDetail(postId) {
        // Navigate to /#/news-updates and ask it to open the modal once loaded.
        sessionStorage.setItem('news_open_post', String(postId));
        Router.navigate('news-updates');
    },

    openPostEdit(postId) {
        // News-updates page owns the edit modal — route through it so the
        // post is loaded into NewsUpdatesPage.posts before the modal opens.
        sessionStorage.setItem('news_open_edit', String(postId));
        Router.navigate('news-updates');
    },

    _formatManilaDateTime(dateStr) {
        try {
            const d = new Date(dateStr);
            return d.toLocaleString('en-US', {
                timeZone: 'Asia/Manila',
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            });
        } catch (_) {
            return '';
        }
    },

    _esc(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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

    renderHazards(hazards, fromCache = false, cachedAt = null) {
        const container = document.getElementById('hazard-alerts-list');
        if (!container) return;

        const banner = fromCache
            ? `<div class="offline-note" role="status">
                 <svg viewBox="0 0 24 24" aria-hidden="true">
                     <path d="M1 1l22 22"></path>
                     <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                     <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                     <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
                     <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
                     <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                     <line x1="12" y1="20" x2="12.01" y2="20"></line>
                 </svg>
                 <span>Offline — showing saved hazards from ${HazardCache.formatAge(cachedAt)}.</span>
               </div>`
            : '';

        if (hazards.length === 0) {
            container.innerHTML = banner + '<div class="empty-state">No active hazard alerts.</div>';
            return;
        }

        container.innerHTML = banner + hazards.map(h => this.renderAlertCard(h)).join('');
    },

    renderAlertCard(hazard) {
        const severityBadge = {
            high: '<span class="badge badge--high">High</span>',
            medium: '<span class="badge badge--warning">Medium</span>',
            low: '<span class="badge badge--info">Low</span>',
        };
        const isAdmin = (typeof Store !== 'undefined') && Store.get('role') === 'admin';
        const editBtn = isAdmin && (typeof AdminHomePage !== 'undefined')
            ? `<button type="button" class="alert-card__edit-btn"
                    onclick="AdminHomePage.openEditHazardModal(${hazard.id})"
                    aria-label="Edit hazard">
                  <svg viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                  <span>Edit</span>
              </button>`
            : '';

        return `
            <div class="alert-card">
                <div class="alert-card__indicator alert-card__indicator--${hazard.severity}"></div>
                <div class="alert-card__content">
                    <div class="alert-card__header">
                        <span class="alert-card__title">${hazard.title}</span>
                        <div class="alert-card__header-right">
                            ${severityBadge[hazard.severity] || ''}
                            ${editBtn}
                        </div>
                    </div>
                    <div class="alert-card__location">${hazard.location || ''}</div>
                    <div class="alert-card__description">${hazard.description || ''}</div>
                </div>
            </div>
        `;
    }
};
