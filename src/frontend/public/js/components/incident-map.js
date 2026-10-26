/* Leaflet incident editor. Reconcile markers by id; never rebuild them on
 * refresh. Dragging and unsaved edits pause reporter position reconciliation.
 * Leaflet is bundled locally; basemap tiles come from OpenStreetMap.
 */
window.IncidentMap = {
    async loadLeaflet() {
        if (!window.L) throw new Error('Unable to load the map library. Coordinates can still be edited below.');
        // Failure to configure the write boundary must not remove the basemap.
        // Never retain a previous session's boundary when this request fails.
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),3000);
        let territory=null;
        try {
            const response=await Store.apiFetch('/api/operations/map-config',{signal:controller.signal});
            if(response.success && response.data?.configured) territory=response.data.territory || null;
        } catch (_) { /* Viewing existing locations remains available offline. */ }
        finally {clearTimeout(timeout);}
        this.territory=territory;
        return territory;
    },
    boundaryNotice(container,territory) {
        const notice=container.querySelector('.map-boundary-warning');
        const operational=territory?.properties?.approval_kind==='published-operational';
        notice.hidden=!!territory && !operational;
        notice.textContent=operational?'Morong boundary: published NAMRIA/PSA data via OCHA/HDX. Operational use; not LGU-certified.':territory?'':'The map boundary could not be loaded. Existing pins are shown for reference. Every saved correction is checked against Morong by the server; unavailable validation will prevent saving.';
    },
    canDisplay(position) {
        if(!position || [position.lat,position.lng].some(v=>v==null||String(v).trim()===''||!Number.isFinite(Number(v)))) return false;
        return Math.abs(Number(position.lat))<=90 && Math.abs(Number(position.lng))<=180;
    },
    focusMorong(map) {
        if(map.pulseMorongBounds?.isValid()) map.fitBounds(map.pulseMorongBounds,{padding:[20,20],maxZoom:14,animate:false});
        else map.setView([14.515,121.239],13,{animate:false});
    },
    setTerritoryBounds(map,territory) {
        if(!territory || map.pulseBoundaryHash===territory.sha256) return;
        const allowed=territory.features.filter(f=>f.properties.mode==='allow');
        // Use the territory only for the initial viewport, without drawing it.
        map.pulseMorongBounds=L.geoJSON({type:'FeatureCollection',features:allowed}).getBounds();
        map.pulseBoundaryHash=territory.sha256;
    },
    async recoverBoundary(session) {
        if(session.territory)return;
        const territory=await this.loadLeaflet();
        if(!territory || !session.container.isConnected || !session.map?._loaded)return;
        session.territory=territory;
        this.setTerritoryBounds(session.map,territory);
        this.boundaryNotice(session.container,territory);
    },
    createMap(element,position,zoom,territory=this.territory) {
        const center=this.canDisplay(position)?position:{lat:14.515,lng:121.239};
        const map=L.map(element).setView(center,this.canDisplay(position)?zoom:13);
        if(territory)this.setTerritoryBounds(map,territory);
        const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        tiles.on('tileerror', () => {
            const status = element.parentElement?.querySelector('.hazard-map-status, #incident-map-status');
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
        container.innerHTML = `<p class="map-boundary-warning" role="status" hidden></p><div id="incident-leaflet-map" style="height:300px;border-radius:12px"></div><p id="incident-map-status" role="status"></p>${admin ? `<form id="incident-coordinate-form"><label>Latitude <input class="form-input" id="incident-lat" type="number" step="any" min="-90" max="90" required></label><label>Longitude <input class="form-input" id="incident-lng" type="number" step="any" min="-180" max="180" required></label><label>Reason for GPS correction <input class="form-input" id="incident-gps-note" maxlength="5000" required></label><button class="btn btn--primary" type="submit">Save coordinates</button></form>` : ''}`;
        const setInputs = p => { if (admin) { container.querySelector('#incident-lat').value = p.lat; container.querySelector('#incident-lng').value = p.lng; } };
        const position = report.latitude != null && report.longitude != null ? { lat: Number(report.latitude), lng: Number(report.longitude) } : null;
        if (position) setInputs(position);
        if (admin) {
            const form = container.querySelector('form');
            form.oninput = event => {
                session.dirty = true;
                container.querySelector('#incident-map-status').textContent = 'Unsaved GPS correction. Enter a reason and save to apply it.';
                if (!['incident-lat','incident-lng'].includes(event.target.id)) return;
                const lat = form.querySelector('#incident-lat'), lng = form.querySelector('#incident-lng');
                if (!lat.value || !lng.value || !lat.validity.valid || !lng.validity.valid) return;
                const preview = { lat: Number(lat.value), lng: Number(lng.value) };
                if (this.canDisplay(preview,session.territory)) {
                    session.ensureMarker?.(preview);
                    if (session.map && !session.map.getBounds().contains(preview)) session.map.panTo(preview);
                }
            };
            form.onsubmit = async event => {
                event.preventDefault();
                const controls = [...form.querySelectorAll('input, button')];
                controls.forEach(control => { control.disabled = true; });
                session.marker?.dragging?.disable();
                container.querySelector('#incident-map-status').textContent = 'Saving GPS correction…';
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
                    const saved={lat:Number(response.data.latitude),lng:Number(response.data.longitude)};
                    setInputs(saved);
                    session.ensureMarker?.(saved);
                    if(session.map && !session.map.getBounds().contains(saved))session.map.panTo(saved);
                    container.querySelector('#incident-map-status').textContent = 'GPS correction saved and audited.';
                    if (window.DetailModal) DetailModal._loadHistory(report.id, kind);
                    this.recoverBoundary(session).catch(()=>{});
                } catch (error) { if (container.isConnected && this.session === session) container.querySelector('#incident-map-status').textContent = error.message; }
                finally {
                    controls.forEach(control => { control.disabled = false; });
                    if (this.session === session) session.marker?.dragging?.enable();
                }
            };
        }
        try {
            const territory=await this.loadLeaflet();
            if (!container.isConnected || this.session !== session) return;
            session.territory=territory;
            this.boundaryNotice(container,territory);
            session.map = this.createMap(container.querySelector('#incident-leaflet-map'), position, position ? 16 : 13,territory);
            const ensureMarker = p => {
                if(!this.canDisplay(p,session.territory)) return;
                if (session.marker) { session.marker.setLatLng(p); return; }
                session.marker = L.marker(p, { draggable: admin, title: kind === 'hazards' ? 'Hazard location' : 'Report location' }).addTo(session.map);
                if (admin) {
                    session.marker.on('dragstart', () => { session.dragging = true; });
                    session.marker.on('dragend', () => {
                        session.dragging = false; session.dirty = true;
                        setInputs({ lat: session.marker.getLatLng().lat, lng: session.marker.getLatLng().lng });
                        container.querySelector('#incident-map-status').textContent = 'Unsaved GPS correction. Enter a reason and save to apply it.';
                    });
                }
            };
            session.ensureMarker=ensureMarker;
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
                        for (const advisory of advisories.data.filter(a => a.active && this.canDisplay({lat:a.latitude,lng:a.longitude},session.territory))) {
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
