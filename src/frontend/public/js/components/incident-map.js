/* Leaflet incident editor. Reconcile markers by id; never rebuild them on
 * refresh. Dragging and unsaved edits pause reporter position reconciliation.
 * Leaflet is bundled locally; basemap tiles come from OpenStreetMap.
 */
window.IncidentMap = {
    async loadLeaflet() {
        if (!window.L) throw new Error('Unable to load the map library. Coordinates can still be edited below.');
    },
    createMap(element, position, zoom) {
        const map = L.map(element).setView(position, zoom);
        const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        tiles.on('tileerror', () => {
            const status = element.parentElement?.querySelector('[role="status"]');
            if (status) status.textContent = 'Map tiles unavailable. Check your connection; location pins and coordinate editing remain available.';
        });
        return map;
    },
    setTitle(marker, title) {
        if (marker.getElement()) marker.getElement().title = title || '';
        marker.options.title = title || '';
    },
    advisoryLabel(marker, advisory) {
        marker.pulseTitle = advisory.label;
        const text = (advisory.status === 'not_passable' ? '⛔ ' : advisory.status === 'clear' ? '✓ ' : '! ') + advisory.label;
        if (!marker.getTooltip()) marker.bindTooltip(document.createElement('span'));
        marker.getTooltip().getContent().textContent = text;
        this.setTitle(marker, text);
    },
    async mount(container, report, options = {}) {
        if (!container) return;
        this.dispose();
        const kind = options.kind === 'hazards' ? 'hazards' : 'reports';
        const url = `/api/${kind}/${report.id}`;
        const session = this.session = { container, report, markers: new Map(), dirty: false, dragging: false };
        const admin = Store.get('user')?.role === 'admin';
        container.innerHTML = `<div id="incident-leaflet-map" style="height:300px;border-radius:12px"></div><p id="incident-map-status" role="status"></p>${admin ? `<form id="incident-coordinate-form"><label>Latitude <input class="form-input" id="incident-lat" type="number" step="any" min="-90" max="90" required></label><label>Longitude <input class="form-input" id="incident-lng" type="number" step="any" min="-180" max="180" required></label><label>Reason for GPS correction <input class="form-input" id="incident-gps-note" maxlength="5000" required></label><button class="btn btn--primary" type="submit">Save coordinates</button></form>` : ''}`;
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
                    if (!note) throw new Error('Enter a reason for the GPS correction.');
                    const response = await Store.apiFetch(kind === 'hazards' ? url + '/location' : url, { method: 'PUT', body: JSON.stringify({ latitude, longitude, note }) });
                    if (!container.isConnected || this.session !== session) return;
                    if (!response.success) throw new Error(response.message);
                    session.revision = (session.revision || 0) + 1;
                    session.dirty = false;
                    if (session.marker) session.marker.setLatLng({ lat: latitude, lng: longitude });
                    container.querySelector('#incident-map-status').textContent = 'GPS correction saved and audited.';
                    if (window.DetailModal) DetailModal._loadHistory(report.id, kind);
                } catch (error) { if (container.isConnected && this.session === session) container.querySelector('#incident-map-status').textContent = error.message; }
                finally { button.disabled = false; }
            };
        }
        try {
            await this.loadLeaflet();
            if (!container.isConnected || this.session !== session) return;
            session.map = this.createMap(container.querySelector('#incident-leaflet-map'), position || { lat: 12.8797, lng: 121.7740 }, position ? 16 : 6);
            const ensureMarker = p => {
                if (session.marker) { session.marker.setLatLng(p); return; }
                session.marker = L.marker(p, { draggable: admin, title: kind === 'hazards' ? 'Hazard location' : 'Report location' }).addTo(session.map);
                if (admin) {
                    session.marker.on('dragstart', () => { session.dragging = true; });
                    session.marker.on('dragend', () => {
                        session.dragging = false; session.dirty = true;
                        setInputs({ lat: session.marker.getLatLng().lat, lng: session.marker.getLatLng().lng });
                    });
                }
            };
            if (position) ensureMarker(position);
            const refresh = async () => {
                if (!container.isConnected || this.session !== session) { if (this.session === session) this.dispose(); return; }
                const revision = session.revision || 0;
                try {
                    const [latest, advisories] = await Promise.all([Store.apiFetch(url), Store.apiFetch('/api/operations/advisories')]);
                    if (!container.isConnected || this.session !== session || revision !== (session.revision || 0)) return;
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
                            if (!marker) { marker = L.marker(p).addTo(session.map); session.markers.set(advisory.id, marker); }
                            marker.setLatLng(p); this.advisoryLabel(marker, advisory);
                            if (!marker.pulseClick) {
                                marker.pulseClick = true;
                                marker.on('click', () => {
                                    const content = document.createElement('div'); content.textContent = marker.pulseTitle;
                                    marker.bindPopup(content).openPopup();
                                });
                            }
                        }
                        for (const [id, marker] of session.markers) if (!active.has(id)) { marker.off(); marker.remove(); session.markers.delete(id); }
                    }
                } catch (_) { if (container.isConnected && this.session === session) container.querySelector('#incident-map-status').textContent = 'Map updates interrupted; retrying.'; }
            };
            await refresh();
            if (container.isConnected && this.session === session) session.timer = setInterval(refresh, 5000);
        } catch (error) { if (container.isConnected && this.session === session) container.querySelector('#incident-map-status').textContent = error.message; }
    },
    dispose() {
        const session = this.session;
        if (!session) return;
        clearInterval(session.timer);
        if (session.marker) { session.marker.off(); session.marker.remove(); }
        session.markers.forEach(m => { m.off(); m.remove(); });
        session.map?.remove();
        this.session = null;
    }
};
