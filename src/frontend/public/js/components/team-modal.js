/* ============================================================
   Team Modal — About Us roster
   ============================================================
   Fetches /public/assets/team.json and renders a centered modal
   with the project title, school/program info, member cards,
   acknowledgements, and tagline. Uses the shared .modal-overlay
   pattern from detail-modal.js for visual consistency.
   ============================================================ */

const TeamModal = {

    async show() {
        // Load roster lazily so the JSON isn't fetched on every page load.
        let data = this._cache;
        if (!data) {
            try {
                const res = await fetch('public/assets/team.json', { cache: 'force-cache' });
                if (!res.ok) throw new Error('team.json ' + res.status);
                data = await res.json();
                this._cache = data;
            } catch (err) {
                // Fallback to a minimal default rather than crashing the modal
                data = {
                    projectTitle: 'PULSE 911',
                    school: 'MDRRMO Morong, Rizal',
                    year: '',
                    members: [],
                    tagline: '',
                };
            }
        }
        this._open(data);
    },

    _open(d) {
        let container = document.getElementById('team-modal-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'team-modal-container';
            document.body.appendChild(container);
        }

        const esc = (s) => this._esc(s);
        const members = Array.isArray(d.members) ? d.members : [];

        const schoolLine = [d.school, d.program].filter(Boolean).map(esc).join(' &mdash; ');
        const adviserLine = d.adviser ? `<div class="detail-modal__section-text">Adviser: ${esc(d.adviser)}</div>` : '';
        const yearLine = d.year ? `<div class="detail-modal__section-text" style="color: var(--color-gray-500);">${esc(d.year)}</div>` : '';

        const memberCards = members.length
            ? members.map(m => `
                <div class="team-card">
                    <div class="team-card__name">${esc(m.name || '')}</div>
                    ${m.role ? `<div class="team-card__role">${esc(m.role)}</div>` : ''}
                </div>
            `).join('')
            : '<div class="team-card"><div class="team-card__name">PULSE 911 team</div></div>';

        const ack = d.acknowledgements
            ? `<div class="detail-modal__section">
                   <div class="detail-modal__section-title">Acknowledgements</div>
                   <div class="detail-modal__section-text">${esc(d.acknowledgements)}</div>
               </div>`
            : '';

        const tagline = d.tagline
            ? `<div class="detail-modal__section" style="text-align:center;">
                   <em style="color: var(--color-gray-500);">${esc(d.tagline)}</em>
               </div>`
            : '';

        container.innerHTML = `
            <div class="modal-overlay modal-overlay--centered" onclick="if(event.target===this) TeamModal.close()">
                <div class="modal detail-modal">
                    <button type="button" class="detail-modal__close" onclick="TeamModal.close()" aria-label="Close">
                        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    <div class="detail-modal__body">
                        <h2 class="detail-modal__title">${esc(d.projectTitle || 'About Us')}</h2>
                        ${schoolLine ? `<div class="detail-modal__section-text">${schoolLine}</div>` : ''}
                        ${adviserLine}
                        ${yearLine}

                        <div class="detail-modal__section">
                            <div class="detail-modal__section-title">Team</div>
                            <div class="team-grid">${memberCards}</div>
                        </div>

                        ${ack}
                        ${tagline}
                    </div>
                    <div class="detail-modal__footer">
                        <button type="button" class="btn btn--primary btn--block" onclick="TeamModal.close()">Close</button>
                    </div>
                </div>
            </div>
        `;
        document.body.style.overflow = 'hidden';
    },

    close() {
        const container = document.getElementById('team-modal-container');
        if (container) container.innerHTML = '';
        document.body.style.overflow = '';
    },

    _esc(str) {
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
};

window.TeamModal = TeamModal;
