/* ============================================================
   Carrier Lookup — classifies a PH phone number by its prefix.
   Source: NTC 2024 number-block allocations. Useful for the
   Emergency page so users know which SIM they should call from
   to avoid inter-network charges on legacy plans.
   ============================================================ */

const CarrierLookup = {
    _prefixMap: {
        // Globe / TM
        '0817': 'Globe', '0905': 'Globe', '0906': 'Globe', '0915': 'Globe', '0916': 'Globe',
        '0917': 'Globe', '0926': 'Globe', '0927': 'Globe', '0935': 'Globe', '0936': 'Globe',
        '0937': 'Globe', '0945': 'Globe', '0953': 'Globe', '0954': 'Globe', '0955': 'Globe',
        '0956': 'Globe', '0965': 'Globe', '0966': 'Globe', '0967': 'Globe', '0975': 'Globe',
        '0976': 'Globe', '0977': 'Globe', '0978': 'Globe', '0994': 'Globe', '0995': 'Globe',
        '0996': 'Globe', '0997': 'Globe',
        // Smart / TNT / Sun (all Smart family)
        '0813': 'Smart', '0907': 'Smart', '0908': 'Smart', '0909': 'Smart', '0910': 'Smart',
        '0911': 'Smart', '0912': 'Smart', '0913': 'Smart', '0914': 'Smart', '0918': 'Smart',
        '0919': 'Smart', '0920': 'Smart', '0921': 'Smart', '0922': 'Smart', '0923': 'Smart',
        '0924': 'Smart', '0925': 'Smart', '0928': 'Smart', '0929': 'Smart', '0930': 'Smart',
        '0938': 'Smart', '0939': 'Smart', '0940': 'Smart', '0946': 'Smart', '0947': 'Smart',
        '0948': 'Smart', '0949': 'Smart', '0950': 'Smart', '0951': 'Smart', '0961': 'Smart',
        '0963': 'Smart', '0968': 'Smart', '0969': 'Smart', '0970': 'Smart', '0981': 'Smart',
        '0989': 'Smart', '0992': 'Smart', '0998': 'Smart', '0999': 'Smart',
        // DITO
        '0991': 'DITO', '0993': 'DITO', '0895': 'DITO', '0896': 'DITO', '0897': 'DITO', '0898': 'DITO',
    },

    lookup(raw) {
        if (!raw) return null;
        const digits = String(raw).replace(/\D/g, '');
        let normalized = digits;
        // International +63 → local 09-format
        if (normalized.startsWith('63') && normalized.length === 12) normalized = '0' + normalized.slice(2);
        // Bare 10-digit (9xxxxxxxxx) → add leading 0
        if (normalized.length === 10 && normalized.startsWith('9')) normalized = '0' + normalized;
        if (normalized.length !== 11) {
            // Landline heuristic: PH area code 02/032/etc., or 7-8 digit bare numbers
            return (digits.length >= 6 && digits.length <= 9) ? 'Landline' : null;
        }
        const prefix = normalized.slice(0, 4);
        return this._prefixMap[prefix] || 'Unknown';
    },
};

window.CarrierLookup = CarrierLookup;
