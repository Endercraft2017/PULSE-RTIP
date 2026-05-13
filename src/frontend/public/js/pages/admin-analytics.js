/* ============================================================
   Admin Analytics Page (A-11 — Reports & Analytics)
   ============================================================
   Four views driven by /api/analytics/*:
     1. Incidents over time (line chart + day/week/month toggle)
     2. Emergency type breakdown (doughnut)
     3. Response time (avg / median / p95 bar)
     4. Location breakdown by barangay (horizontal bar)

   Chart.js is bundled at public/assets/vendor/chart.umd.min.js and
   loaded by index.html — check window.Chart before rendering so any
   load failure degrades to a friendly notice.

   Table of Contents:
   1. State
   2. Render shell
   3. Data loading
   4. Chart rendering
   5. Granularity toggle
   6. Helpers
   ============================================================ */

const AdminAnalyticsPage = {
    /* ------------------------------------------------------
       1. State
       ------------------------------------------------------ */
    _granularity: 'day',     // 'day' | 'week' | 'month'
    _days: 30,
    _charts: {               // Chart.js instances, kept so we can destroy them
        time: null,
        type: null,
        response: null,
        location: null,
    },
    _lastTypeData: [],       // Cached for the "most common type" stat card

    /* ------------------------------------------------------
       2. Render shell
       ------------------------------------------------------ */
    render() {
        setTimeout(() => this.loadAll(), 0);

        return `
            <div class="page-padding">
                <div class="welcome-card">
                    <div class="welcome-card__title">Reports &amp; Analytics</div>
                    <div class="welcome-card__text">
                        Data-driven view of incident activity, response performance,
                        and barangay-level load. Updates each time you open the page.
                    </div>
                </div>

                <div class="dashboard-stats" style="margin-bottom: var(--spacing-md);">
                    <div class="dashboard-stat">
                        <div class="dashboard-stat__label">Incidents (30d)</div>
                        <div class="dashboard-stat__value" id="an-total" style="color: var(--color-primary);">--</div>
                    </div>
                    <div class="dashboard-stat">
                        <div class="dashboard-stat__label">% Resolved</div>
                        <div class="dashboard-stat__value" id="an-resolved" style="color: var(--color-success);">--</div>
                    </div>
                    <div class="dashboard-stat">
                        <div class="dashboard-stat__label">Avg Response</div>
                        <div class="dashboard-stat__value" id="an-avg" style="color: var(--color-info);">--</div>
                    </div>
                    <div class="dashboard-stat">
                        <div class="dashboard-stat__label">Top Type</div>
                        <div class="dashboard-stat__value" id="an-top-type" style="color: var(--color-warning); font-size: 16px;">--</div>
                    </div>
                </div>

                <div class="card" style="margin-bottom: var(--spacing-md);">
                    <div class="section-header" style="padding: 0 0 var(--spacing-md) 0;">
                        <div class="section-header__title">Incidents Over Time</div>
                        <div class="analytics-toggle" role="group" aria-label="Granularity">
                            ${this._toggleBtn('day', 'Day')}
                            ${this._toggleBtn('week', 'Week')}
                            ${this._toggleBtn('month', 'Month')}
                        </div>
                    </div>
                    <div id="an-time-wrap" style="position: relative; height: 260px;">
                        <canvas id="an-time-chart"></canvas>
                        <div class="an-empty" id="an-time-empty" style="display:none;">No data yet for this period.</div>
                    </div>
                </div>

                <div class="card" style="margin-bottom: var(--spacing-md);">
                    <div class="section-header" style="padding: 0 0 var(--spacing-md) 0;">
                        <div class="section-header__title">Emergency Type Breakdown</div>
                    </div>
                    <div id="an-type-wrap" style="position: relative; height: 260px;">
                        <canvas id="an-type-chart"></canvas>
                        <div class="an-empty" id="an-type-empty" style="display:none;">No data yet for this period.</div>
                    </div>
                </div>

                <div class="card" style="margin-bottom: var(--spacing-md);">
                    <div class="section-header" style="padding: 0 0 var(--spacing-md) 0;">
                        <div class="section-header__title">Response Time (Hours)</div>
                        <span class="text-sm" id="an-rt-samples" style="color: var(--color-gray-500);"></span>
                    </div>
                    <div id="an-response-wrap" style="position: relative; height: 220px;">
                        <canvas id="an-response-chart"></canvas>
                        <div class="an-empty" id="an-response-empty" style="display:none;">No resolved incidents yet.</div>
                    </div>
                </div>

                <div class="card" style="margin-bottom: var(--spacing-md);">
                    <div class="section-header" style="padding: 0 0 var(--spacing-md) 0;">
                        <div class="section-header__title">Incidents by Barangay</div>
                    </div>
                    <div id="an-location-wrap" style="position: relative; height: 320px;">
                        <canvas id="an-location-chart"></canvas>
                        <div class="an-empty" id="an-location-empty" style="display:none;">No location data yet.</div>
                    </div>
                </div>

                ${this._renderQaSection()}
            </div>

            <style>
                .analytics-toggle { display: inline-flex; gap: 4px; }
                .analytics-toggle button {
                    border: 1px solid var(--color-gray-300);
                    background: var(--color-white);
                    color: var(--color-gray-700);
                    padding: 6px 12px;
                    font-size: 13px;
                    font-weight: 500;
                    border-radius: 6px;
                    cursor: pointer;
                    font-family: inherit;
                }
                .analytics-toggle button.active {
                    background: var(--color-primary);
                    color: var(--color-white);
                    border-color: var(--color-primary);
                }
                .an-empty {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--color-gray-500);
                    font-size: 14px;
                    background: var(--color-white);
                }

                /* QA Testing Results section */
                .qa-summary {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xl);
                    padding: var(--spacing-md) 0 var(--spacing-lg);
                    border-bottom: 1px solid var(--color-gray-100);
                    margin-bottom: var(--spacing-md);
                    flex-wrap: wrap;
                }
                .qa-summary__ring {
                    --size: 120px;
                    width: var(--size);
                    height: var(--size);
                    border-radius: 50%;
                    background: conic-gradient(
                        var(--color-success) calc(var(--qa-pct) * 1%),
                        var(--color-gray-200) 0
                    );
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .qa-summary__ring-inner {
                    width: calc(var(--size) - 22px);
                    height: calc(var(--size) - 22px);
                    border-radius: 50%;
                    background: var(--color-white);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
                .qa-summary__pct {
                    font-size: 22px;
                    font-weight: 700;
                    color: var(--color-success);
                    line-height: 1;
                }
                .qa-summary__pct-label {
                    font-size: 11px;
                    color: var(--color-gray-500);
                    margin-top: 4px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .qa-summary__meta { flex: 1; min-width: 200px; }
                .qa-summary__row {
                    display: flex;
                    justify-content: space-between;
                    padding: 4px 0;
                    font-size: 14px;
                    color: var(--color-gray-700);
                }
                .qa-summary__row strong { color: var(--color-gray-900); }
                .qa-summary__formula {
                    margin-top: var(--spacing-sm);
                    padding-top: var(--spacing-sm);
                    border-top: 1px dashed var(--color-gray-200);
                    font-family: monospace;
                    font-size: 12px;
                    color: var(--color-gray-500);
                }

                .qa-table-wrap { overflow-x: auto; }
                .qa-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                }
                .qa-table th, .qa-table td {
                    padding: 8px 10px;
                    border-bottom: 1px solid var(--color-gray-100);
                    text-align: left;
                    color: var(--color-gray-700);
                }
                .qa-table thead th {
                    background: var(--color-gray-50);
                    font-weight: 600;
                    color: var(--color-gray-900);
                    border-bottom: 2px solid var(--color-gray-200);
                }
                .qa-table tfoot td {
                    background: var(--color-gray-50);
                    font-weight: 700;
                    color: var(--color-gray-900);
                    border-bottom: none;
                    border-top: 2px solid var(--color-gray-300);
                }
                .qa-table__num { text-align: center !important; font-variant-numeric: tabular-nums; }
                .qa-table tbody tr:hover { background: var(--color-gray-50); }
                .qa-caption {
                    margin-top: var(--spacing-md);
                    font-size: 12px;
                    color: var(--color-gray-500);
                    font-style: italic;
                }

                .qa-user-counters {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: var(--spacing-md);
                    padding-bottom: var(--spacing-lg);
                    margin-bottom: var(--spacing-md);
                    border-bottom: 1px solid var(--color-gray-100);
                }
                .qa-user-counter {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-md);
                    padding: var(--spacing-md);
                    border: 1px solid #e5e7eb;
                    border-radius: 10px;
                    background: #ffffff;
                }
                .qa-user-counter__icon {
                    width: 44px; height: 44px;
                    border-radius: 10px;
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                    position: relative;
                }
                .qa-user-counter__icon svg {
                    width: 22px; height: 22px;
                    fill: none; stroke: currentColor;
                    stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
                }
                /* Pulsing dot to signal "live" on the active counter */
                .qa-user-counter__dot {
                    position: absolute;
                    top: 4px; right: 4px;
                    width: 9px; height: 9px;
                    border-radius: 50%;
                    background: var(--color-success);
                    box-shadow: 0 0 0 2px var(--color-white);
                    animation: qaDotPulse 1.6s ease-in-out infinite;
                }
                @keyframes qaDotPulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50%      { transform: scale(1.3); opacity: 0.6; }
                }
                .qa-user-counter__body { min-width: 0; }
                .qa-user-counter__value {
                    font-size: 28px;
                    font-weight: 800;
                    color: #0f172a;            /* light-mode: near-black on white card */
                    line-height: 1.1;
                    letter-spacing: -0.01em;
                }
                .qa-user-counter__label {
                    font-size: 13px;
                    color: #475569;
                    margin-top: 4px;
                    font-weight: 500;
                }
                .qa-user-counter__label span { color: #64748b; }
                @media (max-width: 480px) {
                    .qa-user-counters { grid-template-columns: 1fr; }
                    .qa-user-counter__value { font-size: 22px; }
                }

                /* Actual System Use (AU) table — explicit light-mode colors;
                   dark mode is handled by the body.theme-dark overrides below. */
                .au-section-title {
                    font-size: 14px;
                    font-weight: 700;
                    color: #0f172a;
                    margin: 0 0 var(--spacing-sm) 0;
                    padding-bottom: 4px;
                    border-bottom: 2px solid #e5e7eb;
                }
                .au-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 14px;
                    background: #ffffff;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    overflow: hidden;
                }
                .au-table th, .au-table td {
                    padding: 10px 14px;
                    text-align: left;
                    border-bottom: 1px solid #f1f5f9;
                    color: #334155;
                }
                .au-table thead th {
                    background: #f8fafc;
                    color: #0f172a;
                    font-weight: 700;
                    border-bottom: 2px solid #e5e7eb;
                }
                .au-table tbody td { color: #1e293b; }
                .au-table tbody td strong { color: #0f172a; font-variant-numeric: tabular-nums; }
                .au-table tbody tr:last-child td { border-bottom: none; }
                .au-table tbody tr:hover { background: #f8fafc; }
                .au-table__num { text-align: right !important; font-variant-numeric: tabular-nums; min-width: 110px; }
                @media (max-width: 480px) {
                    .au-table th, .au-table td { padding: 8px 10px; font-size: 13px; }
                    .au-table__num { min-width: 80px; }
                }

                /* ---- Dark-mode overrides for the AU panel ----
                   Forces explicit dark-friendly colors so contrast is correct
                   regardless of CSS-variable cascade order. */
                body.theme-dark .qa-user-counter {
                    background: #1e293b;
                    border-color: #334155;
                }
                body.theme-dark .qa-user-counter__value { color: #ffffff; }
                body.theme-dark .qa-user-counter__label { color: #cbd5e1; }
                body.theme-dark .qa-user-counter__label span { color: #94a3b8; }
                body.theme-dark .au-section-title {
                    color: #ffffff;
                    border-bottom-color: #334155;
                }
                body.theme-dark .au-table {
                    background: #1e293b;
                    border-color: #334155;
                }
                body.theme-dark .au-table th,
                body.theme-dark .au-table td {
                    border-bottom-color: #334155;
                    color: #cbd5e1;
                }
                body.theme-dark .au-table thead th {
                    background: #0f172a;
                    color: #ffffff;
                    border-bottom-color: #334155;
                }
                body.theme-dark .au-table tbody td { color: #e2e8f0; }
                body.theme-dark .au-table tbody td strong { color: #ffffff; }
                body.theme-dark .au-table tbody tr:hover { background: #0f172a; }

                @media (max-width: 480px) {
                    .qa-summary { gap: var(--spacing-md); }
                    .qa-summary__ring { --size: 96px; }
                    .qa-summary__pct { font-size: 18px; }
                    .qa-table th, .qa-table td { padding: 6px 6px; font-size: 12px; }
                }
            </style>
        `;
    },

    _toggleBtn(key, label) {
        const active = this._granularity === key ? 'active' : '';
        return `<button type="button" class="${active}" data-g="${key}"
                    onclick="AdminAnalyticsPage.setGranularity('${key}')">${label}</button>`;
    },

    /* ------------------------------------------------------
       Actual System Use (AU) — system usage logs summary.
       Source: thesis "System Usage Logs Summary" table for the
       Pulse: Real-time Incident Reporting Mobile App (Morong, Rizal).
       Numbers reflect the QA testing period; they're rendered as a
       static snapshot. The two top counter cards stay live (registered
       users + logged-in now) so the page still shows current state.
       Edit _auMetrics if the reference values change.
       ------------------------------------------------------ */
    _auMetrics: [
        { metric: 'Total Registered Users',                          result: '35'        },
        { metric: 'Total Logins Recorded',                           result: '140'       },
        { metric: 'Average Logins per User',                         result: '4.0'       },
        { metric: 'Total Incident Reports Submitted',                result: '55'        },
        { metric: 'Average Reports per User',                        result: '1.86'      },
        { metric: 'Reports with Image/Video',                        result: '48 (73.8%)' },
        { metric: 'Users Who Submitted at Least One Report',         result: '30 (85.7%)' },
        { metric: 'Admin Users Who Accessed Dashboard/Tracking',     result: '5 (100%)'  },
    ],

    _renderQaSection() {
        const rows = this._auMetrics;

        const body = rows.map((r) => `
            <tr>
                <td>${r.metric}</td>
                <td class="au-table__num"><strong>${r.result}</strong></td>
            </tr>
        `).join('');

        return `
            <div class="card" style="margin-bottom: var(--spacing-md);">
                <div class="section-header" style="padding: 0 0 var(--spacing-md) 0;">
                    <div class="section-header__title">System Usage Logs Summary</div>
                    <span class="text-sm" style="color: var(--color-gray-500);">${rows.length} metrics</span>
                </div>

                <div class="qa-user-counters">
                    <div class="qa-user-counter">
                        <div class="qa-user-counter__icon" style="background: var(--color-info-light); color: var(--color-info);">
                            <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        </div>
                        <div class="qa-user-counter__body">
                            <div class="qa-user-counter__value" id="qa-registered">--</div>
                            <div class="qa-user-counter__label">Registered Users</div>
                        </div>
                    </div>
                    <div class="qa-user-counter">
                        <div class="qa-user-counter__icon" style="background: var(--color-success-light); color: var(--color-success);">
                            <span class="qa-user-counter__dot"></span>
                            <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        </div>
                        <div class="qa-user-counter__body">
                            <div class="qa-user-counter__value" id="qa-loggedin">--</div>
                            <div class="qa-user-counter__label">Logged-in Now <span id="qa-loggedin-window" style="font-weight: 400;"></span></div>
                        </div>
                    </div>
                </div>

                <div class="au-section-title">Actual System Use (AU)</div>
                <div class="qa-table-wrap">
                    <table class="au-table">
                        <thead>
                            <tr>
                                <th>Metric</th>
                                <th class="au-table__num">Result</th>
                            </tr>
                        </thead>
                        <tbody>${body}</tbody>
                    </table>
                </div>
                <div class="qa-caption">
                    Composite system-use metrics recorded during the deployment study.
                </div>
            </div>
        `;
    },

    /* ------------------------------------------------------
       3. Data loading
       ------------------------------------------------------ */
    async loadAll() {
        if (typeof window.Chart === 'undefined') {
            // Chart.js didn't load (bundle missing or eval failed). Replace charts with notice.
            document.querySelectorAll('.an-empty').forEach((el) => {
                el.style.display = 'flex';
                el.textContent = 'Charts library failed to load. Check your connection.';
            });
            return;
        }

        try {
            const [timeRes, typeRes, rtRes, locRes, statsRes] = await Promise.all([
                Store.apiFetch(`/api/analytics/incidents-over-time?granularity=${this._granularity}&days=${this._days}`),
                Store.apiFetch('/api/analytics/type-breakdown'),
                Store.apiFetch('/api/analytics/response-time'),
                Store.apiFetch('/api/analytics/location-breakdown'),
                Store.apiFetch('/api/dashboard/stats'),
            ]);

            if (timeRes && timeRes.success) this.renderTimeChart(timeRes.data || []);
            if (typeRes && typeRes.success) {
                this._lastTypeData = typeRes.data || [];
                this.renderTypeChart(this._lastTypeData);
            }
            if (rtRes && rtRes.success) this.renderResponseChart(rtRes.data || {});
            if (locRes && locRes.success) this.renderLocationChart(locRes.data || []);
            if (statsRes && statsRes.success) this.renderUserCounters(statsRes.data || {});

            this.renderStatCards({
                time: timeRes && timeRes.data,
                type: typeRes && typeRes.data,
                rt: rtRes && rtRes.data,
            });
        } catch (err) {
            console.error('[analytics] load failed:', err);
        }

        // Refresh the live counter every 30s while this page is open.
        if (this._userCounterTimer) clearInterval(this._userCounterTimer);
        this._userCounterTimer = setInterval(() => {
            if (Router.currentRoute !== 'admin-analytics') {
                clearInterval(this._userCounterTimer);
                this._userCounterTimer = null;
                return;
            }
            Store.apiFetch('/api/dashboard/stats')
                .then(r => { if (r && r.success) this.renderUserCounters(r.data || {}); })
                .catch(() => {});
        }, 30_000);
    },

    renderUserCounters(stats) {
        const reg = Number(stats.registeredCount) || 0;
        const live = Number(stats.loggedInCount) || 0;
        const win = Number(stats.loggedInWindowMinutes) || 5;
        this._setText('qa-registered', String(reg));
        this._setText('qa-loggedin', String(live));
        this._setText('qa-loggedin-window', `(active in last ${win} min)`);
    },

    async loadTimeOnly() {
        if (typeof window.Chart === 'undefined') return;
        try {
            const res = await Store.apiFetch(
                `/api/analytics/incidents-over-time?granularity=${this._granularity}&days=${this._days}`
            );
            if (res && res.success) this.renderTimeChart(res.data || []);
        } catch (err) {
            console.error('[analytics] time refresh failed:', err);
        }
    },

    /* ------------------------------------------------------
       4. Chart rendering
       ------------------------------------------------------ */
    renderStatCards({ time, type, rt }) {
        const total = Array.isArray(time) ? time.reduce((n, r) => n + (r.count || 0), 0) : 0;
        this._setText('an-total', String(total));

        // % resolved is derived from rt.samples vs total; if total is 0 we can't
        // divide — show "—" instead of NaN.
        const samples = (rt && rt.samples) || 0;
        const pct = total > 0 ? Math.round((samples / total) * 100) : null;
        this._setText('an-resolved', pct == null ? '—' : `${pct}%`);

        const avg = rt && typeof rt.avgHours === 'number' ? rt.avgHours : null;
        this._setText('an-avg', avg == null ? '—' : this._fmtHours(avg));

        const top = Array.isArray(type) && type.length > 0 ? type[0] : null;
        this._setText('an-top-type', top ? `${top.type} (${top.count})` : '—');

        if (rt) {
            const s = rt.samples || 0;
            this._setText('an-rt-samples', s ? `${s} resolved incidents` : '');
        }
    },

    renderTimeChart(rows) {
        this._destroyChart('time');
        const empty = document.getElementById('an-time-empty');
        if (!rows.length) { if (empty) empty.style.display = 'flex'; return; }
        if (empty) empty.style.display = 'none';

        const canvas = document.getElementById('an-time-chart');
        if (!canvas) return;

        this._charts.time = new window.Chart(canvas, {
            type: 'line',
            data: {
                labels: rows.map((r) => r.bucket),
                datasets: [{
                    label: 'Incidents',
                    data: rows.map((r) => r.count),
                    borderColor: '#16A34A',
                    backgroundColor: 'rgba(22, 163, 74, 0.18)',
                    fill: true,
                    tension: 0.25,
                    pointRadius: 3,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 } },
                },
            },
        });
    },

    renderTypeChart(rows) {
        this._destroyChart('type');
        const empty = document.getElementById('an-type-empty');
        if (!rows.length) { if (empty) empty.style.display = 'flex'; return; }
        if (empty) empty.style.display = 'none';

        const canvas = document.getElementById('an-type-chart');
        if (!canvas) return;

        const palette = [
            '#16A34A', '#DC2626', '#F59E0B', '#2563EB', '#9333EA',
            '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#64748B',
        ];

        this._charts.type = new window.Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: rows.map((r) => r.type),
                datasets: [{
                    data: rows.map((r) => r.count),
                    backgroundColor: rows.map((_, i) => palette[i % palette.length]),
                    borderWidth: 2,
                    borderColor: '#FFFFFF',
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' },
                },
            },
        });
    },

    renderResponseChart(rt) {
        this._destroyChart('response');
        const empty = document.getElementById('an-response-empty');
        const hasData = rt && (rt.avgHours != null || rt.medianHours != null || rt.p95Hours != null);
        if (!hasData) { if (empty) empty.style.display = 'flex'; return; }
        if (empty) empty.style.display = 'none';

        const canvas = document.getElementById('an-response-chart');
        if (!canvas) return;

        const fmt = (v) => (v == null || !isFinite(v) ? 0 : Number(v.toFixed(2)));

        this._charts.response = new window.Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Average', 'Median', 'P95'],
                datasets: [{
                    label: 'Hours',
                    data: [fmt(rt.avgHours), fmt(rt.medianHours), fmt(rt.p95Hours)],
                    backgroundColor: ['#2563EB', '#16A34A', '#DC2626'],
                    borderRadius: 6,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Hours' } },
                },
            },
        });
    },

    renderLocationChart(rows) {
        this._destroyChart('location');
        const empty = document.getElementById('an-location-empty');
        const withCounts = rows.filter((r) => (r.count || 0) > 0);
        if (!withCounts.length) { if (empty) empty.style.display = 'flex'; return; }
        if (empty) empty.style.display = 'none';

        const canvas = document.getElementById('an-location-chart');
        if (!canvas) return;

        this._charts.location = new window.Chart(canvas, {
            type: 'bar',
            data: {
                labels: withCounts.map((r) => r.barangay),
                datasets: [{
                    label: 'Incidents',
                    data: withCounts.map((r) => r.count),
                    backgroundColor: '#16A34A',
                    borderRadius: 4,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Horizontal bars read better for long barangay names.
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, ticks: { precision: 0 } },
                },
            },
        });
    },

    /* ------------------------------------------------------
       5. Granularity toggle
       ------------------------------------------------------ */
    setGranularity(g) {
        if (!['day', 'week', 'month'].includes(g)) return;
        if (this._granularity === g) return;
        this._granularity = g;

        document.querySelectorAll('.analytics-toggle button').forEach((b) => {
            b.classList.toggle('active', b.dataset.g === g);
        });

        // Chart.js leaks canvas contexts if we mutate data without destroying
        // the existing instance — destroy happens inside renderTimeChart.
        this.loadTimeOnly();
    },

    /* ------------------------------------------------------
       6. Helpers
       ------------------------------------------------------ */
    _destroyChart(key) {
        if (this._charts[key]) {
            try { this._charts[key].destroy(); } catch (_) {}
            this._charts[key] = null;
        }
    },

    _setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    },

    _fmtHours(h) {
        if (h < 1) return `${Math.round(h * 60)}m`;
        if (h < 24) return `${h.toFixed(1)}h`;
        return `${(h / 24).toFixed(1)}d`;
    },
};
