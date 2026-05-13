/* ============================================================
   Admin Settings Page — Runtime App Configuration
   ============================================================
   Lets admins edit the TextBee SMS gateway credentials at
   runtime. DB-stored values override .env; saving invalidates
   the server-side cache so changes take effect immediately.
   Also supports a one-shot "Test SMS" to verify creds work.

   Table of Contents:
   1. State
   2. Render
   3. Data loading
   4. Form handlers (save, test, show/hide api key)
   5. Helpers (status badge, source chip)
   ============================================================ */

const AdminSettingsPage = {
    /* ------------------------------------------------------
       1. State
       ------------------------------------------------------ */
    data: null,          // last response payload from GET /sms
    showApiKey: false,   // show/hide toggle for the API key input

    /* ------------------------------------------------------
       2. Render
       ------------------------------------------------------ */
    render() {
        setTimeout(() => this.loadData(), 0);

        return `
            <div class="page-padding">
                <div class="welcome-card">
                    <div class="welcome-card__title">App Settings</div>
                    <div class="welcome-card__text">
                        Edit runtime configuration. Values saved here override
                        the .env defaults without needing a server restart.
                    </div>
                </div>

                <div class="card" id="settings-sms-card">
                    <div class="section-header" style="padding: 0 0 var(--spacing-md) 0;">
                        <div class="section-header__title">
                            <svg viewBox="0 0 24 24">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                            SMS Gateway (TextBee)
                        </div>
                        <span id="settings-status" class="text-sm" style="color: var(--color-gray-500);">Loading…</span>
                    </div>

                    <div id="settings-sms-body">
                        <div class="loading-state">Loading current credentials…</div>
                    </div>
                </div>
            </div>
        `;
    },

    /* ------------------------------------------------------
       3. Data loading
       ------------------------------------------------------ */
    async loadData() {
        try {
            const res = await Store.apiFetch('/api/admin/settings/sms');
            if (!res.success) {
                this.renderError(res.message || 'Failed to load settings.');
                return;
            }
            this.data = res.data;
            this.setStatus('Loaded', 'ok');
            this.renderForm();
        } catch (err) {
            this.renderError('Network error — check your connection.');
        }
    },

    renderError(msg) {
        const body = document.getElementById('settings-sms-body');
        if (body) {
            body.innerHTML = `<div class="text-sm" style="color: var(--color-danger);">${msg}</div>`;
        }
        this.setStatus('Error', 'error');
    },

    renderForm() {
        const d = this.data;
        if (!d) return;
        const body = document.getElementById('settings-sms-body');
        if (!body) return;

        // The user's own phone is a handy default for the Test SMS input.
        const me = (Store.get('user') || {});
        const defaultTestPhone = me.phone || '';

        body.innerHTML = `
            <div class="input-group">
                <label class="input-group__label" for="st-api-key">
                    API Key ${this.renderSourceChip(d.apiKey.source)}
                </label>
                <div style="display:flex; gap: var(--spacing-sm); align-items:stretch;">
                    <input class="input-group__field" id="st-api-key"
                           type="${this.showApiKey ? 'text' : 'password'}"
                           autocomplete="off" spellcheck="false"
                           placeholder="${d.apiKey.hasValue ? d.apiKey.value : 'Paste new TextBee API key'}"
                           value=""
                           style="flex:1;">
                    <button type="button" class="btn btn--outline btn--sm"
                            onclick="AdminSettingsPage.toggleShowApiKey()"
                            style="flex-shrink:0;">
                        ${this.showApiKey ? 'Hide' : 'Show'}
                    </button>
                </div>
                <div class="input-group__hint">
                    Leave blank to keep the current key. Clear the field and click "Clear" to fall back to .env.
                </div>
                <div style="margin-top: var(--spacing-xs);">
                    <button type="button" class="btn btn--outline btn--sm"
                            onclick="AdminSettingsPage.clearField('apiKey')">Clear saved key</button>
                </div>
            </div>

            <div class="input-group">
                <label class="input-group__label" for="st-device-id">
                    Device ID ${this.renderSourceChip(d.deviceId.source)}
                </label>
                <input class="input-group__field" id="st-device-id" type="text"
                       autocomplete="off" spellcheck="false"
                       value="${this.escape(d.deviceId.value)}"
                       placeholder="TextBee device id (UUID)">
            </div>

            <div class="input-group">
                <label class="input-group__label" for="st-api-url">
                    API URL ${this.renderSourceChip(d.apiUrl.source)}
                </label>
                <input class="input-group__field" id="st-api-url" type="text"
                       autocomplete="off" spellcheck="false"
                       value="${this.escape(d.apiUrl.value)}"
                       placeholder="https://api.textbee.dev/api/v1">
            </div>

            <div class="input-group">
                <label class="input-group__label" for="st-gateway-phone">
                    Gateway Phone ${this.renderSourceChip(d.gatewayPhone.source)}
                </label>
                <input class="input-group__field" id="st-gateway-phone" type="tel"
                       autocomplete="off" spellcheck="false"
                       value="${this.escape(d.gatewayPhone.value)}"
                       placeholder="09XXXXXXXXX">
            </div>

            <button type="button" class="btn btn--primary btn--block"
                    id="st-save-btn"
                    onclick="AdminSettingsPage.save()">Save changes</button>

            <div style="border-top: 1px solid var(--color-gray-100); margin: var(--spacing-lg) 0 var(--spacing-md);"></div>

            <div class="section-header" style="padding: 0 0 var(--spacing-md) 0;">
                <div class="section-header__title" style="font-size: var(--font-size-md);">
                    Send Test SMS
                </div>
            </div>

            <div class="input-group">
                <label class="input-group__label" for="st-test-phone">
                    Recipient phone
                </label>
                <div style="display:flex; gap: var(--spacing-sm); align-items:stretch;">
                    <input class="input-group__field" id="st-test-phone" type="tel"
                           autocomplete="off" spellcheck="false"
                           value="${this.escape(defaultTestPhone)}"
                           placeholder="09XXXXXXXXX"
                           style="flex:1;">
                    <button type="button" class="btn btn--outline"
                            id="st-test-btn"
                            onclick="AdminSettingsPage.sendTest()"
                            style="flex-shrink:0;">Send Test SMS</button>
                </div>
                <div class="input-group__hint">
                    Sends "PULSE 911 admin test ✓" using the currently-saved credentials.
                </div>
            </div>
        `;
    },

    /* ------------------------------------------------------
       4. Handlers
       ------------------------------------------------------ */

    toggleShowApiKey() {
        this.showApiKey = !this.showApiKey;
        this.renderForm();
    },

    /**
     * Clears a specific DB-stored override. Sends an explicit empty string
     * so the backend upserts a blank — get() then returns null and the
     * service falls back to .env.
     */
    async clearField(field) {
        if (!confirm('Clear the saved API key and fall back to .env?')) return;
        const body = {};
        body[field] = '';
        try {
            this.setStatus('Saving…', 'pending');
            const res = await Store.apiFetch('/api/admin/settings/sms', {
                method: 'PUT',
                body: JSON.stringify(body),
            });
            if (!res.success) {
                this.setStatus(res.message || 'Save failed', 'error');
                return;
            }
            this.data = res.data;
            this.setStatus('Saved', 'ok');
            this.renderForm();
            this.toast('Saved. Falling back to .env value.', 'success');
        } catch (err) {
            this.setStatus('Network error', 'error');
        }
    },

    async save() {
        const btn = document.getElementById('st-save-btn');
        const apiKey       = document.getElementById('st-api-key').value;
        const deviceId     = document.getElementById('st-device-id').value.trim();
        const apiUrl       = document.getElementById('st-api-url').value.trim();
        const gatewayPhone = document.getElementById('st-gateway-phone').value.trim();

        // Only include the api key when the user actually typed something.
        // Empty input means "leave current value alone" (not "clear"); the
        // dedicated "Clear saved key" button handles clearing.
        const body = { deviceId, apiUrl, gatewayPhone };
        if (apiKey && apiKey.length > 0) body.apiKey = apiKey;

        if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
        this.setStatus('Saving…', 'pending');

        try {
            const res = await Store.apiFetch('/api/admin/settings/sms', {
                method: 'PUT',
                body: JSON.stringify(body),
            });
            if (btn) { btn.disabled = false; btn.textContent = 'Save changes'; }

            if (!res.success) {
                this.setStatus(res.message || 'Save failed', 'error');
                this.toast(res.message || 'Couldn\'t save settings.', 'error');
                return;
            }
            this.data = res.data;
            this.setStatus('Saved', 'ok');
            this.renderForm();
            this.toast('SMS gateway settings saved.', 'success');
        } catch (err) {
            if (btn) { btn.disabled = false; btn.textContent = 'Save changes'; }
            this.setStatus('Network error', 'error');
            this.toast('Network error — please try again.', 'error');
        }
    },

    async sendTest() {
        const phoneEl = document.getElementById('st-test-phone');
        const btn = document.getElementById('st-test-btn');
        const phone = (phoneEl.value || '').trim();
        if (!phone) {
            this.toast('Enter a phone number first.', 'error');
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
        try {
            const res = await Store.apiFetch('/api/admin/settings/sms/test', {
                method: 'POST',
                body: JSON.stringify({ phone }),
            });
            if (btn) { btn.disabled = false; btn.textContent = 'Send Test SMS'; }

            if (!res.success) {
                this.toast(res.message || 'Test SMS failed.', 'error');
                return;
            }
            this.toast(res.message || 'Test SMS dispatched.', 'success');
        } catch (err) {
            if (btn) { btn.disabled = false; btn.textContent = 'Send Test SMS'; }
            this.toast('Network error — please try again.', 'error');
        }
    },

    /* ------------------------------------------------------
       5. Helpers
       ------------------------------------------------------ */

    setStatus(text, kind) {
        const el = document.getElementById('settings-status');
        if (!el) return;
        const color =
            kind === 'ok'      ? 'var(--color-success)' :
            kind === 'error'   ? 'var(--color-danger)'  :
            kind === 'pending' ? 'var(--color-warning)' :
                                 'var(--color-gray-500)';
        el.textContent = text;
        el.style.color = color;
    },

    /**
     * Tiny chip showing whether a field's current value comes from the DB
     * (admin-edited), from .env, or is unset. Helps operators understand
     * what they're looking at.
     */
    renderSourceChip(source) {
        const map = {
            db:    { label: 'DB',  color: 'var(--color-primary)' },
            env:   { label: '.env', color: 'var(--color-gray-500)' },
            unset: { label: 'unset', color: 'var(--color-danger)' },
        };
        const s = map[source] || map.unset;
        return `<span style="margin-left: 6px; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: ${s.color}; color: white; vertical-align: middle;">${s.label}</span>`;
    },

    toast(msg, type = 'info') {
        if (window.Toast) Toast.show(msg, { type, duration: 4000 });
        else alert(msg);
    },

    escape(v) {
        if (v === null || v === undefined) return '';
        return String(v)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },
};

window.AdminSettingsPage = AdminSettingsPage;
