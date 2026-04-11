/* ============================================================
   Appearance Page
   ============================================================
   Theme and visual preferences (theme mode, text size).
   Persists to localStorage and applies immediately.
   Table of Contents:
   1. State initialization
   2. Render method
   3. Theme handlers
   4. Text size handlers
   5. Restore on app startup
   ============================================================ */

const AppearancePage = {
    prefs: {},

    /* --------------------------------------------------------
       1. State initialization
       -------------------------------------------------------- */
    init() {
        const saved = localStorage.getItem('pulse_appearance');
        this.prefs = saved ? JSON.parse(saved) : {
            theme: 'system',     // 'light' | 'dark' | 'system'
            textSize: 'medium'   // 'small' | 'medium' | 'large'
        };
    },

    /* --------------------------------------------------------
       2. Render
       -------------------------------------------------------- */
    render() {
        this.init();
        const p = this.prefs;

        return `
            <div class="page-padding">
                <div class="profile-page__section-label">Theme</div>
                <div class="profile-page__group">
                    ${this.renderThemeOption('light', 'Light', 'Bright background, dark text', p.theme)}
                    ${this.renderThemeOption('dark', 'Dark', 'Dark background, light text', p.theme)}
                    ${this.renderThemeOption('system', 'System', 'Follow your device setting', p.theme)}
                </div>

                <div class="profile-page__section-label">Text Size</div>
                <div class="profile-page__group">
                    ${this.renderSizeOption('small', 'Small', p.textSize)}
                    ${this.renderSizeOption('medium', 'Medium', p.textSize)}
                    ${this.renderSizeOption('large', 'Large', p.textSize)}
                </div>

                <button class="btn btn--primary btn--block mt-lg"
                        onclick="AppearancePage.save()">
                    Save Appearance
                </button>
            </div>
        `;
    },

    renderThemeOption(value, label, desc, current) {
        const checked = current === value;
        return `
            <button type="button" class="appearance-option ${checked ? 'appearance-option--active' : ''}"
                    onclick="AppearancePage.setTheme('${value}')">
                <div class="appearance-option__icon appearance-option__icon--${value}">
                    ${this.getThemeIcon(value)}
                </div>
                <div class="appearance-option__text">
                    <div class="appearance-option__label">${label}</div>
                    <div class="appearance-option__desc">${desc}</div>
                </div>
                <div class="appearance-option__check">
                    ${checked ? '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                </div>
            </button>
        `;
    },

    renderSizeOption(value, label, current) {
        const checked = current === value;
        const sizeStyle = { small: '0.875rem', medium: '1rem', large: '1.125rem' }[value];
        return `
            <button type="button" class="appearance-option ${checked ? 'appearance-option--active' : ''}"
                    onclick="AppearancePage.setTextSize('${value}')">
                <div class="appearance-option__text">
                    <div class="appearance-option__label" style="font-size: ${sizeStyle};">${label}</div>
                </div>
                <div class="appearance-option__check">
                    ${checked ? '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                </div>
            </button>
        `;
    },

    getThemeIcon(theme) {
        const icons = {
            light: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>',
            dark: '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
            system: '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>'
        };
        return icons[theme] || '';
    },

    /* --------------------------------------------------------
       3. Theme Handlers
       -------------------------------------------------------- */
    setTheme(value) {
        this.prefs.theme = value;
        this.applyTheme(value);
        document.getElementById('app-content').innerHTML = this.render();
    },

    applyTheme(theme) {
        const body = document.body;
        body.classList.remove('theme-light', 'theme-dark');

        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            body.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
        } else {
            body.classList.add(`theme-${theme}`);
        }
    },

    /* --------------------------------------------------------
       4. Text Size Handlers
       -------------------------------------------------------- */
    setTextSize(value) {
        this.prefs.textSize = value;
        this.applyTextSize(value);
        document.getElementById('app-content').innerHTML = this.render();
    },

    applyTextSize(size) {
        const root = document.documentElement;
        root.classList.remove('text-small', 'text-medium', 'text-large');
        root.classList.add(`text-${size}`);
    },

    save() {
        localStorage.setItem('pulse_appearance', JSON.stringify(this.prefs));
        alert('Appearance saved!');
        history.back();
    },

    /* --------------------------------------------------------
       5. Restore on App Startup
       -------------------------------------------------------- */
    restoreAppearance() {
        const saved = localStorage.getItem('pulse_appearance');
        if (!saved) return;
        try {
            const prefs = JSON.parse(saved);
            if (prefs.theme) this.applyTheme(prefs.theme);
            if (prefs.textSize) this.applyTextSize(prefs.textSize);
        } catch (e) {
            // ignore corrupt data
        }
    }
};
