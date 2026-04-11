/* ============================================================
   News & Updates Page (Community Posts)
   ============================================================
   Reference: hazard-user/Hazard User6 & Hazard User7 (Figma exports)
   Community news feed with search, category filter, and a
   featured "Latest News" section.
   Table of Contents:
   1. State & mock data
   2. Render method
   3. List render + card render
   4. Filter & search handling
   5. Helper methods
   ============================================================ */

const NewsUpdatesPage = {
    activeFilter: 'all',
    searchTerm: '',

    /* --------------------------------------------------------
     * 1. Mock posts (to be replaced with API)
     * -------------------------------------------------------- */
    posts: [
        {
            id: 1,
            category: 'community',
            title: 'Call for Respondents: Pulse 911 MDRRMO',
            excerpt: 'MDRRMO Morong is looking for community respondents to participate in the Pulse 911 emergency response survey. Help shape a more resilient community.',
            date: 'Nov 14, 2025',
            type: 'post',
            image: 'public/assets/news/community-survey.jpg',
        },
        {
            id: 2,
            category: 'community',
            title: 'Muling namahagi ng packed dinner ang mga staff ng ating Mayor Sidney Soriano sa Evacuation Center sa Municipal Gym, Barangay San Pedro.',
            excerpt: 'The office of Mayor Sidney Soriano once again distributed packed dinners to evacuees at the Municipal Gym Evacuation Center in Barangay San Pedro.',
            date: 'Jan 8, 2026',
            type: 'post',
            image: 'public/assets/news/relief-goods.jpg',
        },
        {
            id: 3,
            category: 'community',
            title: 'PAMAMAHAGI NG LIBRENG SCHOOL SUPPLIES',
            excerpt: 'Free school supplies distribution for students in Morong. Visit your nearest barangay hall to claim your school kits. Schedule and eligibility details posted at your barangay.',
            date: 'Jan 8, 2026',
            type: 'post',
            image: 'public/assets/news/school-supplies.jpg',
        },
        {
            id: 4,
            category: 'city-news',
            title: 'Isang Provincial Most Wanted, Arestado sa Morong Rizal',
            excerpt: 'A provincial most-wanted individual has been arrested in Morong, Rizal by the local police force in a coordinated operation.',
            date: 'Oct 22, 2024',
            type: 'post',
            image: 'public/assets/news/police-operation.jpg',
        },
        {
            id: 5,
            category: 'videos',
            title: 'Morong, Rizal launches next-gen 911 emergency communication system',
            excerpt: 'A new 911 emergency communication system is now operational in Morong, Rizal, improving response times and citizen safety.',
            date: 'Mar 18, 2021',
            type: 'video',
            image: 'public/assets/news/emergency-system.jpg',
        },
        {
            id: 6,
            category: 'city-news',
            title: 'Nauna ng isinagawa ang vaccine roll-outs sa mga public hospitals ng Antipolo, Binangonan, Montalban, at Morong',
            excerpt: 'Vaccine roll-outs have been successfully conducted in public hospitals across Antipolo, Binangonan, Montalban, and Morong, prioritizing frontline workers and senior citizens.',
            date: 'Mar 18, 2021',
            type: 'post',
            image: 'public/assets/news/vaccine-rollout.jpg',
        },
    ],

    featured: {
        title: 'PULSE 911 MDRRMO',
        subtitle: 'CITIZEN SURVEY',
        desc: 'Help us improve emergency response in Morong. Scan the QR code below to participate in our citizen survey.',
        cta: 'SCAN ME',
    },

    /* --------------------------------------------------------
     * 2. Render
     * -------------------------------------------------------- */
    render() {
        return `
            <div class="page-padding">
                <h1 class="news-page__title">News &amp; Updates</h1>

                <div class="search-bar mb-lg">
                    <svg viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input type="text" placeholder="Search..." id="news-search"
                           oninput="NewsUpdatesPage.handleSearch(this.value)">
                </div>

                <!-- Featured Latest News card -->
                <div class="featured-news mb-lg">
                    <div class="featured-news__brand">
                        <div class="featured-news__logo">P</div>
                        <div>
                            <div class="featured-news__brand-title">${this.featured.title}</div>
                            <div class="featured-news__brand-sub">MDRRMO Morong</div>
                        </div>
                    </div>
                    <div class="featured-news__label">${this.featured.subtitle}</div>
                    <div class="featured-news__desc">${this.featured.desc}</div>
                    <button class="featured-news__qr" onclick="NewsUpdatesPage.showQRModal()">
                        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><line x1="14" y1="14" x2="14" y2="21"></line><line x1="17" y1="14" x2="17" y2="17"></line><line x1="20" y1="14" x2="20" y2="21"></line><line x1="14" y1="20" x2="17" y2="20"></line></svg>
                        <span>${this.featured.cta}</span>
                    </button>
                </div>

                <!-- Filter tabs -->
                <div class="news-tabs mb-lg">
                    <button class="news-tab ${this.activeFilter === 'all' ? 'active' : ''}"
                            onclick="NewsUpdatesPage.setFilter('all')">
                        <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        All
                    </button>
                    <button class="news-tab ${this.activeFilter === 'videos' ? 'active' : ''}"
                            onclick="NewsUpdatesPage.setFilter('videos')">
                        <svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                        Videos
                    </button>
                    <button class="news-tab ${this.activeFilter === 'community' ? 'active' : ''}"
                            onclick="NewsUpdatesPage.setFilter('community')">
                        <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        Community
                    </button>
                    <button class="news-tab ${this.activeFilter === 'city-news' ? 'active' : ''}"
                            onclick="NewsUpdatesPage.setFilter('city-news')">
                        <svg viewBox="0 0 24 24"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path><path d="M18 14h-8"></path><path d="M15 18h-5"></path><path d="M10 6h8v4h-8V6z"></path></svg>
                        City News
                    </button>
                </div>

                <div class="section-header">
                    <div class="section-header__title">Latest News</div>
                </div>

                <div id="news-list">
                    ${this.renderList()}
                </div>
            </div>

            <div id="qr-modal-container"></div>
        `;
    },

    /* --------------------------------------------------------
     * 2b. QR Code Modal
     * -------------------------------------------------------- */
    showQRModal() {
        document.getElementById('qr-modal-container').innerHTML = `
            <div class="modal-overlay" onclick="if(event.target===this) NewsUpdatesPage.closeQRModal()">
                <div class="modal" style="max-width: 360px; text-align: center;">
                    <div class="modal__title">Citizen Survey</div>
                    <div class="modal__desc">Scan this QR code with your phone camera to access the Pulse 911 MDRRMO citizen survey.</div>
                    <div style="display:flex;justify-content:center;margin:var(--spacing-lg) 0;">
                        <img src="public/assets/news/survey-qr.png" alt="Citizen Survey QR Code" style="width:220px;height:220px;border-radius:var(--radius-md);border:1px solid var(--color-gray-200);">
                    </div>
                    <div style="font-size:var(--font-size-xs);color:var(--color-gray-400);word-break:break-all;margin-bottom:var(--spacing-md);">
                        pulse911-mdrrmo.gov.ph/citizen-survey
                    </div>
                    <button class="btn btn--primary btn--block" onclick="NewsUpdatesPage.closeQRModal()">Close</button>
                </div>
            </div>
        `;
    },

    closeQRModal() {
        document.getElementById('qr-modal-container').innerHTML = '';
    },

    /* --------------------------------------------------------
     * 3. List & card rendering
     * -------------------------------------------------------- */
    renderList() {
        let filtered = this.activeFilter === 'all'
            ? this.posts
            : this.posts.filter(p => p.category === this.activeFilter);

        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            filtered = filtered.filter(p =>
                p.title.toLowerCase().includes(term) ||
                p.excerpt.toLowerCase().includes(term)
            );
        }

        if (filtered.length === 0) {
            return '<div class="empty-state">No posts found.</div>';
        }

        return filtered.map(p => this.renderCard(p)).join('');
    },

    renderCard(post) {
        const categoryLabels = {
            community: 'COMMUNITY',
            'city-news': 'CITY NEWS',
            videos: 'VIDEO',
        };
        const label = categoryLabels[post.category] || 'NEWS';
        const isVideo = post.type === 'video';

        return `
            <div class="news-card">
                <div class="news-card__thumb">
                    <img src="${post.image}" alt="${post.title}" loading="lazy">
                    ${isVideo ? '<div class="news-card__play-overlay"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div>' : ''}
                </div>
                <div class="news-card__body">
                    <span class="news-card__category">${label}</span>
                    <div class="news-card__title">${post.title}</div>
                    <div class="news-card__excerpt">${post.excerpt}</div>
                    <div class="news-card__date">${post.date}</div>
                </div>
            </div>
        `;
    },

    /* --------------------------------------------------------
     * 4. Filter & search
     * -------------------------------------------------------- */
    setFilter(filter) {
        this.activeFilter = filter;
        document.querySelectorAll('.news-tab').forEach(t => t.classList.remove('active'));
        event.target.closest('.news-tab').classList.add('active');
        document.getElementById('news-list').innerHTML = this.renderList();
    },

    handleSearch(value) {
        this.searchTerm = value;
        document.getElementById('news-list').innerHTML = this.renderList();
    },
};
