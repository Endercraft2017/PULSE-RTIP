/** Live hazard map: one stable marker per hazard, admin drag corrections,
 * explicit save/cancel, advisory overlays and five-second reconciliation.
 * Uses bundled Leaflet with OpenStreetMap tiles; citizens are read-only.
 */
window.HazardMap = {
    async mount(container, hazards) {
        this.dispose();
        const admin = Store.get('role') === 'admin';
        const session = this.session = { container, markers: new Map(), advisories: new Map(), admin, pending: null };
        container.innerHTML = `<p class="map-boundary-warning" role="status" hidden></p><div class="hazard-live-map" style="height:420px;border-radius:12px" aria-label="Live hazard map"></div>
            <p class="hazard-map-status" role="status">Loading map…</p>
            <div class="hazard-map-editor"></div><div class="hazard-map-unplaced"></div>`;
        const current = () => this.session === session && container.isConnected;
        session.status = container.querySelector('.hazard-map-status');
        try {
            const territory=await IncidentMap.loadLeaflet();
            if (!current()) return;
            session.territory=territory;
            IncidentMap.boundaryNotice(container,territory);
            const located = hazards.find(h => IncidentMap.canDisplay({lat:h.latitude,lng:h.longitude},territory));
            session.map = IncidentMap.createMap(container.querySelector('.hazard-live-map'),
                located ? { lat: Number(located.latitude), lng: Number(located.longitude) } : null,
                13,territory);
            this.reconcile(session, hazards);
            session.status.textContent = admin && !territory
                ? 'Drag a pin to preview a GPS correction. Saving requires boundary validation. Updates refresh every 5 seconds.'
                : admin ? 'Drag a hazard pin to reposition it, then save the correction. Updates refresh every 5 seconds.'
                : 'Live hazard locations and road advisories. Updates refresh every 5 seconds.';
            const refresh = async () => {
                if (!current()) { if (this.session === session) this.dispose(); return; }
                if (session.refreshing) return;
                session.refreshing = true;
                const revision = session.revision || 0;
                try {
                    const [response, advisories] = await Promise.all([Store.apiFetch('/api/hazards'), Store.apiFetch('/api/operations/advisories')]);
                    if (!current() || revision !== (session.revision || 0)) return;
                    if (!response.success) throw new Error(response.message);
                    this.reconcile(session, response.data);
                    if (advisories.success) this.reconcileAdvisories(session, advisories.data);
                    HazardCache._save(response.data);
                    HazardsPage._hazards = response.data;
                } catch (error) { if (current()) session.status.textContent = 'Live updates interrupted; retrying. ' + (error.message || ''); }
                finally { session.refreshing = false; }
            };
            await refresh();
            if (current()) session.timer = setInterval(refresh, 5000);
        } catch (error) {
            if (!current()) return;
            session.status.textContent = error.message + ' Open Details to enter coordinates manually.';
            container.querySelector('.hazard-live-map').hidden = true;
            this.renderUnplaced(session, hazards);
        }
    },
    reconcile(session, hazards) {
        const ids = new Set();
        for (const hazard of hazards) {
            if (hazard.latitude == null || hazard.longitude == null || !IncidentMap.canDisplay({lat:hazard.latitude,lng:hazard.longitude},session.territory)) continue;
            ids.add(hazard.id);
            let entry = session.markers.get(hazard.id);
            if (!entry) {
                const marker = L.marker({ lat: Number(hazard.latitude), lng: Number(hazard.longitude) }, { draggable: session.admin, title: hazard.title }).addTo(session.map);
                entry = { marker, hazard, dragging: false };
                session.markers.set(hazard.id, entry);
                marker.on('click', () => DetailModal.showHazard(entry.hazard));
                if (session.admin) {
                    marker.on('dragstart', () => {
                        if (session.pending && session.pending !== entry) this.cancel(session);
                        entry.dragging = true;
                    });
                    marker.on('dragend', () => {
                        entry.dragging = false;
                        if (this.session !== session || !session.container.isConnected) return;
                        session.pending = entry;
                        this.edit(session, entry, { lat: marker.getLatLng().lat, lng: marker.getLatLng().lng });
                    });
                }
            }
            entry.hazard = hazard;
            if (!entry.dragging && session.pending !== entry) entry.marker.setLatLng({ lat: Number(hazard.latitude), lng: Number(hazard.longitude) });
            IncidentMap.setTitle(entry.marker, hazard.title);
        }
        for (const [id, entry] of session.markers) if (!ids.has(id)) {
            if (session.pending === entry) this.cancel(session);
            entry.marker.off(); entry.marker.remove(); session.markers.delete(id);
        }
        this.renderUnplaced(session, hazards.filter(h => h.latitude == null || h.longitude == null));
    },
    renderUnplaced(session, hazards) {
        const root = session.container.querySelector('.hazard-map-unplaced');
        root.replaceChildren();
        for (const hazard of hazards) {
            const button = document.createElement('button');
            button.className = 'btn btn--outline btn--sm'; button.type = 'button';
            button.textContent = hazard.title + ' — Details';
            button.onclick = () => DetailModal.showHazard(hazard);
            root.appendChild(button);
        }
    },
    reconcileAdvisories(session, advisories) {
        const active = new Set();
        for (const advisory of advisories.filter(a => a.active && IncidentMap.canDisplay({lat:a.latitude,lng:a.longitude},session.territory))) {
            active.add(advisory.id);
            let marker = session.advisories.get(advisory.id);
            if (!marker) {
                marker = L.marker({ lat: Number(advisory.latitude), lng: Number(advisory.longitude) }).addTo(session.map);
                marker.on('click', () => {
                    const label = document.createElement('div'); label.textContent = marker.pulseTitle;
                    marker.bindPopup(label).openPopup();
                });
                session.advisories.set(advisory.id, marker);
            }
            marker.setLatLng({ lat: Number(advisory.latitude), lng: Number(advisory.longitude) });
            IncidentMap.advisoryLabel(marker, advisory);
        }
        for (const [id, marker] of session.advisories) if (!active.has(id)) {
            marker.off(); marker.remove(); session.advisories.delete(id);
        }
    },
    edit(session, entry, position) {
        const root = session.container.querySelector('.hazard-map-editor');
        root.innerHTML = `<form class="hazard-pin-form card"><h3>Reposition hazard</h3><p class="hazard-pin-title"></p>
            <label>Latitude<input class="form-input" name="latitude" type="number" min="-90" max="90" step="any" required></label>
            <label>Longitude<input class="form-input" name="longitude" type="number" min="-180" max="180" step="any" required></label>
            <label>Correction reason<textarea class="form-input" name="note" maxlength="5000" required></textarea></label>
            <button class="btn btn--primary" type="submit">Save pin location</button>
            <button class="btn btn--outline hazard-pin-cancel" type="button">Cancel repositioning</button><p class="hazard-pin-error" role="alert"></p></form>`;
        root.querySelector('.hazard-pin-title').textContent = entry.hazard.title;
        const form = root.querySelector('form');
        form.elements.latitude.value = position.lat; form.elements.longitude.value = position.lng;
        root.querySelector('.hazard-pin-cancel').onclick = () => this.cancel(session);
        form.onsubmit = async event => {
            event.preventDefault();
            const button = form.querySelector('[type=submit]'); button.disabled = true;
            try {
                if(!session.territory) throw new Error('Saving GPS corrections is blocked until Morong boundary validation is available. Reopen the map after configuration is restored.');
                const note = form.elements.note.value.trim();
                if (!note) throw new Error('Enter a correction reason.');
                const response = await Store.apiFetch(`/api/hazards/${entry.hazard.id}/location`, { method: 'PUT', body: JSON.stringify({ latitude: Number(form.elements.latitude.value), longitude: Number(form.elements.longitude.value), note }) });
                if (this.session !== session || !form.isConnected) return;
                if (!response.success) throw new Error(response.message || 'Unable to save pin.');
                session.revision = (session.revision || 0) + 1;
                entry.hazard = response.data;
                entry.marker.setLatLng({ lat: Number(response.data.latitude), lng: Number(response.data.longitude) });
                session.pending = null; root.replaceChildren();
                session.status.textContent = 'Hazard pin location saved and audited.';
            } catch (error) { if (form.isConnected) form.querySelector('.hazard-pin-error').textContent = error.message; }
            finally { button.disabled = false; }
        };
        form.elements.note.focus();
    },
    cancel(session) {
        const entry = session.pending;
        if (entry) entry.marker.setLatLng({ lat: Number(entry.hazard.latitude), lng: Number(entry.hazard.longitude) });
        session.pending = null;
        session.container.querySelector('.hazard-map-editor')?.replaceChildren();
    },
    dispose() {
        const session = this.session;
        if (!session) return;
        clearInterval(session.timer);
        for (const entry of session.markers.values()) { entry.marker.off(); entry.marker.remove(); }
        for (const marker of session.advisories.values()) { marker.off(); marker.remove(); }
        session.map?.remove(); this.session = null;
    },
};
