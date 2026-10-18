/* ============================================================
   Barangay List — Morong, Rizal
   ============================================================
   Shared directory, refreshed from the public API with the last successful
   response cached for offline use. The historical list is only a fallback.
   ============================================================ */

const MORONG_BARANGAYS = [
    'Bombongan', 'Caingin', 'Can-Cal-Lay', 'Cuasay', 'Lagundi', 'Maybancal',
    'Poblacion', 'San Guillermo', 'San Jose', 'San Juan', 'San Pedro'
];

window.MorongBarangays = MORONG_BARANGAYS;

window.refreshBarangays = async function () {
    try {
        const response = await Store.apiFetch('/api/barangays');
        if (response.success) {
            window.MorongBarangays.splice(0, window.MorongBarangays.length, ...response.data.filter(b => b.active).map(b => b.name));
            localStorage.setItem('pulse_barangay_directory', JSON.stringify(window.MorongBarangays));
            // Signup can render before the request finishes. Update its live
            // options without replacing the form or losing other input values.
            const select = document.getElementById('signup-barangay');
            if (select) {
                const selected = select.value;
                const placeholder = select.querySelector('option[value=""]')?.cloneNode(true) || new Option('Select barangay', '');
                select.replaceChildren(placeholder, ...window.MorongBarangays.map(name => new Option(name, name)));
                select.value = window.MorongBarangays.includes(selected) ? selected : '';
            }
        }
    } catch (_) { /* Retain the most recent directory when offline. */ }
};
try {
    const cached = JSON.parse(localStorage.getItem('pulse_barangay_directory'));
    if (Array.isArray(cached)) window.MorongBarangays.splice(0, window.MorongBarangays.length, ...cached);
} catch (_) {}
setTimeout(() => window.refreshBarangays(), 0);
