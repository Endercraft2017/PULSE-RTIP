/* ============================================================
   Toast Component — short auto-dismissing notifications
   ============================================================
   Usage:
     Toast.show('Saved!');
     Toast.show('Submitted', { type: 'success', duration: 3000 });
     Toast.show('Network error', { type: 'error' });
   ============================================================ */

const Toast = {
    _container: null,

    _ensureContainer() {
        if (this._container && document.body.contains(this._container)) return this._container;
        const c = document.createElement('div');
        c.id = 'toast-container';
        c.className = 'toast-container';
        document.body.appendChild(c);
        this._container = c;
        return c;
    },

    show(message, opts = {}) {
        const { type = 'info', duration = 3000, title = null } = opts;
        const container = this._ensureContainer();

        const el = document.createElement('div');
        el.className = `toast toast--${type}`;
        el.innerHTML = `
            <div class="toast__icon">${this._iconFor(type)}</div>
            <div class="toast__body">
                ${title ? `<div class="toast__title">${this._esc(title)}</div>` : ''}
                <div class="toast__msg">${this._esc(message)}</div>
            </div>
        `;
        container.appendChild(el);

        // Trigger transition
        requestAnimationFrame(() => el.classList.add('toast--visible'));

        const remove = () => {
            el.classList.remove('toast--visible');
            setTimeout(() => { if (el.parentElement) el.parentElement.removeChild(el); }, 250);
        };
        setTimeout(remove, duration);
        el.addEventListener('click', remove);
    },

    _iconFor(type) {
        const icons = {
            success: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>',
            error:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
            info:    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
        };
        return icons[type] || icons.info;
    },

    _esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
};

// Expose on window — top-level `const` doesn't attach to window in
// classic <script> tags, so `window.Toast` would otherwise be undefined
// and guarded calls like `if (window.Toast) Toast.show(...)` would fall
// back to alert() even when the component is loaded.
window.Toast = Toast;
