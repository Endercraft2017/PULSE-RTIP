/* ============================================================
   Emergency / Hotlines Page
   ============================================================
   Reference: index9.html (Figma export)
   Emergency contacts and crisis hotlines for Morong, Rizal.
   Table of Contents:
   1. Render method
   2. Data loading
   3. Search handling
   4. Helper methods
   ============================================================ */

const EmergencyPage = {
    _hotlines: [],

    render() {
        setTimeout(() => this.loadData(), 0);

        return `
            <div class="page-padding emergency-page">
                <div class="search-bar">
                    <svg viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input type="text" placeholder="Search hotlines..." id="emergency-search"
                           oninput="EmergencyPage.handleSearch(this.value)">
                </div>

                <div id="hotlines-container">
                    <div class="loading-state">Loading hotlines...</div>
                </div>

                <div class="section-header mt-lg">
                    <div class="section-header__title">Quick Access</div>
                </div>

                <div class="quick-access">
                    <button class="quick-access__btn">
                        <svg viewBox="0 0 24 24">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                        <span>Police<br>(PNP & PPO)</span>
                    </button>
                    <button class="quick-access__btn">
                        <svg viewBox="0 0 24 24">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                        </svg>
                        <span>Hospitals<br>(Health Centers)</span>
                    </button>
                    <button class="quick-access__btn">
                        <svg viewBox="0 0 24 24">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                        </svg>
                        <span>Fire Protection<br>(BFP Morong)</span>
                    </button>
                    <button class="quick-access__btn">
                        <svg viewBox="0 0 24 24">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                        <span>Red Cross<br>(143)</span>
                    </button>
                </div>

                <div class="emergency-banner">
                    <div class="emergency-banner__text">For Emergencies, Call 911 (Police)</div>
                    <button class="emergency-banner__action" onclick="window.location.href='tel:911'">
                        <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                        Slide to Call
                    </button>
                </div>
            </div>
        `;
    },

    async loadData() {
        try {
            const res = await Store.apiFetch('/api/hotlines');
            if (res.success) {
                this._hotlines = res.data;
            }
        } catch (err) {
            console.error('Failed to load hotlines:', err);
        }
        this.renderHotlines(this._hotlines);
    },

    renderHotlines(hotlines) {
        const container = document.getElementById('hotlines-container');
        if (!container) return;

        if (!hotlines || hotlines.length === 0) {
            container.innerHTML = `
                <div class="card mb-lg">
                    <div class="hotlines-section">
                        <div class="hotlines-section__title">MDRRMO Hotlines</div>
                        <div class="hotlines-section__subtitle">Morong Disaster Risk Reduction and Management Office</div>
                        <div class="empty-state">No hotlines available.</div>
                    </div>
                </div>`;
            return;
        }

        // Group hotlines by category
        const grouped = {};
        hotlines.forEach(h => {
            const cat = h.category || 'Other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(h);
        });

        container.innerHTML = Object.entries(grouped).map(([category, items]) => `
            <div class="card mb-lg">
                <div class="hotlines-section">
                    <div class="hotlines-section__title">${category} Hotlines</div>
                    ${items.map(item => `
                        <div class="hotline-item">
                            <span class="hotline-item__label">${item.label}</span>
                            <a href="tel:${item.number.replace(/[^0-9+]/g, '')}" class="hotline-item__number">${item.number}</a>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    },

    handleSearch(value) {
        if (!value) {
            this.renderHotlines(this._hotlines);
            return;
        }
        const term = value.toLowerCase();
        const filtered = this._hotlines.filter(h =>
            h.label.toLowerCase().includes(term) ||
            h.number.includes(term) ||
            (h.category && h.category.toLowerCase().includes(term))
        );
        this.renderHotlines(filtered);
    }
};
