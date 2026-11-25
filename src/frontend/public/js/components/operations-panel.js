/* Admin operations: editable directories, calls, agency assignments, road advisories,
 * and delivery monitoring. All writes are authorized and audited by the API. */
window.OperationsPanel = {
    resource: 'barangays', rows: [],
    labels: { barangays: 'Barangays', hotlines: 'Emergency contacts', calls: 'Calls', responders: 'Responders', advisories: 'Advisories', broadcasts: 'Broadcasts', users: 'Users' },
    singularLabels: { barangays: 'barangay', hotlines: 'emergency contact', calls: 'call', advisories: 'road advisory' },
    deliveryLabel(status) {
        return { pending: 'Queued', queued: 'Queued', accepted: 'Provider accepted', delivered: 'Confirmed delivered',
            blocked: 'Queued · provider configuration required', retry: 'Retry scheduled', no_contact: 'No contact endpoint' }[status] || status;
    },
    schemas: {
        barangays: { name: 'Name', description: 'Profile / description', active: 'Active (1 or 0)' },
        hotlines: { label: 'Agency / label', number: 'Contact number', category: 'Category', sort_order: 'Display order' },
        calls: { caller_name: 'Caller name', contact_number: 'Contact number (may be added later)', location: 'Location (GPS required when supplied)', latitude: 'Latitude (optional for calls without a location)', longitude: 'Longitude (optional for calls without a location)', notes: 'Call notes', status: 'Status: received, dispatched, closed' },
        advisories: { label: 'Advisory (e.g. NOT PASSABLE - BINABAHA NA YUNG LUGAR)', latitude: 'Latitude', longitude: 'Longitude', status: 'Status: not_passable, caution, clear', active: 'Active (1 or 0)' },
        users: { account_status:'Account state', account_reason:'Reason for account action' },
        responders: { department: 'Agency assignment' }
    },
    esc(value) { return DetailModal._esc(value); },
    async open(resource = this.resource, focusTab = false) {
        this.resource = resource;
        const version = this.version = (this.version || 0) + 1;
        const container = document.getElementById('dashboard-content');
        if (!container) return;
        const previousScroll = container.querySelector('.operations-tabs')?.scrollLeft || 0;
        container.innerHTML = `<section class="operations-panel" aria-labelledby="operations-heading">
            <header class="operations-header">
                <h2 id="operations-heading">Dispatch operations</h2>
                <button type="button" class="operations-audit" onclick="Router.navigate('admin-audit-log')">View audit log</button>
            </header>
            <nav aria-label="Dispatch sections" class="operations-tabs">
                ${Object.entries(this.labels).map(([key, label]) => `
                    <button type="button" data-operation="${key}" aria-pressed="${key === resource}">${label}</button>
                `).join('')}
            </nav>
            <div id="operations-form"></div>
            <section class="operations-records" aria-labelledby="operations-records-heading">
                <header class="operations-records-header">
                    <h3 id="operations-records-heading">${this.labels[resource]}</h3>
                    <p>Times use Asia/Manila. Notes and changes are recorded in the audit log.</p>
                    ${resource === 'broadcasts' ? '<p>Provider acceptance means the provider took the message for processing. Confirmed delivery requires a delivery receipt.</p>' : ''}
                </header>
                <div id="operations-list">Loading…</div>
            </section>
        </section>`;
        const tabs = container.querySelector('.operations-tabs');
        tabs.scrollLeft = previousScroll;
        tabs.querySelectorAll('[data-operation]').forEach(button => {
            button.addEventListener('click', () => this.open(button.dataset.operation, true));
        });
        if (focusTab) tabs.querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
        try {
            const response = await Store.apiFetch('/api/operations/' + resource);
            if (!response.success) throw new Error(response.message);
            if (version !== this.version || !container.isConnected || !container.querySelector('#operations-list')) return;
            this.rows = response.data;
            this.departments = response.departments || [];
            if (!['broadcasts','responders','users'].includes(resource)) this.form();
            const fields = resource === 'broadcasts'
                ? ['id', 'hazard_id', 'advisory_id', 'channel', 'status', 'attempts', 'last_error', 'updated_at']
                : ['id', ...(resource === 'responders' ? ['name'] : resource === 'users' ? ['name','email','role'] : []), ...Object.keys(this.schemas[resource])];
            document.getElementById('operations-list').innerHTML = `<div style="overflow-x:auto"><table class="operations-table"><thead><tr>${fields.map(k => `<th>${this.esc(k.replace(/_/g, ' '))}</th>`).join('')}<th></th></tr></thead><tbody>${this.rows.map(row => `<tr>${fields.map(k => `<td>${this.esc(k.endsWith('_at') ? PhilippineTime.format(row[k]) : resource === 'broadcasts' && k === 'status' ? this.deliveryLabel(row[k]) : row[k])}</td>`).join('')}<td>${resource === 'broadcasts' ? `<button type="button" class="btn btn--outline btn--sm" data-broadcast="${row.id}">Recipient outcomes</button>` : resource === 'users' && row.role !== 'citizen' ? '' : `<button class="btn btn--outline btn--sm" type="button" data-edit-operation="${row.id}">Edit</button>`}</td></tr>`).join('')}</tbody></table></div>`;
            container.querySelectorAll('[data-edit-operation]').forEach(b => b.addEventListener('click', () => this.form(this.rows.find(r => r.id === Number(b.dataset.editOperation)))));
            container.querySelectorAll('[data-broadcast]').forEach(b=>b.onclick=async()=>{try{const response=await Store.apiFetch('/api/operations/broadcasts/'+b.dataset.broadcast+'/recipients');if(!response.success)throw new Error(response.message);const list=document.createElement('div');for(const row of response.data){const p=document.createElement('p');p.textContent=`User ${row.user_id ?? 'legacy'}: ${this.deliveryLabel(row.status)}${row.last_error?' — '+row.last_error:''}`;list.appendChild(p);}b.parentElement.appendChild(list);b.disabled=true;}catch(e){b.textContent=e.message;}});
        } catch (error) { const list = container.querySelector('#operations-list'); if (version === this.version && container.isConnected && list) list.textContent = error.message || 'Unable to load operations.'; }
    },
    renderField(key, label, value) {
        const required = ['name', 'label', 'caller_name', 'number', 'account_reason'].includes(key);
        const numeric = ['latitude', 'longitude', 'active', 'sort_order'].includes(key);
        let control;
        if (key === 'account_status' || key === 'department') {
            const options = key === 'department' ? this.departments : ['active', 'suspended', 'deactivated'];
            control = `<select class="form-input" name="${key}" required>
                ${key === 'department' ? '<option value="">Select agency</option>' : ''}
                ${options.map(option => `<option ${value === option ? 'selected' : ''}>${this.esc(option)}</option>`).join('')}
            </select>`;
        } else {
            control = `<input class="form-input" name="${key}" value="${this.esc(value)}"
                ${numeric ? 'type="number" step="any"' : ''} ${required ? 'required' : ''}>`;
        }
        return `<label class="operations-field"><span>${label}</span>${control}</label>`;
    },
    form(row = {}) {
        const resource = this.resource;
        const defaults = { active: 1, sort_order: 0, status: resource === 'calls' ? 'received' : 'caution' };
        const heading = row.id ? 'Edit record #' + row.id : 'Add ' + this.singularLabels[resource];
        document.getElementById('operations-form').innerHTML = `
            <form id="operation-editor" aria-labelledby="operation-editor-heading">
                <h3 id="operation-editor-heading">${heading}</h3>
                <div class="operations-fields">
                    ${Object.entries(this.schemas[resource]).map(([key, label]) => this.renderField(key, label, row[key] ?? defaults[key] ?? '')).join('')}
                </div>
                ${resource === 'advisories' ? '<p>Use coordinates within Morong. A not-passable advisory queues an urgent broadcast to all eligible registered users.</p>' : ''}
                <div class="operations-form-actions">
                    <button class="btn btn--primary" type="submit">Save</button>
                    <button class="btn btn--outline" id="operation-cancel" type="button">Cancel</button>
                </div>
                <p id="operation-error" role="alert"></p>
            </form>`;
        document.getElementById('operation-cancel').onclick = () => { document.getElementById('operations-form').innerHTML = ''; };
        const form = document.getElementById('operation-editor');
        form.onsubmit = async event => {
            event.preventDefault();
            const button = event.target.querySelector('[type=submit]'); button.disabled = true;
            const payload = Object.fromEntries(new FormData(event.target));
            for (const key of ['active', 'sort_order', 'latitude', 'longitude']) if (key in payload) payload[key] = payload[key] === '' ? null : Number(payload[key]);
            try {
                const response = await Store.apiFetch('/api/operations/' + resource + (row.id ? '/' + row.id : ''), { method: row.id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
                if (!form.isConnected || this.resource !== resource) return;
                if (!response.success) throw new Error(response.message || 'Validation failed.');
                if (resource === 'barangays') await window.refreshBarangays();
                await this.open();
            } catch (error) {
                if (form.isConnected && this.resource === resource) form.querySelector('#operation-error').textContent = error.message;
            } finally { button.disabled = false; }
        };
    }
};
