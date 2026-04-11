/* ============================================================
   Terms Modal - Shared terms & conditions / privacy modal
   ============================================================
   Usage:
     TermsModal.show('terms')     // Terms & Conditions
     TermsModal.show('privacy')   // Privacy Policy
   Table of Contents:
   1. Content blocks
   2. Render method
   3. Show / close methods
   ============================================================ */

const TermsModal = {
    /* --------------------------------------------------------
     * 1. Content blocks
     * -------------------------------------------------------- */
    content: {
        terms: {
            title: 'Terms & Conditions',
            lastUpdated: 'Last updated: January 8, 2026',
            sections: [
                {
                    heading: '1. Acceptance of Terms',
                    body: 'By accessing or using PULSE 911, the official emergency reporting system of MDRRMO Morong, Rizal, you agree to be bound by these Terms & Conditions. If you do not agree with any part of these terms, you should not use this application.'
                },
                {
                    heading: '2. Purpose of the Service',
                    body: 'PULSE 911 is provided as a communication tool between citizens of Morong, Rizal and the Municipal Disaster Risk Reduction and Management Office. It is intended for the reporting of incidents, hazards, and emergencies, and for receiving official advisories from MDRRMO.'
                },
                {
                    heading: '3. Accurate Reporting',
                    body: 'Users must submit accurate and truthful information when reporting incidents. Filing false, misleading, or malicious reports is strictly prohibited and may result in suspension of your account and legal action under applicable Philippine laws, including penalties for false reporting under the Revised Penal Code.'
                },
                {
                    heading: '4. Account Responsibility',
                    body: 'You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. Notify MDRRMO immediately of any unauthorized access or security breach.'
                },
                {
                    heading: '5. Media Uploads',
                    body: 'When submitting photos or videos with your reports, you grant MDRRMO a non-exclusive license to use, store, and share this media solely for emergency response and public safety purposes. Do not upload content that contains personally identifiable information of others without consent.'
                },
                {
                    heading: '6. Emergency Disclaimer',
                    body: 'PULSE 911 is a supplementary tool and does not replace the official emergency hotlines. In a life-threatening situation, always call 911 or the appropriate emergency service directly.'
                },
                {
                    heading: '7. Data Usage',
                    body: 'Report data, including location coordinates, may be used by MDRRMO for statistical analysis, hazard mapping, and improving disaster response planning. All data is handled in accordance with the Philippine Data Privacy Act of 2012 (RA 10173).'
                },
                {
                    heading: '8. Service Availability',
                    body: 'While we aim for continuous service, MDRRMO does not guarantee uninterrupted access to PULSE 911. The application may be unavailable during maintenance, outages, or for reasons beyond our control.'
                },
                {
                    heading: '9. Modifications',
                    body: 'MDRRMO reserves the right to update these Terms & Conditions at any time. Continued use of the application after changes constitutes acceptance of the revised terms.'
                },
                {
                    heading: '10. Contact',
                    body: 'For questions or concerns regarding these terms, contact MDRRMO Morong, Rizal at mdrrmo@morong.gov.ph or visit the Municipal Hall during office hours.'
                }
            ]
        },
        privacy: {
            title: 'Privacy Policy',
            lastUpdated: 'Last updated: January 8, 2026',
            sections: [
                {
                    heading: '1. Information We Collect',
                    body: 'PULSE 911 collects personal information you provide during registration (name, email, phone number, address), verification IDs, and information submitted with reports (title, description, location, photos, video).'
                },
                {
                    heading: '2. How We Use Your Data',
                    body: 'Your information is used to facilitate emergency response, verify your identity, communicate report updates, and generate hazard analytics for disaster preparedness. Data is never sold to third parties.'
                },
                {
                    heading: '3. Location Data',
                    body: 'GPS location is only captured when you explicitly tap the "Use GPS" button during report creation. This location is used to help responders locate incidents and is stored only with the associated report.'
                },
                {
                    heading: '4. Data Sharing',
                    body: 'Report information may be shared with authorized MDRRMO personnel, coordinated partner agencies (police, fire, health services), and relevant local government units strictly for emergency response purposes.'
                },
                {
                    heading: '5. Data Security',
                    body: 'We implement technical and organizational measures to protect your information from unauthorized access, loss, or misuse. Passwords are hashed and sensitive data is encrypted in transit.'
                },
                {
                    heading: '6. Your Rights',
                    body: 'Under the Philippine Data Privacy Act, you have the right to access, correct, or request deletion of your personal data. Contact MDRRMO to exercise these rights.'
                },
                {
                    heading: '7. Data Retention',
                    body: 'Account information is retained for as long as your account is active. Report data is retained for historical and analytical purposes in accordance with government record-keeping requirements.'
                },
                {
                    heading: '8. Children\'s Privacy',
                    body: 'PULSE 911 is not intended for users under 13 years of age. If you believe a minor has provided us with personal information, please contact MDRRMO immediately.'
                },
                {
                    heading: '9. Contact',
                    body: 'For privacy-related inquiries, contact the MDRRMO Data Protection Officer at privacy@morong.gov.ph.'
                }
            ]
        }
    },

    /* --------------------------------------------------------
     * 2. Render
     * -------------------------------------------------------- */
    render(type) {
        const data = this.content[type] || this.content.terms;

        const sectionsHtml = data.sections.map(s => `
            <div class="terms-modal__section">
                <div class="terms-modal__section-heading">${s.heading}</div>
                <div class="terms-modal__section-body">${s.body}</div>
            </div>
        `).join('');

        return `
            <div class="modal-overlay modal-overlay--centered" onclick="if(event.target===this) TermsModal.close()">
                <div class="modal terms-modal">
                    <div class="terms-modal__header">
                        <div>
                            <div class="terms-modal__title">${data.title}</div>
                            <div class="terms-modal__updated">${data.lastUpdated}</div>
                        </div>
                        <button class="terms-modal__close" onclick="TermsModal.close()" aria-label="Close">
                            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    <div class="terms-modal__body">
                        ${sectionsHtml}
                    </div>
                    <div class="terms-modal__footer">
                        <button class="btn btn--primary btn--block" onclick="TermsModal.close()">I Understand</button>
                    </div>
                </div>
            </div>
        `;
    },

    /* --------------------------------------------------------
     * 3. Show / close
     * -------------------------------------------------------- */
    show(type) {
        let container = document.getElementById('terms-modal-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'terms-modal-container';
            document.body.appendChild(container);
        }
        container.innerHTML = this.render(type);
        document.body.style.overflow = 'hidden';
    },

    close() {
        const container = document.getElementById('terms-modal-container');
        if (container) container.innerHTML = '';
        document.body.style.overflow = '';
    }
};

// Ensure TermsModal is available on window for inline event handlers
window.TermsModal = TermsModal;
