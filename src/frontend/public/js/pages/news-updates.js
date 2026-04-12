/* ============================================================
   News & Updates Page (Community Posts)
   ============================================================
   Reference: hazard-user/Hazard User6 & Hazard User7 (Figma exports)
   Community news feed with search, category filter, and a
   featured "Latest News" section.
   Table of Contents:
   1. State
   2. Render method
   3. Data loading
   4. List render + card render
   5. Create post modal + submission
   6. Filter & search handling
   7. QR modal
   8. Helper methods
   ============================================================ */

const NewsUpdatesPage = {
    activeFilter: 'all',
    searchTerm: '',
    posts: [],

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
        setTimeout(() => this.loadData(), 0);

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
                    <div class="loading-state">Loading posts...</div>
                </div>
            </div>

            <!-- Create Post FAB -->
            <button type="button" class="fab" onclick="NewsUpdatesPage.showCreateModal()" aria-label="Create Post">
                <svg viewBox="0 0 24 24">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
            </button>

            <div id="qr-modal-container"></div>
        `;
    },

    /* --------------------------------------------------------
     * 3. Data Loading
     * -------------------------------------------------------- */
    liveNews: [],

    async loadData() {
        try {
            const [postsRes, newsRes] = await Promise.all([
                Store.apiFetch('/api/posts'),
                Store.apiFetch('/api/news').catch(() => ({ success: false })),
            ]);

            if (postsRes.success) {
                this.posts = postsRes.data;
            }

            if (newsRes.success && newsRes.data && newsRes.data.length > 0) {
                this.liveNews = newsRes.data.map(article => ({
                    id: 'news-' + article.publishedAt,
                    category: 'city-news',
                    type: 'post',
                    title: article.title,
                    content: article.description || '',
                    author_name: article.source || 'News',
                    author_avatar: 'N',
                    image_path: article.image || null,
                    created_at: article.publishedAt,
                    url: article.url,
                    _isLiveNews: true,
                    _relevance: article.relevance,
                }));
            }
        } catch (err) {
            console.error('Failed to load posts:', err);
        }
        this.refreshList();
    },

    /* --------------------------------------------------------
     * 4. List & card rendering
     * -------------------------------------------------------- */
    refreshList() {
        const container = document.getElementById('news-list');
        if (container) container.innerHTML = this.renderList();
    },

    renderList() {
        let filtered = this.activeFilter === 'all'
            ? [...this.posts, ...this.liveNews]
            : this.activeFilter === 'city-news'
                ? [...this.posts.filter(p => p.category === 'city-news'), ...this.liveNews]
                : this.posts.filter(p => p.category === this.activeFilter);

        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            filtered = filtered.filter(p =>
                (p.title || '').toLowerCase().includes(term) ||
                (p.content || '').toLowerCase().includes(term)
            );
        }

        // Sort by date descending
        filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

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
        const label = post._isLiveNews
            ? (post._relevance === 'local' ? 'LOCAL NEWS' : 'PH NEWS')
            : (categoryLabels[post.category] || 'NEWS');
        const isVideo = post.type === 'video';
        const date = post.created_at ? this.formatDate(post.created_at) : '';
        const authorName = post.author_name || '';
        const authorInitial = post.author_avatar || (authorName ? authorName.charAt(0) : 'U');
        const imageUrl = post.image_path
            ? (post.image_path.startsWith('http') ? post.image_path : `/uploads/${post.image_path}`)
            : null;
        const clickAction = post.url
            ? `onclick="window.open('${post.url}', '_blank', 'noopener')"`
            : '';

        return `
            <div class="news-card ${post._isLiveNews ? 'news-card--live' : ''}" ${clickAction}>
                ${imageUrl ? `
                    <div class="news-card__thumb">
                        <img src="${imageUrl}" alt="${this.escape(post.title)}" loading="lazy"
                             onerror="this.parentElement.innerHTML='<div class=\\'news-card__thumb--fallback\\'><svg viewBox=\\'0 0 24 24\\'><path d=\\'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2\\'></path><path d=\\'M18 14h-8\\'></path><path d=\\'M15 18h-5\\'></path><path d=\\'M10 6h8v4h-8V6z\\'></path></svg></div>'">
                        ${isVideo ? '<div class="news-card__play-overlay"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div>' : ''}
                    </div>
                ` : `
                    <div class="news-card__thumb news-card__thumb--avatar">
                        <span>${this.escape(authorInitial)}</span>
                    </div>
                `}
                <div class="news-card__body">
                    <span class="news-card__category ${post._isLiveNews && post._relevance === 'local' ? 'news-card__category--local' : ''}">${label}</span>
                    <div class="news-card__title">${this.escape(post.title)}</div>
                    <div class="news-card__excerpt">${this.escape(post.content || '')}</div>
                    <div class="news-card__meta">
                        ${authorName ? `<span class="news-card__author">${this.escape(authorName)}</span>` : ''}
                        ${date ? `<span class="news-card__date">${date}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    /* --------------------------------------------------------
     * 5. Create Post Modal + Submission
     * -------------------------------------------------------- */
    showCreateModal() {
        let container = document.getElementById('create-post-modal');
        if (!container) {
            container = document.createElement('div');
            container.id = 'create-post-modal';
            document.body.appendChild(container);
        }
        container.innerHTML = `
            <div class="modal-overlay modal-overlay--centered" onclick="if(event.target===this) NewsUpdatesPage.closeCreateModal()">
                <div class="modal" style="max-width:460px;max-height:90vh;padding:0;display:flex;flex-direction:column;overflow:hidden;">
                    <div style="padding:var(--spacing-xl) var(--spacing-xl) var(--spacing-md);border-bottom:1px solid var(--color-gray-100);display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div class="modal__title" style="margin-bottom:2px;">Create Post</div>
                            <div style="font-size:var(--font-size-xs);color:var(--color-gray-400);">Share with the community</div>
                        </div>
                        <button type="button" style="width:32px;height:32px;border-radius:var(--radius-full);background:var(--color-gray-100);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;" onclick="NewsUpdatesPage.closeCreateModal()">
                            <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:var(--color-gray-600);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    <div style="padding:var(--spacing-lg) var(--spacing-xl);overflow-y:auto;flex:1;">
                        <div class="report-form">
                            <div class="form-group">
                                <div class="form-group__label">Category <span class="form-group__required">*</span></div>
                                <div class="category-chips">
                                    <div class="category-chip selected" onclick="NewsUpdatesPage._selectPostCat('community', this)">Community</div>
                                    <div class="category-chip" onclick="NewsUpdatesPage._selectPostCat('city-news', this)">City News</div>
                                    <div class="category-chip" onclick="NewsUpdatesPage._selectPostCat('videos', this)">Videos</div>
                                </div>
                            </div>
                            <div class="form-group">
                                <div class="form-group__label">Title <span class="form-group__required">*</span></div>
                                <input class="form-input" type="text" id="post-title" placeholder="Post title">
                            </div>
                            <div class="form-group">
                                <div class="form-group__label">Content</div>
                                <textarea class="form-input" id="post-content" placeholder="Write your post..." style="min-height:80px;"></textarea>
                            </div>
                        </div>
                    </div>
                    <div style="padding:var(--spacing-md) var(--spacing-xl) var(--spacing-xl);border-top:1px solid var(--color-gray-100);">
                        <button type="button" class="btn btn--primary btn--block" id="publish-post-btn" onclick="NewsUpdatesPage.submitPost()">
                            <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;"><path d="M22 2L11 13"></path><path d="M22 2l-7 20-4-9-9-4 20-7z"></path></svg>
                            Publish Post
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.style.overflow = 'hidden';
        this._newPostCat = 'community';
    },

    closeCreateModal() {
        const container = document.getElementById('create-post-modal');
        if (container) container.innerHTML = '';
        document.body.style.overflow = '';
    },

    _selectPostCat(cat, el) {
        this._newPostCat = cat;
        document.querySelectorAll('#create-post-modal .category-chip').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
    },

    async submitPost() {
        const title = document.getElementById('post-title').value.trim();
        const content = document.getElementById('post-content').value.trim();

        if (!title) { alert('Please enter a title.'); return; }

        const btn = document.getElementById('publish-post-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Publishing...'; }

        try {
            const res = await Store.apiFetch('/api/posts', {
                method: 'POST',
                body: JSON.stringify({
                    title,
                    content: content || null,
                    category: this._newPostCat,
                    type: this._newPostCat === 'videos' ? 'video' : 'post',
                }),
            });

            if (res.success) {
                // Prepend the new post to the local list
                this.posts.unshift(res.data);
                this.closeCreateModal();
                this.refreshList();
            } else {
                alert(res.message || 'Failed to create post.');
                if (btn) { btn.disabled = false; btn.textContent = 'Publish Post'; }
            }
        } catch (err) {
            alert('Network error. Please try again.');
            if (btn) { btn.disabled = false; btn.textContent = 'Publish Post'; }
        }
    },

    /* --------------------------------------------------------
     * 6. Filter & search
     * -------------------------------------------------------- */
    setFilter(filter) {
        this.activeFilter = filter;
        document.querySelectorAll('.news-tab').forEach(t => t.classList.remove('active'));
        event.target.closest('.news-tab').classList.add('active');
        this.refreshList();
    },

    handleSearch(value) {
        this.searchTerm = value;
        this.refreshList();
    },

    /* --------------------------------------------------------
     * 7. QR modal
     * -------------------------------------------------------- */
    showQRModal() {
        document.getElementById('qr-modal-container').innerHTML = `
            <div class="modal-overlay modal-overlay--centered" onclick="if(event.target===this) NewsUpdatesPage.closeQRModal()">
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
     * 8. Helpers
     * -------------------------------------------------------- */
    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
        });
    },

    escape(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },
};
