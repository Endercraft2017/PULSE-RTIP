/* ============================================================
   Report Incident Page (Citizen Only)
   ============================================================
   Table of Contents:
   1. State
   2. Render method (3-step form)
   3. Step navigation
   4. Category selection
   5. Image upload handling
   6. Video upload handling
   7. GPS location
   8. Form submission (placeholder)
   9. Helper methods
   ============================================================ */

const ReportIncidentPage = {
    currentStep: 1,
    selectedType: '',
    images: [],
    video: null,
    coords: null,

    reset() {
        this.currentStep = 1;
        this.selectedType = '';
        this.images = [];
        this.video = null;
        this.coords = null;
    },

    /* --------------------------------------------------------
     * 2. Render
     * -------------------------------------------------------- */
    render() {
        this.reset();
        return `
            <div class="step-indicator">
                <div class="step-dot active" id="step-1"></div>
                <div class="step-dot" id="step-2"></div>
                <div class="step-dot" id="step-3"></div>
            </div>
            <div class="page-padding">
                ${this.renderStep1()}
                ${this.renderStep2()}
                ${this.renderStep3()}
                ${this.renderSuccess()}
            </div>
        `;
    },

    renderStep1() {
        return `
        <div id="form-step-1" class="form-step">
            <div class="report-form">
                <div class="form-group">
                    <div class="form-group__label">
                        <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        Incident Type <span class="form-group__required">*</span>
                    </div>
                    <div class="category-chips">
                        <div class="category-chip" onclick="ReportIncidentPage.selectType('Flood', this)">
                            <svg viewBox="0 0 24 24"><path d="M2 15c6.667-6 13.333 0 20-6"></path><path d="M2 19c6.667-6 13.333 0 20-6"></path></svg>
                            Flood
                        </div>
                        <div class="category-chip" onclick="ReportIncidentPage.selectType('Fire', this)">
                            <svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                            Fire
                        </div>
                        <div class="category-chip" onclick="ReportIncidentPage.selectType('Typhoon', this)">
                            <svg viewBox="0 0 24 24"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2.5 2.5 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"></path></svg>
                            Typhoon
                        </div>
                        <div class="category-chip" onclick="ReportIncidentPage.selectType('Infrastructure Damage', this)">
                            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                            Infrastructure
                        </div>
                        <div class="category-chip" onclick="ReportIncidentPage.selectType('Earthquake', this)">
                            <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                            Earthquake
                        </div>
                        <div class="category-chip" onclick="ReportIncidentPage.selectType('Landslide', this)">
                            <svg viewBox="0 0 24 24"><path d="M12 20v-6M6 20V10M18 20V4"></path></svg>
                            Landslide
                        </div>
                        <div class="category-chip" onclick="ReportIncidentPage.selectType('Others', this)">
                            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                            Others
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <div class="form-group__label">Title <span class="form-group__required">*</span></div>
                    <input class="form-input" type="text" id="report-title" placeholder="Brief title of the incident">
                </div>
                <div class="form-group">
                    <div class="form-group__label">Description</div>
                    <textarea class="form-input" id="report-description" placeholder="Describe the incident in detail. Include what happened, how severe it is, and any immediate dangers."></textarea>
                    <div class="form-group__hint">Be as detailed as possible to help responders</div>
                </div>
                <button class="btn btn--primary btn--block" onclick="ReportIncidentPage.goToStep(2)">
                    Next: Location & Media
                    <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
            </div>
        </div>`;
    },

    renderStep2() {
        return `
        <div id="form-step-2" class="form-step" style="display:none;">
            <div class="report-form">
                <div class="form-group">
                    <div class="form-group__label">
                        <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        Location
                    </div>
                    <div class="location-input-wrapper">
                        <input class="form-input" type="text" id="report-location" placeholder="Enter address or use GPS">
                        <button class="location-gps-btn" onclick="ReportIncidentPage.captureGPS()" title="Use current location">
                            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v4m0 12v4M2 12h4m12 0h4"></path></svg>
                        </button>
                    </div>
                    <div class="location-coords" id="gps-coords" style="display:none;">
                        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        <span id="gps-text"></span>
                    </div>
                </div>
                <div class="form-divider"></div>
                <div class="form-group">
                    <div class="form-group__label">
                        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        Upload Images
                    </div>
                    <div class="form-group__hint">Max 5 images. JPEG, PNG, or GIF. Max 5MB each.</div>
                    <div class="upload-zone" onclick="document.getElementById('ri-img-input').click()">
                        <div class="upload-zone__icon">
                            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        </div>
                        <div class="upload-zone__text">Tap to <strong>choose images</strong></div>
                        <div class="upload-zone__hint">or drag and drop</div>
                    </div>
                    <input type="file" id="ri-img-input" accept="image/jpeg,image/png,image/gif" multiple style="display:none" onchange="ReportIncidentPage.handleImageSelect(this)">
                    <div class="upload-previews" id="ri-image-previews"></div>
                    <div class="form-group__hint" id="ri-image-count" style="margin-top:4px;">0 of 5 images added</div>
                </div>
                <div class="form-divider"></div>
                <div class="form-group">
                    <div class="form-group__label">
                        <svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                        Upload Video
                    </div>
                    <div class="form-group__hint">Max 1 video. MP4 format. Max 30MB.</div>
                    <div class="upload-zone" onclick="document.getElementById('ri-video-input').click()" id="ri-video-zone">
                        <div class="upload-zone__icon">
                            <svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                        </div>
                        <div class="upload-zone__text">Tap to <strong>choose video</strong></div>
                        <div class="upload-zone__hint">MP4 only, max 30MB</div>
                    </div>
                    <input type="file" id="ri-video-input" accept="video/mp4" style="display:none" onchange="ReportIncidentPage.handleVideoSelect(this)">
                    <div id="ri-video-preview"></div>
                </div>
                <div style="display:flex;gap:var(--spacing-sm);">
                    <button class="btn btn--outline" style="flex:1;" onclick="ReportIncidentPage.goToStep(1)">
                        <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        Back
                    </button>
                    <button class="btn btn--primary" style="flex:2;" onclick="ReportIncidentPage.goToStep(3)">
                        Next: Review
                        <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>
            </div>
        </div>`;
    },

    renderStep3() {
        return `
        <div id="form-step-3" class="form-step" style="display:none;">
            <div class="report-form">
                <div class="section-header">
                    <div class="section-header__title">Review Your Report</div>
                </div>
                <div class="card" id="ri-review-card">
                    <div class="loading-state">Loading review...</div>
                </div>
                <div class="form-divider"></div>
                <div class="terms-check">
                    <input type="checkbox" id="ri-terms" checked>
                    <div class="terms-check__text">
                        I confirm this report is accurate and understand that filing false reports may result in penalties. I agree to the <a href="#" onclick="event.preventDefault(); TermsModal.show('terms')">Terms & Conditions</a> and <a href="#" onclick="event.preventDefault(); TermsModal.show('privacy')">Privacy Policy</a>.
                    </div>
                </div>
                <div style="display:flex;gap:var(--spacing-sm);">
                    <button class="btn btn--outline" style="flex:1;" onclick="ReportIncidentPage.goToStep(2)">
                        <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        Back
                    </button>
                    <button class="btn btn--primary" style="flex:2;" id="ri-submit-btn" onclick="ReportIncidentPage.submit()">
                        <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;"><path d="M22 2L11 13"></path><path d="M22 2l-7 20-4-9-9-4 20-7z"></path></svg>
                        Submit Report
                    </button>
                </div>
            </div>
        </div>`;
    },

    renderSuccess() {
        return `
        <div id="form-step-success" class="form-step" style="display:none;">
            <div class="report-success">
                <div class="report-success__icon">
                    <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div style="font-size:1.25rem;font-weight:700;margin-bottom:var(--spacing-sm);">Report Submitted!</div>
                <div style="font-size:0.875rem;color:var(--color-gray-500);margin-bottom:var(--spacing-2xl);max-width:280px;line-height:1.5;">
                    Your incident report has been sent to the MDRRMO team. You will receive notifications on status updates.
                </div>
                <button class="btn btn--primary btn--block" onclick="Router.navigate('citizen-home')" style="max-width:280px;">
                    Back to Home
                </button>
                <button class="btn btn--outline mt-md" onclick="ReportIncidentPage.restart()" style="max-width:280px;width:100%;">
                    Submit Another Report
                </button>
            </div>
        </div>`;
    },

    /* --------------------------------------------------------
     * 3. Step Navigation
     * -------------------------------------------------------- */
    goToStep(step) {
        if (step === 2) {
            if (!this.selectedType) { alert('Please select an incident type.'); return; }
            const title = document.getElementById('report-title').value.trim();
            if (!title) { alert('Please enter a title.'); return; }
        }
        if (step === 3) {
            this.buildReview();
        }

        document.querySelectorAll('.form-step').forEach(s => s.style.display = 'none');
        const target = step === 'success' ? 'form-step-success' : 'form-step-' + step;
        document.getElementById(target).style.display = '';
        this.currentStep = step;

        document.querySelectorAll('.step-dot').forEach((d, i) => {
            d.classList.remove('active', 'completed');
            if (step === 'success') { d.classList.add('completed'); return; }
            if (i + 1 < step) d.classList.add('completed');
            if (i + 1 === step) d.classList.add('active');
        });

        window.scrollTo(0, 0);
    },

    restart() {
        this.reset();
        Router.navigate('report-incident');
    },

    /* --------------------------------------------------------
     * 4. Category Selection
     * -------------------------------------------------------- */
    selectType(type, el) {
        document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
        this.selectedType = type;
    },

    /* --------------------------------------------------------
     * 5. Image Upload
     * -------------------------------------------------------- */
    handleImageSelect(input) {
        const remaining = 5 - this.images.length;
        if (remaining <= 0) { alert('Maximum 5 images allowed.'); input.value = ''; return; }

        const files = Array.from(input.files).slice(0, remaining);
        files.forEach(file => {
            if (file.size > 5 * 1024 * 1024) { alert(file.name + ' exceeds 5MB limit.'); return; }
            this.images.push(file);
            const reader = new FileReader();
            reader.onload = (e) => {
                const container = document.getElementById('ri-image-previews');
                const idx = this.images.length - 1;
                const div = document.createElement('div');
                div.className = 'upload-preview';
                div.id = 'img-preview-' + idx;
                div.innerHTML = '<img src="' + e.target.result + '"><button class="upload-preview__remove" onclick="ReportIncidentPage.removeImage(' + idx + ')">x</button><div class="upload-preview__label">' + (file.size / 1024 / 1024).toFixed(1) + ' MB</div>';
                container.appendChild(div);
                this.updateImageCount();
            };
            reader.readAsDataURL(file);
        });
        input.value = '';
    },

    removeImage(idx) {
        this.images[idx] = null;
        const el = document.getElementById('img-preview-' + idx);
        if (el) el.remove();
        this.updateImageCount();
    },

    updateImageCount() {
        const count = this.images.filter(Boolean).length;
        const el = document.getElementById('ri-image-count');
        if (el) el.textContent = count + ' of 5 images added';
    },

    /* --------------------------------------------------------
     * 6. Video Upload
     * -------------------------------------------------------- */
    handleVideoSelect(input) {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 30 * 1024 * 1024) { alert('Video exceeds 30MB limit.'); input.value = ''; return; }

        this.video = file;
        document.getElementById('ri-video-zone').style.display = 'none';
        document.getElementById('ri-video-preview').innerHTML = `
            <div class="video-preview">
                <div class="video-preview__icon"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div>
                <div class="video-preview__info">
                    <div class="video-preview__name">${file.name}</div>
                    <div class="video-preview__size">${(file.size / 1024 / 1024).toFixed(1)} MB</div>
                </div>
                <button class="video-preview__remove" onclick="ReportIncidentPage.removeVideo()">
                    <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>`;
        input.value = '';
    },

    removeVideo() {
        this.video = null;
        document.getElementById('ri-video-preview').innerHTML = '';
        document.getElementById('ri-video-zone').style.display = '';
    },

    /* --------------------------------------------------------
     * 7. GPS Location
     * -------------------------------------------------------- */
    captureGPS() {
        if (!navigator.geolocation) { alert('GPS not supported on this device.'); return; }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                this.coords = { lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4) };
                document.getElementById('gps-coords').style.display = 'flex';
                document.getElementById('gps-text').textContent = this.coords.lat + ', ' + this.coords.lng;
                if (!document.getElementById('report-location').value) {
                    document.getElementById('report-location').value = 'Morong, Rizal';
                }
            },
            () => { alert('Unable to get GPS location. Please enter manually.'); }
        );
    },

    /* --------------------------------------------------------
     * 8. Build Review & Submit
     * -------------------------------------------------------- */
    buildReview() {
        const title = document.getElementById('report-title').value.trim();
        const desc = document.getElementById('report-description').value.trim();
        const location = document.getElementById('report-location').value.trim();
        const imgCount = this.images.filter(Boolean).length;

        let attachments = '';
        if (imgCount > 0 || this.video) {
            attachments = '<div style="font-size:0.75rem;font-weight:600;color:var(--color-gray-500);margin-top:var(--spacing-md);margin-bottom:6px;">Attachments</div>';
            attachments += '<div style="font-size:0.8rem;color:var(--color-gray-600);">';
            if (imgCount > 0) attachments += imgCount + ' image' + (imgCount > 1 ? 's' : '');
            if (imgCount > 0 && this.video) attachments += ', ';
            if (this.video) attachments += '1 video (' + (this.video.size / 1024 / 1024).toFixed(1) + ' MB)';
            attachments += '</div>';
        }

        document.getElementById('ri-review-card').innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--spacing-md);">
                <div style="font-size:1rem;font-weight:700;">${title}</div>
                <span class="badge badge--type">${this.selectedType}</span>
            </div>
            ${desc ? '<div style="font-size:0.8rem;color:var(--color-gray-600);line-height:1.6;margin-bottom:var(--spacing-md);">' + desc + '</div>' : ''}
            ${location ? '<div style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--color-gray-500);margin-bottom:6px;"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>' + location + '</div>' : ''}
            ${this.coords ? '<div style="display:flex;align-items:center;gap:6px;font-size:0.7rem;color:var(--color-gray-400);"><svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:none;stroke:var(--color-success);stroke-width:2;"><polyline points="20 6 9 17 4 12"></polyline></svg>GPS: ' + this.coords.lat + ', ' + this.coords.lng + '</div>' : ''}
            ${attachments}
        `;
    },

    async submit() {
        const terms = document.getElementById('ri-terms');
        if (!terms.checked) { alert('Please agree to the Terms & Conditions.'); return; }

        const btn = document.getElementById('ri-submit-btn');
        btn.disabled = true;
        btn.innerHTML = 'Submitting...';

        const title = document.getElementById('report-title').value.trim();
        const description = document.getElementById('report-description').value.trim();
        const location = document.getElementById('report-location').value.trim();

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('type', this.selectedType);
            if (description) formData.append('description', description);
            if (location) formData.append('location', location);
            if (this.coords) {
                formData.append('latitude', this.coords.lat);
                formData.append('longitude', this.coords.lng);
            }
            this.images.filter(Boolean).forEach(img => formData.append('images', img));

            const res = await Store.apiFetch('/api/reports', {
                method: 'POST',
                body: formData,
            });

            if (res.success) {
                this.goToStep('success');
            } else {
                alert(res.message || 'Failed to submit report.');
                btn.disabled = false;
                btn.innerHTML = 'Submit Report';
            }
        } catch (err) {
            alert('Network error. Please try again.');
            btn.disabled = false;
            btn.innerHTML = 'Submit Report';
        }
    }
};
