/* Admin operations: editable directories, calls, agency assignments, road advisories,
 * and delivery monitoring. All writes are authorized and audited by the API. */
window.OperationsPanel = {
    resource: 'barangays', rows: [],
    schemas: {
        barangays: { name: 'Name', description: 'Profile / description', active: 'Active (1 or 0)' },
        hotlines: { label: 'Agency / label', number: 'Contact number', category: 'Category', sort_order: 'Display order' },
        calls: { caller_name: 'Caller name', contact_number: 'Contact number (may be added later)', location: 'Location (GPS required when supplied)', latitude: 'Latitude (optional for calls without a location)', longitude: 'Longitude (optional for calls without a location)', notes: 'Call notes', status: 'Status: received, dispatched, closed' },
        advisories: { label: 'Advisory (e.g. NOT PASSABLE - BINABAHA NA YUNG LUGAR)', latitude: 'Latitude', longitude: 'Longitude', status: 'Status: not_passable, caution, clear', active: 'Active (1 or 0)' },
        users: { account_status:'Account state', account_reason:'Reason for account action' },
        responders: { department: 'Agency assignment' }
    },
    esc(value) { return DetailModal._esc(value); },
    async open(resource = this.resource) {
        this.resource = resource;
        const version = this.version = (this.version || 0) + 1;
        const container = document.getElementById('dashboard-content');
        if (!container) return;
        container.innerHTML = `<section class="operations-panel"><h2>Dispatch operations</h2><button type="button" class="btn btn--outline" onclick="Router.navigate('admin-audit-log')">View audit log</button>
            <div class="dashboard-subtabs">${['barangays', 'hotlines', 'calls', 'responders', 'advisories', 'broadcasts', 'users'].map(k => `<button type="button" class="btn btn--outline btn--sm" data-operation="${k}">${k === 'hotlines' ? 'Emergency contacts' : k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>
            <p>Times use Asia/Manila. Notes and changes are recorded in the audit log.</p>
            <div id="operations-message" role="status"></div><div id="operations-form"></div><div id="operations-list">Loading…</div></section>`;
        container.querySelectorAll('[data-operation]').forEach(b => b.addEventListener('click', () => this.open(b.dataset.operation)));
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
            document.getElementById('operations-list').innerHTML = `<div style="overflow-x:auto"><table class="operations-table"><thead><tr>${fields.map(k => `<th>${this.esc(k.replace(/_/g, ' '))}</th>`).join('')}<th></th></tr></thead><tbody>${this.rows.map(row => `<tr>${fields.map(k => `<td>${this.esc(k.endsWith('_at') ? PhilippineTime.format(row[k]) : row[k])}</td>`).join('')}<td>${resource === 'broadcasts' ? `<button type="button" class="btn btn--outline btn--sm" data-broadcast="${row.id}">Recipient outcomes</button>` : resource === 'users' && row.role !== 'citizen' ? '' : `<button class="btn btn--outline btn--sm" type="button" data-edit-operation="${row.id}">Edit</button>`}</td></tr>`).join('')}</tbody></table></div>`;
            container.querySelectorAll('[data-edit-operation]').forEach(b => b.addEventListener('click', () => this.form(this.rows.find(r => r.id === Number(b.dataset.editOperation)))));
            container.querySelectorAll('[data-broadcast]').forEach(b=>b.onclick=async()=>{try{const response=await Store.apiFetch('/api/operations/broadcasts/'+b.dataset.broadcast+'/recipients');if(!response.success)throw new Error(response.message);const list=document.createElement('div');for(const row of response.data){const p=document.createElement('p');p.textContent=`User ${row.user_id ?? 'legacy'}: ${row.status}${row.last_error?' — '+row.last_error:''}`;list.appendChild(p);}b.parentElement.appendChild(list);b.disabled=true;}catch(e){b.textContent=e.message;}});
        } catch (error) { const list = container.querySelector('#operations-list'); if (version === this.version && container.isConnected && list) list.textContent = error.message || 'Unable to load operations.'; }
    },
    form(row = {}) {
        const resource = this.resource;
        const schema = this.schemas[resource];
        const defaults = { active: 1, sort_order: 0, status: this.resource === 'calls' ? 'received' : 'caution' };
        document.getElementById('operations-form').innerHTML = `<form id="operation-editor" class="card"><h3>${row.id ? 'Edit record #' + row.id : 'Add ' + this.resource}</h3>
            ${Object.entries(schema).map(([key, label]) => `<label class="input-group"><span class="input-group__label">${label}</span>${key === 'account_status' ? `<select class="form-input" name="account_status" required>${['active','suspended','deactivated'].map(v=>`<option ${row[key]===v?'selected':''}>${v}</option>`).join('')}</select>` : key === 'department' ? `<select class="form-input" name="${key}" required><option value="">Select agency</option>${this.departments.map(d => `<option ${row[key] === d ? 'selected' : ''}>${this.esc(d)}</option>`).join('')}</select>` : `<input class="form-input" name="${key}" value="${this.esc(row[key] ?? defaults[key] ?? '')}" ${['latitude', 'longitude', 'active', 'sort_order'].includes(key) ? 'type="number" step="any"' : ''} ${['name', 'label', 'caller_name', 'number', 'account_reason'].includes(key) ? 'required' : ''}>`}</label>`).join('')}
            <p>Road advisories require an allowed territory boundary. A not-passable advisory queues an urgent broadcast to all registered users.</p>
            <button class="btn btn--primary" type="submit">Save</button> <button class="btn btn--outline" id="operation-cancel" type="button">Cancel</button>
            <p id="operation-error" role="alert"></p></form>`;
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
