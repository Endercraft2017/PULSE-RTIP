/* ============================================================
   News & Updates Page (Community Posts)
   ============================================================
   Community news feed with search, category filter, create/edit/repost
   flows, edit-history viewer, and a featured "Citizen Survey" card.
   Table of Contents:
   1. State
   2. Render method
   3. Data loading
   4. List render + card render
   5. Create / edit post modal + submission
   6. Post detail modal + edit history
   7. Repost
   8. Filter & search handling
   9. QR modal
   10. Helpers
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

                <!-- U-3: Prominent "Create Post" CTA at the top of the page so it's
                     the first thing the user sees rather than buried at the bottom. -->
                <button type="button" class="news-create-cta" onclick="NewsUpdatesPage.showCreateModal()">
                    <span class="news-create-cta__icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </span>
                    <span class="news-create-cta__label">Create Post</span>
                    <span class="news-create-cta__hint">Share with the community</span>
                </button>

                <!-- Disaster Alerts (GDACS) -->
                <div id="disaster-alerts" class="mb-lg">
                    <div class="loading-state">Checking disaster alerts...</div>
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

            <!-- Create Post FAB (kept as a quick-action shortcut on mobile) -->
            <button type="button" class="fab" onclick="NewsUpdatesPage.showCreateModal()" aria-label="Create Post">
                <svg viewBox="0 0 24 24">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
            </button>

        `;
    },

    /* --------------------------------------------------------
     * 3. Data Loading
     * -------------------------------------------------------- */
    liveNews: [],
    disasters: [],

    async loadData() {
        try {
            const [postsRes, newsRes] = await Promise.all([
                Store.apiFetch('/api/posts'),
                Store.apiFetch('/api/news').catch(() => ({ success: false })),
            ]);

            if (postsRes.success) {
                this.posts = postsRes.data;
            }

            if (newsRes.success && newsRes.data) {
                if (newsRes.data.disasters && newsRes.data.disasters.length > 0) {
                    this.disasters = newsRes.data.disasters;
                }

                const articles = newsRes.data.news || newsRes.data;
                if (Array.isArray(articles) && articles.length > 0 && articles[0].title) {
                    this.liveNews = articles.map(article => ({
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
            }
        } catch (err) {
            console.error('Failed to load posts:', err);
        }
        this.renderDisasterAlerts();
        this.refreshList();

        // If we were sent here from the home feed asking to open a specific
        // post (detail view or edit modal), do that now (data is loaded).
        const pendingDetailId = sessionStorage.getItem('news_open_post');
        if (pendingDetailId) {
            sessionStorage.removeItem('news_open_post');
            const id = parseInt(pendingDetailId, 10);
            if (Number.isFinite(id)) {
                setTimeout(() => this.showPostDetail(id), 80);
            }
        }
        const pendingEditId = sessionStorage.getItem('news_open_edit');
        if (pendingEditId) {
            sessionStorage.removeItem('news_open_edit');
            const id = parseInt(pendingEditId, 10);
            if (Number.isFinite(id)) {
                setTimeout(() => this.showEditModal(id), 80);
            }
        }
    },

    renderDisasterAlerts() {
        const container = document.getElementById('disaster-alerts');
        if (!container) return;

        if (this.disasters.length === 0) {
            container.innerHTML = `
                <div class="disaster-banner disaster-banner--safe">
                    <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                    <div>
                        <div class="disaster-banner__title">No Active Disaster Alerts</div>
                        <div class="disaster-banner__desc">No disasters detected near Morong, Rizal. Stay prepared.</div>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = this.disasters.map(d => {
            const levelClass = (d.alertLevel || 'green').toLowerCase();
            const typeIcons = {
                'Tropical Cyclone': '<path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2.5 2.5 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"></path>',
                'Earthquake': '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>',
                'Flood': '<path d="M2 15c6.667-6 13.333 0 20-6"></path><path d="M2 19c6.667-6 13.333 0 20-6"></path>',
                'Wildfire': '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
                'Volcano': '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
            };
            const icon = typeIcons[d.type] || typeIcons['Earthquake'];

            return `
                <a href="${d.url}" target="_blank" rel="noopener" class="disaster-alert disaster-alert--${levelClass}">
                    <div class="disaster-alert__icon">
                        <svg viewBox="0 0 24 24">${icon}</svg>
                    </div>
                    <div class="disaster-alert__body">
                        <div class="disaster-alert__header">
                            <span class="disaster-alert__title">${d.title}</span>
                            <span class="disaster-alert__level disaster-alert__level--${levelClass}">${d.alertLevel}</span>
                        </div>
                        <div class="disaster-alert__desc">${d.description}</div>
                        <div class="disaster-alert__meta">
                            <span>${d.type}</span>
                            ${d.distanceKm ? '<span>' + d.distanceKm + ' km away</span>' : ''}
                            <span>${d.source}</span>
                        </div>
                    </div>
                </a>
            `;
        }).join('');
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
        const liveLabels = { local: 'LOCAL NEWS', disaster: 'PH DISASTER', national: 'PH NEWS' };
        const label = post._isLiveNews
            ? (liveLabels[post._relevance] || 'PH NEWS')
            : (categoryLabels[post.category] || 'NEWS');
        const isVideo = post.type === 'video' || !!post.video_path;
        const dateTime = post.created_at ? this._formatManilaDateTime(post.created_at) : '';
        const authorName = post.author_name || '';
        const authorInitial = post.author_avatar || (authorName ? authorName.charAt(0) : 'U');
        const imageUrl = this._mediaUrl(post.image_path);
        const videoUrl = this._mediaUrl(post.video_path);

        const user = (typeof Store !== 'undefined' && Store.get) ? Store.get('user') : null;
        const isOwner = user && post.user_id && user.id === post.user_id;

        const repostHeader = post.reposted_from_post_id && post.reposted_from_author_name
            ? `<div class="post-card__repost-header">
                    <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
                    <span>Reposted from <strong>${this.escape(post.reposted_from_author_name)}</strong></span>
               </div>`
            : '';

        const clickAction = post.url
            ? `onclick="window.open('${post.url}', '_blank', 'noopener')"`
            : (post._isLiveNews ? '' : `onclick="NewsUpdatesPage.showPostDetail(${post.id})"`);

        // Action buttons — live news skips them (they're external links).
        // U-1: stopPropagation is forwarded into each handler so the click
        // doesn't bubble up to the card's `showPostDetail` (which used to
        // hijack the edit button on some devices).
        const actions = post._isLiveNews ? '' : `
            <div class="news-card__actions" onclick="event.stopPropagation()">
                <button type="button" class="news-card__action" onclick="event.stopPropagation(); NewsUpdatesPage.repost(${post.id})" title="Repost to your feed">
                    <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
                    Repost
                </button>
                <button type="button" class="news-card__action" onclick="event.stopPropagation(); NewsUpdatesPage.share(${post.id})" title="Share via other apps">
                    <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                    Share
                </button>
                ${isOwner ? `
                    <button type="button" class="news-card__action" onclick="event.stopPropagation(); NewsUpdatesPage.showEditModal(${post.id})" title="Edit">
                        <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Edit
                    </button>
                    <button type="button" class="news-card__action news-card__action--danger" onclick="event.stopPropagation(); NewsUpdatesPage.confirmDelete(${post.id})" title="Delete">
                        <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                        Delete
                    </button>
                ` : ''}
            </div>
        `;

        const mediaBlock = videoUrl ? `
            <div class="news-card__thumb">
                <video class="post-card__video" controls preload="metadata" src="${videoUrl}"></video>
            </div>
        ` : (imageUrl ? `
            <div class="news-card__thumb">
                <img src="${imageUrl}" alt="${this.escape(post.title)}" loading="lazy"
                     onerror="this.parentElement.innerHTML='<div class=\\'news-card__thumb--fallback\\'><svg viewBox=\\'0 0 24 24\\'><path d=\\'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2\\'></path></svg></div>'">
                ${isVideo && !videoUrl ? '<div class="news-card__play-overlay"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div>' : ''}
            </div>
        ` : `
            <div class="news-card__thumb news-card__thumb--avatar">
                <span>${this.escape(authorInitial)}</span>
            </div>
        `);

        return `
            <div class="news-card ${post._isLiveNews ? 'news-card--live' : ''}" ${clickAction}>
                ${repostHeader}
                ${mediaBlock}
                <div class="news-card__body">
                    <span class="news-card__category ${post._isLiveNews && post._relevance === 'local' ? 'news-card__category--local' : ''}">${label}</span>
                    <div class="news-card__title">${this.escape(post.title)}</div>
                    <div class="news-card__excerpt">${this.escape(post.content || '')}</div>
                    <div class="news-card__meta">
                        ${authorName ? `<span class="news-card__author">${this.escape(authorName)}</span>` : ''}
                        ${dateTime ? `<span class="news-card__date">${dateTime}</span>` : ''}
                    </div>
                    ${post.location ? `
                        <div class="post-card__location">
                            <svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            ${this.escape(post.location)}
                        </div>
                    ` : ''}
                    ${actions}
                </div>
            </div>
        `;
    },

    /* --------------------------------------------------------
     * 5. Create / Edit Post Modal
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
                            <div class="form-group">
                                <div class="form-group__label">Location</div>
                                <input class="form-input" type="text" id="post-location" placeholder="Barangay or landmark (defaults to your barangay)">
                            </div>
                            <div class="form-group">
                                <div class="form-group__label">Photo or Video (optional)</div>
                                <input class="form-input" type="file" id="post-media" accept="image/*,video/mp4" onchange="NewsUpdatesPage._previewMedia(this)">
                                <div style="font-size:var(--font-size-xs);color:var(--color-gray-500);margin-top:4px;">Max 5 MB. JPG/PNG/GIF or MP4.</div>
                                <!-- U-2: visible preview so user knows the image actually attached. -->
                                <div id="post-media-preview" class="post-media-preview" style="display:none;"></div>
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

    // U-2: render the actual selected file as an image/video preview
    // (rather than the empty gray placeholder users were seeing).
    _previewMedia(input) {
        const wrap = document.getElementById('post-media-preview');
        if (!wrap) return;
        const file = input && input.files && input.files[0];
        if (!file) {
            wrap.style.display = 'none';
            wrap.innerHTML = '';
            return;
        }
        const isVideo = (file.type || '').startsWith('video/');
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            wrap.style.display = 'block';
            if (isVideo) {
                wrap.innerHTML = `<video src="${dataUrl}" controls style="width:100%;border-radius:var(--radius-md);max-height:240px;background:#000;"></video>`;
            } else {
                wrap.innerHTML = `<img src="${dataUrl}" alt="Selected image" style="width:100%;max-height:240px;object-fit:cover;border-radius:var(--radius-md);display:block;">`;
            }
        };
        reader.onerror = () => {
            wrap.style.display = 'block';
            wrap.innerHTML = '<div style="font-size:var(--font-size-xs);color:var(--color-danger);">Could not read this file. Please try a different image.</div>';
        };
        reader.readAsDataURL(file);
    },

    async submitPost() {
        const title = document.getElementById('post-title').value.trim();
        const content = document.getElementById('post-content').value.trim();
        const location = document.getElementById('post-location').value.trim();
        const mediaInput = document.getElementById('post-media');
        const file = mediaInput && mediaInput.files && mediaInput.files[0];

        if (!title) { alert('Please enter a title.'); return; }

        const btn = document.getElementById('publish-post-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Publishing...'; }

        const isVideo = file && (file.type || '').startsWith('video/');
        const typeValue = this._newPostCat === 'videos' || isVideo ? 'video' : 'post';

        try {
            let res;
            if (file) {
                // Multipart branch — backend's posts route detects content-type
                // and runs multer inline.
                const form = new FormData();
                form.append('title', title);
                if (content) form.append('content', content);
                form.append('category', this._newPostCat);
                form.append('type', typeValue);
                if (location) form.append('location', location);
                form.append('media', file);
                res = await Store.apiFetch('/api/posts', { method: 'POST', body: form });
            } else {
                res = await Store.apiFetch('/api/posts', {
                    method: 'POST',
                    body: JSON.stringify({
                        title,
                        content: content || null,
                        category: this._newPostCat,
                        type: typeValue,
                        location: location || null,
                    }),
                });
            }

            if (res.success) {
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

    /* --- Edit post --- */
    showEditModal(postId) {
        // U-1: numeric coercion — inline-onclick template literals can pass
        // postId as a string in some build paths; strict === would miss.
        const id = typeof postId === 'string' ? parseInt(postId, 10) : postId;
        const post = this.posts.find(p => p.id === id);
        if (!post) {
            alert('Cannot find this post. Please refresh the page and try again.');
            return;
        }

        // Mount on <body> so the modal isn't clipped/hidden by the page-scoped
        // container that the news-updates render() returns. Same fix as
        // showPostDetail — page-scoped containers get clobbered by parent
        // transforms / overflow / animations.
        let container = document.getElementById('edit-post-modal-container');
        if (!container || container.parentElement !== document.body) {
            if (container) container.remove();
            container = document.createElement('div');
            container.id = 'edit-post-modal-container';
            document.body.appendChild(container);
        }

        const imageUrl = this._mediaUrl(post.image_path);
        const videoUrl = this._mediaUrl(post.video_path);
        const hasMedia = !!(imageUrl || videoUrl);

        // Edit-state defaults — overridden by JS as the user picks/removes
        this._editState = {
            postId: post.id,
            removeImage: false,
            removeVideo: false,
            originalImagePath: post.image_path || null,
            originalVideoPath: post.video_path || null,
        };

        const mediaPreviewBlock = hasMedia
            ? `<div class="edit-media__current" id="edit-media-current">
                  ${videoUrl
                    ? `<video class="edit-media__preview" controls src="${videoUrl}"></video>`
                    : `<img class="edit-media__preview" src="${imageUrl}" alt="">`}
                  <button type="button" class="edit-media__remove-btn" onclick="NewsUpdatesPage.removeEditMedia()">
                      <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                      Remove
                  </button>
              </div>`
            : '<div class="edit-media__empty" id="edit-media-current">No image or video attached.</div>';

        container.innerHTML = `
            <div class="modal-overlay modal-overlay--centered" onclick="if(event.target===this) NewsUpdatesPage.closeEditModal()">
                <div class="modal post-edit-modal">
                    <button type="button" class="post-detail-modal__close" onclick="NewsUpdatesPage.closeEditModal()" aria-label="Close">
                        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    <div class="modal__title">Edit Post</div>
                    <div class="form-group">
                        <div class="form-group__label">Title</div>
                        <input class="form-input" type="text" id="edit-post-title" value="${this.escape(post.title || '')}">
                    </div>
                    <div class="form-group">
                        <div class="form-group__label">Content</div>
                        <textarea class="form-input" id="edit-post-content" style="min-height:120px;">${this.escape(post.content || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <div class="form-group__label">Media</div>
                        <div class="edit-media">
                            ${mediaPreviewBlock}
                            <label class="edit-media__upload-btn" for="edit-post-file">
                                <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                <span id="edit-media-upload-label">${hasMedia ? 'Replace media' : 'Add image or video'}</span>
                                <input type="file" id="edit-post-file" accept="image/*,video/*" hidden onchange="NewsUpdatesPage.onEditMediaSelect(event)">
                            </label>
                        </div>
                    </div>
                    <div class="modal__actions" style="margin-top: var(--spacing-lg); display:grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);">
                        <button type="button" class="btn btn--outline" onclick="NewsUpdatesPage.closeEditModal()">Cancel</button>
                        <button type="button" class="btn btn--primary" id="edit-post-save-btn" onclick="NewsUpdatesPage.submitEdit(${post.id})">Save Changes</button>
                    </div>
                </div>
            </div>
        `;
        document.body.style.overflow = 'hidden';
    },

    onEditMediaSelect(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        // Picking a new file overrides any previous "remove" decision —
        // backend will replace whichever media slot matches the mimetype.
        this._editState.removeImage = false;
        this._editState.removeVideo = false;

        const url = URL.createObjectURL(file);
        const isVideo = (file.type || '').startsWith('video/');
        const wrap = document.getElementById('edit-media-current');
        if (wrap) {
            wrap.className = 'edit-media__current';
            wrap.innerHTML = isVideo
                ? `<video class="edit-media__preview" controls src="${url}"></video>`
                : `<img class="edit-media__preview" src="${url}" alt="">`;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'edit-media__remove-btn';
            btn.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path></svg> Clear selection';
            btn.onclick = () => NewsUpdatesPage.clearEditMediaSelection();
            wrap.appendChild(btn);
        }
        const label = document.getElementById('edit-media-upload-label');
        if (label) label.textContent = 'Replace selection';
    },

    clearEditMediaSelection() {
        const fileInput = document.getElementById('edit-post-file');
        if (fileInput) fileInput.value = '';
        // Restore the original media preview (or empty state) — not the post's
        // pre-edit choice of removal.
        const post = this.posts.find(p => p.id === this._editState.postId);
        if (!post) return;
        const wrap = document.getElementById('edit-media-current');
        const imageUrl = this._mediaUrl(post.image_path);
        const videoUrl = this._mediaUrl(post.video_path);
        const hasMedia = !!(imageUrl || videoUrl);
        if (!wrap) return;
        if (hasMedia && !this._editState.removeImage && !this._editState.removeVideo) {
            wrap.className = 'edit-media__current';
            wrap.innerHTML = (videoUrl
                ? `<video class="edit-media__preview" controls src="${videoUrl}"></video>`
                : `<img class="edit-media__preview" src="${imageUrl}" alt="">`)
                + `<button type="button" class="edit-media__remove-btn" onclick="NewsUpdatesPage.removeEditMedia()">
                       <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path></svg>
                       Remove
                   </button>`;
            const label = document.getElementById('edit-media-upload-label');
            if (label) label.textContent = 'Replace media';
        } else {
            wrap.className = 'edit-media__empty';
            wrap.innerHTML = 'No image or video attached.';
            const label = document.getElementById('edit-media-upload-label');
            if (label) label.textContent = 'Add image or video';
        }
    },

    removeEditMedia() {
        this._editState.removeImage = !!this._editState.originalImagePath;
        this._editState.removeVideo = !!this._editState.originalVideoPath;
        const fileInput = document.getElementById('edit-post-file');
        if (fileInput) fileInput.value = '';
        const wrap = document.getElementById('edit-media-current');
        if (wrap) {
            wrap.className = 'edit-media__empty';
            wrap.innerHTML = 'Media will be removed when you save.';
        }
        const label = document.getElementById('edit-media-upload-label');
        if (label) label.textContent = 'Add image or video';
    },

    closeEditModal() {
        const container = document.getElementById('edit-post-modal-container');
        if (container) container.innerHTML = '';
        document.body.style.overflow = '';
    },

    async submitEdit(postId) {
        const titleEl = document.getElementById('edit-post-title');
        const contentEl = document.getElementById('edit-post-content');
        const fileEl = document.getElementById('edit-post-file');
        const btn = document.getElementById('edit-post-save-btn');
        if (!titleEl || !contentEl) return;

        const title = titleEl.value.trim();
        const content = contentEl.value.trim();
        if (!title) { alert('Title is required.'); return; }

        if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

        const file = fileEl && fileEl.files && fileEl.files[0];
        const removeImage = !!(this._editState && this._editState.removeImage);
        const removeVideo = !!(this._editState && this._editState.removeVideo);
        const hasMediaChange = !!file || removeImage || removeVideo;

        try {
            let res;
            if (hasMediaChange) {
                // Switch to multipart so the new file (if any) hits multer
                // and the remove flags ride along as form fields. apiFetch
                // sets a JSON content-type by default, so go raw fetch and
                // attach the auth header by hand.
                const fd = new FormData();
                fd.append('title', title);
                fd.append('content', content || '');
                if (file) fd.append('media', file);
                if (removeImage) fd.append('remove_image', '1');
                if (removeVideo) fd.append('remove_video', '1');

                // Token lives in localStorage (Store.getToken), not in the
                // reactive Store map. Also prepend the same API_BASE the
                // app uses so this works inside the Capacitor APK shell.
                const token = (typeof Store !== 'undefined' && Store.getToken) ? Store.getToken() : null;
                const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
                const apiBase = isNative ? 'https://pulse.afkcube.com' : '';
                const raw = await fetch(apiBase + '/api/posts/' + postId, {
                    method: 'PUT',
                    headers: token ? { 'Authorization': 'Bearer ' + token } : {},
                    body: fd,
                });
                res = await raw.json();
            } else {
                res = await Store.apiFetch('/api/posts/' + postId, {
                    method: 'PUT',
                    body: JSON.stringify({ title, content: content || null }),
                });
            }

            if (res && res.success) {
                const idx = this.posts.findIndex(p => p.id === postId);
                if (idx !== -1 && res.data) this.posts[idx] = res.data;
                this.closeEditModal();
                this.refreshList();
                if (window.Toast) Toast.show('Post updated.', { type: 'success', duration: 2500 });
            } else {
                alert((res && res.message) || 'Failed to save changes.');
                if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
            }
        } catch (err) {
            alert('Network error. Please try again.');
            if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
        }
    },

    /* --------------------------------------------------------
     * 6. Post detail modal + edit history
     * -------------------------------------------------------- */
    showPostDetail(postId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return;

        // Mount the modal directly to <body> (not into a page-scoped container)
        // so it lives at the top of the stacking context and isn't clipped or
        // hidden by any parent transform / overflow / animation cascade.
        let container = document.getElementById('post-detail-modal-container');
        if (!container || container.parentElement !== document.body) {
            if (container) container.remove();
            container = document.createElement('div');
            container.id = 'post-detail-modal-container';
            document.body.appendChild(container);
        }

        const dateTime = post.created_at ? this._formatManilaDateTime(post.created_at) : '';
        const edited = post.updated_at && post.created_at && post.updated_at !== post.created_at;
        const imageUrl = this._mediaUrl(post.image_path);
        const videoUrl = this._mediaUrl(post.video_path);

        const repostHeader = post.reposted_from_post_id && post.reposted_from_author_name
            ? `<div class="post-card__repost-header" style="margin: 0 0 var(--spacing-md) 0; border-radius: var(--radius-md);">
                    Reposted from <strong>${this.escape(post.reposted_from_author_name)}</strong>
               </div>`
            : '';

        container.innerHTML = `
            <div class="modal-overlay modal-overlay--centered" onclick="if(event.target===this) NewsUpdatesPage.closePostDetail()">
                <div class="modal post-detail-modal">
                    <button type="button" class="post-detail-modal__close" onclick="NewsUpdatesPage.closePostDetail()" aria-label="Close">
                        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    ${repostHeader}
                    <div class="modal__title">${this.escape(post.title || '')}</div>
                    <div class="post-detail-modal__meta">
                        <span>${this.escape(post.author_name || '')}</span>
                        ${dateTime ? `<span>·</span><span>${this.escape(dateTime)}</span>` : ''}
                        ${post.location ? `<span>·</span><span>${this.escape(post.location)}</span>` : ''}
                    </div>
                    ${videoUrl ? `<video class="post-detail-modal__media" controls src="${videoUrl}"></video>` : ''}
                    ${imageUrl && !videoUrl ? `<img class="post-detail-modal__media" src="${imageUrl}" alt="">` : ''}
                    <div class="post-detail-modal__content">${this.escape(post.content || '')}</div>
                    ${edited ? `
                        <div style="margin-top:var(--spacing-lg);">
                            <button type="button" class="btn-link" onclick="NewsUpdatesPage.toggleEditHistory(${post.id})" id="edit-history-toggle-${post.id}">
                                See edit history
                            </button>
                            <div class="post-edit-history" id="edit-history-${post.id}" style="display:none;"></div>
                        </div>
                    ` : ''}
                    <div class="modal__actions" style="margin-top:var(--spacing-lg);">
                        <button type="button" class="btn btn--outline btn--block" onclick="NewsUpdatesPage.closePostDetail()">Close</button>
                    </div>
                </div>
            </div>
        `;
        document.body.style.overflow = 'hidden';
    },

    closePostDetail() {
        const container = document.getElementById('post-detail-modal-container');
        if (container) container.innerHTML = '';
        document.body.style.overflow = '';
    },

    async toggleEditHistory(postId) {
        const wrap = document.getElementById('edit-history-' + postId);
        const toggle = document.getElementById('edit-history-toggle-' + postId);
        if (!wrap) return;

        if (wrap.style.display !== 'none') {
            wrap.style.display = 'none';
            if (toggle) toggle.textContent = 'See edit history';
            return;
        }

        wrap.style.display = 'block';
        if (toggle) toggle.textContent = 'Hide edit history';
        wrap.innerHTML = '<div class="loading-state">Loading history...</div>';

        try {
            const res = await Store.apiFetch('/api/posts/' + postId + '/edits');
            if (!res.success || !Array.isArray(res.data) || res.data.length === 0) {
                wrap.innerHTML = '<div class="empty-state" style="padding:var(--spacing-md);">No previous revisions.</div>';
                return;
            }
            wrap.innerHTML = res.data.map(e => `
                <div class="post-edit-history__item">
                    <div class="post-edit-history__meta">
                        <strong>${this.escape(e.editor_name || 'Editor')}</strong>
                        <span>${this._formatManilaDateTime(e.edited_at)}</span>
                    </div>
                    <div class="post-edit-history__old-title">${this.escape(e.old_title || '')}</div>
                    <div class="post-edit-history__old-content">${this.escape(e.old_content || '')}</div>
                </div>
            `).join('');
        } catch (err) {
            wrap.innerHTML = '<div class="empty-state" style="padding:var(--spacing-md);">Unable to load history.</div>';
        }
    },

    /* --------------------------------------------------------
     * 7. Repost
     * -------------------------------------------------------- */
    async repost(postId) {
        if (!confirm('Repost this to your feed?')) return;
        try {
            const res = await Store.apiFetch('/api/posts/' + postId + '/repost', { method: 'POST' });
            if (res.success) {
                this.posts.unshift(res.data);
                this.refreshList();
            } else {
                alert(res.message || 'Failed to repost.');
            }
        } catch (err) {
            alert('Network error. Please try again.');
        }
    },

    /* --------------------------------------------------------
     * 7c. Delete (owner or admin) — confirms before removing
     * -------------------------------------------------------- */
    async confirmDelete(postId) {
        if (!confirm('Delete this post? This cannot be undone.')) return;
        try {
            const res = await Store.apiFetch('/api/posts/' + postId, { method: 'DELETE' });
            if (res.success) {
                this.posts = this.posts.filter(p => p.id !== postId);
                this.refreshList();
                if (window.Toast) Toast.show('Post deleted.', { type: 'success', duration: 2500 });
            } else {
                alert(res.message || 'Failed to delete post.');
            }
        } catch (err) {
            alert('Network error. Please try again.');
        }
    },

    /* --------------------------------------------------------
     * 7b. Share — external (native share sheet on mobile,
     *     clipboard fallback elsewhere)
     * -------------------------------------------------------- */
    async share(postId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return;

        const baseUrl = (window.location.origin && window.location.origin.startsWith('http'))
            ? window.location.origin
            : 'https://pulse.afkcube.com';
        const url = `${baseUrl}/#/news-updates?post=${post.id}`;

        const title = post.title || 'PULSE 911 community post';
        const text = post.content
            ? `${post.title}\n\n${post.content}\n\n— shared from PULSE 911`
            : `${post.title}\n\n— shared from PULSE 911`;

        // Native share sheet (Android via Capacitor, iOS Safari, Edge, Chrome
        // mobile). Falls back to clipboard copy when the API isn't available.
        if (navigator.share) {
            try {
                await navigator.share({ title, text, url });
                return;
            } catch (err) {
                // User cancelled — silent. Other failures fall through to copy.
                if (err && err.name === 'AbortError') return;
            }
        }

        try {
            await navigator.clipboard.writeText(`${text}\n\n${url}`);
            alert('Link copied to clipboard. Paste it into any app to share.');
        } catch (e) {
            // Last-resort prompt — at least gives the user the URL.
            window.prompt('Copy this link to share:', url);
        }
    },

    /* --------------------------------------------------------
     * 8. Filter & search
     * -------------------------------------------------------- */
    setFilter(filter) {
        this.activeFilter = filter;
        // Find the matching tab in the DOM by its onclick attribute instead
        // of reading the global `event` (undefined in strict mode / programmatic).
        document.querySelectorAll('.news-tab').forEach(t => t.classList.remove('active'));
        const btn = document.querySelector(`.news-tab[onclick*="setFilter('${filter}')"]`);
        if (btn) btn.classList.add('active');
        this.refreshList();
    },

    handleSearch(value) {
        this.searchTerm = value;
        this.refreshList();
    },

    /* --------------------------------------------------------
     * 9. QR modal
     * -------------------------------------------------------- */
    showQRModal() {
        this.closeQRModal();

        const modal = document.createElement('div');
        modal.id = 'qr-modal';
        modal.className = 'modal-overlay modal-overlay--centered';
        modal.onclick = (e) => {
            if (e.target === modal) NewsUpdatesPage.closeQRModal();
        };

        const formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSdZ0Ss4IXFssnqex5vTZEsjfSwTS7-aaI2lBPvPxD1KaHb6Ug/viewform';

        modal.innerHTML = `
            <div class="modal" style="max-width: 360px; text-align: center; padding: var(--spacing-xl);">
                <div class="modal__title" style="margin-bottom: var(--spacing-sm);">Citizen Survey</div>
                <div class="modal__desc" style="color: var(--color-gray-600); font-size: var(--font-size-sm); margin-bottom: var(--spacing-lg);">
                    Scan this QR code with your phone camera, or tap "Open survey" below, to access the Pulse 911 MDRRMO citizen survey.
                </div>
                <div style="display:flex;justify-content:center;margin-bottom:var(--spacing-lg);">
                    <img src="public/assets/news/survey-qr.svg" alt="Citizen Survey QR Code"
                         style="width:220px;height:220px;border-radius:var(--radius-md);border:1px solid var(--color-gray-200);background:white;padding:8px;"
                         onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                    <div style="display:none;width:220px;height:220px;border-radius:var(--radius-md);border:1px solid var(--color-gray-200);background:var(--color-gray-100);align-items:center;justify-content:center;text-align:center;padding:var(--spacing-md);color:var(--color-gray-500);font-size:var(--font-size-xs);">
                        QR image not available.<br>Use the "Open survey" button below.
                    </div>
                </div>
                <a href="${formUrl}" target="_blank" rel="noopener noreferrer"
                   class="btn btn--primary btn--block" style="margin-bottom: var(--spacing-sm);">
                    Open survey
                </a>
                <button class="btn btn--outline btn--block" type="button"
                        onclick="NewsUpdatesPage.closeQRModal()">Close</button>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        this._qrEscHandler = (e) => {
            if (e.key === 'Escape') NewsUpdatesPage.closeQRModal();
        };
        document.addEventListener('keydown', this._qrEscHandler);
    },

    closeQRModal() {
        const modal = document.getElementById('qr-modal');
        if (modal) modal.remove();
        document.body.style.overflow = '';
        if (this._qrEscHandler) {
            document.removeEventListener('keydown', this._qrEscHandler);
            this._qrEscHandler = null;
        }
    },

    /* --------------------------------------------------------
     * 10. Helpers
     * -------------------------------------------------------- */
    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
        });
    },

    // Accepts bare filenames (legacy) or already-absolute paths/URLs and
    // returns a URL the browser can load. Returns null for falsy input.
    // Delegates to Store.mediaUrl so the API_BASE prefix is applied on
    // native — relative /uploads/... won't resolve against the WebView's
    // https://localhost origin.
    _mediaUrl(raw) {
        return Store.mediaUrl(raw);
    },

    _formatManilaDateTime(dateStr) {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            return d.toLocaleString('en-US', {
                timeZone: 'Asia/Manila',
                month: 'short', day: 'numeric', year: 'numeric',
                hour: 'numeric', minute: '2-digit',
            });
        } catch (_) {
            return '';
        }
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
