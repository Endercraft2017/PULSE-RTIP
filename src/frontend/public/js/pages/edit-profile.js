/* ============================================================
   Edit Profile Page
   ============================================================
   Table of Contents:
   1. Render method
   2. Save handler
   ============================================================ */

const EditProfilePage = {
    render() {
        const user = Store.get('user') || {};

        return `
            <div class="page-padding">
                <div class="profile-header" style="padding-bottom: var(--spacing-md);">
                    <div class="profile-header__avatar">${user.avatar || 'U'}</div>
                </div>
                <div class="card">
                    <div class="edit-form">
                        <div class="input-group">
                            <label class="input-group__label">Full Name</label>
                            <input class="input-group__field" type="text" id="edit-name" value="${user.name || ''}">
                        </div>
                        <div class="input-group">
                            <label class="input-group__label">Email</label>
                            <input class="input-group__field" type="email" value="${user.email || ''}" disabled>
                        </div>
                        <div class="input-group">
                            <label class="input-group__label">Phone Number</label>
                            <input class="input-group__field" type="tel" id="edit-phone" value="${user.phone || ''}">
                        </div>
                        <div class="input-group">
                            <label class="input-group__label">Address</label>
                            <input class="input-group__field" type="text" id="edit-address" value="${user.address || ''}">
                        </div>
                        <div class="edit-form__actions">
                            <button class="btn btn--outline" onclick="history.back()">Cancel</button>
                            <button class="btn btn--primary" id="save-profile-btn" onclick="EditProfilePage.handleSave()">Save Changes</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async handleSave() {
        const name = document.getElementById('edit-name').value.trim();
        const phone = document.getElementById('edit-phone').value.trim();
        const address = document.getElementById('edit-address').value.trim();
        const btn = document.getElementById('save-profile-btn');

        if (!name) { alert('Name is required.'); return; }

        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
            const res = await Store.apiFetch('/api/users/me', {
                method: 'PUT',
                body: JSON.stringify({ name, phone, address }),
            });

            if (res.success) {
                Store.set('user', res.data);
                history.back();
            } else {
                alert(res.message || 'Failed to update profile.');
            }
        } catch (err) {
            alert('Network error. Please try again.');
        }

        btn.disabled = false;
        btn.textContent = 'Save Changes';
    }
};
