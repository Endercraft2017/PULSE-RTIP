/* ============================================================
   Barangay List — Morong, Rizal
   ============================================================
   Single source of truth for the 11 barangays used across
   signup, profile edits, and any barangay-targeted filters.
   Kept as a tiny static list (not fetched) — it never changes
   and needs to be available synchronously at first paint.
   ============================================================ */

const MORONG_BARANGAYS = [
    'Bombongan', 'Caingin', 'Can-Cal-Lay', 'Cuasay', 'Lagundi', 'Maybancal',
    'Poblacion', 'San Guillermo', 'San Jose', 'San Juan', 'San Pedro'
];

window.MorongBarangays = MORONG_BARANGAYS;
