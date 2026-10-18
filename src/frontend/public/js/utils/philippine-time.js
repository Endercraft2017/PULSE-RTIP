/* UTC storage, Philippine civil-time display, including legacy naive DB values. */
window.PhilippineTime = {
    parse(value) {
        if (value instanceof Date) return value;
        if (!value) return null;
        const raw = String(value);
        return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : raw.replace(' ', 'T') + 'Z');
    },
    format(value) {
        const date = this.parse(value);
        if (!date || Number.isNaN(date.getTime())) return 'N/A';
        return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3, timeZoneName: 'short' }).format(date);
    }
};
