/* ============================================================
   Emergency / Hotlines Page
   ============================================================
   Reference: reference/html-designs/Emergency/Emergency{1-4}
   Layout:
   1. Search bar
   2. MDRRMO Hotlines top card (always visible)
   3. Category tab strip (Police / Hospitals / Fire / Red Cross)
   4. Detailed contact cards for the selected category
   5. Slide to Call 911 banner
   Table of Contents:
   1. State & category data
   2. Render method
   3. MDRRMO hotlines card
   4. Category tabs
   5. Category details
   6. Search handling
   7. Helpers
   ============================================================ */

const EmergencyPage = {
    /* --------------------------------------------------------
     * 1. State & Data
     * -------------------------------------------------------- */
    activeCategory: 'police',
    searchTerm: '',

    mdrrmoHotlines: [
        { label: 'Emergency',  number: '0917-135-0541' },
        { label: 'Mobile',     number: '0919-081-7181' },
        { label: 'Mobile',     number: '0926-691-4281' },
        { label: 'Landline',   number: '(02) 7212-5741' },
    ],

    categories: {
        police: {
            label: 'Police',
            sublabel: 'PNP & PPO',
            icon: 'police',
            contacts: [
                {
                    title: 'Philippine National Police (PNP)',
                    subtitle: 'Morong Police Station',
                    numbers: [
                        { label: 'Smart', number: '0998-598-5725' },
                        { label: 'Globe', number: '0906-513-0718' },
                    ],
                },
                {
                    title: 'Rizal Police Provincial Office (PPO)',
                    subtitle: 'Provincial Headquarters',
                    numbers: [
                        { label: 'Smart', number: '0908-316-0164' },
                        { label: 'Globe', number: '0917-365-5979' },
                    ],
                },
            ],
        },
        hospitals: {
            label: 'Hospitals',
            sublabel: 'Health Centers',
            icon: 'hospital',
            contacts: [
                {
                    title: 'Rizal Provincial Hospital',
                    subtitle: 'Morong, Rizal',
                    numbers: [
                        { number: '(02) 8653-1051' },
                    ],
                    note: "Can't reach this office?",
                },
                {
                    title: 'Morong Doctors\' Hospital',
                    subtitle: 'Private Hospital — Gov. Martinez St.',
                    numbers: [
                        { number: '(02) 8653-2491' },
                    ],
                },
                {
                    title: 'Morong Rural Health Unit',
                    subtitle: 'Municipal Health Center',
                    numbers: [
                        { number: '(02) 8451-2773' },
                    ],
                },
                {
                    title: 'Supreme Care Medical Diagnostic and Imaging Center',
                    subtitle: 'Diagnostic Services',
                    numbers: [
                        { number: '(02) 7369-2504' },
                    ],
                },
            ],
        },
        fire: {
            label: 'Fire Protection',
            sublabel: 'BFP Morong',
            icon: 'fire',
            contacts: [
                {
                    title: 'Bureau of Fire Protection (BFP)',
                    subtitle: 'Morong Fire Station',
                    numbers: [
                        { number: '0965-123-9369' },
                        { number: '0908-441-7754' },
                        { number: '0916-641-1175' },
                    ],
                    note: "Can't reach this office?",
                },
            ],
        },
        redcross: {
            label: 'Red Cross',
            sublabel: '143',
            icon: 'redcross',
            contacts: [
                {
                    title: 'Philippine Red Cross',
                    subtitle: 'Rizal Chapter',
                    numbers: [
                        { number: '143' },
                        { label: 'Hotline', number: '(02) 8790-2300' },
                    ],
                },
            ],
        },
    },

    /* --------------------------------------------------------
     * 2. Render
     * -------------------------------------------------------- */
    render() {
        // Wire up slide-to-call once the HTML is attached. setTimeout
        // defers until after Router inserts the returned string.
        setTimeout(() => this.initSlideToCall(), 0);
        return `
            <div class="page-padding emergency-page">
                <div class="search-bar">
                    <svg viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input type="text" placeholder="Search..." id="emergency-search"
                           oninput="EmergencyPage.handleSearch(this.value)">
                </div>

                ${this.renderMDRRMOCard()}

                <div class="emergency-tabs" id="emergency-tabs">
                    ${this.renderTabs()}
                </div>

                <div id="emergency-details">
                    ${this.renderCategoryDetails()}
                </div>

                <div class="emergency-banner">
                    <div class="emergency-banner__text">
                        <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:middle;margin-right:4px;">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        For Emergencies, Call 911
                    </div>
                    <div class="slide-to-call" id="slide-to-call" data-tel="911">
                        <div class="slide-to-call__track">
                            <div class="slide-to-call__label">Slide to Call</div>
                            <div class="slide-to-call__handle" id="slide-to-call-handle">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                </svg>
                            </div>
                        </div>
                        <a class="slide-to-call__fallback" href="tel:911">Call 911</a>
                    </div>
                </div>
            </div>
        `;
    },

    /* --------------------------------------------------------
     * Slide-to-Call interaction — 80% drag threshold dials MDRRMO.
     * Falls back gracefully on desktops (mouse events supported).
     * -------------------------------------------------------- */
    initSlideToCall() {
        const root = document.getElementById('slide-to-call');
        const handle = document.getElementById('slide-to-call-handle');
        if (!root || !handle) return;

        const tel = root.getAttribute('data-tel') || '09171350541';
        let startX = 0;
        let dragging = false;
        let currentX = 0;

        const maxTravel = () => {
            const trackW = root.clientWidth;
            const handleW = handle.offsetWidth;
            // 4px padding either side matches the CSS top/left offset
            return Math.max(0, trackW - handleW - 8);
        };

        const onStart = (e) => {
            dragging = true;
            startX = (e.touches ? e.touches[0].clientX : e.clientX);
            handle.style.transition = 'none';
        };

        const onMove = (e) => {
            if (!dragging) return;
            const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
            const delta = clientX - startX;
            currentX = Math.max(0, Math.min(maxTravel(), delta));
            handle.style.transform = `translateX(${currentX}px)`;
            if (e.cancelable) e.preventDefault();
        };

        const onEnd = () => {
            if (!dragging) return;
            dragging = false;
            handle.style.transition = 'transform 0.25s ease';
            const threshold = maxTravel() * 0.8;
            if (currentX >= threshold) {
                // Snap to end then dial
                handle.style.transform = `translateX(${maxTravel()}px)`;
                window.location.href = 'tel:' + tel;
                // Reset shortly after in case the user cancels the dialer
                setTimeout(() => {
                    handle.style.transform = 'translateX(0)';
                    currentX = 0;
                }, 1500);
            } else {
                handle.style.transform = 'translateX(0)';
                currentX = 0;
            }
        };

        handle.addEventListener('touchstart', onStart, { passive: true });
        handle.addEventListener('touchmove', onMove, { passive: false });
        handle.addEventListener('touchend', onEnd);
        handle.addEventListener('touchcancel', onEnd);

        handle.addEventListener('mousedown', (e) => {
            onStart(e);
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', function up() {
                onEnd();
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', up);
            });
        });
    },

    /* --------------------------------------------------------
     * 3. MDRRMO Hotlines Card
     * -------------------------------------------------------- */
    renderMDRRMOCard() {
        return `
            <div class="card mb-lg">
                <div class="hotlines-section">
                    <div class="hotlines-section__title">MDRRMO Hotlines</div>
                    <div class="hotlines-section__subtitle">Morong Disaster Risk Reduction and Management Office</div>
                    ${this.mdrrmoHotlines.map(h => `
                        <div class="hotline-item">
                            <span class="hotline-item__label">${h.label}:</span>
                            <a href="tel:${this.cleanPhone(h.number)}" class="hotline-item__number">
                                ${h.number}
                                ${this.carrierBadge(h.number)}
                                <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;margin-left:4px;vertical-align:middle;">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                </svg>
                            </a>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    /* --------------------------------------------------------
     * 4. Category Tabs
     * -------------------------------------------------------- */
    renderTabs() {
        return Object.entries(this.categories).map(([key, cat]) => `
            <button type="button" class="emergency-tab ${this.activeCategory === key ? 'active' : ''}"
                    onclick="EmergencyPage.setCategory('${key}', this)">
                <div class="emergency-tab__icon">${this.getIcon(cat.icon)}</div>
                <div class="emergency-tab__label">${cat.label}</div>
                <div class="emergency-tab__sublabel">${cat.sublabel}</div>
            </button>
        `).join('');
    },

    setCategory(key, el) {
        this.activeCategory = key;
        document.querySelectorAll('.emergency-tab').forEach(t => t.classList.remove('active'));
        if (el) el.classList.add('active');
        document.getElementById('emergency-details').innerHTML = this.renderCategoryDetails();
    },

    /* --------------------------------------------------------
     * 5. Category Details
     * -------------------------------------------------------- */
    renderCategoryDetails() {
        const cat = this.categories[this.activeCategory];
        if (!cat) return '';

        let contacts = cat.contacts;

        // Apply search filter
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            contacts = contacts.filter(c =>
                c.title.toLowerCase().includes(term) ||
                (c.subtitle || '').toLowerCase().includes(term) ||
                c.numbers.some(n => n.number.includes(term))
            );
        }

        if (contacts.length === 0) {
            return `
                <div class="section-header">
                    <div class="section-header__title">${cat.label}</div>
                </div>
                <div class="card"><div class="empty-state">No results found.</div></div>
            `;
        }

        return `
            <div class="section-header">
                <div class="section-header__title">
                    <div class="emergency-section-icon emergency-section-icon--${cat.icon}">${this.getIcon(cat.icon)}</div>
                    ${cat.label}
                </div>
            </div>
            ${contacts.map(c => `
                <div class="contact-card">
                    <div class="contact-card__title">${c.title}</div>
                    <div class="contact-card__subtitle">${c.subtitle || ''}</div>
                    <div class="contact-card__numbers">
                        ${c.numbers.map(n => `
                            <a href="tel:${this.cleanPhone(n.number)}" class="contact-number">
                                <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                ${n.label ? `<span class="contact-number__tag">${n.label}:</span>` : ''}
                                <span class="contact-number__value">${n.number}</span>
                                ${this.carrierBadge(n.number)}
                            </a>
                        `).join('')}
                    </div>
                    ${c.note ? `<div class="contact-card__note">${c.note}</div>` : ''}
                </div>
            `).join('')}
        `;
    },

    getIcon(id) {
        const icons = {
            police:    '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
            hospital:  '<svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>',
            fire:      '<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
            redcross:  '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>',
        };
        return icons[id] || '';
    },

    /* --------------------------------------------------------
     * 6. Search handling
     * -------------------------------------------------------- */
    handleSearch(value) {
        this.searchTerm = value.trim();
        document.getElementById('emergency-details').innerHTML = this.renderCategoryDetails();
    },

    /* --------------------------------------------------------
     * 7. Helpers
     * -------------------------------------------------------- */
    cleanPhone(num) {
        if (!num) return '';
        return String(num).replace(/[^\d+]/g, '');
    },

    /**
     * Render a carrier badge pill (Globe / Smart / DITO / Landline)
     * next to a phone number. Returns empty string if CarrierLookup
     * is unavailable or the number can't be classified.
     */
    carrierBadge(num) {
        if (typeof CarrierLookup === 'undefined') return '';
        const carrier = CarrierLookup.lookup(num);
        if (!carrier) return '';
        const key = carrier.toLowerCase();
        return `<span class="carrier-badge carrier-badge--${key}">${carrier}</span>`;
    },
};
