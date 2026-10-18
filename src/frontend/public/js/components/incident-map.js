/* Google Maps incident editor. Reconcile markers by id; never rebuild them on
 * refresh. Dragging and unsaved edits pause reporter position reconciliation.
 * Coordinates remain editable when no browser Maps key has been configured.
 */
window.IncidentMap = {
    async loadGoogle() {
        if (window.google?.maps) return;
        if (this.loading) return this.loading;
        this.loading = (async () => {
            const response = await Store.apiFetch('/api/operations/map-config');
            const key = response.data?.googleMapsKey;
            if (!key) throw new Error('Google Maps is not configured. Coordinates can still be edited below.');
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                const timeout = setTimeout(() => fail(new Error('Google Maps did not finish loading. Coordinates can still be edited.')), 15000);
                const finish = () => { clearTimeout(timeout); resolve(); };
                const fail = error => { clearTimeout(timeout); script.remove(); reject(error); };
                window.pulseMapsReady = finish;
                window.gm_authFailure = () => fail(new Error('Google Maps authorization failed. Check the browser key and allowed origins.'));
                script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&callback=pulseMapsReady&loading=async';
                script.onerror = () => fail(new Error('Unable to load Google Maps.'));
                document.head.appendChild(script);
            });
        })().catch(error => { this.loading = null; throw error; });
        return this.loading;
    },
    async mount(container, report) {
        if (!container) return;
        this.dispose();
        const session = this.session = { container, report, markers: new Map(), dirty: false, dragging: false };
        const admin = Store.get('user')?.role === 'admin';
        container.innerHTML = `<div id="incident-google-map" style="height:300px;border-radius:12px"></div><p id="incident-map-status" role="status"></p>${admin ? `<form id="incident-coordinate-form"><label>Latitude <input class="form-input" id="incident-lat" type="number" step="any" min="-90" max="90" required></label><label>Longitude <input class="form-input" id="incident-lng" type="number" step="any" min="-180" max="180" required></label><label>Reason for GPS correction <input class="form-input" id="incident-gps-note" maxlength="5000" required></label><button class="btn btn--primary" type="submit">Save coordinates</button></form>` : ''}`;
        const setInputs = p => { if (admin) { container.querySelector('#incident-lat').value = p.lat; container.querySelector('#incident-lng').value = p.lng; } };
        const position = report.latitude != null && report.longitude != null ? { lat: Number(report.latitude), lng: Number(report.longitude) } : null;
        if (position) setInputs(position);
        if (admin) {
            const form = container.querySelector('form');
            form.oninput = () => { session.dirty = true; };
            form.onsubmit = async event => {
                event.preventDefault();
                const button = form.querySelector('button'); button.disabled = true;
                try {
                    const latitude = Number(container.querySelector('#incident-lat').value);
                    const longitude = Number(container.querySelector('#incident-lng').value);
                    const note = container.querySelector('#incident-gps-note').value.trim();
                    const response = await Store.apiFetch(`/api/reports/${report.id}`, { method: 'PUT', body: JSON.stringify({ latitude, longitude, note }) });
                    if (!container.isConnected || this.session !== session) return;
                    if (!response.success) throw new Error(response.message);
                    session.dirty = false;
                    if (session.marker) session.marker.setPosition({ lat: latitude, lng: longitude });
                    container.querySelector('#incident-map-status').textContent = 'GPS correction saved and audited.';
                    if (window.DetailModal) DetailModal._loadHistory(report.id);
                } catch (error) { if (container.isConnected && this.session === session) container.querySelector('#incident-map-status').textContent = error.message; }
                finally { button.disabled = false; }
            };
        }
        try {
            await this.loadGoogle();
            if (!container.isConnected || this.session !== session) return;
            session.map = new google.maps.Map(container.querySelector('#incident-google-map'), { center: position || { lat: 14.5, lng: 121.2 }, zoom: position ? 16 : 10 });
            const ensureMarker = p => {
                if (session.marker) { session.marker.setPosition(p); return; }
                session.marker = new google.maps.Marker({ map: session.map, position: p, draggable: admin, title: 'Report location' });
                if (admin) {
                    session.marker.addListener('dragstart', () => { session.dragging = true; });
                    session.marker.addListener('dragend', event => {
                        session.dragging = false; session.dirty = true;
                        setInputs({ lat: event.latLng.lat(), lng: event.latLng.lng() });
                    });
                }
            };
            if (position) ensureMarker(position);
            const refresh = async () => {
                if (!container.isConnected || this.session !== session) { if (this.session === session) this.dispose(); return; }
                try {
                    const [latest, advisories] = await Promise.all([Store.apiFetch(`/api/reports/${report.id}`), Store.apiFetch('/api/operations/advisories')]);
                    if (!container.isConnected || this.session !== session) return;
                    if (!session.dirty && !session.dragging && latest.success && latest.data.latitude != null && latest.data.longitude != null) {
                        const p = { lat: Number(latest.data.latitude), lng: Number(latest.data.longitude) };
                        ensureMarker(p);
                        setInputs(p);
                    }
                    if (advisories.success) {
                        const active = new Set();
                        for (const advisory of advisories.data.filter(a => a.active)) {
                            active.add(advisory.id);
                            let marker = session.markers.get(advisory.id);
                            const p = { lat: Number(advisory.latitude), lng: Number(advisory.longitude) };
                            if (!marker) { marker = new google.maps.Marker({ map: session.map, position: p }); session.markers.set(advisory.id, marker); }
                            marker.setPosition(p); marker.setTitle(advisory.label);
                            marker.setLabel({ text: advisory.status === 'not_passable' ? '⛔' : advisory.status === 'clear' ? '✓' : '!', color: advisory.status === 'not_passable' ? '#dc2626' : '#166534' });
                            if (!marker.pulseClick) marker.pulseClick = marker.addListener('click', () => {
                                const content = document.createElement('div'); content.textContent = marker.getTitle();
                                if (!session.info) session.info = new google.maps.InfoWindow();
                                session.info.setContent(content); session.info.open(session.map, marker);
                            });
                        }
                        for (const [id, marker] of session.markers) if (!active.has(id)) { marker.setMap(null); google.maps.event.clearInstanceListeners(marker); session.markers.delete(id); }
                    }
                } catch (_) { container.querySelector('#incident-map-status').textContent = 'Map updates interrupted; retrying.'; }
            };
            await refresh();
            if (container.isConnected && this.session === session) session.timer = setInterval(refresh, 5000);
        } catch (error) { if (container.isConnected && this.session === session) container.querySelector('#incident-map-status').textContent = error.message; }
    },
    dispose() {
        const session = this.session;
        if (!session) return;
        clearInterval(session.timer);
        if (session.marker) { google.maps.event.clearInstanceListeners(session.marker); session.marker.setMap(null); }
        session.markers.forEach(m => { google.maps.event.clearInstanceListeners(m); m.setMap(null); });
        if (session.info) session.info.close();
        this.session = null;
    }
};
