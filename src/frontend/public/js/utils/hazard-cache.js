/* ============================================================
   HazardCache — offline fallback for /api/hazards
   ============================================================
   Wraps the hazards fetch with a localStorage cache. When the
   network request succeeds, the latest payload is cached. When
   it fails (no connectivity), the cached copy is returned so
   users can still see the last known hazard list.

   Usage:
     const { data, fromCache, cachedAt } = await HazardCache.fetch();
     if (fromCache) { show "offline — showing saved data" note }
   ============================================================ */

const HazardCache = {
    _KEY: 'pulse_hazards_cache',

    async fetch() {
        try {
            const res = await Store.apiFetch('/api/hazards');
            if (res && res.success) {
                this._save(res.data);
                return { data: res.data, fromCache: false, cachedAt: Date.now() };
            }
            // API returned {success:false} — treat like a failure so users
            // still see something rather than an empty list.
            return this._fallback();
        } catch (err) {
            return this._fallback();
        }
    },

    _save(data) {
        try {
            localStorage.setItem(this._KEY, JSON.stringify({
                data: data,
                cachedAt: Date.now(),
            }));
        } catch (e) {
            // Quota or private mode — non-fatal.
        }
    },

    _fallback() {
        const cached = this._read();
        if (cached) {
            return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt };
        }
        return { data: [], fromCache: false, cachedAt: null };
    },

    _read() {
        try {
            const raw = localStorage.getItem(this._KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.data)) return null;
            return parsed;
        } catch (e) {
            return null;
        }
    },

    formatAge(cachedAt) {
        if (!cachedAt) return '';
        const mins = Math.max(0, Math.round((Date.now() - cachedAt) / 60000));
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins} min ago`;
        const hours = Math.round(mins / 60);
        if (hours < 24) return `${hours} hr ago`;
        const days = Math.round(hours / 24);
        return `${days} day${days === 1 ? '' : 's'} ago`;
    },
};

window.HazardCache = HazardCache;
